from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import text

from app.orm_models.stock_master import StockMaster
from app.orm_models.stock_daily import StockDaily
from app.orm_models.index_daily import IndexDaily
from app.orm_models.batch_history import BatchHistory
from app.orm_models.scheduler_models import SchedulerJob, SchedulerHistory


class StockRepository:

    def __init__(self, session):
        self.session = session

    # ── Stock Master ──────────────────────────────────────────────

    def upsert_master_bulk(self, items: list[dict]) -> int:
        if not items:
            return 0
        rows = 0
        for item in items:
            existing = self.session.get(StockMaster, item["code"])
            if existing:
                existing.name = item.get("name", existing.name)
                existing.market = item.get("market", existing.market)
                if item.get("listing_date"):
                    existing.listing_date = item["listing_date"]
            else:
                self.session.add(StockMaster(**item))
            rows += 1
        return rows

    def get_all_codes(self) -> list[str]:
        result = self.session.execute(
            text("SELECT code FROM stock_master ORDER BY code")
        )
        return [row[0] for row in result]

    def get_master_count(self) -> int:
        return self.session.query(StockMaster).count()

    def get_master_by_market(self, market: str) -> list[StockMaster]:
        return (
            self.session.query(StockMaster)
            .filter(StockMaster.market == market)
            .order_by(StockMaster.code)
            .yield_per(100)
            .all()
        )

    def search_master(self, keyword: str, offset: int = 0, limit: int = 50) -> list[StockMaster]:
        q = f"%{keyword}%"
        return (
            self.session.query(StockMaster)
            .filter(
                StockMaster.code.like(q) | StockMaster.name.like(q)
            )
            .offset(offset)
            .limit(limit)
            .all()
        )

    # ── Stock Daily ──────────────────────────────────────────────

    def upsert_daily_bulk(self, items: list[dict]) -> int:
        if not items:
            return 0
        self.session.execute(text("ALTER SESSION DISABLE PARALLEL DML"))
        stmt = text("""
            MERGE /*+ NO_PARALLEL(t) */ INTO stock_daily t
            USING (SELECT :code AS code, :trade_date AS trade_date FROM DUAL) s
            ON (t.code = s.code AND t.trade_date = s.trade_date)
            WHEN MATCHED THEN UPDATE SET
                open_price = :open_price,
                high_price = :high_price,
                low_price = :low_price,
                close_price = :close_price,
                volume = :volume,
                trading_value = :trading_value,
                market_cap = :market_cap
            WHEN NOT MATCHED THEN INSERT
                (code, trade_date, open_price, high_price, low_price, close_price,
                 volume, trading_value, market_cap)
            VALUES
                (:code, :trade_date, :open_price, :high_price, :low_price, :close_price,
                 :volume, :trading_value, :market_cap)
        """)
        SUB_BATCH = 500
        for i in range(0, len(items), SUB_BATCH):
            self.session.execute(stmt, items[i:i + SUB_BATCH])
        return len(items)

    def get_daily_count(self) -> int:
        return self.session.query(StockDaily).count()

    def get_daily_distinct_codes(self) -> list[str]:
        result = self.session.execute(
            text("SELECT DISTINCT code FROM stock_daily ORDER BY code")
        )
        return [row[0] for row in result]

    def get_daily(self, code: str, start: Optional[date] = None, end: Optional[date] = None, limit: int = 365) -> list[StockDaily]:
        q = self.session.query(StockDaily).filter(StockDaily.code == code)
        if start:
            q = q.filter(StockDaily.trade_date >= start)
        if end:
            q = q.filter(StockDaily.trade_date <= end)
        return q.order_by(StockDaily.trade_date.desc()).limit(limit).all()

    def get_last_trade_date(self, code: str) -> Optional[date]:
        result = self.session.execute(
            text("SELECT MAX(trade_date) FROM stock_daily WHERE code = :code"),
            {"code": code},
        )
        row = result.fetchone()
        return row[0] if row and row[0] else None

    # ── Index Daily ──────────────────────────────────────────────

    def upsert_index_bulk(self, items: list[dict]) -> int:
        if not items:
            return 0
        stmt = text("""
            MERGE INTO index_daily t
            USING (SELECT :index_code AS index_code, :trade_date AS trade_date FROM DUAL) s
            ON (t.index_code = s.index_code AND t.trade_date = s.trade_date)
            WHEN MATCHED THEN UPDATE SET close_price = :close_price
            WHEN NOT MATCHED THEN INSERT (index_code, trade_date, close_price)
            VALUES (:index_code, :trade_date, :close_price)
        """)
        self.session.execute(stmt, items)
        return len(items)

    # ── Batch History ────────────────────────────────────────────

    def create_batch(self, batch_name: str) -> BatchHistory:
        bh = BatchHistory(batch_name=batch_name, status="RUNNING", start_time=date.today())
        self.session.add(bh)
        self.session.flush()
        return bh

    def update_batch(self, batch_id: int, status: str, rows_processed: int = 0, message: str = ""):
        bh = self.session.get(BatchHistory, batch_id)
        if bh:
            bh.status = status
            bh.end_time = date.today()
            bh.rows_processed = rows_processed
            if message:
                bh.message = message

    def get_batches(self, limit: int = 50) -> list[BatchHistory]:
        return (
            self.session.query(BatchHistory)
            .order_by(BatchHistory.start_time.desc())
            .limit(limit)
            .all()
        )

    # ── Scheduler Jobs ───────────────────────────────────────────

    def upsert_scheduler_job(self, job_id: str, job_name: str, cron: str, status: str, description: str = ""):
        existing = self.session.get(SchedulerJob, job_id)
        if existing:
            existing.status = status
            existing.cron_expression = cron
            if description:
                existing.description = description
        else:
            self.session.add(SchedulerJob(
                job_id=job_id, job_name=job_name, cron_expression=cron,
                status=status, description=description,
            ))

    def update_job_status(self, job_id: str, status: str):
        job = self.session.get(SchedulerJob, job_id)
        if job:
            job.status = status

    def get_all_jobs(self) -> list[SchedulerJob]:
        return self.session.query(SchedulerJob).order_by(SchedulerJob.created_at).all()

    def get_job(self, job_id: str) -> Optional[SchedulerJob]:
        return self.session.get(SchedulerJob, job_id)

    # ── Scheduler History ────────────────────────────────────────

    def add_scheduler_history(self, job_id: str, status: str, execution_time_ms: float = 0, message: str = "",
                              ticker_count: int = 0, inserted_rows: int = 0, updated_rows: int = 0,
                              error_message: str = ""):
        from datetime import datetime
        # Get next ID since identity column may not be set up properly
        result = self.session.execute(
            text("SELECT NVL(MAX(id), 0) + 1 FROM scheduler_history")
        )
        next_id = result.scalar()
        sh = SchedulerHistory(
            id=next_id,
            job_id=job_id, status=status,
            start_time=datetime.now(), end_time=datetime.now(),
            execution_time_ms=execution_time_ms, message=message,
            ticker_count=ticker_count, inserted_rows=inserted_rows,
            updated_rows=updated_rows, error_message=error_message,
        )
        self.session.add(sh)

    def get_job_history(self, job_id: str, limit: int = 50) -> list[SchedulerHistory]:
        return (
            self.session.query(SchedulerHistory)
            .filter(SchedulerHistory.job_id == job_id)
            .order_by(SchedulerHistory.start_time.desc())
            .limit(limit)
            .all()
        )
