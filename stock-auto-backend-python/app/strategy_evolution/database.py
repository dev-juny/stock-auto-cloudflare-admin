from __future__ import annotations

import json
import random
from datetime import datetime
from typing import Optional

from app.database import execute_query, execute_non_query, acquire_conn
from .models import EvolutionStrategy, FitnessScore, GenerationSummary, EvolutionStatus
from app.utils.timezone import to_kst


async def ensure_evolution_tables():
    ddl = [
        """
        CREATE TABLE IF NOT EXISTS strategy_pool (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            name VARCHAR2(200),
            generation NUMBER(5) DEFAULT 1,
            version NUMBER(5) DEFAULT 1,
            parent_id NUMBER,
            params_json CLOB,
            indicators_json CLOB,
            is_alive CHAR(1) DEFAULT 'Y',
            is_elite CHAR(1) DEFAULT 'N',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_test_at TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS strategy_performance (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            strategy_id NUMBER NOT NULL,
            generation NUMBER(5) DEFAULT 1,
            total_return NUMBER(10,4) DEFAULT 0,
            win_rate NUMBER(5,2) DEFAULT 0,
            max_drawdown NUMBER(10,4) DEFAULT 0,
            profit_factor NUMBER(10,4) DEFAULT 0,
            total_trades NUMBER(8) DEFAULT 0,
            fitness_score NUMBER(10,4) DEFAULT 0,
            calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS strategy_generation (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            generation NUMBER(5) NOT NULL,
            population_size NUMBER(5) DEFAULT 0,
            elite_count NUMBER(5) DEFAULT 0,
            avg_fitness NUMBER(10,4) DEFAULT 0,
            best_fitness NUMBER(10,4) DEFAULT 0,
            avg_return NUMBER(10,4) DEFAULT 0,
            avg_winrate NUMBER(5,2) DEFAULT 0,
            avg_mdd NUMBER(10,4) DEFAULT 0,
            mutation_count NUMBER(5) DEFAULT 0,
            crossover_count NUMBER(5) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS strategy_history (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            strategy_id NUMBER NOT NULL,
            action VARCHAR2(20) NOT NULL,
            parent_id NUMBER,
            details_json CLOB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS strategy_fitness_log (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            strategy_id NUMBER NOT NULL,
            generation NUMBER(5) NOT NULL,
            fitness_components_json CLOB,
            fitness_score NUMBER(10,4) DEFAULT 0,
            calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS evolution_evaluation_universe (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            generation NUMBER(5) NOT NULL,
            ticker VARCHAR2(12) NOT NULL,
            name VARCHAR2(200),
            market VARCHAR2(20),
            sample_order NUMBER(5) DEFAULT 0,
            selection_source VARCHAR2(50) DEFAULT 'random_sample',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_evo_universe_gen ON evolution_evaluation_universe(generation)
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_perf_strategy_gen ON strategy_performance(strategy_id, generation DESC)
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_pool_alive_gen ON strategy_pool(is_alive, generation DESC, id DESC)
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_gen_generation ON strategy_generation(generation DESC)
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_perf_strategy_id ON strategy_performance(strategy_id)
        """,
        """
        CREATE TABLE IF NOT EXISTS evolution_status (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            is_running CHAR(1) DEFAULT 'N',
            current_generation NUMBER(5) DEFAULT 0,
            total_generations NUMBER(5) DEFAULT 0,
            status VARCHAR2(100) DEFAULT 'idle',
            current_operation VARCHAR2(50) DEFAULT '',
            progress_pct NUMBER(5,2) DEFAULT 0,
            last_run_at TIMESTAMP,
            next_scheduled_run TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
    ]
    conn = await acquire_conn()
    try:
        for d in ddl:
            conn.cursor().execute(d)
        conn.commit()
    finally:
        conn.close()


async def save_strategy(s: EvolutionStrategy) -> int:
    if s.id > 0:
        await execute_non_query(
            """UPDATE strategy_pool SET name=:1, generation=:2, version=:3, parent_id=:4,
               params_json=:5, indicators_json=:6, is_alive=:7, is_elite=:8, last_test_at=CURRENT_TIMESTAMP
               WHERE id=:9""",
            [s.name, s.generation, s.version, s.parent_id,
             s.params.model_dump_json(), s.indicators.model_dump_json(),
             'Y' if s.is_alive else 'N', 'Y' if s.is_elite else 'N', s.id]
        )
        return s.id
    from app.database import acquire_conn
    conn = await acquire_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO strategy_pool (name, generation, version, parent_id, params_json, indicators_json, is_alive, is_elite)
               VALUES (:1,:2,:3,:4,:5,:6,:7,:8)""",
            [s.name, s.generation, s.version, s.parent_id,
             s.params.model_dump_json(), s.indicators.model_dump_json(),
             'Y' if s.is_alive else 'N', 'Y' if s.is_elite else 'N']
        )
        conn.commit()
        cur.execute("SELECT MAX(id) FROM strategy_pool WHERE name=:1 AND generation=:2", [s.name, s.generation])
        r = cur.fetchone()
        return r[0] if r else 0
    finally:
        conn.close()


async def get_strategies(generation: Optional[int] = None, alive_only: bool = True) -> list[EvolutionStrategy]:
    sql = """SELECT sp.id, sp.name, sp.generation, sp.version, sp.parent_id, sp.params_json,
                    sp.indicators_json, sp.is_alive, sp.is_elite, sp.created_at, sp.last_test_at,
                    pf.total_return, pf.win_rate, pf.max_drawdown, pf.profit_factor, pf.total_trades, pf.fitness_score
             FROM strategy_pool sp
             LEFT JOIN (
                 SELECT strategy_id, total_return, win_rate, max_drawdown, profit_factor, total_trades, fitness_score,
                        ROW_NUMBER() OVER (PARTITION BY strategy_id ORDER BY generation DESC) rn
                 FROM strategy_performance
             ) pf ON pf.strategy_id = sp.id AND pf.rn = 1
             WHERE 1=1"""
    binds = []
    if alive_only:
        sql += " AND sp.is_alive='Y'"
    if generation is not None:
        sql += " AND sp.generation=:1"
        binds.append(generation)
    sql += " ORDER BY sp.generation DESC, sp.id DESC"
    rows = await execute_query(sql, binds if binds else None)
    return [_row_to_strategy(r) for r in rows]


SORTABLE_COLUMNS_EVO = {
    "id": "sp.id",
    "name": "sp.name",
    "generation": "sp.generation",
    "fitness_score": "pf.fitness_score",
    "total_return": "pf.total_return",
    "win_rate": "pf.win_rate",
    "max_drawdown": "pf.max_drawdown",
    "total_trades": "pf.total_trades",
}


async def get_strategies_paginated(
    offset: int = 0,
    limit: int = 50,
    sort_by: str = "fitness_score",
    sort_dir: str = "desc",
    search: str = "",
    generation: Optional[int] = None,
) -> dict:
    sort_col = SORTABLE_COLUMNS_EVO.get(sort_by, "pf.fitness_score")
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"

    where_clauses = ["sp.is_alive='Y'"]
    binds = []

    if search:
        where_clauses.append("(LOWER(sp.name) LIKE :search OR LOWER(sp.params_json) LIKE :search2)")
        binds.append(f"%{search.lower()}%")
        binds.append(f"%{search.lower()}%")

    if generation is not None:
        where_clauses.append("sp.generation=:gen")
        binds.append(generation)

    where_sql = " AND ".join(where_clauses)

    count_sql = f"""SELECT COUNT(*) FROM strategy_pool sp
                   LEFT JOIN (
                       SELECT strategy_id, total_return, win_rate, max_drawdown, profit_factor, total_trades, fitness_score,
                              ROW_NUMBER() OVER (PARTITION BY strategy_id ORDER BY generation DESC) rn
                       FROM strategy_performance
                   ) pf ON pf.strategy_id = sp.id AND pf.rn = 1
                   WHERE {where_sql}"""
    count_rows = await execute_query(count_sql, binds if binds else None)
    total = count_rows[0][0] if count_rows else 0

    data_sql = f"""SELECT sp.id, sp.name, sp.generation, sp.version, sp.parent_id, sp.params_json,
                          sp.indicators_json, sp.is_alive, sp.is_elite, sp.created_at, sp.last_test_at,
                          pf.total_return, pf.win_rate, pf.max_drawdown, pf.profit_factor, pf.total_trades, pf.fitness_score
                   FROM strategy_pool sp
                   LEFT JOIN (
                       SELECT strategy_id, total_return, win_rate, max_drawdown, profit_factor, total_trades, fitness_score,
                              ROW_NUMBER() OVER (PARTITION BY strategy_id ORDER BY generation DESC) rn
                       FROM strategy_performance
                   ) pf ON pf.strategy_id = sp.id AND pf.rn = 1
                   WHERE {where_sql}
                   ORDER BY {sort_col} {direction}
                   OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY"""
    data_binds = (binds if binds else []) + [offset, limit]
    rows = await execute_query(data_sql, data_binds)

    items = []
    for r in rows:
        try:
            import json
            params = json.loads(r[5] or '{}')
        except:
            params = {}
        items.append({
            "id": r[0],
            "name": r[1] or '',
            "generation": r[2] or 1,
            "version": r[3] or 1,
            "parent_id": r[4],
            "entry_type": params.get("entry_type", ""),
            "is_alive": r[7] == 'Y',
            "is_elite": r[8] == 'Y',
            "total_return": r[11] or 0,
            "win_rate": r[12] or 0,
            "max_drawdown": r[13] or 0,
            "profit_factor": r[14] or 0,
            "total_trades": r[15] or 0,
            "fitness_score": r[16] or 0,
        })
    return {"items": items, "total": total, "offset": offset, "limit": limit}


async def get_strategy_by_id(strategy_id: int) -> Optional[EvolutionStrategy]:
    rows = await execute_query(
        """SELECT sp.id, sp.name, sp.generation, sp.version, sp.parent_id, sp.params_json,
                  sp.indicators_json, sp.is_alive, sp.is_elite, sp.created_at, sp.last_test_at,
                  pf.total_return, pf.win_rate, pf.max_drawdown, pf.profit_factor, pf.total_trades, pf.fitness_score
           FROM strategy_pool sp
           LEFT JOIN (
               SELECT strategy_id, total_return, win_rate, max_drawdown, profit_factor, total_trades, fitness_score,
                      ROW_NUMBER() OVER (PARTITION BY strategy_id ORDER BY generation DESC) rn
               FROM strategy_performance
           ) pf ON pf.strategy_id = sp.id AND pf.rn = 1
           WHERE sp.id=:1""",
        [strategy_id]
    )
    return _row_to_strategy(rows[0]) if rows else None


def _row_to_strategy(r: tuple) -> EvolutionStrategy:
    import json
    params = json.loads(r[5] or '{}')
    indicators = json.loads(r[6] or '{}')
    from .models import StrategyParams, StrategyIndicators, EvolutionStrategy
    has_perf = len(r) > 11 and r[11] is not None
    return EvolutionStrategy(
        id=r[0], name=r[1] or '', generation=r[2] or 1, version=r[3] or 1,
        parent_id=r[4],
        params=StrategyParams(**params),
        indicators=StrategyIndicators(**indicators),
        is_alive=r[7] == 'Y', is_elite=r[8] == 'Y',
        created_at=r[9].isoformat() if r[9] and hasattr(r[9], 'isoformat') else (str(r[9]) if r[9] else ''),
        last_test_at=r[10].isoformat() if r[10] and hasattr(r[10], 'isoformat') else (str(r[10]) if r[10] else None),
        total_return=r[11] or 0 if has_perf else 0,
        win_rate=r[12] or 0 if has_perf else 0,
        max_drawdown=r[13] or 0 if has_perf else 0,
        profit_factor=r[14] or 0 if has_perf else 0,
        total_trades=r[15] or 0 if has_perf else 0,
        fitness_score=r[16] or 0 if has_perf else 0,
    )


async def save_performance(fs: FitnessScore):
    await execute_non_query(
        """INSERT INTO strategy_performance (strategy_id, generation, total_return, win_rate, max_drawdown, profit_factor, total_trades, fitness_score)
           VALUES (:1,:2,:3,:4,:5,:6,:7,:8)""",
        [fs.strategy_id, fs.generation, fs.total_return, fs.win_rate, fs.max_drawdown,
         fs.profit_factor, fs.total_trades, fs.fitness]
    )


async def get_generation_universe(generation: int) -> list[dict]:
    rows = await execute_query(
        """SELECT ticker, name, market, sample_order, selection_source
           FROM evolution_evaluation_universe
           WHERE generation=:1
           ORDER BY sample_order ASC, ticker ASC""",
        [generation]
    )
    return [
        {
            "ticker": r[0],
            "name": r[1] or r[0],
            "market": r[2] or "",
            "sample_order": int(r[3] or 0),
            "selection_source": r[4] or "random_sample",
        }
        for r in rows
    ]


async def save_generation_universe(generation: int, universe: list[dict]):
    await execute_non_query(
        "DELETE FROM evolution_evaluation_universe WHERE generation=:1",
        [generation],
    )
    for idx, ticker in enumerate(universe, start=1):
        await execute_non_query(
            """INSERT INTO evolution_evaluation_universe
               (generation, ticker, name, market, sample_order, selection_source)
               VALUES (:1,:2,:3,:4,:5,:6)""",
            [
                generation,
                ticker.get("ticker", ""),
                ticker.get("name", ""),
                ticker.get("market", ""),
                idx,
                ticker.get("selection_source", "random_sample"),
            ],
        )


async def get_or_create_generation_universe(generation: int, sample_size: int = 50) -> list[dict]:
    existing = await get_generation_universe(generation)
    if existing:
        return existing

    from app.services.data_provider import get_all_tickers

    tickers = await get_all_tickers()
    random.shuffle(tickers)
    sample = []
    for idx, ticker in enumerate(tickers[:sample_size], start=1):
        sample.append({
            "ticker": ticker.get("ticker", ""),
            "name": ticker.get("name", ticker.get("ticker", "")),
            "market": ticker.get("market", ""),
            "sample_order": idx,
            "selection_source": "random_sample",
        })

    await save_generation_universe(generation, sample)
    return sample


async def get_performance(strategy_id: int, limit: int = 20) -> list[FitnessScore]:
    rows = await execute_query(
        """SELECT strategy_id, generation, total_return, win_rate, max_drawdown, profit_factor, total_trades, fitness_score, calculated_at
           FROM strategy_performance WHERE strategy_id=:1 ORDER BY generation DESC""",
        [strategy_id]
    )
    result = []
    for r in rows:
        calc_dt = r[8]
        calc_str = calc_dt.isoformat() if hasattr(calc_dt, 'isoformat') else (str(calc_dt) if calc_dt else '')
        result.append(FitnessScore(
            strategy_id=r[0], generation=r[1], total_return=r[2] or 0, win_rate=r[3] or 0,
            max_drawdown=r[4] or 0, profit_factor=r[5] or 0, total_trades=r[6] or 0,
            fitness=r[7] or 0, calculated_at=calc_str
        ))
    return result


async def save_generation(gs: GenerationSummary):
    from datetime import datetime
    created_at = datetime.utcnow()
    await execute_non_query(
        """INSERT INTO strategy_generation (generation, population_size, elite_count, avg_fitness, best_fitness, avg_return, avg_winrate, avg_mdd, mutation_count, crossover_count, created_at)
           VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11)""",
        [gs.generation, gs.population_size, gs.elite_count, gs.avg_fitness, gs.best_fitness,
         gs.avg_return, gs.avg_winrate, gs.avg_mdd, gs.mutation_count, gs.crossover_count,
         created_at]
    )


async def get_generations(limit: int = 20) -> list[GenerationSummary]:
    rows = await execute_query(
        """SELECT generation, population_size, elite_count, avg_fitness, best_fitness, avg_return, avg_winrate, avg_mdd, created_at, mutation_count, crossover_count
           FROM strategy_generation ORDER BY generation DESC""",
        None
    )
    result = []
    for r in rows:
        created_at_dt = r[8]
        created_at_str = created_at_dt.isoformat() if hasattr(created_at_dt, 'isoformat') else (str(created_at_dt) if created_at_dt else '')
        result.append(GenerationSummary(
            generation=r[0], population_size=r[1] or 0, elite_count=r[2] or 0,
            avg_fitness=r[3] or 0, best_fitness=r[4] or 0, avg_return=r[5] or 0,
            avg_winrate=r[6] or 0, avg_mdd=r[7] or 0,
            created_at=created_at_str,
            created_at_kst=to_kst(created_at_dt),
            mutation_count=r[9] or 0, crossover_count=r[10] or 0
        ))
    if limit > 0:
        result = result[:limit]
    return result


async def get_generation_strategies(generation: int) -> list[EvolutionStrategy]:
    from .models import StrategyParams, StrategyIndicators
    rows = await execute_query(
        """SELECT sp.id, sp.name, sp.generation, sp.version, sp.parent_id,
                  sp.params_json, sp.indicators_json, sp.is_alive, sp.is_elite,
                  sp.created_at, sp.last_test_at,
                  pf.total_return, pf.win_rate, pf.max_drawdown,
                  pf.profit_factor, pf.total_trades, pf.fitness_score
           FROM strategy_pool sp
           LEFT JOIN (
               SELECT strategy_id, total_return, win_rate, max_drawdown,
                      profit_factor, total_trades, fitness_score,
                      ROW_NUMBER() OVER (PARTITION BY strategy_id ORDER BY generation DESC) rn
               FROM strategy_performance
           ) pf ON pf.strategy_id = sp.id AND pf.rn = 1
           WHERE sp.generation=:1
           ORDER BY pf.fitness_score DESC NULLS LAST""",
        [generation]
    )
    return [_row_to_strategy(r) for r in rows]


async def compare_generations(gen_a: int, gen_b: int) -> dict:
    strategies_a = await get_generation_strategies(gen_a)
    strategies_b = await get_generation_strategies(gen_b)
    ids_a = {s.id for s in strategies_a}
    a_by_parent = {s.parent_id: s for s in strategies_a if s.parent_id}

    new_entries = [s for s in strategies_b if s.parent_id and s.parent_id not in ids_a]
    removed = [s for s in strategies_a if s.id not in {s2.parent_id for s2 in strategies_b if s2.parent_id}]
    changed = []
    for sb in strategies_b:
        if sb.parent_id and sb.parent_id in ids_a:
            sa = a_by_parent.get(sb.parent_id)
            if sa:
                changed.append({
                    "strategy_id": sb.id,
                    "name": sb.name,
                    "return_change": round(sb.total_return - sa.total_return, 4),
                    "winrate_change": round(sb.win_rate - sa.win_rate, 2),
                    "fitness_change": round(sb.fitness_score - sa.fitness_score, 4),
                })

    def _summarize(ss: list[EvolutionStrategy]) -> dict:
        tested = [s for s in ss if s.total_trades > 0]
        return {
            "count": len(ss),
            "avg_return": round(sum(s.total_return for s in tested) / len(tested), 4) if tested else 0,
            "avg_winrate": round(sum(s.win_rate for s in tested) / len(tested), 2) if tested else 0,
            "avg_fitness": round(sum(s.fitness_score for s in tested) / len(tested), 4) if tested else 0,
            "avg_mdd": round(sum(abs(s.max_drawdown) for s in tested) / len(tested), 4) if tested else 0,
        }

    universe_a = await get_generation_universe(gen_a)
    universe_b = await get_generation_universe(gen_b)
    codes_a = {u["ticker"] for u in universe_a}
    codes_b = {u["ticker"] for u in universe_b}
    by_a = {u["ticker"]: u for u in universe_a}
    by_b = {u["ticker"]: u for u in universe_b}

    universe_added = [
        {
            "ticker": code,
            "name": by_b[code].get("name", code),
            "market": by_b[code].get("market", ""),
        }
        for code in sorted(codes_b - codes_a)
    ]
    universe_removed = [
        {
            "ticker": code,
            "name": by_a[code].get("name", code),
            "market": by_a[code].get("market", ""),
        }
        for code in sorted(codes_a - codes_b)
    ]

    return {
        "gen_a": {"generation": gen_a, **_summarize(strategies_a)},
        "gen_b": {"generation": gen_b, **_summarize(strategies_b)},
        "new_entries": len(new_entries),
        "removed": len(removed),
        "changed": changed,
        "universe": {
            "gen_a_count": len(universe_a),
            "gen_b_count": len(universe_b),
            "common_count": len(codes_a & codes_b),
            "added": universe_added,
            "removed": universe_removed,
        },
    }


async def count_active_strategies() -> int:
    rows = await execute_query(
        "SELECT COUNT(*) FROM strategy_pool WHERE is_alive='Y'",
        None
    )
    return rows[0][0] if rows else 0


async def get_evolution_status() -> EvolutionStatus:
    rows = await execute_query(
        "SELECT is_running, current_generation, total_generations, status, current_operation, progress_pct, last_run_at, next_scheduled_run FROM evolution_status ORDER BY updated_at DESC",
        None
    )
    if rows:
        r = rows[0]
        def _to_iso(val):
            if val is None:
                return None
            return val.isoformat() if hasattr(val, 'isoformat') else str(val)
        last_run = _to_iso(r[6])
        next_run = _to_iso(r[7])
        return EvolutionStatus(
            is_running=r[0] == 'Y', current_generation=r[1] or 0, total_generations=r[2] or 0,
            status=r[3] or 'idle', current_operation=r[4] or '', progress_pct=r[5] or 0,
            last_run_at=last_run, last_run_at_kst=to_kst(r[6]),
            next_scheduled_run=next_run, next_scheduled_run_kst=to_kst(r[7]),
            active_strategies=await count_active_strategies()
        )
    return EvolutionStatus()


async def update_evolution_status(st: EvolutionStatus):
    await execute_non_query(
        "DELETE FROM evolution_status",
        None
    )
    from datetime import datetime
    def _ts(val):
        if val is None:
            return None
        return datetime.fromisoformat(val.replace('Z', '+00:00'))
    await execute_non_query(
        """INSERT INTO evolution_status (is_running, current_generation, total_generations, status, current_operation, progress_pct, last_run_at, next_scheduled_run)
           VALUES (:1,:2,:3,:4,:5,:6,:7,:8)""",
        ['Y' if st.is_running else 'N', st.current_generation, st.total_generations,
         st.status, st.current_operation, st.progress_pct,
         _ts(st.last_run_at), _ts(st.next_scheduled_run)]
    )





async def log_history(strategy_id: int, action: str, parent_id: Optional[int] = None, details: Optional[dict] = None):
    await execute_non_query(
        "INSERT INTO strategy_history (strategy_id, action, parent_id, details_json) VALUES (:1,:2,:3,:4)",
        [strategy_id, action, parent_id, json.dumps(details) if details else None]
    )


async def get_history(strategy_id: int, limit: int = 20) -> list[dict]:
    rows = await execute_query(
        "SELECT action, parent_id, details_json, created_at FROM strategy_history WHERE strategy_id=:1 ORDER BY created_at DESC",
        [strategy_id]
    )
    result = []
    for r in rows:
        created_dt = r[3]
        created_str = created_dt.isoformat() if hasattr(created_dt, 'isoformat') else (str(created_dt) if created_dt else '')
        result.append({
            "action": r[0], "parent_id": r[1],
            "details": json.loads(r[2]) if r[2] else None,
            "created_at": created_str,
            "created_at_kst": to_kst(created_dt),
        })
    return result
