from __future__ import annotations

import json
import time
import traceback
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.database import execute_query, execute_non_query
from app.services.service_db import get_settings, update_setting, add_system_log
from app.services.operations_service import auto_promote_strategies, get_portfolio_health

logger = logging.getLogger(__name__)

PIPELINE_STEPS = ["evolution", "portfolio_backtest", "ranking", "auto_promotion", "paper_trading", "survivor_selection", "shadow_trading", "promote_production"]

_locked = False


async def ensure_automation_tables():
    from app.database import acquire_conn
    ddl = """CREATE TABLE IF NOT EXISTS automation_pipeline_log (
        id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP,
        step VARCHAR2(50) NOT NULL,
        status VARCHAR2(20) NOT NULL,
        duration_ms NUMBER(12),
        message VARCHAR2(1000),
        details_json CLOB,
        pipeline_run_id VARCHAR2(100)
    )"""
    conn = await acquire_conn()
    try:
        conn.cursor().execute(ddl)
        conn.commit()
    finally:
        conn.close()


async def _log_step(step: str, status: str, message: str = "", details: dict = None, duration_ms: int = None, run_id: str = ""):
    await execute_non_query(
        """INSERT INTO automation_pipeline_log (step, status, message, details_json, duration_ms, pipeline_run_id)
           VALUES (:1, :2, :3, :4, :5, :6)""",
        [step, status, message[:1000], json.dumps(details or {}), duration_ms, run_id],
    )


async def get_pipeline_config() -> dict:
    raw = await get_settings()
    return {
        "enabled": str(raw.get("pipeline_enabled", "true")).lower() == "true",
        "auto_promotion_enabled": str(raw.get("auto_promotion_enabled", "true")).lower() == "true",
        "min_fitness": float(raw.get("pipeline_min_fitness", 50)),
        "min_profit_factor": float(raw.get("pipeline_min_profit_factor", 1.3)),
        "max_drawdown": float(raw.get("pipeline_max_drawdown", 20)),
        "min_trade_count": int(raw.get("pipeline_min_trade_count", 30)),
        "min_win_rate": float(raw.get("pipeline_min_win_rate", 45)),
        "max_active_strategies": int(raw.get("pipeline_max_active_strategies", 5)),
        "backtest_period": raw.get("pipeline_backtest_period", "1y"),
        "evaluation_interval_hours": int(raw.get("pipeline_evaluation_interval_hours", 24)),
        "survivor_enabled": str(raw.get("survivor_enabled", "true")).lower() == "true",
        "auto_production_enabled": str(raw.get("auto_production_enabled", "false")).lower() == "true",
        "survivor_min_days": int(raw.get("survivor_min_days", 7)),
        "survivor_min_score": float(raw.get("survivor_min_score", 0.5)),
        "paper_trading_min_trades": int(raw.get("survivor_min_trades", 10)),
    }


async def update_pipeline_config(key: str, value) -> dict:
    typ = "number" if isinstance(value, (int, float)) else "boolean" if isinstance(value, bool) else "string"
    await update_setting(key, value, typ)
    return await get_pipeline_config()


async def get_pipeline_logs(limit: int = 50) -> list[dict]:
    rows = await execute_query(
        """SELECT id, started_at, finished_at, step, status, duration_ms, message, details_json, pipeline_run_id
           FROM automation_pipeline_log ORDER BY id DESC""",
    )
    result = []
    for r in rows[:limit]:
        started = r[1].isoformat() if hasattr(r[1], 'isoformat') else str(r[1]) if r[1] else ""
        finished = r[2].isoformat() if r[2] and hasattr(r[2], 'isoformat') else (str(r[2]) if r[2] else "")
        result.append({
            "id": r[0], "started_at": started, "finished_at": finished,
            "step": r[3], "status": r[4], "duration_ms": r[5],
            "message": r[6] or "", "details": r[7] or "{}",
            "pipeline_run_id": r[8] or "",
        })
    return result


async def get_pipeline_status() -> dict:
    rows = await execute_query(
        "SELECT step, status, started_at FROM automation_pipeline_log WHERE id IN (SELECT MAX(id) FROM automation_pipeline_log GROUP BY step) ORDER BY started_at DESC",
    )
    steps = {}
    for r in rows:
        steps[r[0]] = {"status": r[1], "started_at": r[2].isoformat() if hasattr(r[2], 'isoformat') else str(r[2]) if r[2] else ""}

    latest_run = await execute_query(
        "SELECT pipeline_run_id, status FROM automation_pipeline_log WHERE pipeline_run_id IS NOT NULL AND pipeline_run_id != '' ORDER BY id DESC",
    )
    last_status = latest_run[0][1] if latest_run else "never"
    last_run_id = latest_run[0][0] if latest_run else ""

    portfolio = await get_portfolio_health()
    config = await get_pipeline_config()

    approved_count = await execute_query(
        "SELECT COUNT(*) FROM portfolio_strategy WHERE status = 'approved'",
    )
    survival_counts = {}
    for stage in ["paper_trading", "survivor", "production_candidate", "production", "failed", "retired"]:
        c = await execute_query("SELECT COUNT(*) FROM portfolio_strategy WHERE status = :1", [stage])
        survival_counts[stage] = int(c[0][0]) if c else 0
    evolution_status = None
    try:
        from app.routers.evolution import get_orch
        ev = await get_orch().get_status()
        evolution_status = {"current_generation": ev.current_generation, "status": ev.status, "last_run": ev.last_run_at}
    except Exception:
        pass

    return {
        "locked": _locked,
        "last_run_id": last_run_id,
        "last_status": last_status,
        "steps": steps,
        "evolution": evolution_status,
        "approved_strategies": int(approved_count[0][0]) if approved_count else 0,
        "survival_counts": survival_counts,
        "portfolio_health": {
            "total_return": portfolio.get("total_return"),
            "cagr": portfolio.get("cagr"),
            "max_drawdown": portfolio.get("mdd"),
            "sharpe_ratio": portfolio.get("sharpe"),
            "profit_factor": portfolio.get("profit_factor"),
            "win_rate": portfolio.get("win_rate"),
            "grade": portfolio.get("pf_grade", "N/A"),
        },
        "config": config,
    }


async def _get_latest_fitness(strategy_id: int) -> dict:
    rows = await execute_query(
        """SELECT fitness_score, total_return, win_rate, total_trades, max_drawdown, profit_factor, sharpe_ratio, cagr
           FROM strategy_performance WHERE strategy_id = :1 ORDER BY generation DESC""",
        [strategy_id],
    )
    if rows:
        r = rows[0]
        return {"fitness": r[0] or 0, "return": r[1] or 0, "win_rate": r[2] or 0,
                "trades": r[3] or 0, "mdd": r[4] or 0, "profit_factor": r[5] or 0,
                "sharpe": r[6] or 0, "cagr": r[7] or 0}
    return {}


async def _step_evolution() -> dict:
    from app.routers.evolution import get_orch
    orch = get_orch()
    status = await orch.get_status()
    if getattr(status, "is_running", False):
        return {"status": "SKIPPED", "message": "Evolution already running"}
    result = await orch.manual_run_generation()
    gen = getattr(result, "current_generation", None) or 0
    err = getattr(result, "status", None)
    ok = err and "error" not in str(err)
    return {"status": "SUCCESS" if ok else "FAILED",
            "message": f"Generation {gen} completed" if ok else f"Evolution failed: {err}",
            "details": {"generation": gen}}


async def _step_portfolio_backtest() -> dict:
    row = await execute_query(
        "SELECT COUNT(*) FROM portfolio_strategy WHERE status IN ('approved', 'candidate')",
    )
    count = int(row[0][0]) if row else 0
    if count == 0:
        return {"status": "SKIPPED", "message": "No strategies in portfolio"}

    from fastapi import HTTPException
    from app.routers.portfolio_api import run_portfolio_backtest as _route_handler
    config = await get_pipeline_config()
    data = {
        "period": config["backtest_period"],
        "initial_capital": 10000000,
        "strategy_limit": config["max_active_strategies"],
        "slippage_pct": 0.05,
        "commission_pct": 0.015,
        "tax_pct": 0.18,
        "universe": "ALL",
    }
    try:
        result = await _route_handler(data)
        return {"status": "SUCCESS", "message": f"Backtest: return={result.get('return_pct', 0):.1f}%",
                "details": {"return_pct": result.get("return_pct"), "strategies_tested": result.get("strategies_tested")}}
    except HTTPException as e:
        return {"status": "FAILED", "message": f"Backtest error: {e.detail}", "details": {"status_code": e.status_code}}
    except Exception as e:
        return {"status": "FAILED", "message": f"Backtest error: {str(e)[:200]}", "details": {"error": str(e)[:500]}}


async def _step_ranking() -> dict:
    candidates = await execute_query(
        """SELECT ps.id, ps.strategy_id, ps.generation
           FROM portfolio_strategy ps
           WHERE ps.status IN ('approved', 'candidate')
           ORDER BY ps.created_at DESC""",
    )
    if not candidates:
        return {"status": "SKIPPED", "message": "No strategies to rank"}

    ranked = []
    for c in candidates:
        pf = await _get_latest_fitness(c[1])
        ranked.append({"id": c[0], "strategy_id": c[1], "generation": c[2], **pf})
    ranked.sort(key=lambda x: x.get("fitness", 0), reverse=True)

    config = await get_pipeline_config()
    eligible = [r for r in ranked if
                r.get("fitness", 0) >= config["min_fitness"] and
                r.get("profit_factor", 0) >= config["min_profit_factor"] and
                abs(r.get("mdd", 0)) <= config["max_drawdown"] and
                r.get("trades", 0) >= config["min_trade_count"] and
                r.get("win_rate", 0) >= config["min_win_rate"]]

    await add_system_log("info", "pipeline_ranking",
        f"Ranked {len(ranked)} strategies, {len(eligible)} eligible", {})
    top = ranked[0].get("fitness", 0) if ranked else 0
    return {"status": "SUCCESS", "message": f"Ranked {len(ranked)} strategies, {len(eligible)} eligible",
            "details": {"total": len(ranked), "eligible": len(eligible), "top_fitness": top}}


async def _step_auto_promotion() -> dict:
    config = await get_pipeline_config()
    if not config["auto_promotion_enabled"]:
        return {"status": "SKIPPED", "message": "Auto-promotion disabled in config"}

    result = await auto_promote_strategies()
    p = result.get("promoted", 0)
    s = result.get("swapped", 0)
    return {"status": "SUCCESS" if p > 0 or s > 0 else "SKIPPED",
            "message": f"Promoted={p} Swapped={s} Demoted={result.get('demoted',0)}",
            "details": result}


async def _step_paper_trading() -> dict:
    now_kst = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=9)))
    if now_kst.weekday() >= 5:
        return {"status": "SKIPPED", "message": "Weekend - market closed"}
    if now_kst.hour < 9 or now_kst.hour >= 15:
        return {"status": "SKIPPED", "message": "Outside market hours (09:00-15:00 KST)"}

    from app.services.paper_trading_service import run_paper_trading_cycle, list_sessions
    sessions = await list_sessions()
    auto_sessions = [s for s in sessions if s["status"] == "active" and s.get("auto_mode")]
    if not auto_sessions:
        return {"status": "SKIPPED", "message": "No active auto-mode sessions"}

    results = []
    for sess in auto_sessions:
        try:
            r = await run_paper_trading_cycle(session_id=sess["id"])
            results.append({"session_id": sess["id"], "entries": r.get("entries_executed", 0), "exits": r.get("exits_executed", 0)})
        except Exception as e:
            results.append({"session_id": sess["id"], "error": str(e)[:200]})

    return {"status": "SUCCESS", "message": f"Paper trading: {len(results)} sessions",
            "details": {"sessions": results}}


async def _step_survivor_selection() -> dict:
    from app.services.survivor_service import evaluate_survivors, evaluate_production_candidates
    eval_result = await evaluate_survivors()
    cand_result = await evaluate_production_candidates()
    return {"status": "SUCCESS" if eval_result.get("status") != "FAILED" else "FAILED",
            "message": f"Survivors: {eval_result.get('promoted_to_survivor',0)} promoted, {eval_result.get('demoted',0)} eliminated | Candidates: {cand_result.get('promoted_to_candidate',0)} promoted",
            "details": {"survivor_eval": eval_result, "candidate_eval": cand_result}}


async def _step_shadow_trading() -> dict:
    from app.services.shadow_trading_service import list_shadow_sessions
    sessions = await list_shadow_sessions(status="active")
    if not sessions:
        return {"status": "SKIPPED", "message": "No active shadow sessions"}
    return {"status": "SUCCESS",
            "message": f"Shadow trading: {len(sessions)} active sessions monitored. Auto-promotion disabled - requires manual admin approval.",
            "details": {"active_sessions": len(sessions), "auto_promotion": False}}


async def _step_promote_production() -> dict:
    return {
        "status": "WAITING_MANUAL_APPROVAL",
        "message": "Production promotion requires manual admin approval. Use /api/production/promote-to-production.",
        "details": {"auto_promotion_disabled": True},
    }


_STEP_FUNCS = {
    "evolution": _step_evolution,
    "portfolio_backtest": _step_portfolio_backtest,
    "ranking": _step_ranking,
    "auto_promotion": _step_auto_promotion,
    "paper_trading": _step_paper_trading,
    "survivor_selection": _step_survivor_selection,
    "shadow_trading": _step_shadow_trading,
    "promote_production": _step_promote_production,
}


async def run_pipeline(start_step: str = "portfolio_backtest") -> dict:
    global _locked
    if _locked:
        return {"status": "FAILED", "message": "Pipeline already running (locked)"}

    _locked = True
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    results = {}
    overall_status = "SUCCESS"

    try:
        start_idx = PIPELINE_STEPS.index(start_step) if start_step in PIPELINE_STEPS else 0
        for step in PIPELINE_STEPS[start_idx:]:
            step_start = time.time()
            try:
                func = _STEP_FUNCS.get(step)
                if not func:
                    results[step] = {"status": "SKIPPED", "message": f"No handler"}
                    await _log_step(step, "SKIPPED", "No handler", run_id=run_id)
                    continue
                result = await func()
                status = result.get("status", "FAILED")
                message = result.get("message", "")
                details = result.get("details", {})
            except Exception as e:
                status = "FAILED"
                message = f"Exception: {str(e)[:200]}"
                details = {"error": str(e)[:500], "traceback": traceback.format_exc()[-2000:]}

            elapsed = int((time.time() - step_start) * 1000)
            results[step] = {"status": status, "message": message}
            await _log_step(step, status, message, details, elapsed, run_id)

            if status == "FAILED":
                overall_status = "FAILED"
                break
    finally:
        _locked = False

    return {"status": overall_status, "pipeline_run_id": run_id, "steps": results}


async def run_single_step(step: str) -> dict:
    global _locked
    if _locked:
        return {"status": "FAILED", "message": "Pipeline locked"}

    func = _STEP_FUNCS.get(step)
    if not func:
        return {"status": "FAILED", "message": f"Unknown step: {step}"}

    _locked = True
    try:
        step_start = time.time()
        try:
            result = await func()
            status = result.get("status", "FAILED")
            message = result.get("message", "")
            details = result.get("details", {})
        except Exception as e:
            status = "FAILED"
            message = f"Exception: {str(e)[:200]}"
            details = {"error": str(e)[:500], "traceback": traceback.format_exc()[-2000:]}
        elapsed = int((time.time() - step_start) * 1000)
        await _log_step(step, status, message, details, elapsed, "")
        return {"status": status, "message": message, "step": step, "duration_ms": elapsed}
    finally:
        _locked = False


# ── Pipeline Scheduler ──────────────────────────────────────────

_pipeline_scheduler_running = False


async def _pipeline_scheduler_loop():
    global _pipeline_scheduler_running
    while _pipeline_scheduler_running:
        try:
            config = await get_pipeline_config()
            if config["enabled"]:
                from app.services.service_db import get_settings
                raw = await get_settings()
                interval_minutes = int(raw.get("pipeline_interval_minutes", 60))
                await asyncio.sleep(interval_minutes * 60)
                if not _pipeline_scheduler_running:
                    break
                try:
                    await run_pipeline("evolution")
                except Exception as e:
                    logger.error("Pipeline scheduler error: %s", e)
            else:
                await asyncio.sleep(60)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Pipeline scheduler loop error: %s", e)
            await asyncio.sleep(60)


def start_pipeline_scheduler():
    global _pipeline_scheduler_running
    _pipeline_scheduler_running = True
    import asyncio
    try:
        asyncio.create_task(_pipeline_scheduler_loop())
    except RuntimeError:
        pass


def stop_pipeline_scheduler():
    global _pipeline_scheduler_running
    _pipeline_scheduler_running = False
