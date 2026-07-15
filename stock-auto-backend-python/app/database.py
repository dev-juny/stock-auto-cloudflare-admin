from __future__ import annotations

import asyncio
import concurrent.futures
import os

import oracledb
from app.config import settings

_pool: oracledb.Pool | None = None
_db_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="db")


def _shutdown_executor():
    global _db_executor
    try:
        _db_executor.shutdown(wait=False)
    except Exception:
        pass


def get_pool() -> oracledb.Pool | None:
    return _pool


async def acquire_conn(timeout: float = 15) -> oracledb.Connection:
    pool = _pool
    if not pool:
        raise RuntimeError("Oracle pool not initialized")
    loop = asyncio.get_running_loop()
    try:
        conn = await asyncio.wait_for(
            loop.run_in_executor(_db_executor, pool.acquire),
            timeout=timeout,
        )
        return conn
    except asyncio.TimeoutError:
        raise RuntimeError(f"Could not acquire DB connection within {timeout}s")


async def init_oracle() -> None:
    global _pool
    if not settings.oracle_available:
        print("[WARN] Oracle config missing, skipping DB init")
        return
    oracledb.init_oracle_client(
        lib_dir=os.environ.get("LD_LIBRARY_PATH", ""),
        config_dir=settings.oracle_wallet_path,
    )
    dsn = settings.oracle_dsn
    if not dsn.startswith("(DESCRIPTION"):
        dsn = None
    _pool = oracledb.create_pool(
        user=settings.db_user,
        password=settings.db_password,
        dsn=dsn or settings.oracle_dsn,
        min=1,
        max=10,
        increment=1,
        getmode=oracledb.POOL_GETMODE_TIMEDWAIT,
        wait_timeout=15000,
    )
    await _ensure_tables()
    print(f"[INFO] Oracle pool ready — {settings.oracle_dsn}")


async def close_oracle() -> None:
    global _pool
    if _pool:
        _pool.close()
        _pool = None
        print("[INFO] Oracle pool closed")
    _shutdown_executor()
    print("[INFO] DB executor shut down")


async def _ensure_tables() -> None:
    conn = await acquire_conn()
    try:
        ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS active_positions (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            ticker VARCHAR2(20) NOT NULL,
            entry_date DATE DEFAULT SYSDATE,
            entry_price NUMBER(15,2) NOT NULL,
            quantity NUMBER(10) NOT NULL,
            highest_price NUMBER(15,2),
            is_break_even CHAR(1) DEFAULT 'N',
            holding_days NUMBER(5) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS trade_logs (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            ticker VARCHAR2(20) NOT NULL,
            action VARCHAR2(10) NOT NULL,
            price NUMBER(15,2),
            quantity NUMBER(10),
            reason VARCHAR2(50),
            traded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS backtest_results (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            params CLOB,
            result CLOB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS kospi_stocks (
            ticker VARCHAR2(6) PRIMARY KEY,
            name VARCHAR2(200) NOT NULL,
            sector VARCHAR2(200),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS market_breadth (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            breadth_pct NUMBER(5,2),
            total_stocks NUMBER(6),
            above_ma NUMBER(6),
            calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS scheduler_config (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            interval_seconds NUMBER(5) DEFAULT 60,
            breadth_threshold NUMBER(5,2) DEFAULT 0.30,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS saved_configs (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            name VARCHAR2(200),
            params CLOB,
            result_summary CLOB,
            portfolio_data CLOB,
            is_active CHAR(1) DEFAULT 'N',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS stock_daily_prices (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            ticker VARCHAR2(6) NOT NULL,
            trade_date DATE NOT NULL,
            open_price NUMBER(15,2),
            high_price NUMBER(15,2),
            low_price NUMBER(15,2),
            close_price NUMBER(15,2),
            volume NUMBER(15),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uk_ticker_date UNIQUE (ticker, trade_date)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS data_load_logs (
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            status VARCHAR2(20),
            kospi_loaded NUMBER(6) DEFAULT 0,
            kosdaq_loaded NUMBER(6) DEFAULT 0,
            total_rows NUMBER(10) DEFAULT 0,
            error_msg CLOB,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at TIMESTAMP
        )
        """,
    ]
        for ddl in ddl_statements:
            conn.cursor().execute(ddl)
        # ALTER TABLE for columns that may already exist
        alter_statements = [
            "ALTER TABLE saved_configs ADD (portfolio_data CLOB)",
            "ALTER TABLE scheduler_config ADD (breadth_upper NUMBER(5,2) DEFAULT 0.70)",
            "ALTER TABLE portfolio_backtest ADD (profit_factor NUMBER(10,4) DEFAULT 0)",
        ]
        for alt in alter_statements:
            try:
                conn.cursor().execute(alt)
            except Exception:
                pass  # column likely already exists
        conn.commit()
        print("[INFO] All tables ensured")
    finally:
        conn.close()
    from app.services.service_db import ensure_service_tables
    await ensure_service_tables()
    await _ensure_paper_trading_tables()


async def _ensure_paper_trading_tables():
    # ── Check if migration already done ──
    try:
        rows = await execute_query("SELECT COUNT(*) FROM paper_sessions")
        if rows and rows[0][0] > 0:
            print("[INFO] Paper trading tables already migrated")
            return
    except Exception:
        pass

    # ── Use a fresh dedicated connection (not from pool) to avoid ORA-12838 ──
    from app.config import settings as cfg

    def _run():
        conn = oracledb.connect(
            user=cfg.db_user,
            password=cfg.db_password,
            dsn=cfg.oracle_dsn,
        )
        try:
            cur = conn.cursor()
            # Create table
            cur.execute("SELECT COUNT(*) FROM user_tables WHERE table_name = 'PAPER_SESSIONS'")
            if cur.fetchone()[0] == 0:
                cur.execute("""
                    CREATE TABLE paper_sessions (
                        id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                        name VARCHAR2(200),
                        initial_capital NUMBER(15,2) DEFAULT 10000000,
                        max_positions NUMBER(5) DEFAULT 5,
                        position_size NUMBER(15,2) DEFAULT 500000,
                        commission_pct NUMBER(5,4) DEFAULT 0,
                        slippage_pct NUMBER(5,4) DEFAULT 0,
                        tax_pct NUMBER(5,4) DEFAULT 0,
                        auto_mode CHAR(1) DEFAULT 'N',
                        status VARCHAR2(20) DEFAULT 'active',
                        final_cash NUMBER(15,2),
                        final_invested NUMBER(15,2),
                        final_total NUMBER(15,2),
                        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        ended_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                print("[INFO] Created paper_sessions table")
            for stmt in [
                "ALTER TABLE paper_positions ADD (session_id NUMBER DEFAULT 1 NOT NULL)",
                "ALTER TABLE paper_trades ADD (session_id NUMBER DEFAULT 1 NOT NULL)",
                "ALTER TABLE paper_positions ADD (highest_price NUMBER(15,2))",
            ]:
                try:
                    cur.execute(stmt)
                except Exception:
                    pass
            conn.commit()
            # DML in same connection
            cur.execute("SELECT COUNT(*) FROM paper_sessions")
            if cur.fetchone()[0] == 0:
                cur.execute(
                    """INSERT INTO paper_sessions (name, initial_capital, status, started_at)
                       VALUES ('Default Session', 10000000, 'active', CURRENT_TIMESTAMP)"""
                )
                conn.commit()
                cur.execute("SELECT MAX(id) FROM paper_sessions")
                default_session_id = cur.fetchone()[0] or 1
                cur.execute(
                    "UPDATE paper_positions SET session_id = :1 WHERE session_id IS NULL OR session_id = 0",
                    [default_session_id],
                )
                cur.execute(
                    "UPDATE paper_trades SET session_id = :1 WHERE session_id IS NULL OR session_id = 0",
                    [default_session_id],
                )
                cur.execute(
                    "UPDATE paper_positions SET highest_price = entry_price WHERE highest_price IS NULL AND status = 'open'",
                )
                conn.commit()
        finally:
            conn.close()

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _run)
    print("[INFO] Paper trading tables ensured")


def _convert_lobs(row: tuple) -> tuple:
    return tuple(v.read() if hasattr(v, "read") else v for v in row)


def _run_query(pool, sql: str, binds: list | None) -> list[tuple]:
    conn = pool.acquire()
    try:
        cur = conn.cursor()
        cur.execute(sql, binds or [])
        return [_convert_lobs(r) for r in cur.fetchall()]
    finally:
        conn.close()


def _run_non_query(pool, sql: str, binds: list | None) -> None:
    conn = pool.acquire()
    try:
        conn.cursor().execute(sql, binds or [])
        conn.commit()
    finally:
        conn.close()


async def execute_query(sql: str, binds: list | None = None) -> list[tuple]:
    pool = _pool
    if not pool:
        raise RuntimeError("Oracle pool not initialized")
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(_db_executor, _run_query, pool, sql, binds),
            timeout=30,
        )
    except asyncio.TimeoutError:
        raise RuntimeError(f"DB query timed out: {sql[:80]}")


async def execute_non_query(sql: str, binds: list | None = None) -> None:
    pool = _pool
    if not pool:
        raise RuntimeError("Oracle pool not initialized")
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(_db_executor, _run_non_query, pool, sql, binds),
            timeout=30,
        )
    except asyncio.TimeoutError:
        raise RuntimeError(f"DB non-query timed out: {sql[:80]}")
