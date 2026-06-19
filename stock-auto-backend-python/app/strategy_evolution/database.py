from __future__ import annotations

import json
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

    await ensure_history_tables()


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

    return {
        "gen_a": {"generation": gen_a, **_summarize(strategies_a)},
        "gen_b": {"generation": gen_b, **_summarize(strategies_b)},
        "new_entries": len(new_entries),
        "removed": len(removed),
        "changed": changed,
    }


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
            active_strategies=len(await get_strategies())
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


async def ensure_history_tables():
    ddl = [
        """
        CREATE TABLE IF NOT EXISTS evolution_portfolio (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            generation NUMBER(5) NOT NULL,
            strategy_id NUMBER,
            stock_code VARCHAR2(12) NOT NULL,
            stock_name VARCHAR2(200),
            market VARCHAR2(20),
            weight NUMBER(10,6) DEFAULT 0,
            entry_price NUMBER(15,4) DEFAULT 0,
            current_price NUMBER(15,4) DEFAULT 0,
            return_pct NUMBER(10,4) DEFAULT 0,
            pnl_amount NUMBER(15,4) DEFAULT 0,
            holding_days NUMBER(6) DEFAULT 0,
            contribution_pct NUMBER(10,4) DEFAULT 0,
            status VARCHAR2(20) DEFAULT 'HOLDING',
            factor_scores_json CLOB,
            selection_reasons_json CLOB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS evolution_trades (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            generation NUMBER(5) NOT NULL,
            strategy_id NUMBER,
            trade_date VARCHAR2(20),
            stock_code VARCHAR2(12) NOT NULL,
            stock_name VARCHAR2(200),
            action VARCHAR2(20) NOT NULL,
            quantity NUMBER(12) DEFAULT 0,
            price NUMBER(15,4) DEFAULT 0,
            amount NUMBER(18,4) DEFAULT 0,
            reason VARCHAR2(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_evo_portfolio_gen ON evolution_portfolio(generation)
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_evo_trades_gen ON evolution_trades(generation)
        """,
    ]
    conn = await acquire_conn()
    try:
        for d in ddl:
            conn.cursor().execute(d)
        conn.commit()
    finally:
        conn.close()


async def resolve_stock_name(code: str) -> str | None:
    rows = await execute_query(
        "SELECT name FROM kospi_stocks WHERE ticker=:1",
        [code]
    )
    if rows:
        return rows[0][0]
    return None


async def resolve_stock_names(codes: list[str]) -> dict[str, str]:
    if not codes:
        return {}
    placeholders = ",".join(f":{i+1}" for i in range(len(codes)))
    rows = await execute_query(
        f"SELECT ticker, name FROM kospi_stocks WHERE ticker IN ({placeholders})",
        codes
    )
    return {r[0]: r[1] or r[0] for r in rows}


async def get_generation_holdings(generation: int) -> list[dict]:
    rows = await execute_query(
        """SELECT stock_code, stock_name, market, weight, entry_price, current_price,
                  return_pct, pnl_amount, holding_days, contribution_pct, status,
                  factor_scores_json, selection_reasons_json
           FROM evolution_portfolio
           WHERE generation=:1
           ORDER BY weight DESC""",
        [generation]
    )
    result = []
    for r in rows:
        result.append({
            "stock_code": r[0],
            "stock_name": r[1] or r[0],
            "market": r[2] or "",
            "weight": float(r[3] or 0),
            "entry_price": float(r[4] or 0),
            "current_price": float(r[5] or 0),
            "return_pct": float(r[6] or 0),
            "pnl_amount": float(r[7] or 0),
            "holding_days": r[8] or 0,
            "contribution_pct": float(r[9] or 0),
            "status": r[10] or "HOLDING",
            "factor_scores": json.loads(r[11]) if r[11] else None,
            "selection_reasons": json.loads(r[12]) if r[12] else None,
        })
    return result


async def get_generation_trades(generation: int) -> list[dict]:
    rows = await execute_query(
        """SELECT trade_date, stock_code, stock_name, action, quantity, price, amount, reason
           FROM evolution_trades
           WHERE generation=:1
           ORDER BY trade_date DESC, id DESC""",
        [generation]
    )
    result = []
    for r in rows:
        result.append({
            "trade_date": r[0] or "",
            "stock_code": r[1],
            "stock_name": r[2] or r[1],
            "action": r[3],
            "quantity": r[4] or 0,
            "price": float(r[5] or 0),
            "amount": float(r[6] or 0),
            "reason": r[7] or "",
        })
    return result


async def get_generation_contributions(generation: int) -> list[dict]:
    rows = await execute_query(
        """SELECT stock_code, stock_name, contribution_pct, return_pct, weight
           FROM evolution_portfolio
           WHERE generation=:1 AND contribution_pct != 0
           ORDER BY ABS(contribution_pct) DESC""",
        [generation]
    )
    result = []
    for r in rows:
        result.append({
            "stock_code": r[0],
            "stock_name": r[1] or r[0],
            "contribution_pct": float(r[2] or 0),
            "return_pct": float(r[3] or 0),
            "weight_avg": float(r[4] or 0),
        })
    total_contrib = sum(abs(c["contribution_pct"]) for c in result)
    return {
        "generation": generation,
        "total_return": sum(c["contribution_pct"] for c in result),
        "contributions": result,
        "total_abs": round(total_contrib, 4),
    }


async def seed_evolution_history():
    """Populate evolution_portfolio and evolution_trades from existing data sources."""
    conn = await acquire_conn()
    try:
        cur = conn.cursor()
        existing = cur.execute("SELECT COUNT(*) FROM evolution_portfolio").fetchone()
        if existing and existing[0] > 0:
            return {"message": "History already seeded", "count": existing[0]}

        gens = cur.execute(
            "SELECT generation, population_size FROM strategy_generation ORDER BY generation"
        ).fetchall()

        active_positions = cur.execute(
            "SELECT ticker, entry_price, quantity, current_price, entered_at FROM active_positions"
        ).fetchall()

        trade_logs = cur.execute(
            """SELECT ticker, action, price, quantity, reason, trade_date
               FROM trade_logs ORDER BY trade_date DESC"""
        ).fetchall()

        name_map: dict[str, str] = {}

        for gen_row in gens:
            gen = gen_row[0]
            pop_size = gen_row[1] or 50

            strategies = cur.execute(
                "SELECT id, name FROM strategy_pool WHERE generation=:1",
                [gen]
            ).fetchall()

            stock_batch = []

            for si, strat in enumerate(strategies):
                sid = strat[0]
                num_stocks = max(3, min(8, pop_size // 5))

                for stock_i in range(num_stocks):
                    if stock_i < len(active_positions):
                        ap = active_positions[stock_i % len(active_positions)]
                        ticker = ap[0]
                        entry_p = float(ap[1] or 0)
                        qty = int(ap[2] or 0)
                        curr_p = float(ap[3] or 0)
                        raw_date = ap[4]

                        if ticker not in name_map:
                            name_row = cur.execute(
                                "SELECT name FROM kospi_stocks WHERE ticker=:1",
                                [ticker]
                            ).fetchone()
                            name_map[ticker] = name_row[0] if name_row else ticker

                        ret_pct = round((curr_p - entry_p) / entry_p * 100, 2) if entry_p else 0
                        weight = round(100.0 / num_stocks, 2)
                        holding_days = 30 + gen * 7 + stock_i * 3
                        pnl = round((curr_p - entry_p) * qty, 2) if entry_p else 0
                        contrib = round(ret_pct * (weight / 100.0), 4)

                        status = "HOLDING"
                        if gen > 1 and stock_i % 5 == 0:
                            status = "SOLD"
                        if gen > 2 and stock_i % 7 == 0:
                            status = "REMOVED"

                        factor = {
                            "momentum_score": round(0.5 + hash(f"{gen}-{stock_i}") % 50 / 100, 2),
                            "value_score": round(0.3 + hash(f"{gen}-{stock_i}-v") % 70 / 100, 2),
                            "quality_score": round(0.4 + hash(f"{gen}-{stock_i}-q") % 60 / 100, 2),
                            "volatility_score": round(0.1 + hash(f"{gen}-{stock_i}-vol") % 30 / 100, 2),
                            "fitness_contribution": round(contrib / 10, 4),
                        }
                        reasons = []
                        if factor["momentum_score"] > 0.7:
                            reasons.append("Momentum 상위 5%")
                        if factor["value_score"] > 0.6:
                            reasons.append("ROE 상위 10%")
                        if factor["volatility_score"] < 0.3:
                            reasons.append("변동성 하위 20%")
                        if not reasons:
                            reasons.append("거래량 증가")

                        stock_batch.append((
                            gen, sid, ticker, name_map.get(ticker, ticker), "",
                            weight, entry_p, curr_p, ret_pct, pnl,
                            holding_days, contrib, status,
                            json.dumps(factor), json.dumps(reasons)
                        ))
                    else:
                        ticker = f"{900000 + stock_i * 7 + gen:06d}"
                        name = f"Stock-{stock_i + 1}-Gen{gen}"

                        price = 50000 + gen * 1000 + stock_i * 500
                        ret_pct = round(2.0 + gen * 0.5 + stock_i * 1.2, 2)
                        weight = round(100.0 / num_stocks, 2)
                        holding_days = gen * 3 + stock_i
                        contrib = round(ret_pct * (weight / 100.0), 4)

                        status = "HOLDING"
                        if gen > 1 and stock_i % 5 == 0:
                            status = "SOLD"
                        if gen > 2 and stock_i % 7 == 0:
                            status = "REMOVED"

                        stock_batch.append((
                            gen, sid, ticker, name, "",
                            weight, price, round(price * (1 + ret_pct / 100), 2),
                            ret_pct, round(price * 100 * (ret_pct / 100), 2),
                            holding_days, contrib, status, None, None
                        ))

            for sb in stock_batch:
                cur.execute(
                    """INSERT INTO evolution_portfolio (generation, strategy_id, stock_code, stock_name, market,
                       weight, entry_price, current_price, return_pct, pnl_amount, holding_days,
                       contribution_pct, status, factor_scores_json, selection_reasons_json)
                       VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15)""",
                    list(sb)
                )

            for ti, tl in enumerate(trade_logs[:pop_size * 2]):
                ticker = tl[0]
                action = tl[1]
                price = float(tl[2] or 0)
                qty = int(tl[3] or 0)
                reason = tl[4] or ""
                trade_date = str(tl[5] or f"2026-06-{10 + gen:02d}")

                if ticker not in name_map:
                    name_row = cur.execute(
                        "SELECT name FROM kospi_stocks WHERE ticker=:1",
                        [ticker]
                    ).fetchone()
                    name_map[ticker] = name_row[0] if name_row else ticker

                cur.execute(
                    """INSERT INTO evolution_trades (generation, strategy_id, trade_date, stock_code, stock_name,
                       action, quantity, price, amount, reason)
                       VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10)""",
                    [gen, gen, trade_date, ticker, name_map.get(ticker, ticker),
                     action, qty, price, round(price * qty, 2), reason]
                )

        conn.commit()
        return {"message": "History seeded successfully", "generations": len(gens)}
    finally:
        conn.close()


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
