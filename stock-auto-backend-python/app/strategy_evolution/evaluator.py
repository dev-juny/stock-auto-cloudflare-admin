import asyncio
import concurrent.futures
import numpy as np
from datetime import date, datetime, timedelta
from collections import defaultdict
from typing import Any

from .models import EvolutionConfig, EvolutionStrategy
from .database import save_performance, log_history
from .fitness import FitnessCalculator
from app.services.data_provider import fetch_stock_data, get_all_tickers
from app.database import execute_query


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
        peak = 0.0
        max_dd = 0.0
        gross_profit = 0.0
        gross_loss = 0.0

        for trade in result:
            if 'pnl' in trade:
                pnl = trade['pnl']
                total_pnl += pnl
                trades += 1
                if pnl > 0:
                    wins += 1
                    gross_profit += pnl
                else:
                    gross_loss += abs(pnl)
            peak = max(peak, total_pnl)
            dd = peak - total_pnl
            max_dd = max(max_dd, dd)

        if trades == 0:
            return {}

        win_rate = wins / trades * 100
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else (gross_profit / 0.0001)

        return {
            'total_return': round(total_pnl * 100, 4),
            'win_rate': round(win_rate, 2),
            'max_drawdown': round(max_dd, 4),
            'profit_factor': round(profit_factor, 4),
            'total_trades': trades,
        }

    async def evaluate_strategy(self, strategy: EvolutionStrategy) -> dict:
        start_dt = date.today() - timedelta(days=180)
        start_str = start_dt.isoformat()
        end_str = date.today().isoformat()
        tickers = await get_all_tickers()
        np.random.shuffle(tickers)
        sample = tickers[:50]

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
            return {
                'total_return': 0, 'win_rate': 0, 'max_drawdown': 0,
                'profit_factor': 0, 'total_trades': 0,
            }

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

    async def evaluate_batch(self, strategies: list[EvolutionStrategy]):
        for strategy in strategies:
            perf = await self.evaluate_strategy(strategy)
            strategy.total_return = perf['total_return']
            strategy.win_rate = perf['win_rate']
            strategy.max_drawdown = perf['max_drawdown']
            strategy.profit_factor = perf['profit_factor']
            strategy.total_trades = perf['total_trades']

        scores = self.fitness.calculate_batch(strategies)
        for fs in scores:
            await save_performance(fs)
            await log_history(fs.strategy_id, "EVALUATED", details={
                "return": fs.total_return, "winrate": fs.win_rate, "fitness": fs.fitness
            })
