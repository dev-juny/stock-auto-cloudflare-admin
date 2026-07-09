from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.database import execute_query, execute_non_query
from app.config import settings
from app.utils.timezone import to_kst


async def ensure_service_tables():
    from app.database import acquire_conn
    if not settings.oracle_available:
        return

    ddl = [
        """CREATE TABLE IF NOT EXISTS portfolio_snapshot (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_value NUMBER(15,2) DEFAULT 0,
            cash NUMBER(15,2) DEFAULT 0,
            invested NUMBER(15,2) DEFAULT 0,
            pnl_pct NUMBER(10,4) DEFAULT 0,
            pnl_amt NUMBER(15,2) DEFAULT 0,
            positions_count NUMBER(5) DEFAULT 0,
            holdings_json CLOB
        )""",
        """CREATE TABLE IF NOT EXISTS strategy_registry (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            strategy_id NUMBER,
            name VARCHAR2(200) NOT NULL,
            entry_type VARCHAR2(30) DEFAULT 'momentum',
            generation NUMBER(5) DEFAULT 1,
            version NUMBER(5) DEFAULT 1,
            is_active CHAR(1) DEFAULT 'Y',
            is_elite CHAR(1) DEFAULT 'N',
            allocation_pct NUMBER(5,2) DEFAULT 0,
            total_return NUMBER(10,4) DEFAULT 0,
            win_rate NUMBER(5,2) DEFAULT 0,
            max_drawdown NUMBER(10,4) DEFAULT 0,
            profit_factor NUMBER(10,4) DEFAULT 0,
            total_trades NUMBER(8) DEFAULT 0,
            fitness_score NUMBER(10,4) DEFAULT 0,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS system_settings (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            setting_key VARCHAR2(100) NOT NULL UNIQUE,
            setting_value VARCHAR2(500),
            setting_type VARCHAR2(20) DEFAULT 'string',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS system_logs (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            log_type VARCHAR2(20) NOT NULL,
            source VARCHAR2(50) DEFAULT '',
            message VARCHAR2(1000),
            details_json CLOB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
    ]
    conn = await acquire_conn()
    try:
        for d in ddl:
            conn.cursor().execute(d)
        conn.commit()
        print("[INFO] Service tables ensured")
    finally:
        conn.close()


async def get_portfolio_snapshots(limit: int = 30) -> list[dict]:
    rows = await execute_query(
        """SELECT snapshot_date, total_value, cash, invested, pnl_pct, pnl_amt, positions_count, holdings_json
           FROM portfolio_snapshot ORDER BY snapshot_date DESC""",
        None
    )
    result = []
    for r in rows[:limit]:
        snapshot_dt = r[0]
        date_str = snapshot_dt.isoformat() if hasattr(snapshot_dt, 'isoformat') else (str(snapshot_dt) if snapshot_dt else '')
        result.append({
            "date": date_str,
            "date_kst": to_kst(snapshot_dt),
            "total_value": r[1] or 0, "cash": r[2] or 0,
            "invested": r[3] or 0, "pnl_pct": r[4] or 0, "pnl_amt": r[5] or 0,
            "positions_count": r[6] or 0, "holdings": r[7] if r[7] else '[]'
        })
    return result


async def save_portfolio_snapshot(data: dict):
    await execute_non_query(
        """INSERT INTO portfolio_snapshot (total_value, cash, invested, pnl_pct, pnl_amt, positions_count, holdings_json)
           VALUES (:1,:2,:3,:4,:5,:6,:7)""",
        [data.get('total_value', 0), data.get('cash', 0), data.get('invested', 0),
         data.get('pnl_pct', 0), data.get('pnl_amt', 0), data.get('positions_count', 0),
         data.get('holdings_json', '[]')]
    )


SORTABLE_COLUMNS = {
    "generation": "generation",
    "win_rate": "win_rate",
    "total_return": "total_return",
    "fitness_score": "fitness_score",
    "max_drawdown": "max_drawdown",
    "name": "name",
    "id": "id",
    "registered_at": "registered_at",
}


async def get_strategy_registry(
    offset: int = 0,
    limit: int = 50,
    sort_by: str = "fitness_score",
    sort_dir: str = "desc",
    search: str = "",
    filters: Optional[dict] = None,
) -> dict:
    sort_col = SORTABLE_COLUMNS.get(sort_by, "fitness_score")
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    where_clauses = []
    binds = []

    if search:
        where_clauses.append("(LOWER(name) LIKE :search OR LOWER(entry_type) LIKE :search OR TO_CHAR(id) LIKE :search_param)")
        binds.append(f"%{search.lower()}%")
        binds.append(f"%{search.lower()}%")
        binds.append(f"%{search}%")

    filters = filters or {}
    if filters.get("is_active") is not None:
        where_clauses.append("is_active=:is_active")
        binds.append('Y' if filters['is_active'] else 'N')
    if filters.get("generation"):
        where_clauses.append("generation=:gen")
        binds.append(int(filters['generation']))
    if filters.get("min_return") is not None:
        where_clauses.append("total_return>=:min_ret")
        binds.append(float(filters['min_return']))
    if filters.get("max_return") is not None:
        where_clauses.append("total_return<=:max_ret")
        binds.append(float(filters['max_return']))
    if filters.get("min_winrate") is not None:
        where_clauses.append("win_rate>=:min_wr")
        binds.append(float(filters['min_winrate']))
    if filters.get("max_winrate") is not None:
        where_clauses.append("win_rate<=:max_wr")
        binds.append(float(filters['max_winrate']))
    if filters.get("max_mdd") is not None:
        where_clauses.append("max_drawdown<=:max_mdd")
        binds.append(float(filters['max_mdd']))

    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    count_sql = f"SELECT COUNT(*) FROM strategy_registry{where_sql}"
    count_rows = await execute_query(count_sql, binds if binds else None)
    total = count_rows[0][0] if count_rows else 0

    data_sql = f"""SELECT id, strategy_id, name, entry_type, generation, version,
                          is_active, is_elite, allocation_pct, total_return, win_rate,
                          max_drawdown, profit_factor, total_trades, fitness_score, registered_at
                   FROM strategy_registry{where_sql}
                   ORDER BY {sort_col} {direction}
                   OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY"""
    data_binds = (binds if binds else []) + [offset, limit]
    rows = await execute_query(data_sql, data_binds)

    items = [
        {"id": r[0], "strategy_id": r[1], "name": r[2] or '', "entry_type": r[3] or '',
         "generation": r[4] or 0, "version": r[5] or 0, "is_active": r[6] == 'Y',
         "is_elite": r[7] == 'Y', "allocation_pct": r[8] or 0,
         "total_return": r[9] or 0, "win_rate": r[10] or 0,
         "max_drawdown": r[11] or 0, "profit_factor": r[12] or 0,
         "total_trades": r[13] or 0, "fitness_score": r[14] or 0,
         "registered_at": r[15].isoformat() if r[15] and hasattr(r[15], 'isoformat') else (str(r[15]) if r[15] else '')}
        for r in rows
    ]
    return {"items": items, "total": total, "offset": offset, "limit": limit}


async def register_strategy(data: dict) -> int:
    await execute_non_query(
        """INSERT INTO strategy_registry (strategy_id, name, entry_type, generation, version, is_active, is_elite, allocation_pct,
           total_return, win_rate, max_drawdown, profit_factor, total_trades, fitness_score)
           VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14)""",
        [data.get('strategy_id'), data.get('name', ''), data.get('entry_type', 'momentum'),
         data.get('generation', 1), data.get('version', 1),
         'Y' if data.get('is_active', True) else 'N', 'Y' if data.get('is_elite', False) else 'N',
         data.get('allocation_pct', 0), data.get('total_return', 0), data.get('win_rate', 0),
         data.get('max_drawdown', 0), data.get('profit_factor', 0), data.get('total_trades', 0),
         data.get('fitness_score', 0)]
    )
    rows = await execute_query(
        "SELECT MAX(id) FROM strategy_registry WHERE name=:1", [data.get('name', '')]
    )
    return rows[0][0] if rows else 0


async def update_strategy(registry_id: int, data: dict):
    sets = []
    binds = []
    i = 1
    for key in ['is_active', 'is_elite', 'allocation_pct', 'name']:
        if key in data:
            val = data[key]
            if key in ('is_active', 'is_elite'):
                val = 'Y' if val else 'N'
            sets.append(f"{key}=:{i}")
            binds.append(val)
            i += 1
    if not sets:
        return
    sets.append(f"updated_at=CURRENT_TIMESTAMP")
    binds.append(registry_id)
    await execute_non_query(
        f"UPDATE strategy_registry SET {','.join(sets)} WHERE id=:{i}",
        binds
    )


async def delete_strategy(registry_id: int):
    await execute_non_query("DELETE FROM strategy_registry WHERE id=:1", [registry_id])


def _default_settings() -> dict:
    return {
        'backtest_interval': '1h', 'evolution_enabled': True,
        'population_size': 50, 'mutation_rate': 0.3, 'crossover_rate': 0.4,
        'elite_ratio': 0.2, 'tournament_size': 5, 'max_generations': 100,
        'fitness_return_weight': 0.5, 'fitness_winrate_weight': 0.3,
        'fitness_mdd_penalty': 0.2, 'mdd_threshold': 10,
        'winrate_threshold': 45, 'return_threshold': 0,
    }

async def get_settings() -> dict:
    if not settings.oracle_available:
        return _default_settings()
    rows = await execute_query(
        "SELECT setting_key, setting_value, setting_type FROM system_settings",
        None
    )
    result = {}
    for r in rows:
        key, val, typ = r
        if typ == 'number':
            try:
                result[key] = float(val) if '.' in str(val) else int(val)
            except:
                result[key] = val
        elif typ == 'boolean':
            result[key] = str(val).lower() == 'true'
        else:
            result[key] = val
    defaults = {
        'backtest_interval': '1h', 'evolution_enabled': True,
        'population_size': 50, 'mutation_rate': 0.3, 'crossover_rate': 0.4,
        'elite_ratio': 0.2, 'tournament_size': 5, 'max_generations': 100,
        'fitness_return_weight': 0.5, 'fitness_winrate_weight': 0.3,
        'fitness_mdd_penalty': 0.2, 'mdd_threshold': 10,
        'winrate_threshold': 45, 'return_threshold': 0,
    }
    for k, v in defaults.items():
        if k not in result:
            result[k] = v
    return result


async def load_evolution_config():
    from app.strategy_evolution.models import EvolutionConfig
    settings = await get_settings()
    return EvolutionConfig.from_settings_dict(settings)


async def update_setting(key: str, value, typ: str = 'string'):
    await execute_non_query(
        "MERGE INTO system_settings t USING dual ON (t.setting_key=:1) "
        "WHEN MATCHED THEN UPDATE SET setting_value=:2, setting_type=:3, updated_at=CURRENT_TIMESTAMP "
        "WHEN NOT MATCHED THEN INSERT (setting_key, setting_value, setting_type) VALUES (:1,:2,:3)",
        [key, str(value), typ]
    )


async def get_system_logs(log_type: Optional[str] = None, limit: int = 100) -> list[dict]:
    sql = "SELECT id, log_type, source, message, details_json, created_at FROM system_logs"
    binds = []
    if log_type:
        sql += " WHERE log_type=:1"
        binds.append(log_type)
    sql += " ORDER BY created_at DESC"
    rows = await execute_query(sql, binds if binds else None)
    return [
        {"id": r[0], "log_type": r[1], "source": r[2] or '', "message": r[3] or '',
         "created_at": r[5].isoformat() if r[5] and hasattr(r[5], 'isoformat') else (str(r[5]) if r[5] else ''),
         "created_at_kst": to_kst(r[5])}
        for r in rows[:limit]
    ]


async def add_system_log(log_type: str, source: str, message: str, details: Optional[dict] = None):
    import json
    await execute_non_query(
        "INSERT INTO system_logs (log_type, source, message, details_json) VALUES (:1,:2,:3,:4)",
        [log_type, source, message, json.dumps(details) if details else None]
    )
