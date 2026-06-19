from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EvolutionConfig(BaseModel):
    population_size: int = 50
    elite_ratio: float = 0.2
    mutation_rate: float = 0.3
    crossover_rate: float = 0.4
    tournament_size: int = 5
    max_generations: int = 100
    fitness_return_weight: float = 0.5
    fitness_winrate_weight: float = 0.3
    fitness_mdd_penalty: float = 0.2
    min_generation_interval_hours: float = 1.0
    elite_preserve_count: int = 5
    evolution_enabled: bool = True
    mdd_threshold: float = 10.0
    winrate_threshold: float = 45.0
    return_threshold: float = 0.0

    @classmethod
    def from_settings_dict(cls, d: dict) -> EvolutionConfig:
        interval_map = {"30m": 0.5, "1h": 1, "4h": 4, "1d": 24}
        raw_interval = d.get("backtest_interval", "1h")
        interval_hours = interval_map.get(raw_interval, 1)
        return cls(
            population_size=int(d.get("population_size", 50)),
            elite_ratio=float(d.get("elite_ratio", 0.2)),
            mutation_rate=float(d.get("mutation_rate", 0.3)),
            crossover_rate=float(d.get("crossover_rate", 0.4)),
            tournament_size=int(d.get("tournament_size", 5)),
            max_generations=int(d.get("max_generations", 100)),
            fitness_return_weight=float(d.get("fitness_return_weight", 0.5)),
            fitness_winrate_weight=float(d.get("fitness_winrate_weight", 0.3)),
            fitness_mdd_penalty=float(d.get("fitness_mdd_penalty", 0.2)),
            min_generation_interval_hours=interval_hours,
            evolution_enabled=bool(d.get("evolution_enabled", True)),
            mdd_threshold=float(d.get("mdd_threshold", 10.0)),
            winrate_threshold=float(d.get("winrate_threshold", 45.0)),
            return_threshold=float(d.get("return_threshold", 0.0)),
        )


class StrategyParams(BaseModel):
    entry_type: str = "momentum"
    entry_trigger: str = "next_close"
    min_volume: int = 500000
    max_volatility: float = 0.12
    fixed_take_profit_pct: float = 0.07
    break_even_activation_pct: float = 0.07
    trailing_activation_pct: float = 0.03
    trailing_stop_pct: float = 0.03
    stop_loss_pct: float = 0.0
    stall_exit_days: int = 2
    max_concurrent_positions: int = 10
    ranking_candidate_limit: int = 30
    commission: float = 0.0002
    tax: float = 0.0015
    slippage: float = 0.001


class StrategyIndicators(BaseModel):
    use_volume_filter: bool = True
    use_volatility_filter: bool = True
    use_momentum: bool = True
    use_breakout: bool = False
    use_pullback: bool = False
    momentum_period: int = 5
    breakout_period: int = 20
    pullback_threshold: float = 0.02


class EvolutionStrategy(BaseModel):
    id: int = 0
    name: str = ""
    generation: int = 1
    version: int = 1
    parent_id: Optional[int] = None
    params: StrategyParams = Field(default_factory=StrategyParams)
    indicators: StrategyIndicators = Field(default_factory=StrategyIndicators)
    fitness_score: float = 0.0
    total_return: float = 0.0
    win_rate: float = 0.0
    max_drawdown: float = 0.0
    profit_factor: float = 0.0
    total_trades: int = 0
    is_alive: bool = True
    is_elite: bool = False
    created_at: str = ""
    last_test_at: Optional[str] = None
    tags: list[str] = []


class FitnessScore(BaseModel):
    strategy_id: int
    generation: int
    total_return: float
    win_rate: float
    max_drawdown: float
    profit_factor: float
    total_trades: int
    fitness: float
    calculated_at: str


class GenerationSummary(BaseModel):
    generation: int
    population_size: int
    elite_count: int
    avg_fitness: float
    best_fitness: float
    avg_return: float
    avg_winrate: float
    avg_mdd: float
    created_at: str
    created_at_kst: str | None = None
    mutation_count: int
    crossover_count: int


class EvolutionStatus(BaseModel):
    is_running: bool = False
    current_generation: int = 0
    total_generations: int = 0
    last_run_at: Optional[str] = None
    last_run_at_kst: Optional[str] = None
    next_scheduled_run: Optional[str] = None
    next_scheduled_run_kst: Optional[str] = None
    active_strategies: int = 0
    status: str = "idle"
    current_operation: str = ""
    progress_pct: float = 0.0


class MutationResult(BaseModel):
    parent_id: int
    child_id: int
    mutated_params: list[str]
    fitness_parent: float


class CrossoverResult(BaseModel):
    parent_a_id: int
    parent_b_id: int
    child_id: int
    inherited_from_a: list[str]
    inherited_from_b: list[str]
