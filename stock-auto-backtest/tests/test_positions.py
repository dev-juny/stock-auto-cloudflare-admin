"""Unit tests for position_manager.py signal logic."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from position_manager import BacktestConfig, PositionState

EPS = 0.0001

def make_state(entry_price=10000, config=None):
    return PositionState(
        ticker="TEST",
        entry_date="2024-01-01",
        entry_price=entry_price,
        quantity=1,
        highest_price_since_entry=entry_price,
        config=config or BacktestConfig(),
    )

# ──────────────────────────────────────────────
# 1. Stop Loss
# ──────────────────────────────────────────────
def test_stop_loss_triggers():
    cfg = BacktestConfig(stop_loss_pct=0.05, fixed_take_profit_pct=0)
    s = make_state(10000, cfg)
    sig, reason = s.update_and_check_signal(9400)
    assert sig == 'SELL' and reason == 'stop_loss', f"Expected stop_loss, got {sig},{reason}"

def test_stop_loss_boundary():
    cfg = BacktestConfig(stop_loss_pct=0.05, fixed_take_profit_pct=0)
    s = make_state(10000, cfg)
    sig, reason = s.update_and_check_signal(9500)
    assert sig == 'SELL' and reason == 'stop_loss', f"At boundary should SELL, got {sig},{reason}"

def test_stop_loss_disabled():
    cfg = BacktestConfig(stop_loss_pct=0, fixed_take_profit_pct=0)
    s = make_state(10000, cfg)
    sig, _ = s.update_and_check_signal(5000)
    assert sig == 'HOLD', f"Disabled stop should not trigger, got {sig}"

# ──────────────────────────────────────────────
# 2. Fixed Take Profit (NEW - was buggy)
# ──────────────────────────────────────────────
def test_take_profit_triggers():
    cfg = BacktestConfig(fixed_take_profit_pct=0.07, stop_loss_pct=0)
    s = make_state(10000, cfg)
    sig, reason = s.update_and_check_signal(10750)
    assert sig == 'SELL' and reason == 'take_profit', f"Expected take_profit, got {sig},{reason}"

def test_take_profit_at_exact_boundary():
    cfg = BacktestConfig(fixed_take_profit_pct=0.07, stop_loss_pct=0)
    s = make_state(10000, cfg)
    sig, _ = s.update_and_check_signal(10700)
    assert sig == 'SELL', f"At exact boundary should SELL, got {sig}"

def test_take_profit_below_threshold():
    cfg = BacktestConfig(fixed_take_profit_pct=0.07, stop_loss_pct=0)
    s = make_state(10000, cfg)
    sig, _ = s.update_and_check_signal(10699)
    assert sig == 'HOLD', f"Below threshold should HOLD, got {sig}"

def test_take_profit_disabled():
    cfg = BacktestConfig(fixed_take_profit_pct=0, stop_loss_pct=0)
    s = make_state(10000, cfg)
    sig, _ = s.update_and_check_signal(20000)
    assert sig == 'HOLD', f"Disabled take profit should not trigger, got {sig}"

# ──────────────────────────────────────────────
# 3. Trailing Stop
# ──────────────────────────────────────────────
def test_trailing_stop_triggers():
    cfg = BacktestConfig(trailing_activation_pct=0.03, trailing_stop_pct=0.02,
                         fixed_take_profit_pct=0, stop_loss_pct=0)
    s = make_state(10000, cfg)
    # Price rises above activation
    s.update_and_check_signal(10400)   # +4%, activates trailing
    # Then drops below trailing stop threshold (peak 10400 * 0.98 = 10192)
    sig, reason = s.update_and_check_signal(10100)
    assert sig == 'SELL' and reason == 'trailing_stop', f"Expected trailing_stop, got {sig},{reason}"

def test_trailing_stop_not_triggered_below_activation():
    cfg = BacktestConfig(trailing_activation_pct=0.03, trailing_stop_pct=0.02,
                         fixed_take_profit_pct=0, stop_loss_pct=0)
    s = make_state(10000, cfg)
    s.update_and_check_signal(10250)  # +2.5%, below activation
    sig, reason = s.update_and_check_signal(10000)
    assert reason != 'trailing_stop', f"Should not trail below activation"

def test_take_profit_before_trailing():
    """Take profit at 7% should fire before trailing activates at 3%."""
    cfg = BacktestConfig(fixed_take_profit_pct=0.07, trailing_activation_pct=0.03,
                         trailing_stop_pct=0.02, stop_loss_pct=0)
    s = make_state(10000, cfg)
    s.update_and_check_signal(10350)  # +3.5% (trailing activates)
    sig, reason = s.update_and_check_signal(10750)  # +7.5% (take profit fires)
    assert sig == 'SELL' and reason == 'take_profit', f"Take profit should win over trailing, got {sig},{reason}"

# ──────────────────────────────────────────────
# 4. Break-even Stop
# ──────────────────────────────────────────────
def test_break_even_activates_and_triggers():
    cfg = BacktestConfig(break_even_activation_pct=0.05, fixed_take_profit_pct=0,
                         trailing_activation_pct=0.10, trailing_stop_pct=0.05,
                         stop_loss_pct=0)
    s = make_state(10000, cfg)
    s.update_and_check_signal(10600)  # +6%, activates break-even, below trailing activation
    sig, reason = s.update_and_check_signal(9900)
    assert sig == 'SELL' and reason == 'break_even', f"Expected break_even, got {sig},{reason}"

# ──────────────────────────────────────────────
# 5. Stall Exit
# ──────────────────────────────────────────────
def test_stall_exit():
    cfg = BacktestConfig(stall_exit_days=3, trailing_activation_pct=0.05,
                         fixed_take_profit_pct=0, stop_loss_pct=0)
    s = make_state(10000, cfg)
    for _ in range(3):
        sig, reason = s.update_and_check_signal(10100)  # +1%, below trailing activation
    assert sig == 'SELL' and reason == 'stall_exit', f"Expected stall_exit, got {sig},{reason}"

def test_stall_exit_not_before_days():
    cfg = BacktestConfig(stall_exit_days=3, trailing_activation_pct=0.05,
                         fixed_take_profit_pct=0, stop_loss_pct=0)
    s = make_state(10000, cfg)
    sig, _ = s.update_and_check_signal(10100)
    assert sig == 'HOLD', f"Should HOLD before stall days, got {sig}"

# ──────────────────────────────────────────────
# 6. Priority order: stop_loss > take_profit > trailing > break_even > stall
# ──────────────────────────────────────────────
def test_stop_loss_beats_take_profit():
    """Stop loss (-10%) should fire before take profit (+7%)."""
    cfg = BacktestConfig(stop_loss_pct=0.10, fixed_take_profit_pct=0.07)
    s = make_state(10000, cfg)
    sig, reason = s.update_and_check_signal(8900)
    assert sig == 'SELL' and reason == 'stop_loss', f"Expected stop_loss, got {sig},{reason}"

def test_take_profit_does_not_fire_on_loss():
    """Take profit should not fire when price is below entry."""
    cfg = BacktestConfig(fixed_take_profit_pct=0.07, stop_loss_pct=0)
    s = make_state(10000, cfg)
    sig, _ = s.update_and_check_signal(9500)
    assert sig == 'HOLD', f"Take profit on loss should HOLD, got {sig}"

# ──────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────
if __name__ == '__main__':
    tests = [
        ("stop_loss triggers", test_stop_loss_triggers),
        ("stop_loss boundary holds", test_stop_loss_boundary),
        ("stop_loss disabled", test_stop_loss_disabled),
        ("take_profit triggers", test_take_profit_triggers),
        ("take_profit at exact boundary", test_take_profit_at_exact_boundary),
        ("take_profit below threshold", test_take_profit_below_threshold),
        ("take_profit disabled", test_take_profit_disabled),
        ("trailing_stop triggers", test_trailing_stop_triggers),
        ("trailing_stop below activation", test_trailing_stop_not_triggered_below_activation),
        ("take_profit before trailing", test_take_profit_before_trailing),
        ("break_even activates and triggers", test_break_even_activates_and_triggers),
        ("stall_exit", test_stall_exit),
        ("stall_exit not before days", test_stall_exit_not_before_days),
        ("stop_loss beats take_profit", test_stop_loss_beats_take_profit),
        ("take_profit not on loss", test_take_profit_does_not_fire_on_loss),
    ]
    passed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  PASS  {name}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {name}: {e}")
    print(f"\n{passed}/{len(tests)} tests passed")
