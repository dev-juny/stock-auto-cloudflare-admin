import asyncio
import concurrent.futures
import logging
import numpy as np
from datetime import date, timedelta
from typing import Any

logger = logging.getLogger(__name__)

from .models import EvolutionConfig, EvolutionStrategy, StrategyParams
from .database import (
    get_or_create_generation_universe,
    save_performance,
    log_history,
)
from .fitness import FitnessCalculator
from app.services.data_provider import fetch_stock_data


class StrategyEvaluator:
    def __init__(self, config: EvolutionConfig):
        self.config = config
        self.fitness = FitnessCalculator(config)
        self._pool = concurrent.futures.ThreadPoolExecutor(max_workers=4)

    def _make_bmc(self, strategy: EvolutionStrategy) -> Any:
        p = strategy.params
        from position_manager import BacktestConfig as BMC
        return BMC(
            fixed_take_profit_pct=p.fixed_take_profit_pct,
            break_even_activation_pct=p.break_even_activation_pct,
            trailing_activation_pct=p.trailing_activation_pct,
            trailing_stop_pct=p.trailing_stop_pct,
            stall_exit_days=p.stall_exit_days,
            stop_loss_pct=p.stop_loss_pct,
            min_volume=p.min_volume,
            max_volatility=p.max_volatility,
            ranking_candidate_limit=p.ranking_candidate_limit,
            max_concurrent_positions=p.max_concurrent_positions,
            entry_type=p.entry_type,
            entry_trigger=p.entry_trigger,
            commission=p.commission,
            tax=p.tax,
            slippage=p.slippage,
        )

    def _run_single(self, ticker: str, candles: list[dict], strategy: EvolutionStrategy) -> dict:
        from app.routers.backtest import _run_on_data_sync
        if len(candles) < 30:
            return {}

        bmc = self._make_bmc(strategy)
        try:
            result = _run_on_data_sync(ticker, candles, bmc)
        except Exception:
            return {}
        if not result:
            return {}

        total_pnl = 0.0
        wins = 0
        trades = 0
        peak_equity = 0.0
        max_dd = 0.0
        gross_profit = 0.0
        gross_loss = 0.0
        initial_notional = 1000000.0  # 1M won notional per trade

        for trade in result:
            if 'pnl' in trade:
                pnl = trade['pnl']
                pnl_amt = pnl * initial_notional
                total_pnl += pnl_amt
                trades += 1
                if pnl > 0:
                    wins += 1
                    gross_profit += pnl_amt
                else:
                    gross_loss += abs(pnl_amt)
            # MDD based on equity curve (percentage from peak)
            current_equity = initial_notional + total_pnl
            if current_equity > peak_equity:
                peak_equity = current_equity
            dd_pct = (peak_equity - current_equity) / peak_equity * 100 if peak_equity > 0 else 0
            max_dd = max(max_dd, dd_pct)

        if trades == 0:
            return {}

        win_rate = wins / trades * 100
        profit_factor = gross_profit / gross_loss if gross_loss > 0.001 else (999.0 if gross_profit > 0 else 0.0)

        return_rate_before_fmt = total_pnl / initial_notional * 100

        logger.info(
            "Return calc | initialCapital=%s finalEquity=%s profit=%s returnRate(before)=%s returnRate(after)=%s",
            f"{initial_notional:,.0f}",
            f"{initial_notional + total_pnl:,.0f}",
            f"{total_pnl:,.0f}",
            f"{return_rate_before_fmt:.4f}",
            f"{round(return_rate_before_fmt, 4)}",
        )

        return {
            'total_return': round(return_rate_before_fmt, 4),
            'win_rate': round(win_rate, 2),
            'max_drawdown': round(max_dd, 4),
            'profit_factor': round(profit_factor, 4),
            'total_trades': trades,
        }

    async def _evaluate_on_period(self, strategy: EvolutionStrategy, sample: list[dict], start_str: str, end_str: str) -> dict:
        loop = asyncio.get_event_loop()
        results = []
        for ticker in sample:
            try:
                raw = await fetch_stock_data(ticker["ticker"])
            except Exception:
                continue
            if not raw or len(raw) < 30:
                continue
            candles = [c for c in raw if start_str <= str(c.get("time", "")) <= end_str]
            if len(candles) < 30:
                continue
            result = await loop.run_in_executor(
                self._pool, self._run_single, ticker["ticker"], candles, strategy
            )
            if result:
                results.append(result)
        if not results:
            return {}
        avg_ret = np.mean([r['total_return'] for r in results])
        avg_wr = np.mean([r['win_rate'] for r in results])
        avg_mdd = np.mean([r['max_drawdown'] for r in results])
        avg_pf = np.mean([r['profit_factor'] for r in results])
        total_trades = sum(r['total_trades'] for r in results)
        return {
            'total_return': round(avg_ret, 4),
            'win_rate': round(avg_wr, 2),
            'max_drawdown': round(avg_mdd, 4),
            'profit_factor': round(avg_pf, 4),
            'total_trades': total_trades,
        }

    async def evaluate_strategy(self, strategy: EvolutionStrategy, universe: list[dict] | None = None) -> dict:
        end_str = date.today().isoformat()

        sample = universe
        if sample is None:
            sample = await get_or_create_generation_universe(strategy.generation)

        # Full period evaluation (last 180 days)
        full_start = (date.today() - timedelta(days=180)).isoformat()
        full_result = await self._evaluate_on_period(strategy, sample, full_start, end_str)

        # Walk-forward: train on first 70%, validate on last 30%
        train_end = (date.today() - timedelta(days=54)).isoformat()
        val_start = (date.today() - timedelta(days=160)).isoformat()
        train_result = await self._evaluate_on_period(strategy, sample, full_start, train_end)
        val_result = await self._evaluate_on_period(strategy, sample, val_start, end_str)

        if not full_result:
            return {
                'total_return': 0, 'win_rate': 0, 'max_drawdown': 0,
                'profit_factor': 0, 'total_trades': 0,
                'walk_forward_stability': 0, 'train_return': 0, 'val_return': 0,
            }

        # Calculate walk-forward stability
        train_ret = abs(train_result.get('total_return', 0)) if train_result else 0
        val_ret = abs(val_result.get('total_return', 0)) if val_result else 0
        wf_stability = 1.0
        if train_ret > 0 and val_result:
            ratio = val_ret / max(train_ret, 0.01)
            wf_stability = min(ratio, 2.0) / 2.0  # 1.0 if equal, drops if val underperforms

        full_result['walk_forward_stability'] = round(wf_stability, 4)
        full_result['train_return'] = round(train_result.get('total_return', 0), 4) if train_result else 0
        full_result['val_return'] = round(val_result.get('total_return', 0), 4) if val_result else 0
        return full_result

    async def evaluate_strategy_for_recalc(self, strategy_id: int, generation: int, universe: list[dict]) -> dict:
        """Re-evaluate a single strategy by ID (used for batch recalc)."""
        from app.database import execute_query
        import json as _json
        rows = await execute_query("SELECT params_json FROM strategy_pool WHERE id = :1", [strategy_id])
        if not rows or not rows[0][0]:
            return {}
        raw = rows[0][0]
        try:
            p_dict = _json.loads(raw) if isinstance(raw, str) else _json.loads(raw.read())
        except Exception:
            return {}
        params = StrategyParams(**{k: v for k, v in p_dict.items() if k in StrategyParams.model_fields})
        strat = EvolutionStrategy(
            id=strategy_id,
            generation=generation,
            params=params,
        )
        return await self.evaluate_strategy(strat, universe)

    async def evaluate_batch(self, strategies: list[EvolutionStrategy]):
        if not strategies:
            return
        generation = strategies[0].generation
        universe = await get_or_create_generation_universe(generation)
        for strategy in strategies:
            perf = await self.evaluate_strategy(strategy, universe)
            strategy.total_return = perf['total_return']
            strategy.win_rate = perf['win_rate']
            strategy.max_drawdown = perf['max_drawdown']
            strategy.profit_factor = perf['profit_factor']
            strategy.total_trades = perf['total_trades']
            strategy.walk_forward_stability = perf.get('walk_forward_stability', 1.0)
            strategy.train_return = perf.get('train_return', 0)
            strategy.val_return = perf.get('val_return', 0)

        scores = self.fitness.calculate_batch(strategies)
        for fs in scores:
            await save_performance(fs)
            await log_history(fs.strategy_id, "EVALUATED", details={
                "return": fs.total_return, "winrate": fs.win_rate, "fitness": fs.fitness,
                "wf_stability": fs.walk_forward_stability,
            })
