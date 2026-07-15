from sqlalchemy import Column, String, Text, DateTime, BigInteger, Float, Integer, Date, func
from app.orm_models import Base


class PaperSession(Base):
    __tablename__ = "paper_sessions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=True)
    initial_capital = Column(Float, default=10000000.0)
    max_positions = Column(Integer, default=5)
    position_size = Column(Float, default=500000.0)
    commission_pct = Column(Float, default=0)
    slippage_pct = Column(Float, default=0)
    tax_pct = Column(Float, default=0)
    auto_mode = Column(String(1), default="N")
    status = Column(String(20), default="active")
    final_cash = Column(Float, nullable=True)
    final_invested = Column(Float, nullable=True)
    final_total = Column(Float, nullable=True)
    started_at = Column(DateTime, server_default=func.current_timestamp())
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())


class PaperPosition(Base):
    __tablename__ = "paper_positions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(BigInteger, nullable=False, default=1)
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
    session_id = Column(BigInteger, nullable=False, default=1)
    strategy_id = Column(Integer, nullable=False)
    ticker = Column(String(12), nullable=False)
    action = Column(String(10), nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    pnl_pct = Column(Float, default=0)
    trade_date = Column(DateTime, nullable=False)
    reason = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())
