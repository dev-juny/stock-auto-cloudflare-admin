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

    async def get_strategies(self, generation: int | None = None):
        return await get_strategies(generation=generation)

    async def get_strategy(self, strategy_id: int):
        return await get_strategy_by_id(strategy_id)

    async def get_performance(self, strategy_id: int):
        return await get_performance(strategy_id)

    async def get_generations(self):
        return await get_generations()

    async def get_history(self, strategy_id: int):
        return await get_history(strategy_id)

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

