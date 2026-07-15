from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.database import execute_non_query, execute_query
from app.models import PositionSyncRequest, PositionResponse

router = APIRouter(prefix="/api/positions", tags=["positions"])


@router.get("")
async def list_positions() -> list[PositionResponse]:
    rows = await execute_query(
        "SELECT ap.id, ap.ticker, ap.entry_date, ap.entry_price, ap.quantity, "
        "ap.highest_price, ap.is_break_even, ap.holding_days, "
        "ks.name "
        "FROM active_positions ap "
        "LEFT JOIN kospi_stocks ks ON ks.ticker = ap.ticker "
        "ORDER BY ap.entry_date DESC"
    )
    result: list[PositionResponse] = []
    for r in rows:
        result.append(
            PositionResponse(
                id=r[0],
                ticker=r[1],
                name=r[8] if len(r) > 8 else None,
                entry_date=str(r[2]) if r[2] else "",
                entry_price=float(r[3]) if r[3] else 0,
                quantity=int(r[4]) if r[4] else 0,
                highest_price=float(r[5]) if r[5] else None,
                is_break_even=(r[6] == "Y") if r[6] else False,
                holding_days=int(r[7]) if r[7] else 0,
            )
        )
    return result


@router.post("/sync")
async def sync_position(req: PositionSyncRequest) -> PositionResponse:
    # Check max concurrent positions
    count_rows = await execute_query("SELECT COUNT(*) FROM active_positions")
    current_count = count_rows[0][0] if count_rows else 0
    if current_count >= settings.max_concurrent_positions:
        raise HTTPException(
            status_code=400,
            detail=f"Max concurrent positions ({settings.max_concurrent_positions}) reached",
        )

    # Breadth guard: reject new entry if breadth below threshold
    try:
        br = await execute_query(
            "SELECT breadth_pct FROM market_breadth ORDER BY calculated_at DESC FETCH FIRST 1 ROW ONLY"
        )
        if br and br[0][0] is not None:
            breadth = float(br[0][0])
            th = await execute_query(
                "SELECT breadth_threshold, breadth_upper FROM scheduler_config ORDER BY id DESC FETCH FIRST 1 ROW ONLY"
            )
            threshold = float(th[0][0]) if th and th[0][0] else 0.3
            upper = float(th[0][1]) if th and len(th[0]) > 1 and th[0][1] else 0.7
            if breadth < threshold:
                raise HTTPException(
                    status_code=400,
                    detail=f"Market breadth ({breadth:.1%}) below threshold ({threshold:.1%}), new entry held",
                )
            if breadth > upper:
                raise HTTPException(
                    status_code=400,
                    detail=f"Market breadth ({breadth:.1%}) above upper limit ({upper:.1%}), new entry held",
                )
    except HTTPException:
        raise
    except Exception:
        pass

    # Upsert (insert or update)
    await execute_non_query(
        "MERGE INTO active_positions t "
        "USING (SELECT :1 AS ticker FROM DUAL) s "
        "ON (t.ticker = s.ticker) "
        "WHEN MATCHED THEN UPDATE SET "
        "  entry_price = :2, quantity = :3, highest_price = :2, "
        "  is_break_even = 'N', holding_days = 0, "
        "  updated_at = CURRENT_TIMESTAMP "
        "WHEN NOT MATCHED THEN INSERT "
        "  (ticker, entry_price, quantity, highest_price, entry_date) "
        "  VALUES (:1, :2, :3, :2, SYSDATE)",
        [req.ticker, req.entry_price, req.quantity],
    )

    row = await execute_query(
        "SELECT id, ticker, entry_date, entry_price, quantity, "
        "highest_price, is_break_even, holding_days "
        "FROM active_positions WHERE ticker = :1",
        [req.ticker],
    )
    if not row:
        raise HTTPException(status_code=500, detail="Failed to upsert position")
    r = row[0]
    return PositionResponse(
        id=r[0],
        ticker=r[1],
        entry_date=str(r[2]) if r[2] else "",
        entry_price=float(r[3]) if r[3] else 0,
        quantity=int(r[4]) if r[4] else 0,
        highest_price=float(r[5]) if r[5] else None,
        is_break_even=(r[6] == "Y") if r[6] else False,
        holding_days=int(r[7]) if r[7] else 0,
    )


@router.delete("/{ticker}")
async def delete_position(ticker: str) -> dict:
    await execute_non_query(
        "DELETE FROM active_positions WHERE ticker = :1",
        [ticker],
    )
    return {"status": "deleted", "ticker": ticker}
