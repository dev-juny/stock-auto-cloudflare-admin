from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_oracle, close_oracle
from app.routers import backtest, positions, evolution, service, market_api, scheduler_api
from app.services.scheduler import scheduler_loop
from app.services.market_scheduler import start_scheduler, stop_scheduler
from app.services.market_data_service import ensure_market_tables
from app.database_sqlalchemy import init_sqlalchemy, close_sqlalchemy
from app.strategy_evolution import EvolutionOrchestrator, EvolutionConfig
from app.routers.evolution import init_orchestrator
from app.services.service_db import load_evolution_config

_orch_task: asyncio.Task | None = None
_orchestrator: EvolutionOrchestrator | None = None


def get_orch() -> EvolutionOrchestrator:
    global _orchestrator
    return _orchestrator


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_oracle()
    init_sqlalchemy()
    ensure_market_tables()
    start_scheduler()
    task = asyncio.create_task(scheduler_loop())
    cfg = await load_evolution_config()
    global _orch_task, _orchestrator
    orch = EvolutionOrchestrator(cfg)
    _orchestrator = orch
    _orch_task = asyncio.create_task(orch.start())
    init_orchestrator(orch)
    yield
    task.cancel()
    await orch.stop()
    if _orch_task:
        _orch_task.cancel()
    stop_scheduler()
    close_sqlalchemy()
    await close_oracle()


app = FastAPI(title="Stock Auto Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(backtest.router)
app.include_router(positions.router)
app.include_router(evolution.router)
app.include_router(service.router)
app.include_router(market_api.router)
app.include_router(scheduler_api.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "python-backend"}
