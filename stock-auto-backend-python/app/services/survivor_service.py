from __future__ import annotations

import json
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.database import execute_query, execute_non_query
from app.services.service_db import add_system_log, get_settings
from app.services.strategy_lifecycle import (
    get_strategies_by_stage, get_strategies_by_stages,
    set_lifecycle_stage, promote_strategy, demote_strategy,
    get_production_lock_status,
)

logger = logging.getLogger(__name__)

PAPER_TRADING_MIN_DAYS = 7
SURVIVOR_EVAL_INTERVAL_HOURS = 24

# Default survivor score weights
DEFAULT_WEIGHTS = {
    "recent_paper_return": 0.40,
    "portfolio_backtest_return": 0.20,
    "profit_factor": 0.15,
    "max_drawdown": 0.10,  # inverted: lower drawdown = better score
    "sharpe_ratio": 0.10,
    "stability": 0.05,
}


async def get_survivor_weights() -> dict:
    raw = await get_settings()
    return {
        "recent_paper_return": float(raw.get("survivor_w_recent_return", DEFAULT_WEIGHTS["recent_paper_return"])),
        "portfolio_backtest_return": float(raw.get("survivor_w_backtest_return", DEFAULT_WEIGHTS["portfolio_backtest_return"])),
        "profit_factor": float(raw.get("survivor_w_profit_factor", DEFAULT_WEIGHTS["profit_factor"])),
        "max_drawdown": float(raw.get("survivor_w_max_drawdown", DEFAULT_WEIGHTS["max_drawdown"])),
        "sharpe_ratio": float(raw.get("survivor_w_sharpe", DEFAULT_WEIGHTS["sharpe_ratio"])),
        "stability": float(raw.get("survivor_w_stability", DEFAULT_WEIGHTS["stability"])),
    }


async def update_survivor_weights(weights: dict):
    import app.services.service_db as sdb
    for k, v in weights.items():
        await sdb.update_setting(f"survivor_w_{k}", float(v), "number")


async def _get_paper_trading_performance(strategy_id: int) -> dict:
    rows = await execute_query(
        """SELECT ticker, price, price, quantity, pnl_pct, pnl_amt, action, trade_date
           FROM paper_trades WHERE strategy_id = :1 ORDER BY trade_date DESC""",
        [strategy_id],
    )
    if not rows:
        return {}

    total_pnl = 0
    wins = 0
    total = 0
    recent_pnl = 0
    recent_count = 0
    max_consecutive_losses = 0
    current_consecutive_losses = 0
    first_trade_date = None
    last_trade_date = None

    for r in rows:
        pnl = r[4] or 0
        total_pnl += pnl
        total += 1
        if pnl > 0:
            wins += 1
            current_consecutive_losses = 0
        else:
            current_consecutive_losses += 1
            max_consecutive_losses = max(max_consecutive_losses, current_consecutive_losses)

        if total <= 20:
            recent_pnl += pnl
            recent_count += 1

        entered = r[7] if len(r) > 7 else None
        if entered:
            if first_trade_date is None or entered < first_trade_date:
                first_trade_date = entered
            if last_trade_date is None or entered > last_trade_date:
                last_trade_date = entered

    days_active = 0
    if first_trade_date and last_trade_date:
        delta = last_trade_date - first_trade_date
        days_active = delta.days if hasattr(delta, 'days') else 0

    return {
        "total_pnl_pct": total_pnl,
        "win_rate": (wins / total * 100) if total > 0 else 0,
        "total_trades": total,
        "recent_20_pnl": recent_pnl,
        "recent_trades": recent_count,
        "max_consecutive_losses": max_consecutive_losses,
        "days_active": days_active,
        "avg_pnl_per_trade": total_pnl / total if total > 0 else 0,
    }


async def _get_backtest_performance(strategy_id: int) -> dict:
    rows = await execute_query(
        """SELECT fitness_score, total_return, win_rate, total_trades, max_drawdown,
                  profit_factor, sharpe_ratio, cagr
           FROM strategy_performance WHERE strategy_id = :1 ORDER BY generation DESC""",
        [strategy_id],
    )
    if rows:
        r = rows[0]
        return {
            "fitness": r[0] or 0, "total_return": r[1] or 0, "win_rate": r[2] or 0,
            "trades": r[3] or 0, "mdd": r[4] or 0, "profit_factor": r[5] or 0,
            "sharpe": r[6] or 0, "cagr": r[7] or 0,
        }
    return {}


async def calculate_survivor_score(strategy_id: int) -> dict:
    bt = await _get_backtest_performance(strategy_id)
    pt = await _get_paper_trading_performance(strategy_id)
    weights = await get_survivor_weights()

    recent_return = abs(pt.get("recent_20_pnl", 0)) if pt.get("recent_20_pnl", 0) >= 0 else 0
    bt_return = max(bt.get("total_return", 0), 0)
    pf = min(bt.get("profit_factor", 0), 10)
    mdd_inv = max(0, 100 - abs(bt.get("mdd", 0))) / 100
    sharpe = max(min(bt.get("sharpe", 0) / 3, 1), 0)
    stability = min(pt.get("total_trades", 0) / 100, 1) if pt.get("total_trades", 0) > 30 else 0

    weighted_fitness = weights["recent_paper_return"] * recent_return
    weighted_return = weights["portfolio_backtest_return"] * bt_return
    weighted_pf = weights["profit_factor"] * (pf / 10)
    weighted_mdd = weights["max_drawdown"] * mdd_inv
    weighted_sharpe = weights["sharpe_ratio"] * sharpe
    weighted_stability = weights["stability"] * stability

    score = weighted_fitness + weighted_return + weighted_pf + weighted_mdd + weighted_sharpe + weighted_stability

    return {
        "strategy_id": strategy_id,
        "survivor_score": round(score, 4),
        "breakdown": {
            "weighted_fitness": round(weighted_fitness, 4),
            "weighted_return": round(weighted_return, 4),
            "weighted_profit_factor": round(weighted_pf, 4),
            "weighted_drawdown": round(weighted_mdd, 4),
            "weighted_sharpe": round(weighted_sharpe, 4),
            "weighted_stability": round(weighted_stability, 4),
        },
        "raw": {"backtest": bt, "paper_trading": pt},
        "weights": weights,
    }


async def _save_score_snapshot(strategy_id: int, score_data: dict):
    bd = score_data["breakdown"]
    raw = score_data["raw"]
    await execute_non_query(
        """INSERT INTO survivor_score_snapshots
           (strategy_id, survivor_score, weighted_fitness, weighted_return,
            weighted_profit_factor, weighted_drawdown, weighted_sharpe, weighted_stability,
            win_rate, total_trades, cagr, mdd, recent_pnl_pct, consecutive_losses, details_json)
           VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15)""",
        [
            strategy_id, score_data["survivor_score"],
            bd["weighted_fitness"], bd["weighted_return"],
            bd["weighted_profit_factor"], bd["weighted_drawdown"],
            bd["weighted_sharpe"], bd["weighted_stability"],
            raw["paper_trading"].get("win_rate", 0),
            raw["paper_trading"].get("total_trades", 0),
            raw["backtest"].get("cagr", 0),
            raw["backtest"].get("mdd", 0),
            raw["paper_trading"].get("recent_20_pnl", 0),
            raw["paper_trading"].get("max_consecutive_losses", 0),
            json.dumps(score_data),
        ],
    )


async def evaluate_survivors() -> dict:
    paper_strategies = await get_strategies_by_stage("paper_trading")
    if not paper_strategies:
        return {"status": "SKIPPED", "message": "No strategies in paper_trading stage"}

    results = []
    promoted_to_survivor = 0
    demoted = 0
    holding = 0
    survivors_status = []
    errors = []

    for s in paper_strategies:
        sid = s["strategy_id"]
        try:
            score_data = await calculate_survivor_score(sid)
            await _save_score_snapshot(sid, score_data)
            results.append(score_data)

            bt = score_data["raw"]["backtest"]
            pt = score_data["raw"]["paper_trading"]

            # Grace period: if no paper trades yet, defer evaluation
            if not pt or pt.get("total_trades", 0) == 0:
                holding += 1
                survivors_status.append({"strategy_id": sid, "status": "HOLDING", "message": "No paper trades yet"})
                continue

            elimination_reasons = []
            if pt.get("max_consecutive_losses", 0) >= 5:
                elimination_reasons.append("Consecutive losses >= 5")
            if pt.get("win_rate", 100) < 30 and pt.get("total_trades", 0) >= 10:
                elimination_reasons.append(f"Win rate {pt.get('win_rate',0):.1f}% < 30%")
            if abs(bt.get("mdd", 0)) > 25:
                elimination_reasons.append(f"MDD {bt.get('mdd',0):.1f}% > 25%")
            if bt.get("profit_factor", 1) < 1.1 and bt.get("trades", 0) >= 20:
                elimination_reasons.append(f"Profit factor {bt.get('profit_factor',1):.2f} < 1.1")

            if elimination_reasons:
                await demote_strategy(sid, "failed", "; ".join(elimination_reasons))
                demoted += 1
                survivors_status.append({"strategy_id": sid, "status": "ELIMINATED", "reasons": elimination_reasons})
            else:
                await promote_strategy(sid, "Passed survivor evaluation")
                promoted_to_survivor += 1
                survivors_status.append({"strategy_id": sid, "status": "SURVIVED"})
        except Exception as e:
            errors.append({"strategy_id": sid, "error": str(e)[:200]})
            logger.error("Survivor eval error for strategy %s: %s", sid, e)

    await add_system_log("survivor", "survivor_service",
        f"Evaluated {len(paper_strategies)} paper strategies: {promoted_to_survivor} survived, {demoted} eliminated, {holding} holding",
        {"total": len(paper_strategies), "survived": promoted_to_survivor, "eliminated": demoted, "holding": holding, "errors": errors})

    return {
        "status": "SUCCESS",
        "evaluated": len(paper_strategies),
        "promoted_to_survivor": promoted_to_survivor,
        "demoted": demoted,
        "holding": holding,
        "results": results,
        "survivors": survivors_status,
        "errors": errors,
    }


async def promote_to_production(strategy_id: int, reason: str = "Manual promotion") -> dict:
    from app.services.strategy_lifecycle import promote_to_production as _promote
    return await _promote(strategy_id, reason)


async def rollback_production(strategy_id: int, target: str = "survivor", reason: str = "Manual rollback") -> dict:
    return await demote_strategy(strategy_id, target, reason)


async def get_survivor_pool() -> list[dict]:
    rows = await execute_query(
        """SELECT sp.id, sp.strategy_id, sp.name, sp.generation, sp.entry_type,
                  sp.promoted_at, sp.last_evaluated_at, sp.survivor_score,
                  sp.score_breakdown_json, sp.eval_count, sp.total_evaluations,
                  sp.passed_evaluations, sp.failed_evaluations, sp.status,
                  COALESCE(sr.total_return, 0), COALESCE(sr.win_rate, 0),
                  COALESCE(sr.max_drawdown, 0), COALESCE(sr.profit_factor, 0),
                  COALESCE(sr.fitness_score, 0), COALESCE(sr.total_trades, 0)
           FROM survivor_pool sp
           LEFT JOIN strategy_registry sr ON sr.strategy_id = sp.strategy_id
           WHERE sp.status = 'active'
           ORDER BY sp.survivor_score DESC""",
    )
    return [
        {"id": r[0], "strategy_id": r[1], "name": r[2] or "", "generation": r[3] or 0,
         "entry_type": r[4] or "",
         "promoted_at": r[5].isoformat() if r[5] and hasattr(r[5], 'isoformat') else (str(r[5]) if r[5] else ""),
         "last_evaluated_at": r[6].isoformat() if r[6] and hasattr(r[6], 'isoformat') else (str(r[6]) if r[6] else ""),
         "survivor_score": r[7] or 0, "score_breakdown": json.loads(r[8]) if r[8] else {},
         "eval_count": r[9] or 0, "total_evaluations": r[10] or 0,
         "passed_evaluations": r[11] or 0, "failed_evaluations": r[12] or 0,
         "status": r[13] or "active",
         "total_return": r[14] or 0, "win_rate": r[15] or 0,
         "mdd": r[16] or 0, "profit_factor": r[17] or 0,
         "fitness": r[18] or 0, "trades": r[19] or 0}
        for r in rows
    ]


async def evaluate_production_candidates() -> dict:
    survivors = await get_strategies_by_stage("survivor")
    if not survivors:
        return {"status": "SKIPPED", "message": "No survivors to evaluate"}

    candidates = await get_strategies_by_stage("production_candidate")
    production = await get_strategies_by_stage("production")

    scored = []
    for s in survivors:
        score_data = await calculate_survivor_score(s["strategy_id"])
        scored.append({"strategy_id": s["strategy_id"], **score_data})

    scored.sort(key=lambda x: x.get("survivor_score", 0), reverse=True)

    candidate_count = len(candidates)
    production_count = len(production)
    promoted = 0

    for s in scored:
        sid = s["strategy_id"]
        if sid in [c["strategy_id"] for c in candidates]:
            continue
        if sid in [p["strategy_id"] for p in production]:
            continue
        if s["survivor_score"] >= 0.5:
            await promote_strategy(sid, "Auto-promoted from survivor pool (score >= 0.5)")
            promoted += 1
            score_row = await execute_query(
                "SELECT name, generation FROM strategy_registry WHERE strategy_id = :1", [sid],
            )
            name = score_row[0][0] if score_row else ""
            gen = score_row[0][1] if score_row else 0
            await execute_non_query(
                """INSERT INTO survivor_pool (strategy_id, name, generation, entry_type, survivor_score, score_breakdown_json, status)
                   VALUES (:1,:2,:3,:4,:5,:6,'active')""",
                [sid, name, gen, s.get("entry_type", ""), s["survivor_score"], json.dumps(s)],
            )

    return {
        "status": "SUCCESS",
        "survivors_evaluated": len(scored),
        "promoted_to_candidate": promoted,
        "total_candidates": candidate_count + promoted,
        "total_production": production_count,
    }


async def auto_replace_production() -> dict:
    return {
        "status": "BLOCKED",
        "message": "Auto-replace is disabled. Production changes require manual admin approval.",
        "details": {"auto_replace_disabled": True},
    }


async def get_production_dashboard() -> dict:
    production = await get_strategies_by_stage("production")
    production_candidates = await get_strategies_by_stage("production_candidate")
    shadow_trading = await get_strategies_by_stage("shadow_trading")
    survivors = await get_strategies_by_stage("survivor")
    paper_trading = await get_strategies_by_stage("paper_trading")
    failed = await get_strategies_by_stage("failed")
    retired = await get_strategies_by_stage("retired")

    survivor_pool = await get_survivor_pool()

    weights = await get_survivor_weights()

    scored_production = []
    for p in production:
        sd = await calculate_survivor_score(p["strategy_id"])
        scored_production.append({**p, "survivor_score": sd["survivor_score"],
                                  "score_breakdown": sd["breakdown"]})

    history = await get_production_history(20)

    shadow_sessions = []
    try:
        from app.services.shadow_trading_service import list_shadow_sessions
        shadow_sessions = await list_shadow_sessions()
    except Exception:
        pass

    lock_status = await get_production_lock_status()

    return {
        "production": scored_production,
        "candidates": production_candidates,
        "shadow_trading": shadow_trading,
        "survivors": survivors,
        "paper_trading": paper_trading,
        "failed": failed,
        "retired": retired,
        "survivor_pool": survivor_pool,
        "shadow_sessions": shadow_sessions,
        "production_lock": lock_status,
        "weights": weights,
        "history": history,
        "summary": {
            "production_count": len(production),
            "candidate_count": len(production_candidates),
            "shadow_trading_count": len(shadow_trading),
            "survivor_count": len(survivors),
            "paper_trading_count": len(paper_trading),
            "failed_count": len(failed),
            "retired_count": len(retired),
            "pool_count": len(survivor_pool),
            "shadow_sessions_count": len(shadow_sessions),
        },
    }


async def get_survivor_score_history(strategy_id: int, limit: int = 30) -> list[dict]:
    rows = await execute_query(
        """SELECT id, evaluation_date, survivor_score, weighted_fitness, weighted_return,
                  weighted_profit_factor, weighted_drawdown, weighted_sharpe, weighted_stability,
                  win_rate, total_trades, cagr, mdd, recent_pnl_pct, consecutive_losses
           FROM survivor_score_snapshots
           WHERE strategy_id = :1
           ORDER BY evaluation_date DESC""",
        [strategy_id],
    )
    return [
        {"id": r[0],
         "evaluation_date": r[1].isoformat() if r[1] and hasattr(r[1], 'isoformat') else (str(r[1]) if r[1] else ""),
         "survivor_score": r[2] or 0,
         "breakdown": {"fitness": r[3] or 0, "return": r[4] or 0, "profit_factor": r[5] or 0,
                       "drawdown": r[6] or 0, "sharpe": r[7] or 0, "stability": r[8] or 0},
         "win_rate": r[9] or 0, "total_trades": r[10] or 0, "cagr": r[11] or 0,
         "mdd": r[12] or 0, "recent_pnl_pct": r[13] or 0, "consecutive_losses": r[14] or 0}
        for r in rows[:limit]
    ]


async def get_production_history(limit: int = 50) -> list[dict]:
    from app.services.strategy_lifecycle import get_production_history as _get_hist
    return await _get_hist(limit)
