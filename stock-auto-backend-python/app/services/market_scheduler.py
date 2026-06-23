from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

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
    import time
    from datetime import datetime
    from app.database_sqlalchemy import get_session_sync
    from app.repositories.stock_repository import StockRepository
    from app.services import kospi_data

    logger.info("[SCHEDULER] Running daily market data sync...")
    start = time.time()
    success = True
    message = ""
    ticker_count = 0
    inserted_rows = 0
    updated_rows = 0
    error_message = ""
    try:
        stats = await kospi_data.run_daily_update()
        elapsed_ms = int((time.time() - start) * 1000)
        if stats.get("status") == "error":
            success = False
            error_message = stats.get("message", "Unknown error")
            message = f"Failed: {error_message}"
        elif stats.get("status") == "skipped":
            message = stats.get("message", "Up to date")
        else:
            ticker_count = stats.get("updated", 0)
            inserted_rows = stats.get("rows", 0)
            updated_rows = stats.get("updated", 0)
            failed = stats.get("failed", 0)
            message = f"Updated {ticker_count} tickers, {inserted_rows} rows inserted"
            if failed:
                message += f", {failed} failed"
        logger.info("[SCHEDULER] Daily sync completed: %s (%dms)", stats, elapsed_ms)
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        message = str(e)
        error_message = str(e)
        success = False
        logger.error("[SCHEDULER] Daily sync failed: %s", e)

    # Record in scheduler_history
    try:
        session = get_session_sync()
        try:
            repo = StockRepository(session)
            repo.add_scheduler_history(
                job_id=_JOB_ID,
                status="SUCCESS" if success else "FAIL",
                execution_time_ms=elapsed_ms,
                message=message[:500],
                ticker_count=ticker_count,
                inserted_rows=inserted_rows,
                updated_rows=updated_rows,
                error_message=error_message[:500] if error_message else "",
            )
            # Also upsert job metadata
            repo.upsert_scheduler_job(
                job_id=_JOB_ID,
                job_name="Market Data Daily Sync",
                cron="18 30 * * *",
                status="RUNNING",
                description="Daily KOSPI/KOSDAQ market data sync at 18:30 KST",
            )
            session.commit()
        finally:
            session.close()
    except Exception as log_e:
        logger.warning("Failed to record scheduler history: %s", log_e)

