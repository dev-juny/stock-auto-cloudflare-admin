from __future__ import annotations

import asyncio
import concurrent.futures
from collections import deque
import threading
import json
import logging
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "stock-auto-backtest" / "src"))

from typing import Any

from pydantic import BaseModel

from fastapi import APIRouter, HTTPException
from app.database import execute_non_query, execute_query, get_pool
from app.models import (
    BacktestRequest,
    BacktestResponse,
    Candle,
    Marker,
    ScanResult,
    ScanStatus,
    TickerBacktestRequest,
    TradeEvent,
)
from app.services.chart import make_chart_data, make_markers
from app.services.data_provider import fetch_stock_data, get_all_tickers
from app.services.kospi_data import upsert_prices
from position_manager import BacktestConfig as BMC, PositionState  # type: ignore

class _LimitedCandleCache:
    def __init__(self, maxsize: int = 10):
        self._maxsize = maxsize
        self._data: dict[str, dict[str, list[dict]]] = {}
        self._order: list[str] = []
        self._lock = threading.Lock()

    def setdefault(self, scan_id: str, default: dict) -> dict:
        with self._lock:
            if scan_id not in self._data:
                self._data[scan_id] = default
                self._order.append(scan_id)
                self._evict()
            return self._data[scan_id]

    def get(self, scan_id: str, default=None):
        return self._data.get(scan_id, default)

    def pop(self, scan_id: str, default=None):
        with self._lock:
            if scan_id in self._data:
                self._order.remove(scan_id)
                return self._data.pop(scan_id)
            return default

    def _evict(self):
        while len(self._data) > self._maxsize:
            oldest = self._order.pop(0)
            del self._data[oldest]


router = APIRouter(prefix="/api/backtest", tags=["backtest"])

_scan_states: dict[str, dict] = {}
_scan_tasks: dict[str, asyncio.Task] = {}
_scan_candle_cache: _LimitedCandleCache = _LimitedCandleCache(maxsize=10)
_scan_cancel_flags: dict[str, bool] = {}
_logger = logging.getLogger("backtest")

_process_pool: concurrent.futures.ProcessPoolExecutor | None = None

def _get_process_pool() -> concurrent.futures.ProcessPoolExecutor:
    global _process_pool
    if _process_pool is None:
        _process_pool = concurrent.futures.ProcessPoolExecutor(max_workers=2)
    return _process_pool


def _calc_pnl(entry_price: float, exit_price: float, bmc: BMC) -> float:
    entry_cost = entry_price * (1 + bmc.commission + bmc.slippage)
    exit_proceeds = exit_price * (1 - bmc.commission - bmc.tax - bmc.slippage)
    return (exit_proceeds - entry_cost) / entry_cost


def _to_bmc(cfg) -> BMC:
    return BMC(
        fixed_take_profit_pct=cfg.fixedTakeProfitPct,
        break_even_activation_pct=cfg.breakEvenActivationPct,
        trailing_activation_pct=cfg.trailingActivationPct,
        trailing_stop_pct=cfg.trailingStopPct,
        stall_exit_days=cfg.stallExitDays,
        stop_loss_pct=getattr(cfg, "stopLossPct", 0.0),
        min_volume=cfg.minVolume,
        max_volatility=cfg.maxVolatility,
        ranking_candidate_limit=cfg.rankingCandidateLimit,
        max_concurrent_positions=cfg.maxConcurrentPositions,
        entry_type=getattr(cfg, "entryType", "momentum"),
        entry_trigger=getattr(cfg, "entryTrigger", "next_close"),
        entry_conditions=getattr(cfg, "entryConditions", None),
        commission=getattr(cfg, "commission", 0.0002),
        tax=getattr(cfg, "tax", 0.0015),
        slippage=getattr(cfg, "slippage", 0.001),
    )


def _precompute_rolling(candles: list[dict], window: int = 20) -> tuple[list[float | None], list[float | None], list[float], list[float | None], list[float | None]]:
    n = len(candles)
    volumes = [c.get("volume", 0) or 0 for c in candles]
    volats = []
    closes = [float(c.get("close", 0) or 0) for c in candles]
    for c in candles:
        h = c.get("high", 0) or 0
        l = c.get("low", 0) or 0
        cl = c.get("close", 1) or 1
        volats.append((h - l) / cl if cl > 0 else 0)
    rv: list[float | None] = [None] * n
    rve: list[float | None] = [None] * n
    rmax: list[float | None] = [None] * n
    rmin: list[float | None] = [None] * n
    if n >= window:
        v_sum = sum(volumes[:window])
        ve_sum = sum(volats[:window])
        # rolling max/min close using deque
        max_dq: deque = deque()
        min_dq: deque = deque()
        for i in range(n):
            while max_dq and closes[max_dq[-1]] <= closes[i]:
                max_dq.pop()
            max_dq.append(i)
            if max_dq[0] <= i - window:
                max_dq.popleft()
            while min_dq and closes[min_dq[-1]] >= closes[i]:
                min_dq.pop()
            min_dq.append(i)
            if min_dq[0] <= i - window:
                min_dq.popleft()
            if i >= window - 1:
                rmax[i] = closes[max_dq[0]]
                rmin[i] = closes[min_dq[0]]
            if i >= window:
                v_sum += volumes[i] - volumes[i - window]
                ve_sum += volats[i] - volats[i - window]
                rv[i] = v_sum / window
                rve[i] = ve_sum / window
            elif i == window - 1:
                rv[i] = v_sum / window
                rve[i] = ve_sum / window
    return rv, rve, closes, rmax, rmin


def _check_entry_conditions(
    rv: list[float | None], rve: list[float | None], i: int, bmc: BMC,
    closes: list[float] | None = None,
    rmax: list[float | None] | None = None,
    rmin: list[float | None] | None = None,
) -> bool:
    avg_vol = rv[i]
    avg_volat = rve[i]
    if avg_vol is None:
        return False
    if bmc.min_volume > 0 and avg_vol < bmc.min_volume:
        return False
    if bmc.max_volatility < 1.0 and avg_volat is not None and avg_volat > bmc.max_volatility:
        return False
    if bmc.entry_type == "hybrid":
        return True
    if closes and i >= 5 and bmc.entry_type == "momentum":
        if closes[i] <= closes[i - 5]:
            return False
        return True
    if bmc.entry_type == "breakout" and rmax and rmax[i] is not None:
        if closes[i] < rmax[i]:
            return False
        return True
    if bmc.entry_type == "pullback" and rmax and rmin and rmax[i] is not None and rmin[i] is not None:
        mid = (rmax[i] + rmin[i]) / 2
        if closes[i] >= rmax[i] * 0.98:
            return False
        if closes[i] <= mid:
            return False
        return True
    return True


def _resolve_entry_price(
    entry: dict, data: list[dict], i: int, bmc: BMC,
    rmax: list[float | None] | None = None,
) -> tuple[int, float]:
    et = bmc.entry_trigger
    if et == "next_close":
        return i, entry["close"]
    if et == "next_open":
        if i + 1 < len(data):
            return i + 1, data[i + 1]["open"]
        return i, entry["close"]
    if et == "intraday":
        return i, (entry["open"] + entry["high"] + entry["low"] + entry["close"]) / 4.0
    if et == "breakout_confirm":
        if i + 1 >= len(data):
            return i + 1, 0  # signal to skip (i advances past end)
        ref = rmax[i] if (rmax and rmax[i] is not None) else entry["close"]
        if data[i + 1]["close"] >= ref:
            return i + 1, data[i + 1]["close"]
        return i + 1, 0  # confirmation failed
    return i, entry["close"]


async def _run_on_data(ticker: str, data: list[dict], bmc: BMC) -> list[dict] | None:
    if len(data) < 20:
        return None
    need_roll = bmc.min_volume > 0 or bmc.max_volatility < 1.0 or bmc.entry_type not in ("", "hybrid") or bmc.entry_trigger == "breakout_confirm"
    if need_roll:
        rv, rve, closes, rmax, rmin = _precompute_rolling(data)
    results: list[dict] = []
    i = 0
    min_gap = 5
    while i < len(data):
        if len(data) - i < 20:
            break
        if i % 20 == 0:
            await asyncio.sleep(0)
        if need_roll and not _check_entry_conditions(rv, rve, i, bmc, closes, rmax, rmin):
            i += 1
            continue
        entry = data[i]
        entry_idx, entry_price = _resolve_entry_price(entry, data, i, bmc, rmax if need_roll else None)
        if entry_price == 0:
            i = entry_idx
            continue
        entry = data[entry_idx]
        state = PositionState(
            ticker=ticker,
            entry_date=entry["time"],
            entry_price=entry_price,
            quantity=1,
            highest_price_since_entry=entry_price,
            config=bmc,
        )
        sold = False
        for j in range(entry_idx + 1, len(data)):
            c = data[j]
            sig, reason = state.update_and_check_signal(c["close"])
            if sig == "SELL":
                results.append({
                    "ticker": ticker,
                    "entry_date": entry["time"],
                    "entry_price": entry_price,
                    "exit_date": c["time"],
                    "exit_reason": reason,
                    "exit_price": c["close"],
                    "pnl": _calc_pnl(entry_price, c["close"], bmc),
                    "holding_days": state.holding_days,
                })
                i = j + min_gap
                sold = True
                break
        if not sold:
            last = data[-1]
            results.append({
                "ticker": ticker,
                "entry_date": entry["time"],
                "entry_price": entry_price,
                "exit_date": None,
                "exit_reason": None,
                "exit_price": last["close"],
                "pnl": _calc_pnl(entry_price, last["close"], bmc),
                "holding_days": state.holding_days,
            })
            break
    return results if results else None


def _run_on_data_sync(ticker: str, data: list[dict], bmc: BMC) -> list[dict] | None:
    if len(data) < 20:
        return None
    need_roll = bmc.min_volume > 0 or bmc.max_volatility < 1.0 or bmc.entry_type not in ("", "hybrid") or bmc.entry_trigger == "breakout_confirm"
    if need_roll:
        rv, rve, closes, rmax, rmin = _precompute_rolling(data)
    results: list[dict] = []
    i = 0
    min_gap = 5
    while i < len(data):
        if len(data) - i < 20:
            break
        if need_roll and not _check_entry_conditions(rv, rve, i, bmc, closes, rmax, rmin):
            i += 1
            continue
        entry = data[i]
        entry_idx, entry_price = _resolve_entry_price(entry, data, i, bmc, rmax if need_roll else None)
        if entry_price == 0:
            i = entry_idx
            continue
        entry = data[entry_idx]
        state = PositionState(
            ticker=ticker,
            entry_date=entry["time"],
            entry_price=entry_price,
            quantity=1,
            highest_price_since_entry=entry_price,
            config=bmc,
        )
        sold = False
        for j in range(entry_idx + 1, len(data)):
            c = data[j]
            sig, reason = state.update_and_check_signal(c["close"])
            if sig == "SELL":
                results.append({
                    "ticker": ticker,
                    "entry_date": entry["time"],
                    "entry_price": entry_price,
                    "exit_date": c["time"],
                    "exit_reason": reason,
                    "exit_price": c["close"],
                    "pnl": _calc_pnl(entry_price, c["close"], bmc),
                    "holding_days": state.holding_days,
                })
                i = j + min_gap
                sold = True
                break
        if not sold:
            last = data[-1]
            results.append({
                "ticker": ticker,
                "entry_date": entry["time"],
                "entry_price": entry_price,
                "exit_date": None,
                "exit_reason": None,
                "exit_price": last["close"],
                "pnl": _calc_pnl(entry_price, last["close"], bmc),
                "holding_days": state.holding_days,
            })
            break
    return results if results else None


@router.post("", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest) -> BacktestResponse:
    cfg = req.config
    bmc = _to_bmc(cfg)

    state = PositionState(
        ticker="BACKTEST",
        entry_date=req.entryDate,
        entry_price=req.entryPrice,
        quantity=req.quantity,
        highest_price_since_entry=req.entryPrice,
        config=bmc,
    )

    trades: list[TradeEvent] = []
    exit_day: int | None = None
    exit_reason: str | None = None

    # Entry day (i=0) — record as BUY
    c0 = req.candles[0]
    trades.append(
        TradeEvent(day=1, date=c0.time, signal='BUY', reason=None, price=c0.close,
                   open=c0.open, high=c0.high, low=c0.low, close=c0.close)
    )
    for i, c in enumerate(req.candles[1:], start=2):
        price = c.close
        sig = 'HOLD'
        reason = None
        if exit_day is None:
            sig, reason = state.update_and_check_signal(price)
            if sig == 'HOLD' and reason == 'trailing':
                sig = 'HOLD(트레일링)'
            if sig == "SELL":
                exit_day = i
                exit_reason = reason
        elif exit_day is not None:
            sig = 'NONE'
        trades.append(
            TradeEvent(day=i, date=c.time, signal=sig, reason=reason, price=price,
                       open=c.open, high=c.high, low=c.low, close=c.close)
        )

    chart_data = make_chart_data(
        [c.time for c in req.candles],
        [c.open for c in req.candles],
        [c.high for c in req.candles],
        [c.low for c in req.candles],
        [c.close for c in req.candles],
    )
    markers = make_markers(req.entryDate, [t.model_dump() for t in trades])

    if exit_day is not None:
        exit_trade = trades[exit_day - 1]
        pnl = (exit_trade.price - req.entryPrice) / req.entryPrice
    else:
        last_price = req.candles[-1].close
        pnl = (last_price - req.entryPrice) / req.entryPrice

    return BacktestResponse(
        chart_data=[Candle(**d) for d in chart_data],
        markers=[Marker(**m) for m in markers],
        trades=trades,
        pnl=pnl,
        exit_day=exit_day,
        exit_reason=exit_reason,
        entry_price=req.entryPrice,
    )


@router.post("/ticker", response_model=BacktestResponse)
async def run_ticker_backtest(req: TickerBacktestRequest) -> BacktestResponse:
    if req.start_date and req.end_date:
        sd = datetime.strptime(req.start_date, "%Y-%m-%d")
        ed = datetime.strptime(req.end_date, "%Y-%m-%d")
        days = (ed - sd).days
        if days > 1825:
            raise HTTPException(400, f"백테스트 기간은 최대 5년(1825일)까지 가능합니다. (입력: {days}일)")
        pool = get_pool()
    candles: list[Candle] = []

    if pool:
        sql = (
            "SELECT trade_date, open_price, high_price, low_price, close_price "
            "FROM stock_daily_prices WHERE ticker = :1"
        )
        binds = [req.ticker]
        bind_idx = 2
        if req.start_date:
            sql += f" AND trade_date >= TO_DATE(:{bind_idx},'YYYY-MM-DD')"
            binds.append(req.start_date)
            bind_idx += 1
        if req.end_date:
            sql += f" AND trade_date <= TO_DATE(:{bind_idx},'YYYY-MM-DD')"
            binds.append(req.end_date)
        sql += " ORDER BY trade_date"
        rows = await execute_query(sql, binds)
        if rows:
            candles = [
                Candle(
                    time=str(r[0].date() if hasattr(r[0], "date") else r[0]),
                    open=float(r[1]),
                    high=float(r[2]),
                    low=float(r[3]),
                    close=float(r[4]),
                )
                for r in rows
            ]

    if not candles:
        raw = await fetch_stock_data(req.ticker)
        if raw:
            if req.start_date:
                raw = [d for d in raw if d["time"] >= req.start_date]
            if req.end_date:
                raw = [d for d in raw if d["time"] <= req.end_date]
            candles = [
                Candle(time=str(d["time"]), open=float(d["open"]), high=float(d["high"]), low=float(d["low"]), close=float(d["close"]))
                for d in raw
            ]

    if not candles:
        raise HTTPException(404, f"No data found for ticker {req.ticker}")

    # entry_date filter
    if req.entry_date:
        cutoff = req.entry_date
        candles = [c for c in candles if c.time >= cutoff]
    if not candles:
        raise HTTPException(400, f"No data from entry date {req.entry_date}")

    bt_req = BacktestRequest(
        entryDate=candles[0].time,
        entryPrice=candles[0].close,
        quantity=1,
        candles=candles,
        config=req.config,
    )
    return await run_backtest(bt_req)


@router.post("/scan", response_model=ScanStatus)
async def start_scan(req: TickerBacktestRequest) -> ScanStatus:
    if req.start_date and req.end_date:
        sd = datetime.strptime(req.start_date, "%Y-%m-%d")
        ed = datetime.strptime(req.end_date, "%Y-%m-%d")
        days = (ed - sd).days
        if days > 1825:
            raise HTTPException(400, f"백테스트 기간은 최대 5년(1825일)까지 가능합니다. (입력: {days}일)")
    scan_id = uuid.uuid4().hex[:8]
    state = {
        "scan_id": scan_id,
        "status": "running",
        "total": 0,
        "processed": 0,
        "completed": 0,
        "results": [],
        "message": "Initializing...",
    }
    _scan_states[scan_id] = state
    state["_req"] = req  # store for later portfolio building
    task = asyncio.create_task(_run_scan(scan_id, req))
    _scan_tasks[scan_id] = task
    state["status"] = "running"
    return ScanStatus(**state)


@router.get("/scan/{scan_id}")
async def get_scan_status(scan_id: str) -> dict:
    state = _scan_states.get(scan_id)
    if not state:
        return {
            "scan_id": scan_id, "status": "failed",
            "total": 0, "processed": 0, "completed": 0,
            "results": [], "message": "Scan not found",
        }
    results = state.get("results", [])
    # Include full results only when completed; during scan return at most 50
    if state.get("status") != "completed" and len(results) > 50:
        results = results[:50]
    return {
        "scan_id": state["scan_id"],
        "status": state.get("status", "running"),
        "total": state.get("total", 0),
        "processed": state.get("processed", 0),
        "completed": state.get("completed", 0),
        "results": results,
        "message": state.get("message", ""),
        "portfolio": state.get("portfolio"),
        "portfolio_building": state.get("portfolio_building"),
        "portfolio_trade_stats": state.get("portfolio_trade_stats"),
    }


@router.post("/scan/{scan_id}/portfolio")
async def build_scan_portfolio(scan_id: str) -> dict:
    state = _scan_states.get(scan_id)
    if not state:
        return {"status": "failed", "message": "Scan not found"}
    if state.get("status") != "completed":
        return {"status": "failed", "message": "Scan not completed yet"}
    if state.get("portfolio") is not None:
        return {"status": "completed", "message": "Portfolio already built"}
    if state.get("portfolio_building") == "running":
        return {"status": "running", "message": "Portfolio is being built"}

    req: TickerBacktestRequest = state.get("_req")
    if not req:
        return {"status": "failed", "message": "Scan request parameters not found"}

    bmc = _to_bmc(req.config)
    b_amt = req.base_amt or 1_000_000
    m_pos = req.config.maxConcurrentPositions or 9999
    results = state.get("results", [])

    if not results:
        return {"status": "failed", "message": "No results to build portfolio from"}

    async def _build():
        try:
            state["portfolio_building"] = "running"
            candle_cache = _scan_candle_cache.pop(scan_id, None)
            portfolio, trade_stats = await _build_portfolio_timeline(results, bmc, b_amt, m_pos, candle_cache)
            state["portfolio"] = portfolio
            state["portfolio_trade_stats"] = trade_stats
            state["portfolio_building"] = "completed"
            _logger.warning("[PORTFOLIO] Built %d entries for %d results (cache=%s)", len(portfolio), len(results), "hit" if candle_cache else "miss")
        except Exception as e:
            import traceback
            _logger.warning("[PORTFOLIO] Build failed: %s\n%s", e, traceback.format_exc())
            state["portfolio_building"] = "failed"
            state["message"] = f"Portfolio build failed: {e}"
            _scan_candle_cache.pop(scan_id, None)

    task = asyncio.create_task(_build())
    return {"status": "running", "message": "Portfolio building started"}


_load_task: asyncio.Task | None = None
_load_status: dict = {"status": "idle", "loaded": 0, "rows": 0, "error": ""}

@router.post("/load-data")
async def start_load_all_stock_data() -> dict:
    global _load_task, _load_status

    if _load_task and not _load_task.done():
        return {"status": "running", "message": "Already loading data"}

    _load_status = {"status": "running", "loaded": 0, "rows": 0, "error": ""}

    async def _do_load():
        global _load_status
        log_id = None
        try:
            await execute_non_query(
                "INSERT INTO data_load_logs (status, started_at) VALUES ('running', CURRENT_TIMESTAMP)"
            )
            log_id = (await execute_query(
                "SELECT MAX(id) FROM data_load_logs"
            ))[0][0]

            from app.services import kospi_data
            from app.services.data_provider import get_all_tickers, fetch_stock_data
            n = await kospi_data.sync_kospi_tickers()
            if n == 0:
                _load_status = {"status": "failed", "loaded": 0, "rows": 0, "error": "Failed to sync tickers"}
                return

            last_date = await kospi_data.get_last_trade_date()
            today = date.today()
            if last_date and last_date >= today:
                _load_status = {"status": "skipped", "loaded": 0, "rows": 0, "error": ""}
                print(f"[DATA-LOAD] Data up to date (last: {last_date})")
                return

            all_tickers = await get_all_tickers()
            sem = asyncio.Semaphore(3)

            if not last_date:
                print(f"[DATA-LOAD] First-time full load")
                stats = await kospi_data.load_all_historical()
                total_loaded = stats.get("success", 0)
                total_rows = stats.get("rows", 0)
                kosdaq_tickers = [t for t in all_tickers if t.get("market") == "KOSDAQ"]
                async def load_one_full(t_info):
                    async with sem:
                        data = await fetch_stock_data(t_info["ticker"])
                        if data:
                            n = await kospi_data.upsert_prices(t_info["ticker"], data)
                            return n
                        return 0
                results = await asyncio.gather(*[load_one_full(t) for t in kosdaq_tickers])
                kosdaq_loaded = sum(1 for r in results if r > 0)
                kosdaq_rows = sum(results)
            else:
                print(f"[DATA-LOAD] Incremental update from {last_date}")
                async def load_one_incr(t_info):
                    async with sem:
                        data = await fetch_stock_data(t_info["ticker"])
                        if not data:
                            return 0
                        new_data = [c for c in data if datetime.strptime(str(c["time"]), "%Y-%m-%d").date() > last_date]
                        if new_data:
                            n = await kospi_data.upsert_prices(t_info["ticker"], new_data)
                            return n
                        return 0
                results = await asyncio.gather(*[load_one_incr(t) for t in all_tickers])
                total_loaded = sum(1 for r in results if r > 0)
                total_rows = sum(results)
                kosdaq_loaded = 0
                kosdaq_rows = 0

            _load_status = {
                "status": "completed",
                "loaded": total_loaded + kosdaq_loaded,
                "rows": total_rows + kosdaq_rows,
                "kosdaq": kosdaq_loaded,
                "error": "",
            }
            if log_id:
                await execute_non_query(
                    "UPDATE data_load_logs SET status = 'completed', "
                    "kospi_loaded = :1, kosdaq_loaded = :2, total_rows = :3, "
                    "finished_at = CURRENT_TIMESTAMP WHERE id = :4",
                    [total_loaded, kosdaq_loaded, total_rows + kosdaq_rows, log_id],
                )
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(f"[DATA-LOAD] ERROR: {e}\n{tb}")
            _load_status = {"status": "failed", "loaded": 0, "rows": 0, "error": str(e)}
            if log_id:
                try:
                    await execute_non_query(
                        "UPDATE data_load_logs SET status = 'failed', error_msg = :1, "
                        "finished_at = CURRENT_TIMESTAMP WHERE id = :2",
                        [str(e), log_id],
                    )
                except Exception:
                    pass

    _load_task = asyncio.create_task(_do_load())
    return {"status": "started", "message": "Data loading started in background"}


@router.get("/load-data/status")
async def load_data_status() -> dict:
    return _load_status


@router.get("/load-data/logs")
async def load_data_logs() -> list[dict]:
    rows = await execute_query(
        "SELECT id, status, kospi_loaded, kosdaq_loaded, total_rows, error_msg, "
        "TO_CHAR(started_at + INTERVAL '9' HOUR, 'YYYY-MM-DD HH24:MI:SS'), "
        "TO_CHAR(finished_at + INTERVAL '9' HOUR, 'YYYY-MM-DD HH24:MI:SS') "
        "FROM data_load_logs ORDER BY id DESC FETCH FIRST 20 ROWS ONLY"
    )
    return [
        {
            "id": r[0],
            "status": r[1] or "",
            "kospi_loaded": int(r[2]) if r[2] else 0,
            "kosdaq_loaded": int(r[3]) if r[3] else 0,
            "total_rows": int(r[4]) if r[4] else 0,
            "error_msg": r[5] or "",
            "started_at": r[6] or "",
            "finished_at": r[7] or "",
        }
        for r in rows
    ]


async def _process_one_stock(
    ticker_info: dict, bmc: BMC, start_date: str | None, end_date: str | None,
    preloaded: list[dict] | None = None,
) -> list[dict] | None:
    ticker = ticker_info["ticker"]
    candles: list[dict] = []

    if preloaded is not None:
        candles = preloaded
    else:
        pool = get_pool()
        if pool:
            sql = (
                "SELECT trade_date, open_price, high_price, low_price, close_price, volume "
                "FROM stock_daily_prices WHERE ticker = :1"
            )
            binds = [ticker]
            bind_idx = 2
            if start_date:
                sql += f" AND trade_date >= TO_DATE(:{bind_idx},'YYYY-MM-DD')"
                binds.append(start_date)
                bind_idx += 1
            if end_date:
                sql += f" AND trade_date <= TO_DATE(:{bind_idx},'YYYY-MM-DD')"
                binds.append(end_date)
            sql += " ORDER BY trade_date"
            try:
                rows = await execute_query(sql, binds)
                if rows:
                    candles = [
                        {
                            "time": str(r[0].date() if hasattr(r[0], "date") else r[0]),
                            "open": float(r[1]),
                            "high": float(r[2]),
                            "low": float(r[3]),
                            "close": float(r[4]),
                            "volume": int(r[5]) if r[5] is not None else 0,
                        }
                        for r in rows
                    ]
            except Exception:
                pass

        if not candles:
            data = await fetch_stock_data(ticker)
            if not data:
                return None
            if start_date:
                data = [d for d in data if d["time"] >= start_date]
            if end_date:
                data = [d for d in data if d["time"] <= end_date]
            candles = data

    if not candles:
        return None

    results = await _run_on_data(ticker, candles, bmc)
    if results is None:
        return None

    for r in results:
        r["name"] = ticker_info["name"]
        r["sector"] = ticker_info["sector"]
        r["market"] = ticker_info.get("market", "")
    return results


async def _build_portfolio_timeline(results: list[dict], bmc: BMC, base_amt: float, max_pos: int, candle_cache: dict[str, list[dict]] | None = None) -> tuple[list[dict], dict]:
    closed_trades: list[dict] = []
    if not results or max_pos < 1:
        return [], {"closed": 0, "wins": 0, "losses": 0, "winRate": 0, "avgWin": 0, "avgLoss": 0, "profitFactor": 0, "bestPnl": 0, "worstPnl": 0, "totalReturnPct": 0, "totalProfit": 0}
    pos_size = base_amt / max_pos
    names: dict[str, str] = {r["ticker"]: r.get("name", "") for r in results}

    by_ticker: dict[str, list[dict]] = {}
    for r in results:
        by_ticker.setdefault(r["ticker"], []).append(r)

    by_date: dict[str, list[tuple]] = {}
    pool = get_pool()

    for ticker, ticker_results in by_ticker.items():
        candles: list[dict] | None = None
        if candle_cache and ticker in candle_cache:
            candles = candle_cache[ticker]
        if not candles and pool:
            try:
                rows = await execute_query(
                    "SELECT trade_date, open_price, high_price, low_price, close_price, volume "
                    "FROM stock_daily_prices WHERE ticker = :1 ORDER BY trade_date",
                    [ticker],
                )
                if rows:
                    candles = [
                        {
                            "time": str(r[0].date() if hasattr(r[0], "date") else r[0]),
                            "open": float(r[1]), "high": float(r[2]),
                            "low": float(r[3]), "close": float(r[4]),
                            "volume": int(r[5]) if r[5] is not None else 0,
                        }
                        for r in rows
                    ]
            except Exception:
                pass
        if not candles:
            candles = await fetch_stock_data(ticker)
            if not candles:
                continue
        ticker_results.sort(key=lambda r: r["entry_date"])
        for r in ticker_results:
            entry_idx = next((i for i, c in enumerate(candles) if c["time"] >= r["entry_date"]), 0)
            if entry_idx >= len(candles):
                continue
            entry = candles[entry_idx]
            entry_price = r.get("entry_price", entry["close"])
            ps = PositionState(
                ticker=ticker, entry_date=entry["time"], entry_price=entry_price,
                quantity=1, highest_price_since_entry=entry_price, config=bmc,
            )
            by_date.setdefault(entry["time"], []).append((ticker, "BUY", entry_price, None, False, False))
            for c in candles[entry_idx + 1:]:
                price = c["close"]
                sig, reason = ps.update_and_check_signal(price)
                peak = (ps.highest_price_since_entry - ps.entry_price) / ps.entry_price
                by_date.setdefault(c["time"], []).append((
                    ticker, sig, price, reason,
                    peak >= bmc.trailing_activation_pct and sig != "SELL",
                    ps.is_break_even_activated and sig != "SELL",
                ))
                if sig == "SELL":
                    break

    if not by_date:
        return [], _empty_trade_stats()

    active: dict[str, dict] = {}
    cash = base_amt
    portfolio = []
    all_dates = sorted(by_date)
    cm = bmc.commission + bmc.slippage
    se = bmc.commission + bmc.tax + bmc.slippage

    for di, date in enumerate(all_dates):
        if di > 0 and di % 50 == 0:
            await asyncio.sleep(0)
        events = by_date[date]

        # Phase 1: Handle BUY signals (deduct cash with costs, add positions)
        for ticker, sig, price, reason, is_trailing, is_be in events:
            if sig == "BUY" and ticker not in active and len(active) < max_pos:
                cost_per_share = price * (1 + cm)
                shares = int(pos_size / cost_per_share) if cost_per_share > 0 else 0
                if shares == 0:
                    continue
                cost = shares * cost_per_share
                if cost > cash:
                    continue
                cash -= cost
                active[ticker] = {"entry_price": price, "current_price": price, "shares": shares, "is_trailing": is_trailing, "is_be": is_be}

        # Phase 2: Update active positions with current price
        for ticker in list(active.keys()):
            for t2, sig, price, reason, is_trailing, is_be in events:
                if t2 == ticker:
                    active[ticker].update({"current_price": price, "signal": sig, "reason": reason, "is_trailing": is_trailing, "is_be": is_be})

        holdings = []
        for ticker, info in sorted(active.items()):
            sig = info.get("signal", "")
            if sig == "BUY":
                label = "매수"
            elif sig == "SELL":
                label = "매도"
            elif info.get("is_trailing"):
                label = "트레일링"
            elif info.get("is_be"):
                label = "BE"
            else:
                label = "홀드"
            entry = info["entry_price"]
            curr = info["current_price"]
            shares = info["shares"]
            pnl = (curr - entry) / entry if entry else 0
            profit_amt = (curr - entry) * shares
            holdings.append({
                "ticker": ticker, "name": names.get(ticker, ""),
                "entry_price": entry, "shares": shares,
                "current_price": curr, "status": label,
                "reason": info.get("reason"), "pnl_pct": round(pnl, 6),
                "profit_amt": round(profit_amt, 2),
            })

        # Phase 3: Handle SELL signals (add proceeds after costs)
        for ticker in list(active.keys()):
            for t2, sig, price, reason, is_trailing, is_be in events:
                if t2 == ticker and sig == "SELL":
                    info = active[ticker]
                    proceeds = price * info["shares"] * (1 - se)
                    cash += proceeds
                    ep = info["entry_price"]
                    trade_pnl = _calc_pnl(ep, price, bmc)
                    closed_trades.append({"pnl": trade_pnl, "entry_price": ep, "exit_price": price})
                    del active[ticker]
                    break

        equity = sum(h["current_price"] * h["shares"] for h in holdings if h["status"] != "매도")
        tv = cash + equity
        portfolio.append({
            "date": date, "holdings": holdings, "cash": round(cash, 2),
            "total_value": round(tv, 2), "positions_count": len(holdings),
            "pnl_pct": round((tv - base_amt) / base_amt, 6),
            "pnl_amt": round(tv - base_amt, 2),
        })

    trade_stats = _compute_trade_stats(closed_trades)
    trade_stats["totalReturnPct"] = round((portfolio[-1]["total_value"] - base_amt) / base_amt, 6)
    trade_stats["totalProfit"] = round(portfolio[-1]["total_value"] - base_amt, 2)
    return portfolio, trade_stats


def _empty_trade_stats() -> dict:
    return {"closed": 0, "wins": 0, "losses": 0, "winRate": 0, "avgWin": 0, "avgLoss": 0, "profitFactor": 0, "bestPnl": 0, "worstPnl": 0, "totalReturnPct": 0, "totalProfit": 0}


def _compute_trade_stats(trades: list[dict]) -> dict:
    closed = len(trades)
    if closed == 0:
        return _empty_trade_stats()
    wins = [t for t in trades if t["pnl"] > 0]
    losses = [t for t in trades if t["pnl"] <= 0]
    win_rate = len(wins) / closed if closed > 0 else 0
    avg_win = sum(t["pnl"] for t in wins) / len(wins) if wins else 0
    avg_loss = sum(t["pnl"] for t in losses) / len(losses) if losses else 0
    total_gain = sum(t["pnl"] for t in wins)
    total_loss = abs(sum(t["pnl"] for t in losses))
    pf = total_gain / total_loss if total_loss > 0 else (99 if total_gain > 0 else 0)
    best = max(t["pnl"] for t in trades)
    worst = min(t["pnl"] for t in trades)
    return {
        "closed": closed,
        "wins": len(wins),
        "losses": len(losses),
        "winRate": round(win_rate * 100, 1),
        "avgWin": round(avg_win * 100, 2),
        "avgLoss": round(avg_loss * 100, 2),
        "profitFactor": round(pf, 2),
        "bestPnl": round(best * 100, 2),
        "worstPnl": round(worst * 100, 2),
        "totalReturnPct": 0,
        "totalProfit": 0,
    }


@router.post("/scan/{scan_id}/cancel")
async def cancel_scan(scan_id: str) -> dict:
    state = _scan_states.get(scan_id)
    if not state:
        raise HTTPException(404, "Scan not found")
    _scan_cancel_flags[scan_id] = True
    task = _scan_tasks.get(scan_id)
    if task and not task.done():
        task.cancel()
    state["status"] = "cancelled"
    state["message"] = "Scan cancelled by user"
    return {"status": "cancelled", "scan_id": scan_id}


async def _run_scan(scan_id: str, req: TickerBacktestRequest) -> None:
    state = _scan_states[scan_id]
    bmc = _to_bmc(req.config)
    start_date = req.start_date
    end_date = req.end_date

    await asyncio.sleep(0)  # yield before any work for event loop I/O

    try:
        state["message"] = "Fetching tickers..."
        _logger.warning("[SCAN %s] Calling get_all_tickers()...", scan_id)
        all_tickers = await get_all_tickers()
        _logger.warning("[SCAN %s] get_all_tickers returned %d tickers", scan_id, len(all_tickers))
        total = len(all_tickers)
        state["total"] = total
        limit = req.config.rankingCandidateLimit or 9999
        min_vol = req.config.minVolume
        max_volat = req.config.maxVolatility

        # ── Step 1: Pre-filter candidates via SQL ──
        state["message"] = "Pre-filtering candidates from DB..."
        candidate_codes: set[str] = set()
        pool = get_pool()
        _logger.warning("[SCAN %s] pool=%s start_date=%s end_date=%s", scan_id, pool, start_date, end_date)
        if pool:
            # Always pick top candidates by volume to limit processing
            cand_limit = min(limit if limit > 0 else 9999, 500)
            _logger.warning("[SCAN %s] cand_limit=%d", scan_id, cand_limit)
            # Use trailing ~6mo (120 trading days) from end_date for volume/volatility ranking
            rank_start = (datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=180)).strftime("%Y-%m-%d") if end_date else start_date
            rank_sql = """
                WITH ticker_stats AS (
                    SELECT ticker,
                           AVG(volume) AS avg_vol,
                           AVG((high_price - low_price) / NULLIF(close_price, 0)) AS avg_volat
                    FROM (
                        SELECT ticker, volume, high_price, low_price, close_price
                        FROM stock_daily_prices
                        WHERE trade_date >= TO_DATE(:1, 'YYYY-MM-DD')
                          AND trade_date <= TO_DATE(:2, 'YYYY-MM-DD')
                    )
                    GROUP BY ticker
                )
                SELECT ticker FROM ticker_stats
                WHERE 1=1
                """
            binds: list = [rank_start, end_date]
            bi = 3
            if min_vol > 0:
                rank_sql += f" AND avg_vol > :{bi}"
                binds.append(float(min_vol))
                bi += 1
            if max_volat < 1.0:
                rank_sql += f" AND avg_volat < :{bi}"
                binds.append(float(max_volat))
                bi += 1
            rank_sql += f"""
                ORDER BY avg_vol DESC
                OFFSET 0 ROWS FETCH NEXT {cand_limit} ROWS ONLY
            """
            try:
                _logger.warning("[SCAN %s] Running pre-filter query...", scan_id)
                rows = await execute_query(rank_sql, binds)
                _logger.warning("[SCAN %s] pre-filter returned %d rows", scan_id, len(rows) if rows else 0)
                candidate_codes = {str(r[0]) for r in rows}
                _logger.warning("[SCAN %s] candidate_codes=%d", scan_id, len(candidate_codes))
            except Exception as e:
                _logger.warning("[SCAN %s] Pre-filter query error: %s", scan_id, e)

        # When pre-filter succeeds, only process DB candidates; Naver fallback is always stale
        if candidate_codes:
            db_tickers = [t for t in all_tickers if t["ticker"] in candidate_codes]
            naver_tickers = []
        else:
            db_tickers = all_tickers
            naver_tickers = []

        total_candidates = len(db_tickers) + len(naver_tickers)
        state["total"] = total_candidates
        state["message"] = f"Processing {total_candidates} candidates (DB:{len(db_tickers)} Naver:{len(naver_tickers)})..."
        _logger.warning("[SCAN %s] Starting batch loop: %d db + %d naver = %d total", scan_id, len(db_tickers), len(naver_tickers), total_candidates)

        # ── Step 2: Process candidates in batches ──
        DB_BATCH = 1000
        BATCH = 100
        all_candidates = db_tickers + naver_tickers
        done = 0
        pool = _get_process_pool()
        loop = asyncio.get_running_loop()

        for batch_start in range(0, len(all_candidates), BATCH):
            if _scan_cancel_flags.get(scan_id):
                state["status"] = "cancelled"
                state["message"] = f"Scan cancelled ({done}/{total_candidates} processed)"
                _logger.warning("[SCAN %s] Cancelled by user", scan_id)
                return

            batch_tickers = all_candidates[batch_start:batch_start + BATCH]
            ticker_codes = [t["ticker"] for t in batch_tickers]
            is_db_batch = any(t["ticker"] in candidate_codes for t in batch_tickers) if candidate_codes else True

            await asyncio.sleep(0)

            batch_map: dict[str, list[dict]] = {}
            if is_db_batch:
                for db_start in range(0, len(ticker_codes), DB_BATCH):
                    db_codes = ticker_codes[db_start:db_start + DB_BATCH]
                    binds_q = list(db_codes)
                    ph = ', '.join(f':{j + 1}' for j in range(len(db_codes)))
                    sql = (
                        "SELECT ticker, trade_date, open_price, high_price, low_price, close_price, volume "
                        "FROM stock_daily_prices WHERE ticker IN (" + ph + ")"
                    )
                    bi_q = len(db_codes) + 1
                    if start_date:
                        sql += f" AND trade_date >= TO_DATE(:{bi_q},'YYYY-MM-DD')"
                        binds_q.append(start_date)
                        bi_q += 1
                    if end_date:
                        sql += f" AND trade_date <= TO_DATE(:{bi_q},'YYYY-MM-DD')"
                        binds_q.append(end_date)
                    sql += " ORDER BY ticker, trade_date"
                    try:
                        rows = await execute_query(sql, binds_q)
                        for r_idx, r in enumerate(rows):
                            if r_idx > 0 and r_idx % 1000 == 0:
                                await asyncio.sleep(0)
                            t = str(r[0])
                            candle = {
                                "time": str(r[1].date() if hasattr(r[1], "date") else r[1]),
                                "open": float(r[2]),
                                "high": float(r[3]),
                                "low": float(r[4]),
                                "close": float(r[5]),
                                "volume": int(r[6]) if r[6] is not None else 0,
                            }
                            batch_map.setdefault(t, []).append(candle)
                    except Exception as e:
                        print(f"[WARN] DB batch failed ({db_start}..{db_start + len(db_codes)}): {e}")
            else:
                async def fetch_one(t_info):
                    t = t_info["ticker"]
                    data = await fetch_stock_data(t)
                    if not data:
                        return t, None
                    return t, data

                tasks = [fetch_one(t_info) for t_info in batch_tickers]
                gathered = await asyncio.gather(*tasks)
                batch_map = {t: data for t, data in gathered if data}

            await asyncio.sleep(0)
            _logger.warning("[SCAN %s] Starting batch %d with %d tickers", scan_id, batch_start // BATCH + 1, len(batch_tickers))

            # Process all tickers in batch in parallel via process pool (2 cores)
            pool_tasks = []
            for t_info in batch_tickers:
                candles = batch_map.get(t_info["ticker"])
                if candles:
                    pool_tasks.append(
                        loop.run_in_executor(pool, _run_on_data_sync, t_info["ticker"], candles, bmc)
                    )
                else:
                    pool_tasks.append(None)

            completed = await asyncio.gather(*[t for t in pool_tasks if t is not None])
            batch_results = []
            pt_idx = 0
            for t_info in batch_tickers:
                pt = pool_tasks[pt_idx]
                pt_idx += 1
                if pt is not None:
                    r = completed.pop(0)
                    if r:
                        for sig in r:
                            sig["name"] = t_info["name"]
                            sig["sector"] = t_info["sector"]
                            sig["market"] = t_info.get("market", "")
                        batch_results.append(r)
                    else:
                        batch_results.append(None)
                else:
                    batch_results.append(None)

            _logger.warning("[SCAN %s] Batch completed", scan_id)
            for idx, result_list in enumerate(batch_results):
                done += 1
                state["processed"] = done
                if result_list:
                    for r in result_list:
                        state["results"].append(r)
                    state["completed"] += len(result_list)

                ticker = batch_tickers[idx]["ticker"]
                if result_list and ticker in batch_map:
                    _scan_candle_cache.setdefault(scan_id, {})[ticker] = batch_map[ticker]

            state["message"] = f"({done}/{total_candidates}) {state['completed']} signals found"

        state["status"] = "completed"
        state["message"] = f"Scan completed. {state['completed']} signals found across {total} stocks."

    except asyncio.CancelledError:
        state["status"] = "cancelled"
        state["message"] = f"Scan cancelled ({state['processed']}/{state['total']} processed)"
        _logger.warning("[SCAN %s] Cancelled via CancelledError", scan_id)
    except Exception as e:
        state["message"] = f"Error: {e}"


# ── Saved configs ──
@router.get("/configs")
async def list_configs() -> list[dict]:
    rows = await execute_query(
        "SELECT id, name, params, result_summary, is_active, "
        "TO_CHAR(created_at + INTERVAL '9' HOUR, 'YYYY-MM-DD HH24:MI:SS') FROM saved_configs "
        "ORDER BY created_at DESC"
    )
    result = []
    for r in rows:
        result.append({
            "id": r[0],
            "name": r[1] or "",
            "params": r[2] or "",
            "result_summary": r[3] or "",
            "is_active": r[4] == "Y" if r[4] else False,
            "created_at": r[5] or "",
        })
    return result


class SaveConfigRequest(BaseModel):
    name: str = ""
    params: dict[str, Any] = {}
    start_date: str = ""
    end_date: str = ""
    base_amt: float = 0.0
    result_summary: dict[str, Any] = {}


@router.post("/configs/save")
async def save_config(req: SaveConfigRequest) -> dict:
    params_json = json.dumps(req.params)
    summary_data = {"start_date": req.start_date, "end_date": req.end_date, "base_amt": req.base_amt}
    if req.result_summary:
        summary_data.update(req.result_summary)
    summary = json.dumps(summary_data)
    try:
        await execute_non_query(
            "INSERT INTO saved_configs (name, params, result_summary) VALUES (:1, :2, :3)",
            [req.name, params_json, summary],
        )
        return {"status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/configs/{config_id}/activate")
async def activate_config(config_id: int) -> dict:
    await execute_non_query("UPDATE saved_configs SET is_active = 'N'")
    await execute_non_query(
        "UPDATE saved_configs SET is_active = 'Y' WHERE id = :1", [config_id]
    )
    return {"status": "activated", "id": config_id}


@router.post("/configs/deactivate")
async def deactivate_config() -> dict:
    await execute_non_query("UPDATE saved_configs SET is_active = 'N'")
    return {"status": "deactivated"}


class DeleteConfigsRequest(BaseModel):
    ids: list[int] = []


@router.post("/configs/delete")
async def delete_configs(req: DeleteConfigsRequest) -> dict:
    if not req.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    placeholders = ", ".join(f":{i+1}" for i in range(len(req.ids)))
    await execute_non_query(
        f"DELETE FROM saved_configs WHERE id IN ({placeholders})",
        req.ids,
    )
    return {"status": "deleted", "count": len(req.ids)}


@router.get("/configs/{config_id}/portfolio")
async def get_config_portfolio(config_id: int) -> list[dict]:
    row = await execute_query(
        "SELECT portfolio_data FROM saved_configs WHERE id = :1", [config_id]
    )
    if row and row[0][0]:
        try:
            return json.loads(row[0][0])
        except Exception:
            pass
    return []


# ── Breadth ──
@router.get("/breadth")
async def get_breadth() -> dict:
    row = await execute_query(
        "SELECT breadth_pct, total_stocks, above_ma, "
        "TO_CHAR(calculated_at, 'YYYY-MM-DD HH24:MI:SS') "
        "FROM market_breadth ORDER BY calculated_at DESC FETCH FIRST 1 ROW ONLY"
    )
    if row:
        return {
            "breadth_pct": float(row[0][0]) if row[0][0] else 0,
            "total_stocks": int(row[0][1]) if row[0][1] else 0,
            "above_ma": int(row[0][2]) if row[0][2] else 0,
            "calculated_at": row[0][3] or "",
        }
    return {"breadth_pct": 0, "total_stocks": 0, "above_ma": 0, "calculated_at": ""}


@router.post("/breadth/refresh")
async def refresh_breadth() -> dict:
    """Calculate market breadth: % of stocks above 20-day MA."""
    try:
        # Get latest trade date
        date_row = await execute_query(
            "SELECT MAX(trade_date) FROM stock_daily_prices"
        )
        if not date_row or not date_row[0][0]:
            return {"error": "No price data"}
        latest = date_row[0][0]

        # For breadth, check all stocks with data on latest date
        # Close price > MA(20) using self-join with 20 prior days
        sql = """
        WITH latest_prices AS (
            SELECT ticker, close_price, trade_date,
                AVG(close_price) OVER (
                    PARTITION BY ticker ORDER BY trade_date
                    ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
                ) AS ma20
            FROM stock_daily_prices
            WHERE trade_date <= :1
        ),
        ranked AS (
            SELECT ticker, close_price, ma20,
                ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY trade_date DESC) AS rn
            FROM latest_prices
        )
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN close_price > ma20 THEN 1 ELSE 0 END) AS above_ma
        FROM ranked WHERE rn = 1 AND close_price IS NOT NULL AND ma20 IS NOT NULL
        """
        rows = await execute_query(sql, [latest])
        total = int(rows[0][0]) if rows and rows[0][0] else 0
        above = int(rows[0][1]) if rows and rows[0][1] else 0
        pct = round(above / total, 4) if total > 0 else 0

        await execute_non_query(
            "INSERT INTO market_breadth (breadth_pct, total_stocks, above_ma) "
            "VALUES (:1, :2, :3)",
            [pct, total, above],
        )

        return {
            "breadth_pct": pct,
            "total_stocks": total,
            "above_ma": above,
            "calculated_at": str(datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        }
    except Exception as e:
        return {"error": str(e)}


# ── Trade logs ──
@router.get("/trades")
async def list_trade_logs(limit: int = 50, ticker: str = "") -> list[dict]:
    if ticker:
        sql = "SELECT id, ticker, action, price, quantity, reason, TO_CHAR(traded_at, 'YYYY-MM-DD HH24:MI:SS') FROM trade_logs WHERE ticker = :1 ORDER BY traded_at DESC FETCH FIRST :2 ROWS ONLY"
        params = [ticker, limit]
    else:
        sql = "SELECT id, ticker, action, price, quantity, reason, TO_CHAR(traded_at, 'YYYY-MM-DD HH24:MI:SS') FROM trade_logs ORDER BY traded_at DESC FETCH FIRST :1 ROWS ONLY"
        params = [limit]
    rows = await execute_query(sql, params)
    result = []
    for r in rows:
        result.append({
            "id": r[0],
            "ticker": r[1],
            "action": r[2],
            "price": float(r[3]) if r[3] else None,
            "quantity": int(r[4]) if r[4] else None,
            "reason": r[5],
            "traded_at": r[6] or "",
        })
    return result


# ── Scheduler config ──
@router.get("/scheduler-config")
async def get_scheduler_config() -> dict:
    row = await execute_query(
        "SELECT interval_seconds, breadth_threshold, breadth_upper "
        "FROM scheduler_config ORDER BY id DESC FETCH FIRST 1 ROW ONLY"
    )
    if row:
        return {
            "interval_seconds": int(row[0][0]) if row[0][0] else 60,
            "breadth_threshold": float(row[0][1]) if row[0][1] else 0.3,
            "breadth_upper": float(row[0][2]) if len(row[0]) > 2 and row[0][2] else 0.7,
        }
    return {"interval_seconds": 60, "breadth_threshold": 0.3, "breadth_upper": 0.7}


@router.post("/scheduler-config")
async def update_scheduler_config(data: dict) -> dict:
    interval = int(data.get("interval_seconds", 60))
    threshold = float(data.get("breadth_threshold", 0.3))
    upper = float(data.get("breadth_upper", 0.7))
    await execute_non_query(
        "INSERT INTO scheduler_config (interval_seconds, breadth_threshold, breadth_upper) VALUES (:1, :2, :3)",
        [interval, threshold, upper],
    )
    return {"status": "updated", "interval_seconds": interval, "breadth_threshold": threshold, "breadth_upper": upper}

