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
from app.strategy_evolution.database import get_strategies, get_strategy_by_id, get_generations

router = APIRouter(prefix="/api", tags=["service"])


@router.on_event("startup")
async def init_service_tables():
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
    sort_dir: str = Query("desc", regex="^(asc|desc)$"),
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
        strategies = await get_strategies()
        return [s.model_dump() for s in strategies]
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
