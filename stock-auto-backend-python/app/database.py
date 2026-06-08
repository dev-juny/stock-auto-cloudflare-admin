from __future__ import annotations

import os

import oracledb
from app.config import settings

_pool: oracledb.Pool | None = None


def get_pool() -> oracledb.Pool | None:
    return _pool


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
        max=5,
        increment=1,
    )
    await _ensure_tables()
    print(f"[INFO] Oracle pool ready — {settings.oracle_dsn}")


async def close_oracle() -> None:
    global _pool
    if _pool:
        _pool.close()
        _pool = None
        print("[INFO] Oracle pool closed")


async def _ensure_tables() -> None:
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
    ]
    pool = _pool
    if not pool:
        return
    conn = pool.acquire()
    try:
        for ddl in ddl_statements:
            conn.cursor().execute(ddl)
        conn.commit()
        print("[INFO] All tables ensured")
    finally:
        conn.close()


async def execute_query(sql: str, binds: list | None = None) -> list[tuple]:
    pool = _pool
    if not pool:
        raise RuntimeError("Oracle pool not initialized")
    conn = pool.acquire()
    try:
        cur = conn.cursor()
        cur.execute(sql, binds or [])
        return cur.fetchall()
    finally:
        conn.close()


async def execute_non_query(sql: str, binds: list | None = None) -> None:
    pool = _pool
    if not pool:
        raise RuntimeError("Oracle pool not initialized")
    conn = pool.acquire()
    try:
        conn.cursor().execute(sql, binds or [])
        conn.commit()
    finally:
        conn.close()
