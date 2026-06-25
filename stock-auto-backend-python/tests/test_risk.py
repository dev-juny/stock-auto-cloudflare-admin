import pytest


@pytest.mark.asyncio
async def test_check_risk_limits_passes_on_empty_data(db_mocks):
    mq, _mnq = db_mocks

    async def side_effect(sql, *a, **kw):
        su = sql.upper().strip()
        if "SETTING_KEY, SETTING_VALUE, SETTING_TYPE" in su:
            return []  # no risk settings → defaults
        if "COUNT(*) FROM PAPER_POSITIONS" in su:
            return [(0,)]
        if "SUM(PNL_AMT)" in su:
            return [(0,)]
        if "MAX(MDD)" in su:
            return [(0,)]
        return [(0,)]

    mq.side_effect = side_effect

    from app.services.operations_service import check_risk_limits
    result = await check_risk_limits()
    assert result["risk_status"] == "PASS"
    assert result["blocked"] is False
    assert result["reasons"] == []


@pytest.mark.asyncio
async def test_check_risk_limits_blocks_on_loss_limit(db_mocks):
    mq, _mnq = db_mocks

    async def side_effect(sql, *a, **kw):
        su = sql.upper().strip()
        if "SETTING_KEY, SETTING_VALUE, SETTING_TYPE" in su:
            return [("max_daily_loss", "5", "number"),
                    ("max_daily_profit_pct", "10", "number")]
        if "COUNT(*) FROM PAPER_POSITIONS" in su:
            return [(0,)]
        if "SUM(PNL_AMT)" in su:
            return [(-600000,)]
        if "MAX(MDD)" in su:
            return [(0,)]
        return [(0,)]

    mq.side_effect = side_effect

    from app.services.operations_service import check_risk_limits
    result = await check_risk_limits()
    assert result["risk_status"] == "BLOCKED"
    assert result["blocked"] is True
