import random
import copy
from .models import EvolutionConfig, EvolutionStrategy


class StrategyMutator:
    def __init__(self, config: EvolutionConfig):
        self.config = config

    def mutate(self, parent: EvolutionStrategy, new_generation: int) -> EvolutionStrategy:
        child = copy.deepcopy(parent)
        child.id = 0
        child.parent_id = parent.id
        child.generation = new_generation
        child.version = parent.version + 1
        child.name = f"Gen{new_generation}-M{random.randint(100,999)}"
        child.fitness_score = 0.0
        child.total_return = 0.0
        child.win_rate = 0.0
        child.max_drawdown = 0.0
        child.profit_factor = 0.0
        child.total_trades = 0
        child.is_alive = True
        child.is_elite = False
        child.tags = parent.tags + ["mutated"]

        mutated_params = []

        if random.random() < self.config.mutation_rate:
            old = child.params.entry_type
            child.params.entry_type = random.choice(["momentum", "breakout", "pullback", "hybrid"])
            if old != child.params.entry_type:
                mutated_params.append("entry_type")

        for attr in ["min_volume", "max_volatility", "fixed_take_profit_pct",
                      "break_even_activation_pct", "trailing_activation_pct",
                      "trailing_stop_pct", "stop_loss_pct", "stall_exit_days",
                      "max_concurrent_positions", "ranking_candidate_limit"]:
            if random.random() < self.config.mutation_rate:
                old = getattr(child.params, attr)
                new = self._mutate_value(attr, old)
                setattr(child.params, attr, new)
                if old != new:
                    mutated_params.append(attr)

        for attr in ["momentum_period", "breakout_period", "pullback_threshold"]:
            if random.random() < self.config.mutation_rate:
                old = getattr(child.indicators, attr)
                new = self._mutate_indicator(attr, old)
                setattr(child.indicators, attr, new)
                if old != new:
                    mutated_params.append(f"indicator_{attr}")

        child.tags = child.tags[:3] + [f"M:{','.join(mutated_params[:3])}"] if mutated_params else child.tags[:3]
        return child

    def _mutate_value(self, attr: str, old_val) -> float | int:
        if isinstance(old_val, int):
            delta = int(old_val * random.uniform(-0.3, 0.3))
            return max(1, old_val + delta)
        delta = old_val * random.uniform(-0.3, 0.3)
        return round(max(0, old_val + delta), 4)

    def _mutate_indicator(self, attr: str, old_val) -> float | int:
        if isinstance(old_val, int):
            delta = random.choice([-3, -2, -1, 1, 2, 3])
            return max(3, min(50, old_val + delta))
        delta = round(random.uniform(-0.01, 0.01), 3)
        return round(max(0.005, min(0.1, old_val + delta)), 3)
