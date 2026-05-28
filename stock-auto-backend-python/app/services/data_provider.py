from __future__ import annotations

import ast
import csv
import json
import os
import time
from datetime import date, datetime, timedelta
from io import StringIO
from pathlib import Path
from typing import Any

import httpx

NAVER_BASE = "https://api.finance.naver.com/siseJson.nhn"
KRX_URL = "http://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13&marketType=stockMkt"

CACHE_DIR_VAR = "STOCK_DATA_CACHE"
CACHE_MAX_AGE = 86400 * 7

_http = httpx.AsyncClient(
    timeout=15,
    follow_redirects=True,
    headers={"User-Agent": "Mozilla/5.0", "Referer": "https://finance.naver.com/"},
)


def _cache_dir() -> Path:
    p = Path(os.environ.get(CACHE_DIR_VAR, "")) if os.environ.get(CACHE_DIR_VAR) else (
        Path(__file__).resolve().parent.parent.parent / "data_cache"
    )
    p.mkdir(parents=True, exist_ok=True)
    return p


async def get_kospi_tickers() -> list[dict[str, str]]:
    # Try KRX download first
    try:
        resp = await _http.get(KRX_URL)
        content = resp.content.decode("euc-kr")
        reader = csv.DictReader(StringIO(content))
        if reader.fieldnames and "종목코드" in reader.fieldnames:
            return [
                {
                    "ticker": row["종목코드"].strip().zfill(6),
                    "name": row["종목명"].strip(),
                    "sector": row.get("업종", "").strip(),
                }
                for row in reader
            ]
    except Exception:
        pass

    # Fallback: scrape Naver market summary
    import re

    tickers: list[dict[str, str]] = []
    for page in range(1, 50):
        url = f"https://finance.naver.com/sise/sise_market_sum.naver?sosok=0&page={page}"
        resp = await _http.get(url)
        matches = re.findall(r'code=(\d{6})[^>]*class="tltle">([^<]+)</a>', resp.text)
        if not matches:
            break
        for code, name in matches:
            if code.endswith("0"):  # common shares only (skip preferred)
                tickers.append({"ticker": code, "name": name, "sector": ""})
    return tickers


async def fetch_stock_data(ticker: str) -> list[dict[str, Any]]:
    cache_path = _cache_dir() / f"{ticker}.json"
    data: list[dict[str, Any]] | None = None

    if cache_path.exists():
        age = time.time() - cache_path.stat().st_mtime
        if age < CACHE_MAX_AGE:
            try:
                data = json.loads(cache_path.read_text(encoding="utf-8"))
            except Exception:
                data = None

    if data is None:
        raw = await _download_naver(ticker)
        if raw:
            cache_path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
            data = raw
        elif cache_path.exists():
            try:
                data = json.loads(cache_path.read_text(encoding="utf-8"))
            except Exception:
                data = None

    return data or []


async def _download_naver(ticker: str) -> list[dict[str, Any]] | None:
    end = date.today()
    start = end - timedelta(days=365 * 5 + 30)
    url = (
        f"{NAVER_BASE}?symbol={ticker}&requestType=1"
        f"&startTime={start.strftime('%Y%m%d')}"
        f"&endTime={end.strftime('%Y%m%d')}"
        f"&timeframe=day"
    )
    try:
        resp = await _http.get(url)
        if resp.status_code != 200:
            return None
        body = resp.text.strip()
        if not body.startswith("[["):
            return None
        rows = ast.literal_eval(body)
        result = []
        for r in rows[1:]:
            if not isinstance(r, list) or len(r) < 6:
                continue
            try:
                date_str = str(r[0])
                if len(date_str) == 8:
                    dt = datetime.strptime(date_str, "%Y%m%d")
                    time_str = dt.strftime("%Y-%m-%d")
                else:
                    time_str = date_str
                result.append({
                    "time": time_str,
                    "open": float(r[1]),
                    "high": float(r[2]),
                    "low": float(r[3]),
                    "close": float(r[4]),
                    "volume": int(r[5]),
                })
            except (ValueError, IndexError):
                continue
        result.sort(key=lambda x: str(x["time"]))
        return result
    except Exception:
        return None
