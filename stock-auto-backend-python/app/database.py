from __future__ import annotations

import asyncio
import concurrent.futures
import os

import oracledb
from app.config import settings

_pool: oracledb.Pool | None = None
_db_executor = concurrent.futures.ThreadPoolExecutor(max_workers=16, thread_name_prefix="db")


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
