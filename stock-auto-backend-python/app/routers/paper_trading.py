from __future__ import annotations

import json
import logging
import random
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.database import execute_query, execute_non_query
from app.services.broker import MockBroker, OrderRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/paper-trading", tags=["paper-trading"])

_broker = MockBroker()


@router.get("/status")
async def get_paper_status():
    balance = await _broker.get_balance()
    positions = await _broker.get_positions()
    # Get trades from DB
    rows = await execute_query(
        "SELECT COUNT(*), COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell'",
    )
    total_trades = int(rows[0][0]) if rows else 0
    total_pnl = float(rows[0][1]) if rows else 0
    return {
        "cash": balance.get("cash", 0),
        "total_value": balance.get("total", 0),
        "invested": balance.get("invested", 0),
        "positions_count": len(positions),
        "total_trades": total_trades,
        "total_pnl": total_pnl,
        "broker": "mock",
    }


@router.post("/signals")
async def generate_signals():
    """Generate buy/sell signals from approved portfolio strategies."""
    strategies = await execute_query(
        """SELECT ps.strategy_id, ps.generation
           FROM portfolio_strategy ps
           WHERE ps.status IN ('approved', 'candidate')
           ORDER BY ps.created_at DESC""",
    )
    if not strategies:
        raise HTTPException(400, "No strategies in portfolio")

    signals = []
    today = date.today()

    for s in strategies[:5]:
        sid, gen = s[0], s[1]
        universe = await execute_query(
            "SELECT ticker, name FROM evolution_evaluation_universe WHERE generation = :1",
            [gen],
        )
        for u in universe[:3]:
            ticker, name = u[0], u[1] or u[0]
            # Simple signal: check if price is above 20-day moving average
            prices = await execute_query(
                """SELECT close_price FROM stock_daily_prices
                   WHERE ticker = :1 ORDER BY trade_date DESC FETCH FIRST 20 ROWS ONLY""",
                [ticker],
            )
            if len(prices) < 20:
                continue
            closes = [float(p[0]) for p in prices if p[0]]
            if not closes:
                continue
            ma20 = sum(closes) / len(closes)
            current_price = closes[0]
            signal = "buy" if current_price < ma20 * 0.98 else ("sell" if current_price > ma20 * 1.02 else "hold")

            if signal != "hold":
                signals.append({
                    "ticker": ticker,
                    "name": name,
                    "signal": signal,
                    "price": current_price,
                    "strategy_id": sid,
                    "generation": gen,
                })

    return {"signals": signals, "count": len(signals), "date": today.isoformat()}


@router.post("/execute")
async def execute_signals(data: dict):
    """Execute paper trades based on signals."""
    signals = data.get("signals", [])
    if not signals:
        raise HTTPException(400, "No signals to execute")

    results = []
    for sig in signals:
        ticker = sig["ticker"]
        action = sig["signal"]
        price = float(sig.get("price", 0))
        strategy_id = sig.get("strategy_id", 0)

        if action == "buy":
            qty = int(1000000 / price) if price > 0 else 1
            req = OrderRequest(ticker=ticker, action="buy", quantity=qty, price=price)
            result = await _broker.place_order(req)
            await execute_non_query(
                """INSERT INTO paper_positions (strategy_id, ticker, entry_price, current_price, quantity, entry_date, status)
                   VALUES (:1, :2, :3, :4, :5, CURRENT_TIMESTAMP, 'open')""",
                [strategy_id, ticker, price, price, qty],
            )
            await execute_non_query(
                """INSERT INTO paper_trades (strategy_id, ticker, action, price, quantity, trade_date, reason)
                   VALUES (:1, :2, 'buy', :3, :4, CURRENT_TIMESTAMP, :5)""",
                [strategy_id, ticker, price, qty, sig.get("reason", "signal")],
            )
            results.append({"ticker": ticker, "action": "buy", "qty": qty, "filled_price": price, "status": result.status})

        elif action == "sell":
            pos = await execute_query(
                "SELECT id, quantity, entry_price FROM paper_positions WHERE ticker = :1 AND status = 'open' FETCH FIRST 1 ROWS ONLY",
                [ticker],
            )
            if pos:
                pos_id, qty, entry_price = pos[0][0], pos[0][1], float(pos[0][2])
                req = OrderRequest(ticker=ticker, action="sell", quantity=qty, price=price)
                result = await _broker.place_order(req)
                pnl_pct = (price - entry_price) / entry_price * 100
                pnl_amt = (price - entry_price) * qty
                await execute_non_query(
                    "UPDATE paper_positions SET current_price = :1, pnl_pct = :2, pnl_amt = :3, status = 'closed', exit_date = CURRENT_TIMESTAMP WHERE id = :4",
                    [price, pnl_pct, pnl_amt, pos_id],
                )
                await execute_non_query(
                    "INSERT INTO paper_trades (strategy_id, ticker, action, price, quantity, pnl_pct, trade_date, reason) VALUES (:1, :2, 'sell', :3, :4, :5, CURRENT_TIMESTAMP, :6)",
                    [strategy_id, ticker, price, qty, pnl_pct, sig.get("reason", "signal")],
                )
                results.append({"ticker": ticker, "action": "sell", "qty": qty, "filled_price": price, "pnl_pct": pnl_pct, "status": result.status})

    return {"results": results, "count": len(results)}


@router.get("/positions")
async def get_paper_positions():
    rows = await execute_query(
        """SELECT pp.id, pp.strategy_id, pp.ticker, pp.entry_price, pp.current_price,
                  pp.quantity, pp.entry_date, pp.pnl_pct, pp.pnl_amt, pp.status
           FROM paper_positions pp
           ORDER BY pp.created_at DESC FETCH FIRST 50 ROWS ONLY""",
    )
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "strategy_id": r[1],
            "ticker": r[2],
            "entry_price": float(r[3] or 0),
            "current_price": float(r[4] or r[3] or 0),
            "quantity": int(r[5] or 0),
            "entry_date": str(r[6]) if r[6] else "",
            "pnl_pct": float(r[7] or 0),
            "pnl_amt": float(r[8] or 0),
            "status": r[9],
        })
    return {"items": items}


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
