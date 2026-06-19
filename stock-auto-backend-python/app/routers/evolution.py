from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.strategy_evolution import EvolutionOrchestrator, EvolutionConfig
from app.strategy_evolution.models import EvolutionStatus, EvolutionStrategy, FitnessScore, GenerationSummary
from app.strategy_evolution.database import get_generation_strategies, compare_generations
from app.services.service_db import load_evolution_config

router = APIRouter(prefix="/api/evolution", tags=["evolution"])
_orchestrator: EvolutionOrchestrator | None = None


def init_orchestrator(orch: EvolutionOrchestrator | None = None, config: EvolutionConfig | None = None):
    global _orchestrator
    if orch is not None:
        _orchestrator = orch
    else:
        _orchestrator = EvolutionOrchestrator(config or EvolutionConfig())


def get_orch() -> EvolutionOrchestrator:
    if _orchestrator is None:
        init_orchestrator()
    return _orchestrator


@router.get("/status")
async def get_status() -> EvolutionStatus:
    return await get_orch().get_status()


@router.get("/strategies")
async def list_strategies(generation: int | None = None) -> list[EvolutionStrategy]:
    return await get_orch().get_strategies(generation=generation)


@router.get("/strategies/{strategy_id}")
async def get_strategy(strategy_id: int) -> EvolutionStrategy:
    s = await get_orch().get_strategy(strategy_id)
    if not s:
        raise HTTPException(404, "Strategy not found")
    return s


@router.get("/strategies/{strategy_id}/performance")
async def strategy_performance(strategy_id: int) -> list[FitnessScore]:
    return await get_orch().get_performance(strategy_id)


@router.get("/strategies/{strategy_id}/history")
async def strategy_history(strategy_id: int) -> list[dict]:
    return await get_orch().get_history(strategy_id)


@router.get("/generations")
async def list_generations() -> list[GenerationSummary]:
    return await get_orch().get_generations()


@router.get("/generations/compare")
async def generations_compare(
    gen_a: int = Query(..., description="First generation"),
    gen_b: int = Query(..., description="Second generation"),
) -> dict:
    return await compare_generations(gen_a, gen_b)


@router.get("/generations/{generation}/strategies")
async def generation_strategies(generation: int) -> list[EvolutionStrategy]:
    return await get_generation_strategies(generation)


@router.post("/run")
async def manual_run() -> EvolutionStatus:
    return await get_orch().manual_run_generation()


@router.get("/config")
async def get_config() -> dict:
    cfg = get_orch().config
    return cfg.model_dump()


@router.post("/config/reload")
async def reload_config() -> dict:
    orch = get_orch()
    new_cfg = await load_evolution_config()
    await orch.reload_config(new_cfg)
    return {"message": "Config reloaded from DB", "config": new_cfg.model_dump()}


@router.get("/history/{generation_id}")
async def get_generation_history(generation_id: int) -> dict:
    from app.strategy_evolution.database import (
        get_generation_holdings, get_generation_trades, get_generation_contributions,
    )
    gens = await get_orch().get_generations()
    gen_info = next((g for g in gens if g.generation == generation_id), None)
    if not gen_info:
        raise HTTPException(404, "Generation not found")
    holdings = await get_generation_holdings(generation_id)
    trades = await get_generation_trades(generation_id)
    contributions = await get_generation_contributions(generation_id)
    return {
        "generation": generation_id,
        "population_size": gen_info.population_size,
        "elite_count": gen_info.elite_count,
        "avg_fitness": gen_info.avg_fitness,
        "best_fitness": gen_info.best_fitness,
        "avg_return": gen_info.avg_return,
        "avg_winrate": gen_info.avg_winrate,
        "avg_mdd": gen_info.avg_mdd,
        "total_return": contributions.get("total_return", 0),
        "holdings": holdings,
        "trades": trades,
        "contributions": contributions.get("contributions", []),
    }


@router.get("/history/{generation_id}/holdings")
async def generation_holdings(generation_id: int) -> list[dict]:
    from app.strategy_evolution.database import get_generation_holdings
    return await get_generation_holdings(generation_id)


@router.get("/history/{generation_id}/trades")
async def generation_trades(generation_id: int) -> list[dict]:
    from app.strategy_evolution.database import get_generation_trades
    return await get_generation_trades(generation_id)


@router.get("/history/{generation_id}/contributions")
async def generation_contributions(generation_id: int) -> dict:
    from app.strategy_evolution.database import get_generation_contributions
    return await get_generation_contributions(generation_id)


@router.post("/history/compare")
async def history_compare(body: dict) -> dict:
    gen_ids = body.get("generationIds", [])
    if len(gen_ids) != 2:
        raise HTTPException(400, "Exactly 2 generation IDs required")
    gen_a_id, gen_b_id = gen_ids

    from app.strategy_evolution.database import (
        get_generation_holdings, compare_generations,
    )

    summary = await compare_generations(gen_a_id, gen_b_id)
    holdings_a = await get_generation_holdings(gen_a_id)
    holdings_b = await get_generation_holdings(gen_b_id)

    codes_a = {h["stock_code"] for h in holdings_a}
    codes_b = {h["stock_code"] for h in holdings_b}

    weight_a = {h["stock_code"]: h["weight"] for h in holdings_a}
    weight_b = {h["stock_code"]: h["weight"] for h in holdings_b}
    ret_a = {h["stock_code"]: h["return_pct"] for h in holdings_a}
    ret_b = {h["stock_code"]: h["return_pct"] for h in holdings_b}
    name_a = {h["stock_code"]: h["stock_name"] for h in holdings_a}
    name_b = {h["stock_code"]: h["stock_name"] for h in holdings_b}

    new_codes = codes_b - codes_a
    removed_codes = codes_a - codes_b
    common_codes = codes_a & codes_b

    new_stocks = []
    for c in sorted(new_codes):
        new_stocks.append({
            "stock_code": c,
            "stock_name": name_b.get(c, c),
            "action": "new",
            "weight_before": 0,
            "weight_after": weight_b.get(c, 0),
            "return_before": 0,
            "return_after": ret_b.get(c, 0),
        })

    removed_stocks = []
    for c in sorted(removed_codes):
        removed_stocks.append({
            "stock_code": c,
            "stock_name": name_a.get(c, c),
            "action": "removed",
            "weight_before": weight_a.get(c, 0),
            "weight_after": 0,
            "return_before": ret_a.get(c, 0),
            "return_after": 0,
        })

    changed_stocks = []
    for c in sorted(common_codes):
        wb = weight_a.get(c, 0)
        wa = weight_b.get(c, 0)
        if abs(wb - wa) > 0.01 or abs((ret_a.get(c, 0) or 0) - (ret_b.get(c, 0) or 0)) > 0.01:
            changed_stocks.append({
                "stock_code": c,
                "stock_name": name_b.get(c, name_a.get(c, c)),
                "action": "weight_changed",
                "weight_before": wb,
                "weight_after": wa,
                "return_before": ret_a.get(c, 0) or 0,
                "return_after": ret_b.get(c, 0) or 0,
            })

    return {
        "gen_a": summary["gen_a"],
        "gen_b": summary["gen_b"],
        "new_stocks": new_stocks,
        "removed_stocks": removed_stocks,
        "changed_stocks": changed_stocks,
        "stock_changes": new_stocks + removed_stocks + changed_stocks,
    }


@router.post("/history/seed")
async def seed_history() -> dict:
    from app.strategy_evolution.database import seed_evolution_history
    return await seed_evolution_history()
