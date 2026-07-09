from __future__ import annotations

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

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
    get_promotion_history, rebalance_portfolio, get_rebalance_history,
    get_scheduler_status, get_system_health,
    start_validation, stop_validation, get_validation_status,
    check_live_trading_readiness,
    get_validation_dashboard,
    simulate_cash_ratio, set_capital_deployment,
    get_integration_dashboard,
)

router = APIRouter(prefix="/api", tags=["service"])


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
    return await get_risk_settings()


@router.get("/risk/check")
async def risk_check():
    """Check if any risk limits are breached."""
    return await check_risk_limits()


@router.get("/portfolio/promotion-history")
async def promotion_history(limit: int = Query(50)):
    """Get auto-promotion history."""
    return await get_promotion_history(limit)


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
async def paper_trading_performance(period: str = Query("ALL", pattern="^(ALL|7D|30D|90D)$")):
    """Paper Trading Performance with period filter & equity curve."""
    return await get_paper_performance(period)


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


# ── P6: Integration Dashboard ────────────────────────────────────


@router.get("/dashboard")
async def integration_dashboard():
    """Unified dashboard aggregating evolution, portfolio, risk, validation, paper trading."""
    return await get_integration_dashboard()
