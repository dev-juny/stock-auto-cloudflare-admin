from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.services.market_data_service import MarketDataService

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None
_JOB_ID = "market_data_sync"


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        logger.warning("Scheduler already running")
        return

    _scheduler = AsyncIOScheduler(timezone="Asia/Seoul")

    # Daily 18:30 KST market data sync
    _scheduler.add_job(
        _run_market_sync,
        trigger=CronTrigger(hour=18, minute=30, timezone="Asia/Seoul"),
        id=_JOB_ID,
        name="Market Data Daily Sync",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )

    _scheduler.start()
    logger.info("Market scheduler started (daily 18:30 KST)")


def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Market scheduler stopped")


def add_job_to_scheduler(job_id: str, name: str, func, cron: str) -> bool:
    """Register a new scheduler job dynamically."""
    sched = _scheduler
    if sched is None:
        return False
    try:
        parts = cron.strip().split()
        if len(parts) != 5:
            return False
        sched.add_job(
            func,
            trigger=CronTrigger(
                minute=parts[0], hour=parts[1], day=parts[2],
                month=parts[3], day_of_week=parts[4],
                timezone="Asia/Seoul",
            ),
            id=job_id,
            name=name,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=3600,
            replace_existing=True,
        )
        return True
    except Exception as e:
        logger.error("Failed to add job %s: %s", job_id, e)
        return False


async def _run_market_sync():
    logger.info("[SCHEDULER] Running daily market data sync...")
    service = MarketDataService()
    stats = await _run_in_thread(service.sync_all)
    logger.info("[SCHEDULER] Daily sync completed: %s", stats)


async def _run_in_thread(func, *args, **kwargs):
    import asyncio
    return await asyncio.to_thread(func, *args, **kwargs)
