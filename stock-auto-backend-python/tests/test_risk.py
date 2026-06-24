import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_check_risk_limits_passes_on_empty_data():
    """check_risk_limits returns PASS when no positions or trades exist."""
    async def mock_query(sql, *args, **kwargs):
        sql_upper = sql.upper().strip()
        if "SYSTEM_SETTINGS" in sql_upper:
            return []  # no risk settings -> use defaults
        if "SUM" in sql_upper or "COUNT" in sql_upper:
            return [(0, 0, 0)]
        return [(0,)]
    async def mock_non_query(*a, **kw):
        pass

    with patch("app.database.execute_query", mock_query), \
         patch("app.database.execute_non_query", mock_non_query):
        from app.services.operations_service import check_risk_limits
        result = await check_risk_limits()
        assert result["risk_status"] == "PASS"
        assert result["blocked"] is False
        assert result["reasons"] == []


@pytest.mark.asyncio
async def test_check_risk_limits_blocks_on_loss_limit():
    """check_risk_limits returns BLOCKED when daily loss limit breached."""
    async def mock_query(sql, *args, **kwargs):
        sql_upper = sql.upper().strip()
        if "SYSTEM_SETTINGS" in sql_upper:
            return [
                ("daily_loss_limit", "-5", "pct"),
                ("daily_profit_lock", "10", "pct"),
            ]
        if "PAPER_TRADES" in sql_upper and "TRUNC" in sql_upper:
            return [(-600000,)]  # daily P&L = -6% (breaches 5% limit)
        if "PAPER_POSITIONS" in sql_upper:
            return [(3,)]
        if "PORTFOLIO_BACKTEST" in sql_upper:
            return [(15,)]
        return []

    async def mock_non_query(*a, **kw):
        pass

        with patch("app.database.execute_query", mock_query), \
             patch("app.database.execute_non_query", mock_non_query):
            from app.services.operations_service import check_risk_limits
            result = await check_risk_limits()
            assert result["risk_status"] == "BLOCKED"
            assert result["blocked"] is True
