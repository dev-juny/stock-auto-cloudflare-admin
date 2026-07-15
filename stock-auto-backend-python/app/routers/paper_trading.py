from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from app.database import execute_query, execute_non_query
from app.services.paper_trading_service import (
    generate_signals_from_portfolio,
    execute_signals as execute_signals_svc,
    check_open_positions_for_exits,
    run_paper_trading_cycle,
    load_strategy_params,
    create_session,
    get_session,
    list_sessions,
    stop_session,
    reset_session,
    get_active_session,
)
from app.services.operations_service import get_paper_performance as get_performance_svc
from app.services.paper_trading_service import get_broker

_broker = get_broker()

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/paper-trading", tags=["paper-trading"])


# ── Session Endpoints ──────────────────────────────────────────


@router.get("/sessions")
async def api_list_sessions():
    items = await list_sessions()
    return {"items": items}


@router.post("/sessions")
async def api_create_session(data: dict):
    name = data.get("name", "New Session")
    initial_capital = float(data.get("initial_capital", 10000000))
    max_positions = int(data.get("max_positions", 5))
    position_size = float(data.get("position_size", 500000))
    commission_pct = float(data.get("commission_pct", 0))
    slippage_pct = float(data.get("slippage_pct", 0))
    tax_pct = float(data.get("tax_pct", 0))
    auto_mode = bool(data.get("auto_mode", False))
    sess = await create_session(
        name=name,
        initial_capital=initial_capital,
        max_positions=max_positions,
        position_size=position_size,
        commission_pct=commission_pct,
        slippage_pct=slippage_pct,
        tax_pct=tax_pct,
        auto_mode=auto_mode,
    )
    return sess


@router.get("/sessions/{session_id}")
async def api_get_session(session_id: int):
    sess = await get_session(session_id)
    if not sess:
        raise HTTPException(404, "Session not found")
    return sess


@router.post("/sessions/{session_id}/reset")
async def api_reset_session(session_id: int):
    sess = await reset_session(session_id)
    if not sess:
        raise HTTPException(404, "Session not found")
    return {"message": f"Session {session_id} reset", "session": sess}


@router.post("/sessions/{session_id}/stop")
async def api_stop_session(session_id: int):
    sess = await stop_session(session_id)
    if not sess:
        raise HTTPException(404, "Session not found")
    return {"message": f"Session {session_id} stopped", "session": sess}


# ── Status (session-scoped) ────────────────────────────────────


@router.get("/status")
async def get_paper_status(session_id: int = Query(default=None)):
    from app.services.paper_trading_service import ensure_broker_session
    sid = session_id
    if sid is None:
        sess = await get_active_session()
        if not sess:
            sid = 1
        else:
            sid = sess["id"]
    await ensure_broker_session(sid)
    sess_info = await get_session(sid)
    balance = await _broker.get_balance(sid)
    positions = await _broker.get_positions(sid)
    rows = await execute_query(
        "SELECT COUNT(*), COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell' AND session_id = :1",
        [sid],
    )
    total_trades = int(rows[0][0]) if rows else 0
    total_pnl = float(rows[0][1]) if rows else 0

    open_rows = await execute_query(
        "SELECT COUNT(*), COALESCE(SUM(pnl_amt), 0) FROM paper_positions WHERE status = 'open' AND session_id = :1",
        [sid],
    )
    open_count = int(open_rows[0][0]) if open_rows else 0
    unrealized_pnl = float(open_rows[0][1]) if open_rows else 0

    return {
        "session_id": sid,
        "session_name": sess_info["name"] if sess_info else f"Session #{sid}",
        "session_status": sess_info["status"] if sess_info else "active",
        "initial_capital": sess_info["initial_capital"] if sess_info else 10000000,
        "cash": balance.get("cash", 0),
        "total_value": balance.get("total", 0),
        "invested": balance.get("invested", 0),
        "positions_count": open_count,
        "total_trades": total_trades,
        "total_pnl": total_pnl,
        "unrealized_pnl": unrealized_pnl,
        "broker": "mock",
    }


# ── Existing Endpoints (updated with session_id) ───────────────


@router.post("/signals")
async def generate_signals(session_id: int = Query(default=None)):
    sid = session_id
    if sid is None:
        sess = await get_active_session()
        if not sess:
            raise HTTPException(400, "No active session")
        sid = sess["id"]
    signals, scan_summary = await generate_signals_from_portfolio(session_id=sid)
    return {
        "signals": signals,
        "count": len(signals),
        "scan_summary": scan_summary,
        "date": date.today().isoformat(),
        "session_id": sid,
    }


@router.post("/exits")
async def generate_exit_signals(session_id: int = Query(default=None)):
    sid = session_id
    if sid is None:
        sess = await get_active_session()
        if not sess:
            raise HTTPException(400, "No active session")
        sid = sess["id"]
    exit_signals = await check_open_positions_for_exits(session_id=sid)
    return {"signals": exit_signals, "count": len(exit_signals), "date": date.today().isoformat(), "session_id": sid}


@router.post("/execute")
async def execute_signals(data: dict, session_id: int = Query(default=None)):
    sid = session_id
    if sid is None:
        sess = await get_active_session()
        if not sess:
            raise HTTPException(400, "No active session")
        sid = sess["id"]
    raw_signals = data.get("signals", [])
    if not raw_signals:
        raise HTTPException(400, "No signals to execute")
    for sig in raw_signals:
        if "signal" in sig and sig["signal"] == "sell":
            sig["action"] = "sell"
    results = await execute_signals_svc(raw_signals, session_id=sid)
    return {"results": results, "count": len(results), "session_id": sid}


@router.post("/run-cycle")
async def run_cycle(session_id: int = Query(default=None)):
    sid = session_id
    if sid is None:
        sess = await get_active_session()
        if not sess:
            raise HTTPException(400, "No active session")
        sid = sess["id"]
    result = await run_paper_trading_cycle(session_id=sid)
    return result


@router.get("/positions")
async def get_paper_positions(session_id: int = Query(default=None)):
    sid = session_id
    if sid is None:
        sess = await get_active_session()
        if not sess:
            sid = 1
        else:
            sid = sess["id"]
    count_rows = await execute_query(
        "SELECT COUNT(*) FROM paper_positions WHERE session_id = :1",
        [sid],
    )
    total_count = int(count_rows[0][0]) if count_rows else 0
    rows = await execute_query(
        """SELECT pp.id, pp.strategy_id, pp.ticker, pp.entry_price, pp.current_price,
                  pp.quantity, pp.entry_date, pp.pnl_pct, pp.pnl_amt, pp.status,
                  COALESCE(sp.close_price, pp.current_price),
                  ks.name
           FROM paper_positions pp
           LEFT JOIN (
               SELECT ticker, close_price, trade_date,
                      ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY trade_date DESC) AS rn
               FROM stock_daily_prices
           ) sp ON sp.ticker = pp.ticker AND sp.rn = 1
           LEFT JOIN kospi_stocks ks ON ks.ticker = pp.ticker
           WHERE pp.session_id = :1
           ORDER BY pp.created_at DESC FETCH FIRST 200 ROWS ONLY""",
        [sid],
    )
    items = []
    for r in rows:
        entry_price = float(r[3] or 0)
        db_price = float(r[10] or r[4] or 0) if len(r) > 10 else float(r[4] or r[3] or 0)
        qty = int(r[5] or 0)
        current_value = qty * db_price
        cost_basis = qty * entry_price
        pnl_amt = current_value - cost_basis if entry_price > 0 else 0
        pnl_pct = ((db_price - entry_price) / entry_price * 100) if entry_price > 0 else 0
        items.append({
            "id": r[0],
            "strategy_id": r[1],
            "ticker": r[2],
            "name": r[11] if len(r) > 11 else None,
            "entry_price": entry_price,
            "current_price": db_price,
            "quantity": qty,
            "entry_date": str(r[6]) if r[6] else "",
            "pnl_pct": round(pnl_pct, 2),
            "pnl_amt": round(pnl_amt, 2),
            "status": r[9],
        })
    return {"items": items, "session_id": sid, "total_count": total_count}


@router.get("/performance")
async def paper_performance(
    period: str = Query("ALL", pattern="^(ALL|7D|30D|90D)$"),
    session_id: int = Query(default=None),
):
    sid = session_id
    if sid is None:
        sess = await get_active_session()
        if not sess:
            sid = 1
        else:
            sid = sess["id"]
    return await get_performance_svc(period, session_id=sid)


@router.post("/test-exit")
async def test_exit_signal(data: dict, session_id: int = Query(default=None)):
    from app.services.paper_trading_service import ensure_broker_session
    sid = session_id
    if sid is None:
        sess = await get_active_session()
        if not sess:
            sid = 1
        else:
            sid = sess["id"]
    await ensure_broker_session(sid)
    pos_id = data.get("pos_id")
    condition = data.get("condition", "stall_exit")
    if not pos_id:
        raise HTTPException(400, "pos_id is required")

    rows = await execute_query(
        """SELECT pp.id, pp.strategy_id, pp.ticker, pp.entry_price, pp.current_price,
                  pp.quantity, pp.highest_price, pp.entry_date, pp.pnl_pct
           FROM paper_positions pp WHERE pp.id = :1 AND pp.status = 'open' AND pp.session_id = :2""",
        [pos_id, sid],
    )
    if not rows:
        raise HTTPException(404, f"Position {pos_id} not found or already closed")

    r = rows[0]
    entry_price = float(r[3] or 0)
    current_price = float(r[4] or 0)
    qty = int(r[5] or 0)
    entry_date = r[7]

    params = await load_strategy_params(int(r[1]))
    if not params:
        raise HTTPException(400, "Strategy params not found")

    sl_pct = float(params.get("stop_loss_pct", 0))
    tp_pct = float(params.get("fixed_take_profit_pct", 0.07))
    trail_act = float(params.get("trailing_activation_pct", 0.07))
    trail_stop = float(params.get("trailing_stop_pct", 0.03))
    stall_days = int(params.get("stall_exit_days", 0))

    sim_price = current_price
    trigger_info = {}

    if condition == "stop_loss" and sl_pct > 0:
        sim_price = entry_price * (1 - sl_pct) - 1
        trigger_info = {"condition": "stop_loss", "trigger_price": round(sim_price, 2), "sl_pct": sl_pct}
    elif condition == "take_profit" and tp_pct > 0:
        sim_price = entry_price * (1 + tp_pct) + 1
        trigger_info = {"condition": "take_profit", "trigger_price": round(sim_price, 2), "tp_pct": tp_pct}
    elif condition == "trailing_stop" and trail_act > 0 and trail_stop > 0:
        high_for_trail = max(float(r[6] or entry_price or 0), entry_price * (1 + trail_act * 2))
        sim_price = high_for_trail * (1 - trail_stop) - 1
        trigger_info = {"condition": "trailing_stop", "trigger_price": round(sim_price, 2), "trail_activation": trail_act, "trail_stop": trail_stop, "simulated_high": round(high_for_trail, 2)}
    elif condition == "stall_exit":
        sim_price = current_price
        trigger_info = {"condition": "stall_exit", "stall_days": stall_days}
    else:
        raise HTTPException(400, f"Invalid condition: {condition}. Use: stop_loss, take_profit, trailing_stop, stall_exit")

    pnl_pct = (sim_price - entry_price) / entry_price * 100
    pnl_amt = (sim_price - entry_price) * qty

    sess_info = await get_session(sid)
    initial_capital = sess_info["initial_capital"] if sess_info else 10000000
    rows_cash = await execute_query(
        "SELECT COALESCE(SUM(quantity * current_price), 0) FROM paper_positions WHERE status = 'open' AND session_id = :1",
        [sid],
    )
    old_exposure = float(rows_cash[0][0]) if rows_cash else 0
    old_cash_balance = max(0, initial_capital - old_exposure)

    new_cash = old_cash_balance + (sim_price * qty)
    new_exposure = old_exposure - (sim_price * qty)
    new_cash_ratio = new_cash / initial_capital * 100

    rows_sells = await execute_query(
        "SELECT COUNT(*) FROM paper_trades WHERE action = 'sell' AND session_id = :1",
        [sid],
    )
    sells_before = int(rows_sells[0][0]) if rows_sells else 0

    return {
        "test": True,
        "position_id": pos_id,
        "ticker": r[2],
        "condition": condition,
        "trigger_info": trigger_info,
        "current_state": {
            "entry_price": entry_price,
            "current_price": current_price,
            "simulated_exit_price": round(sim_price, 2),
            "pnl_pct": round(pnl_pct, 2),
            "pnl_amt": round(pnl_amt, 2),
        },
        "expected_impact": {
            "paper_positions": f"position {pos_id} → status='closed', exit_date=now, pnl_pct={pnl_pct:.2f}%, pnl_amt={pnl_amt:.0f}",
            "paper_trades": f"new sell trade: {r[2]}, action='sell', price={sim_price:.0f}, pnl_pct={pnl_pct:.2f}%",
            "cash_before": round(old_cash_balance, 2),
            "cash_after": round(new_cash, 2),
            "exposure_before": round(old_exposure, 2),
            "exposure_after": round(new_exposure, 2),
            "cash_ratio_after": round(new_cash_ratio, 2),
            "sells_before": sells_before,
            "sells_after": sells_before + 1,
        },
        "session_id": sid,
        "verification": "Simulation only - no actual DB changes.",
    }


@router.get("/trades")
async def get_paper_trades(
    limit: int = Query(50, ge=1, le=200),
    session_id: int = Query(default=None),
):
    sid = session_id
    if sid is None:
        sess = await get_active_session()
        if not sess:
            sid = 1
        else:
            sid = sess["id"]
    rows = await execute_query(
        """SELECT pt.id, pt.strategy_id, pt.ticker, pt.action, pt.price,
                  pt.quantity, pt.pnl_pct, pt.trade_date, pt.reason,
                  ks.name
           FROM paper_trades pt
           LEFT JOIN kospi_stocks ks ON ks.ticker = pt.ticker
           WHERE pt.session_id = :1
           ORDER BY pt.trade_date DESC FETCH FIRST :2 ROWS ONLY""",
        [sid, limit],
    )
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "strategy_id": r[1],
            "ticker": r[2],
            "name": r[9] if len(r) > 9 else None,
            "action": r[3],
            "price": float(r[4] or 0),
            "quantity": int(r[5] or 0),
            "pnl_pct": float(r[6] or 0),
            "trade_date": str(r[7]) if r[7] else "",
            "reason": r[8] or "",
        })
    return {"items": items, "session_id": sid}
