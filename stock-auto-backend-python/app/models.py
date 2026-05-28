from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class Candle(BaseModel):
    time: str  # YYYY-MM-DD
    open: float
    high: float
    low: float
    close: float


class Marker(BaseModel):
    time: str
    position: str  # belowBar | aboveBar
    color: str
    shape: str     # arrowUp | arrowDown
    text: str


class BacktestConfig(BaseModel):
    fixedTakeProfitPct: float = 0.07
    breakEvenActivationPct: float = 0.07
    trailingActivationPct: float = 0.03
    trailingStopPct: float = 0.03
    stallExitDays: int = 2


class BacktestRequest(BaseModel):
    entryDate: str
    entryPrice: float
    quantity: int = 1
    candles: list[Candle]
    config: BacktestConfig = Field(default_factory=BacktestConfig)


class TradeEvent(BaseModel):
    day: int
    date: str
    signal: str
    reason: Optional[str] = None
    price: float


class BacktestResponse(BaseModel):
    chart_data: list[Candle]
    markers: list[Marker]
    trades: list[TradeEvent]
    pnl: float
    exit_day: Optional[int] = None
    exit_reason: Optional[str] = None


class PositionSyncRequest(BaseModel):
    ticker: str
    entry_price: float
    quantity: int
    entry_date: Optional[str] = None


class PositionResponse(BaseModel):
    id: int
    ticker: str
    entry_date: str
    entry_price: float
    quantity: int
    highest_price: Optional[float] = None
    is_break_even: bool = False
    holding_days: int = 0
    current_price: Optional[float] = None
    profit_pct: Optional[float] = None


class TradeLogResponse(BaseModel):
    id: int
    ticker: str
    action: str
    price: Optional[float] = None
    quantity: Optional[int] = None
    reason: Optional[str] = None
    traded_at: str
