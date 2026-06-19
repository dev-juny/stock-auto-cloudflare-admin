import random
from .models import EvolutionConfig, EvolutionStrategy


class StrategySelector:
    def __init__(self, config: EvolutionConfig):
        self.config = config

    def select_elite(self, strategies: list[EvolutionStrategy]) -> list[EvolutionStrategy]:
        sorted_strats = sorted(strategies, key=lambda s: s.fitness_score, reverse=True)
        count = max(1, int(len(strategies) * self.config.elite_ratio))
        elites = sorted_strats[:count]
        for s in elites:
            s.is_elite = True
        return elites

    def tournament_select(self, strategies: list[EvolutionStrategy]) -> EvolutionStrategy:
        candidates = random.sample(strategies, min(self.config.tournament_size, len(strategies)))
        return max(candidates, key=lambda s: s.fitness_score)

    def select_parents(self, strategies: list[EvolutionStrategy]) -> list[EvolutionStrategy]:
        non_elite = [s for s in strategies if not s.is_elite and s.total_trades > 0]
        if not non_elite:
            non_elite = [s for s in strategies if s.total_trades > 0]
        return non_elite
