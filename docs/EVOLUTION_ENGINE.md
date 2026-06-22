# Evolution Engine

## Current evaluation model

The current evolution engine is a parameter optimization engine, not a stock selection AI.

Each strategy evolves trading parameters such as:

- entry type: momentum, breakout, pullback, hybrid
- entry trigger
- minimum volume
- maximum volatility
- take-profit, stop-loss, trailing-stop, and break-even settings
- maximum concurrent positions
- ranking candidate limit

The strategy does not own a stock universe, sector filter, ticker list, or factor-based stock selector.

## Evaluation universe

For each generation, the backend creates one shared evaluation universe from `get_all_tickers()`.

The current universe source is:

1. Load all KOSPI/KOSDAQ tickers.
2. Shuffle them randomly.
3. Store the first 50 tickers as the generation evaluation universe.
4. Evaluate every strategy in that generation against the same stored universe.

This removes the previous fairness issue where each strategy could be evaluated on a different random sample.

The universe is persisted in `evolution_evaluation_universe`:

| Column | Purpose |
| --- | --- |
| `generation` | Generation number |
| `ticker` | Evaluated stock code |
| `name` | Stock name |
| `market` | Market label |
| `sample_order` | Sample order within the universe |
| `selection_source` | Current value is `random_sample` |
| `created_at` | Universe creation timestamp |

## UI behavior

Generation detail shows the stored evaluation universe and the strategies evaluated in that generation.

Holdings, portfolio composition, trade history, and contribution views are not shown as generation evidence because they are not produced by the evaluator. The old seed data should not be interpreted as real generation holdings.

Generation comparison shows both performance delta and evaluation universe delta:

- universe size for each generation
- common ticker count
- tickers only in the later generation
- tickers only in the earlier generation

## Stock Selection Layer extension point

To evolve actual stock selection behavior, add a separate Stock Selection Layer before strategy evaluation.

Suggested contract:

```python
class StockSelectionLayer:
    async def select_universe(
        self,
        generation: int,
        strategy: EvolutionStrategy | None,
        all_tickers: list[dict],
        sample_size: int,
    ) -> list[dict]:
        ...
```

Initial integration point:

- `app.strategy_evolution.database.get_or_create_generation_universe`
- `app.strategy_evolution.evaluator.StrategyEvaluator.evaluate_batch`

Possible selector inputs:

- market: KOSPI, KOSDAQ
- liquidity and turnover
- volatility band
- momentum rank
- drawdown or trend regime
- sector diversification
- fundamentals when available

There are two possible future modes:

- Generation-level selector: every strategy in a generation shares one selected universe for fair comparison.
- Strategy-level selector: each strategy owns stock selection parameters, but evaluation must control for fairness with train/test splits or repeated samples.

The current implementation intentionally uses generation-level random sampling until a real selector is implemented.
