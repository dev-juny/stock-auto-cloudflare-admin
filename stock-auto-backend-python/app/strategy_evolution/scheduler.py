import traceback
import asyncio
from datetime import datetime, timedelta
from .models import EvolutionConfig, EvolutionStatus
from .database import get_evolution_status, update_evolution_status, get_strategies, get_strategy_stats
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
                            stats = await get_strategy_stats()
                            if await self._check_event_trigger(stats):
                                should_run = True

                if should_run:
                    import time
                    status.is_running = True
                    status.status = "running"
                    await update_evolution_status(status)
                    await self.engine.initialize()
                    gen = (status.current_generation or 0) + 1
                    gen_start = time.time()
                    try:
                        await self.engine.run_generation(gen)
                        elapsed_ms = int((time.time() - gen_start) * 1000)
                        status.current_generation = gen
                        status.is_running = False
                        status.status = "idle"
                        status.last_run_at = now.isoformat()
                        status.next_scheduled_run = (now + timedelta(hours=self.config.min_generation_interval_hours)).isoformat()
                        await update_evolution_status(status)
                        # Record in scheduler_history via SQLAlchemy
                        try:
                            from app.database_sqlalchemy import get_session_sync
                            from app.repositories.stock_repository import StockRepository
                            session = get_session_sync()
                            try:
                                repo = StockRepository(session)
                                repo.add_scheduler_history(
                                    job_id="evolution_scheduler",
                                    status="SUCCESS",
                                    execution_time_ms=elapsed_ms,
                                    message=f"Generation {gen} completed: {status.population_size} strategies" if hasattr(status, 'population_size') else f"Generation {gen} completed",
                                )
                                session.commit()
                            finally:
                                session.close()
                        except Exception:
                            pass
                        # ── Trigger pipeline after successful evolution ──
                        try:
                            from app.services.automation_service import run_pipeline
                            pipeline_result = await run_pipeline(start_step="portfolio_backtest")
                            logger = __import__('logging').getLogger(__name__)
                            logger.info("[EVOLUTION-SCHEDULER] Pipeline result: %s", pipeline_result.get("status"))
                        except Exception as pe:
                            logger = __import__('logging').getLogger(__name__)
                            logger.error("[EVOLUTION-SCHEDULER] Pipeline error: %s", pe)

                    except Exception as e:
                        elapsed_ms = int((time.time() - gen_start) * 1000)
                        status.is_running = False
                        status.status = f"error: {str(e)[:80]}"
                        await update_evolution_status(status)
                        try:
                            from app.database_sqlalchemy import get_session_sync
                            from app.repositories.stock_repository import StockRepository
                            session = get_session_sync()
                            try:
                                repo = StockRepository(session)
                                repo.add_scheduler_history(
                                    job_id="evolution_scheduler",
                                    status="FAIL",
                                    execution_time_ms=elapsed_ms,
                                    message=f"Generation {gen} failed: {str(e)[:200]}",
                                )
                                session.commit()
                            finally:
                                session.close()
                        except Exception:
                            pass
                        raise  # let the outer except handler log it

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

    async def _check_event_trigger(self, stats: dict) -> bool:
        if stats["count"] == 0:
            return True
        return (stats["avg_return"] < self.config.return_threshold or
                stats["avg_winrate"] < self.config.winrate_threshold or
                stats["avg_mdd"] > self.config.mdd_threshold)
