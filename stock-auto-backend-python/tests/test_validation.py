import pytest


@pytest.mark.asyncio
async def test_start_validation(db_mocks):
    mq, _mnq = db_mocks

    async def side_effect(sql, *a, **kw):
        su = sql.upper().strip()
        if "SELECT COUNT(*)" in su and "VALIDATION_MODE" in su:
            return [(0,)]  # no active validation
        return [(0,)]

    mq.side_effect = side_effect

    from app.services.operations_service import start_validation
    result = await start_validation()
    assert "message" in result
    assert "started_at" in result


@pytest.mark.asyncio
async def test_get_validation_status_inactive(db_mocks):
    mq, _mnq = db_mocks

    async def side_effect(sql, *a, **kw):
        su = sql.upper().strip()
        # Validation mode query returns no rows
        if "FROM VALIDATION_MODE" in su:
            return []
        return [(0,)]

    mq.side_effect = side_effect

    from app.services.operations_service import get_validation_status
    result = await get_validation_status()
    assert result.get("active") is not None or result.get("is_active") is not None
    assert result.get("is_active") is False


@pytest.mark.asyncio
async def test_check_live_trading_readiness_no_data(db_mocks):
    mq, _mnq = db_mocks

    async def side_effect(sql, *a, **kw):
        su = sql.upper().strip()
        # Validation mode query returns no rows → no active validation
        if "FROM VALIDATION_MODE" in su:
            return []
        return [(0,)]

    mq.side_effect = side_effect

    from app.services.operations_service import check_live_trading_readiness
    result = await check_live_trading_readiness()
    assert result["ready"] is False
    assert "No 30-day validation completed" in result["reason"]
