from __future__ import annotations

import gc
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from app.database_sqlalchemy import get_session_sync
from app.repositories.stock_repository import StockRepository
from app.orm_models import Base

logger = logging.getLogger(__name__)

CHUNK_SIZE = 100


def ensure_market_tables():
    from app.database_sqlalchemy import _engine
    if _engine is None:
        return
    raw = _engine.raw_connection()
    cur = raw.connection.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM user_tables WHERE table_name = 'BATCH_HISTORY'")
        tables_exist = cur.fetchone()[0] > 0
    except Exception:
        tables_exist = False

    if not tables_exist:
        ddl = """
        BEGIN
            EXECUTE IMMEDIATE 'CREATE TABLE stock_master (
                code VARCHAR2(12) PRIMARY KEY,
                name VARCHAR2(200) NOT NULL,
                market VARCHAR2(20) NOT NULL,
                listing_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )';
            EXECUTE IMMEDIATE 'CREATE TABLE stock_daily (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                code VARCHAR2(12) NOT NULL,
                trade_date DATE NOT NULL,
                open_price NUMBER(15,2),
                high_price NUMBER(15,2),
                low_price NUMBER(15,2),
                close_price NUMBER(15,2),
                volume NUMBER(15),
                trading_value NUMBER(20),
                market_cap NUMBER(20,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_stock_daily UNIQUE (code, trade_date)
            )';
            EXECUTE IMMEDIATE 'CREATE TABLE index_daily (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                index_code VARCHAR2(20) NOT NULL,
                trade_date DATE NOT NULL,
                close_price NUMBER(15,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_index_daily UNIQUE (index_code, trade_date)
            )';
            EXECUTE IMMEDIATE 'CREATE TABLE batch_history (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                batch_name VARCHAR2(100) NOT NULL,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                status VARCHAR2(20) NOT NULL,
                rows_processed NUMBER DEFAULT 0,
                message CLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )';
            EXECUTE IMMEDIATE 'CREATE TABLE scheduler_job (
                job_id VARCHAR2(100) PRIMARY KEY,
                job_name VARCHAR2(200) NOT NULL,
                description CLOB,
                cron_expression VARCHAR2(100),
                status VARCHAR2(20) DEFAULT ''STOPPED'' NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )';
            EXECUTE IMMEDIATE 'CREATE TABLE scheduler_history (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                job_id VARCHAR2(100) NOT NULL,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                status VARCHAR2(20) NOT NULL,
                execution_time_ms NUMBER(10),
                message CLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )';
            EXECUTE IMMEDIATE 'CREATE TABLE portfolio_strategy (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                strategy_id NUMBER NOT NULL,
                generation NUMBER(5) NOT NULL,
                allocation NUMBER(10,4) DEFAULT 0,
                status VARCHAR2(20) DEFAULT ''candidate'',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_at TIMESTAMP
            )';
            EXECUTE IMMEDIATE 'CREATE TABLE portfolio_backtest (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                portfolio_id NUMBER,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                initial_capital NUMBER(15,2) DEFAULT 10000000,
                return_pct NUMBER(10,4) DEFAULT 0,
                win_rate NUMBER(5,2) DEFAULT 0,
                mdd NUMBER(10,4) DEFAULT 0,
                sharpe_ratio NUMBER(10,4) DEFAULT 0,
                cagr NUMBER(10,4) DEFAULT 0,
                trade_count NUMBER(8) DEFAULT 0,
                details_json CLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )';
            EXECUTE IMMEDIATE 'CREATE TABLE paper_positions (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                strategy_id NUMBER NOT NULL,
                ticker VARCHAR2(12) NOT NULL,
                entry_price NUMBER(15,2) NOT NULL,
                current_price NUMBER(15,2),
                quantity NUMBER(10) NOT NULL,
                entry_date TIMESTAMP NOT NULL,
                exit_date TIMESTAMP,
                pnl_pct NUMBER(10,4) DEFAULT 0,
                pnl_amt NUMBER(15,2) DEFAULT 0,
                highest_price NUMBER(15,2),
                status VARCHAR2(20) DEFAULT ''open'',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )';
            EXECUTE IMMEDIATE 'CREATE TABLE paper_trades (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                strategy_id NUMBER NOT NULL,
                ticker VARCHAR2(12) NOT NULL,
                action VARCHAR2(10) NOT NULL,
                price NUMBER(15,2) NOT NULL,
                quantity NUMBER(10) NOT NULL,
                pnl_pct NUMBER(10,4) DEFAULT 0,
                pnl_amt NUMBER(15,2) DEFAULT 0,
                trade_date TIMESTAMP NOT NULL,
                reason VARCHAR2(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )';
        END;
        """
        try:
            cur.execute(ddl)
            raw.connection.commit()
            logger.info("Created market tables via raw DDL")
        except Exception as e:
            raw.connection.rollback()
            logger.warning("Raw DDL failed (%s), falling back to SQLAlchemy create_all", e)
            raw.close()
            Base.metadata.create_all(_engine, checkfirst=True)
            return
    else:
        cur.execute("SELECT COUNT(*) FROM user_tab_columns WHERE table_name = 'BATCH_HISTORY' AND column_name = 'ID' AND identity_column = 'YES'")
        has_identity = cur.fetchone()[0] > 0
        if not has_identity:
            tables_without_identity = []
            for tbl in ('BATCH_HISTORY', 'STOCK_DAILY', 'INDEX_DAILY', 'SCHEDULER_HISTORY'):
                cur.execute(f"SELECT COUNT(*) FROM user_tab_columns WHERE table_name = '{tbl}' AND column_name = 'ID' AND identity_column = 'YES'")
                if cur.fetchone()[0] == 0:
                    tables_without_identity.append(tbl)
            for tbl in tables_without_identity:
                try:
                    cur.execute(f"ALTER TABLE {tbl} MODIFY id GENERATED BY DEFAULT AS IDENTITY")
                    logger.info("Fixed identity column on %s", tbl)
                except Exception as e:
                    logger.warning("Could not fix identity on %s: %s", tbl, e)
            raw.connection.commit()
            logger.info("Fixed identity columns on: %s", tables_without_identity)

        # Add new columns for scheduler_history if they don't exist
        for col_info in (
            ("SCHEDULER_HISTORY", "TICKER_COUNT", "NUMBER"),
            ("SCHEDULER_HISTORY", "INSERTED_ROWS", "NUMBER"),
            ("SCHEDULER_HISTORY", "UPDATED_ROWS", "NUMBER"),
            ("SCHEDULER_HISTORY", "ERROR_MESSAGE", "CLOB"),
        ):
            tbl, col, typ = col_info
            cur.execute(
                f"SELECT COUNT(*) FROM user_tab_columns WHERE table_name = '{tbl}' AND column_name = '{col}'"
            )
            if cur.fetchone()[0] == 0:
                try:
                    cur.execute(f"ALTER TABLE {tbl} ADD ({col} {typ})")
                    logger.info("Added column %s.%s", tbl, col)
                except Exception as e:
                    logger.warning("Could not add column %s.%s: %s", tbl, col, e)
        raw.connection.commit()

        # Create new system tables if they don't exist
        new_tables = {
            "PORTFOLIO_STRATEGY": """CREATE TABLE portfolio_strategy (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                strategy_id NUMBER NOT NULL,
                generation NUMBER(5) NOT NULL,
                allocation NUMBER(10,4) DEFAULT 0,
                status VARCHAR2(20) DEFAULT 'candidate',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_at TIMESTAMP
            )""",
            "PORTFOLIO_BACKTEST": """CREATE TABLE portfolio_backtest (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                portfolio_id NUMBER,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                initial_capital NUMBER(15,2) DEFAULT 10000000,
                return_pct NUMBER(10,4) DEFAULT 0,
                win_rate NUMBER(5,2) DEFAULT 0,
                mdd NUMBER(10,4) DEFAULT 0,
                sharpe_ratio NUMBER(10,4) DEFAULT 0,
                cagr NUMBER(10,4) DEFAULT 0,
                trade_count NUMBER(8) DEFAULT 0,
                details_json CLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            "PAPER_POSITIONS": """CREATE TABLE paper_positions (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                strategy_id NUMBER NOT NULL,
                ticker VARCHAR2(12) NOT NULL,
                entry_price NUMBER(15,2) NOT NULL,
                current_price NUMBER(15,2),
                quantity NUMBER(10) NOT NULL,
                entry_date TIMESTAMP NOT NULL,
                exit_date TIMESTAMP,
                pnl_pct NUMBER(10,4) DEFAULT 0,
                pnl_amt NUMBER(15,2) DEFAULT 0,
                highest_price NUMBER(15,2),
                status VARCHAR2(20) DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            "PAPER_TRADES": """CREATE TABLE paper_trades (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                strategy_id NUMBER NOT NULL,
                ticker VARCHAR2(12) NOT NULL,
                action VARCHAR2(10) NOT NULL,
                price NUMBER(15,2) NOT NULL,
                quantity NUMBER(10) NOT NULL,
                pnl_pct NUMBER(10,4) DEFAULT 0,
                pnl_amt NUMBER(15,2) DEFAULT 0,
                trade_date TIMESTAMP NOT NULL,
                reason VARCHAR2(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
        }
        for tbl_name, ddl in new_tables.items():
            cur.execute(f"SELECT COUNT(*) FROM user_tables WHERE table_name = '{tbl_name}'")
            if cur.fetchone()[0] == 0:
                try:
                    cur.execute(ddl)
                    logger.info("Created table %s", tbl_name)
                except Exception as e:
                    logger.warning("Could not create table %s: %s", tbl_name, e)
        raw.connection.commit()

        # Add missing columns to existing tables
        # Create new system tables if they don't exist
        for tbl_name, ddl in {
            "PROMOTION_HISTORY": """CREATE TABLE promotion_history (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                strategy_id NUMBER NOT NULL,
                old_status VARCHAR2(20),
                new_status VARCHAR2(20) NOT NULL,
                reason VARCHAR2(200),
                fitness_before NUMBER(10,4),
                fitness_after NUMBER(10,4),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            "VALIDATION_MODE": """CREATE TABLE validation_mode (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                is_active CHAR(1) DEFAULT 'Y',
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                result CLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            "VALIDATION_DAILY_LOG": """CREATE TABLE validation_daily_log (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                validation_id NUMBER NOT NULL,
                log_date DATE NOT NULL,
                daily_return NUMBER(10,4) DEFAULT 0,
                cumulative_return NUMBER(10,4) DEFAULT 0,
                mdd NUMBER(10,4) DEFAULT 0,
                win_rate NUMBER(5,2) DEFAULT 0,
                total_trades NUMBER(8) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            "PORTFOLIO_REBALANCE_HISTORY": """CREATE TABLE portfolio_rebalance_history (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                rebalance_type VARCHAR2(20) NOT NULL,
                before_json CLOB,
                after_json CLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
        }.items():
            cur.execute(f"SELECT COUNT(*) FROM user_tables WHERE table_name = '{tbl_name}'")
            if cur.fetchone()[0] == 0:
                try:
                    cur.execute(ddl)
                    logger.info("Created table %s", tbl_name)
                except Exception as e:
                    logger.warning("Could not create table %s: %s", tbl_name, e)

        col_migrations = [
            ("PAPER_TRADES", "PNL_AMT", "NUMBER(15,2) DEFAULT 0"),
            ("PAPER_POSITIONS", "HIGHEST_PRICE", "NUMBER(15,2)"),
        ]
        for tbl, col, typ in col_migrations:
            cur.execute(f"SELECT COUNT(*) FROM user_tab_columns WHERE table_name = '{tbl}' AND column_name = '{col}'")
            if cur.fetchone()[0] == 0:
                try:
                    cur.execute(f"ALTER TABLE {tbl} ADD ({col} {typ})")
                    logger.info("Added column %s.%s", tbl, col)
                except Exception as e:
                    logger.warning("Could not add column %s.%s: %s", tbl, col, e)
        raw.connection.commit()
    raw.close()


class MarketDataService:

    def __init__(self):
        self._pykrx_available = False
        self._yfinance_available = False
        self._check_dependencies()

    def _check_dependencies(self):
        try:
            import pykrx  # noqa
            self._pykrx_available = True
        except ImportError:
            logger.warning("pykrx not installed")
        try:
            import yfinance  # noqa
            self._yfinance_available = True
        except ImportError:
            logger.warning("yfinance not installed")

    # ── Public API ───────────────────────────────────────────────

    def sync_all(self) -> dict:
        import time
        start = time.time()
        stats = {"master": 0, "daily": 0, "index": 0, "errors": []}

        session = get_session_sync()
        repo = StockRepository(session)
        batch = repo.create_batch("MARKET_SYNC_ALL")

        try:
            stats["master"] = self._sync_master(repo, session)
            stats["daily"] = self._sync_daily_all(repo, session)
            stats["index"] = self._sync_index(repo, session)

            elapsed_ms = int((time.time() - start) * 1000)
            total = stats["master"] + stats["daily"] + stats["index"]
            repo.update_batch(batch.id, "SUCCESS", total, f"Completed in {elapsed_ms}ms")
            session.commit()
            logger.info("Market sync SUCCESS: %d rows in %dms", total, elapsed_ms)
        except Exception as e:
            session.rollback()
            repo.update_batch(batch.id, "FAIL", 0, str(e))
            session.commit()
            stats["errors"].append(str(e))
            logger.error("Market sync FAILED: %s", e)
        finally:
            session.close()

        return stats

    def sync_daily_incremental(self) -> dict:
        import time
        start = time.time()
        stats = {"daily": 0, "errors": []}

        session = get_session_sync()
        repo = StockRepository(session)

        try:
            stats["daily"] = self._sync_daily_incremental_all(repo, session)
            elapsed_ms = int((time.time() - start) * 1000)
            logger.info("Incremental sync: %d rows in %dms", stats["daily"], elapsed_ms)
        except Exception as e:
            session.rollback()
            stats["errors"].append(str(e))
            logger.error("Incremental sync FAILED: %s", e)
        finally:
            session.close()

        return stats

    # ── Master Sync ──────────────────────────────────────────────

    def _sync_master(self, repo, session) -> int:
        total = 0
        for market in ("KOSPI", "KOSDAQ", "ETF"):
            items = self._fetch_master_list(market)
            if items:
                total += repo.upsert_master_bulk(items)
                session.commit()
                gc.collect()
        return total

    def _fetch_master_list(self, market: str) -> list[dict]:
        try:
            from pykrx import stock as pk
            tickers = pk.get_market_ticker_list(market=market)
            result = []
            for t in tickers:
                name = pk.get_market_ticker_name(t)
                result.append({
                    "code": t, "name": name,
                    "market": market, "listing_date": None,
                })
            return result
        except Exception as e:
            logger.warning("pykrx master fetch failed for %s: %s", market, e)
            return []

    # ── Daily Sync ───────────────────────────────────────────────

    def _sync_daily_all(self, repo, session) -> int:
        codes = repo.get_all_codes()
        if not codes:
            logger.warning("No codes in stock_master")
            return 0
        return self._process_daily_chunks(codes, repo, session, incremental=False)

    def _sync_daily_incremental_all(self, repo, session) -> int:
        codes = repo.get_all_codes()
        if not codes:
            return 0
        return self._process_daily_chunks(codes, repo, session, incremental=True)

    def _process_daily_chunks(self, codes: list[str], repo, session, incremental: bool) -> int:
        total = 0
        for i in range(0, len(codes), CHUNK_SIZE):
            chunk = codes[i:i + CHUNK_SIZE]
            rows = []
            for code in chunk:
                last_date = repo.get_last_trade_date(code) if incremental else None
                daily = self._fetch_daily_for_code(code, last_date)
                if daily:
                    rows.extend(daily)
            if rows:
                repo.upsert_daily_bulk(rows)
                session.commit()
                total += len(rows)
                logger.info("Chunk %d-%d: %d rows", i, min(i + CHUNK_SIZE, len(codes)), len(rows))
            del rows, chunk
            gc.collect()
        return total

    def _fetch_daily_for_code(self, code: str, last_date: Optional[date]) -> list[dict]:
        df = None
        try:
            from pykrx import stock as pk
            end = date.today()
            start = last_date - timedelta(days=365) if last_date else (end - timedelta(days=365 * 5))
            df = pk.get_market_ohlcv_by_date(
                start.strftime("%Y%m%d"), end.strftime("%Y%m%d"), code
            )
            if df is not None and not df.empty and last_date:
                import pandas
                df = df[df.index > pandas.Timestamp(last_date)]
        except Exception as e:
            logger.debug("pykrx daily fetch failed for %s: %s", code, e)
            df = self._fetch_daily_yfinance(code, last_date)

        if df is None or df.empty:
            return []
        rows = self._df_to_daily_rows(df, code)
        del df
        return rows

    def _fetch_daily_yfinance(self, code: str, last_date: Optional[date]) -> Optional["pandas.DataFrame"]:
        try:
            import yfinance as yf
            import pandas
            end = date.today() + timedelta(days=1)
            start = last_date - timedelta(days=10) if last_date else (end - timedelta(days=365 * 5))
            for suffix in (".KS", ".KQ"):
                df = yf.Ticker(f"{code}{suffix}").history(
                    start=start.strftime("%Y-%m-%d"),
                    end=end.strftime("%Y-%m-%d"),
                )
                if df is not None and not df.empty:
                    df.columns = [c.lower() for c in df.columns]
                    if last_date:
                        df = df[df.index > pandas.Timestamp(last_date)]
                    return df
        except Exception:
            pass
        return None

    def _df_to_daily_rows(self, df, code: str) -> list[dict]:
        rows = []
        for idx, row in df.iterrows():
            td = idx.to_pydatetime().date() if hasattr(idx, "to_pydatetime") else idx
            rows.append({
                "code": code,
                "trade_date": td,
                "open_price": float(row.get("시가", row.get("open", 0))),
                "high_price": float(row.get("고가", row.get("high", 0))),
                "low_price": float(row.get("저가", row.get("low", 0))),
                "close_price": float(row.get("종가", row.get("close", 0))),
                "volume": int(float(row.get("거래량", row.get("volume", 0)))),
                "trading_value": int(float(row.get("거래대금", row.get("trading_value", 0)))),
                "market_cap": float(row.get("시가총액", row.get("market_cap", 0))),
            })
        return rows

    # ── Index Sync ───────────────────────────────────────────────

    def _sync_index(self, repo, session) -> int:
        total = 0
        for idx_code in ("1001", "1002", "1003"):
            rows = self._fetch_index_data(idx_code)
            if rows:
                total += repo.upsert_index_bulk(rows)
        if total:
            session.commit()
        return total

    def _fetch_index_data(self, idx_code: str) -> list[dict]:
        try:
            from pykrx import stock as pk
            end = date.today()
            start = end - timedelta(days=365 * 5)
            df = pk.get_index_ohlcv_by_date(
                start.strftime("%Y%m%d"), end.strftime("%Y%m%d"), idx_code
            )
            if df is not None and not df.empty:
                rows = []
                for idx, row in df.iterrows():
                    td = idx.to_pydatetime().date() if hasattr(idx, "to_pydatetime") else idx
                    rows.append({
                        "index_code": idx_code,
                        "trade_date": td,
                        "close_price": float(row.get("종가", row.get("close", 0))),
                    })
                return rows
        except Exception as e:
            logger.debug("pykrx index fetch failed for %s: %s", idx_code, e)
        return []
