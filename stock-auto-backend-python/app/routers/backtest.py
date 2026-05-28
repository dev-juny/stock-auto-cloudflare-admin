from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "stock-auto-backtest" / "src"))

from fastapi import APIRouter
from app.models import BacktestRequest, BacktestResponse, Candle, Marker, TradeEvent
from app.services.chart import make_chart_data, make_markers
from position_manager import BacktestConfig as BMC, PositionState  # type: ignore

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


@router.post("", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest) -> BacktestResponse:
    cfg = req.config
    bmc = BMC(
        fixed_take_profit_pct=cfg.fixedTakeProfitPct,
        break_even_activation_pct=cfg.breakEvenActivationPct,
        trailing_activation_pct=cfg.trailingActivationPct,
        trailing_stop_pct=cfg.trailingStopPct,
        stall_exit_days=cfg.stallExitDays,
    )

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

    obs = [{"time": c.time, "open": c.open, "high": c.high, "low": c.low, "close": c.close} for c in req.candles]
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
