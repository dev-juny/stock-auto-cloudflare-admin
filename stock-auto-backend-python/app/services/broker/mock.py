import uuid
import random
from datetime import datetime
from typing import Optional
from app.services.broker.base import BrokerBase, OrderRequest, OrderResult


class MockBroker(BrokerBase):

    def __init__(self):
        self._balance = {"cash": 10000000, "total": 10000000, "invested": 0}
        self._positions: dict[str, dict] = {}

    async def get_balance(self) -> dict:
        return self._balance

    async def get_positions(self) -> list[dict]:
        return list(self._positions.values())

    async def place_order(self, request: OrderRequest) -> OrderResult:
        filled_price = request.price or random.uniform(50000, 200000)
        order_id = str(uuid.uuid4())[:8]
        if request.action == "buy":
            cost = filled_price * request.quantity
            self._balance["cash"] -= cost
            self._balance["invested"] += cost
            self._positions[request.ticker] = {
                "ticker": request.ticker,
                "quantity": request.quantity,
                "entry_price": filled_price,
                "current_price": filled_price,
                "entry_date": datetime.now().isoformat(),
            }
        elif request.action == "sell":
            pos = self._positions.pop(request.ticker, None)
            if pos:
                proceeds = filled_price * request.quantity
                self._balance["cash"] += proceeds
                self._balance["invested"] -= pos["entry_price"] * request.quantity
        self._balance["total"] = self._balance["cash"] + self._balance["invested"]
        return OrderResult(
            order_id=order_id,
            ticker=request.ticker,
            action=request.action,
            quantity=request.quantity,
            filled_price=filled_price,
            status="filled",
        )

    async def cancel_order(self, order_id: str) -> bool:
        return True

    async def get_market_price(self, ticker: str) -> float:
        return random.uniform(50000, 200000)
