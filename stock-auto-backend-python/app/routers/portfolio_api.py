from __future__ import annotations

import json as json_mod
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.database import execute_query, execute_non_query

from app.services.operations_service import get_portfolio_health

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/strategies")
async def get_portfolio_strategies():
    rows = await execute_query(
        """SELECT ps.id, ps.strategy_id, ps.generation, ps.allocation, ps.status,
                  ps.created_at, ps.approved_at,
                  pf.total_return, pf.win_rate, pf.max_drawdown, pf.fitness_score, pf.total_trades,
                  sp.last_test_at,
                  (SELECT COUNT(*) FROM evolution_evaluation_universe eu WHERE eu.generation = ps.generation) AS universe_size
           FROM portfolio_strategy ps
           LEFT JOIN strategy_performance pf ON pf.strategy_id = ps.strategy_id
             AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = ps.strategy_id)
           LEFT JOIN strategy_pool sp ON sp.id = ps.strategy_id
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
            "last_evaluated": str(r[12]) if len(r) > 12 and r[12] else "",
            "universe_size": int(r[13]) if len(r) > 13 and r[13] else 0,
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


async def _get_prices_batch(tickers: list[str], start: date, end: date) -> dict[str, dict[str, float]]:
    """Preload all daily prices for all tickers in one query. Returns {ticker: {date_str: price}}"""
    if not tickers:
        return {}
    binds = [start.isoformat(), end.isoformat()] + tickers
    placeholders = ", ".join(f":{i+3}" for i in range(len(tickers)))
    rows = await execute_query(
        f"""SELECT ticker, trade_date, close_price
            FROM stock_daily_prices
            WHERE trade_date >= TO_DATE(:1, 'YYYY-MM-DD')
              AND trade_date <= TO_DATE(:2, 'YYYY-MM-DD')
              AND ticker IN ({placeholders})
            ORDER BY trade_date ASC""",
        binds,
    )
    result: dict[str, dict[str, float]] = {}
    for r in rows:
        t = r[0]
        d = str(r[1]) if r[1] else ""
        p = float(r[2]) if r[2] else 0
        if t not in result:
            result[t] = {}
        result[t][d] = p
    return result


@router.post("/backtest")
async def run_portfolio_backtest(data: dict):
    period = data.get("period", "1y")
    initial_capital = float(data.get("initial_capital", 10000000))
    strategy_limit = min(int(data.get("strategy_limit", 5)), 5)
    slippage_pct = float(data.get("slippage_pct", 0.05)) / 100  # user enters as %, convert to decimal
    commission_pct = float(data.get("commission_pct", 0.015)) / 100
    tax_pct = float(data.get("tax_pct", 0.18)) / 100

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

    strategies = strategies[:strategy_limit]
    total_alloc = sum(float(s[3] or 0) for s in strategies) or 1

    # Build ticker → weight & strategy mapping across all strategies
    all_signals: dict[str, list[dict]] = {}
    # Pre-load strategy params for exit conditions
    strategy_params_map: dict[int, dict] = {}
    for s in strategies:
        sid, gen, alloc = s[1], s[2], float(s[3] or 0) / total_alloc
        if sid not in strategy_params_map:
            rows = await execute_query(
                "SELECT params_json FROM strategy_pool WHERE id = :1", [sid],
            )
            if rows and rows[0][0]:
                try:
                    strategy_params_map[sid] = json_mod.loads(rows[0][0])
                except (json_mod.JSONDecodeError, TypeError):
                    strategy_params_map[sid] = {}
            else:
                strategy_params_map[sid] = {}
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

    all_tickers = list(all_signals.keys())
    # Load benchmark data (KOSPI)
    benchmark_prices: dict[str, float] = {}
    benchmark_row = await execute_query(
        "SELECT close_price FROM index_daily WHERE index_code = 'KOSPI' AND trade_date >= :1 AND trade_date <= :2 ORDER BY trade_date ASC",
        [start_date.isoformat(), end_date.isoformat()],
    )
    if benchmark_row:
        benchmark_prices = {str(r[0]): float(r[1]) for r in await execute_query(
            """SELECT trade_date, close_price FROM index_daily
               WHERE index_code = 'KOSPI'
               AND trade_date >= TO_DATE(:1, 'YYYY-MM-DD')
               AND trade_date <= TO_DATE(:2, 'YYYY-MM-DD')
               ORDER BY trade_date ASC""",
            [start_date.isoformat(), end_date.isoformat()],
        )}
    # KOSDAQ
    kospi_prices = benchmark_prices
    kosdaq_prices = {}
    kosdaq_row = await execute_query(
        "SELECT close_price FROM index_daily WHERE index_code = 'KOSDAQ' AND trade_date >= :1 AND trade_date <= :2 ORDER BY trade_date ASC FETCH FIRST 1 ROW ONLY",
        [start_date.isoformat(), end_date.isoformat()],
    )
    if kosdaq_row:
        kosdaq_prices = {str(r[0]): float(r[1]) for r in await execute_query(
            """SELECT trade_date, close_price FROM index_daily
               WHERE index_code = 'KOSDAQ'
               AND trade_date >= TO_DATE(:1, 'YYYY-MM-DD')
               AND trade_date <= TO_DATE(:2, 'YYYY-MM-DD')
               ORDER BY trade_date ASC""",
            [start_date.isoformat(), end_date.isoformat()],
        )}
    price_map = await _get_prices_batch(all_tickers, start_date, end_date)

    trading_dates: list[str] = []
    date_set: set[str] = set()
    for t, days in price_map.items():
        for d in days:
            if d not in date_set:
                date_set.add(d)
                trading_dates.append(d)
    trading_dates.sort()
    if not trading_dates:
        raise HTTPException(400, "No price data available for the selected period")

    # Pre-compute entry plan: on first day a ticker has price data, enter position
    entry_plan: list[tuple[str, float, str]] = []  # (ticker, weight, entry_date)
    for ticker, signals in all_signals.items():
        w = sum(s["weight"] for s in signals)
        for d in trading_dates:
            if price_map.get(ticker, {}).get(d):
                entry_plan.append((ticker, w, d))
                break

    # Sort entry plan by weight descending so higher-conviction tickers enter first
    entry_plan.sort(key=lambda x: -x[1])

    # Pre-compute per-ticker exit params (aggregate across strategies)
    ticker_exit_params: dict[str, dict] = {}
    for ticker, signals in all_signals.items():
        sl = 0.0
        tp = 0.0
        ta = 0.0
        ts = 0.0
        for sig in signals:
            p = strategy_params_map.get(sig["strategy_id"], {})
            sl = max(sl, float(p.get("stop_loss_pct", 0)))
            tp = max(tp, float(p.get("fixed_take_profit_pct", 0)))
            ta = max(ta, float(p.get("trailing_activation_pct", 0)))
            ts = max(ts, float(p.get("trailing_stop_pct", 0)))
        ticker_exit_params[ticker] = {
            "stop_loss_pct": sl,
            "take_profit_pct": tp,
            "trailing_activation_pct": ta,
            "trailing_stop_pct": ts,
        }

    cash = initial_capital
    positions: dict[str, dict] = {}
    trade_count = 0
    daily_values: list[dict] = []
    total_wins = 0
    total_losses = 0
    gross_profit = 0.0
    gross_loss = 0.0
    peak_capital = initial_capital
    max_drawdown = 0
    entry_idx = 0
    max_position_budget = 500000.0
    max_exposure = initial_capital
    current_exposure = 0.0

    for date_str in trading_dates:
        # Enter new positions scheduled for this date
        while entry_idx < len(entry_plan) and entry_plan[entry_idx][2] == date_str:
            ticker, weight, _ = entry_plan[entry_idx]
            if ticker not in positions and weight > 0:
                price = price_map.get(ticker, {}).get(date_str, 0)
                if price > 0:
                    remaining_capacity = max(0, max_exposure - current_exposure)
                    alloc_amount = min(cash * weight, max_position_budget, remaining_capacity, cash * 0.9)
                    qty = int(alloc_amount / price)
                    if qty <= 0:
                        entry_idx += 1
                        continue
                    buy_price = price * (1 + slippage_pct)
                    buy_cost = qty * buy_price
                    fees = buy_cost * commission_pct
                    total_entry_cost = buy_cost + fees
                    if total_entry_cost > cash:
                        entry_idx += 1
                        continue
                    params = ticker_exit_params.get(ticker, {})
                    positions[ticker] = {
                        "qty": qty, "entry": buy_price, "entry_date": date_str,
                        "highest": price,
                        "stop_loss_pct": params.get("stop_loss_pct", 0),
                        "take_profit_pct": params.get("take_profit_pct", 0),
                        "trailing_activation_pct": params.get("trailing_activation_pct", 0),
                        "trailing_stop_pct": params.get("trailing_stop_pct", 0),
                    }
                    cash -= total_entry_cost
                    current_exposure += qty * price
                    trade_count += 1
                    logger.info(
                        "[BACKTEST] ENTRY %s @ %.0f (qty=%d, weight=%.2f%%, sl=%.1f%%, tp=%.1f%%)",
                        ticker, price, qty, weight * 100,
                        params.get("stop_loss_pct", 0) * 100,
                        params.get("take_profit_pct", 0) * 100,
                    )
            entry_idx += 1

        # Check exit conditions for all open positions
        for ticker in list(positions.keys()):
            pos = positions[ticker]
            price = price_map.get(ticker, {}).get(date_str)
            if price is None:
                continue
            pos["highest"] = max(pos["highest"], price)
            sl = pos["stop_loss_pct"]
            tp = pos["take_profit_pct"]
            ta = pos["trailing_activation_pct"]
            ts = pos["trailing_stop_pct"]

            exit_reason = None
            if sl > 0 and price <= pos["entry"] * (1 - sl):
                exit_reason = "stop_loss"
            elif tp > 0 and price >= pos["entry"] * (1 + tp):
                exit_reason = "take_profit"
            elif ts > 0 and pos["highest"] > pos["entry"] * (1 + ta):
                trailing_price = pos["highest"] * (1 - ts)
                if price <= trailing_price:
                    exit_reason = "trailing_stop"

            if exit_reason:
                proceeds = pos["qty"] * price * (1 - slippage_pct)
                sell_fees = proceeds * (commission_pct + tax_pct)
                cash += proceeds - sell_fees
                pnl_amt = (proceeds - sell_fees) - (pos["qty"] * pos["entry"])
                pnl_pct = pnl_amt / (pos["qty"] * pos["entry"]) * 100 if pos["qty"] * pos["entry"] > 0 else 0
                trade_count += 1
                if pnl_pct > 0:
                    total_wins += 1
                    gross_profit += pnl_amt
                else:
                    total_losses += 1
                    gross_loss += abs(pnl_amt)
                logger.info(
                    "[BACKTEST] EXIT %s @ %.0f (%s, pnl=%.1f%%)",
                    ticker, price, exit_reason, pnl_pct,
                )
                del positions[ticker]

        # Calculate portfolio_value = cash + sum(positions market value)
        portfolio_value = cash
        for ticker, pos in positions.items():
            price = price_map.get(ticker, {}).get(date_str)
            if price:
                portfolio_value += pos["qty"] * price

        daily_values.append({"date": date_str, "value": round(portfolio_value, 2)})

        if portfolio_value > peak_capital:
            peak_capital = portfolio_value
        dd = (peak_capital - portfolio_value) / peak_capital * 100
        if dd > max_drawdown:
            max_drawdown = dd

    # Liquidate remaining positions at end of period
    for ticker, pos in list(positions.items()):
        last_price = price_map.get(ticker, {}).get(trading_dates[-1])
        if not last_price:
            last_price = pos["entry"]
        proceeds = pos["qty"] * last_price * (1 - slippage_pct)
        sell_fees = proceeds * (commission_pct + tax_pct)
        cash += proceeds - sell_fees
        trade_count += 1
        pnl_amt = (proceeds - sell_fees) - (pos["qty"] * pos["entry"])
        pnl_pct = pnl_amt / (pos["qty"] * pos["entry"]) * 100 if pos["qty"] * pos["entry"] > 0 else 0
        if pnl_pct > 0:
            total_wins += 1
            gross_profit += pnl_amt
        else:
            total_losses += 1
            gross_loss += abs(pnl_amt)
        logger.info(
            "[BACKTEST] FINAL_LIQUIDATE %s @ %.0f (pnl=%.1f%%)",
            ticker, last_price, pnl_pct,
        )
        del positions[ticker]

    final_value = cash

    profit_factor = (gross_profit / max(gross_loss, 0.01)) if gross_loss > 0 else (gross_profit or 0)

    total_return = (final_value - initial_capital) / initial_capital * 100
    win_rate = (total_wins / (total_wins + total_losses) * 100) if (total_wins + total_losses) > 0 else 0

    days = (end_date - start_date).days
    cagr = ((final_value / initial_capital) ** (365 / max(days, 1)) - 1) * 100 if days > 0 else 0

    # Sharpe ratio (annualized)
    returns = []
    for i in range(1, len(daily_values)):
        prev = daily_values[i - 1]["value"]
        if prev > 0:
            r = (daily_values[i]["value"] - prev) / prev
            returns.append(r)
    avg_return = sum(returns) / max(len(returns), 1) if returns else 0
    variance = sum((r - avg_return) ** 2 for r in returns) / max(len(returns), 1) if returns else 0
    std_return = variance ** 0.5 if variance > 0 else 0
    sharpe = (avg_return / max(std_return, 0.0001)) * (252 ** 0.5) if std_return > 0 else 0

    # Benchmark return
    benchmark_return = 0
    benchmark_cagr = 0
    benchmark_mdd = 0
    if kospi_prices:
        b_dates = sorted(kospi_prices.keys())
        if len(b_dates) >= 2:
            b_start = kospi_prices[b_dates[0]]
            b_end = kospi_prices[b_dates[-1]]
            benchmark_return = (b_end - b_start) / b_start * 100 if b_start > 0 else 0
            benchmark_cagr = ((b_end / b_start) ** (365 / max(days, 1)) - 1) * 100 if b_start > 0 and days > 0 else 0
            # Benchmark MDD
            b_peak = b_start
            b_mdd = 0
            for bd in b_dates:
                bp = kospi_prices[bd]
                if bp > b_peak:
                    b_peak = bp
                dd = (b_peak - bp) / b_peak * 100
                if dd > b_mdd:
                    b_mdd = dd
            benchmark_mdd = b_mdd
    alpha = total_return - benchmark_return

    details = json_mod.dumps({
        "daily_values": daily_values,
        "strategies_tested": len(strategies),
        "tickers_in_universe": len(all_signals),
        "benchmark": {
            "benchmark_return": round(benchmark_return, 2),
            "benchmark_cagr": round(benchmark_cagr, 2),
            "benchmark_mdd": round(benchmark_mdd, 2),
            "alpha": round(alpha, 2),
        },
        "costs": {
            "total_commission_pct": commission_pct * 100,
            "total_tax_pct": tax_pct * 100,
            "total_slippage_pct": slippage_pct * 100,
        },
    })
    await execute_non_query(
        """INSERT INTO portfolio_backtest (portfolio_id, period_start, period_end, initial_capital,
           return_pct, win_rate, mdd, sharpe_ratio, cagr, profit_factor, trade_count, details_json)
           VALUES (:1, TO_DATE(:2, 'YYYY-MM-DD'), TO_DATE(:3, 'YYYY-MM-DD'), :4, :5, :6, :7, :8, :9, :10, :11, :12)""",
        [1, start_date.isoformat(), end_date.isoformat(), initial_capital,
         round(total_return, 2), round(win_rate, 2), round(max_drawdown, 2),
         round(sharpe, 4), round(cagr, 2), round(profit_factor, 4), trade_count, details],
    )

    avg_win = gross_profit / max(total_wins, 1)
    avg_loss = gross_loss / max(total_losses, 1)

    return {
        "return_pct": round(total_return, 2),
        "win_rate": round(win_rate, 2),
        "mdd": round(max_drawdown, 2),
        "sharpe_ratio": round(sharpe, 4),
        "cagr": round(cagr, 2),
        "profit_factor": round(profit_factor, 4),
        "trade_count": trade_count,
        "initial_capital": initial_capital,
        "final_value": round(final_value, 2),
        "daily_values": daily_values,
        "strategies_tested": len(strategies),
        "tickers_screened": len(all_signals),
        "benchmark_return": round(benchmark_return, 2),
        "benchmark_cagr": round(benchmark_cagr, 2),
        "benchmark_mdd": round(benchmark_mdd, 2),
        "alpha": round(alpha, 2),
        "commission_pct": round(commission_pct * 100, 3),
        "tax_pct": round(tax_pct * 100, 3),
        "slippage_pct": round(slippage_pct * 100, 3),
        "total_wins": total_wins,
        "total_losses": total_losses,
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
    }


@router.get("/backtest/results")
async def get_backtest_results(limit: int = Query(10, ge=1, le=50)):
    rows = await execute_query(
        """SELECT id, portfolio_id, period_start, period_end, initial_capital,
                  return_pct, win_rate, mdd, sharpe_ratio, cagr, profit_factor, trade_count, details_json, created_at
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
            "profit_factor": float(r[10] or 0),
            "trade_count": int(r[11] or 0),
            "details_json": r[12],
            "created_at": str(r[13]) if r[13] else "",
        })
    return {"items": items}
