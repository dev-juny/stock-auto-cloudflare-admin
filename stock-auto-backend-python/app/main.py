from __future__ import annotations

import asyncio
import logging
import sys
import time
from contextlib import asynccontextmanager
from collections import defaultdict

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import jwt

from app.config import settings
from app.database import init_oracle, close_oracle
from app.routers import backtest, positions, evolution, service, market_api, scheduler_api, strategies_api, portfolio_api, paper_trading
from app.services.scheduler import scheduler_loop
from app.services.market_scheduler import start_scheduler, stop_scheduler
from app.services.paper_trading_scheduler import start_paper_trading_scheduler, stop_paper_trading_scheduler
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


_logger = logging.getLogger("main")
_req_count = defaultdict(int)
_req_window_start = 0.0
RATE_LIMIT_REQUESTS = 300
RATE_LIMIT_WINDOW = 60


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
    )


def get_jwt_secret() -> str:
    return settings.jwt_secret


async def verify_token(request: Request) -> dict | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    else:
        token = request.cookies.get("admin_token")

    if not token:
        return None

    secret = get_jwt_secret()
    if not secret:
        return None

    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


async def auth_middleware(request: Request, call_next):
    public_paths = {"/api/health", "/docs", "/openapi.json", "/redoc"}
    if request.url.path in public_paths or request.url.path.startswith(("/docs/", "/openapi.json", "/redoc")):
        return await call_next(request)

    user = await verify_token(request)
    if not user:
        return JSONResponse(
            status_code=401,
            content={"error": "UNAUTHORIZED", "message": "Authentication required"},
        )

    request.state.user = user
    return await call_next(request)


async def rate_limit_middleware(request: Request, call_next):
    global _req_window_start
    now = time.time()
    if now - _req_window_start > RATE_LIMIT_WINDOW:
        _req_count.clear()
        _req_window_start = now

    client_ip = request.client.host if request.client else "unknown"
    _req_count[client_ip] += 1
    if _req_count[client_ip] > RATE_LIMIT_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"error": "RATE_LIMITED", "message": "Too many requests"},
        )

    return await call_next(request)


async def logging_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    status_code = response.status_code
    method = request.method
    path = request.url.path
    if status_code >= 400:
        user_info = getattr(request.state, "user", {})
        username = user_info.get("username", "?") if isinstance(user_info, dict) else "?"
        _logger.warning("[%s] %s %s -> %d (%.2fs)", method, path, username, status_code, elapsed)
    elif elapsed > 0.5:
        _logger.info("[SLOW] %s %s -> %d (%.2fs)", method, path, status_code, elapsed)
    return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_oracle()
    init_sqlalchemy()
    ensure_market_tables()
    start_scheduler()
    start_paper_trading_scheduler()
    task = asyncio.create_task(scheduler_loop())
    global _orch_task, _orchestrator
    try:
        cfg = await load_evolution_config()
        orch = EvolutionOrchestrator(cfg)
        _orchestrator = orch
        _orch_task = asyncio.create_task(orch.start())
        init_orchestrator(orch)
    except Exception as e:
        _logger.warning("Evolution orchestrator init skipped: %s", e)
    _logger.info("Application started")
    yield
    task.cancel()
    if _orchestrator:
        try:
            await _orchestrator.stop()
        except Exception:
            pass
    if _orch_task:
        _orch_task.cancel()
    stop_paper_trading_scheduler()
    stop_scheduler()
    close_sqlalchemy()
    await close_oracle()
    _logger.info("Application shutdown")


app = FastAPI(title="Stock Auto Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

app.middleware("http")(rate_limit_middleware)
app.middleware("http")(logging_middleware)
app.middleware("http")(auth_middleware)

app.include_router(backtest.router)
app.include_router(positions.router)
app.include_router(evolution.router)
app.include_router(service.router)
app.include_router(market_api.router)
app.include_router(scheduler_api.router)
app.include_router(strategies_api.router)
app.include_router(portfolio_api.router)
app.include_router(paper_trading.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "python-backend"}
