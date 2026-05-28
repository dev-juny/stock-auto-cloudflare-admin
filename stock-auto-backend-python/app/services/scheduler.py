from __future__ import annotations

import asyncio
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "stock-auto-backtest" / "src"))

from app.database import execute_non_query, execute_query
from app.services.kis import kis_client
from app.services.kospi_data import run_daily_update
from position_manager import BacktestConfig, PositionState  # type: ignore

SCHEDULER_INTERVAL = 60  # seconds
DAILY_UPDATE_INTERVAL = 3600  # check every hour if daily update is needed
LAST_DAILY_UPDATE: date | None = None


def _to_state(row: tuple) -> PositionState:
    return PositionState(
        ticker=row[1],
        entry_date=str(row[2]) if row[2] else "",
        entry_price=float(row[3]) if row[3] else 0,
        quantity=int(row[4]) if row[4] else 0,
        highest_price_since_entry=float(row[5]) if row[5] else float(row[3]),
        is_break_even_activated=(row[6] == "Y") if row[6] else False,
        holding_days=int(row[7]) if row[7] else 0,
        config=BacktestConfig(),
    )


async def run_trading_loop() -> None:
    print("[SCHEDULER] Cycle start")
    rows = await execute_query(
        "SELECT id, ticker, entry_date, entry_price, quantity, "
        "highest_price, is_break_even, holding_days "
        "FROM active_positions"
    )
    if not rows:
        print("[SCHEDULER] No active positions")
        return

    for row in rows:
        pos_id = row[0]
        ticker = row[1]
        state = _to_state(row)

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

    print("[SCHEDULER] Cycle done")


async def scheduler_loop() -> None:
    global LAST_DAILY_UPDATE
    cycles_since_daily = 0

    while True:
        try:
            await run_trading_loop()
        except Exception as e:
            print(f"[SCHEDULER] Trading loop error: {e}")

        cycles_since_daily += 1
        if cycles_since_daily >= DAILY_UPDATE_INTERVAL // SCHEDULER_INTERVAL:
            cycles_since_daily = 0
            try:
                today = date.today()
                if LAST_DAILY_UPDATE != today:
                    print("[SCHEDULER] Running daily KOSPI data update...")
                    stats = await run_daily_update()
                    LAST_DAILY_UPDATE = today
                    print(f"[SCHEDULER] Daily update: {stats}")
                else:
                    print("[SCHEDULER] Daily update already done today")
            except Exception as e:
                print(f"[SCHEDULER] Daily update error: {e}")

        await asyncio.sleep(SCHEDULER_INTERVAL)
