from __future__ import annotations

import asyncio
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "stock-auto-backtest" / "src"))

from app.database import _db_executor, execute_non_query, execute_query, get_pool
from app.services.data_provider import fetch_stock_data, get_kospi_tickers


async def sync_kospi_tickers() -> int:
    tickers = await get_kospi_tickers()
    if not tickers:
        return 0
    pool = get_pool()
    if not pool:
        return 0
    conn = pool.acquire()
    try:
        cur = conn.cursor()
        for t in tickers:
            try:
                cur.execute(
                    "INSERT INTO kospi_stocks (ticker, name, sector) "
                    "VALUES (:1, :2, :3)",
                    [t["ticker"], t["name"], t["sector"]],
                )
            except Exception:
                conn.commit()
                cur.execute(
                    "UPDATE kospi_stocks SET name = :1, sector = :2, "
                    "updated_at = CURRENT_TIMESTAMP WHERE ticker = :3",
                    [t["name"], t["sector"], t["ticker"]],
                )
        conn.commit()
        print(f"[KOSPI] Synced {len(tickers)} tickers")
        return len(tickers)
    finally:
        conn.close()


async def upsert_prices(ticker: str, candles: list[dict[str, Any]]) -> int:
    pool = get_pool()
    if not pool or not candles:
        return 0

    rows = []
    for c in candles:
        d = c["time"]
        if isinstance(d, str):
            d = datetime.strptime(str(d), "%Y-%m-%d").date()
        rows.append([ticker, d.isoformat(), c["open"], c["high"], c["low"], c["close"], c["volume"]])

    loop = asyncio.get_running_loop()
    def _do_upsert():
        conn = pool.acquire()
        try:
            cur = conn.cursor()
            for row in rows:
                try:
                    cur.execute(
                        "INSERT INTO stock_daily_prices "
                        "(ticker, trade_date, open_price, high_price, low_price, close_price, volume) "
                        "VALUES (:1, TO_DATE(:2, 'YYYY-MM-DD'), :3, :4, :5, :6, :7)",
                        row,
                    )
                except Exception:
                    conn.commit()
                    cur.execute(
                        "UPDATE stock_daily_prices SET open_price = :3, high_price = :4, "
                        "low_price = :5, close_price = :6, volume = :7 "
                        "WHERE ticker = :1 AND trade_date = TO_DATE(:2, 'YYYY-MM-DD')",
                        row,
                    )
            conn.commit()
            return len(rows)
        finally:
            conn.close()

    return await loop.run_in_executor(_db_executor, _do_upsert)


async def _load_one_stock(
    ticker: str, name: str
) -> tuple[str, int, str | None]:
    try:
        data = await fetch_stock_data(ticker)
        if not data:
            return ticker, 0, "no data"
        n = await upsert_prices(ticker, data)
        return ticker, n, None
    except Exception as e:
        return ticker, 0, str(e)


async def load_all_historical(
    progress: Optional[Callable[[int, int, str, str], None]] = None,
) -> dict[str, Any]:
    pool = get_pool()
    if not pool:
        return {"status": "error", "message": "Oracle not available"}

    rows = await execute_query(
        "SELECT ticker, name FROM kospi_stocks ORDER BY ticker"
    )
    stats: dict[str, Any] = {
        "total": len(rows),
        "success": 0,
        "failed": 0,
        "rows": 0,
        "errors": [],
    }

    sem = asyncio.Semaphore(5)
    lock = asyncio.Lock()

    async def process(row):
        ticker, name = row
        async with sem:
            done = stats["success"] + stats["failed"]
            if progress:
                progress(done, len(rows), ticker, name)
            result_ticker, n, err = await _load_one_stock(ticker, name)
            async with lock:
                if err:
                    stats["failed"] += 1
                    stats["errors"].append(f"{ticker}: {err}")
                else:
                    stats["rows"] += n
                    if n > 0:
                        stats["success"] += 1

    await asyncio.gather(*[process(r) for r in rows])

    return stats


async def get_last_trade_date() -> Optional[date]:
    pool = get_pool()
    if not pool:
        return None
    rows = await execute_query("SELECT MAX(trade_date) FROM stock_daily_prices")
    if rows and rows[0][0]:
        val = rows[0][0]
        if isinstance(val, datetime):
            return val.date()
        return val
    return None


async def run_daily_update() -> dict[str, Any]:
    pool = get_pool()
    if not pool:
        return {"status": "error", "message": "Oracle not available"}

    last_date = await get_last_trade_date()
    today = date.today()

    if last_date and last_date >= today:
        print(f"[KOSPI] Data up to date (last: {last_date})")
        return {"status": "skipped", "message": f"Up to date ({last_date})"}

    rows = await execute_query(
        "SELECT ticker, name FROM kospi_stocks ORDER BY ticker"
    )
    stats: dict[str, Any] = {
        "total": len(rows),
        "updated": 0,
        "failed": 0,
        "rows": 0,
    }

    for ticker, name in rows:
        try:
            data = await fetch_stock_data(ticker)
            if not data:
                stats["failed"] += 1
                continue

            if last_date:
                new_data = [
                    c
                    for c in data
                    if datetime.strptime(str(c["time"]), "%Y-%m-%d").date() > last_date
                ]
            else:
                new_data = data

            if new_data:
                n = await upsert_prices(ticker, new_data)
                stats["rows"] += n
                stats["updated"] += 1
        except Exception:
            stats["failed"] += 1

    print(f"[KOSPI] Daily update done: {stats['updated']} stocks, {stats['rows']} rows")
    return stats
