from __future__ import annotations

import json
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.database import execute_query, execute_non_query, acquire_conn
from app.services.service_db import add_system_log

logger = logging.getLogger(__name__)

LIFECYCLE_STAGES = [
    "created",
    "backtesting",
    "paper_trading",
    "survivor",
    "production_candidate",
    "shadow_trading",
    "production",
    "retired",
    "failed",
    "archived",
]

PROMOTION_PATH = {
    "created": "backtesting",
    "backtesting": "paper_trading",
    "paper_trading": "survivor",
    "survivor": "production_candidate",
    "production_candidate": "shadow_trading",
}

ALLOWED_TRANSITIONS = {
    "created": {"backtesting"},
    "backtesting": {"paper_trading", "failed"},
    "paper_trading": {"survivor", "failed"},
    "survivor": {"production_candidate", "failed"},
    "production_candidate": {"shadow_trading", "failed"},
    "shadow_trading": {"failed"},
    "production": {"retired", "failed"},
    "retired": {"archived"},
    "failed": {"archived"},
    "archived": set(),
}

VALID_DEMOTE_TARGETS = {"failed", "retired", "archived", "paper_trading", "survivor", "production_candidate", "shadow_trading"}

_production_lock = False
_lock_reason = ""

async def ensure_lifecycle_tables():
    conn = await acquire_conn()
    try:
        for ddl in [
            """CREATE TABLE IF NOT EXISTS survivor_pool (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                strategy_id NUMBER NOT NULL,
                name VARCHAR2(200),
                generation NUMBER(5),
                entry_type VARCHAR2(30),
                promoted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_evaluated_at TIMESTAMP,
                survivor_score NUMBER(10,4) DEFAULT 0,
                score_breakdown_json CLOB,
                eval_count NUMBER(5) DEFAULT 0,
                total_evaluations NUMBER(5) DEFAULT 0,
                passed_evaluations NUMBER(5) DEFAULT 0,
                failed_evaluations NUMBER(5) DEFAULT 0,
                status VARCHAR2(30) DEFAULT 'active',
                notes VARCHAR2(1000)
            )""",
            """CREATE TABLE IF NOT EXISTS production_history (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                strategy_id NUMBER NOT NULL,
                name VARCHAR2(200),
                generation NUMBER(5),
                action VARCHAR2(30) NOT NULL,
                action_reason VARCHAR2(500),
                previous_stage VARCHAR2(30),
                new_stage VARCHAR2(30),
                score_before NUMBER(10,4),
                score_after NUMBER(10,4),
                details_json CLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS survivor_score_snapshots (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                strategy_id NUMBER NOT NULL,
                evaluation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                survivor_score NUMBER(10,4) DEFAULT 0,
                weighted_fitness NUMBER(10,4) DEFAULT 0,
                weighted_return NUMBER(10,4) DEFAULT 0,
                weighted_profit_factor NUMBER(10,4) DEFAULT 0,
                weighted_drawdown NUMBER(10,4) DEFAULT 0,
                weighted_sharpe NUMBER(10,4) DEFAULT 0,
                weighted_stability NUMBER(10,4) DEFAULT 0,
                win_rate NUMBER(5,2),
                total_trades NUMBER(8),
                cagr NUMBER(10,4),
                mdd NUMBER(10,4),
                recent_pnl_pct NUMBER(10,4),
                consecutive_losses NUMBER(5),
                market_adaptation_score NUMBER(10,4),
                details_json CLOB
            )""",
            """CREATE TABLE IF NOT EXISTS production_lock (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                locked CHAR(1) DEFAULT 'N',
                locked_at TIMESTAMP,
                locked_by VARCHAR2(100),
                reason VARCHAR2(500),
                strategy_id NUMBER
            )""",
        ]:
            conn.cursor().execute(ddl)
        conn.commit()
    finally:
        conn.close()


async def get_lifecycle_stage(strategy_id: int) -> Optional[str]:
    rows = await execute_query(
        "SELECT status FROM portfolio_strategy WHERE strategy_id = :1",
        [strategy_id],
    )
    return rows[0][0] if rows else None


async def set_lifecycle_stage(strategy_id: int, stage: str, reason: str = ""):
    current = await get_lifecycle_stage(strategy_id)
    if not current:
        raise ValueError(f"Strategy {strategy_id} not found")

    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if stage not in allowed:
        raise ValueError(
            f"Invalid lifecycle transition: {current} -> {stage}. "
            f"Allowed: {', '.join(sorted(allowed)) if allowed else 'none'}"
        )

    await execute_non_query(
        "UPDATE portfolio_strategy SET status = :1, updated_at = CURRENT_TIMESTAMP WHERE strategy_id = :2",
        [stage, strategy_id],
    )


async def get_current_production_id() -> Optional[int]:
    rows = await execute_query(
        "SELECT strategy_id FROM portfolio_strategy WHERE status = 'production'",
    )
    return rows[0][0] if rows else None


async def promote_strategy(strategy_id: int, reason: str = "") -> dict:
    current = await get_lifecycle_stage(strategy_id)
    if not current:
        return {"status": "FAILED", "message": f"Strategy {strategy_id} not found"}
    if current not in PROMOTION_PATH:
        return {"status": "FAILED", "message": f"Cannot promote from stage '{current}'"}
    next_stage = PROMOTION_PATH[current]

    if next_stage == "production":
        return {
            "status": "BLOCKED",
            "message": "Production promotion requires manual admin approval. Use /api/production/promote-to-production.",
        }

    conn = await acquire_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN")
        try:
            cursor.execute(
                "UPDATE portfolio_strategy SET status = :1, updated_at = CURRENT_TIMESTAMP WHERE strategy_id = :2",
                [next_stage, strategy_id],
            )

            name_row = cursor.execute(
                "SELECT name, generation FROM strategy_registry WHERE strategy_id = :1", [strategy_id]
            ).fetchone()
            name = name_row[0] if name_row else ""
            gen = name_row[1] if name_row else 0
            cursor.execute(
                """INSERT INTO production_history (strategy_id, name, generation, action, action_reason, previous_stage, new_stage)
                   VALUES (:1,:2,:3,:4,:5,:6,:7)""",
                [strategy_id, name, gen, "promote", reason[:500], current, next_stage],
            )

            cursor.execute(
                """INSERT INTO system_logs (log_type, source, message, details_json)
                   VALUES (:1,:2,:3,:4)""",
                ["lifecycle", "strategy_lifecycle",
                 f"Strategy {strategy_id} promoted: {current} -> {next_stage}",
                 json.dumps({"strategy_id": strategy_id, "from": current, "to": next_stage, "reason": reason})],
            )

            cursor.execute("COMMIT")
        except Exception:
            cursor.execute("ROLLBACK")
            raise
    finally:
        conn.close()

    return {"status": "SUCCESS", "from": current, "to": next_stage, "message": reason}


async def promote_to_production(strategy_id: int, reason: str = "Manual promotion") -> dict:
    current = await get_lifecycle_stage(strategy_id)
    if not current:
        return {"status": "FAILED", "message": f"Strategy {strategy_id} not found"}

    VALID_SOURCES = {"shadow_trading", "survivor", "production_candidate"}
    if current not in VALID_SOURCES:
        return {
            "status": "FAILED",
            "message": f"Cannot promote to production from stage '{current}'. Must be one of: {', '.join(sorted(VALID_SOURCES))}",
        }

    conn = await acquire_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN")
        try:
            cursor.execute("SELECT strategy_id FROM portfolio_strategy WHERE status = 'production' FOR UPDATE")
            existing_row = cursor.fetchone()

            if existing_row:
                existing_id = existing_row[0]
                cursor.execute(
                    "UPDATE portfolio_strategy SET status = 'retired', updated_at = CURRENT_TIMESTAMP WHERE strategy_id = :1 AND status = 'production'",
                    [existing_id],
                )
                name_row = cursor.execute(
                    "SELECT name, generation FROM strategy_registry WHERE strategy_id = :1", [existing_id]
                ).fetchone()
                ename = name_row[0] if name_row else ""
                egen = name_row[1] if name_row else 0
                cursor.execute(
                    """INSERT INTO production_history (strategy_id, name, generation, action, action_reason, previous_stage, new_stage, details_json)
                       VALUES (:1,:2,:3,:4,:5,:6,:7,:8)""",
                    [existing_id, ename, egen, "auto_retired", f"Replaced by strategy {strategy_id}", "production", "retired",
                     json.dumps({"replaced_by": strategy_id, "reason": reason})],
                )

            cursor.execute(
                "UPDATE portfolio_strategy SET status = 'production', updated_at = CURRENT_TIMESTAMP WHERE strategy_id = :1",
                [strategy_id],
            )

            name_row = cursor.execute(
                "SELECT name, generation FROM strategy_registry WHERE strategy_id = :1", [strategy_id]
            ).fetchone()
            name = name_row[0] if name_row else ""
            gen = name_row[1] if name_row else 0
            cursor.execute(
                """INSERT INTO production_history (strategy_id, name, generation, action, action_reason, previous_stage, new_stage, details_json)
                   VALUES (:1,:2,:3,:4,:5,:6,:7,:8)""",
                [strategy_id, name, gen, "promote_to_production", reason[:500], current, "production",
                 json.dumps({"manual_approval": True, "reason": reason})],
            )

            cursor.execute(
                """INSERT INTO system_logs (log_type, source, message, details_json)
                   VALUES (:1,:2,:3,:4)""",
                ["lifecycle", "promote_to_production",
                 f"Strategy {strategy_id} promoted to production: {current} -> production",
                 json.dumps({"strategy_id": strategy_id, "from": current, "to": "production", "reason": reason, "manual": True})],
            )

            cursor.execute("COMMIT")
        except Exception:
            cursor.execute("ROLLBACK")
            raise
    finally:
        conn.close()

    return {"status": "SUCCESS", "from": current, "to": "production", "message": reason}


async def demote_strategy(strategy_id: int, target: str = "failed", reason: str = "") -> dict:
    if target not in VALID_DEMOTE_TARGETS:
        return {
            "status": "BLOCKED",
            "message": f"Cannot demote to '{target}'. Allowed targets: {', '.join(sorted(VALID_DEMOTE_TARGETS))}",
        }

    if target == "production":
        return {
            "status": "BLOCKED",
            "message": "Cannot demote TO production. Production requires manual approval.",
        }

    conn = await acquire_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN")
        try:
            current_row = cursor.execute(
                "SELECT status FROM portfolio_strategy WHERE strategy_id = :1", [strategy_id]
            ).fetchone()
            if not current_row:
                cursor.execute("ROLLBACK")
                return {"status": "FAILED", "message": f"Strategy {strategy_id} not found"}
            current = current_row[0]

            cursor.execute(
                "UPDATE portfolio_strategy SET status = :1, updated_at = CURRENT_TIMESTAMP WHERE strategy_id = :2",
                [target, strategy_id],
            )

            name_row = cursor.execute(
                "SELECT name, generation FROM strategy_registry WHERE strategy_id = :1", [strategy_id]
            ).fetchone()
            name = name_row[0] if name_row else ""
            gen = name_row[1] if name_row else 0
            cursor.execute(
                """INSERT INTO production_history (strategy_id, name, generation, action, action_reason, previous_stage, new_stage)
                   VALUES (:1,:2,:3,:4,:5,:6,:7)""",
                [strategy_id, name, gen, "demote", reason[:500], current, target],
            )

            cursor.execute(
                """INSERT INTO system_logs (log_type, source, message, details_json)
                   VALUES (:1,:2,:3,:4)""",
                ["lifecycle", "strategy_lifecycle",
                 f"Strategy {strategy_id} demoted: {current} -> {target}",
                 json.dumps({"strategy_id": strategy_id, "from": current, "to": target, "reason": reason})],
            )
            cursor.execute("COMMIT")
        except Exception:
            cursor.execute("ROLLBACK")
            raise
    finally:
        conn.close()

    return {"status": "SUCCESS", "from": current, "to": target, "message": reason}


async def retire_strategy(strategy_id: int, reason: str = "") -> dict:
    return await demote_strategy(strategy_id, "retired", reason)


async def get_production_history(limit: int = 50) -> list[dict]:
    rows = await execute_query(
        """SELECT id, strategy_id, name, generation, action, action_reason, previous_stage, new_stage,
                  score_before, score_after, details_json, created_at
           FROM production_history ORDER BY created_at DESC""",
    )
    result = []
    for r in rows[:limit]:
        result.append({
            "id": r[0], "strategy_id": r[1], "name": r[2] or "", "generation": r[3] or 0,
            "action": r[4], "reason": r[5] or "", "from": r[6] or "", "to": r[7] or "",
            "score_before": r[8], "score_after": r[9],
            "details": json.loads(r[10]) if r[10] else {},
            "created_at": r[11].isoformat() if hasattr(r[11], 'isoformat') else str(r[11]) if r[11] else "",
        })
    return result


async def get_strategies_by_stage(stage: str) -> list[dict]:
    rows = await execute_query(
        """SELECT ps.strategy_id, ps.generation, ps.allocation, ps.status,
                  COALESCE(sr.name, ''), COALESCE(sr.entry_type, ''),
                  COALESCE(sr.total_return, 0), COALESCE(sr.win_rate, 0),
                  COALESCE(sr.max_drawdown, 0), COALESCE(sr.profit_factor, 0),
                  COALESCE(sr.fitness_score, 0), COALESCE(sr.total_trades, 0),
                  ps.approved_at, ps.created_at
           FROM portfolio_strategy ps
           LEFT JOIN strategy_registry sr ON sr.strategy_id = ps.strategy_id
           WHERE ps.status = :1
           ORDER BY sr.fitness_score DESC""",
        [stage],
    )
    return [
        {"strategy_id": r[0], "generation": r[1], "allocation": r[2] or 0,
         "status": r[3], "name": r[4] or "", "entry_type": r[5] or "",
         "total_return": r[6] or 0, "win_rate": r[7] or 0, "mdd": r[8] or 0,
         "profit_factor": r[9] or 0, "fitness": r[10] or 0, "trades": r[11] or 0,
         "approved_at": r[12].isoformat() if r[12] and hasattr(r[12], 'isoformat') else (str(r[12]) if r[12] else ""),
         "created_at": r[13].isoformat() if r[13] and hasattr(r[13], 'isoformat') else (str(r[13]) if r[13] else "")}
        for r in rows
    ]


async def get_strategies_by_stages(stages: list[str]) -> list[dict]:
    results = []
    for stage in stages:
        results.extend(await get_strategies_by_stage(stage))
    return results


# ── Production Lock ──────────────────────────────────────────────

async def acquire_production_lock(strategy_id: int = 0, reason: str = "") -> bool:
    global _production_lock, _lock_reason
    if _production_lock:
        return False
    _production_lock = True
    _lock_reason = reason
    await execute_non_query(
        "INSERT INTO production_lock (locked, locked_at, locked_by, reason, strategy_id) VALUES ('Y', CURRENT_TIMESTAMP, :1, :2, :3)",
        ["strategy_lifecycle", reason[:500], strategy_id],
    )
    await add_system_log("lock", "production_lock", f"Production lock acquired (sid={strategy_id})", {"reason": reason})
    return True


async def release_production_lock():
    global _production_lock, _lock_reason
    _production_lock = False
    _lock_reason = ""
    await execute_non_query(
        "UPDATE production_lock SET locked = 'N' WHERE locked = 'Y'",
    )
    await add_system_log("lock", "production_lock", "Production lock released", {})


async def get_production_lock_status() -> dict:
    global _production_lock, _lock_reason
    rows = await execute_query(
        "SELECT locked, locked_at, locked_by, reason, strategy_id FROM production_lock WHERE locked = 'Y' ORDER BY id DESC",
    )
    if rows:
        r = rows[0]
        return {
            "locked": r[0] == 'Y',
            "locked_at": r[1].isoformat() if r[1] and hasattr(r[1], 'isoformat') else str(r[1]) if r[1] else "",
            "locked_by": r[2] or "", "reason": r[3] or "", "strategy_id": r[4] or 0,
        }
    return {"locked": _production_lock, "locked_at": "", "locked_by": "", "reason": _lock_reason, "strategy_id": 0}
