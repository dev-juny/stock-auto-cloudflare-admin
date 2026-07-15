from datetime import datetime, timezone

from .models import EvolutionConfig, EvolutionStrategy, FitnessScore


class FitnessCalculator:
    def __init__(self, config: EvolutionConfig):
        self.config = config

    def calculate(self, strategy: EvolutionStrategy) -> FitnessScore:
        w_return = self.config.fitness_return_weight
        w_winrate = self.config.fitness_winrate_weight
        w_mdd = self.config.fitness_mdd_penalty

        ret = max(strategy.total_return, -100)
        wr = strategy.win_rate
        mdd = abs(strategy.max_drawdown)

        score = (ret * w_return) + (wr * w_winrate) - (mdd * w_mdd)

        # Walk-forward penalty: strategies unstable across periods get reduced fitness
        wf_stability = getattr(strategy, 'walk_forward_stability', 1.0)
        if wf_stability < 0.5:
            score *= 0.5  # severe penalty
        elif wf_stability < 0.7:
            score *= 0.75  # moderate penalty
        elif wf_stability < 0.9:
            score *= 0.9  # light penalty

        strategy.fitness_score = round(score, 4)

        return FitnessScore(
            strategy_id=strategy.id,
            generation=strategy.generation,
            total_return=strategy.total_return,
            win_rate=strategy.win_rate,
            max_drawdown=strategy.max_drawdown,
            profit_factor=strategy.profit_factor,
            total_trades=strategy.total_trades,
            fitness=strategy.fitness_score,
            walk_forward_stability=wf_stability,
            train_return=getattr(strategy, 'train_return', 0),
            val_return=getattr(strategy, 'val_return', 0),
            calculated_at=str(datetime.now(timezone.utc)),
        )

    def calculate_batch(self, strategies: list[EvolutionStrategy]) -> list[FitnessScore]:
        return [self.calculate(s) for s in strategies if s.total_trades > 0]
