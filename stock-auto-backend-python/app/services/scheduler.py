from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "stock-auto-backtest" / "src"))

from app.database import execute_non_query, execute_query, get_pool
from app.services.kis import kis_client
from position_manager import BacktestConfig, PositionState  # type: ignore

SCHEDULER_INTERVAL = 60  # seconds (overridden by DB if set)

_BREADTH_CACHE: dict = {"pct": 1.0, "at": None}


def _dict_to_bmc(d: dict) -> BacktestConfig:
    return BacktestConfig(
        fixed_take_profit_pct=d.get("fixedTakeProfitPct", d.get("fixed_take_profit_pct", 0.07)),
        break_even_activation_pct=d.get("breakEvenActivationPct", d.get("break_even_activation_pct", 0.07)),
        trailing_activation_pct=d.get("trailingActivationPct", d.get("trailing_activation_pct", 0.03)),
        trailing_stop_pct=d.get("trailingStopPct", d.get("trailing_stop_pct", 0.03)),
        stall_exit_days=d.get("stallExitDays", d.get("stall_exit_days", 2)),
        stop_loss_pct=d.get("stopLossPct", d.get("stop_loss_pct", 0.0)),
        min_volume=d.get("minVolume", d.get("min_volume", 0)),
        max_volatility=d.get("maxVolatility", d.get("max_volatility", 1.0)),
        ranking_candidate_limit=d.get("rankingCandidateLimit", d.get("ranking_candidate_limit", 9999)),
        max_concurrent_positions=d.get("maxConcurrentPositions", d.get("max_concurrent_positions", 9999)),
        entry_type=d.get("entryType", d.get("entry_type", "momentum")),
        entry_trigger=d.get("entryTrigger", d.get("entry_trigger", "next_close")),
        entry_conditions=d.get("entryConditions", d.get("entry_conditions", None)),
        commission=d.get("commission", 0.0002),
        tax=d.get("tax", 0.0015),
        slippage=d.get("slippage", 0.001),
    )


async def _load_scheduler_config() -> tuple[int, float, float]:
    try:
        rows = await execute_query(
            "SELECT interval_seconds, breadth_threshold, breadth_upper FROM scheduler_config ORDER BY id DESC FETCH FIRST 1 ROW ONLY"
        )
        if rows:
            return (
                int(rows[0][0]) if rows[0][0] else 60,
                float(rows[0][1]) if rows[0][1] else 0.3,
                float(rows[0][2]) if len(rows[0]) > 2 and rows[0][2] else 0.7,
            )
    except Exception:
        pass
    return 60, 0.3, 0.7


async def _load_active_config() -> BacktestConfig | None:
    try:
        rows = await execute_query(
            "SELECT params FROM saved_configs WHERE is_active = 'Y' FETCH FIRST 1 ROW ONLY"
        )
        if rows and rows[0][0]:
            d = json.loads(rows[0][0])
            return _dict_to_bmc(d)
    except Exception:
        pass
    return None


def _to_state(row: tuple, bmc: BacktestConfig | None) -> PositionState:
    return PositionState(
        ticker=row[1],
        entry_date=str(row[2]) if row[2] else "",
        entry_price=float(row[3]) if row[3] else 0,
        quantity=int(row[4]) if row[4] else 0,
        highest_price_since_entry=float(row[5]) if row[5] else float(row[3]),
        is_break_even_activated=(row[6] == "Y") if row[6] else False,
        holding_days=int(row[7]) if row[7] else 0,
        config=bmc or BacktestConfig(),
    )


async def run_trading_loop() -> None:
    print("[SCHEDULER] Cycle start")
    bmc = await _load_active_config()
    interval, breadth_threshold, _ = await _load_scheduler_config()

    rows = await execute_query(
        "SELECT id, ticker, entry_date, entry_price, quantity, "
        "highest_price, is_break_even, holding_days "
        "FROM active_positions"
    )

    # --- New entry check (breadth guard for manual sync) ---
    global _BREADTH_CACHE
    try:
        br_rows = await execute_query(
            "SELECT breadth_pct FROM market_breadth ORDER BY calculated_at DESC FETCH FIRST 1 ROW ONLY"
        )
        if br_rows and br_rows[0][0] is not None:
            _BREADTH_CACHE["pct"] = float(br_rows[0][0])
            _BREADTH_CACHE["at"] = str(datetime.now())
    except Exception:
        pass

    if not rows:
        print(f"[SCHEDULER] No active positions (breadth: {_BREADTH_CACHE['pct']:.1%})")
        return

    for row in rows:
        pos_id = row[0]
        ticker = row[1]
        state = _to_state(row, bmc)

        price = await kis_client.get_current_price(ticker)
        if price is None:
            print(f"[SCHEDULER] {ticker}: price fetch failed, skip")
            continue

        signal, reason = state.update_and_check_signal(price)

        await execute_non_query(
            "UPDATE active_positions SET "
            "highest_price = :1, is_break_even = :2, holding_days = :3, "
            "updated_at = CURRENT_TIMESTAMP "
            "WHERE id = :4",
            [
                state.highest_price_since_entry,
                "Y" if state.is_break_even_activated else "N",
                state.holding_days,
                pos_id,
            ],
        )

        if signal == "SELL":
            print(f"[SCHEDULER] {ticker}: SELL signal ({reason}) at {price}")
            result = await kis_client.market_sell(ticker, state.quantity)
            if result:
                await execute_non_query(
                    "DELETE FROM active_positions WHERE id = :1", [pos_id]
                )
                await execute_non_query(
                    "INSERT INTO trade_logs (ticker, action, price, quantity, reason) "
                    "VALUES (:1, 'SELL', :2, :3, :4)",
                    [ticker, price, state.quantity, reason],
                )
                print(f"[SCHEDULER] {ticker}: sold {state.quantity} @ {price} ({reason})")
            else:
                print(f"[SCHEDULER] {ticker}: sell order failed")

    print(f"[SCHEDULER] Cycle done (breadth: {_BREADTH_CACHE['pct']:.1%})")


async def scheduler_loop() -> None:
    while True:
        interval, _, _ = await _load_scheduler_config()

        try:
            await run_trading_loop()
        except Exception as e:
            print(f"[SCHEDULER] Trading loop error: {e}")

        await asyncio.sleep(interval)

