from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from app.database import execute_query
from app.services.paper_trading_service import run_paper_trading_cycle, list_sessions
from app.services.operations_service import auto_promote_strategies, rebalance_portfolio

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_SECONDS = 3600  # 1 hour

_running = False
_task: asyncio.Task | None = None

_last_promotion_date: str | None = None
_last_rebalance_date: str | None = None


async def _load_interval() -> int:
    try:
        rows = await execute_query(
            "SELECT interval_seconds FROM scheduler_config ORDER BY id DESC FETCH FIRST 1 ROW ONLY",
        )
        if rows and rows[0][0]:
            return int(rows[0][0])
    except Exception:
        pass
    return DEFAULT_INTERVAL_SECONDS


def _is_market_hours() -> bool:
    now = datetime.now(timezone.utc)
    kst = now.astimezone(timezone(timedelta(hours=9)))
    if kst.weekday() >= 5:
        return False
    return 9 <= kst.hour < 15


async def _run_maintenance():
    global _last_promotion_date, _last_rebalance_date
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if _last_promotion_date != today:
        try:
            result = await auto_promote_strategies()
            logger.info("[PAPER-SCHEDULER] Auto-promotion: %s", result)
            _last_promotion_date = today
        except Exception as e:
            logger.error("[PAPER-SCHEDULER] Auto-promotion error: %s", e)

    if datetime.now(timezone.utc).day == 1 and _last_rebalance_date != today:
        try:
            result = await rebalance_portfolio("TOP3")
            logger.info("[PAPER-SCHEDULER] Monthly rebalance: %s", result)
            _last_rebalance_date = today
        except Exception as e:
            logger.error("[PAPER-SCHEDULER] Rebalance error: %s", e)


async def _run_cycle_for_auto_sessions():
    """Run paper trading cycle for all active sessions with auto_mode enabled."""
    sessions = await list_sessions()
    active_auto_sessions = [s for s in sessions if s["status"] == "active" and s["auto_mode"]]
    if not active_auto_sessions:
        logger.debug("[PAPER-SCHEDULER] No active auto-mode sessions found")
        return

    for sess in active_auto_sessions:
        try:
            logger.info("[PAPER-SCHEDULER] Running cycle for session %d (%s)", sess["id"], sess["name"])
            result = await run_paper_trading_cycle(session_id=sess["id"])
            logger.info("[PAPER-SCHEDULER] Session %d cycle result: %s", sess["id"], result)
        except Exception as e:
            logger.error("[PAPER-SCHEDULER] Session %d cycle error: %s", sess["id"], e)


async def _loop():
    global _running
    _running = True
    logger.info("[PAPER-SCHEDULER] Started (interval: %ds)", DEFAULT_INTERVAL_SECONDS)
    while _running:
        try:
            interval = await _load_interval()
            if _is_market_hours():
                logger.info("[PAPER-SCHEDULER] Running paper trading cycles...")
                await _run_cycle_for_auto_sessions()
            else:
                logger.debug("[PAPER-SCHEDULER] Outside market hours, skipping")
            await _run_maintenance()
        except Exception as e:
            logger.error("[PAPER-SCHEDULER] Cycle error: %s", e)
        await asyncio.sleep(interval)
    logger.info("[PAPER-SCHEDULER] Stopped")


def start_paper_trading_scheduler():
    global _task
    if _task is not None and not _task.done():
        logger.warning("[PAPER-SCHEDULER] Already running")
        return
    _task = asyncio.create_task(_loop())


def stop_paper_trading_scheduler():
    global _running, _task
    _running = False
    if _task:
        _task.cancel()
        _task = None


def pause_paper_trading_scheduler():
    global _running
    _running = False
    logger.info("[PAPER-SCHEDULER] Paused")


def resume_paper_trading_scheduler():
    global _task, _running
    if _task is not None and not _task.done() and _running:
        logger.warning("[PAPER-SCHEDULER] Already running")
        return
    _task = asyncio.create_task(_loop())
    logger.info("[PAPER-SCHEDULER] Resumed")


def get_paper_trading_scheduler_status() -> str:
    if _task is not None and not _task.done() and _running:
        return "running"
    return "paused"
