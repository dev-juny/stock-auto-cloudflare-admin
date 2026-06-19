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
    stopLossPct: float = 0.0
    minVolume: int = 0
    maxVolatility: float = 1.0
    rankingCandidateLimit: int = 9999
    maxConcurrentPositions: int = 9999
    entryType: str = "momentum"
    entryTrigger: str = "next_close"
    entryConditions: list[str] | None = None
    commission: float = 0.0002
    tax: float = 0.0015
    slippage: float = 0.001


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
    open: float = 0
    high: float = 0
    low: float = 0
    close: float = 0


class BacktestResponse(BaseModel):
    chart_data: list[Candle]
    markers: list[Marker]
    trades: list[TradeEvent]
    pnl: float
    exit_day: Optional[int] = None
    exit_reason: Optional[str] = None
    entry_price: float = 0


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


class ScanResult(BaseModel):
    ticker: str
    name: str = ""
    sector: str = ""
    market: str = ""
    entry_date: str
    entry_price: float
    exit_date: Optional[str] = None
    exit_reason: Optional[str] = None
    exit_price: Optional[float] = None
    pnl: float
    holding_days: int


class PortfolioHolding(BaseModel):
    ticker: str
    name: str = ""
    entry_price: float
    shares: int = 0
    current_price: float
    status: str
    reason: Optional[str] = None
    pnl_pct: float
    profit_amt: float

class PortfolioSnapshot(BaseModel):
    date: str
    holdings: list[PortfolioHolding] = []
    cash: float
    total_value: float
    positions_count: int
    pnl_pct: float
    pnl_amt: float

class ScanStatus(BaseModel):
    scan_id: str
    status: str
    total: int
    processed: int
    completed: int
    results: list[ScanResult] = []
    message: str = ""
    portfolio: list[PortfolioSnapshot] | None = None


class TickerBacktestRequest(BaseModel):
    ticker: str
    entry_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    config: BacktestConfig = Field(default_factory=BacktestConfig)
    base_amt: float = 1000000

class SavedConfig(BaseModel):
    id: int = 0
    name: str = ""
    params: str = ""
    result_summary: str = ""
    is_active: bool = False
    created_at: str = ""

class BreadthSnapshot(BaseModel):
    breadth_pct: float = 0
    total_stocks: int = 0
    above_ma: int = 0
    calculated_at: str = ""

class SchedulerConfig(BaseModel):
    interval_seconds: int = 60
    breadth_threshold: float = 0.3
