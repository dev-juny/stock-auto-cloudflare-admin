from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.strategy_evolution import EvolutionOrchestrator, EvolutionConfig
from app.strategy_evolution.models import EvolutionStatus, EvolutionStrategy, FitnessScore, GenerationSummary, StrategyParams
from app.strategy_evolution.database import (
    compare_generations,
    get_generation_strategies,
    get_generation_universe,
    save_performance as db_save_perf,
)
from app.services.service_db import load_evolution_config
from app.database import execute_query, execute_non_query
from app.strategy_evolution.fitness import FitnessCalculator

logger = logging.getLogger(__name__)

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
async def list_strategies(
    generation: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
) -> list[EvolutionStrategy]:
    return await get_orch().get_strategies(generation=generation, limit=limit, offset=offset)


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
    gens = await get_orch().get_generations()
    gen_info = next((g for g in gens if g.generation == generation_id), None)
    if not gen_info:
        rows = await execute_query(
            """            SELECT generation, population_size, elite_count, avg_fitness, best_fitness,
                      avg_return, avg_winrate, avg_mdd
               FROM strategy_generation WHERE generation = :1""",
            [generation_id],
        )
        if not rows:
            raise HTTPException(404, "Generation not found")
        row = rows[0]
        universe = await get_generation_universe(generation_id)
        return {
            "generation": int(row[0]),
            "population_size": int(row[1]) if row[1] else 0,
            "elite_count": int(row[2]) if row[2] else 0,
            "avg_fitness": float(row[3]) if row[3] else 0,
            "best_fitness": float(row[4]) if row[4] else 0,
            "avg_return": float(row[5]) if row[5] else 0,
            "avg_winrate": float(row[6]) if row[6] else 0,
            "avg_mdd": float(row[7]) if row[7] else 0,
            "total_return": float(row[5]) if row[5] else 0,
            "evaluation_universe": universe,
        }
    universe = await get_generation_universe(generation_id)
    return {
        "generation": generation_id,
        "population_size": gen_info.population_size,
        "elite_count": gen_info.elite_count,
        "avg_fitness": gen_info.avg_fitness,
        "best_fitness": gen_info.best_fitness,
        "avg_return": gen_info.avg_return,
        "avg_winrate": gen_info.avg_winrate,
        "avg_mdd": gen_info.avg_mdd,
        "total_return": gen_info.avg_return,
        "evaluation_universe": universe,
    }


@router.post("/history/compare")
async def history_compare(body: dict) -> dict:
    gen_ids = body.get("generationIds", [])
    if len(gen_ids) != 2:
        raise HTTPException(400, "Exactly 2 generation IDs required")
    gen_a_id, gen_b_id = gen_ids

    summary = await compare_generations(gen_a_id, gen_b_id)

    return {
        "gen_a": summary["gen_a"],
        "gen_b": summary["gen_b"],
        "universe": summary.get("universe", {}),
        "strategy_changes": summary.get("changed", []),
    }


# ── P1: Batch Recalculate All Strategies ─────────────────────────

_recalc_status = {"running": False, "total": 0, "processed": 0, "errors": 0, "started_at": None}


@router.post("/refresh-summaries")
async def refresh_summaries():
    """Recalculate all generation summaries from current performance data."""
    await evaluate_generation_stats()
    return {"message": "All generation summaries refreshed"}


@router.get("/recalculation-status")
async def recalculation_status():
    """Get progress of batch strategy recalculation."""
    global _recalc_status
    return {
        "running": _recalc_status["running"],
        "total": _recalc_status["total"],
        "processed": _recalc_status["processed"],
        "progress_pct": round(_recalc_status["processed"] / max(_recalc_status["total"], 1) * 100, 1),
        "errors": _recalc_status["errors"],
        "started_at": _recalc_status.get("started_at"),
    }


@router.post("/recalculate-all")
async def recalculate_all():
    """Start batch recalculation of all strategies with updated evaluator (PF/MDD fix).
    
    This runs as a background task and processes strategies in batches of 100.
    Check progress via GET /api/evolution/recalculation-status
    """
    global _recalc_status
    if _recalc_status["running"]:
        return {"message": "Recalculation already in progress", "status": _recalc_status}

    import asyncio
    from app.strategy_evolution.evaluator import StrategyEvaluator
    from app.strategy_evolution.database import save_performance as db_save_perf
    from app.strategy_evolution.database import log_history as db_log_history
    from app.strategy_evolution.fitness import FitnessCalculator
    from app.strategy_evolution.database import get_or_create_generation_universe
    from app.database import execute_query

    cfg = get_orch().config

    _recalc_status["running"] = True
    _recalc_status["started_at"] = str(datetime.now(timezone.utc))
    _recalc_status["errors"] = 0

    async def _recalc_batch():
        global _recalc_status
        from app.strategy_evolution.evaluator import StrategyEvaluator as Eval
        evaluator = Eval(cfg)
        try:
            rows = await execute_query(
                """SELECT id, generation FROM strategy_pool WHERE is_alive = 'Y' ORDER BY id""",
            )
            all_strategies = [(int(r[0]), int(r[1])) for r in rows]
            _recalc_status["total"] = len(all_strategies)
            _recalc_status["processed"] = 0

            # Reuse universe per generation
            universe_cache = {}

            for i, (sid, gen) in enumerate(all_strategies):
                try:
                    if gen not in universe_cache:
                        universe_cache[gen] = await get_or_create_generation_universe(gen)
                    univ = universe_cache[gen]
                    if not univ:
                        _recalc_status["processed"] += 1
                        continue

                    await execute_non_query(
                        "DELETE FROM strategy_performance WHERE strategy_id = :1", [sid]
                    )

                    perf = await evaluator.evaluate_strategy_for_recalc(sid, gen, univ)
                    if perf and perf.get("total_trades", 0) > 0:
                        ret = perf.get("total_return", 0)
                        wr = perf.get("win_rate", 0)
                        mdd = abs(perf.get("max_drawdown", 0))
                        w_ret = cfg.fitness_return_weight
                        w_wr = cfg.fitness_winrate_weight
                        w_mdd = cfg.fitness_mdd_penalty
                        fit = (ret * w_ret) + (wr * w_wr) - (mdd * w_mdd)
                        fs = FitnessScore(
                            strategy_id=sid,
                            generation=gen,
                            total_return=round(ret, 4),
                            win_rate=round(wr, 2),
                            max_drawdown=round(mdd, 4),
                            profit_factor=round(perf.get("profit_factor", 0), 4),
                            total_trades=perf.get("total_trades", 0),
                            fitness=round(fit, 4),
                            calculated_at=str(datetime.now(timezone.utc)),
                        )
                        await db_save_perf(fs)
                except Exception as e:
                    _recalc_status["errors"] += 1
                    logger.error("[RECALC] Error strategy %d: %s", sid, str(e))

                _recalc_status["processed"] += 1

                if (i + 1) % 100 == 0:
                    await asyncio.sleep(0)

            await evaluate_generation_stats()
        finally:
            _recalc_status["running"] = False

    asyncio.create_task(_recalc_batch())
    return {
        "message": f"Batch recalculation started for {_recalc_status['total'] if _recalc_status['total'] else '?'} strategies",
        "status": _recalc_status,
    }


async def evaluate_generation_stats():
    from app.database import execute_query
    from app.strategy_evolution.database import get_generations
    gens = await get_generations()
    for g in gens:
        gen_id = g.generation
        rows = await execute_query(
            """SELECT COUNT(*), ROUND(AVG(fitness_score),4), ROUND(MAX(fitness_score),4),
                      ROUND(AVG(total_return),4), ROUND(AVG(win_rate),2), ROUND(AVG(max_drawdown),4)
               FROM (
                   SELECT strategy_id, generation, fitness_score, total_return, win_rate, max_drawdown, total_trades,
                          ROW_NUMBER() OVER (PARTITION BY strategy_id ORDER BY generation DESC) as rn
                   FROM strategy_performance
               ) pf
               WHERE pf.rn = 1 AND pf.generation = :1 AND NVL(pf.total_trades, 0) > 0""",
            [gen_id],
        )
        if rows and rows[0][0] > 0:
            r = rows[0]
            await execute_non_query(
                """UPDATE strategy_generation SET avg_fitness=:1, best_fitness=:2, avg_return=:3, avg_winrate=:4, avg_mdd=:5
                   WHERE generation=:6""",
                [round(float(r[1] or 0), 4), round(float(r[2] or 0), 4),
                 round(float(r[3] or 0), 4), round(float(r[4] or 0), 2),
                 round(float(r[5] or 0), 4), gen_id],
            )



