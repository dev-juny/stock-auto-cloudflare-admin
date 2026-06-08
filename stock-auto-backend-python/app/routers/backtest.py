from __future__ import annotations

import asyncio
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "stock-auto-backtest" / "src"))

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
        min_volume=cfg.minVolume,
        max_volatility=cfg.maxVolatility,
        ranking_candidate_limit=cfg.rankingCandidateLimit,
        max_concurrent_positions=cfg.maxConcurrentPositions,
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
        try:
            from app.services import kospi_data
            n = await kospi_data.sync_kospi_tickers()
            if n == 0:
                _load_status = {"status": "failed", "loaded": 0, "rows": 0, "error": "Failed to sync tickers"}
                return
            stats = await kospi_data.load_all_historical()
            _load_status = {"status": "completed", "loaded": stats.get("success", 0), "rows": stats.get("rows", 0), "error": ""}
            try:
                from app.database import execute_non_query
                msg = f"[DATA-LOAD] {stats.get('success', 0)} stocks, {stats.get('rows', 0)} rows loaded"
                await execute_non_query(
                    "INSERT INTO trade_logs (ticker, action, price, quantity, reason) "
                    "VALUES (:1, 'INFO', 0, 0, :2)",
                    ["SYSTEM", msg],
                )
            except Exception:
                pass
        except Exception as e:
            _load_status = {"status": "failed", "loaded": 0, "rows": 0, "error": str(e)}

    _load_task = asyncio.create_task(_do_load())
    return {"status": "started", "message": "Data loading started in background"}


@router.get("/load-data/status")
async def load_data_status() -> dict:
    return _load_status


async def _process_one_stock(
    ticker_info: dict, bmc: BMC, start_date: str | None, end_date: str | None,
    preloaded: list[dict] | None = None,
) -> dict | None:
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

    # Filter by volume & volatility
    if bmc.min_volume > 0 or bmc.max_volatility < 1.0:
        volumes = [c.get("volume", 0) or 0 for c in candles]
        avg_volume = sum(volumes) / len(volumes) if volumes else 0
        if bmc.min_volume > 0 and avg_volume < bmc.min_volume:
            return None
        if bmc.max_volatility < 1.0:
            ranges = []
            for c in candles:
                high = c.get("high", 0) or 0
                low = c.get("low", 0) or 0
                close = c.get("close", 1) or 1
                ranges.append((high - low) / close)
            avg_volatility = sum(ranges) / len(ranges) if ranges else 0
            if avg_volatility > bmc.max_volatility:
                return None

    result = _run_on_data(ticker, candles, bmc)
    if result is None:
        return None

    result["name"] = ticker_info["name"]
    result["sector"] = ticker_info["sector"]
    result["market"] = ticker_info.get("market", "")
    return result


async def _build_portfolio_timeline(results: list[dict], candle_map: dict[str, list[dict]], bmc: BMC, base_amt: float, max_pos: int) -> list[dict]:
    if not results or max_pos < 1:
        return []
    pos_size = base_amt / max_pos
    names: dict[str, str] = {r["ticker"]: r.get("name", "") for r in results}

    # For each result, simulate day-by-day to capture trailing/BE status
    all_trades: dict[str, list[dict]] = {}
    for r in results:
        ticker = r["ticker"]
        candles = candle_map.get(ticker)
        if not candles:
            raw = await fetch_stock_data(ticker)
            if not raw:
                continue
            candles = raw

        entry_idx = next((i for i, c in enumerate(candles) if c["time"] >= r["entry_date"]), 0)
        if entry_idx >= len(candles):
            continue

        entry = candles[entry_idx]
        state = PositionState(
            ticker=ticker, entry_date=entry["time"], entry_price=entry["close"],
            quantity=1, highest_price_since_entry=entry["close"], config=bmc,
        )

        trades = [{
            "date": entry["time"], "signal": "BUY", "price": entry["close"], "reason": None,
            "is_trailing": False, "is_be": False,
        }]
        for c in candles[entry_idx + 1:]:
            price = c["close"]
            sig, reason = state.update_and_check_signal(price)
            peak = (state.highest_price_since_entry - state.entry_price) / state.entry_price
            trades.append({
                "date": c["time"], "signal": sig, "reason": reason, "price": price,
                "is_trailing": (peak >= bmc.trailing_activation_pct and sig != "SELL"),
                "is_be": (state.is_break_even_activated and sig != "SELL"),
            })
            if sig == "SELL":
                break
        all_trades[ticker] = trades

    all_dates = sorted({d["date"] for tl in all_trades.values() for d in tl})
    if not all_dates:
        return []

    active: dict[str, dict] = {}
    cash = base_amt
    portfolio = []

    for date in all_dates:
        for ticker, trades in all_trades.items():
            td = next((d for d in trades if d["date"] == date), None)
            if not td:
                continue

            if td["signal"] == "BUY" and ticker not in active and len(active) < max_pos:
                active[ticker] = dict(td)
                active[ticker]["entry_price"] = td["price"]
                cash -= pos_size

        for ticker in list(active.keys()):
            td = next((d for d in all_trades.get(ticker, []) if d["date"] == date), None)
            if td:
                active[ticker].update(td)
                active[ticker]["current_price"] = td["price"]

        holdings = []
        for ticker, info in sorted(active.items()):
            if info["signal"] == "BUY":
                label = "매수"
            elif info["signal"] == "SELL":
                label = "매도"
            elif info["is_trailing"]:
                label = "트레일링"
            elif info["is_be"]:
                label = "BE"
            else:
                label = "홀드"
            entry = info["entry_price"]
            curr = info["current_price"]
            pnl = (curr - entry) / entry if entry else 0
            shares = int(pos_size / entry) if entry > 0 else 0
            holdings.append({
                "ticker": ticker, "name": names.get(ticker, ""),
                "entry_price": entry, "shares": shares,
                "current_price": curr, "status": label,
                "reason": info.get("reason"), "pnl_pct": round(pnl, 6),
                "profit_amt": round(pnl * pos_size, 2),
            })

        for ticker in list(active.keys()):
            if active[ticker]["signal"] == "SELL":
                info = active[ticker]
                pnl = (info["current_price"] - info["entry_price"]) / info["entry_price"]
                cash += pos_size * (1 + pnl)
                del active[ticker]

        equity = sum(h["pnl_pct"] * pos_size + pos_size for h in holdings if h["status"] != "매도")
        tv = cash + equity
        portfolio.append({
            "date": date, "holdings": holdings, "cash": round(cash, 2),
            "total_value": round(tv, 2), "positions_count": len(holdings),
            "pnl_pct": round((tv - base_amt) / base_amt, 6),
            "pnl_amt": round(tv - base_amt, 2),
        })

    return portfolio


async def _run_scan(scan_id: str, req: TickerBacktestRequest) -> None:
    state = _scan_states[scan_id]
    bmc = _to_bmc(req.config)
    start_date = req.start_date
    end_date = req.end_date

    try:
        state["message"] = "Fetching tickers..."
        tickers = await get_all_tickers()
        state["total"] = len(tickers)

        # Pre-fetch Oracle candle data in batches
        state["message"] = "Loading market data from DB..."
        candle_map: dict[str, list[dict]] = {}
        pool = get_pool()
        if pool:
            BATCH = 1000
            codes = [t["ticker"] for t in tickers]
            for i in range(0, len(codes), BATCH):
                batch = codes[i:i + BATCH]
                binds = list(batch)
                ph = ', '.join(f':{j + 1}' for j in range(len(batch)))
                sql = (
                    "SELECT ticker, trade_date, open_price, high_price, low_price, close_price, volume "
                    "FROM stock_daily_prices WHERE ticker IN (" + ph + ")"
                )
                bi = len(batch) + 1
                if start_date:
                    sql += f" AND trade_date >= TO_DATE(:{bi},'YYYY-MM-DD')"
                    binds.append(start_date)
                    bi += 1
                if end_date:
                    sql += f" AND trade_date <= TO_DATE(:{bi},'YYYY-MM-DD')"
                    binds.append(end_date)
                sql += " ORDER BY ticker, trade_date"
                try:
                    rows = await execute_query(sql, binds)
                    for r in rows:
                        t = str(r[0])
                        candle = {
                            "time": str(r[1].date() if hasattr(r[1], "date") else r[1]),
                            "open": float(r[2]),
                            "high": float(r[3]),
                            "low": float(r[4]),
                            "close": float(r[5]),
                            "volume": int(r[6]) if r[6] is not None else 0,
                        }
                        candle_map.setdefault(t, []).append(candle)
                except Exception as e:
                    print(f"[WARN] Batch query failed ({i}..{i + len(batch)}): {e}")

        state["message"] = f"Processing {state['total']} stocks..."
        sem = asyncio.Semaphore(100)

        async def process(t):
            async with sem:
                ticker = t["ticker"]
                preloaded = candle_map.get(ticker)
                return await _process_one_stock(t, bmc, start_date, end_date, preloaded=preloaded)

        done = 0
        pending = [process(t) for t in tickers]
        for coro in asyncio.as_completed(pending):
            result = await coro
            done += 1
            state["processed"] = done
            if result:
                state["results"].append(result)
                state["completed"] += 1
            if done % 50 == 0:
                state["message"] = f"({done}/{state['total']}) {state['completed']} signals found"

        # Apply rankingCandidateLimit
        limit = req.config.rankingCandidateLimit
        if limit > 0 and len(state["results"]) > limit:
            state["results"].sort(key=lambda r: abs(r.get("pnl", 0)), reverse=True)
            state["results"] = state["results"][:limit]
            state["completed"] = len(state["results"])

        # Portfolio simulation
        b_amt = req.base_amt
        m_pos = req.config.maxConcurrentPositions
        portfolio = await _build_portfolio_timeline(state["results"], candle_map, bmc, b_amt or 1_000_000, m_pos or 9999)
        state["portfolio"] = portfolio

        # Save config to saved_configs
        try:
            params_json = json.dumps(req.config.model_dump())
            result_summary = json.dumps({
                "completed": state["completed"],
                "total": state["total"],
                "start_date": state.get("start_date", req.start_date),
                "end_date": state.get("end_date", req.end_date),
                "base_amt": req.base_amt,
            })
            await execute_non_query(
                "INSERT INTO saved_configs (name, params, result_summary) "
                "VALUES (:1, :2, :3)",
                [f"Scan {req.start_date}~{req.end_date}", params_json, result_summary],
            )
        except Exception as e:
            print(f"[BACKTEST] Save config error: {e}")

        state["status"] = "completed"
        state["message"] = f"Scan completed. {state['completed']}/{state['total']} stocks processed."

    except Exception as e:
        state["status"] = "failed"
        state["message"] = f"Error: {e}"


# ── Saved configs ──
@router.get("/configs")
async def list_configs() -> list[dict]:
    rows = await execute_query(
        "SELECT id, name, params, result_summary, is_active, "
        "TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') FROM saved_configs "
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


@router.post("/configs/{config_id}/activate")
async def activate_config(config_id: int) -> dict:
    await execute_non_query("UPDATE saved_configs SET is_active = 'N'")
    await execute_non_query(
        "UPDATE saved_configs SET is_active = 'Y' WHERE id = :1", [config_id]
    )
    return {"status": "activated", "id": config_id}


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
async def list_trade_logs(limit: int = 50) -> list[dict]:
    rows = await execute_query(
        "SELECT id, ticker, action, price, quantity, reason, "
        "TO_CHAR(traded_at, 'YYYY-MM-DD HH24:MI:SS') "
        "FROM trade_logs ORDER BY traded_at DESC FETCH FIRST :1 ROWS ONLY",
        [limit],
    )
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
        "SELECT interval_seconds, breadth_threshold "
        "FROM scheduler_config ORDER BY id DESC FETCH FIRST 1 ROW ONLY"
    )
    if row:
        return {
            "interval_seconds": int(row[0][0]) if row[0][0] else 60,
            "breadth_threshold": float(row[0][1]) if row[0][1] else 0.3,
        }
    return {"interval_seconds": 60, "breadth_threshold": 0.3}


@router.post("/scheduler-config")
async def update_scheduler_config(data: dict) -> dict:
    interval = int(data.get("interval_seconds", 60))
    threshold = float(data.get("breadth_threshold", 0.3))
    await execute_non_query(
        "INSERT INTO scheduler_config (interval_seconds, breadth_threshold) VALUES (:1, :2)",
        [interval, threshold],
    )
    return {"status": "updated", "interval_seconds": interval, "breadth_threshold": threshold}
