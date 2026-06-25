import pytest
from unittest.mock import AsyncMock


def get_pf_grade(pf):
    if pf >= 2.0: return "EXCELLENT"
    if pf >= 1.5: return "STRONG"
    if pf >= 1.2: return "GOOD"
    if pf >= 1.0: return "WEAK"
    return "LOSS"


def test_get_pf_grade():
    assert get_pf_grade(0.5) == "LOSS"
    assert get_pf_grade(0.99) == "LOSS"
    assert get_pf_grade(1.0) == "WEAK"
    assert get_pf_grade(1.19) == "WEAK"
    assert get_pf_grade(1.2) == "GOOD"
    assert get_pf_grade(1.49) == "GOOD"
    assert get_pf_grade(1.5) == "STRONG"
    assert get_pf_grade(1.99) == "STRONG"
    assert get_pf_grade(2.0) == "EXCELLENT"
    assert get_pf_grade(100.0) == "EXCELLENT"


@pytest.mark.asyncio
async def test_paper_performance_includes_pf_grade(db_mocks):
    mq, _mnq = db_mocks

    async def side_effect(sql, *a, **kw):
        su = sql.upper().strip()
        # GROUP BY TRUNC → daily PnL map → return empty (no trades)
        if "GROUP BY TRUNC(TRADE_DATE)" in su or "GROUP BY TRUNC(TRADE_DATE)" in su.replace(" ", ""):
            return []
        # All other queries return single zero
        return [(0,)]

    mq.side_effect = side_effect

    from app.services.operations_service import get_paper_performance
    result = await get_paper_performance("ALL")
    assert "pf_grade" in result
    assert "profit_factor" in result
    assert "gross_profit" in result
    assert "gross_loss" in result
    assert "avg_win" in result
    assert "avg_loss" in result
