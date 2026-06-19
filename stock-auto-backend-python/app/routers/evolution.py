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
