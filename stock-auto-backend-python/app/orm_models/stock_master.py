from sqlalchemy import Column, String, Date, DateTime, func
from app.orm_models import Base


class StockMaster(Base):
    __tablename__ = "stock_master"

    code = Column(String(12), primary_key=True)
    name = Column(String(200), nullable=False)
    market = Column(String(20), nullable=False)
    listing_date = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())
    updated_at = Column(DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
