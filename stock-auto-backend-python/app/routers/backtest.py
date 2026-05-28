from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "stock-auto-backtest" / "src"))

from fastapi import APIRouter, HTTPException
from app.database import execute_query, get_pool
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
from app.services.data_provider import fetch_stock_data, get_kospi_tickers
from position_manager import BacktestConfig as BMC, PositionState  # type: ignore

router = APIRouter(prefix="/api/backtest", tags=["backtest"])

_scan_states: dict[str, dict] = {}
_scan_tasks: dict[str, asyncio.Task] = {}


def _to_bmc(cfg) -> BMC:
    return BMC(
        fixed_take_profit_pct=cfg.fixedTakeProfitPct,
        break_even_activation_pct=cfg.breakEvenActivationPct,
        trailing_activation_pct=cfg.trailingActivationPct,
        trailing_stop_pct=cfg.trailingStopPct,
        stall_exit_days=cfg.stallExitDays,
    )


def _run_on_data(ticker: str, data: list[dict], bmc: BMC) -> dict | None:
    if len(data) < 20:
        return None
    entry = data[0]
    state = PositionState(
        ticker=ticker,
        entry_date=entry["time"],
        entry_price=entry["close"],
        quantity=1,
        highest_price_since_entry=entry["close"],
        config=bmc,
    )
    for c in data[1:]:
        sig, reason = state.update_and_check_signal(c["close"])
        if sig == "SELL":
            return {
                "ticker": ticker,
                "entry_date": entry["time"],
                "entry_price": entry["close"],
                "exit_date": c["time"],
                "exit_reason": reason,
                "exit_price": c["close"],
                "pnl": (c["close"] - entry["close"]) / entry["close"],
                "holding_days": state.holding_days,
            }
    last = data[-1]
    return {
        "ticker": ticker,
        "entry_date": entry["time"],
        "entry_price": entry["close"],
        "exit_date": None,
        "exit_reason": None,
        "exit_price": last["close"],
        "pnl": (last["close"] - entry["close"]) / entry["close"],
        "holding_days": state.holding_days,
    }


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

    for i, c in enumerate(req.candles):
        price = c.close
        sig, reason = state.update_and_check_signal(price)
        trades.append(
            TradeEvent(day=i + 1, date=c.time, signal=sig, reason=reason, price=price)
        )
        if sig == "SELL" and exit_day is None:
            exit_day = i + 1
            exit_reason = reason

    chart_data = make_chart_data(
        [c.time for c in req.candles],
        [c.open for c in req.candles],
        [c.high for c in req.candles],
        [c.low for c in req.candles],
        [c.close for c in req.candles],
    )
    markers = make_markers(req.entryDate, [t.model_dump() for t in trades])

    last_price = req.candles[-1].close
    pnl = (last_price - req.entryPrice) / req.entryPrice

    return BacktestResponse(
        chart_data=[Candle(**d) for d in chart_data],
        markers=[Marker(**m) for m in markers],
        trades=trades,
        pnl=pnl,
        exit_day=exit_day,
        exit_reason=exit_reason,
    )


@router.post("/ticker", response_model=BacktestResponse)
async def run_ticker_backtest(req: TickerBacktestRequest) -> BacktestResponse:
    pool = get_pool()
    candles: list[Candle] = []

    if pool:
        sql = (
            "SELECT trade_date, open_price, high_price, low_price, close_price "
            "FROM stock_daily_prices WHERE ticker = :1 ORDER BY trade_date"
        )
        rows = await execute_query(sql, [req.ticker])
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
    task = asyncio.create_task(_run_scan(scan_id, req))
    _scan_tasks[scan_id] = task
    state["status"] = "running"
    return ScanStatus(**state)


@router.get("/scan/{scan_id}", response_model=ScanStatus)
async def get_scan_status(scan_id: str) -> ScanStatus:
    state = _scan_states.get(scan_id)
    if not state:
        return ScanStatus(
            scan_id=scan_id, status="failed", total=0, processed=0,
            completed=0, results=[], message="Scan not found",
        )
    return ScanStatus(**state)


async def _run_scan(scan_id: str, req: TickerBacktestRequest) -> None:
    state = _scan_states[scan_id]
    bmc = _to_bmc(req.config)

    try:
        state["message"] = "Fetching KOSPI tickers..."
        tickers = await get_kospi_tickers()
        state["total"] = len(tickers)

        for t in tickers:
            state["processed"] += 1
            state["message"] = f"({state['processed']}/{state['total']}) {t['ticker']} {t['name']}"

            data = await fetch_stock_data(t["ticker"])
            if not data:
                continue

            result = _run_on_data(t["ticker"], data, bmc)
            if result is None:
                continue

            result["name"] = t["name"]
            result["sector"] = t["sector"]
            state["results"].append(result)
            state["completed"] += 1

        state["status"] = "completed"
        state["message"] = f"Scan completed. {state['completed']}/{state['total']} stocks processed."

    except Exception as e:
        state["status"] = "failed"
        state["message"] = f"Error: {e}"
