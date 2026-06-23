from sqlalchemy import Column, String, Text, DateTime, BigInteger, Float, Integer, Date, func
from app.orm_models import Base


class PaperPosition(Base):
    __tablename__ = "paper_positions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    strategy_id = Column(Integer, nullable=False)
    ticker = Column(String(12), nullable=False)
    entry_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=True)
    quantity = Column(Integer, nullable=False)
    entry_date = Column(DateTime, nullable=False)
    exit_date = Column(DateTime, nullable=True)
    pnl_pct = Column(Float, default=0)
    pnl_amt = Column(Float, default=0)
    status = Column(String(20), default="open")
    created_at = Column(DateTime, server_default=func.current_timestamp())


class PaperTrade(Base):
    __tablename__ = "paper_trades"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    strategy_id = Column(Integer, nullable=False)
    ticker = Column(String(12), nullable=False)
    action = Column(String(10), nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    pnl_pct = Column(Float, default=0)
    trade_date = Column(DateTime, nullable=False)
    reason = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())
