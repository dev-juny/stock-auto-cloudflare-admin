from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.database import execute_query

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/strategies", tags=["strategies"])

SORTABLE_COLUMNS = {
    "fitness": "pf.fitness_score",
    "return": "pf.total_return",
    "win_rate": "pf.win_rate",
    "mdd": "pf.max_drawdown",
    "sharpe": "pf.profit_factor",
    "generation": "sp.generation",
}

FILTER_COLUMNS = {
    "approved": "ps.status = 'approved'",
    "candidate": "ps.status = 'candidate'",
    "disabled": "ps.status = 'disabled'",
}


@router.get("/top")
async def get_top_strategies(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sort_by: str = Query("fitness", pattern="^(fitness|return|win_rate|mdd|generation)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    min_fitness: float = Query(50.0),
    min_win_rate: float = Query(45.0),
    min_trades: int = Query(30),
    max_mdd: float = Query(20.0),
    min_return: float = Query(20.0),
):
    sort_col = SORTABLE_COLUMNS.get(sort_by, "pf.fitness_score")
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"

    count_sql = """
        SELECT COUNT(*)
        FROM strategy_pool sp
        JOIN strategy_performance pf ON pf.strategy_id = sp.id
          AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = sp.id)
        WHERE sp.is_alive = 'Y'
          AND pf.fitness_score >= :1
          AND pf.win_rate >= :2
          AND pf.total_trades >= :3
          AND (pf.max_drawdown IS NULL OR ABS(pf.max_drawdown) <= :4)
          AND pf.total_return >= :5
    """
    binds = [min_fitness, min_win_rate, min_trades, max_mdd, min_return]
    count_rows = await execute_query(count_sql, binds)
    total = count_rows[0][0] if count_rows else 0

    data_sql = f"""
        SELECT sp.id, sp.name, sp.generation, sp.version, sp.params_json,
               pf.total_return, pf.win_rate, pf.max_drawdown, pf.profit_factor,
               pf.total_trades, pf.fitness_score
        FROM strategy_pool sp
        JOIN strategy_performance pf ON pf.strategy_id = sp.id
          AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = sp.id)
        WHERE sp.is_alive = 'Y'
          AND pf.fitness_score >= :1
          AND pf.win_rate >= :2
          AND pf.total_trades >= :3
          AND (pf.max_drawdown IS NULL OR ABS(pf.max_drawdown) <= :4)
          AND pf.total_return >= :5
        ORDER BY {sort_col} {direction}
        OFFSET :6 ROWS FETCH NEXT :7 ROWS ONLY
    """
    data_binds = binds + [offset, limit]
    rows = await execute_query(data_sql, data_binds)

    items = []
    for r in rows:
        try:
            params = json.loads(r[4] or "{}")
        except Exception:
            params = {}
        entry_type = params.get("entry_type", params.get("entryType", ""))
        stop_loss = params.get("stop_loss_pct", params.get("stopLossPct", 0))
        take_profit = params.get("fixed_take_profit_pct", params.get("takeProfitPct", 0))
        trailing_stop = params.get("trailing_stop_pct", params.get("trailingStopPct", 0))
        max_concurrent = params.get("max_concurrent_positions", params.get("maxConcurrentPositions", 0))
        ranking_limit = params.get("ranking_candidate_limit", params.get("rankingCandidateLimit", 0))
        items.append({
            "strategy_id": r[0],
            "name": r[1] or "",
            "generation": r[2] or 1,
            "version": r[3] or 1,
            "fitness": float(r[10] or 0),
            "return_pct": float(r[5] or 0),
            "win_rate": float(r[6] or 0),
            "mdd": float(abs(r[7] or 0)),
            "profit_factor": float(r[8] or 0),
            "total_trades": int(r[9] or 0),
            "entry_type": entry_type,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "trailing_stop": trailing_stop,
            "max_concurrent_positions": max_concurrent,
            "ranking_candidate_limit": ranking_limit,
        })
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.get("/list")
async def list_strategies_ranked(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sort_by: str = Query("fitness", pattern="^(fitness|return|win_rate|mdd|sharpe|generation)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    status: str = Query("", pattern="^(approved|candidate|disabled|)$"),
):
    sort_col = SORTABLE_COLUMNS.get(sort_by, "pf.fitness_score")
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    where_extra = ""
    binds = [status] if status else []

    if status:
        where_extra = "AND ps.status = :1"

    data_sql = f"""
        SELECT ps.id, ps.strategy_id, sp.name, sp.generation, pf.total_return, pf.win_rate,
               pf.max_drawdown, pf.fitness_score, pf.total_trades, pf.profit_factor,
               sp.last_test_at, ps.status
        FROM portfolio_strategy ps
        JOIN strategy_pool sp ON sp.id = ps.strategy_id
        LEFT JOIN strategy_performance pf ON pf.strategy_id = ps.strategy_id
          AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = ps.strategy_id)
        WHERE 1=1 {where_extra}
        ORDER BY {sort_col} {direction}
        OFFSET :{(len(binds) + 1) if binds else 1} ROWS FETCH NEXT :{(len(binds) + 2) if binds else 2} ROWS ONLY
    """
    data_binds = binds + [offset, limit] if binds else [offset, limit]
    rows = await execute_query(data_sql, data_binds)
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "strategy_id": r[1],
            "name": r[2] or "",
            "generation": r[3] or 0,
            "return_pct": float(r[4] or 0),
            "win_rate": float(r[5] or 0),
            "mdd": float(abs(r[6] or 0)),
            "fitness": float(r[7] or 0),
            "total_trades": int(r[8] or 0),
            "profit_factor": float(r[9] or 0),
            "last_evaluated": str(r[10]) if len(r) > 10 and r[10] else "",
            "status": r[11] if len(r) > 11 else "",
        })
    return {"items": items, "count": len(items), "offset": offset, "limit": limit}


@router.get("/top/{strategy_id}")
async def get_top_strategy_detail(strategy_id: int):
    rows = await execute_query(
        """SELECT sp.id, sp.name, sp.generation, sp.version, sp.params_json,
                  pf.total_return, pf.win_rate, pf.max_drawdown, pf.profit_factor,
                  pf.total_trades, pf.fitness_score
           FROM strategy_pool sp
           INNER JOIN strategy_performance pf ON pf.strategy_id = sp.id
             AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = sp.id)
           WHERE sp.id = :1""",
        [strategy_id],
    )
    if not rows:
        raise HTTPException(404, "Strategy not found")
    r = rows[0]
    try:
        params = json.loads(r[4] or "{}")
    except Exception:
        params = {}

    # Get universe stocks for this strategy's generation
    universe = await execute_query(
        """SELECT ticker, name, market
           FROM evolution_evaluation_universe
           WHERE generation = :1
           ORDER BY sample_order ASC, ticker ASC""",
        [r[2]],
    )

    return {
        "strategy_id": r[0],
        "name": r[1] or "",
        "generation": r[2] or 1,
        "version": r[3] or 1,
        "fitness": float(r[10] or 0),
        "return_pct": float(r[5] or 0),
        "win_rate": float(r[6] or 0),
        "mdd": float(abs(r[7] or 0)),
        "profit_factor": float(r[8] or 0),
        "total_trades": int(r[9] or 0),
        "entry_type": params.get("entry_type", params.get("entryType", "")),
        "stop_loss": params.get("stop_loss_pct", params.get("stopLossPct", 0)),
        "take_profit": params.get("fixed_take_profit_pct", params.get("takeProfitPct", 0)),
        "trailing_stop": params.get("trailing_stop_pct", params.get("trailingStopPct", 0)),
        "max_concurrent_positions": params.get("max_concurrent_positions", params.get("maxConcurrentPositions", 0)),
        "ranking_candidate_limit": params.get("ranking_candidate_limit", params.get("rankingCandidateLimit", 0)),
        "universe_stocks": [
            {"ticker": u[0], "name": u[1] or u[0], "market": u[2] or ""}
            for u in universe
        ],
    }
