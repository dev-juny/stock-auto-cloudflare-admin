import pytest
from unittest.mock import AsyncMock


@pytest.fixture
def db_mocks(monkeypatch):
    """Patch module-level execute_query/execute_non_query references.
    
    Patches both operations_service and service_db module attributes
    so every test can control database calls regardless of import order.
    
    Yields (mock_query, mock_non_query) for per-test configuration.
    """
    mq = AsyncMock()
    mnq = AsyncMock()
    monkeypatch.setattr("app.services.service_db.execute_query", mq)
    monkeypatch.setattr("app.services.service_db.execute_non_query", mnq)
    monkeypatch.setattr("app.services.operations_service.execute_query", mq)
    monkeypatch.setattr("app.services.operations_service.execute_non_query", mnq)
    yield mq, mnq
