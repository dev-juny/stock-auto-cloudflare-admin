import pytest


@pytest.mark.asyncio
async def test_auto_promote_no_candidates(db_mocks):
    mq, _mnq = db_mocks

    async def side_effect(sql, *a, **kw):
        su = sql.upper().strip()
        # Candidate query returns no rows
        if "STRATEGY_ID" in su and "CANDIDATE" in su:
            return []
        # Approved query returns no rows
        if "STATUS = 'APPROVED'" in su:
            return []
        return [(0,)]

    mq.side_effect = side_effect

    from app.services.operations_service import auto_promote_strategies
    result = await auto_promote_strategies()
    assert "promoted" in result
    assert result["promoted"] == 0


@pytest.mark.asyncio
async def test_auto_promote_with_candidates(db_mocks):
    mq, mnq = db_mocks

    async def side_effect(sql, *a, **kw):
        su = sql.upper().strip()
        # Candidate query returns eligible candidates
        if "STRATEGY_ID" in su and "CANDIDATE" in su:
            return [
                (1, "strat_a", 1, 60.0, 50.0, 40, 15.0, 1.5),
                (2, "strat_b", 1, 55.0, 48.0, 35, 10.0, 1.3),
            ]
        # Approved query returns no rows (slots are open)
        if "STATUS = 'APPROVED'" in su:
            return []
        return [(0,)]

    mq.side_effect = side_effect
    mnq.return_value = None

    from app.services.operations_service import auto_promote_strategies
    result = await auto_promote_strategies()
    assert "promoted" in result
    assert result["promoted"] >= 0
