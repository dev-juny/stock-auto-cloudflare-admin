from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class OrderRequest:
    ticker: str
    action: str
    quantity: int
    order_type: str = "market"
    price: Optional[float] = None


@dataclass
class OrderResult:
    order_id: str
    ticker: str
    action: str
    quantity: int
    filled_price: float
    status: str
    message: str = ""


class BrokerBase(ABC):

    @abstractmethod
    async def get_balance(self) -> dict:
        pass

    @abstractmethod
    async def get_positions(self) -> list[dict]:
        pass

    @abstractmethod
    async def place_order(self, request: OrderRequest) -> OrderResult:
        pass

    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        pass

    @abstractmethod
    async def get_market_price(self, ticker: str) -> float:
        pass
