from __future__ import annotations

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request

from app.database import execute_query, execute_non_query
from app.services.service_db import (
    get_portfolio_snapshots, get_strategy_registry, register_strategy,
    update_strategy, delete_strategy, get_settings, update_setting,
    get_system_logs, add_system_log, ensure_service_tables,
)
from app.strategy_evolution.database import get_strategies, get_strategy_by_id, get_generations, get_strategies_paginated
from app.services.operations_service import (
    get_portfolio_health, get_evolution_dashboard, get_paper_performance,
    auto_promote_strategies, get_risk_settings, update_risk_setting, check_risk_limits,
    get_scan_settings, update_scan_setting,
    get_promotion_history, rebalance_portfolio, get_rebalance_history,
    get_scheduler_status, get_system_health,
    start_validation, stop_validation, get_validation_status,
    check_live_trading_readiness,
    get_validation_dashboard,
    simulate_cash_ratio, set_capital_deployment,
    get_integration_dashboard,
)
from app.services.automation_service import (
    run_pipeline, run_single_step, get_pipeline_status, get_pipeline_logs,
    get_pipeline_config, update_pipeline_config,
)
from app.services.strategy_lifecycle import (
    get_strategies_by_stage, get_strategies_by_stages,
    promote_strategy, demote_strategy, set_lifecycle_stage,
    ensure_lifecycle_tables, get_production_history,
    acquire_production_lock, release_production_lock, get_production_lock_status,
)
from app.services.survivor_service import (
    calculate_survivor_score, evaluate_survivors,
    evaluate_production_candidates, auto_replace_production,
    get_production_dashboard, get_survivor_pool,
    get_survivor_score_history, get_survivor_weights, update_survivor_weights,
    promote_to_production, rollback_production,
)
from app.services.shadow_trading_service import (
    create_shadow_session, stop_shadow_session, execute_shadow_order,
    get_shadow_session, list_shadow_sessions, get_shadow_orders, get_shadow_positions,
    evaluate_shadow_for_production, get_shadow_dashboard,
)

router = APIRouter(prefix="/api", tags=["service"])


def _require_admin(request: Request) -> dict:
    user = getattr(request.state, "user", None)
    if not user or not isinstance(user, dict):
        raise HTTPException(status_code=401, detail="Authentication required")
    if user.get("role", "") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required for production changes")
    return user


@router.on_event("startup")
async def init_service_tables():
    from app.config import settings
    if not settings.oracle_available:
        return
    await ensure_service_tables()


@router.get("/portfolio")
async def get_portfolio():
    snapshots = await get_portfolio_snapshots(limit=1)
    latest = snapshots[0] if snapshots else {}
    holdings = []
    if latest.get("holdings"):
        import json
        try:
            holdings = json.loads(latest["holdings"]) if isinstance(latest["holdings"], str) else latest["holdings"]
        except:
            holdings = []
    return {
        "total_value": latest.get("total_value", 0),
        "cash": latest.get("cash", 0),
        "invested": latest.get("invested", 0),
        "pnl_pct": latest.get("pnl_pct", 0),
        "pnl_amt": latest.get("pnl_amt", 0),
        "positions_count": latest.get("positions_count", 0),
        "holdings": holdings,
    }


@router.get("/portfolio/performance")
async def get_portfolio_performance():
    snapshots = await get_portfolio_snapshots(limit=90)
    return {
        "snapshots": snapshots,
        "total_return": snapshots[0]["pnl_pct"] if snapshots else 0,
    }


@router.get("/strategies")
async def list_strategies(
    source: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sort_by: str = Query("fitness_score"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    search: str = Query(""),
    is_active: Optional[bool] = Query(None),
    generation: Optional[int] = Query(None),
    min_return: Optional[float] = Query(None),
    max_return: Optional[float] = Query(None),
    min_winrate: Optional[float] = Query(None),
    max_winrate: Optional[float] = Query(None),
    max_mdd: Optional[float] = Query(None),
):
    if source == "evolution":
        return await get_strategies_paginated(
            offset=offset, limit=limit,
            sort_by=sort_by, sort_dir=sort_dir,
            search=search, generation=generation,
        )
    filters = {k: v for k, v in {
        "is_active": is_active, "generation": generation,
        "min_return": min_return, "max_return": max_return,
        "min_winrate": min_winrate, "max_winrate": max_winrate,
        "max_mdd": max_mdd,
    }.items() if v is not None}
    result = await get_strategy_registry(
        offset=offset, limit=limit,
        sort_by=sort_by, sort_dir=sort_dir,
        search=search, filters=filters,
    )
    return result


@router.post("/strategies")
async def create_strategy(data: dict):
    if not data.get("name"):
        raise HTTPException(400, "name is required")
    sid = await register_strategy(data)
    await add_system_log("info", "strategy", f"Strategy registered: {data['name']}")
    return {"id": sid, "message": "Strategy registered"}


@router.patch("/strategies/{registry_id}")
async def patch_strategy(registry_id: int, data: dict):
    await update_strategy(registry_id, data)
    await add_system_log("info", "strategy", f"Strategy {registry_id} updated")
    return {"message": "Updated"}


@router.delete("/strategies/{registry_id}")
async def remove_strategy(registry_id: int):
    await delete_strategy(registry_id)
    await add_system_log("info", "strategy", f"Strategy {registry_id} deleted")
    return {"message": "Deleted"}


@router.get("/settings")
async def list_settings():
    settings = await get_settings()
    return settings


@router.post("/settings")
async def save_settings(data: dict):
    type_map = {
        bool: "boolean",
        int: "number",
        float: "number",
    }
    for key, value in data.items():
        typ = type_map.get(type(value), "string")
        await update_setting(key, value, typ)
    await add_system_log("info", "settings", "Settings updated", {"keys": list(data.keys())})
    # Auto-reload evolution config into engine
    try:
        from app.routers.evolution import get_orch
        from app.services.service_db import load_evolution_config
        orch = get_orch()
        new_cfg = await load_evolution_config()
        await orch.reload_config(new_cfg)
    except Exception as e:
        pass  # evolution engine may not be initialized yet
    return {"message": "Settings saved"}


@router.get("/logs")
async def list_logs(log_type: Optional[str] = Query(None), limit: int = Query(100)):
    logs = await get_system_logs(log_type=log_type, limit=limit)
    return logs


@router.get("/system/status")
async def system_status():
    try:
        health = await execute_query("SELECT 1 FROM DUAL", None)
        db_ok = bool(health)
    except Exception:
        db_ok = False
    strategy_count = 0
    gen_count = 0
    try:
        strategies = await get_strategies()
        strategy_count = len(strategies)
        gens = await get_generations()
        gen_count = len(gens)
    except Exception:
        pass
    from app.utils.timezone import to_kst
    now_kst = to_kst(datetime.utcnow())
    return {
        "db_connected": db_ok,
        "service": "python-backend",
        "timestamp": datetime.utcnow().isoformat(),
        "timestamp_kst": now_kst,
        "active_strategies": strategy_count,
        "total_generations": gen_count,
    }


@router.get("/portfolio/health")
async def portfolio_health():
    """Portfolio Health Dashboard metrics."""
    return await get_portfolio_health()


@router.get("/evolution/dashboard")
async def evolution_dashboard():
    """Evolution Monitoring Dashboard."""
    return await get_evolution_dashboard()



@router.post("/portfolio/auto-promote")
async def portfolio_auto_promote():
    """Auto-promote candidate strategies that meet criteria."""
    return await auto_promote_strategies()


@router.get("/risk/settings")
async def risk_settings():
    """Get risk management settings."""
    return await get_risk_settings()


@router.post("/risk/settings")
async def save_risk_settings(data: dict):
    """Update a single risk setting."""
    for key in ("max_portfolio_allocation", "max_position_allocation", "daily_loss_limit", "daily_profit_lock", "risk_mode"):
        if key in data:
            await update_risk_setting(key, data[key])
            if key == "max_portfolio_allocation":
                await update_setting("max_capital_deployment", data[key], "number")
    return await get_risk_settings()


@router.get("/risk/scan-settings")
async def scan_settings():
    """Get scan settings (max_strategies, max_tickers_per_strategy)."""
    return await get_scan_settings()


@router.post("/risk/scan-settings")
async def save_scan_settings(data: dict):
    """Update a single scan setting."""
    for key in ("max_strategies", "max_tickers_per_strategy"):
        if key in data:
            await update_scan_setting(key, data[key])
    return await get_scan_settings()


@router.get("/risk/check")
async def risk_check():
    """Check if any risk limits are breached."""
    return await check_risk_limits()


@router.get("/portfolio/promotion-history")
async def promotion_history(limit: int = Query(50), strategy_id: int | None = Query(None)):
    """Get auto-promotion history."""
    return await get_promotion_history(limit, strategy_id)


@router.post("/portfolio/rebalance")
async def portfolio_rebalance(data: dict):
    """Rebalance portfolio (TOP3 or TOP5)."""
    method = data.get("method", "TOP3")
    return await rebalance_portfolio(method)


@router.post("/portfolio/rebalance/run")
async def portfolio_rebalance_run(data: dict):
    """Run rebalance immediately regardless of schedule."""
    method = data.get("method", "TOP3")
    return await rebalance_portfolio(method)


@router.get("/portfolio/rebalance-history")
async def rebalance_history(limit: int = Query(20)):
    """Get rebalance history."""
    return await get_rebalance_history(limit)


@router.get("/paper-trading/performance")
async def paper_trading_performance(
    period: str = Query("ALL", pattern="^(ALL|7D|30D|90D)$"),
    session_id: int = Query(default=None),
):
    """Paper Trading Performance with period filter & equity curve."""
    sid = session_id or 1
    return await get_paper_performance(period, session_id=sid)


@router.get("/scheduler/status")
async def scheduler_monitoring():
    """Unified scheduler monitoring dashboard."""
    return await get_scheduler_status()


@router.get("/system/health")
async def system_health():
    """System health & resource monitoring."""
    return await get_system_health()


@router.post("/validation/start")
async def validation_start():
    """Start 30-day paper trading validation."""
    return await start_validation()


@router.post("/validation/stop")
async def validation_stop():
    """Stop validation and generate report."""
    return await stop_validation()


@router.get("/validation/status")
async def validation_status():
    """Get validation mode status & daily log."""
    return await get_validation_status()


@router.get("/live-trading/readiness")
async def live_trading_readiness():
    """Check if all conditions met for live trading."""
    return await check_live_trading_readiness()


# ── P3: Cash Management ─────────────────────────────────────────


@router.get("/risk/cash-simulation")
async def risk_cash_simulation(min_cash_ratio: float = Query(10, ge=5, le=50)):
    """Simulate how different cash reserve levels affect the portfolio."""
    return await simulate_cash_ratio(min_cash_ratio)


@router.post("/risk/set-deployment")
async def risk_set_deployment(data: dict):
    """Set max capital deployment % (e.g. 80 = max 80% invested)."""
    pct = data.get("deployment_pct", 100)
    return await set_capital_deployment(pct)


# ── P4: Validation Dashboard ────────────────────────────────────


@router.get("/validation/dashboard")
async def validation_dashboard():
    """Validation dashboard with progress, daily logs, and metrics."""
    return await get_validation_dashboard()


# ── P5: Automation Pipeline ──────────────────────────────────────


@router.get("/pipeline/status")
async def pipeline_status():
    """Get automation pipeline status (steps, last run, config)."""
    return await get_pipeline_status()


@router.post("/pipeline/run")
async def pipeline_run(data: dict):
    """Run the full automation pipeline or from a specific step."""
    start_step = data.get("start_step", "portfolio_backtest")
    return await run_pipeline(start_step)


@router.post("/pipeline/step/{step_name}")
async def pipeline_run_step(step_name: str):
    """Run a single pipeline step."""
    return await run_single_step(step_name)


@router.get("/pipeline/logs")
async def pipeline_logs(limit: int = 50):
    """Get pipeline execution history."""
    return await get_pipeline_logs(limit)


@router.get("/pipeline/config")
async def pipeline_config_get():
    """Get pipeline configuration."""
    return await get_pipeline_config()


@router.post("/pipeline/config")
async def pipeline_config_save(data: dict):
    """Update pipeline configuration."""
    for key in data:
        await update_pipeline_config(key, data[key])
    return await get_pipeline_config()


# ── P6: Production & Lifecycle ────────────────────────────────────


@router.get("/production/dashboard")
async def production_dashboard():
    """Get production dashboard with survivors, candidates, production strategies."""
    return await get_production_dashboard()


@router.get("/production/strategies/{stage}")
async def production_strategies_by_stage(stage: str):
    """Get strategies by lifecycle stage (survivor, production_candidate, production, etc.)."""
    return await get_strategies_by_stage(stage)


@router.post("/production/promote")
async def production_promote(data: dict, request: Request):
    """Promote a strategy to the next lifecycle stage."""
    _require_admin(request)
    sid = data.get("strategy_id")
    if not sid:
        raise HTTPException(400, "strategy_id required")
    reason = data.get("reason", "Manual promotion")
    return await promote_strategy(sid, reason)


@router.post("/production/demote")
async def production_demote(data: dict, request: Request):
    """Demote a strategy to a previous lifecycle stage."""
    _require_admin(request)
    sid = data.get("strategy_id")
    if not sid:
        raise HTTPException(400, "strategy_id required")
    rows = await execute_query(
        "SELECT 1 FROM portfolio_strategy WHERE strategy_id = :1", [sid]
    )
    if not rows:
        raise HTTPException(404, "Strategy not found")
    target = data.get("target", "failed")
    reason = data.get("reason", "Manual demotion")
    return await demote_strategy(sid, target, reason)


@router.get("/production/survivor-pool")
async def production_survivor_pool():
    """Get active survivor pool with scores."""
    return await get_survivor_pool()


@router.get("/production/survivor-score/{strategy_id}")
async def production_survivor_score(strategy_id: int):
    """Calculate and return survivor score for a strategy."""
    score = await calculate_survivor_score(strategy_id)
    return score


@router.get("/production/survivor-score/{strategy_id}/history")
async def production_survivor_score_history(strategy_id: int, limit: int = 30):
    """Get survivor score history for a strategy."""
    return await get_survivor_score_history(strategy_id, limit)


@router.get("/production/evaluate-survivors")
async def production_evaluate_survivors():
    """Run survivor evaluation on all paper_trading strategies."""
    return await evaluate_survivors()


@router.get("/production/evaluate-candidates")
async def production_evaluate_candidates():
    """Evaluate survivor pool and promote to production candidates."""
    return await evaluate_production_candidates()


@router.get("/production/auto-replace")
async def production_auto_replace(request: Request):
    """Auto-replace production strategies with better candidates."""
    _require_admin(request)
    return await auto_replace_production()


@router.post("/production/promote-to-production")
async def production_promote_to_production(data: dict, request: Request):
    """Manually promote a survivor to production."""
    _require_admin(request)
    sid = data.get("strategy_id")
    if not sid:
        raise HTTPException(400, "strategy_id required")
    reason = data.get("reason", "Manual promotion to production")
    return await promote_to_production(sid, reason)


@router.post("/production/rollback")
async def production_rollback(data: dict, request: Request):
    """Rollback a production strategy to survivor."""
    _require_admin(request)
    sid = data.get("strategy_id")
    if not sid:
        raise HTTPException(400, "strategy_id required")
    rows = await execute_query(
        "SELECT 1 FROM portfolio_strategy WHERE strategy_id = :1", [sid]
    )
    if not rows:
        raise HTTPException(404, "Strategy not found")
    target = data.get("target", "survivor")
    reason = data.get("reason", "Manual rollback")
    return await rollback_production(sid, target, reason)


@router.get("/production/history")
async def production_history(limit: int = 50):
    """Get production promotion/demotion history."""
    return await get_production_history(limit)


@router.get("/production/weights")
async def production_weights():
    """Get current survivor score weights."""
    return await get_survivor_weights()


@router.post("/production/weights")
async def production_weights_save(data: dict):
    """Update survivor score weights."""
    await update_survivor_weights(data)
    return await get_survivor_weights()


# ── P7: Shadow Trading ───────────────────────────────────────────


@router.post("/shadow/session/start")
async def shadow_session_start(data: dict):
    """Start a shadow trading session for a strategy."""
    sid = data.get("strategy_id")
    if not sid:
        raise HTTPException(400, "strategy_id required")
    return await create_shadow_session(sid)


@router.post("/shadow/session/{session_id}/stop")
async def shadow_session_stop(session_id: int):
    """Stop a shadow trading session."""
    return await stop_shadow_session(session_id)


@router.get("/shadow/sessions")
async def shadow_sessions_all(status: str = ""):
    """List all shadow trading sessions."""
    if status:
        return await list_shadow_sessions(status)
    return await list_shadow_sessions()


@router.get("/shadow/session/{session_id}")
async def shadow_session_detail(session_id: int):
    """Get shadow session details."""
    result = await get_shadow_session(session_id)
    if not result:
        raise HTTPException(404, "Session not found")
    return result


@router.get("/shadow/session/{session_id}/orders")
async def shadow_session_orders(session_id: int, limit: int = 50):
    """Get orders for a shadow session."""
    return await get_shadow_orders(session_id, limit)


@router.get("/shadow/session/{session_id}/positions")
async def shadow_session_positions(session_id: int):
    """Get positions for a shadow session."""
    return await get_shadow_positions(session_id)


@router.post("/shadow/order")
async def shadow_order_create(data: dict):
    """Execute a shadow order (no KIS API call)."""
    required = ["session_id", "ticker", "direction", "price", "quantity"]
    for k in required:
        if k not in data:
            raise HTTPException(400, f"{k} required")
    return await execute_shadow_order(
        session_id=data["session_id"],
        ticker=data["ticker"],
        direction=data["direction"],
        price=data["price"],
        quantity=data["quantity"],
        strategy_id=data.get("strategy_id", 0),
        order_type=data.get("order_type", "market"),
    )


@router.post("/shadow/session/{session_id}/evaluate")
async def shadow_session_evaluate(session_id: int, request: Request):
    """Evaluate a shadow session for production promotion."""
    _require_admin(request)
    return await evaluate_shadow_for_production(session_id)


@router.get("/shadow/dashboard")
async def shadow_dashboard():
    """Get shadow trading dashboard summary."""
    return await get_shadow_dashboard()


@router.get("/production/lock")
async def production_lock_status():
    """Get production lock status."""
    return await get_production_lock_status()


@router.post("/production/lock/acquire")
async def production_lock_acquire(data: dict):
    """Acquire production lock."""
    sid = data.get("strategy_id", 0)
    reason = data.get("reason", "Manual lock")
    ok = await acquire_production_lock(sid, reason)
    if not ok:
        raise HTTPException(409, "Production lock already acquired")
    return {"status": "SUCCESS", "message": "Lock acquired"}


@router.post("/production/lock/release")
async def production_lock_release():
    """Release production lock."""
    await release_production_lock()
    return {"status": "SUCCESS", "message": "Lock released"}


# ── P8: Integration Dashboard ────────────────────────────────────


@router.get("/dashboard")
async def integration_dashboard():
    """Unified dashboard aggregating evolution, portfolio, risk, validation, paper trading."""
    return await get_integration_dashboard()
