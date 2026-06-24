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
    }
    return defaults


async def update_risk_setting(key: str, value) -> dict:
    await update_setting(key, value, "number" if isinstance(value, (int, float)) else "string")
    return await get_risk_settings()


async def check_risk_limits() -> dict:
    settings = await get_risk_settings()
    daily_loss_limit = float(settings.get("daily_loss_limit", 5))
    daily_profit_lock = float(settings.get("daily_profit_lock", 10))
    blocked = False
    reasons = []

    rows = await execute_query("SELECT COUNT(*) FROM paper_positions WHERE status = 'open'")
    open_positions = int(rows[0][0]) if rows else 0

    rows = await execute_query(
        "SELECT COALESCE(SUM(pnl_amt), 0), COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell' AND trade_date >= TRUNC(CURRENT_TIMESTAMP)",
    )
    today_pnl = float(rows[0][0]) if rows else 0
    initial_capital = 10000000.0
    today_pnl_pct = (today_pnl / initial_capital) * 100

    if daily_loss_limit > 0 and today_pnl_pct <= -daily_loss_limit:
        blocked = True
        reasons.append(f"Daily loss limit: {today_pnl_pct:.2f}% <= -{daily_loss_limit}%")
        await add_system_log("RISK", "check_risk_limits", f"Daily loss limit breached: {today_pnl_pct:.2f}%")

    if daily_profit_lock > 0 and today_pnl_pct >= daily_profit_lock:
        blocked = True
        reasons.append(f"Daily profit lock: {today_pnl_pct:.2f}% >= {daily_profit_lock}%")
        await add_system_log("RISK", "check_risk_limits", f"Daily profit lock triggered: {today_pnl_pct:.2f}%")

    # Compute current drawdown from portfolio backtest
    rows = await execute_query("SELECT COALESCE(MAX(mdd), 0) FROM portfolio_backtest")
    portfolio_mdd = float(rows[0][0]) if rows else 0

    return {
        "blocked": blocked,
        "reasons": reasons,
        "today_pnl_pct": round(today_pnl_pct, 2),
        "open_positions": open_positions,
        "portfolio_mdd": round(abs(portfolio_mdd), 2),
        "risk_status": "BLOCKED" if blocked else "PASS",
    }


# ── 2. Portfolio Auto Promotion (with replacement) ─────────────


async def auto_promote_strategies() -> dict:
    """Promote candidates meeting fitness >= 50, win_rate >= 45, trades >= 30.
    If approved count < 5, auto-promote. If a candidate has higher fitness
    than an existing approved strategy, swap them."""
    candidates = await execute_query(
        """SELECT ps.id, ps.strategy_id, ps.generation, pf.fitness_score, pf.win_rate, pf.total_trades, pf.max_drawdown
           FROM portfolio_strategy ps
           JOIN strategy_performance pf ON pf.strategy_id = ps.strategy_id
             AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = ps.strategy_id)
           WHERE ps.status = 'candidate'
           ORDER BY pf.fitness_score DESC""",
    )
    approved = await execute_query(
        """SELECT ps.id, ps.strategy_id, pf.fitness_score
           FROM portfolio_strategy ps
           JOIN strategy_performance pf ON pf.strategy_id = ps.strategy_id
             AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = ps.strategy_id)
           WHERE ps.status = 'approved'
           ORDER BY pf.fitness_score DESC""",
    )
    promoted = 0
    demoted = 0
    swapped = 0

    eligible = [
        c for c in candidates
        if float(c[3] or 0) >= 50 and float(c[4] or 0) >= 45 and int(c[5] or 0) >= 30
    ]

    for c in eligible:
        pid, sid, gen, fitness, wr, trades, mdd = c[0], c[1], c[2], float(c[3] or 0), float(c[4] or 0), int(c[5] or 0), float(c[6] or 0)

        if len(approved) < 5:
            # Promote directly
            await _set_strategy_status(pid, sid, "candidate", "approved", f"Auto-promote fitness={fitness:.1f}")
            approved.append((pid, sid, fitness))
            approved.sort(key=lambda x: -x[2])
            promoted += 1
            logger.info("[AUTO-PROMOTION] Strategy %d promoted (fitness=%.1f wr=%.1f mdd=%.1f)", sid, fitness, wr, abs(mdd))
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
           JOIN strategy_performance pf ON pf.strategy_id = ps.strategy_id
             AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = ps.strategy_id)
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

    rows = await execute_query("SELECT COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell' AND pnl_amt > 0")
    gross_profit = float(rows[0][0]) if rows else 0

    rows = await execute_query("SELECT COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell' AND pnl_amt <= 0")
    gross_loss = abs(float(rows[0][0]) if rows else 0)

    profit_factor = (gross_profit / max(gross_loss, 0.01)) if gross_loss > 0 else (gross_profit or 0)

    initial_capital = 10000000.0
    total_return = (total_pnl / initial_capital) * 100

    rows = await execute_query("SELECT COALESCE(AVG(EXTRACT(DAY FROM (exit_date - entry_date))), 0) FROM paper_positions WHERE status = 'closed'")
    avg_holding_days = float(rows[0][0]) if rows else 0

    # Period filter for daily returns
    date_filter = ""
    if period == "7D":
        date_filter = "AND trade_date >= CURRENT_TIMESTAMP - INTERVAL '7' DAY"
    elif period == "30D":
        date_filter = "AND trade_date >= CURRENT_TIMESTAMP - INTERVAL '30' DAY"
    elif period == "90D":
        date_filter = "AND trade_date >= CURRENT_TIMESTAMP - INTERVAL '90' DAY"

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

    return {
        "total_return": round(total_return, 2),
        "cagr": round(cagr, 2),
        "sharpe": round(sharpe, 4),
        "sortino": round(sortino, 4),
        "max_drawdown": round(mdd, 2),
        "win_rate": round(win_rate, 2),
        "profit_factor": round(profit_factor, 4),
        "average_trade_return": round(avg_trade_return, 2),
        "average_holding_days": round(avg_holding_days, 1),
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
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

    rows = await execute_query("SELECT return_pct, mdd, sharpe_ratio, cagr FROM portfolio_backtest ORDER BY id DESC FETCH FIRST 1 ROW ONLY")
    bt = rows[0] if rows else None
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

    checks = {
        "return_gt_kospi": perf.get("total_return", 0) > benchmark_return,
        "alpha_gt_5": alpha > 5,
        "win_rate_gt_50": win_rate > 50,
        "profit_factor_gt_1_2": profit_factor > 1.2,
        "sharpe_gt_1_0": sharpe > 1.0,
        "mdd_lt_20": mdd < 20,
    }
    all_pass = all(checks.values())

    if all_pass:
        verdict = "PASS"
    elif sum(1 for v in checks.values() if v) >= 4:
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
        "total_trades": perf.get("total_trades", 0),
        "checks": checks,
    }


# ── 10. Live Trading Readiness ─────────────────────────────────


async def check_live_trading_readiness() -> dict:
    """Check all conditions for live trading readiness.
    Must have 30-day paper trading validation with PASS verdict."""
    validation = await get_validation_status()
    if not validation.get("is_active") and not validation.get("result"):
        return {
            "ready": False,
            "reason": "No 30-day validation completed. Start validation mode first.",
            "checks": {},
        }

    result = validation.get("result", {})
    if validation.get("is_active"):
        # Compute current readiness from live performance
        result = await _compute_validation_report()

    checks = result.get("checks", {})
    all_pass = result.get("verdict") == "PASS"

    return {
        "ready": all_pass,
        "verdict": result.get("verdict", "FAIL"),
        "reason": "All conditions met" if all_pass else f"{sum(1 for v in checks.values() if v)}/6 conditions met",
        "result": {
            "total_return": result.get("total_return", 0),
            "benchmark_return": result.get("benchmark_return", 0),
            "alpha": result.get("alpha", 0),
            "cagr": result.get("cagr", 0),
            "sharpe": result.get("sharpe", 0),
            "max_drawdown": result.get("max_drawdown", 0),
            "win_rate": result.get("win_rate", 0),
            "profit_factor": result.get("profit_factor", 0),
        },
        "checks": checks,
    }
