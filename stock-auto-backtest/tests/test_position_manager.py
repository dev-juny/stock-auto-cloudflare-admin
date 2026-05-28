import pytest
from src.position_manager import BacktestConfig, PositionState, PositionManager


def make_state(
    entry_price: float = 10000,
    current_price: float | None = None,
    highest: float | None = None,
    holding_days: int = 0,
    break_even: bool = False,
) -> tuple[PositionState, float]:
    cfg = BacktestConfig()
    price = current_price if current_price is not None else entry_price
    state = PositionState(
        ticker="TEST",
        entry_date="2026-01-02",
        entry_price=entry_price,
        quantity=10,
        highest_price_since_entry=highest or entry_price,
        config=cfg,
        is_break_even_activated=break_even,
        holding_days=holding_days,
    )
    return state, price


class TestTakeProfit:
    def test_exact_7pct_sells(self):
        state, price = make_state(10000, 10701)
        sig, reason = state.update_and_check_signal(price)
        assert sig == 'SELL'
        assert reason == 'take_profit'

    def test_above_7pct_sells(self):
        state, price = make_state(10000, 11000)
        sig, reason = state.update_and_check_signal(price)
        assert sig == 'SELL'
        assert reason == 'take_profit'

    def test_below_7pct_holds(self):
        state, price = make_state(10000, 10699)
        sig, reason = state.update_and_check_signal(price)
        assert sig == 'HOLD'


class TestTrailingStop:
    def test_trail_activates_and_triggers(self):
        state, _ = make_state(10000, 10300, highest=10300, holding_days=1)
        # price drops 3.5% from 10300 peak -> 9935, which is >3% drop -> trigger
        sig, reason = state.update_and_check_signal(9935)
        assert sig == 'SELL'
        assert reason == 'trailing_stop'

    def test_trail_not_active_below_3pct(self):
        state, _ = make_state(10000, 10200, highest=10200, holding_days=1)
        sig, reason = state.update_and_check_signal(9900)
        assert sig == 'HOLD'

    def test_trail_small_drop_holds(self):
        state, _ = make_state(10000, 10400, highest=10400, holding_days=1)
        # only 2% drop from peak
        sig, reason = state.update_and_check_signal(10192)
        assert sig == 'HOLD'

    def test_trail_updates_highest_then_checks(self):
        state, _ = make_state(10000, 10300, highest=10300, holding_days=1)
        # new high at 10500, then drop to 10200 (2.8% drop, <3%)
        sig, reason = state.update_and_check_signal(10500)
        assert sig == 'HOLD'
        assert state.highest_price_since_entry == 10500
        # now drop to 10185 (3% from 10500)
        sig2, reason2 = state.update_and_check_signal(10185)
        assert sig2 == 'SELL'
        assert reason2 == 'trailing_stop'


class TestBreakEven:
    def test_break_even_activates_at_7pct(self):
        state, price = make_state(10000, 10701, holding_days=1)
        assert state.is_break_even_activated is False
        sig, reason = state.update_and_check_signal(price)
        # take profit triggers first
        assert sig == 'SELL'

    def test_break_even_stop_after_activation(self):
        state, price = make_state(10000, 10701, highest=10701, break_even=True, holding_days=2)
        # price drops back to entry
        sig, reason = state.update_and_check_signal(10000)
        assert sig == 'SELL'
        assert reason == 'break_even'

    def test_break_even_below_entry_sells(self):
        state, price = make_state(10000, 10701, highest=10701, break_even=True, holding_days=2)
        sig, reason = state.update_and_check_signal(9999)
        assert sig == 'SELL'
        assert reason == 'break_even'

    def test_break_even_not_active_no_sell(self):
        state, price = make_state(10000, 10699, highest=10699, holding_days=2)
        # never activated break-even, price at entry
        sig, reason = state.update_and_check_signal(10000)
        assert sig != 'SELL' or reason != 'break_even'


class TestStallExit:
    def test_stall_exit_after_2_days(self):
        state, price = make_state(10000, 10100, highest=10100, holding_days=1)
        sig, reason = state.update_and_check_signal(10100)
        assert sig == 'HOLD'
        # day 2: still flat
        sig2, reason2 = state.update_and_check_signal(10100)
        assert sig2 == 'SELL'
        assert reason2 == 'stall_exit'

    def test_no_stall_if_trailing_active(self):
        state, price = make_state(10000, 10300, highest=10300, holding_days=2)
        sig, reason = state.update_and_check_signal(10300)
        assert sig == 'HOLD'  # trailing is active, no stall


class TestPositionManager:
    def test_open_position(self):
        pm = PositionManager()
        pos = pm.open_position("AAPL", "2026-01-02", 10000, 10)
        assert pos is not None
        assert len(pm.positions) == 1

    def test_max_positions(self):
        cfg = BacktestConfig(max_concurrent_positions=2)
        pm = PositionManager(cfg)
        pm.open_position("A", "2026-01-02", 100, 1)
        pm.open_position("B", "2026-01-02", 100, 1)
        assert pm.open_position("C", "2026-01-02", 100, 1) is None
        assert len(pm.positions) == 2

    def test_update_all(self):
        pm = PositionManager()
        pm.open_position("A", "2026-01-02", 10000, 1)
        pm.open_position("B", "2026-01-02", 10000, 1)
        exited = pm.update_all({"A": 10000, "B": 10701})
        assert len(exited) == 1
        assert exited[0][0].ticker == "B"
        assert len(pm.positions) == 1

    def test_update_missing_ticker_skipped(self):
        pm = PositionManager()
        pm.open_position("A", "2026-01-02", 10000, 1)
        exited = pm.update_all({"B": 10701})
        assert len(exited) == 0
        assert len(pm.positions) == 1
