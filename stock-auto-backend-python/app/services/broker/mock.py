import uuid
from datetime import datetime
from typing import Optional
from app.services.broker.base import BrokerBase, OrderRequest, OrderResult


class SessionBalance:
    def __init__(self, initial_capital: float = 10000000.0):
        self.cash = initial_capital
        self.total = initial_capital
        self.invested = 0.0

    def to_dict(self):
        return {"cash": self.cash, "total": self.total, "invested": self.invested}


class MockBroker(BrokerBase):

    def __init__(self):
        self._sessions: dict[int, SessionBalance] = {}
        self._positions: dict[int, dict[str, dict]] = {}

    def _ensure_session(self, session_id: int, initial_capital: float = 10000000.0):
        if session_id not in self._sessions:
            self._sessions[session_id] = SessionBalance(initial_capital)
        if session_id not in self._positions:
            self._positions[session_id] = {}

    async def get_balance(self, session_id: int = 1) -> dict:
        self._ensure_session(session_id)
        return self._sessions[session_id].to_dict()

    async def get_positions(self, session_id: int = 1) -> list[dict]:
        self._ensure_session(session_id)
        return list(self._positions[session_id].values())

    async def place_order(self, request: OrderRequest, session_id: int = 1) -> OrderResult:
        self._ensure_session(session_id)
        filled_price = request.price or 0
        order_id = str(uuid.uuid4())[:8]
        bal = self._sessions[session_id]
        if request.action == "buy":
            cost = filled_price * request.quantity
            bal.cash -= cost
            bal.invested += cost
            self._positions[session_id][request.ticker] = {
                "ticker": request.ticker,
                "quantity": request.quantity,
                "entry_price": filled_price,
                "current_price": filled_price,
                "entry_date": datetime.now().isoformat(),
            }
        elif request.action == "sell":
            pos = self._positions[session_id].pop(request.ticker, None)
            if pos:
                proceeds = filled_price * request.quantity
                bal.cash += proceeds
                bal.invested -= pos["entry_price"] * request.quantity
        bal.total = bal.cash + bal.invested
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
        return 0.0

    async def init_session(self, session_id: int, initial_capital: float):
        self._sessions[session_id] = SessionBalance(initial_capital)
        self._positions[session_id] = {}

    async def reset_session(self, session_id: int, initial_capital: float = 10000000.0):
        self._sessions[session_id] = SessionBalance(initial_capital)
        self._positions[session_id] = {}
