from __future__ import annotations

REASON_ABBR: dict[str, str] = {
    "take_profit": "TP",
    "trailing_stop": "TS",
    "break_even": "BE",
    "stall_exit": "SE",
}


def make_chart_data(
    dates: list[str],
    opens: list[float],
    highs: list[float],
    lows: list[float],
    closes: list[float],
) -> list[dict]:
    return [
        {"time": d, "open": o, "high": h, "low": l, "close": c}
        for d, o, h, l, c in zip(dates, opens, highs, lows, closes)
    ]


def make_markers(entry_date: str, trades: list[dict]) -> list[dict]:
    markers: list[dict] = [
        {
            "time": entry_date,
            "position": "belowBar",
            "color": "#2196F3",
            "shape": "arrowUp",
            "text": "BUY",
        }
    ]
    for trade in trades:
        if trade.get("signal") == "SELL":
            abbr = REASON_ABBR.get(trade.get("reason", ""), "EXIT")
            markers.append({
                "time": trade["date"],
                "position": "aboveBar",
                "color": "#E91E63",
                "shape": "arrowDown",
                "text": abbr,
            })
    return markers
