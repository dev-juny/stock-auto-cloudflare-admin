from __future__ import annotations

import ast
import asyncio
import csv
import json
import logging
import os
import time
from datetime import date, datetime, timedelta
from io import StringIO
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

import httpx

NAVER_BASE = "https://api.finance.naver.com/siseJson.nhn"
KRX_URL = "http://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13&marketType=stockMkt"

CACHE_DIR_VAR = "STOCK_DATA_CACHE"
CACHE_MAX_AGE = 86400 * 6
NAVER_TIMEOUT = 60

_http = httpx.AsyncClient(
    timeout=45,
    follow_redirects=True,
    headers={"User-Agent": "Mozilla/5.0", "Referer": "https://finance.naver.com/"},
)


def _cache_dir() -> Path:
    p = Path(os.environ.get(CACHE_DIR_VAR, "")) if os.environ.get(CACHE_DIR_VAR) else (
        Path(__file__).resolve().parent.parent.parent / "data_cache"
    )
    p.mkdir(parents=True, exist_ok=True)
    return p


async def _fetch_tickers_by_market(sosok: int, market_label: str) -> list[dict[str, str]]:
    import re

    tickers: list[dict[str, str]] = []
    for page in range(1, 50):
        url = f"https://finance.naver.com/sise/sise_market_sum.naver?sosok={sosok}&page={page}"
        resp = await _http.get(url)
        await asyncio.sleep(0)  # yield after HTTP I/O
        matches = re.findall(r'code=(\d{6})[^>]*class="tltle">([^<]+)</a>', resp.text)
        if not matches:
            break
        for code, name in matches:
            if code.endswith("0"):
                tickers.append({"ticker": code, "name": name, "sector": "", "market": market_label})
    return tickers


async def get_kospi_tickers() -> list[dict[str, str]]:
    try:
        resp = await _http.get(KRX_URL)
        content = resp.content.decode("euc-kr")
        await asyncio.sleep(0)  # yield after decode
        reader = csv.DictReader(StringIO(content))
        if reader.fieldnames and "종목코드" in reader.fieldnames:
            result = [
                {
                    "ticker": row["종목코드"].strip().zfill(6),
                    "name": row["종목명"].strip(),
                    "sector": row.get("업종", "").strip(),
                    "market": "KOSPI",
                }
                for row in reader
            ]
            await asyncio.sleep(0)  # yield after list comprehension
            return result
    except Exception:
        pass
    return await _fetch_tickers_by_market(0, "KOSPI")


async def get_all_tickers() -> list[dict[str, str]]:
    kospi = await get_kospi_tickers()
    kosdaq = await _fetch_tickers_by_market(1, "KOSDAQ")
    return kospi + kosdaq


async def fetch_stock_data(ticker: str) -> list[dict[str, Any]]:
    cache_path = _cache_dir() / f"{ticker}.json"
    data: list[dict[str, Any]] | None = None

    if cache_path.exists():
        age = time.time() - cache_path.stat().st_mtime
        if age < CACHE_MAX_AGE:
            try:
                data = json.loads(cache_path.read_text(encoding="utf-8"))
                await asyncio.sleep(0)  # yield after CPU-bound json.loads + I/O read
            except Exception:
                data = None

    if data is None:
        raw = await _download_naver(ticker)
        if raw:
            cache_path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
            await asyncio.sleep(0)  # yield after CPU-bound json.dumps + I/O write
            data = raw
        else:
            log.warning("Naver download failed for %s, using stale cache", ticker)
            if cache_path.exists():
                try:
                    data = json.loads(cache_path.read_text(encoding="utf-8"))
                    await asyncio.sleep(0)  # yield after CPU-bound json.loads + I/O read
                except Exception:
                    data = None

    return data or []


async def _parse_naver_lines(body: str) -> list[dict[str, Any]] | None:
    """Parse Naver API response line by line, yielding every 100 lines."""
    if not body.startswith("[["):
        return None
    import re
    lines = re.split(r'\],\s*\n\s*\[', body.strip("[]\n"))
    result = []
    for idx, line in enumerate(lines):
        line = line.strip("[]")
        if not line:
            continue
        parts = line.split(",")
        if len(parts) < 6:
            continue
        try:
            date_str = parts[0].strip().strip('"')
            if len(date_str) == 8:
                dt = datetime.strptime(date_str, "%Y%m%d")
                time_str = dt.strftime("%Y-%m-%d")
            else:
                time_str = date_str
            result.append({
                "time": time_str,
                "open": float(parts[1].strip()),
                "high": float(parts[2].strip()),
                "low": float(parts[3].strip()),
                "close": float(parts[4].strip()),
                "volume": int(float(parts[5].strip())),
            })
        except (ValueError, TypeError, IndexError):
            continue
        if idx > 0 and idx % 100 == 0:
            await asyncio.sleep(0)
    result.sort(key=lambda x: str(x["time"]))
    return result if result else None


async def _download_naver(ticker: str) -> list[dict[str, Any]] | None:
    end = date.today()
    start = end - timedelta(days=365 * 5 + 30)
    url = (
        f"{NAVER_BASE}?symbol={ticker}&requestType=1"
        f"&startTime={start.strftime('%Y%m%d')}"
        f"&endTime={end.strftime('%Y%m%d')}"
        f"&timeframe=day"
    )
    for attempt in range(2):
        try:
            resp = await _http.get(url, timeout=NAVER_TIMEOUT)
            if resp.status_code != 200:
                return None
            body = resp.text.strip()
            return await _parse_naver_lines(body)
        except Exception:
            if attempt == 0:
                await asyncio.sleep(3)
            else:
                return None
