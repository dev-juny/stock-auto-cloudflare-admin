import traceback
import asyncio
import random
from datetime import datetime
from .models import EvolutionConfig, EvolutionStrategy, GenerationSummary, MutationResult, CrossoverResult
from .generator import StrategyGenerator
from .fitness import FitnessCalculator
from .selection import StrategySelector
from .mutation import StrategyMutator
from .crossover import StrategyCrossover
from .evaluator import StrategyEvaluator
from .database import (
    save_strategy, save_performance, save_generation, get_strategies,
    get_strategy_by_id, log_history, ensure_evolution_tables, get_strategy_count,
)
from app.database import execute_non_query


class EvolutionEngine:
    def __init__(self, config: EvolutionConfig):
        self.config = config
        self.generator = StrategyGenerator(config)
        self.fitness = FitnessCalculator(config)
        self.selector = StrategySelector(config)
        self.mutator = StrategyMutator(config)
        self.crossover = StrategyCrossover(config)
        self.evaluator = StrategyEvaluator(config)

    async def initialize(self):
        await ensure_evolution_tables()
        count = await get_strategy_count(alive_only=False)
        if count == 0:
            strategies = self.generator.generate_initial_population()
            for s in strategies:
                s.id = await save_strategy(s)
                await log_history(s.id, "CREATED")
            await self.evaluator.evaluate_batch(strategies)

    async def run_generation(self, generation: int, progress_callback=None) -> GenerationSummary:
        try:
            strategies = await get_strategies(generation=generation - 1 if generation > 1 else 1)
            if not strategies and generation == 1:
                strategies = await get_strategies(alive_only=False)
            if not strategies:
                return GenerationSummary(generation=generation, population_size=0, elite_count=0,
                                          avg_fitness=0, best_fitness=0, avg_return=0, avg_winrate=0,
                                          avg_mdd=0, created_at="", mutation_count=0, crossover_count=0)

            tested = [s for s in strategies if s.total_trades > 0]
            elites = self.selector.select_elite(tested) if tested else []
            elite_ids = {s.id for s in elites}

            non_elite_pool = self.selector.select_parents(strategies)
            new_strategies = []

            mutation_count = 0
            crossover_count = 0
            target_new = max(1, self.config.population_size - len(elites))

            for i in range(target_new):
                if progress_callback:
                    await progress_callback(i / target_new * 100)
                if non_elite_pool and random.random() < self.config.crossover_rate and len(non_elite_pool) >= 2:
                    a = self.selector.tournament_select(non_elite_pool)
                    b = self.selector.tournament_select(non_elite_pool)
                    if a.id != b.id:
                        child = self.crossover.crossover(a, b, generation)
                        child.id = await save_strategy(child)
                        await log_history(child.id, "CROSSOVER", parent_id=a.id, details={"parent_b": b.id})
                        crossover_count += 1
                        new_strategies.append(child)

                elif non_elite_pool and random.random() < self.config.mutation_rate:
                    parent = self.selector.tournament_select(non_elite_pool)
                    child = self.mutator.mutate(parent, generation)
                    child.id = await save_strategy(child)
                    await log_history(child.id, "MUTATION", parent_id=parent.id)
                    mutation_count += 1
                    new_strategies.append(child)

                else:
                    child = self.generator.generate_random(generation=generation)
                    child.id = await save_strategy(child)
                    await log_history(child.id, "RANDOM")
                    new_strategies.append(child)

            all_new = new_strategies
            await self.evaluator.evaluate_batch(all_new)
            all_strategies = elites + all_new
            all_fitness = self.fitness.calculate_batch(all_strategies)

            scores = [fs.fitness for fs in all_fitness if fs.fitness != 0]
            returns = [s.total_return for s in all_strategies if s.total_trades > 0]
            winrates = [s.win_rate for s in all_strategies if s.total_trades > 0]
            mdds = [abs(s.max_drawdown) for s in all_strategies if s.total_trades > 0]

            summary = GenerationSummary(
                generation=generation,
                population_size=len(all_strategies),
                elite_count=len(elites),
                avg_fitness=round(sum(scores) / len(scores), 4) if scores else 0,
                best_fitness=max(scores) if scores else 0,
                avg_return=round(sum(returns) / len(returns), 4) if returns else 0,
                avg_winrate=round(sum(winrates) / len(winrates), 2) if winrates else 0,
                avg_mdd=round(sum(mdds) / len(mdds), 4) if mdds else 0,
                created_at=datetime.utcnow().isoformat(),
                mutation_count=mutation_count,
                crossover_count=crossover_count,
            )

            await save_generation(summary)
            return summary
        except Exception as e:
            tb = traceback.format_exc()
            from app.services.service_db import add_system_log
            await add_system_log("error", "evolution_engine", str(e)[:200], {
                "exception_type": type(e).__name__,
                "message": str(e)[:500],
                "stacktrace": tb[-2000:] if tb else "",
                "generation": generation,
            })
            raise
