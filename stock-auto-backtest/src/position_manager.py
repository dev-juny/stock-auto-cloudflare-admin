from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Tuple


@dataclass
class BacktestConfig:
    fixed_take_profit_pct: float = 0.07
    break_even_activation_pct: float = 0.07
    trailing_activation_pct: float = 0.03
    trailing_stop_pct: float = 0.03
    ranking_candidate_limit: int = 30
    max_concurrent_positions: int = 10
    min_volume: int = 500_000
    max_volatility: float = 0.12
    stall_exit_days: int = 2
    stop_loss_pct: float = 0.0
    entry_type: str = "momentum"
    entry_trigger: str = "next_close"
    entry_conditions: list[str] | None = None
    commission: float = 0.0002
    tax: float = 0.0015
    slippage: float = 0.001


@dataclass
class PositionState:
    ticker: str
    entry_date: str
    entry_price: float
    quantity: int
    highest_price_since_entry: float
    config: BacktestConfig = field(default_factory=BacktestConfig)
    is_break_even_activated: bool = False
    holding_days: int = 0

    def update_and_check_signal(self, current_price: float) -> Tuple[str, Optional[str]]:
        """Update internal state and return (signal, reason).

        Returns:
            ('HOLD', None) if no exit condition is met.
            ('SELL', 'take_profit' | 'trailing_stop' | 'break_even' | 'stall_exit') on exit.
        """
        self.highest_price_since_entry = max(self.highest_price_since_entry, current_price)
        self.holding_days += 1

        entry = self.entry_price
        profit_pct = (current_price - entry) / entry
        peak_profit_pct = (self.highest_price_since_entry - entry) / entry
        cfg = self.config

        # 1. Stop loss
        stop_loss_pct = cfg.stop_loss_pct or 0
        if stop_loss_pct > 0 and profit_pct <= -stop_loss_pct:
            return ('SELL', 'stop_loss')

        # 2. Fixed take profit
        take_profit_pct = cfg.fixed_take_profit_pct or 0
        if take_profit_pct > 0 and profit_pct >= take_profit_pct:
            return ('SELL', 'take_profit')

        # 3. Trailing stop
        if peak_profit_pct >= cfg.trailing_activation_pct:
            drop_ratio = 1 - cfg.trailing_stop_pct
            if current_price < self.highest_price_since_entry * drop_ratio:
                return ('SELL', 'trailing_stop')

        # 3. Break-even stop
        if self.is_break_even_activated and current_price <= entry:
            return ('SELL', 'break_even')

        # 4. Activate break-even protection
        if not self.is_break_even_activated and profit_pct >= cfg.break_even_activation_pct:
            self.is_break_even_activated = True

        # 5. Stall exit (held long enough without meaningful movement)
        if self.holding_days >= cfg.stall_exit_days and peak_profit_pct < cfg.trailing_activation_pct:
            return ('SELL', 'stall_exit')

        if peak_profit_pct >= cfg.trailing_activation_pct:
            return ('HOLD', 'trailing')
        return ('HOLD', None)


class PositionManager:
    """Manages a portfolio of positions using a shared BacktestConfig."""

    def __init__(self, config: Optional[BacktestConfig] = None):
        self.config = config or BacktestConfig()
        self.positions: list[PositionState] = []

    def can_open_new(self) -> bool:
        return len(self.positions) < self.config.max_concurrent_positions

    def open_position(self, ticker: str, date: str, price: float, quantity: int) -> Optional[PositionState]:
        if not self.can_open_new():
            return None
        state = PositionState(
            ticker=ticker,
            entry_date=date,
            entry_price=price,
            quantity=quantity,
            highest_price_since_entry=price,
            config=self.config,
        )
        self.positions.append(state)
        return state

    def update_all(self, prices: dict[str, float]) -> list[Tuple[PositionState, str, str]]:
        """Update every position with its current price.

        Returns list of (position, 'SELL', reason) for exited positions.
        """
        exited: list[Tuple[PositionState, str, str]] = []
        remaining: list[PositionState] = []

        for pos in self.positions:
            price = prices.get(pos.ticker)
            if price is None:
                remaining.append(pos)
                continue
            signal, reason = pos.update_and_check_signal(price)
            if signal == 'SELL':
                exited.append((pos, signal, reason))
            else:
                remaining.append(pos)

        self.positions = remaining
        return exited
