import traceback
import asyncio
from datetime import datetime, timedelta
from .models import EvolutionConfig, EvolutionStatus
from .database import get_evolution_status, update_evolution_status, get_strategies
from .engine import EvolutionEngine
from app.services.service_db import add_system_log


class EvolutionScheduler:
    def __init__(self, engine: EvolutionEngine):
        self.engine = engine
        self.config = engine.config
        self._task = None
        self._running = False

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._loop())

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None

    async def _loop(self):
        while self._running:
            try:
                if not self.config.evolution_enabled:
                    await asyncio.sleep(60)
                    continue

                status = await get_evolution_status()
                now = datetime.utcnow()

                if self.config.max_generations > 0 and (status.current_generation or 0) >= self.config.max_generations:
                    if status.status != "stopped":
                        status.status = "stopped"
                        status.is_running = False
                        await update_evolution_status(status)
                        await add_system_log("evolution", "scheduler", "Max generations reached", {
                            "generation": status.current_generation,
                            "max_generations": self.config.max_generations,
                        })
                    await asyncio.sleep(60)
                    continue

                should_run = False
                if not status.is_running:
                    if status.last_run_at is None:
                        should_run = True
                    else:
                        last = datetime.fromisoformat(status.last_run_at.replace('Z', '+00:00'))
                        hours_since = (now - last).total_seconds() / 3600
                        if hours_since >= self.config.min_generation_interval_hours:
                            strategies = await get_strategies()
                            if await self._check_event_trigger(strategies):
                                should_run = True

                if should_run:
                    status.is_running = True
                    status.status = "running"
                    await update_evolution_status(status)
                    await self.engine.initialize()
                    gen = (status.current_generation or 0) + 1
                    await self.engine.run_generation(gen)
                    status.current_generation = gen
                    status.is_running = False
                    status.status = "idle"
                    status.last_run_at = now.isoformat()
                    status.next_scheduled_run = (now + timedelta(hours=self.config.min_generation_interval_hours)).isoformat()
                    await update_evolution_status(status)

            except asyncio.CancelledError:
                break
            except Exception as e:
                tb = traceback.format_exc()
                status = await get_evolution_status()
                status.is_running = False
                status.status = f"error: {str(e)[:80]}"
                await update_evolution_status(status)
                await add_system_log("error", "evolution_scheduler", str(e)[:200], {
                    "exception_type": type(e).__name__,
                    "message": str(e)[:500],
                    "stacktrace": tb[-2000:] if tb else "",
                    "generation": (status.current_generation or 0) + 1,
                })

            await asyncio.sleep(60)

    async def _check_event_trigger(self, strategies) -> bool:
        if not strategies:
            return True
        tested = [s for s in strategies if s.total_trades > 0]
        if not tested:
            return True
        avg_return = sum(s.total_return for s in tested) / len(tested)
        avg_winrate = sum(s.win_rate for s in tested) / len(tested)
        avg_mdd = sum(abs(s.max_drawdown) for s in tested) / len(tested)
        return (avg_return < self.config.return_threshold or
                avg_winrate < self.config.winrate_threshold or
                avg_mdd > self.config.mdd_threshold)
