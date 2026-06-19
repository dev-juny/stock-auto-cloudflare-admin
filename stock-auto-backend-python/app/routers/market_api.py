from __future__ import annotations

import asyncio
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.market_data_service import MarketDataService, ensure_market_tables
from app.database_sqlalchemy import get_session_sync
from app.repositories.stock_repository import StockRepository
from app.utils.timezone import to_kst

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/market", tags=["market"])
_service = MarketDataService()


@router.post("/sync")
async def sync_market_data():
    stats = await asyncio.to_thread(_service.sync_all)
    is_ok = len(stats.get("errors", [])) == 0
    return {"status": "ok" if is_ok else "partial", **stats}


@router.post("/sync/daily")
async def sync_daily_incremental():
    stats = await asyncio.to_thread(_service.sync_daily_incremental)
    return {"status": "ok", **stats}


@router.get("/stocks")
async def list_stocks(
    market: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
):
    session = get_session_sync()
    try:
        repo = StockRepository(session)
        if keyword:
            stocks = repo.search_master(keyword, offset, limit)
        elif market:
            stocks = repo.get_master_by_market(market)
        else:
            stocks = repo.get_all_codes()
        return {"total": len(stocks), "stocks": stocks}
    finally:
        session.close()


@router.get("/stocks/{code}")
async def get_stock_detail(code: str):
    session = get_session_sync()
    try:
        repo = StockRepository(session)
        from app.orm_models.stock_master import StockMaster
        stock = session.get(StockMaster, code)
        if not stock:
            raise HTTPException(404, "Stock not found")
        daily_count = repo.get_daily_count()
        last_date = repo.get_last_trade_date(code)
        return {
            "code": stock.code,
            "name": stock.name,
            "market": stock.market,
            "listing_date": str(stock.listing_date) if stock.listing_date else None,
            "daily_records": daily_count,
            "last_trade_date": str(last_date) if last_date else None,
        }
    finally:
        session.close()


@router.get("/stocks/{code}/daily")
async def get_stock_daily(
    code: str,
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    limit: int = Query(365, ge=1, le=1000),
):
    session = get_session_sync()
    try:
        repo = StockRepository(session)
        start_date = date.fromisoformat(start) if start else None
        end_date = date.fromisoformat(end) if end else None
        daily = repo.get_daily(code, start_date, end_date, limit)
        return {
            "code": code,
            "total": len(daily),
            "data": [
                {
                    "date": str(d.trade_date),
                    "open": d.open_price,
                    "high": d.high_price,
                    "low": d.low_price,
                    "close": d.close_price,
                    "volume": d.volume,
                }
                for d in daily
            ],
        }
    finally:
        session.close()


@router.get("/batches")
async def list_batches(limit: int = Query(50, ge=1, le=200)):
    session = get_session_sync()
    try:
        repo = StockRepository(session)
        batches = repo.get_batches(limit)
        return {
            "total": len(batches),
            "batches": [
                {
                    "id": b.id,
                    "batch_name": b.batch_name,
                    "start_time": str(b.start_time) if b.start_time else None,
                    "start_time_kst": to_kst(b.start_time),
                    "end_time": str(b.end_time) if b.end_time else None,
                    "end_time_kst": to_kst(b.end_time),
                    "status": b.status,
                    "rows_processed": b.rows_processed,
                    "message": b.message,
                }
                for b in batches
            ],
        }
    finally:
        session.close()
