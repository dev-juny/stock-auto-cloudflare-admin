"""
One-time bulk load: fetch all KOSPI stocks and load 5 years of daily prices into Oracle.

Usage:
    export LD_LIBRARY_PATH=/home/ubuntu/instantclient_19_19
    export TNS_ADMIN=/home/ubuntu/wallet
    export ORACLE_WALLET_PATH=/home/ubuntu/wallet
    export ORACLE_DSN=stockdb_high
    export DB_USER=ADMIN
    export DB_PASSWORD='!Odhfkzmfelql1379'
    python3 load_all_kospi.py
"""

import asyncio
import os
import sys
import time
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "stock-auto-backtest" / "src"))

os.environ.setdefault("ORACLE_WALLET_PATH", os.environ.get("TNS_ADMIN", ""))
os.environ.setdefault("ORACLE_DSN", "stockdb_high")
os.environ.setdefault("DB_USER", "ADMIN")
os.environ.setdefault("DB_PASSWORD", "!Odhfkzmfelql1379")

from app.database import close_oracle, execute_non_query, get_pool
from app.services.kospi_data import load_all_historical, sync_kospi_tickers


def print_progress(current: int, total: int, ticker: str, name: str) -> None:
    pct = current / total * 100 if total else 0
    bar_len = 40
    filled = int(bar_len * current / total) if total else 0
    bar = "█" * filled + "░" * (bar_len - filled)
    sys.stdout.write(
        f"\r[{bar}] {current}/{total} ({pct:.1f}%) {ticker} {name:<20}  "
    )
    sys.stdout.flush()


async def main() -> None:
    print("=" * 60)
    print("KOSPI Historical Data Loader")
    print("=" * 60)

    import oracledb

    print("\n[1/3] Initializing Oracle...")
    oracledb.init_oracle_client(
        lib_dir=os.environ.get("LD_LIBRARY_PATH", ""),
        config_dir=os.environ.get("ORACLE_WALLET_PATH", ""),
    )
    dsn = os.environ.get("ORACLE_DSN", "stockdb_high")
    pool = oracledb.create_pool(
        user=os.environ.get("DB_USER", "ADMIN"),
        password=os.environ.get("DB_PASSWORD", ""),
        dsn=dsn,
        min=1,
        max=3,
        increment=1,
    )

    # Create tables (DDL) in a separate session, then close
    conn = pool.acquire()
    try:
        for ddl in [
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
        ]:
            conn.cursor().execute(ddl)
        conn.commit()
        print("  Tables ensured")
    finally:
        conn.close()

    # Close old pool and create a fresh one for DML
    pool.close()
    pool2 = oracledb.create_pool(
        user=os.environ.get("DB_USER", "ADMIN"),
        password=os.environ.get("DB_PASSWORD", ""),
        dsn=dsn,
        min=1,
        max=5,
        increment=1,
    )

    import app.database as db_mod
    db_mod._pool = pool2

    print("  Oracle pool ready")

    print("\n[2/3] Syncing KOSPI tickers from Naver...")
    count = await sync_kospi_tickers()
    print(f"  {count} tickers synced")

    print("\n[3/3] Loading historical prices (5 years)...")
    start = time.time()
    stats = await load_all_historical(progress=print_progress)
    elapsed = time.time() - start
    print()
    print(f"\n  Done in {elapsed:.0f}s")
    print(f"  Total stocks: {stats['total']}")
    print(f"  Success: {stats['success']}")
    print(f"  Failed: {stats['failed']}")
    print(f"  Total rows inserted: {stats['rows']}")
    if stats["errors"]:
        print(f"\n  Errors ({len(stats['errors'])}):")
        for err in stats["errors"][:10]:
            print(f"    - {err}")
        if len(stats["errors"]) > 10:
            print(f"    ... and {len(stats['errors']) - 10} more")

    await close_oracle()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
