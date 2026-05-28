from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_oracle, close_oracle
from app.routers import backtest, positions
from app.services.scheduler import scheduler_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_oracle()
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()
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


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "python-backend"}
