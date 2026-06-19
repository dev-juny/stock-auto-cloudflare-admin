from sqlalchemy import Column, String, Text, DateTime, BigInteger, Float, func
from app.orm_models import Base


class SchedulerJob(Base):
    __tablename__ = "scheduler_job"

    job_id = Column(String(100), primary_key=True)
    job_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    cron_expression = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="STOPPED")
    created_at = Column(DateTime, server_default=func.current_timestamp())
    updated_at = Column(DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class SchedulerHistory(Base):
    __tablename__ = "scheduler_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    job_id = Column(String(100), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False)
    execution_time_ms = Column(Float, nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())
