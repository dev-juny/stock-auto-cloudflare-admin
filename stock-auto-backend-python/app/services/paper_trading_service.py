from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone
from typing import Optional

from app.database import execute_query, execute_non_query
from app.services.broker import MockBroker, OrderRequest
from app.services.operations_service import check_risk_limits, log_daily_validation
from app.services.service_db import add_system_log

logger = logging.getLogger(__name__)

_broker = MockBroker()


def get_broker() -> MockBroker:
    return _broker


# ── Session Management ─────────────────────────────────────────


async def create_session(
    name: str = "New Session",
    initial_capital: float = 10000000.0,
    max_positions: int = 5,
    position_size: float = 500000.0,
    commission_pct: float = 0,
    slippage_pct: float = 0,
    tax_pct: float = 0,
    auto_mode: bool = False,
) -> dict:
    await execute_non_query(
        """INSERT INTO paper_sessions (name, initial_capital, max_positions, position_size,
           commission_pct, slippage_pct, tax_pct, auto_mode, status, started_at)
           VALUES (:1, :2, :3, :4, :5, :6, :7, :8, 'active', CURRENT_TIMESTAMP)""",
        [name, initial_capital, max_positions, position_size,
         commission_pct, slippage_pct, tax_pct, "Y" if auto_mode else "N"],
    )
    rows = await execute_query("SELECT MAX(id) FROM paper_sessions")
    session_id = int(rows[0][0]) if rows else 1
    await _broker.init_session(session_id, initial_capital)
    return await get_session(session_id)


async def ensure_broker_session(session_id: int):
    sess = await get_session(session_id)
    if sess:
        await _broker.init_session(session_id, sess["initial_capital"])


async def get_session(session_id: int) -> dict | None:
    rows = await execute_query(
        """SELECT id, name, initial_capital, max_positions, position_size,
                  commission_pct, slippage_pct, tax_pct, auto_mode, status,
                  final_cash, final_invested, final_total,
                  started_at, ended_at, created_at
           FROM paper_sessions WHERE id = :1""",
        [session_id],
    )
    if not rows:
        return None
    r = rows[0]
    return {
        "id": r[0],
        "name": r[1] or f"Session #{r[0]}",
        "initial_capital": float(r[2] or 10000000),
        "max_positions": int(r[3] or 5),
        "position_size": float(r[4] or 500000),
        "commission_pct": float(r[5] or 0),
        "slippage_pct": float(r[6] or 0),
        "tax_pct": float(r[7] or 0),
        "auto_mode": r[8] == "Y",
        "status": r[9],
        "final_cash": float(r[10]) if r[10] is not None else None,
        "final_invested": float(r[11]) if r[11] is not None else None,
        "final_total": float(r[12]) if r[12] is not None else None,
        "started_at": str(r[13]) if r[13] else "",
        "ended_at": str(r[14]) if r[14] else None,
        "created_at": str(r[15]) if r[15] else "",
    }


async def list_sessions() -> list[dict]:
    rows = await execute_query(
        """SELECT id, name, initial_capital, max_positions, auto_mode, status,
                  started_at, ended_at, created_at
           FROM paper_sessions ORDER BY id DESC""",
    )
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "name": r[1] or f"Session #{r[0]}",
            "initial_capital": float(r[2] or 10000000),
            "max_positions": int(r[3] or 5),
            "auto_mode": r[4] == "Y",
            "status": r[5],
            "started_at": str(r[6]) if r[6] else "",
            "ended_at": str(r[7]) if r[7] else None,
            "created_at": str(r[8]) if r[8] else "",
        })
    return items


async def stop_session(session_id: int) -> dict | None:
    sess = await get_session(session_id)
    if not sess:
        return None
    if sess["status"] != "active":
        return sess
    bal = await _broker.get_balance(session_id)
    final_cash = bal.get("cash", 0)
    final_invested = bal.get("invested", 0)
    final_total = bal.get("total", 0)
    # Close any open positions
    await execute_non_query(
        """UPDATE paper_positions SET status = 'closed', exit_date = CURRENT_TIMESTAMP
           WHERE session_id = :1 AND status = 'open'""",
        [session_id],
    )
    await execute_non_query(
        """UPDATE paper_sessions SET status = 'stopped', ended_at = CURRENT_TIMESTAMP,
           final_cash = :1, final_invested = :2, final_total = :3 WHERE id = :4""",
        [final_cash, final_invested, final_total, session_id],
    )
    sess["status"] = "stopped"
    sess["ended_at"] = datetime.now(timezone.utc).isoformat()
    sess["final_cash"] = final_cash
    sess["final_invested"] = final_invested
    sess["final_total"] = final_total
    return sess


async def reset_session(session_id: int) -> dict | None:
    sess = await get_session(session_id)
    if not sess:
        return None
    await execute_non_query(
        "UPDATE paper_positions SET status = 'closed', exit_date = CURRENT_TIMESTAMP WHERE session_id = :1 AND status = 'open'",
        [session_id],
    )
    await execute_non_query(
        "DELETE FROM paper_trades WHERE session_id = :1",
        [session_id],
    )
    await execute_non_query(
        "DELETE FROM paper_positions WHERE session_id = :1",
        [session_id],
    )
    initial_capital = sess["initial_capital"]
    await _broker.reset_session(session_id, initial_capital)
    await execute_non_query(
        "UPDATE paper_sessions SET started_at = CURRENT_TIMESTAMP, ended_at = NULL, final_cash = NULL, final_invested = NULL, final_total = NULL WHERE id = :1",
        [session_id],
    )
    return await get_session(session_id)


async def get_active_session() -> dict | None:
    rows = await execute_query(
        "SELECT id FROM paper_sessions WHERE status = 'active' ORDER BY id DESC FETCH FIRST 1 ROW ONLY",
    )
    if rows:
        sess = await get_session(int(rows[0][0]))
        if sess:
            await ensure_broker_session(sess["id"])
        return sess
    # Fallback: create a default session
    sess = await create_session(name="Default Session", initial_capital=10000000.0, auto_mode=True)
    return sess


# ── Price Helpers ──────────────────────────────────────────────


async def _get_current_price(ticker: str) -> float | None:
    rows = await execute_query(
        "SELECT close_price FROM stock_daily_prices WHERE ticker = :1 ORDER BY trade_date DESC FETCH FIRST 1 ROW ONLY",
        [ticker],
    )
    if rows and rows[0][0]:
        return float(rows[0][0])
    rows = await execute_query(
        "SELECT close_price FROM stock_daily WHERE code = :1 ORDER BY trade_date DESC FETCH FIRST 1 ROW ONLY",
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
    result = [float(r[0]) for r in rows if r[0]]
    if len(result) >= days:
        return result
    rows = await execute_query(
        f"SELECT close_price FROM stock_daily WHERE code = :1 ORDER BY trade_date DESC FETCH FIRST {days} ROWS ONLY",
        [ticker],
    )
    result2 = [float(r[0]) for r in rows if r[0]]
    return result2 if len(result2) >= len(result) else result


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


# ── Entry / Exit Signal Logic ──────────────────────────────────


async def check_entry_signal(
    ticker: str,
    params: dict,
    max_positions_count: int,
    current_open_positions: int,
    summary: dict,
) -> tuple[str, float]:
    entry_type = params.get("entry_type", "momentum")
    ranking_candidate_limit = int(params.get("ranking_candidate_limit", 30))
    min_volume = int(params.get("min_volume", 0))
    max_volatility = float(params.get("max_volatility", 0.12))

    if max_positions_count > 0 and current_open_positions >= max_positions_count:
        logger.debug("[PAPER] %s SKIP: open positions %d >= max session positions %d", ticker, current_open_positions, max_positions_count)
        return ("hold", 0)

    if current_open_positions >= ranking_candidate_limit:
        logger.debug("[PAPER] %s SKIP: open positions %d >= limit %d", ticker, current_open_positions, ranking_candidate_limit)
        return ("hold", 0)

    prices = await _get_price_history(ticker, 30)
    if len(prices) < 20:
        logger.debug("[PAPER] %s SKIP: insufficient price history (%d days)", ticker, len(prices))
        return ("hold", 0)
    current_price = prices[0]

    def _check_momentum():
        mp = int(params.get("momentum_period", 5))
        if len(prices) < mp + 1:
            return False
        sma = sum(prices[:mp]) / mp
        pma = sum(prices[1:mp + 1]) / mp
        cond = current_price > sma and pma >= (prices[1] if len(prices) > 1 else sma)
        if cond:
            logger.debug("[PAPER] %s MOMENTUM(P=%d): price=%.0f MA=%.0f prev_MA=%.0f BUY", ticker, mp, current_price, sma, pma)
        return cond

    def _check_breakout():
        bp = int(params.get("breakout_period", 20))
        if len(prices) < bp + 1:
            return False
        high = max(prices[1:bp + 1])
        cond = current_price > high * 1.01
        if cond:
            logger.debug("[PAPER] %s BREAKOUT(P=%d): price=%.0f high=%.0f BUY", ticker, bp, current_price, high)
        return cond

    def _check_pullback():
        pt = float(params.get("pullback_threshold", 0.02))
        if len(prices) < 10:
            return False
        h10 = max(prices[:10])
        l10 = min(prices[:10])
        drop = (h10 - current_price) / h10
        cond = drop > pt and current_price > l10 * 1.01
        if cond:
            logger.debug("[PAPER] %s PULLBACK(threshold=%.1f%%): drop=%.1f%% BUY", ticker, pt * 100, drop * 100)
        return cond

    if entry_type in ("momentum", "hybrid") and _check_momentum():
        return ("buy", current_price)
    if entry_type in ("breakout", "hybrid") and _check_breakout():
        return ("buy", current_price)
    if entry_type in ("pullback", "hybrid") and _check_pullback():
        return ("buy", current_price)

    if min_volume > 0:
        volume_rows = await execute_query(
            "SELECT volume FROM stock_daily_prices WHERE ticker = :1 ORDER BY trade_date DESC FETCH FIRST 5 ROWS ONLY",
            [ticker],
        )
        valid_vols = [float(r[0]) for r in volume_rows if r[0]] if volume_rows else []
        if len(valid_vols) < 3:
            volume_rows = await execute_query(
                "SELECT volume FROM stock_daily WHERE code = :1 AND volume > 0 ORDER BY trade_date DESC FETCH FIRST 5 ROWS ONLY",
                [ticker],
            )
            valid_vols = [float(r[0]) for r in volume_rows if r[0]] if volume_rows else []
        if valid_vols:
            avg_vol = sum(valid_vols) / len(valid_vols)
            if avg_vol < min_volume:
                logger.debug("[PAPER] %s SKIP: avg_volume %.0f < min_volume %d", ticker, avg_vol, min_volume)
                summary["volume_fail"] += 1
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

    if stall_exit_days > 0 and entry_date is not None:
        now = datetime.now(timezone.utc)
        if isinstance(entry_date, datetime):
            if entry_date.tzinfo is None:
                entry_date = entry_date.replace(tzinfo=timezone.utc)
            held_days = (now - entry_date).days
        else:
            held_days = 0
        if held_days >= stall_exit_days:
            logger.info("[PAPER] %s STALL_EXIT: entry=%.0f price=%.0f held=%dd limit=%dd pnl=%.1f%%", ticker, entry_price, current_price, held_days, stall_exit_days, pnl_pct)
            return ("sell", "stall_exit")

    logger.debug("[PAPER] %s HOLD: entry=%.0f price=%.0f high=%.0f pnl=%.1f%% sl=%.1f%% tp=%.1f%% stall=%dd", ticker, entry_price, current_price, new_highest, pnl_pct, stop_loss_pct * 100, take_profit_pct * 100, stall_exit_days)
    return ("hold", "")


# ── Signal Generation ──────────────────────────────────────────


async def generate_signals_from_portfolio(
    session_id: int = 1,
    max_strategies: Optional[int] = None,
    max_tickers_per_strategy: Optional[int] = None,
) -> tuple[list[dict], dict]:
    if max_strategies is None or max_tickers_per_strategy is None:
        from app.services.operations_service import get_scan_settings
        scan_settings = await get_scan_settings()
        if max_strategies is None:
            max_strategies = scan_settings["max_strategies"]
        if max_tickers_per_strategy is None:
            max_tickers_per_strategy = scan_settings["max_tickers_per_strategy"]
    strategies = await execute_query(
        """SELECT ps.strategy_id, ps.generation
           FROM portfolio_strategy ps
           WHERE ps.status IN ('approved', 'candidate')
           ORDER BY ps.created_at DESC""",
    )
    if not strategies:
        logger.info("[PAPER] No strategies in portfolio, skipping signal gen")
        return [], {"strategies_scanned": 0, "universe_total": 0, "momentum_pass": 0, "breakout_pass": 0, "pullback_pass": 0, "volume_fail": 0, "risk_reject": 0, "generated": 0}

    risk_check = await check_risk_limits()
    risk_blocked = risk_check.get("blocked", False)

    count_rows = await execute_query(
        "SELECT COUNT(*) FROM paper_positions WHERE status = 'open' AND session_id = :1",
        [session_id],
    )
    current_open = int(count_rows[0][0]) if count_rows else 0

    signals = []
    summary = {
        "strategies_scanned": 0,
        "universe_total": 0,
        "momentum_pass": 0,
        "breakout_pass": 0,
        "pullback_pass": 0,
        "volume_fail": 0,
        "risk_reject": 0,
        "generated": 0,
    }

    for s in strategies[:max_strategies]:
        sid, gen = s[0], s[1]
        params = await load_strategy_params(sid)
        if not params:
            logger.warning("[PAPER] Strategy %d has no params_json, skipping", sid)
            continue

        summary["strategies_scanned"] += 1
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
        strategy_universe_count = len(universe[:max_tickers_per_strategy])
        summary["universe_total"] += strategy_universe_count

        for u in universe[:max_tickers_per_strategy]:
            ticker, name = u[0], u[1] or u[0]
            signal, price = await check_entry_signal(ticker, params, current_open, current_open, summary)
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
                if entry_type == "hybrid":
                    summary["momentum_pass"] += 1
                elif entry_type == "momentum":
                    summary["momentum_pass"] += 1
                elif entry_type == "breakout":
                    summary["breakout_pass"] += 1
                elif entry_type == "pullback":
                    summary["pullback_pass"] += 1

    summary["generated"] = len(signals)
    if risk_blocked:
        summary["risk_reject"] = summary["generated"]
        summary["generated"] = 0
        logger.info(
            "[PAPER] Risk blocked: %d signals rejected by risk limits",
            summary["risk_reject"],
        )
        return [], summary
    logger.info(
        "[PAPER] Generated %d buy signals from %d strategies (universe=%d momentum=%d breakout=%d pullback=%d)",
        len(signals), summary["strategies_scanned"],
        summary["universe_total"], summary["momentum_pass"],
        summary["breakout_pass"], summary["pullback_pass"],
    )
    return signals, summary


async def check_open_positions_for_exits(session_id: int = 1) -> list[dict]:
    rows = await execute_query(
        """SELECT pp.id, pp.strategy_id, pp.ticker, pp.entry_price, pp.quantity, pp.highest_price, pp.entry_date
           FROM paper_positions pp
           WHERE pp.status = 'open' AND pp.session_id = :1""",
        [session_id],
    )
    exit_signals = []
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


# ── Cash / Position Helpers ────────────────────────────────────


async def _get_available_cash(session_id: int = 1) -> float:
    await ensure_broker_session(session_id)
    bal = await _broker.get_balance(session_id)
    cash = float(bal.get("cash", 0))
    return max(0, cash)


async def _get_enforced_max_exposure(session_id: int = 1) -> float:
    sess = await get_session(session_id)
    if not sess:
        return 10000000.0
    from app.services.operations_service import get_risk_settings
    risk_settings = await get_risk_settings()
    max_deploy = float(risk_settings.get("max_portfolio_allocation", 40))
    return sess["initial_capital"] * max_deploy / 100


async def _is_ticker_held(ticker: str, session_id: int = 1) -> bool:
    rows = await execute_query(
        "SELECT COUNT(*) FROM paper_positions WHERE ticker = :1 AND status = 'open' AND session_id = :2",
        [ticker, session_id],
    )
    return int(rows[0][0]) > 0 if rows else False


async def _compute_position_size(price: float, strategy_id: int, session_id: int = 1) -> int:
    if price <= 0:
        return 1
    sess = await get_session(session_id)
    if not sess:
        return 1
    available = await _get_available_cash(session_id)
    max_exposure = await _get_enforced_max_exposure(session_id)
    current_exposure = 0
    rows = await execute_query(
        "SELECT COALESCE(SUM(quantity * current_price), 0) FROM paper_positions WHERE status = 'open' AND session_id = :1",
        [session_id],
    )
    if rows and rows[0][0]:
        current_exposure = float(rows[0][0])
    remaining_capacity = max(0, max_exposure - current_exposure)
    max_buy = min(available, remaining_capacity)
    strategy_count = 0
    rows2 = await execute_query("SELECT COUNT(*) FROM portfolio_strategy WHERE status = 'approved'")
    if rows2 and rows2[0][0]:
        strategy_count = int(rows2[0][0])
    per_strategy_budget = max_buy / max(strategy_count, 1)
    max_position_size = sess["position_size"]
    position_budget = min(per_strategy_budget, max_position_size)
    qty = int(position_budget / price)
    return max(qty, 1)


# ── Execution ──────────────────────────────────────────────────


async def execute_signals(signals: list[dict], session_id: int = 1) -> list[dict]:
    if not signals:
        return []
    sess = await get_session(session_id)
    max_pos = int(sess.get("max_positions", 100)) if sess else 100
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
            current_open = await _count_open_positions(session_id)
            if current_open >= max_pos:
                logger.info("[PAPER] %s SKIP buy: open positions %d >= max %d", ticker, current_open, max_pos)
                continue
            if await _is_ticker_held(ticker, session_id):
                logger.info("[PAPER] %s SKIP buy: already held (strategy=%d)", ticker, strategy_id)
                continue
            available = await _get_available_cash(session_id)
            if available <= 0:
                logger.info("[PAPER] %s SKIP buy: no available cash (%.0f)", ticker, available)
                continue
            qty = await _compute_position_size(price, strategy_id, session_id)
            if qty <= 0:
                qty = 1
            cost = qty * price
            if cost > available:
                qty = int(available / price)
                if qty <= 0:
                    logger.info("[PAPER] %s SKIP buy: insufficient cash need=%.0f have=%.0f", ticker, cost, available)
                    continue

            # P3: Hard exposure limit – reject if order would exceed max_capital_deployment
            max_exposure = await _get_enforced_max_exposure(session_id)
            rows_exp = await execute_query(
                "SELECT COALESCE(SUM(quantity * current_price), 0) FROM paper_positions WHERE status = 'open' AND session_id = :1",
                [session_id],
            )
            current_exposure = float(rows_exp[0][0]) if rows_exp and rows_exp[0][0] else 0
            if current_exposure + cost > max_exposure:
                logger.info(
                    "[PAPER] %s SKIP buy: exposure %.0f + %.0f > max %.0f (%.1f%% > %.1f%%)",
                    ticker, current_exposure, cost, max_exposure,
                    (current_exposure + cost) / max_exposure * 100, 100.0,
                )
                await add_system_log("RISK", "order_risk_reject",
                    f"Exposure limit: {ticker} cost={cost:.0f} exposure={current_exposure:.0f}+{cost:.0f}={current_exposure+cost:.0f} > max={max_exposure:.0f}")
                continue

            req = OrderRequest(ticker=ticker, action="buy", quantity=qty, price=price)
            result = await _broker.place_order(req, session_id)
            await execute_non_query(
                """INSERT INTO paper_positions (session_id, strategy_id, ticker, entry_price, current_price, quantity, highest_price, entry_date, status)
                   VALUES (:1, :2, :3, :4, :5, :6, :7, CURRENT_TIMESTAMP, 'open')""",
                [session_id, strategy_id, ticker, price, price, qty, price],
            )
            await execute_non_query(
                """INSERT INTO paper_trades (session_id, strategy_id, ticker, action, price, quantity, trade_date, reason)
                   VALUES (:1, :2, :3, 'buy', :4, :5, CURRENT_TIMESTAMP, :6)""",
                [session_id, strategy_id, ticker, price, qty, sig.get("reason", "signal")],
            )
            results.append({"ticker": ticker, "action": "buy", "qty": qty, "filled_price": price, "cost": cost, "status": result.status})

        elif action == "sell":
            pos_id = sig.get("pos_id", 0)
            qty = sig.get("quantity", 0)
            if pos_id and qty > 0:
                entry_price = float(sig.get("entry_price", price))
                req = OrderRequest(ticker=ticker, action="sell", quantity=qty, price=price)
                result = await _broker.place_order(req, session_id)
                pnl_pct = (price - entry_price) / entry_price * 100
                pnl_amt = (price - entry_price) * qty
                await execute_non_query(
                    "UPDATE paper_positions SET current_price = :1, pnl_pct = :2, pnl_amt = :3, status = 'closed', exit_date = CURRENT_TIMESTAMP WHERE id = :4",
                    [price, pnl_pct, pnl_amt, pos_id],
                )
                await execute_non_query(
                    "INSERT INTO paper_trades (session_id, strategy_id, ticker, action, price, quantity, pnl_pct, trade_date, reason) VALUES (:1, :2, :3, 'sell', :4, :5, :6, CURRENT_TIMESTAMP, :7)",
                    [session_id, strategy_id, ticker, price, qty, pnl_pct, sig.get("reason", "signal")],
                )
                results.append({"ticker": ticker, "action": "sell", "qty": qty, "filled_price": price, "pnl_pct": pnl_pct, "status": result.status})

    logger.info("[PAPER] Executed %d/%d signals", len(results), len(signals))
    return results


async def _count_open_positions(session_id: int = 1) -> int:
    rows = await execute_query("SELECT COUNT(*) FROM paper_positions WHERE status = 'open' AND session_id = :1", [session_id])
    return int(rows[0][0]) if rows else 0


async def _count_total_trades(session_id: int = 1) -> int:
    rows = await execute_query("SELECT COUNT(*) FROM paper_trades WHERE session_id = :1", [session_id])
    return int(rows[0][0]) if rows else 0


async def _sum_cash(session_id: int = 1) -> float:
    bal = await _broker.get_balance(session_id)
    return float(bal.get("cash", 0))


# ── Full Cycle ─────────────────────────────────────────────────


async def run_paper_trading_cycle(session_id: int | None = None) -> dict:
    if session_id is None:
        sess = await get_active_session()
        if not sess:
            return {"error": "No active session"}
        session_id = sess["id"]

    logger.info("[PAPER] Running cycle for session %d", session_id)
    before = {
        "cash": await _sum_cash(session_id),
        "open_positions": await _count_open_positions(session_id),
        "total_trades": await _count_total_trades(session_id),
    }

    risk = await check_risk_limits()
    risk_blocked = risk.get("blocked", False)
    risk_reasons = risk.get("reasons", [])
    risk_status = risk.get("risk_status", "PASS")
    if risk_blocked:
        logger.warning("[PAPER] Risk check BLOCKED new entries: %s", "; ".join(risk_reasons))

    exit_signals = await check_open_positions_for_exits(session_id)
    exit_results = await execute_signals(exit_signals, session_id) if exit_signals else []

    if not risk_blocked:
        signals, scan_summary = await generate_signals_from_portfolio(session_id)
        entry_results = await execute_signals(signals, session_id) if signals else []
    else:
        signals = []
        scan_summary = {"strategies_scanned": 0, "universe_total": 0, "momentum_pass": 0, "breakout_pass": 0, "pullback_pass": 0, "volume_fail": 0, "risk_reject": 0, "generated": 0}
        entry_results = []

    total_executed = len(exit_results) + len(entry_results)
    after = {
        "cash": await _sum_cash(session_id),
        "open_positions": await _count_open_positions(session_id),
        "total_trades": await _count_total_trades(session_id),
    }

    try:
        await log_daily_validation()
    except Exception:
        pass

    result = {
        "session_id": session_id,
        "exits_found": len(exit_signals),
        "exits_executed": len(exit_results),
        "signals_generated": len(signals),
        "scan_summary": scan_summary,
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
        "message": f"Session {session_id}: Exits: {len(exit_results)}/{len(exit_signals)}, Entries: {len(entry_results)}/{len(signals)}",
    }
    logger.info(
        "[PAPER] Session %d cycle done: risk=%s exits=%d entries=%d cash=%.0f→%.0f positions=%d→%d trades=%d→%d",
        session_id, risk_status, len(exit_results), len(entry_results),
        before["cash"], after["cash"],
        before["open_positions"], after["open_positions"],
        before["total_trades"], after["total_trades"],
    )
    return result
