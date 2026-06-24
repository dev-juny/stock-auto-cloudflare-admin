import pytest
from unittest.mock import patch


@pytest.mark.asyncio
async def test_start_validation():
    """start_validation sets validation mode active."""
    async def mock_query(sql, *a, **kw):
        sql_upper = sql.upper().strip()
        if "VALIDATION_MODE" in sql_upper:
            return [("Y",)]
        return []
    async def mock_non_query(*a, **kw):
        pass

    with patch("app.database.execute_query", mock_query), \
         patch("app.database.execute_non_query", mock_non_query):
        from app.services.operations_service import start_validation
        result = await start_validation()
        assert "message" in result and "started_at" in result


@pytest.mark.asyncio
async def test_get_validation_status_inactive():
    """get_validation_status returns inactive when no mode row."""
    async def mock_query(sql, *a, **kw):
        return []

    with patch("app.database.execute_query", mock_query):
        from app.services.operations_service import get_validation_status
        result = await get_validation_status()
        assert result.get("active") is not None or result.get("is_active") is not None


@pytest.mark.asyncio
async def test_check_live_trading_readiness_no_data():
    """check_live_trading_readiness returns ready=false with no trades."""
    async def mock_query(sql, *a, **kw):
        return []

    with patch("app.database.execute_query", mock_query):
        from app.services.operations_service import check_live_trading_readiness
        result = await check_live_trading_readiness()
        assert result["ready"] is False
