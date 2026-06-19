from sqlalchemy import Column, String, Date, Float, BigInteger, DateTime, UniqueConstraint, func
from app.orm_models import Base


class StockDaily(Base):
    __tablename__ = "stock_daily"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    code = Column(String(12), nullable=False)
    trade_date = Column(Date, nullable=False)
    open_price = Column(Float, nullable=True)
    high_price = Column(Float, nullable=True)
    low_price = Column(Float, nullable=True)
    close_price = Column(Float, nullable=True)
    volume = Column(BigInteger, nullable=True)
    trading_value = Column(BigInteger, nullable=True)
    market_cap = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (
        UniqueConstraint("code", "trade_date", name="uq_stock_daily"),
    )
