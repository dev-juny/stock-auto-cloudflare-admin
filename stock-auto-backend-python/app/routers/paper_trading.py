from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from app.database import execute_query, execute_non_query
from app.services.broker import MockBroker
from app.services.paper_trading_service import (
    generate_signals_from_portfolio,
    execute_signals as execute_signals_svc,
    check_open_positions_for_exits,
    run_paper_trading_cycle,
    load_strategy_params,
)
from app.services.operations_service import get_paper_performance as get_performance_svc

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/paper-trading", tags=["paper-trading"])

_broker = MockBroker()


@router.get("/status")
async def get_paper_status():
    balance = await _broker.get_balance()
    positions = await _broker.get_positions()
    rows = await execute_query(
        "SELECT COUNT(*), COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell'",
    )
    total_trades = int(rows[0][0]) if rows else 0
    total_pnl = float(rows[0][1]) if rows else 0

    open_rows = await execute_query(
        "SELECT COUNT(*), COALESCE(SUM(pnl_amt), 0) FROM paper_positions WHERE status = 'open'",
    )
    open_count = int(open_rows[0][0]) if open_rows else 0
    unrealized_pnl = float(open_rows[0][1]) if open_rows else 0

    return {
        "cash": balance.get("cash", 0),
        "total_value": balance.get("total", 0),
        "invested": balance.get("invested", 0),
        "positions_count": open_count,
        "total_trades": total_trades,
        "total_pnl": total_pnl,
        "unrealized_pnl": unrealized_pnl,
        "broker": "mock",
    }


@router.post("/signals")
async def generate_signals():
    """Generate buy signals from approved portfolio strategies."""
    signals = await generate_signals_from_portfolio()
    if not signals:
        raise HTTPException(400, "No strategies in portfolio or no signals generated")
    return {"signals": signals, "count": len(signals), "date": date.today().isoformat()}


@router.post("/exits")
async def generate_exit_signals():
    """Check open positions for exit signals (stop-loss/take-profit/trailing-stop)."""
    exit_signals = await check_open_positions_for_exits()
    if not exit_signals:
        raise HTTPException(400, "No exit signals found")
    return {"signals": exit_signals, "count": len(exit_signals), "date": date.today().isoformat()}


@router.post("/execute")
async def execute_signals(data: dict):
    """Execute paper trades based on signals (buy or sell)."""
    raw_signals = data.get("signals", [])
    if not raw_signals:
        raise HTTPException(400, "No signals to execute")
    # Normalise sell signals to use 'sell' action
    for sig in raw_signals:
        if "signal" in sig and sig["signal"] == "sell":
            sig["action"] = "sell"
    results = await execute_signals_svc(raw_signals)
    return {"results": results, "count": len(results)}


@router.post("/run-cycle")
async def run_cycle():
    """Run a full paper trading cycle: check exits -> execute, generate entries -> execute."""
    result = await run_paper_trading_cycle()
    return result


@router.get("/positions")
async def get_paper_positions():
    rows = await execute_query(
        """SELECT pp.id, pp.strategy_id, pp.ticker, pp.entry_price, pp.current_price,
                  pp.quantity, pp.entry_date, pp.pnl_pct, pp.pnl_amt, pp.status,
                  COALESCE(sp.close_price, pp.current_price)
           FROM paper_positions pp
           LEFT JOIN (
               SELECT ticker, close_price, trade_date,
                      ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY trade_date DESC) AS rn
               FROM stock_daily_prices
           ) sp ON sp.ticker = pp.ticker AND sp.rn = 1
           ORDER BY pp.created_at DESC FETCH FIRST 50 ROWS ONLY""",
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
            "entry_price": entry_price,
            "current_price": db_price,
            "quantity": qty,
            "entry_date": str(r[6]) if r[6] else "",
            "pnl_pct": round(pnl_pct, 2),
            "pnl_amt": round(pnl_amt, 2),
            "status": r[9],
        })
    return {"items": items}


@router.get("/performance")
async def paper_performance(period: str = Query("ALL", pattern="^(ALL|7D|30D|90D)$")):
    """Paper trading performance metrics with period filter & equity curve."""
    return await get_performance_svc(period)


@router.post("/test-exit")
async def test_exit_signal(data: dict):
    """Force-test an exit condition on a specific position. 
    Body: {"pos_id": 1, "condition": "stop_loss|take_profit|trailing_stop|stall_exit"}
    Temporarily updates price to trigger the exit, simulates execution, then rolls back.
    """
    pos_id = data.get("pos_id")
    condition = data.get("condition", "stall_exit")
    if not pos_id:
        raise HTTPException(400, "pos_id is required")
    
    rows = await execute_query(
        """SELECT pp.id, pp.strategy_id, pp.ticker, pp.entry_price, pp.current_price,
                  pp.quantity, pp.highest_price, pp.entry_date, pp.pnl_pct
           FROM paper_positions pp WHERE pp.id = :1 AND pp.status = 'open'""",
        [pos_id],
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
    
    # Compute trigger price for each condition
    sim_price = current_price
    trigger_info = {}
    
    if condition == "stop_loss" and sl_pct > 0:
        sim_price = entry_price * (1 - sl_pct) - 1  # just below SL
        trigger_info = {"condition": "stop_loss", "trigger_price": round(sim_price, 2), "sl_pct": sl_pct}
    elif condition == "take_profit" and tp_pct > 0:
        sim_price = entry_price * (1 + tp_pct) + 1  # just above TP
        trigger_info = {"condition": "take_profit", "trigger_price": round(sim_price, 2), "tp_pct": tp_pct}
    elif condition == "trailing_stop" and trail_act > 0 and trail_stop > 0:
        high_for_trail = max(float(r[6] or entry_price or 0), entry_price * (1 + trail_act * 2))
        sim_price = high_for_trail * (1 - trail_stop) - 1  # just below trail stop
        trigger_info = {"condition": "trailing_stop", "trigger_price": round(sim_price, 2), "trail_activation": trail_act, "trail_stop": trail_stop, "simulated_high": round(high_for_trail, 2)}
    elif condition == "stall_exit":
        # Force stall by setting entry_date far in the past
        sim_price = current_price
        trigger_info = {"condition": "stall_exit", "stall_days": stall_days}
    else:
        raise HTTPException(400, f"Invalid condition: {condition}. Use: stop_loss, take_profit, trailing_stop, stall_exit")
    
    # Simulate the exit
    pnl_pct = (sim_price - entry_price) / entry_price * 100
    pnl_amt = (sim_price - entry_price) * qty
    
    # Check what would happen in paper_trades, paper_positions, portfolio_health
    old_cash = 10000000.0
    rows_cash = await execute_query("SELECT COALESCE(SUM(quantity * current_price), 0) FROM paper_positions WHERE status = 'open'")
    old_exposure = float(rows_cash[0][0]) if rows_cash else 0
    old_cash_balance = max(0, 10000000 - old_exposure)
    
    new_cash = old_cash_balance + (sim_price * qty)
    new_exposure = old_exposure - (sim_price * qty)
    new_cash_ratio = new_cash / 10000000 * 100
    
    # Check if paper_performance updates
    rows_sells = await execute_query("SELECT COUNT(*) FROM paper_trades WHERE action = 'sell'")
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
        "verification": "Simulation only - no actual DB changes. Run POST /api/paper-trading/exits + execute to trigger real exit.",
    }


@router.get("/trades")
async def get_paper_trades(limit: int = Query(50, ge=1, le=200)):
    rows = await execute_query(
        """SELECT id, strategy_id, ticker, action, price, quantity, pnl_pct, trade_date, reason
           FROM paper_trades
           ORDER BY trade_date DESC FETCH FIRST :1 ROWS ONLY""",
        [limit],
    )
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "strategy_id": r[1],
            "ticker": r[2],
            "action": r[3],
            "price": float(r[4] or 0),
            "quantity": int(r[5] or 0),
            "pnl_pct": float(r[6] or 0),
            "trade_date": str(r[7]) if r[7] else "",
            "reason": r[8] or "",
        })
    return {"items": items}
