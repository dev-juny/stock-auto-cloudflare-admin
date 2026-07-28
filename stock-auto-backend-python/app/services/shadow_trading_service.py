from __future__ import annotations

import json
import uuid
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.database import execute_query, execute_non_query, acquire_conn
from app.services.service_db import add_system_log, get_settings
from app.services.strategy_lifecycle import (
    get_strategies_by_stage,
)

logger = logging.getLogger(__name__)

SHADOW_MIN_DAYS = 20
SHADOW_MIN_TRADES = 10
SHADOW_MAX_DD = 15
SHADOW_MIN_PF = 1.2
SHADOW_MIN_SCORE = 0.5

ORDER_UUIDS: set = set()

async def ensure_shadow_tables():
    conn = await acquire_conn()
    try:
        for ddl in [
            """CREATE TABLE IF NOT EXISTS shadow_session (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                strategy_id NUMBER NOT NULL,
                name VARCHAR2(200),
                generation NUMBER(5),
                status VARCHAR2(30) DEFAULT 'active',
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                total_orders NUMBER(8) DEFAULT 0,
                successful_orders NUMBER(8) DEFAULT 0,
                failed_orders NUMBER(8) DEFAULT 0,
                total_pnl NUMBER(15,2) DEFAULT 0,
                total_return NUMBER(10,4) DEFAULT 0,
                max_drawdown NUMBER(10,4) DEFAULT 0,
                win_rate NUMBER(5,2) DEFAULT 0,
                profit_factor NUMBER(10,4) DEFAULT 0,
                details_json CLOB
            )""",
            """CREATE TABLE IF NOT EXISTS shadow_order (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                session_id NUMBER NOT NULL,
                strategy_id NUMBER NOT NULL,
                order_uuid VARCHAR2(64) UNIQUE,
                ticker VARCHAR2(20) NOT NULL,
                direction VARCHAR2(10) NOT NULL,
                order_type VARCHAR2(20) DEFAULT 'market',
                requested_price NUMBER(15,2) DEFAULT 0,
                executed_price NUMBER(15,2),
                quantity NUMBER(10) DEFAULT 0,
                executed_quantity NUMBER(10) DEFAULT 0,
                status VARCHAR2(20) DEFAULT 'new',
                status_detail VARCHAR2(200),
                pnl NUMBER(15,2) DEFAULT 0,
                    pnl_pct NUMBER(10,4) DEFAULT 0,
                reason VARCHAR2(200),
                risk_check_passed CHAR(1) DEFAULT 'Y',
                market_hours_valid CHAR(1) DEFAULT 'Y',
                balance_ok CHAR(1) DEFAULT 'Y',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS shadow_position (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                session_id NUMBER NOT NULL,
                strategy_id NUMBER NOT NULL,
                ticker VARCHAR2(20) NOT NULL,
                direction VARCHAR2(10) NOT NULL,
                entry_price NUMBER(15,2) DEFAULT 0,
                current_price NUMBER(15,2) DEFAULT 0,
                quantity NUMBER(10) DEFAULT 0,
                pnl NUMBER(15,2) DEFAULT 0,
                    pnl_pct NUMBER(10,4) DEFAULT 0,
                highest_price NUMBER(15,2) DEFAULT 0,
                is_break_even CHAR(1) DEFAULT 'N',
                holding_days NUMBER(5) DEFAULT 0,
                orders_json CLOB,
                entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
        ]:
            conn.cursor().execute(ddl)
        conn.commit()
    finally:
        conn.close()


# ── Market hours ─────────────────────────────────────────────────

def _now_kst() -> datetime:
    return datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=9)))

def _is_market_open() -> tuple[bool, str]:
    now = _now_kst()
    if now.weekday() >= 5:
        return False, "Weekend"
    if now.hour < 9:
        return False, "Before market open (09:00 KST)"
    if now.hour >= 15 and now.minute >= 20:
        return False, "After market close (15:20 KST)"
    if now.hour == 11 and now.minute >= 30 and (now.hour == 12):
        return False, "Lunch break (11:30-12:00 KST)"
    return True, ""


def _generate_order_uuid() -> str:
    return str(uuid.uuid4()).replace("-", "")[:32]


async def _get_shadow_position(session_id: int, ticker: str) -> Optional[dict]:
    rows = await execute_query(
        "SELECT id, quantity, entry_price, direction FROM shadow_position WHERE session_id = :1 AND ticker = :2",
        [session_id, ticker],
    )
    if rows:
        r = rows[0]
        return {"id": r[0], "quantity": r[1] or 0, "entry_price": r[2] or 0, "direction": r[3]}
    return None


async def _check_duplicate_order(ticker: str, direction: str, strategy_id: int, session_id: int) -> bool:
    rows = await execute_query(
        "SELECT COUNT(*) FROM shadow_order WHERE session_id = :1 AND strategy_id = :2 AND ticker = :3 AND direction = :4 AND status IN ('new', 'partial') AND created_at > CURRENT_TIMESTAMP - INTERVAL '1' HOUR",
        [session_id, strategy_id, ticker, direction],
    )
    return (rows[0][0] if rows else 0) > 0


async def _check_idempotency(order_uuid: str) -> bool:
    if order_uuid in ORDER_UUIDS:
        return True
    rows = await execute_query(
        "SELECT COUNT(*) FROM shadow_order WHERE order_uuid = :1", [order_uuid],
    )
    if rows and rows[0][0] > 0:
        ORDER_UUIDS.add(order_uuid)
        return True
    return False


async def _check_balance(session_id: int, estimated_cost: float) -> tuple[bool, str]:
    total_invested = await execute_query(
        "SELECT COALESCE(SUM(entry_price * quantity), 0) FROM shadow_position WHERE session_id = :1",
        [session_id],
    )
    invested = total_invested[0][0] if total_invested else 0
    initial = 10000000
    if invested + estimated_cost > initial * 0.95:
        return False, f"Exceeds 95% max investment (invested={invested:.0f}, cost={estimated_cost:.0f})"
    if estimated_cost > initial * 0.3:
        return False, f"Single order exceeds 30% of capital ({estimated_cost:.0f} > {initial*0.3:.0f})"
    return True, ""


async def _check_risk_limits(session_id: int, ticker: str) -> tuple[bool, str]:
    open_orders = await execute_query(
        "SELECT COUNT(*) FROM shadow_order WHERE session_id = :1 AND status IN ('new', 'partial') AND created_at > CURRENT_TIMESTAMP - INTERVAL '1' MINUTE",
        [session_id],
    )
    if open_orders and open_orders[0][0] > 10:
        return False, "Too many concurrent open orders (>10/min)"

    positions = await execute_query(
        "SELECT COUNT(*) FROM shadow_position WHERE session_id = :1",
        [session_id],
    )
    max_pos = 20
    if positions and positions[0][0] >= max_pos:
        return False, f"Max positions reached ({max_pos})"

    sector_rows = await execute_query(
        "SELECT COUNT(*) FROM shadow_position sp JOIN stock_info si ON si.ticker = sp.ticker WHERE sp.session_id = :1 AND si.sector = (SELECT sector FROM stock_info WHERE ticker = :2)",
        [session_id, ticker],
    )
    if sector_rows and sector_rows[0][0] >= 5:
        return False, "Sector limit reached (max 5)"

    return True, ""


async def create_shadow_session(strategy_id: int) -> dict:
    existing = await execute_query(
        "SELECT COUNT(*) FROM shadow_session WHERE strategy_id = :1 AND status = 'active'",
        [strategy_id],
    )
    if existing and existing[0][0] > 0:
        return {"status": "FAILED", "message": f"Strategy {strategy_id} already has an active shadow session"}

    name_row = await execute_query(
        "SELECT name, generation FROM strategy_registry WHERE strategy_id = :1", [strategy_id],
    )
    name = name_row[0][0] if name_row else ""
    gen = name_row[0][1] if name_row else 0

    sid = await execute_non_query(
        """INSERT INTO shadow_session (strategy_id, name, generation, status)
           VALUES (:1,:2,:3,'active') RETURNING id INTO :4""",
        [strategy_id, name, gen, None],
    )

    await promote_strategy(strategy_id, "Starting shadow trading session")
    await add_system_log("shadow", "shadow_trading", f"Shadow session started for strategy {strategy_id}", {"name": name})

    return {"status": "SUCCESS", "session_id": sid, "strategy_id": strategy_id, "name": name}


async def stop_shadow_session(session_id: int) -> dict:
    rows = await execute_query(
        "SELECT strategy_id FROM shadow_session WHERE id = :1", [session_id],
    )
    if not rows:
        return {"status": "FAILED", "message": f"Session {session_id} not found"}

    await execute_non_query(
        "UPDATE shadow_session SET status = 'stopped', ended_at = CURRENT_TIMESTAMP WHERE id = :1",
        [session_id],
    )
    await add_system_log("shadow", "shadow_trading", f"Shadow session {session_id} stopped", {})
    return {"status": "SUCCESS", "session_id": session_id}


async def execute_shadow_order(session_id: int, ticker: str, direction: str, price: float, quantity: int,
                               strategy_id: int = 0, order_type: str = "market") -> dict:
    open_ok, open_msg = _is_market_open()
    if not open_ok:
        return {"status": "REJECTED", "message": open_msg, "reason": "market_hours"}

    if not strategy_id:
        srow = await execute_query(
            "SELECT strategy_id FROM shadow_session WHERE id = :1", [session_id],
        )
        if not srow:
            return {"status": "FAILED", "message": "Session not found"}
        strategy_id = srow[0][0]

    order_uuid = _generate_order_uuid()
    if await _check_idempotency(order_uuid):
        return {"status": "DUPLICATE", "message": "Duplicate order (UUID already exists)", "order_uuid": order_uuid}

    if await _check_duplicate_order(ticker, direction, strategy_id, session_id):
        return {"status": "REJECTED", "message": f"Duplicate order: {ticker} {direction} already pending", "reason": "duplicate_order"}

    pos = await _get_shadow_position(session_id, ticker)
    if pos and direction == "buy":
        return {"status": "REJECTED", "message": f"Already holding {ticker}", "reason": "duplicate_position"}

    estimated_cost = price * quantity
    bal_ok, bal_msg = await _check_balance(session_id, estimated_cost)
    if not bal_ok:
        return {"status": "REJECTED", "message": bal_msg, "reason": "insufficient_balance"}

    risk_ok, risk_msg = await _check_risk_limits(session_id, ticker)
    if not risk_ok:
        return {"status": "REJECTED", "message": risk_msg, "reason": "risk_limit"}

    executed_price = round(price * (1 + 0.001 if direction == "buy" else 1 - 0.001), 2)
    executed_qty = quantity

    try:
        await execute_non_query(
            """INSERT INTO shadow_order (session_id, strategy_id, order_uuid, ticker, direction, order_type,
               requested_price, executed_price, quantity, executed_quantity, status, market_hours_valid, balance_ok, risk_check_passed)
               VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,'filled','Y',:11,:12)""",
            [session_id, strategy_id, order_uuid, ticker, direction, order_type,
             price, executed_price, quantity, executed_qty, 'Y' if bal_ok else 'N', 'Y' if risk_ok else 'N'],
        )
    except Exception as e:
        if "unique constraint" in str(e).lower() or "unique" in str(e).lower():
            return {"status": "DUPLICATE", "message": "Duplicate order UUID", "order_uuid": order_uuid}
        raise

    ORDER_UUIDS.add(order_uuid)

    if direction == "buy":
        await execute_non_query(
            """INSERT INTO shadow_position (session_id, strategy_id, ticker, direction, entry_price, current_price, quantity, highest_price)
               VALUES (:1,:2,:3,:4,:5,:6,:7,:8)""",
            [session_id, strategy_id, ticker, direction, executed_price, executed_price, executed_qty, executed_price],
        )
    else:
        if pos:
            pnl = (executed_price - pos["entry_price"]) * min(quantity, pos["quantity"])
            pnl_pct = ((executed_price - pos["entry_price"]) / pos["entry_price"]) * 100 if pos["entry_price"] else 0
            remain = pos["quantity"] - quantity
            if remain <= 0:
                await execute_non_query(
                    "DELETE FROM shadow_position WHERE id = :1", [pos["id"]],
                )
            else:
                await execute_non_query(
                    "UPDATE shadow_position SET quantity = :1 WHERE id = :2",
                    [remain, pos["id"]],
                )
            await update_session_stats(session_id)

    await execute_non_query(
        "UPDATE shadow_session SET total_orders = total_orders + 1, successful_orders = successful_orders + 1 WHERE id = :1",
        [session_id],
    )

    return {
        "status": "SUCCESS",
        "order_uuid": order_uuid,
        "ticker": ticker,
        "direction": direction,
        "executed_price": executed_price,
        "executed_quantity": executed_qty,
        "order_type": order_type,
        "message": f"{direction.upper()} {ticker} {executed_qty}@ {executed_price}",
    }


async def update_session_stats(session_id: int):
    orders = await execute_query(
        "SELECT direction, executed_price, quantity, pnl, pnl_pct FROM shadow_order WHERE session_id = :1 AND status = 'filled'",
        [session_id],
    )
    if not orders:
        return

    total_pnl = sum(r[3] or 0 for r in orders)
    wins = sum(1 for r in orders if (r[3] or 0) > 0)
    total = len(orders)

    positions = await execute_query(
        "SELECT entry_price, current_price FROM shadow_position WHERE session_id = :1",
        [session_id],
    )
    unrealized = sum((r[1] - r[0]) for r in positions) if positions else 0

    await execute_non_query(
        """UPDATE shadow_session SET total_pnl = :1, total_return = :2, win_rate = :3,
           profit_factor = :4 WHERE id = :5""",
        [total_pnl + unrealized,
         (total_pnl + unrealized) / 10000000 * 100 if abs(total_pnl + unrealized) < 1e9 else 0,
         (wins / total * 100) if total > 0 else 0,
         0, session_id],
    )


async def get_shadow_session(session_id: int) -> Optional[dict]:
    rows = await execute_query(
        "SELECT id, strategy_id, name, generation, status, started_at, ended_at, total_orders, successful_orders, failed_orders, total_pnl, total_return, max_drawdown, win_rate, profit_factor, details_json FROM shadow_session WHERE id = :1",
        [session_id],
    )
    if not rows:
        return None
    r = rows[0]
    return {
        "id": r[0], "strategy_id": r[1], "name": r[2] or "", "generation": r[3] or 0,
        "status": r[4],
        "started_at": r[5].isoformat() if r[5] and hasattr(r[5], 'isoformat') else str(r[5]) if r[5] else "",
        "ended_at": r[6].isoformat() if r[6] and hasattr(r[6], 'isoformat') else str(r[6]) if r[6] else "",
        "total_orders": r[7] or 0, "successful_orders": r[8] or 0, "failed_orders": r[9] or 0,
        "total_pnl": r[10] or 0, "total_return": r[11] or 0, "max_drawdown": r[12] or 0,
        "win_rate": r[13] or 0, "profit_factor": r[14] or 0,
        "details": json.loads(r[15]) if r[15] else {},
    }


async def list_shadow_sessions(status: str = "") -> list[dict]:
    sql = "SELECT id, strategy_id, name, generation, status, started_at, ended_at, total_orders, successful_orders, failed_orders, total_pnl, total_return, win_rate FROM shadow_session"
    binds = []
    if status:
        sql += " WHERE status = :1"
        binds.append(status)
    sql += " ORDER BY started_at DESC"
    rows = await execute_query(sql, binds if binds else None)
    return [
        {"id": r[0], "strategy_id": r[1], "name": r[2] or "", "generation": r[3] or 0,
         "status": r[4],
         "started_at": r[5].isoformat() if r[5] and hasattr(r[5], 'isoformat') else str(r[5]) if r[5] else "",
         "ended_at": r[6].isoformat() if r[6] and hasattr(r[6], 'isoformat') else str(r[6]) if r[6] else "",
         "total_orders": r[7] or 0, "successful_orders": r[8] or 0, "failed_orders": r[9] or 0,
         "total_pnl": r[10] or 0, "total_return": r[11] or 0, "win_rate": r[12] or 0}
        for r in rows
    ]


async def get_shadow_orders(session_id: int, limit: int = 50) -> list[dict]:
    rows = await execute_query(
        """SELECT id, session_id, strategy_id, order_uuid, ticker, direction, order_type,
                  requested_price, executed_price, quantity, executed_quantity, status, status_detail,
                  pnl, pnl_pct, reason, risk_check_passed, market_hours_valid, balance_ok, created_at
           FROM shadow_order WHERE session_id = :1 ORDER BY created_at DESC""",
        [session_id],
    )
    return [
        {"id": r[0], "session_id": r[1], "strategy_id": r[2], "order_uuid": r[3],
         "ticker": r[4], "direction": r[5], "order_type": r[6],
         "requested_price": r[7] or 0, "executed_price": r[8] or 0,
         "quantity": r[9] or 0, "executed_quantity": r[10] or 0,
         "status": r[11], "status_detail": r[12] or "",
         "pnl": r[13] or 0, "pnl_pct": r[14] or 0, "reason": r[15] or "",
         "risk_check_passed": r[16] == 'Y', "market_hours_valid": r[17] == 'Y', "balance_ok": r[18] == 'Y',
         "created_at": r[19].isoformat() if r[19] and hasattr(r[19], 'isoformat') else str(r[19]) if r[19] else ""}
        for r in rows[:limit]
    ]


async def get_shadow_positions(session_id: int) -> list[dict]:
    rows = await execute_query(
        "SELECT id, session_id, strategy_id, ticker, direction, entry_price, current_price, quantity, pnl, pnl_pct, highest_price, is_break_even, holding_days, entered_at FROM shadow_position WHERE session_id = :1",
        [session_id],
    )
    return [
        {"id": r[0], "session_id": r[1], "strategy_id": r[2], "ticker": r[3],
         "direction": r[4], "entry_price": r[5] or 0, "current_price": r[6] or 0,
         "quantity": r[7] or 0, "pnl": r[8] or 0, "pnl_pct": r[9] or 0,
         "highest_price": r[10] or 0, "is_break_even": r[11] == 'Y', "holding_days": r[12] or 0,
         "entered_at": r[13].isoformat() if r[13] and hasattr(r[13], 'isoformat') else str(r[13]) if r[13] else ""}
        for r in rows
    ]


async def evaluate_shadow_for_production(session_id: int) -> dict:
    return {
        "status": "WAITING_MANUAL_APPROVAL",
        "message": "Auto-promotion from shadow trading is disabled. Use /api/production/promote-to-production for manual approval.",
        "details": {"auto_promotion_disabled": True, "session_id": session_id},
    }


async def get_shadow_dashboard() -> dict:
    sessions = await list_shadow_sessions()
    active_sessions = [s for s in sessions if s["status"] == "active"]
    total_orders = sum(s.get("total_orders", 0) for s in sessions)
    total_pnl = sum(s.get("total_pnl", 0) for s in sessions)

    return {
        "sessions": sessions,
        "active_sessions": active_sessions,
        "summary": {
            "total_sessions": len(sessions),
            "active_count": len(active_sessions),
            "total_orders": total_orders,
            "total_pnl": total_pnl,
        },
    }
