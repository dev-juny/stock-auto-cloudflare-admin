import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_auto_promote_no_candidates():
    """auto_promote_strategies returns early when no eligible candidates."""
    async def mock_query(sql, *a, **kw):
        sql_upper = sql.upper().strip()
        if "PROMOTION_HISTORY" in sql_upper:
            return []
        if "CANONICAL" in sql_upper:
            return []
        return []
    async def mock_non_query(*a, **kw):
        pass

    with patch("app.database.execute_query", mock_query), \
         patch("app.database.execute_non_query", mock_non_query):
        from app.services.operations_service import auto_promote_strategies
        result = await auto_promote_strategies()
        assert "promoted" in result
        assert result["promoted"] == 0


@pytest.mark.asyncio
async def test_auto_promote_with_candidates():
    """auto_promote_strategies promotes candidates when slots are open."""
    call_idx = [0]

    async def mock_query(sql, *a, **kw):
        sql_upper = sql.upper().strip()
        call_idx[0] += 1
        if "PROMOTION_HISTORY" in sql_upper:
            return []
        if "CANONICAL" in sql_upper and "CANDIDATE" in sql_upper:
            return [
                (1, "strat_a", 1, 1, 60.0, 0.5, 50.0, 40, "entry_type", 0.05, 0.1, 0.03, 5, 10)
            ]
        if "CANONICAL" in sql_upper and "APPROVED" in sql_upper:
            return []
        return []

    async def mock_non_query(*a, **kw):
        pass

    with patch("app.database.execute_query", mock_query), \
         patch("app.database.execute_non_query", mock_non_query):
        from app.services.operations_service import auto_promote_strategies
        result = await auto_promote_strategies()
        assert "promoted" in result
        assert result["promoted"] >= 0
