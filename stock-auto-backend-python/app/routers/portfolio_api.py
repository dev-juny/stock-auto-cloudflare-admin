from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.database import execute_query, execute_non_query

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/strategies")
async def get_portfolio_strategies():
    rows = await execute_query(
        """SELECT ps.id, ps.strategy_id, ps.generation, ps.allocation, ps.status,
                  ps.created_at, ps.approved_at,
                  pf.total_return, pf.win_rate, pf.max_drawdown, pf.fitness_score, pf.total_trades
           FROM portfolio_strategy ps
           LEFT JOIN strategy_performance pf ON pf.strategy_id = ps.strategy_id
             AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = ps.strategy_id)
           ORDER BY ps.created_at DESC"""
    )
    total_allocation = 0
    items = []
    for r in rows:
        alloc = float(r[3] or 0)
        total_allocation += alloc
        items.append({
            "id": r[0],
            "strategy_id": r[1],
            "generation": r[2],
            "allocation": alloc,
            "status": r[4],
            "created_at": str(r[5]) if r[5] else "",
            "approved_at": str(r[6]) if r[6] else None,
            "fitness": float(r[10] or 0),
            "return_pct": float(r[7] or 0),
            "win_rate": float(r[8] or 0),
            "mdd": float(abs(r[9] or 0)),
            "total_trades": int(r[11] or 0),
        })
    return {"items": items, "total_allocation": total_allocation}


@router.post("/strategies")
async def add_to_portfolio(data: dict):
    strategy_id = data.get("strategy_id")
    generation = data.get("generation")
    if not strategy_id or not generation:
        raise HTTPException(400, "strategy_id and generation required")
    allocation = float(data.get("allocation", 0))
    status = data.get("status", "candidate")
    await execute_non_query(
        """INSERT INTO portfolio_strategy (strategy_id, generation, allocation, status)
           VALUES (:1, :2, :3, :4)""",
        [strategy_id, generation, allocation, status],
    )
    return {"message": "Strategy added to portfolio"}


@router.patch("/strategies/{portfolio_id}")
async def update_portfolio_strategy(portfolio_id: int, data: dict):
    allocation = data.get("allocation")
    status = data.get("status")
    if allocation is None and status is None:
        raise HTTPException(400, "allocation or status required")
    parts = []
    binds = []
    if allocation is not None:
        parts.append("allocation = :1")
        binds.append(allocation)
    if status is not None:
        parts.append("status = :2")
        binds.append(status)
    if status == "approved":
        parts.append("approved_at = CURRENT_TIMESTAMP")
    binds.append(portfolio_id)
    sql = f"UPDATE portfolio_strategy SET {', '.join(parts)} WHERE id = :{len(binds)}"
    await execute_non_query(sql, binds)
    return {"message": "Updated"}


@router.delete("/strategies/{portfolio_id}")
async def remove_from_portfolio(portfolio_id: int):
    await execute_non_query(
        "DELETE FROM portfolio_strategy WHERE id = :1",
        [portfolio_id],
    )
    return {"message": "Removed from portfolio"}


# ── Portfolio Backtest ──────────────────────────────────────────


async def _get_price_at(ticker: str, trade_date: date) -> Optional[float]:
    rows = await execute_query(
        "SELECT close_price FROM stock_daily_prices WHERE ticker = :1 AND trade_date = TO_DATE(:2, 'YYYY-MM-DD')",
        [ticker, trade_date.isoformat()],
    )
    return float(rows[0][0]) if rows and rows[0][0] else None


async def _get_prices_between(ticker: str, start: date, end: date) -> list[dict]:
    rows = await execute_query(
        """SELECT trade_date, close_price
           FROM stock_daily_prices
           WHERE ticker = :1 AND trade_date >= TO_DATE(:2, 'YYYY-MM-DD') AND trade_date <= TO_DATE(:3, 'YYYY-MM-DD')
           ORDER BY trade_date ASC""",
        [ticker, start.isoformat(), end.isoformat()],
    )
    return [{"date": str(r[0]), "close": float(r[1])} for r in rows]


@router.post("/backtest")
async def run_portfolio_backtest(data: dict):
    period = data.get("period", "1y")
    universe = data.get("universe", "KOSPI")
    initial_capital = float(data.get("initial_capital", 10000000))
    strategy_limit = min(int(data.get("strategy_limit", 5)), 5)

    # Determine date range
    end_date = date.today()
    if period == "1y":
        start_date = end_date - timedelta(days=365)
    elif period == "2y":
        start_date = end_date - timedelta(days=730)
    elif period == "3y":
        start_date = end_date - timedelta(days=1095)
    elif period == "custom":
        start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        if data.get("end_date"):
            end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
    else:
        start_date = end_date - timedelta(days=365)

    # Get approved portfolio strategies
    strategies = await execute_query(
        """SELECT ps.id, ps.strategy_id, ps.generation, ps.allocation
           FROM portfolio_strategy ps
           WHERE ps.status IN ('approved', 'candidate')
           ORDER BY ps.created_at DESC""",
    )
    if not strategies:
        raise HTTPException(400, "No strategies in portfolio")

    # Limit to strategy_limit
    strategies = strategies[:strategy_limit]
    total_alloc = sum(float(s[3] or 0) for s in strategies) or 1

    # For each strategy, get the universe stocks it evaluated
    all_signals: dict[str, list[dict]] = {}
    for s in strategies:
        sid, gen, alloc = s[1], s[2], float(s[3] or 0) / total_alloc
        universe_stocks = await execute_query(
            """SELECT ticker FROM evolution_evaluation_universe
               WHERE generation = :1 ORDER BY sample_order ASC""",
            [gen],
        )
        weight = alloc / max(len(universe_stocks), 1)
        for u in universe_stocks:
            ticker = u[0]
            if ticker not in all_signals:
                all_signals[ticker] = []
            all_signals[ticker].append({"strategy_id": sid, "weight": weight, "generation": gen})

    # Simulate portfolio backtest
    capital = initial_capital
    cash = capital
    positions: dict[str, dict] = {}
    trade_count = 0
    daily_values: list[dict] = []
    total_wins = 0
    total_losses = 0
    peak_capital = capital
    max_drawdown = 0

    current_date = start_date
    while current_date <= end_date:
        if current_date.weekday() >= 5:
            current_date += timedelta(days=1)
            continue

        # Check entry signals (simplified: buy at start if price exists)
        portfolio_value = cash
        for ticker, signals in all_signals.items():
            price = await _get_price_at(ticker, current_date)
            if not price:
                continue
            total_weight = sum(s["weight"] for s in signals)
            if ticker not in positions and total_weight > 0:
                alloc_amount = capital * total_weight
                qty = int(alloc_amount / price)
                if qty > 0 and alloc_amount <= cash:
                    positions[ticker] = {"qty": qty, "entry": price, "entry_date": current_date}
                    cash -= qty * price
                    trade_count += 1

            # Update position value
            if ticker in positions:
                pos = positions[ticker]
                current_val = pos["qty"] * price
                entry_val = pos["qty"] * pos["entry"]
                pnl_pct = (current_val - entry_val) / entry_val * 100
                portfolio_value += current_val

                # Exit if > 0 (simplified: hold through period)
                if current_date == end_date or current_date.weekday() == 4:
                    if pnl_pct > 0:
                        total_wins += 1
                    else:
                        total_losses += 1
                    cash += current_val
                    del positions[ticker]

        daily_values.append({
            "date": current_date.isoformat(),
            "value": round(portfolio_value, 2),
        })
        if portfolio_value > peak_capital:
            peak_capital = portfolio_value
        dd = (peak_capital - portfolio_value) / peak_capital * 100
        if dd > max_drawdown:
            max_drawdown = dd
        current_date += timedelta(days=1)

    final_value = cash + sum(
        pos["qty"] * (await _get_price_at(ticker, end_date) or pos["entry"])
        for ticker, pos in positions.items()
    )
    for ticker in list(positions.keys()):
        price = await _get_price_at(ticker, end_date) or 0
        cash += positions[ticker]["qty"] * price
        trade_count += 1

    total_return = (final_value - initial_capital) / initial_capital * 100
    win_rate = (total_wins / (total_wins + total_losses) * 100) if (total_wins + total_losses) > 0 else 0

    days = (end_date - start_date).days
    cagr = ((final_value / initial_capital) ** (365 / max(days, 1)) - 1) * 100 if days > 0 else 0

    # Sharpe ratio (simplified)
    returns = []
    for i in range(1, len(daily_values)):
        r = (daily_values[i]["value"] - daily_values[i - 1]["value"]) / daily_values[i - 1]["value"]
        returns.append(r)
    avg_return = sum(returns) / max(len(returns), 1) if returns else 0
    std_return = (sum((r - avg_return) ** 2 for r in returns) / max(len(returns), 1)) ** 0.5 if returns else 1
    sharpe = (avg_return / max(std_return, 0.0001)) * (252 ** 0.5) if std_return > 0 else 0

    # Save result
    import json as json_mod
    details = json_mod.dumps({
        "daily_values": daily_values,
        "strategies_tested": len(strategies),
        "tickers_in_universe": len(all_signals),
    })
    await execute_non_query(
        """INSERT INTO portfolio_backtest (portfolio_id, period_start, period_end, initial_capital,
           return_pct, win_rate, mdd, sharpe_ratio, cagr, trade_count, details_json)
           VALUES (:1, TO_DATE(:2, 'YYYY-MM-DD'), TO_DATE(:3, 'YYYY-MM-DD'), :4, :5, :6, :7, :8, :9, :10, :11)""",
        [1, start_date.isoformat(), end_date.isoformat(), initial_capital,
         round(total_return, 2), round(win_rate, 2), round(max_drawdown, 2),
         round(sharpe, 4), round(cagr, 2), trade_count, details],
    )

    return {
        "return_pct": round(total_return, 2),
        "win_rate": round(win_rate, 2),
        "mdd": round(max_drawdown, 2),
        "sharpe_ratio": round(sharpe, 4),
        "cagr": round(cagr, 2),
        "trade_count": trade_count,
        "initial_capital": initial_capital,
        "final_value": round(final_value, 2),
        "daily_values": daily_values,
        "strategies_tested": len(strategies),
        "tickers_screened": len(all_signals),
    }


@router.get("/backtest/results")
async def get_backtest_results(limit: int = Query(10, ge=1, le=50)):
    rows = await execute_query(
        """SELECT id, portfolio_id, period_start, period_end, initial_capital,
                  return_pct, win_rate, mdd, sharpe_ratio, cagr, trade_count, details_json, created_at
           FROM portfolio_backtest
           ORDER BY id DESC FETCH FIRST :1 ROWS ONLY""",
        [limit],
    )
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "portfolio_id": r[1],
            "period_start": str(r[2]) if r[2] else "",
            "period_end": str(r[3]) if r[3] else "",
            "initial_capital": float(r[4] or 0),
            "return_pct": float(r[5] or 0),
            "win_rate": float(r[6] or 0),
            "mdd": float(r[7] or 0),
            "sharpe_ratio": float(r[8] or 0),
            "cagr": float(r[9] or 0),
            "trade_count": int(r[10] or 0),
            "details_json": r[11],
            "created_at": str(r[12]) if r[12] else "",
        })
    return {"items": items}
