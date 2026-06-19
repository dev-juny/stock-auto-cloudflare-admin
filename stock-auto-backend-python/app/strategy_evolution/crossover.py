import random
import copy
from .models import EvolutionConfig, EvolutionStrategy


class StrategyCrossover:
    def __init__(self, config: EvolutionConfig):
        self.config = config

    def crossover(self, parent_a: EvolutionStrategy, parent_b: EvolutionStrategy, new_generation: int) -> EvolutionStrategy:
        child = EvolutionStrategy(
            name=f"Gen{new_generation}-X{random.randint(100,999)}",
            generation=new_generation,
            version=max(parent_a.version, parent_b.version) + 1,
            parent_id=parent_a.id,
        )
        child.tags = ["crossover"]
        inherited_a = []
        inherited_b = []

        params_a = parent_a.params.model_dump()
        params_b = parent_b.params.model_dump()
        child_params = {}
        for key in params_a:
            if random.random() < 0.5:
                child_params[key] = params_a[key]
                inherited_a.append(key)
            else:
                child_params[key] = params_b[key]
                inherited_b.append(key)
        child.params = type(parent_a.params)(**child_params)

        ind_a = parent_a.indicators.model_dump()
        ind_b = parent_b.indicators.model_dump()
        child_ind = {}
        for key in ind_a:
            if random.random() < 0.5:
                child_ind[key] = ind_a[key]
                inherited_a.append(f"ind_{key}")
            else:
                child_ind[key] = ind_b[key]
                inherited_b.append(f"ind_{key}")
        child.indicators = type(parent_a.indicators)(**child_ind)

        if random.random() < 0.1:
            child.params.entry_type = random.choice(["momentum", "breakout", "pullback", "hybrid"])
            child.tags.append("random_entry")

        child.tags.append(f"A:{len(inherited_a)}/B:{len(inherited_b)}")
        return child
