from sqlalchemy import Column, String, Date, Float, BigInteger, DateTime, UniqueConstraint, func
from app.orm_models import Base


class IndexDaily(Base):
    __tablename__ = "index_daily"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    index_code = Column(String(20), nullable=False)
    trade_date = Column(Date, nullable=False)
    close_price = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (
        UniqueConstraint("index_code", "trade_date", name="uq_index_daily"),
    )
