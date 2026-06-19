from sqlalchemy import Column, String, Text, DateTime, BigInteger, Float, func
from app.orm_models import Base


class BatchHistory(Base):
    __tablename__ = "batch_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    batch_name = Column(String(100), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False)
    rows_processed = Column(BigInteger, default=0)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())
