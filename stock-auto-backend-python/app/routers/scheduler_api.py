from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.services.market_scheduler import get_scheduler, add_job_to_scheduler, _run_market_sync
from app.database_sqlalchemy import get_session_sync
from app.repositories.stock_repository import StockRepository
from app.utils.timezone import to_kst

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])


@router.get("/market/latest-trade-date")
async def latest_trade_date():
    from app.database import execute_query
    rows = await execute_query("SELECT MAX(trade_date) FROM stock_daily_prices")
    last_date = str(rows[0][0]) if rows and rows[0][0] else None
    return {"latest_trade_date": last_date}


def _build_job_info(job) -> dict:
    cron = str(job.trigger) if hasattr(job, "trigger") else ""
    next_run = job.next_run_time
    status = "RUNNING" if next_run else "PAUSED"
    return {
        "job_id": job.id,
        "job_name": job.name,
        "cron_expression": cron,
        "status": status,
        "next_run_time": next_run.isoformat() if next_run else None,
        "next_run_time_kst": to_kst(next_run) if next_run else None,
    }


@router.get("/jobs")
async def list_jobs():
    sched = get_scheduler()
    if not sched:
        return {"jobs": [], "scheduler_running": False}
    jobs = sched.get_jobs()
    # Enrich with DB metadata
    session = get_session_sync()
    try:
        repo = StockRepository(session)
        db_jobs = {j.job_id: j for j in repo.get_all_jobs()}
        result = []
        for job in jobs:
            info = _build_job_info(job)
            dbj = db_jobs.get(job.id)
            if dbj:
                info["description"] = dbj.description
                ca = dbj.created_at
                info["created_at"] = ca.isoformat() if ca and hasattr(ca, 'isoformat') else (str(ca) if ca else None)
                info["created_at_kst"] = to_kst(ca) if ca else None
            result.append(info)
        return {"jobs": result, "scheduler_running": True}
    finally:
        session.close()


@router.get("/jobs/{job_id}")
async def get_job_detail(job_id: str):
    sched = get_scheduler()
    if not sched:
        raise HTTPException(503, "Scheduler not running")
    job = sched.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    session = get_session_sync()
    try:
        repo = StockRepository(session)
        history = repo.get_job_history(job_id)

        # Include latest trade date for market_data_sync
        latest_trade_date = None
        if job_id == "market_data_sync":
            from app.database import execute_query
            rows = await execute_query("SELECT MAX(trade_date) FROM stock_daily_prices")
            if rows and rows[0][0]:
                latest_trade_date = str(rows[0][0])

        return {
            **_build_job_info(job),
            "latest_trade_date": latest_trade_date,
            "history": [
                {
                    "id": h.id,
                    "start_time": str(h.start_time) if h.start_time else None,
                    "start_time_kst": to_kst(h.start_time),
                    "end_time": str(h.end_time) if h.end_time else None,
                    "end_time_kst": to_kst(h.end_time),
                    "status": h.status,
                    "execution_time_ms": h.execution_time_ms,
                    "message": h.message,
                    "ticker_count": h.ticker_count,
                    "inserted_rows": h.inserted_rows,
                    "updated_rows": h.updated_rows,
                    "error_message": h.error_message,
                }
                for h in history
            ],
        }
    finally:
        session.close()


@router.post("/jobs/{job_id}/run")
async def run_job(job_id: str):
    sched = get_scheduler()
    if not sched:
        raise HTTPException(503, "Scheduler not running")
    job = sched.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    import asyncio
    if job_id == "market_data_sync":
        asyncio.ensure_future(_run_market_sync())
    else:
        asyncio.ensure_future(job.func(*job.args, **job.kwargs))

    return {"status": "triggered", "job_id": job_id}


@router.get("/jobs/paper-trading/status")
async def paper_trading_scheduler_status():
    from app.services.paper_trading_scheduler import get_paper_trading_scheduler_status as _pt_status
    return {"status": _pt_status(), "job_id": "paper-trading"}


@router.post("/jobs/{job_id}/pause")
async def pause_job(job_id: str):
    # Handle paper-trading as a custom scheduler (not APScheduler)
    if job_id == "paper-trading":
        from app.services.paper_trading_scheduler import pause_paper_trading_scheduler as _pause_pt
        _pause_pt()
        return {"status": "paused", "job_id": job_id}

    sched = get_scheduler()
    if not sched:
        raise HTTPException(503, "Scheduler not running")
    job = sched.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    sched.pause_job(job_id)

    session = get_session_sync()
    try:
        repo = StockRepository(session)
        repo.update_job_status(job_id, "PAUSED")
        session.commit()
    finally:
        session.close()

    return {"status": "paused", "job_id": job_id}


@router.post("/jobs/{job_id}/resume")
async def resume_job(job_id: str):
    # Handle paper-trading as a custom scheduler (not APScheduler)
    if job_id == "paper-trading":
        from app.services.paper_trading_scheduler import resume_paper_trading_scheduler as _resume_pt
        _resume_pt()
        return {"status": "resumed", "job_id": job_id}

    sched = get_scheduler()
    if not sched:
        raise HTTPException(503, "Scheduler not running")
    job = sched.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    sched.resume_job(job_id)

    session = get_session_sync()
    try:
        repo = StockRepository(session)
        repo.update_job_status(job_id, "RUNNING")
        session.commit()
    finally:
        session.close()

    return {"status": "resumed", "job_id": job_id}


@router.get("/status")
async def scheduler_status():
    sched = get_scheduler()
    if not sched:
        return {"running": False, "jobs": []}
    jobs = sched.get_jobs()
    return {
        "running": True,
        "job_count": len(jobs),
        "jobs": [_build_job_info(j) for j in jobs],
    }


@router.get("/evolution")
async def evolution_scheduler_status():
    """Return Evolution scheduler status with recent history."""
    try:
        from app.strategy_evolution.database import get_evolution_status, get_generations
        from app.routers.evolution import get_orch
        status = await get_evolution_status()
        gens = await get_generations(limit=20)
        config = get_orch().config if get_orch() else None
        return {
            "status": status.model_dump(),
            "config": config.model_dump() if config else None,
            "recent_generations": [
                {
                    "generation": g.generation,
                    "population_size": g.population_size,
                    "avg_fitness": g.avg_fitness,
                    "avg_return": g.avg_return,
                    "avg_winrate": g.avg_winrate,
                    "avg_mdd": g.avg_mdd,
                    "created_at_kst": g.created_at_kst,
                }
                for g in gens
            ],
        }
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(503, f"Evolution scheduler not available: {str(e)}")
