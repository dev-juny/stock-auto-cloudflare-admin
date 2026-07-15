import traceback
import asyncio
from datetime import datetime, timedelta
from .models import EvolutionConfig, EvolutionStatus
from .engine import EvolutionEngine
from .scheduler import EvolutionScheduler
from app.services.service_db import add_system_log
from .database import (
    get_evolution_status, update_evolution_status, get_strategies,
    get_generations, get_performance, get_history, get_strategy_by_id,
    save_strategy, log_history,
)


class EvolutionOrchestrator:
    def __init__(self, config: EvolutionConfig):
        self.config = config
        self.engine = EvolutionEngine(config)
        self.scheduler = EvolutionScheduler(self.engine)

    async def reload_config(self, new_config: EvolutionConfig):
        self.config = new_config
        self.engine.config = new_config
        self.engine.generator.config = new_config
        self.engine.fitness.config = new_config
        self.engine.selector.config = new_config
        self.engine.mutator.config = new_config
        self.engine.crossover.config = new_config
        self.engine.evaluator.config = new_config
        self.engine.evaluator.fitness.config = new_config
        self.scheduler.config = new_config

    async def start(self):
        await self.engine.initialize()
        status = await get_evolution_status()
        status.is_running = False
        status.status = "idle"
        if not status.last_run_at:
            status.last_run_at = datetime.utcnow().isoformat()
            status.next_scheduled_run = (datetime.utcnow() + timedelta(hours=self.config.min_generation_interval_hours)).isoformat()
        await update_evolution_status(status)
        await self.scheduler.start()

    async def stop(self):
        await self.scheduler.stop()

    async def get_status(self) -> EvolutionStatus:
        return await get_evolution_status()

    async def get_strategies(self, generation: int | None = None, limit: int = 200, offset: int = 0):
        return await get_strategies(generation=generation, limit=limit, offset=offset)

    async def get_strategy(self, strategy_id: int):
        return await get_strategy_by_id(strategy_id)

    async def get_performance(self, strategy_id: int):
        return await get_performance(strategy_id)

    async def get_generations(self):
        return await get_generations()

    async def get_history(self, strategy_id: int):
        return await get_history(strategy_id)

    async def _auto_link_portfolio_strategies(self, generation: int, max_count: int = 10):
        from app.database import execute_query, execute_non_query
        from app.services.service_db import add_system_log, register_strategy
        rows = await execute_query(
            """SELECT pf.strategy_id, pf.fitness_score, pf.total_return, pf.win_rate,
                      pf.total_trades, pf.max_drawdown, pf.profit_factor, pf.sharpe_ratio, pf.cagr,
                      pf.generation
               FROM strategy_performance pf
               WHERE pf.generation = :1
                 AND pf.fitness_score >= 20
                 AND pf.win_rate >= 30
                 AND pf.total_trades >= 15
                 AND pf.max_drawdown <= 30
                 AND pf.total_return >= 5
               ORDER BY pf.fitness_score DESC
               FETCH FIRST :2 ROWS ONLY""",
            [generation, max_count],
        )
        if not rows:
            return
        added = 0
        for r in rows:
            sid = r[0]
            gen = int(r[9] or generation)
            existing = await execute_query(
                "SELECT COUNT(*) FROM portfolio_strategy WHERE strategy_id = :1",
                [sid],
            )
            if existing and existing[0][0] > 0:
                continue
            await execute_non_query(
                """INSERT INTO portfolio_strategy (strategy_id, generation, allocation, status, created_at)
                   VALUES (:1, :2, 0, 'candidate', CURRENT_TIMESTAMP)""",
                [sid, gen],
            )
            already_reg = await execute_query(
                "SELECT COUNT(*) FROM strategy_registry WHERE strategy_id = :1", [sid]
            )
            if not already_reg or already_reg[0][0] == 0:
                try:
                    await register_strategy({
                        "strategy_id": sid,
                        "name": f"Evolution Strategy #{sid}",
                        "entry_type": "evolution",
                        "generation": gen,
                        "version": 1,
                        "is_active": True,
                        "is_elite": r[1] >= 80,
                        "allocation_pct": 0,
                        "total_return": float(r[2] or 0),
                        "win_rate": float(r[3] or 0),
                        "total_trades": int(r[4] or 0),
                        "max_drawdown": float(r[5] or 0),
                        "profit_factor": float(r[6] or 0),
                        "fitness_score": float(r[1] or 0),
                    })
                except Exception:
                    pass
            added += 1
        if added:
            await add_system_log("info", "evolution_portfolio_link",
                f"Auto-linked {added} strategies from generation {generation}", {})

    async def manual_run_generation(self) -> EvolutionStatus:
        status = await get_evolution_status()
        if status.is_running:
            return status
        status.is_running = True
        status.status = "running"
        status.current_operation = "Initializing..."
        await update_evolution_status(status)

        try:
            if self.config.max_generations > 0 and (status.current_generation or 0) >= self.config.max_generations:
                raise RuntimeError(f"Max generations reached ({status.current_generation})")

            await self.engine.initialize()
            gen = status.current_generation + 1
            status.current_operation = f"Running generation {gen}..."
            await update_evolution_status(status)
            await self.engine.run_generation(gen)
            await self._auto_link_portfolio_strategies(gen)
            status.current_generation = gen
            status.is_running = False
            status.status = "idle"
            status.current_operation = ""
            status.last_run_at = datetime.utcnow().isoformat()
            status.next_scheduled_run = (datetime.utcnow() + timedelta(hours=self.config.min_generation_interval_hours)).isoformat()
            await update_evolution_status(status)
        except Exception as e:
            tb = traceback.format_exc()
            status.is_running = False
            status.status = f"error: {str(e)[:80]}"
            status.current_operation = ""
            await update_evolution_status(status)
            await add_system_log("error", "evolution_orchestrator", str(e)[:200], {
                "exception_type": type(e).__name__,
                "message": str(e)[:500],
                "stacktrace": tb[-2000:] if tb else "",
                "generation": (status.current_generation or 0) + 1,
            })
        return await self.get_status()

