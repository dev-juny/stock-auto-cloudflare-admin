from sqlalchemy import Column, String, Text, DateTime, BigInteger, Float, Integer, Date, func
from app.orm_models import Base


class PortfolioStrategy(Base):
    __tablename__ = "portfolio_strategy"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    strategy_id = Column(Integer, nullable=False)
    generation = Column(Integer, nullable=False)
    allocation = Column(Float, default=0.0)
    status = Column(String(20), default="candidate")
    created_at = Column(DateTime, server_default=func.current_timestamp())
    approved_at = Column(DateTime, nullable=True)


class PortfolioBacktest(Base):
    __tablename__ = "portfolio_backtest"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    portfolio_id = Column(Integer, nullable=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    initial_capital = Column(Float, default=10000000)
    return_pct = Column(Float, default=0)
    win_rate = Column(Float, default=0)
    mdd = Column(Float, default=0)
    sharpe_ratio = Column(Float, default=0)
    cagr = Column(Float, default=0)
    trade_count = Column(Integer, default=0)
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())
