from __future__ import annotations

import json
import logging
from datetime import date, datetime

from app.database import execute_query, execute_non_query
from app.services.broker import MockBroker, OrderRequest
from app.services.operations_service import check_risk_limits, log_daily_validation

logger = logging.getLogger(__name__)

_broker = MockBroker()
_INITIAL_CAPITAL = 10000000.0


async def _get_current_price(ticker: str) -> float | None:
    rows = await execute_query(
        "SELECT close_price FROM stock_daily_prices WHERE ticker = :1 ORDER BY trade_date DESC FETCH FIRST 1 ROW ONLY",
        [ticker],
    )
    if rows and rows[0][0]:
        return float(rows[0][0])
    return None


async def _get_price_history(ticker: str, days: int) -> list[float]:
    rows = await execute_query(
        f"SELECT close_price FROM stock_daily_prices WHERE ticker = :1 ORDER BY trade_date DESC FETCH FIRST {days} ROWS ONLY",
        [ticker],
    )
    return [float(r[0]) for r in rows if r[0]]


async def load_strategy_params(strategy_id: int) -> dict | None:
    rows = await execute_query(
        "SELECT params_json FROM strategy_pool WHERE id = :1",
        [strategy_id],
    )
    if rows and rows[0][0]:
        try:
            return json.loads(rows[0][0])
        except (json.JSONDecodeError, TypeError):
            pass
    return None


async def check_entry_signal(
    ticker: str,
    params: dict,
    max_positions_count: int,
    current_open_positions: int,
) -> tuple[str, float]:
    entry_type = params.get("entry_type", "momentum")
    ranking_candidate_limit = int(params.get("ranking_candidate_limit", 30))
    min_volume = int(params.get("min_volume", 0))
    max_volatility = float(params.get("max_volatility", 0.12))

    if current_open_positions >= ranking_candidate_limit:
        logger.debug("[PAPER] %s SKIP: open positions %d >= limit %d", ticker, current_open_positions, ranking_candidate_limit)
        return ("hold", 0)

    prices = await _get_price_history(ticker, 30)
    if len(prices) < 20:
        logger.debug("[PAPER] %s SKIP: insufficient price history (%d days)", ticker, len(prices))
        return ("hold", 0)
    current_price = prices[0]

    if entry_type == "momentum":
        momentum_period = int(params.get("momentum_period", 5))
        if len(prices) < momentum_period + 1:
            return ("hold", 0)
        short_ma = sum(prices[:momentum_period]) / momentum_period
        prev_short_ma = sum(prices[1:momentum_period + 1]) / momentum_period
        cond1 = current_price > short_ma
        cond2 = prev_short_ma >= (prices[1] if len(prices) > 1 else short_ma)
        logger.debug(
            "[PAPER] %s MOMENTUM(P=%d): price=%.0f MA=%.0f prev_MA=%.0f → %s",
            ticker, momentum_period, current_price, short_ma, prev_short_ma,
            "BUY" if (cond1 and cond2) else "HOLD",
        )
        if cond1 and cond2:
            return ("buy", current_price)

    elif entry_type == "breakout":
        breakout_period = int(params.get("breakout_period", 20))
        if len(prices) < breakout_period + 1:
            return ("hold", 0)
        recent_high = max(prices[1:breakout_period + 1])
        cond = current_price > recent_high * 1.01
        logger.debug(
            "[PAPER] %s BREAKOUT(P=%d): price=%.0f high_%dd=%.0f threshold=%.0f → %s",
            ticker, breakout_period, current_price, breakout_period, recent_high, recent_high * 1.01,
            "BUY" if cond else "HOLD",
        )
        if cond:
            return ("buy", current_price)

    elif entry_type == "pullback":
        pullback_threshold = float(params.get("pullback_threshold", 0.02))
        if len(prices) < 10:
            return ("hold", 0)
        high_10 = max(prices[:10])
        low_10 = min(prices[:10])
        drop_pct = (high_10 - current_price) / high_10
        cond1 = drop_pct > pullback_threshold
        cond2 = current_price > low_10 * 1.01
        logger.debug(
            "[PAPER] %s PULLBACK(threshold=%.1f%%): price=%.0f high_10d=%.0f low_10d=%.0f drop=%.1f%% → %s",
            ticker, pullback_threshold * 100, current_price, high_10, low_10, drop_pct * 100,
            "BUY" if (cond1 and cond2) else "HOLD",
        )
        if cond1 and cond2:
            return ("buy", current_price)

    if min_volume > 0:
        volume_rows = await execute_query(
            "SELECT volume FROM stock_daily_prices WHERE ticker = :1 ORDER BY trade_date DESC FETCH FIRST 5 ROWS ONLY",
            [ticker],
        )
        if volume_rows and all(r[0] for r in volume_rows):
            avg_vol = sum(float(r[0]) for r in volume_rows) / len(volume_rows)
            if avg_vol < min_volume:
                logger.debug("[PAPER] %s SKIP: avg_volume %.0f < min_volume %d", ticker, avg_vol, min_volume)
                return ("hold", 0)

    return ("hold", 0)


async def check_exit_signal(
    ticker: str,
    entry_price: float,
    highest_price: float,
    params: dict,
    entry_date=None,
) -> tuple[str, str]:
    current_price = await _get_current_price(ticker)
    if current_price is None:
        return ("hold", "")

    stop_loss_pct = float(params.get("stop_loss_pct", 0.0))
    take_profit_pct = float(params.get("fixed_take_profit_pct", 0.07))
    trailing_activation_pct = float(params.get("trailing_activation_pct", 0.07))
    trailing_stop_pct = float(params.get("trailing_stop_pct", 0.03))
    stall_exit_days = int(params.get("stall_exit_days", 0))

    new_highest = max(highest_price, current_price)
    pnl_pct = (current_price - entry_price) / entry_price * 100

    if stop_loss_pct > 0 and current_price <= entry_price * (1 - stop_loss_pct):
        logger.info("[PAPER] %s STOP_LOSS: entry=%.0f price=%.0f (%.1f%%), sl=%.1f%%", ticker, entry_price, current_price, pnl_pct, stop_loss_pct * 100)
        return ("sell", "stop_loss")

    if take_profit_pct > 0 and current_price >= entry_price * (1 + take_profit_pct):
        logger.info("[PAPER] %s TAKE_PROFIT: entry=%.0f price=%.0f (%.1f%%), tp=%.1f%%", ticker, entry_price, current_price, pnl_pct, take_profit_pct * 100)
        return ("sell", "take_profit")

    if trailing_stop_pct > 0 and new_highest > entry_price * (1 + trailing_activation_pct):
        trailing_stop_price = new_highest * (1 - trailing_stop_pct)
        if current_price <= trailing_stop_price:
            logger.info("[PAPER] %s TRAILING_STOP: entry=%.0f high=%.0f price=%.0f trail=%.0f (%.1f%%)", ticker, entry_price, new_highest, current_price, trailing_stop_price, pnl_pct)
            return ("sell", "trailing_stop")
        else:
            logger.debug("[PAPER] %s TRAILING_ACTIVE: high=%.0f trail_stop=%.0f price=%.0f distance=%.1f%%", ticker, new_highest, trailing_stop_price, current_price, (current_price - trailing_stop_price) / new_highest * 100)

    # Stall exit: close position if held too long without hitting targets
    if stall_exit_days > 0 and entry_date is not None:
        from datetime import timezone
        now = datetime.now(timezone.utc)
        held_days = (now - entry_date).days if hasattr(entry_date, 'date') else 0
        if held_days >= stall_exit_days:
            logger.info("[PAPER] %s STALL_EXIT: entry=%.0f price=%.0f held=%dd limit=%dd pnl=%.1f%%", ticker, entry_price, current_price, held_days, stall_exit_days, pnl_pct)
            return ("sell", "stall_exit")

    logger.debug("[PAPER] %s HOLD: entry=%.0f price=%.0f high=%.0f pnl=%.1f%% sl=%.1f%% tp=%.1f%% stall=%dd", ticker, entry_price, current_price, new_highest, pnl_pct, stop_loss_pct * 100, take_profit_pct * 100, stall_exit_days)
    return ("hold", "")


async def generate_signals_from_portfolio(max_strategies: int = 5, max_tickers_per_strategy: int = 5) -> list[dict]:
    strategies = await execute_query(
        """SELECT ps.strategy_id, ps.generation
           FROM portfolio_strategy ps
           WHERE ps.status IN ('approved', 'candidate')
           ORDER BY ps.created_at DESC""",
    )
    if not strategies:
        logger.info("[PAPER] No strategies in portfolio, skipping signal gen")
        return []

    # Count current open positions
    count_rows = await execute_query(
        "SELECT COUNT(*) FROM paper_positions WHERE status = 'open'",
    )
    current_open = int(count_rows[0][0]) if count_rows else 0

    signals = []
    for s in strategies[:max_strategies]:
        sid, gen = s[0], s[1]
        params = await load_strategy_params(sid)
        if not params:
            logger.warning("[PAPER] Strategy %d has no params_json, skipping", sid)
            continue

        entry_type = params.get("entry_type", "momentum")
        logger.info(
            "[PAPER] Strategy %d gen=%d entry_type=%s params: entry_limit=%d sl=%.1f%% tp=%.1f%% trailing=%.1f%%/%.1f%%",
            sid, gen, entry_type,
            int(params.get("ranking_candidate_limit", 30)),
            float(params.get("stop_loss_pct", 0)) * 100,
            float(params.get("fixed_take_profit_pct", 0.07)) * 100,
            float(params.get("trailing_activation_pct", 0.07)) * 100,
            float(params.get("trailing_stop_pct", 0.03)) * 100,
        )

        universe = await execute_query(
            "SELECT ticker, name FROM evolution_evaluation_universe WHERE generation = :1",
            [gen],
        )
        for u in universe[:max_tickers_per_strategy]:
            ticker, name = u[0], u[1] or u[0]
            signal, price = await check_entry_signal(ticker, params, current_open, current_open)
            if signal == "buy" and price > 0:
                signals.append({
                    "ticker": ticker,
                    "name": name,
                    "signal": "buy",
                    "price": price,
                    "strategy_id": sid,
                    "generation": gen,
                    "reason": params.get("entry_type", "momentum"),
                })

    logger.info("[PAPER] Generated %d buy signals from %d strategies", len(signals), len(strategies[:max_strategies]))
    return signals


async def check_open_positions_for_exits() -> list[dict]:
    rows = await execute_query(
        """SELECT pp.id, pp.strategy_id, pp.ticker, pp.entry_price, pp.quantity, pp.highest_price, pp.entry_date
           FROM paper_positions pp
           WHERE pp.status = 'open'""",
    )
    exit_signals = []
    from datetime import timezone
    now_utc = datetime.now(timezone.utc)
    for r in rows:
        pos_id, strategy_id, ticker = r[0], r[1], r[2]
        entry_price = float(r[3] or 0)
        qty = int(r[4] or 0)
        entry_date = r[6]
        if entry_price <= 0:
            continue
        params = await load_strategy_params(strategy_id)
        if not params:
            continue
        highest_price = float(r[5] or entry_price or 0)
        current_price = await _get_current_price(ticker)
        if not current_price:
            continue
        new_highest = max(highest_price, current_price)
        if new_highest > highest_price:
            await execute_non_query(
                "UPDATE paper_positions SET highest_price = :1 WHERE id = :2",
                [new_highest, pos_id],
            )
        pnl_pct = ((current_price - entry_price) / entry_price * 100) if entry_price > 0 else 0
        await execute_non_query(
            "UPDATE paper_positions SET current_price = :1, pnl_pct = :2 WHERE id = :3",
            [current_price, pnl_pct, pos_id],
        )

        held_days = 0
        if entry_date and hasattr(entry_date, 'date'):
            if hasattr(entry_date, 'tzinfo') and entry_date.tzinfo is None:
                ed = entry_date.replace(tzinfo=timezone.utc)
            elif hasattr(entry_date, 'tzinfo'):
                ed = entry_date
            else:
                ed = entry_date
            held_days = max(0, (now_utc - ed).total_seconds() / 86400)

        sl_pct = float(params.get("stop_loss_pct", 0))
        tp_pct = float(params.get("fixed_take_profit_pct", 0.07))
        trail_act = float(params.get("trailing_activation_pct", 0.07))
        trail_stop = float(params.get("trailing_stop_pct", 0.03))
        stall_days = int(params.get("stall_exit_days", 0))

        signal, reason = await check_exit_signal(ticker, entry_price, new_highest, params, entry_date)

        # Detailed exit log
        log_msg = (
            f"[EXIT CHECK] ticker={ticker} pos_id={pos_id} strategy={strategy_id} "
            f"entry={entry_price:.0f} current={current_price:.0f} pnl={pnl_pct:.2f}% "
            f"sl={sl_pct*100:.0f}% tp={tp_pct*100:.0f}% "
            f"trail_act={trail_act*100:.0f}%/stop={trail_stop*100:.0f}% "
            f"stall={stall_days}d held={held_days:.1f}d "
            f"result={signal} reason={reason}"
        )
        logger.info(log_msg)

        if signal == "sell":
            exit_signals.append({
                "pos_id": pos_id,
                "strategy_id": strategy_id,
                "ticker": ticker,
                "price": current_price,
                "entry_price": entry_price,
                "quantity": qty,
                "signal": "sell",
                "reason": reason,
            })
    return exit_signals


async def _get_available_cash() -> float:
    bal = await _broker.get_balance()
    cash = float(bal.get("cash", 0))
    return max(0, cash)


async def _get_enforced_max_exposure() -> float:
    from app.services.service_db import get_settings
    settings = await get_settings()
    max_deploy = float(settings.get("max_capital_deployment", 100))
    return _INITIAL_CAPITAL * max_deploy / 100


async def _is_ticker_held(ticker: str) -> bool:
    rows = await execute_query(
        "SELECT COUNT(*) FROM paper_positions WHERE ticker = :1 AND status = 'open'",
        [ticker],
    )
    return int(rows[0][0]) > 0 if rows else False


async def _compute_position_size(price: float, strategy_id: int) -> int:
    if price <= 0:
        return 1
    available = await _get_available_cash()
    max_exposure = await _get_enforced_max_exposure()
    current_exposure = 0
    rows = await execute_query("SELECT COALESCE(SUM(quantity * current_price), 0) FROM paper_positions WHERE status = 'open'")
    if rows and rows[0][0]:
        current_exposure = float(rows[0][0])
    remaining_capacity = max(0, max_exposure - current_exposure)
    max_buy = min(available, remaining_capacity)
    strategy_count = 0
    rows2 = await execute_query("SELECT COUNT(*) FROM portfolio_strategy WHERE status = 'approved'")
    if rows2 and rows2[0][0]:
        strategy_count = int(rows2[0][0])
    per_strategy_budget = max_buy / max(strategy_count, 1)
    position_budget = min(per_strategy_budget, 500000)
    qty = int(position_budget / price)
    return max(qty, 1)


async def execute_signals(signals: list[dict]) -> list[dict]:
    if not signals:
        return []
    results = []
    for sig in signals:
        ticker = sig["ticker"]
        action = sig.get("signal", "buy")
        price = float(sig.get("price", 0))
        strategy_id = sig.get("strategy_id", 0)

        if price <= 0:
            db_price = await _get_current_price(ticker)
            if not db_price:
                continue
            price = db_price

        if action == "buy":
            # Dedup: skip if this ticker is already held
            if await _is_ticker_held(ticker):
                logger.info("[PAPER] %s SKIP buy: already held (strategy=%d)", ticker, strategy_id)
                continue
            available = await _get_available_cash()
            if available <= 0:
                logger.info("[PAPER] %s SKIP buy: no available cash (%.0f)", ticker, available)
                continue
            qty = await _compute_position_size(price, strategy_id)
            if qty <= 0:
                qty = 1
            cost = qty * price
            if cost > available:
                qty = int(available / price)
                if qty <= 0:
                    logger.info("[PAPER] %s SKIP buy: insufficient cash need=%.0f have=%.0f", ticker, cost, available)
                    continue
            req = OrderRequest(ticker=ticker, action="buy", quantity=qty, price=price)
            result = await _broker.place_order(req)
            await execute_non_query(
                """INSERT INTO paper_positions (strategy_id, ticker, entry_price, current_price, quantity, highest_price, entry_date, status)
                   VALUES (:1, :2, :3, :4, :5, :6, CURRENT_TIMESTAMP, 'open')""",
                [strategy_id, ticker, price, price, qty, price],
            )
            await execute_non_query(
                """INSERT INTO paper_trades (strategy_id, ticker, action, price, quantity, trade_date, reason)
                   VALUES (:1, :2, 'buy', :3, :4, CURRENT_TIMESTAMP, :5)""",
                [strategy_id, ticker, price, qty, sig.get("reason", "signal")],
            )
            results.append({"ticker": ticker, "action": "buy", "qty": qty, "filled_price": price, "cost": cost, "status": result.status})

        elif action == "sell":
            pos_id = sig.get("pos_id", 0)
            qty = sig.get("quantity", 0)
            if pos_id and qty > 0:
                entry_price = float(sig.get("entry_price", price))
                req = OrderRequest(ticker=ticker, action="sell", quantity=qty, price=price)
                result = await _broker.place_order(req)
                pnl_pct = (price - entry_price) / entry_price * 100
                pnl_amt = (price - entry_price) * qty
                await execute_non_query(
                    "UPDATE paper_positions SET current_price = :1, pnl_pct = :2, pnl_amt = :3, status = 'closed', exit_date = CURRENT_TIMESTAMP WHERE id = :4",
                    [price, pnl_pct, pnl_amt, pos_id],
                )
                await execute_non_query(
                    "INSERT INTO paper_trades (strategy_id, ticker, action, price, quantity, pnl_pct, trade_date, reason) VALUES (:1, :2, 'sell', :3, :4, :5, CURRENT_TIMESTAMP, :6)",
                    [strategy_id, ticker, price, qty, pnl_pct, sig.get("reason", "signal")],
                )
                results.append({"ticker": ticker, "action": "sell", "qty": qty, "filled_price": price, "pnl_pct": pnl_pct, "status": result.status})

    logger.info("[PAPER] Executed %d/%d signals", len(results), len(signals))
    return results


async def _count_open_positions() -> int:
    rows = await execute_query("SELECT COUNT(*) FROM paper_positions WHERE status = 'open'")
    return int(rows[0][0]) if rows else 0


async def _count_total_trades() -> int:
    rows = await execute_query("SELECT COUNT(*) FROM paper_trades")
    return int(rows[0][0]) if rows else 0


async def _sum_cash() -> float:
    bal = await _broker.get_balance()
    return float(bal.get("cash", 0))


async def run_paper_trading_cycle() -> dict:
    logger.info("[PAPER] Running auto paper trading cycle")
    before = {
        "cash": await _sum_cash(),
        "open_positions": await _count_open_positions(),
        "total_trades": await _count_total_trades(),
    }

    # ── Risk check: block new entries if limits breached ──
    risk = await check_risk_limits()
    risk_blocked = risk.get("blocked", False)
    risk_reasons = risk.get("reasons", [])
    risk_status = risk.get("risk_status", "PASS")
    if risk_blocked:
        logger.warning("[PAPER] Risk check BLOCKED new entries: %s", "; ".join(risk_reasons))

    # ── Exits are always allowed ──
    exit_signals = await check_open_positions_for_exits()
    exit_results = await execute_signals(exit_signals) if exit_signals else []

    # ── Entries only if risk check passes ──
    signals = []
    entry_results = []
    if not risk_blocked:
        signals = await generate_signals_from_portfolio()
        entry_results = await execute_signals(signals) if signals else []
    else:
        logger.info("[PAPER] Risk blocked, skipping new entries")

    total_executed = len(exit_results) + len(entry_results)
    after = {
        "cash": await _sum_cash(),
        "open_positions": await _count_open_positions(),
        "total_trades": await _count_total_trades(),
    }

    # ── Log daily validation metric if validation mode is active ──
    try:
        await log_daily_validation()
    except Exception:
        pass

    result = {
        "exits_found": len(exit_signals),
        "exits_executed": len(exit_results),
        "signals_generated": len(signals),
        "entries_executed": len(entry_results),
        "total_executed": total_executed,
        "risk_status": risk_status,
        "risk_blocked": risk_blocked,
        "risk_reasons": risk_reasons,
        "before": before,
        "after": after,
        "delta": {
            "cash": round(after["cash"] - before["cash"], 2),
            "open_positions": after["open_positions"] - before["open_positions"],
            "total_trades": after["total_trades"] - before["total_trades"],
        },
        "message": f"Exits: {len(exit_results)}/{len(exit_signals)}, Entries: {len(entry_results)}/{len(signals)}",
    }
    logger.info(
        "[PAPER] Cycle done: risk=%s exits=%d entries=%d cash=%.0f→%.0f positions=%d→%d trades=%d→%d",
        risk_status, len(exit_results), len(entry_results),
        before["cash"], after["cash"],
        before["open_positions"], after["open_positions"],
        before["total_trades"], after["total_trades"],
    )
    return result
