import random
from .models import EvolutionConfig, StrategyParams, StrategyIndicators, EvolutionStrategy


class StrategyGenerator:
    def __init__(self, config: EvolutionConfig):
        self.config = config

    def generate_random(self, generation: int = 1) -> EvolutionStrategy:
        entry_types = ["momentum", "breakout", "pullback", "hybrid"]
        entry_triggers = ["next_close", "next_open", "intraday", "breakout_confirm"]

        params = StrategyParams(
            entry_type=random.choice(entry_types),
            entry_trigger=random.choice(entry_triggers),
            min_volume=random.choice([100000, 300000, 500000, 1000000, 2000000]),
            max_volatility=random.choice([0.08, 0.10, 0.12, 0.15, 0.20]),
            fixed_take_profit_pct=round(random.uniform(0.03, 0.15), 2),
            break_even_activation_pct=round(random.uniform(0.03, 0.12), 2),
            trailing_activation_pct=round(random.uniform(0.02, 0.08), 2),
            trailing_stop_pct=round(random.uniform(0.01, 0.06), 2),
            stop_loss_pct=round(random.uniform(0.0, 0.10), 2),
            stall_exit_days=random.choice([2, 3, 5, 7, 10]),
            max_concurrent_positions=random.choice([5, 8, 10, 15, 20]),
            ranking_candidate_limit=random.choice([20, 30, 50]),
        )

        indicators = StrategyIndicators(
            use_volume_filter=random.random() > 0.2,
            use_volatility_filter=random.random() > 0.2,
            use_momentum=params.entry_type == "momentum" or random.random() > 0.5,
            use_breakout=params.entry_type == "breakout" or random.random() > 0.5,
            use_pullback=params.entry_type == "pullback" or random.random() > 0.5,
            momentum_period=random.choice([3, 5, 7, 10, 14]),
            breakout_period=random.choice([10, 14, 20, 30]),
            pullback_threshold=round(random.uniform(0.01, 0.05), 2),
        )

        strategy_name = f"Gen{generation}-{params.entry_type[:3].upper()}{random.randint(100,999)}"

        return EvolutionStrategy(
            name=strategy_name,
            generation=generation,
            version=1,
            params=params,
            indicators=indicators,
            tags=[params.entry_type, f"TP{int(params.fixed_take_profit_pct*100)}"],
        )

    def generate_initial_population(self) -> list[EvolutionStrategy]:
        return [self.generate_random(generation=1) for _ in range(self.config.population_size)]
