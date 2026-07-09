from __future__ import annotations

import json as json_mod
import logging
from datetime import date, datetime, timezone, timedelta

from app.database import execute_query, execute_non_query
from app.services.service_db import add_system_log, get_settings, update_setting

logger = logging.getLogger(__name__)


# ── 1. Risk Management ─────────────────────────────────────────


async def get_risk_settings() -> dict:
    raw = await get_settings()
    defaults = {
        "max_portfolio_allocation": float(raw.get("max_portfolio_allocation", 40)),
        "max_position_allocation": float(raw.get("max_position_allocation", 10)),
        "daily_loss_limit": float(raw.get("daily_loss_limit", 5)),
        "daily_profit_lock": float(raw.get("daily_profit_lock", 10)),
        "risk_mode": raw.get("risk_mode", "normal"),
        "max_capital_deployment": float(raw.get("max_capital_deployment", 100)),
        "min_cash_ratio": float(raw.get("min_cash_ratio", 10)),
    }
    return defaults


async def update_risk_setting(key: str, value) -> dict:
    await update_setting(key, value, "number" if isinstance(value, (int, float)) else "string")
    return await get_risk_settings()


async def check_risk_limits() -> dict:
    settings = await get_risk_settings()
    daily_loss_limit = float(settings.get("daily_loss_limit", 5))
    daily_profit_lock = float(settings.get("daily_profit_lock", 10))
    risk_mode = settings.get("risk_mode", "normal")
    blocked = False
    reasons = []
    warnings = []

    rows = await execute_query("SELECT COUNT(*) FROM paper_positions WHERE status = 'open'")
    open_positions = int(rows[0][0]) if rows else 0

    rows = await execute_query(
        "SELECT COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell' AND trade_date >= TRUNC(CURRENT_TIMESTAMP)",
    )
    today_pnl = float(rows[0][0]) if rows else 0
    initial_capital = 10000000.0
    today_pnl_pct = (today_pnl / initial_capital) * 100

    # Portfolio MDD from paper trading equity curve (real performance)
    rows = await execute_query(
        """SELECT COALESCE(MIN(pnl_amt), 0) FROM paper_trades WHERE action = 'sell'"""
    )
    paper_mdd_raw = abs(float(rows[0][0]) if rows and rows[0][0] else 0)
    rows = await execute_query("SELECT COALESCE(MAX(mdd), 0) FROM portfolio_backtest")
    backtest_mdd = abs(float(rows[0][0]) if rows else 0)
    portfolio_mdd = backtest_mdd

    # Compute actual MDD from paper positions (current unrealized PnL)
    rows = await execute_query(
        "SELECT COALESCE(AVG(pnl_pct), 0) FROM paper_positions WHERE status = 'open'"
    )
    avg_unrealized_pnl = float(rows[0][0]) if rows else 0

    # Consecutive losses
    rows = await execute_query(
        """SELECT COUNT(*) FROM (
            SELECT pnl_pct, ROW_NUMBER() OVER (ORDER BY trade_date DESC) rn
            FROM paper_trades WHERE action = 'sell' ORDER BY trade_date DESC
        ) WHERE pnl_pct <= 0 AND rn <= 30"""
    )
    consecutive_losses = int(rows[0][0]) if rows else 0

    # Position concentration (single ticker exposure)
    rows = await execute_query(
        "SELECT COALESCE(SUM(quantity * current_price), 0), COALESCE(MAX(quantity * current_price), 0) FROM paper_positions WHERE status = 'open'"
    )
    total_exposure = float(rows[0][0]) if rows else 0
    max_single_exposure = float(rows[0][1]) if rows else 0
    single_asset_ratio = (max_single_exposure / max(total_exposure, 1)) * 100 if total_exposure > 0 else 0

    # Cash ratio
    cash_ratio = max(0, (initial_capital - total_exposure) / initial_capital * 100)

    # --- Checks ---

    if daily_loss_limit > 0 and today_pnl_pct <= -daily_loss_limit:
        blocked = True
        reasons.append(f"Daily loss limit: {today_pnl_pct:.2f}% <= -{daily_loss_limit}%")
        await add_system_log("RISK", "check_risk_limits", f"Daily loss limit breached: {today_pnl_pct:.2f}%")

    if daily_profit_lock > 0 and today_pnl_pct >= daily_profit_lock:
        blocked = True
        reasons.append(f"Daily profit lock: {today_pnl_pct:.2f}% >= {daily_profit_lock}%")
        await add_system_log("RISK", "check_risk_limits", f"Daily profit lock triggered: {today_pnl_pct:.2f}%")

    # MDD > 30%: BLOCKED (either from backtest or from unrealized losses)
    mdd_used = max(portfolio_mdd, max(0, -avg_unrealized_pnl))
    if mdd_used > 30:
        blocked = True
        reasons.append(f"Portfolio MDD {mdd_used:.1f}% > 30%")
        await add_system_log("RISK", "check_risk_limits", f"MDD limit breached: {mdd_used:.1f}%")

    # Single asset concentration > 30%: BLOCKED
    if single_asset_ratio > 30:
        blocked = True
        reasons.append(f"Single asset concentration {single_asset_ratio:.1f}% > 30%")

    # Consecutive losses >= 10: BLOCKED
    if consecutive_losses >= 10:
        blocked = True
        reasons.append(f"Consecutive losses {consecutive_losses} >= 10")

    # Excess positions warning
    if open_positions > 30:
        warnings.append(f"Open positions {open_positions} > 30")

    # Low cash warning
    if cash_ratio < 10:
        warnings.append(f"Cash ratio {cash_ratio:.1f}% < 10%")

    # P3: Auto cash reserve enforcement
    max_deploy = float(settings.get("max_capital_deployment", 100))
    min_cash = float(settings.get("min_cash_ratio", 10))
    if max_deploy < 100:
        max_exposure = initial_capital * max_deploy / 100
        if total_exposure > max_exposure:
            blocked = True
            reasons.append(f"Exposure {total_exposure:.0f} > max deploy {max_deploy}% ({max_exposure:.0f})")

    return {
        "blocked": blocked,
        "reasons": reasons,
        "warnings": warnings,
        "today_pnl_pct": round(today_pnl_pct, 2),
        "open_positions": open_positions,
        "total_exposure": round(total_exposure, 2),
        "cash_ratio": round(cash_ratio, 2),
        "single_asset_ratio": round(single_asset_ratio, 2),
        "consecutive_losses": consecutive_losses,
        "portfolio_mdd": round(portfolio_mdd, 2),
        "avg_unrealized_pnl": round(avg_unrealized_pnl, 2),
        "risk_status": "BLOCKED" if blocked else "PASS",
        "max_capital_deployment": max_deploy,
        "min_cash_ratio": min_cash,
        "max_exposure": initial_capital * max_deploy / 100,
    }


# ── 2. Portfolio Auto Promotion (with replacement) ─────────────


async def auto_promote_strategies() -> dict:
    """Promote candidates meeting fitness >= 50, win_rate >= 45, trades >= 30.
    If approved count < 5, auto-promote. If a candidate has higher fitness
    than an existing approved strategy, swap them."""
    candidates = await execute_query(
        """SELECT ps.id, ps.strategy_id, ps.generation, pf.fitness_score, pf.win_rate, pf.total_trades, pf.max_drawdown, pf.profit_factor
           FROM portfolio_strategy ps
           JOIN (
               SELECT strategy_id, fitness_score, win_rate, total_trades, max_drawdown, profit_factor,
                      ROW_NUMBER() OVER (PARTITION BY strategy_id ORDER BY generation DESC) as rn
               FROM strategy_performance
           ) pf ON pf.strategy_id = ps.strategy_id AND pf.rn = 1
           WHERE ps.status = 'candidate'
           ORDER BY pf.fitness_score DESC""",
    )
    approved = await execute_query(
        """SELECT ps.id, ps.strategy_id, pf.fitness_score
           FROM portfolio_strategy ps
           JOIN (
               SELECT strategy_id, fitness_score,
                      ROW_NUMBER() OVER (PARTITION BY strategy_id ORDER BY generation DESC) as rn
               FROM strategy_performance
           ) pf ON pf.strategy_id = ps.strategy_id AND pf.rn = 1
           WHERE ps.status = 'approved'
           ORDER BY pf.fitness_score DESC""",
    )
    promoted = 0
    demoted = 0
    swapped = 0

    eligible = [
        c for c in candidates
        if float(c[3] or 0) >= 50        # fitness >= 50
        and float(c[4] or 0) >= 45       # win_rate >= 45
        and int(c[5] or 0) >= 30         # total_trades >= 30
        and float(c[7] or 0) >= 1.3      # profit_factor >= 1.3
        and abs(float(c[6] or 0)) <= 20  # mdd <= 20
    ]

    for c in eligible:
        pid, sid, gen, fitness, wr, trades, mdd, pf = c[0], c[1], c[2], float(c[3] or 0), float(c[4] or 0), int(c[5] or 0), float(c[6] or 0), float(c[7] or 0)

        if len(approved) < 5:
            # Promote directly
            await _set_strategy_status(pid, sid, "candidate", "approved", f"Auto-promote fitness={fitness:.1f}")
            approved.append((pid, sid, fitness))
            approved.sort(key=lambda x: -x[2])
            promoted += 1
            logger.info("[AUTO-PROMOTION] Strategy %d promoted (fitness=%.1f wr=%.1f pf=%.2f mdd=%.1f)", sid, fitness, wr, pf, abs(mdd))
        else:
            # Check if better than worst approved
            worst = approved[-1]
            if fitness > worst[2]:
                # Demote worst
                await _set_strategy_status(worst[0], worst[1], "approved", "candidate", f"Replaced by strategy {sid} (fitness {fitness:.1f} > {worst[2]:.1f})")
                demoted += 1
                # Promote current
                await _set_strategy_status(pid, sid, "candidate", "approved", f"Replaced strategy {worst[1]} (fitness {fitness:.1f} > {worst[2]:.1f})")
                approved[-1] = (pid, sid, fitness)
                approved.sort(key=lambda x: -x[2])
                swapped += 1
                logger.info("[AUTO-PROMOTION] Strategy %d replaced %d (fitness %.1f > %.1f)", sid, worst[1], fitness, worst[2])

    logger.info("[AUTO-PROMOTION] promoted=%d demoted=%d swapped=%d", promoted, demoted, swapped)
    return {"promoted": promoted, "demoted": demoted, "swapped": swapped, "eligible_found": len(eligible)}


async def _set_strategy_status(pid: int, sid: int, old_status: str, new_status: str, reason: str):
    await execute_non_query(
        "UPDATE portfolio_strategy SET status = :1, approved_at = CASE WHEN :1 = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END WHERE id = :2",
        [new_status, pid],
    )
    await execute_non_query(
        "INSERT INTO promotion_history (strategy_id, old_status, new_status, reason, created_at) VALUES (:1, :2, :3, :4, CURRENT_TIMESTAMP)",
        [sid, old_status, new_status, reason],
    )
    await add_system_log("PROMOTION", "auto_promote", f"Strategy {sid}: {old_status} → {new_status} ({reason})")


async def get_promotion_history(limit: int = 50) -> list[dict]:
    rows = await execute_query(
        """SELECT ph.id, ph.strategy_id, sp.name, ph.old_status, ph.new_status, ph.reason, ph.created_at
           FROM promotion_history ph
           LEFT JOIN strategy_pool sp ON sp.id = ph.strategy_id
           ORDER BY ph.created_at DESC FETCH FIRST :1 ROWS ONLY""",
        [limit],
    )
    return [
        {
            "id": r[0], "strategy_id": r[1], "strategy_name": r[2] or "",
            "old_status": r[3], "new_status": r[4], "reason": r[5] or "",
            "created_at": str(r[6]) if r[6] else "",
        }
        for r in rows
    ]


# ── 3. Portfolio Rebalance ─────────────────────────────────────


async def rebalance_portfolio(method: str = "WEEKLY") -> dict:
    """Rebalance approved strategies by fitness ranking.
    Top 3: 40/30/30, Top 5: 25/25/20/15/15."""
    approved = await execute_query(
        """SELECT ps.id, ps.strategy_id, ps.generation, pf.fitness_score
           FROM portfolio_strategy ps
           JOIN (
               SELECT strategy_id, fitness_score,
                      ROW_NUMBER() OVER (PARTITION BY strategy_id ORDER BY generation DESC) as rn
               FROM strategy_performance
           ) pf ON pf.strategy_id = ps.strategy_id AND pf.rn = 1
           WHERE ps.status = 'approved'
           ORDER BY pf.fitness_score DESC""",
    )
    if not approved:
        return {"message": "No approved strategies to rebalance"}

    n = len(approved)
    if method == "TOP3":
        top_n = min(n, 3)
        weights = [40, 30, 30]
    elif method == "TOP5":
        top_n = min(n, 5)
        weights = [25, 25, 20, 15, 15]
    else:
        top_n = n
        weights = [100 // n] * n
        remainder = 100 - sum(weights)
        for i in range(remainder):
            weights[i] += 1

    before = []
    for a in approved:
        rows = await execute_query(
            "SELECT allocation FROM portfolio_strategy WHERE id = :1", [a[0]],
        )
        before.append({"id": a[0], "strategy_id": a[1], "allocation": float(rows[0][0]) if rows else 0})

    after = []
    for i, a in enumerate(approved[:top_n]):
        w = weights[i] / 100.0 if i < len(weights) else 0
        await execute_non_query(
            "UPDATE portfolio_strategy SET allocation = :1 WHERE id = :2",
            [round(w, 4), a[0]],
        )
        after.append({"id": a[0], "strategy_id": a[1], "allocation": round(w, 4)})

    # Zero out remaining strategies
    for a in approved[top_n:]:
        await execute_non_query(
            "UPDATE portfolio_strategy SET allocation = 0 WHERE id = :1", [a[0]],
        )
        after.append({"id": a[0], "strategy_id": a[1], "allocation": 0})

    await execute_non_query(
        "INSERT INTO portfolio_rebalance_history (rebalance_type, before_json, after_json, created_at) VALUES (:1, :2, :3, CURRENT_TIMESTAMP)",
        [method, json_mod.dumps(before), json_mod.dumps(after)],
    )
    await add_system_log("REBALANCE", "portfolio", f"Portfolio rebalanced ({method}): {top_n} strategies")

    return {"method": method, "strategies": after, "count": len(after)}


async def get_rebalance_history(limit: int = 20) -> list[dict]:
    rows = await execute_query(
        """SELECT id, rebalance_type, before_json, after_json, created_at
           FROM portfolio_rebalance_history
           ORDER BY created_at DESC FETCH FIRST :1 ROWS ONLY""",
        [limit],
    )
    return [
        {
            "id": r[0], "type": r[1],
            "before": json_mod.loads(r[2]) if r[2] else [],
            "after": json_mod.loads(r[3]) if r[3] else [],
            "created_at": str(r[4]) if r[4] else "",
        }
        for r in rows
    ]


# ── 4. Paper Trading Performance (Enhanced) ────────────────────


def get_pf_grade(pf: float) -> str:
    if pf < 1.0:
        return "LOSS"
    if pf < 1.2:
        return "WEAK"
    if pf < 1.5:
        return "GOOD"
    if pf < 2.0:
        return "STRONG"
    return "EXCELLENT"


async def get_paper_performance(period: str = "ALL") -> dict:
    rows = await execute_query("SELECT COUNT(*) FROM paper_trades")
    total_trades = int(rows[0][0]) if rows else 0

    rows = await execute_query("SELECT COUNT(*) FROM paper_trades WHERE action = 'sell' AND pnl_pct > 0")
    winning_trades = int(rows[0][0]) if rows else 0

    rows = await execute_query("SELECT COUNT(*) FROM paper_trades WHERE action = 'sell' AND pnl_pct <= 0")
    losing_trades = int(rows[0][0]) if rows else 0

    win_rate = (winning_trades / max(total_trades, 1)) * 100 if total_trades > 0 else 0

    rows = await execute_query("SELECT COALESCE(AVG(pnl_pct), 0) FROM paper_trades WHERE action = 'sell'")
    avg_trade_return = float(rows[0][0]) if rows else 0

    rows = await execute_query("SELECT COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell'")
    total_pnl = float(rows[0][0]) if rows else 0

    initial_capital = 10000000.0
    total_return = (total_pnl / initial_capital) * 100

    rows = await execute_query("SELECT COALESCE(AVG(EXTRACT(DAY FROM (exit_date - entry_date))), 0) FROM paper_positions WHERE status = 'closed'")
    avg_holding_days = float(rows[0][0]) if rows else 0

    # Period filter for daily returns and performance metrics
    date_filter = ""
    if period == "7D":
        date_filter = "AND trade_date >= CURRENT_TIMESTAMP - INTERVAL '7' DAY"
    elif period == "30D":
        date_filter = "AND trade_date >= CURRENT_TIMESTAMP - INTERVAL '30' DAY"
    elif period == "90D":
        date_filter = "AND trade_date >= CURRENT_TIMESTAMP - INTERVAL '90' DAY"

    rows = await execute_query(
        f"SELECT COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell' AND pnl_amt > 0 {date_filter}",
    )
    gross_profit = float(rows[0][0]) if rows else 0

    rows = await execute_query(
        f"SELECT COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell' AND pnl_amt < 0 {date_filter}",
    )
    gross_loss = abs(float(rows[0][0]) if rows else 0)

    profit_factor = (gross_profit / max(gross_loss, 0.01)) if gross_loss > 0 else (gross_profit or 0)

    rows = await execute_query(
        f"""SELECT TRUNC(trade_date), COALESCE(SUM(pnl_amt), 0)
            FROM paper_trades WHERE action = 'sell' {date_filter}
            GROUP BY TRUNC(trade_date) ORDER BY TRUNC(trade_date) ASC""",
    )
    daily_pnl_map = {str(r[0]): float(r[1]) for r in rows}
    daily_returns_list = [pnl / initial_capital for pnl in daily_pnl_map.values()]
    n = len(daily_returns_list)

    sharpe = 0.0
    sortino = 0.0
    if n > 1:
        avg_daily_return = sum(daily_returns_list) / n
        variance = sum((r - avg_daily_return) ** 2 for r in daily_returns_list) / (n - 1)
        std = variance ** 0.5
        negative = [r for r in daily_returns_list if r < 0]
        downside_var = sum(r ** 2 for r in negative) / n if negative else 0.0001
        sharpe = (avg_daily_return / max(std, 0.0001)) * (252 ** 0.5)
        sortino = (avg_daily_return / max(downside_var ** 0.5, 0.0001)) * (252 ** 0.5)

    # MDD from daily returns
    mdd = 0.0
    peak = initial_capital
    cumulative = initial_capital
    for pnl in daily_pnl_map.values():
        cumulative += pnl
        if cumulative > peak:
            peak = cumulative
        dd = (peak - cumulative) / peak * 100
        if dd > mdd:
            mdd = dd

    # CAGR
    first_trade_row = await execute_query("SELECT MIN(trade_date) FROM paper_trades")
    first_trade = first_trade_row[0][0] if first_trade_row else None
    cagr = 0.0
    if first_trade and total_trades > 0:
        first_date = first_trade.date() if hasattr(first_trade, 'date') else first_trade
        days_elapsed = (date.today() - first_date).days if isinstance(first_date, date) else 1
        if days_elapsed > 0:
            cagr = ((1 + total_return / 100) ** (365 / days_elapsed) - 1) * 100

    # Current exposure
    rows = await execute_query("SELECT COALESCE(SUM(quantity * current_price), 0) FROM paper_positions WHERE status = 'open'")
    current_exposure = float(rows[0][0]) if rows else 0

    rows = await execute_query("SELECT COUNT(*) FROM paper_positions WHERE status = 'open'")
    open_positions_count = int(rows[0][0]) if rows else 0

    cash_ratio = max(0, (initial_capital - current_exposure) / initial_capital * 100)

    # Equity curve
    equity_curve = []
    cumulative_equity = initial_capital
    for d_str, pnl in sorted(daily_pnl_map.items()):
        cumulative_equity += pnl
        equity_curve.append({"date": d_str, "equity": round(cumulative_equity, 2)})

    # Drawdown curve
    drawdown_curve = []
    peak_eq = initial_capital
    for pt in equity_curve:
        if pt["equity"] > peak_eq:
            peak_eq = pt["equity"]
        drawdown_curve.append({"date": pt["date"], "drawdown": round((peak_eq - pt["equity"]) / peak_eq * 100, 2)})

    pf_grade = get_pf_grade(profit_factor)

    avg_win = gross_profit / max(winning_trades, 1)
    avg_loss = gross_loss / max(losing_trades, 1)

    return {
        "total_return": round(total_return, 2),
        "cagr": round(cagr, 2),
        "sharpe": round(sharpe, 4),
        "sortino": round(sortino, 4),
        "max_drawdown": round(mdd, 2),
        "win_rate": round(win_rate, 2),
        "profit_factor": round(profit_factor, 4),
        "pf_grade": pf_grade,
        "average_trade_return": round(avg_trade_return, 2),
        "average_holding_days": round(avg_holding_days, 1),
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "total_pnl": round(total_pnl, 2),
        "current_exposure": round(current_exposure, 2),
        "open_positions": open_positions_count,
        "cash_ratio": round(cash_ratio, 2),
        "equity_curve": equity_curve,
        "drawdown_curve": drawdown_curve,
    }


# ── 5. Evolution Dashboard ─────────────────────────────────────


async def get_evolution_dashboard() -> dict:
    from app.strategy_evolution.database import get_evolution_status, get_generations
    status = await get_evolution_status()
    generations = await get_generations(limit=30)
    recent = generations[:30]
    gen_count = len(recent)
    avg_fitness = sum(g.avg_fitness or 0 for g in recent) / max(gen_count, 1)
    best_fitness = max((g.best_fitness or 0) for g in recent) if recent else 0
    avg_return = sum(g.avg_return or 0 for g in recent) / max(gen_count, 1)
    avg_winrate = sum(g.avg_winrate or 0 for g in recent) / max(gen_count, 1)

    trends = [
        {"generation": g.generation, "avg_fitness": g.avg_fitness or 0, "best_fitness": g.best_fitness or 0,
         "avg_return": g.avg_return or 0, "avg_winrate": g.avg_winrate or 0}
        for g in reversed(recent)
    ]

    gen_details = []
    for g in reversed(recent):
        cnt = await execute_query("SELECT COUNT(*) FROM strategy_pool WHERE generation = :1 AND is_alive = 'Y'", [g.generation])
        univ = await execute_query("SELECT COUNT(*) FROM evolution_evaluation_universe WHERE generation = :1", [g.generation])
        gen_details.append({
            "generation": g.generation,
            "best_fitness": g.best_fitness or 0,
            "avg_fitness": g.avg_fitness or 0,
            "best_return": g.avg_return or 0,
            "avg_return": g.avg_return or 0,
            "best_win_rate": g.avg_winrate or 0,
            "strategy_count": int(cnt[0][0]) if cnt else 0,
            "universe_size": int(univ[0][0]) if univ else 0,
            "created_at": str(g.created_at_kst) if hasattr(g, 'created_at_kst') else "",
        })

    from app.routers.evolution import get_orch
    config = get_orch().config if get_orch() else None

    return {
        "current_generation": status.current_generation or 0,
        "is_running": status.is_running == "Y",
        "last_run_at": str(status.last_run_at) if status.last_run_at else None,
        "next_scheduled_run": str(status.next_scheduled_run) if status.next_scheduled_run else None,
        "population_size": config.population_size if config else 50,
        "mutation_rate": config.mutation_rate if config else 0.3,
        "crossover_rate": config.crossover_rate if config else 0.4,
        "generation_count": gen_count,
        "avg_fitness": round(avg_fitness, 4),
        "best_fitness": round(best_fitness, 4),
        "avg_return": round(avg_return, 4),
        "avg_winrate": round(avg_winrate, 2),
        "trends": trends,
        "generation_details": gen_details,
    }


# ── 6. Portfolio Health ────────────────────────────────────────


async def get_portfolio_health() -> dict:
    rows = await execute_query("SELECT COUNT(*) FROM portfolio_strategy")
    total_strategies = int(rows[0][0]) if rows else 0
    rows = await execute_query("SELECT COUNT(*) FROM portfolio_strategy WHERE status = 'approved'")
    approved = int(rows[0][0]) if rows else 0
    rows = await execute_query("SELECT COUNT(*) FROM portfolio_strategy WHERE status = 'candidate'")
    candidate = int(rows[0][0]) if rows else 0
    rows = await execute_query("SELECT COUNT(*) FROM portfolio_strategy WHERE status = 'disabled'")
    disabled = int(rows[0][0]) if rows else 0

    try:
        rows = await execute_query("SELECT return_pct, mdd, sharpe_ratio, cagr FROM portfolio_backtest ORDER BY id DESC FETCH FIRST 1 ROW ONLY")
        bt = rows[0] if rows else None
    except Exception:
        bt = None
    try:
        pf_rows = await execute_query("SELECT profit_factor FROM portfolio_backtest ORDER BY id DESC FETCH FIRST 1 ROW ONLY")
        pf_val = float(pf_rows[0][0]) if pf_rows and pf_rows[0][0] else 0
    except Exception:
        pf_val = 0
    rows = await execute_query("SELECT COUNT(*) FROM paper_trades WHERE trade_date >= TRUNC(CURRENT_TIMESTAMP)")
    today_signals = int(rows[0][0]) if rows else 0
    rows = await execute_query("SELECT COUNT(*) FROM paper_positions WHERE status = 'open'")
    open_positions = int(rows[0][0]) if rows else 0
    rows = await execute_query("SELECT COUNT(*) FROM paper_positions WHERE status = 'closed'")
    closed_positions = int(rows[0][0]) if rows else 0

    return {
        "total_strategies": total_strategies,
        "approved_strategies": approved,
        "candidate_strategies": candidate,
        "disabled_strategies": disabled,
        "portfolio_return": round(float(bt[0]), 2) if bt else 0,
        "portfolio_mdd": round(float(bt[1]), 2) if bt else 0,
        "portfolio_sharpe": round(float(bt[2]), 4) if bt else 0,
        "portfolio_cagr": round(float(bt[3]), 2) if bt else 0,
        "portfolio_profit_factor": round(pf_val, 4),
        "pf_grade": get_pf_grade(pf_val),
        "today_signals": today_signals,
        "open_positions": open_positions,
        "closed_positions": closed_positions,
    }


# ── 7. Scheduler Monitoring ────────────────────────────────────


async def get_scheduler_status() -> dict:
    from app.services.market_scheduler import get_scheduler

    # APScheduler
    apsched = get_scheduler()
    ap_jobs = []
    if apsched:
        for job in apsched.get_jobs():
            runs = await execute_query(
                "SELECT COUNT(*), COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END), COUNT(CASE WHEN status = 'FAIL' THEN 1 END), COALESCE(AVG(execution_time_ms), 0) FROM scheduler_history WHERE job_id = :1",
                [job.id],
            )
            ap_jobs.append({
                "id": job.id,
                "name": job.name,
                "status": "RUNNING" if job.next_run_time else "PAUSED",
                "next_run": str(job.next_run_time) if job.next_run_time else None,
                "success_count": int(runs[0][1]) if runs else 0,
                "fail_count": int(runs[0][2]) if runs else 0,
                "avg_runtime_ms": round(float(runs[0][3]), 1) if runs else 0,
            })

    # Paper Trading scheduler
    from app.services.paper_trading_scheduler import _running as pt_running
    pt_job = {
        "id": "paper_trading",
        "name": "Paper Trading Cycle",
        "status": "RUNNING" if pt_running else "STOPPED",
        "interval": "3600s",
    }

    # Evolution scheduler
    from app.strategy_evolution.database import get_evolution_status
    evo_status = await get_evolution_status()
    evo_job = {
        "id": "evolution",
        "name": "Evolution Engine",
        "status": "RUNNING" if evo_status.is_running == "Y" else "IDLE",
        "generation": evo_status.current_generation or 0,
        "last_run": str(evo_status.last_run_at) if evo_status.last_run_at else None,
    }

    return {"jobs": ap_jobs + [pt_job, evo_job]}


# ── 8. System Health ───────────────────────────────────────────


async def get_system_health() -> dict:
    db_ok = False
    pool_info = {}
    try:
        from app.database import acquire_conn
        conn = await acquire_conn()
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM DUAL")
        db_ok = True
        cur.execute("SELECT COUNT(*) FROM v$session WHERE username IS NOT NULL")
        active_sessions = int(cur.fetchone()[0]) if cur.fetchone() else 0
        conn.close()
        pool_info = {"active_sessions": active_sessions}
    except Exception:
        pass

    # Scheduler config table for cache size
    cache_rows = await execute_query("SELECT COUNT(*) FROM scheduler_config")
    cache_entries = int(cache_rows[0][0]) if cache_rows else 0

    # Count total tables as a health signal
    try:
        from app.database_sqlalchemy import _engine
        raw = _engine.raw_connection() if _engine else None
        if raw:
            cur = raw.connection.cursor()
            cur.execute("SELECT COUNT(*) FROM user_tables")
            table_count = int(cur.fetchone()[0]) if cur.fetchone() else 0
            raw.close()
        else:
            table_count = 0
    except Exception:
        table_count = 0

    return {
        "db_connected": db_ok,
        "db_pool": pool_info,
        "cache_entries": cache_entries,
        "total_tables": table_count,
        "alerts": [],
    }


# ── 9. Validation Mode ─────────────────────────────────────────


async def start_validation() -> dict:
    rows = await execute_query("SELECT COUNT(*) FROM validation_mode WHERE is_active = 'Y'")
    if rows and rows[0][0] > 0:
        return {"message": "Validation already in progress"}
    await execute_non_query(
        "INSERT INTO validation_mode (is_active, started_at) VALUES ('Y', CURRENT_TIMESTAMP)",
    )
    await add_system_log("VALIDATION", "validation", "30-day validation mode started")
    return {"message": "Validation mode started", "started_at": str(datetime.now(timezone.utc))}


async def stop_validation() -> dict:
    rows = await execute_query(
        "SELECT id FROM validation_mode WHERE is_active = 'Y' ORDER BY id DESC FETCH FIRST 1 ROW ONLY",
    )
    if not rows:
        return {"message": "No active validation"}
    vid = rows[0][0]
    result = await _compute_validation_report()
    await execute_non_query(
        "UPDATE validation_mode SET is_active = 'N', completed_at = CURRENT_TIMESTAMP, result = :1 WHERE id = :2",
        [json_mod.dumps(result), vid],
    )
    await add_system_log("VALIDATION", "validation", f"Validation completed: {result.get('verdict', 'UNKNOWN')}")
    return {"message": "Validation completed", "result": result}


async def get_validation_status() -> dict:
    rows = await execute_query(
        """SELECT id, is_active, started_at, completed_at, result
           FROM validation_mode ORDER BY id DESC FETCH FIRST 1 ROW ONLY""",
    )
    if not rows:
        return {"is_active": False}

    r = rows[0]
    result_data = json_mod.loads(r[4]) if r[4] and isinstance(r[4], str) else (r[4] if r[4] else {})

    # Today's log
    today_row = await execute_query(
        """SELECT daily_return, cumulative_return, mdd, win_rate, total_trades
           FROM validation_daily_log
           WHERE validation_id = :1 AND log_date = TRUNC(CURRENT_TIMESTAMP)""",
        [r[0]],
    )
    today = {
        "daily_return": float(today_row[0][0]) if today_row else 0,
        "cumulative_return": float(today_row[0][1]) if today_row else 0,
        "mdd": float(today_row[0][2]) if today_row else 0,
        "win_rate": float(today_row[0][3]) if today_row else 0,
        "total_trades": int(today_row[0][4]) if today_row else 0,
    } if today_row else {}

    return {
        "id": r[0],
        "is_active": r[1] == "Y",
        "started_at": str(r[2]) if r[2] else "",
        "completed_at": str(r[3]) if r[3] else "",
        "result": result_data,
        "today": today,
    }


async def log_daily_validation():
    rows = await execute_query(
        "SELECT id FROM validation_mode WHERE is_active = 'Y' ORDER BY id DESC FETCH FIRST 1 ROW ONLY",
    )
    if not rows:
        return
    vid = rows[0][0]
    perf = await get_paper_performance()
    await execute_non_query(
        """MERGE INTO validation_daily_log t
           USING dual ON (t.validation_id = :1 AND t.log_date = TRUNC(CURRENT_TIMESTAMP))
           WHEN MATCHED THEN UPDATE SET daily_return = :2, cumulative_return = :3, mdd = :4, win_rate = :5, total_trades = :6
           WHEN NOT MATCHED THEN INSERT (validation_id, log_date, daily_return, cumulative_return, mdd, win_rate, total_trades)
           VALUES (:1, TRUNC(CURRENT_TIMESTAMP), :2, :3, :4, :5, :6)""",
        [vid, perf.get("total_return", 0), perf.get("total_return", 0),
         perf.get("max_drawdown", 0), perf.get("win_rate", 0), perf.get("total_trades", 0)],
    )


async def _compute_validation_report() -> dict:
    perf = await get_paper_performance()

    # Benchmark (KOSPI) return over same period
    benchmark_return = 0
    rows = await execute_query("SELECT MIN(trade_date) FROM paper_trades")
    first_trade = rows[0][0] if rows else None
    if first_trade:
        bench = await execute_query(
            "SELECT close_price FROM index_daily WHERE index_code = 'KOSPI' AND trade_date >= :1 ORDER BY trade_date ASC FETCH FIRST 1 ROW ONLY",
            [first_trade],
        )
        bench_end = await execute_query(
            "SELECT close_price FROM index_daily WHERE index_code = 'KOSPI' AND trade_date <= TRUNC(CURRENT_TIMESTAMP) ORDER BY trade_date DESC FETCH FIRST 1 ROW ONLY",
        )
        if bench and bench_end:
            b_start = float(bench[0][0]) if bench[0][0] else 0
            b_end = float(bench_end[0][0]) if bench_end[0][0] else 0
            if b_start > 0:
                benchmark_return = (b_end - b_start) / b_start * 100

    alpha = perf.get("total_return", 0) - benchmark_return
    win_rate = perf.get("win_rate", 0)
    profit_factor = perf.get("profit_factor", 0)
    sharpe = perf.get("sharpe", 0)
    mdd = abs(perf.get("max_drawdown", 0))

    fitness = perf.get("fitness", 0)
    total_trades = perf.get("total_trades", 0)
    checks = {
        "fitness_gt_50": fitness >= 50,
        "return_gt_kospi": perf.get("total_return", 0) > benchmark_return,
        "win_rate_gt_50": win_rate > 50,
        "profit_factor_gt_1_5": profit_factor > 1.5,
        "sharpe_gt_1_0": sharpe > 1.0,
        "mdd_lt_20": mdd < 20,
        "trades_gt_50": total_trades >= 50,
    }
    all_pass = all(checks.values())

    if all_pass:
        verdict = "PASS"
    elif sum(1 for v in checks.values() if v) >= 5:
        verdict = "WATCH"
    else:
        verdict = "FAIL"

    return {
        "verdict": verdict,
        "total_return": perf.get("total_return", 0),
        "benchmark_return": round(benchmark_return, 2),
        "alpha": round(alpha, 2),
        "cagr": perf.get("cagr", 0),
        "sharpe": sharpe,
        "sortino": perf.get("sortino", 0),
        "max_drawdown": mdd,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "pf_grade": get_pf_grade(profit_factor),
        "fitness": perf.get("fitness", 0),
        "total_trades": perf.get("total_trades", 0),
        "checks": checks,
        "checks_passed": sum(1 for v in checks.values() if v),
        "checks_total": len(checks),
    }


# ── 10. P3: Cash Management Simulation ─────────────────────────


async def simulate_cash_ratio(min_cash_ratio: float) -> dict:
    """Simulate how different cash reserves affect the portfolio."""
    initial_capital = 10000000.0

    rows = await execute_query("SELECT COALESCE(SUM(quantity * current_price), 0) FROM paper_positions WHERE status = 'open'")
    current_exposure = float(rows[0][0]) if rows else 0

    rows = await execute_query("SELECT COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell'")
    total_pnl = float(rows[0][0]) if rows else 0

    current_cash = initial_capital - current_exposure
    deployment_pct = (current_exposure / initial_capital) * 100
    target_exposure = initial_capital * (1 - min_cash_ratio / 100)
    must_reduce = max(0, current_exposure - target_exposure)

    # Estimate MDD impact from reducing positions
    rows = await execute_query("SELECT COALESCE(AVG(pnl_pct), 0) FROM paper_positions WHERE status = 'open'")
    avg_unrealized_pnl = float(rows[0][0]) if rows else 0

    return {
        "current": {
            "cash": round(current_cash, 2),
            "exposure": round(current_exposure, 2),
            "deployment_pct": round(deployment_pct, 2),
            "cash_ratio": round((current_cash / initial_capital) * 100, 2),
        },
        "scenario": {
            "min_cash_ratio": min_cash_ratio,
            "target_exposure": round(target_exposure, 2),
            "target_cash": round(initial_capital * min_cash_ratio / 100, 2),
            "must_reduce_exposure_by": round(must_reduce, 2),
            "positions_to_close": int(must_reduce / max(current_exposure / max(len(await execute_query("SELECT COUNT(*) FROM paper_positions WHERE status='open'")), 1), 1)),
        },
        "projected": {
            "expected_return_change_pct": "0% (no sell trades yet)",
            "expected_mdd_reduction": f"{-avg_unrealized_pnl:.2f}% (current avg unrealized)",
        },
        "comparison": {
            "cash_10pct": {
                "exposure": initial_capital * 0.9,
                "cash": initial_capital * 0.1,
            },
            "cash_20pct": {
                "exposure": initial_capital * 0.8,
                "cash": initial_capital * 0.2,
            },
            "cash_30pct": {
                "exposure": initial_capital * 0.7,
                "cash": initial_capital * 0.3,
            },
        },
        "suggestion": "Set max_capital_deployment=90 to enforce 10% cash reserve. Current 0% cash leaves no buffer for drawdowns or new opportunities.",
    }


async def set_capital_deployment(deployment_pct: float) -> dict:
    """Set max capital deployment % (e.g. 80 = never invest more than 80% of capital)."""
    if deployment_pct < 10 or deployment_pct > 100:
        return {"error": "deployment_pct must be between 10 and 100"}
    await update_setting("max_capital_deployment", deployment_pct, "number")
    await add_system_log("RISK", "set_capital_deployment", f"max_capital_deployment set to {deployment_pct}%")
    return await check_risk_limits()


# ── 11. P4: Validation Dashboard ────────────────────────────────


async def get_validation_dashboard() -> dict:
    rows = await execute_query(
        """SELECT id, is_active, started_at, completed_at, result
           FROM validation_mode ORDER BY id DESC FETCH FIRST 1 ROW ONLY""",
    )
    if not rows:
        return {"active": False, "message": "No validation session found"}

    r = rows[0]
    vid = r[0]
    started = r[2]
    is_active = r[1] == "Y"

    now_utc = datetime.now(timezone.utc)
    if started:
        if hasattr(started, 'tzinfo') and started.tzinfo is None:
            started_dt = started.replace(tzinfo=timezone.utc)
        else:
            started_dt = started
        elapsed_days = (now_utc - started_dt).total_seconds() / 86400 if started_dt else 0
        remaining_days = max(0, 30 - elapsed_days)
    else:
        elapsed_days = 0
        remaining_days = 30

    # Daily logs
    log_rows = await execute_query(
        """SELECT log_date, daily_return, cumulative_return, mdd, win_rate, total_trades
           FROM validation_daily_log WHERE validation_id = :1 ORDER BY log_date ASC""",
        [vid],
    )
    daily_logs = []
    for lr in log_rows:
        daily_logs.append({
            "date": str(lr[0])[:10],
            "daily_return": float(lr[1] or 0),
            "cumulative_return": float(lr[2] or 0),
            "mdd": float(lr[3] or 0),
            "win_rate": float(lr[4] or 0),
            "total_trades": int(lr[5] or 0),
        })

    # Current performance
    perf = await get_paper_performance()
    result_data = json_mod.loads(r[4]) if r[4] and isinstance(r[4], str) else {}

    # Benchmark comparison (KOSPI)
    benchmark_return = 0
    alpha = 0
    beta = 0
    info_ratio = 0
    bench_rows = await execute_query(
        "SELECT close_price FROM index_daily WHERE index_code = 'KOSPI' ORDER BY trade_date DESC FETCH FIRST 2 ROWS ONLY",
    )
    if bench_rows and len(bench_rows) >= 2:
        b_recent = float(bench_rows[0][0]) if bench_rows[0][0] else 0
        b_prev = float(bench_rows[1][0]) if bench_rows[1][0] else 0
        if b_prev > 0:
            benchmark_return = (b_recent - b_prev) / b_prev * 100

    strat_return = perf.get("total_return", 0)
    alpha = strat_return - benchmark_return

    # Rolling metrics
    equity_curve = perf.get("equity_curve", [])
    eq_vals = [pt["equity"] for pt in equity_curve]

    # Rolling Sharpe, Sortino (30-day)
    rolling_sharpe_list = []
    rolling_sortino_list = []
    window = min(30, max(len(eq_vals) - 1, 1))
    if len(eq_vals) > window + 5:
        for i in range(window, len(eq_vals)):
            chunk = [(eq_vals[j] - eq_vals[j - 1]) / eq_vals[j - 1] for j in range(i - window + 1, i + 1) if eq_vals[j - 1] > 0]
            if len(chunk) > 1:
                avg_r = sum(chunk) / len(chunk)
                var = sum((r - avg_r) ** 2 for r in chunk) / (len(chunk) - 1)
                std = var ** 0.5 if var > 0 else 0.0001
                rs = (avg_r / std) * (252 ** 0.5)
                rolling_sharpe_list.append(round(rs, 4))
                neg_returns = [r for r in chunk if r < 0]
                if neg_returns:
                    neg_var = sum(r ** 2 for r in neg_returns) / len(neg_returns)
                    neg_std = neg_var ** 0.5
                    rso = (avg_r / max(neg_std, 0.0001)) * (252 ** 0.5)
                    rolling_sortino_list.append(round(rso, 4))
                else:
                    rolling_sortino_list.append(0)

    # Rolling Win Rate (last 30 trades)
    trade_result_rows = await execute_query(
        """SELECT pnl_pct FROM paper_trades WHERE action = 'sell' ORDER BY trade_date DESC FETCH FIRST 50 ROWS ONLY""",
    )
    trade_pnls = [float(r[0]) for r in trade_result_rows if r[0] is not None]
    rolling_win_rates = []
    if len(trade_pnls) >= 10:
        tw = 30
        for i in range(min(tw, len(trade_pnls)), len(trade_pnls) + 1):
            chunk = trade_pnls[max(0, i - tw):i]
            rwr = sum(1 for p in chunk if p > 0) / max(len(chunk), 1) * 100
            rolling_win_rates.append(round(rwr, 1))

    # Rolling Profit Factor (last 30 trades)
    rolling_pf_list = []
    if len(trade_pnls) >= 10:
        tw = 30
        for i in range(min(tw, len(trade_pnls)), len(trade_pnls) + 1):
            chunk = trade_pnls[max(0, i - tw):i]
            gp = sum(p for p in chunk if p > 0)
            gl = abs(sum(p for p in chunk if p < 0))
            rpf = gp / max(gl, 0.0001)
            rolling_pf_list.append(round(rpf, 4))

    # Rolling MDD (trailing 30-day windows)
    rolling_mdd_list = []
    if len(eq_vals) >= 30:
        for i in range(30, len(eq_vals)):
            chunk_vals = eq_vals[i - 30:i + 1]
            pk = chunk_vals[0]
            m = 0
            for v in chunk_vals:
                if v > pk:
                    pk = v
                dd = (pk - v) / pk * 100
                if dd > m:
                    m = dd
            rolling_mdd_list.append(round(m, 2))

    # Monthly return summary with heatmap format
    monthly_returns = {}
    for pt in equity_curve:
        d = pt.get("date", "")[:7]
        eq = pt.get("equity", 0)
        if d not in monthly_returns or eq > monthly_returns[d]:
            monthly_returns[d] = eq
    monthly_list = []
    prev_eq = 10000000.0
    for m in sorted(monthly_returns.keys()):
        eq = monthly_returns[m]
        ret = (eq - prev_eq) / prev_eq * 100
        monthly_list.append({"month": m, "return": round(ret, 2)})
        prev_eq = eq

    # Monthly heatmap (year x month grid)
    monthly_heatmap = {}
    for item in monthly_list:
        parts = item["month"].split("-")
        if len(parts) == 2:
            yr, mo = parts
            if yr not in monthly_heatmap:
                monthly_heatmap[yr] = {}
            monthly_heatmap[yr][mo] = item["return"]

    # Alpha/Beta trend (monthly rolling)
    alpha_beta_trend = []
    if len(monthly_list) >= 3:
        monthly_rets = [m["return"] for m in monthly_list]
        bm_rets = [benchmark_return] * len(monthly_rets)
        if len(monthly_rets) >= 3:
            for i in range(2, len(monthly_rets)):
                chunk_ret = monthly_rets[i - 2:i + 1]
                chunk_bm = bm_rets[i - 2:i + 1]
                avg_r = sum(chunk_ret) / 3
                avg_bm = sum(chunk_bm) / 3
                b = 0
                num = sum((chunk_ret[j] - avg_r) * (chunk_bm[j] - avg_bm) for j in range(3))
                den = sum((chunk_bm[j] - avg_bm) ** 2 for j in range(3))
                if den > 0:
                    b = num / den
                a = avg_r - b * avg_bm
                alpha_beta_trend.append({
                    "month": monthly_list[i]["month"],
                    "alpha": round(a, 2),
                    "beta": round(b, 4),
                })

    return {
        "active": is_active,
        "validation_id": vid,
        "started_at": str(started) if started else "",
        "completed_at": str(r[3]) if r[3] else "",
        "progress": {
            "elapsed_days": round(elapsed_days, 1),
            "remaining_days": round(remaining_days, 1),
            "progress_pct": min(100, round(elapsed_days / 30 * 100, 1)),
        },
        "metrics": {
            "cumulative_return": perf.get("total_return", 0),
            "cagr": perf.get("cagr", 0),
            "max_drawdown": perf.get("max_drawdown", 0),
            "win_rate": perf.get("win_rate", 0),
            "profit_factor": perf.get("profit_factor", 0),
            "pf_grade": perf.get("pf_grade", "N/A"),
            "sharpe": perf.get("sharpe", 0),
            "sortino": perf.get("sortino", 0),
            "total_trades": perf.get("total_trades", 0),
            "open_positions": perf.get("open_positions", 0),
            "avg_holding_days": perf.get("average_holding_days", 0),
            "avg_trade_return": perf.get("average_trade_return", 0),
        },
        "advanced_metrics": {
            "alpha": round(alpha, 2),
            "beta": round(beta, 4),
            "benchmark_return": round(benchmark_return, 2),
            "information_ratio": round(info_ratio, 4),
            "rolling_sharpe_latest": rolling_sharpe_list[-1] if rolling_sharpe_list else 0,
            "rolling_sharpe_max": max(rolling_sharpe_list) if rolling_sharpe_list else 0,
            "rolling_sharpe_min": min(rolling_sharpe_list) if rolling_sharpe_list else 0,
            "rolling_sortino_latest": rolling_sortino_list[-1] if rolling_sortino_list else 0,
            "rolling_sortino_max": max(rolling_sortino_list) if rolling_sortino_list else 0,
            "rolling_win_rate_latest": rolling_win_rates[-1] if rolling_win_rates else 0,
            "rolling_pf_latest": rolling_pf_list[-1] if rolling_pf_list else 0,
            "rolling_mdd_latest": rolling_mdd_list[-1] if rolling_mdd_list else 0,
            "rolling_sharpe_series": rolling_sharpe_list,
            "rolling_sortino_series": rolling_sortino_list,
            "rolling_win_rate_series": rolling_win_rates,
            "rolling_pf_series": rolling_pf_list,
            "rolling_mdd_series": rolling_mdd_list,
        },
        "equity_curve": equity_curve,
        "drawdown_curve": perf.get("drawdown_curve", []),
        "monthly_returns": monthly_list,
        "monthly_heatmap": monthly_heatmap,
        "alpha_beta_trend": alpha_beta_trend,
        "daily_logs": daily_logs,
        "readiness": result_data.get("verdict", "FAIL"),
        "checks": result_data.get("checks", {}),
        "checks_passed": result_data.get("checks_passed", 0),
        "checks_total": result_data.get("checks_total", 7),
    }


# ── 12. P5: Enhanced Readiness with Score ──────────────────────


async def check_live_trading_readiness() -> dict:
    """Enhanced readiness check with numeric score and gap analysis."""
    validation = await get_validation_status()

    result = validation.get("result", {})
    if validation.get("is_active"):
        result = await _compute_validation_report()

    checks = result.get("checks", {})
    checks_passed = sum(1 for v in checks.values() if v)
    checks_total = len(checks)

    # Validation session timing
    vrows = await execute_query(
        """SELECT id, is_active, started_at, completed_at, result
           FROM validation_mode ORDER BY id DESC FETCH FIRST 1 ROW ONLY""",
    )
    started = vrows[0][2] if vrows else None
    now_utc2 = datetime.now(timezone.utc)
    elapsed_days = 0
    if started:
        if hasattr(started, 'tzinfo') and started.tzinfo is None:
            started_dt = started.replace(tzinfo=timezone.utc)
        else:
            started_dt = started
        elapsed_days = (now_utc2 - started_dt).total_seconds() / 86400

    # Portfolio-level metrics for enhanced readiness
    rows_exp = await execute_query("SELECT COALESCE(SUM(quantity * current_price), 0) FROM paper_positions WHERE status = 'open'")
    current_exposure = float(rows_exp[0][0]) if rows_exp else 0
    initial_capital = 10000000.0
    exposure_pct = current_exposure / initial_capital * 100
    cash_ratio = max(0, (initial_capital - current_exposure) / initial_capital * 100)

    rows_sell = await execute_query("SELECT COUNT(*) FROM paper_trades WHERE action = 'sell'")
    sell_trades = int(rows_sell[0][0]) if rows_sell else 0
    closed_trades_cnt = sell_trades

    validation_days = elapsed_days if started else 0

    thresholds = {
        "fitness_gt_50": {"current": result.get("fitness", 0), "target": 50, "label": "fitness"},
        "return_gt_kospi": {"current": result.get("total_return", 0), "target": result.get("benchmark_return", 0), "label": "total_return > benchmark"},
        "win_rate_gt_50": {"current": result.get("win_rate", 0), "target": 50, "label": "win_rate"},
        "profit_factor_gt_1_5": {"current": result.get("profit_factor", 0), "target": 1.5, "label": "profit_factor"},
        "sharpe_gt_1_0": {"current": result.get("sharpe", 0), "target": 1.0, "label": "sharpe"},
        "mdd_lt_20": {"current": result.get("max_drawdown", 0), "target": 20, "label": "max_drawdown"},
        "trades_gt_50": {"current": result.get("total_trades", 0), "target": 50, "label": "total_trades"},
        "sell_trades_gte_30": {"current": sell_trades, "target": 30, "label": "sell_trades"},
        "exposure_lte_90": {"current": exposure_pct, "target": 90, "label": "exposure_pct"},
        "cash_ratio_gte_10": {"current": cash_ratio, "target": 10, "label": "cash_ratio"},
        "closed_trades_gte_30": {"current": closed_trades_cnt, "target": 30, "label": "closed_trades"},
        "validation_days_gte_30": {"current": validation_days, "target": 30, "label": "validation_days"},
        "benchmark_outperformance_gte_3": {"current": result.get("total_return", 0) - result.get("benchmark_return", 0), "target": 3, "label": "benchmark_outperformance"},
    }

    gaps = {}
    for key, th in thresholds.items():
        passed = checks.get(key, False)
        gap = max(0, th["target"] - th["current"]) if th["target"] > 0 else 0
        pct = min(100, th["current"] / th["target"] * 100) if th["target"] > 0 else 0
        if key == "mdd_lt_20":
            passed = th["current"] < 20
            gap = max(0, th["current"] - th["target"])
            pct = min(100, (1 - th["current"] / 100) * 100) if th["current"] > 0 else 100
        if key == "exposure_lte_90":
            passed = th["current"] <= th["target"]
            gap = max(0, th["current"] - th["target"])
            pct = max(0, min(100, (1 - th["current"] / 100) * 100))
        if key == "cash_ratio_gte_10":
            passed = th["current"] >= th["target"]
            gap = max(0, th["target"] - th["current"])
            pct = min(100, th["current"] / th["target"] * 100)
        if key == "sell_trades_gte_30":
            passed = th["current"] >= th["target"]
            gap = max(0, th["target"] - th["current"])
            pct = min(100, th["current"] / th["target"] * 100)
        if key == "closed_trades_gte_30":
            passed = th["current"] >= th["target"]
            gap = max(0, th["target"] - th["current"])
            pct = min(100, th["current"] / th["target"] * 100)
        gaps[key] = {
            "passed": passed,
            "current": round(th["current"], 2),
            "target": th["target"],
            "gap": round(gap, 2),
            "progress_pct": round(pct, 1),
        }

    # Score 0-100
    condition_scores = {}
    for key, g in gaps.items():
        if g["passed"]:
            condition_scores[key] = 100
        else:
            condition_scores[key] = round(g["progress_pct"], 1)
    readiness_score = round(sum(condition_scores.values()) / max(len(condition_scores), 1), 1)

    if readiness_score >= 80:
        score_grade = "PASS"
    elif readiness_score >= 50:
        score_grade = "WATCH"
    else:
        score_grade = "FAIL"

    all_pass = result.get("verdict") == "PASS" and sell_trades >= 30 and exposure_pct <= 90 and cash_ratio >= 10
    performance = await get_paper_performance()

    # Estimated achievement dates
    now_dt = datetime.now(timezone.utc)
    estimates = {}
    total_trades = performance.get("total_trades", 0)
    win_rate = performance.get("win_rate", 0)
    total_return = performance.get("total_return", 0)

    # Elapsed days since first trade
    first_trade_row = await execute_query("SELECT MIN(trade_date) FROM paper_trades")
    elapsed_days_from_start = 1
    if first_trade_row and first_trade_row[0][0]:
        ft_date = first_trade_row[0][0]
        if hasattr(ft_date, 'tzinfo'):
            ft_dt = ft_date if ft_date.tzinfo else ft_date.replace(tzinfo=timezone.utc)
            elapsed_days_from_start = max(1, (now_dt - ft_dt).total_seconds() / 86400)

    # Trades estimation: current pace = total_trades / elapsed_days → target 50
    trades_needed = max(0, 50 - total_trades)
    pace = max(total_trades, 1) / max(elapsed_days_from_start, 1)
    if pace > 0:
        est_days = trades_needed / pace
        est_date = now_dt + timedelta(days=int(est_days))
        estimates["trades_gt_50"] = {
            "current": total_trades, "target": 50, "needed": trades_needed,
            "pace_per_day": round(pace, 1), "estimated_days": round(est_days, 1),
            "estimated_date": str(est_date.date()),
        }
    else:
        estimates["trades_gt_50"] = {"current": total_trades, "target": 50, "needed": trades_needed, "pace_per_day": 0, "estimated_days": 999, "estimated_date": "N/A"}

    # Sell trades estimation
    sell_needed = max(0, 30 - sell_trades)
    estimates["sell_trades_gte_30"] = {
        "current": sell_trades, "target": 30, "needed": sell_needed,
        "estimated_date": "After first exit cycle" if sell_trades == 0 else "With next exits",
    }

    # Exposure estimation
    estimates["exposure_lte_90"] = {
        "current": round(exposure_pct, 1), "target": 90,
        "reduction_needed": round(max(0, exposure_pct - 90), 1),
        "estimated_date": "After stall_exit cleanup (26 positions)" if exposure_pct > 90 else "Met",
    }

    # Win rate estimation: based on last 10 trades trend
    rows_tr = await execute_query(
        "SELECT pnl_pct FROM paper_trades WHERE action = 'sell' ORDER BY trade_date DESC FETCH FIRST 10 ROWS ONLY",
    )
    recent_wr = 50.0
    if rows_tr:
        recent_wins = sum(1 for r in rows_tr if r[0] and float(r[0]) > 0)
        recent_wr = recent_wins / len(rows_tr) * 100
    wr_gap = max(0, 50 - win_rate)
    estimates["win_rate_gt_50"] = {
        "current": win_rate, "target": 50, "gap": round(wr_gap, 1),
        "recent_10_wr": round(recent_wr, 1),
        "estimated_date": "Improve trade quality" if recent_wr < 50 else "Trending positively",
    }

    checks_total = len(thresholds)
    return {
        "ready": all_pass,
        "readiness_score": readiness_score,
        "score_grade": score_grade,
        "verdict": result.get("verdict", "FAIL"),
        "summary": f"{checks_passed}/{checks_total} conditions met (score {readiness_score}/100 - {score_grade})",
        "gaps": gaps,
        "estimates": estimates,
        "performance": {
            "total_return": round(performance.get("total_return", 0), 2),
            "cagr": round(performance.get("cagr", 0), 2),
            "sharpe": round(performance.get("sharpe", 0), 4),
            "sortino": round(performance.get("sortino", 0), 4),
            "max_drawdown": round(performance.get("max_drawdown", 0), 2),
            "win_rate": round(performance.get("win_rate", 0), 2),
            "profit_factor": round(performance.get("profit_factor", 0), 4),
            "pf_grade": performance.get("pf_grade", "N/A"),
            "fitness": result.get("fitness", 0),
            "total_trades": performance.get("total_trades", 0),
            "sell_trades": sell_trades,
            "exposure_pct": round(exposure_pct, 1),
            "cash_ratio": round(cash_ratio, 1),
            "benchmark_return": result.get("benchmark_return", 0),
            "alpha": result.get("alpha", 0),
        },
        "checks_passed": checks_passed,
        "checks_total": checks_total,
    }


# ── 13. P6: Integration Dashboard ───────────────────────────────


async def get_integration_dashboard() -> dict:
    """Unified dashboard aggregating evolution, portfolio, risk, validation, paper trading status."""
    from app.strategy_evolution.database import get_evolution_status

    # Evolution
    evo = await get_evolution_status()
    evo_dash = await get_evolution_dashboard()

    # Portfolio
    health = await get_portfolio_health()

    # Risk
    risk = await check_risk_limits()

    # Validation
    validation = await get_validation_status()
    vd = await get_validation_dashboard()

    # Paper Trading
    perf = await get_paper_performance()

    # Readiness
    readiness = await check_live_trading_readiness()

    now_utc = datetime.now(timezone.utc)
    try:
        from app.utils.timezone import to_kst
        now_kst = to_kst(now_utc)
    except Exception:
        now_kst = now_utc

    # Last trade time
    rows = await execute_query("SELECT MAX(trade_date) FROM paper_trades WHERE action = 'sell'")
    last_sell = str(rows[0][0])[:19] if rows and rows[0][0] else "N/A"

    rows = await execute_query("SELECT MIN(trade_date) FROM paper_trades")
    first_trade = str(rows[0][0])[:19] if rows and rows[0][0] else "N/A"

    # Latest strategy performance
    sp_rows = await execute_query(
        """SELECT fitness_score, max_drawdown, generation FROM strategy_performance
           ORDER BY generation DESC FETCH FIRST 1 ROW ONLY""",
    )
    latest_pf = float(sp_rows[0][0]) if sp_rows and sp_rows[0][0] else 0
    latest_mdd = float(sp_rows[0][1]) if sp_rows and sp_rows[0][1] else 0
    latest_gen = int(sp_rows[0][2]) if sp_rows and sp_rows[0][2] else 0

    # Paper trading metrics — compute cash ratio from actual exposure (same formula as check_risk_limits)
    initial_cap = 10000000
    current_exposure_amount = risk.get("total_exposure", 0)
    cash_ratio_pct = max(0, (initial_cap - current_exposure_amount) / initial_cap * 100)
    exposure_pct = current_exposure_amount / initial_cap * 100

    # Sell trades
    sell_rows = await execute_query("SELECT COUNT(*) FROM paper_trades WHERE action = 'sell'")
    sell_trades_cnt = int(sell_rows[0][0]) if sell_rows else 0

    return {
        "timestamp_kst": str(now_kst)[:19],
        "generation": {
            "current": evo.current_generation or 0,
            "status": "RUNNING" if evo.is_running == "Y" else "IDLE",
            "last_run": str(evo.last_run_at)[:19] if evo.last_run_at else None,
            "next_scheduled": str(evo.next_scheduled_run)[:19] if evo.next_scheduled_run else None,
            "population": evo_dash.get("population_size", 0),
            "latest_generation": latest_gen,
        },
        "portfolio": {
            "total_return": health.get("portfolio_return", 0),
            "mdd": health.get("portfolio_mdd", 0),
            "sharpe": health.get("portfolio_sharpe", 0),
            "cagr": health.get("portfolio_cagr", 0),
            "profit_factor": health.get("portfolio_profit_factor", 0),
            "pf_grade": health.get("pf_grade", "N/A"),
            "approved_strategies": health.get("approved_strategies", 0),
            "latest_pf": latest_pf,
            "latest_mdd": latest_mdd,
        },
        "risk": {
            "status": risk.get("risk_status", "PASS"),
            "blocked": risk.get("blocked", False),
            "reasons": risk.get("reasons", []),
            "warnings": risk.get("warnings", []),
            "cash_ratio": round(cash_ratio_pct, 1),
            "open_positions": risk.get("open_positions", 0),
            "mdd": risk.get("portfolio_mdd", 0),
            "exposure_pct": round(exposure_pct, 1),
            "max_capital_deployment": risk.get("max_capital_deployment", 100),
        },
        "paper_trading": {
            "total_return": perf.get("total_return", 0),
            "total_pnl": perf.get("total_pnl", 0),
            "win_rate": perf.get("win_rate", 0),
            "profit_factor": perf.get("profit_factor", 0),
            "pf_grade": perf.get("pf_grade", "N/A"),
            "total_trades": perf.get("total_trades", 0),
            "sell_trades": sell_trades_cnt,
            "open_positions": perf.get("open_positions", 0),
            "cash_ratio": round(cash_ratio_pct, 1),
            "exposure_pct": round(exposure_pct, 1),
            "first_trade": first_trade,
            "last_sell_trade": last_sell,
        },
        "validation": {
            "active": validation.get("is_active", False),
            "started_at": validation.get("started_at", "")[:19] if validation.get("started_at") else None,
            "progress": vd.get("progress", {}),
            "metrics": vd.get("metrics", {}),
            "advanced_metrics": vd.get("advanced_metrics", {}),
            "daily_logs": vd.get("daily_logs", []),
            "monthly_heatmap": vd.get("monthly_heatmap", {}),
            "alpha_beta_trend": vd.get("alpha_beta_trend", []),
        },
        "readiness": {
            "score": readiness.get("readiness_score", 0),
            "grade": readiness.get("score_grade", "FAIL"),
            "verdict": readiness.get("verdict", "FAIL"),
            "passed": readiness.get("checks_passed", 0),
            "total": readiness.get("checks_total", 13),
            "gaps": readiness.get("gaps", {}),
        },
        "system": {
            "exposure_pct": round(exposure_pct, 1),
            "cash_ratio_pct": round(cash_ratio_pct, 1),
            "open_positions": perf.get("open_positions", 0),
            "sell_trades": sell_trades_cnt,
            "risk_status": risk.get("risk_status", "PASS"),
            "validation_active": validation.get("is_active", False),
            "validation_progress_pct": vd.get("progress", {}).get("progress_pct", 0),
            "readiness_score": readiness.get("readiness_score", 0),
        },
    }



