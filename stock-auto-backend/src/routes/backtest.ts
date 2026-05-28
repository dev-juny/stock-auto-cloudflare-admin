import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

interface BacktestConfig {
  fixedTakeProfitPct: number;
  breakEvenActivationPct: number;
  trailingActivationPct: number;
  trailingStopPct: number;
  stallExitDays: number;
}

interface DailyResult {
  day: number;
  price: number;
  highest: number;
  profitPct: number;
  signal: string;
  reason: string;
}

interface BacktestResult {
  config: BacktestConfig;
  entryPrice: number;
  dailyPrices: number[];
  results: DailyResult[];
  exitDay: number | null;
  exitReason: string | null;
  pnl: number;
}

function simulate(config: BacktestConfig, entryPrice: number, dailyPrices: number[]): BacktestResult {
  let highest = entryPrice;
  let holdingDays = 0;
  let isBreakEven = false;
  const results: DailyResult[] = [];
  let exitDay: number | null = null;
  let exitReason: string | null = null;

  for (let i = 0; i < dailyPrices.length; i++) {
    const price = dailyPrices[i];
    holdingDays++;
    if (price > highest) highest = price;

    const profitPct = (price - entryPrice) / entryPrice;
    const peakProfitPct = (highest - entryPrice) / entryPrice;

    let signal = 'HOLD';
    let reason = '';

    // 1. Fixed take profit
    if (profitPct >= config.fixedTakeProfitPct) {
      signal = 'SELL';
      reason = 'take_profit';
    }
    // 2. Trailing stop
    else if (peakProfitPct >= config.trailingActivationPct) {
      const dropRatio = 1 - config.trailingStopPct;
      if (price < highest * dropRatio) {
        signal = 'SELL';
        reason = 'trailing_stop';
      }
    }
    // 3. Break-even stop
    else if (isBreakEven && price <= entryPrice) {
      signal = 'SELL';
      reason = 'break_even';
    }

    // 4. Activate break-even
    if (!isBreakEven && profitPct >= config.breakEvenActivationPct) {
      isBreakEven = true;
    }

    // 5. Stall exit
    if (signal === 'HOLD' && holdingDays >= config.stallExitDays && peakProfitPct < config.trailingActivationPct) {
      signal = 'SELL';
      reason = 'stall_exit';
    }

    results.push({ day: i + 1, price, highest, profitPct, signal, reason });

    if (signal === 'SELL' && exitDay === null) {
      exitDay = i + 1;
      exitReason = reason;
    }
  }

  const lastPrice = exitDay !== null ? dailyPrices[exitDay - 1] : dailyPrices[dailyPrices.length - 1];
  const pnl = (lastPrice - entryPrice) / entryPrice;

  return { config, entryPrice, dailyPrices, results, exitDay, exitReason, pnl };
}

router.post('/api/backtest/simulate', (req: Request, res: Response) => {
  try {
    const { entryPrice, dailyPrices, config: rawConfig } = req.body;

    if (!entryPrice || !dailyPrices || !Array.isArray(dailyPrices) || dailyPrices.length === 0) {
      return res.status(400).json({ error: 'entryPrice와 dailyPrices 배열이 필요합니다.' });
    }

    const config: BacktestConfig = {
      fixedTakeProfitPct: rawConfig?.fixedTakeProfitPct ?? 0.07,
      breakEvenActivationPct: rawConfig?.breakEvenActivationPct ?? 0.07,
      trailingActivationPct: rawConfig?.trailingActivationPct ?? 0.03,
      trailingStopPct: rawConfig?.trailingStopPct ?? 0.03,
      stallExitDays: rawConfig?.stallExitDays ?? 2,
    };

    const result = simulate(config, entryPrice, dailyPrices);
    res.json(result);
  } catch (error) {
    logger.error('백테스트 시뮬레이션 실패', { error: (error as Error).message });
    res.status(500).json({ error: '백테스트 시뮬레이션 중 오류가 발생했습니다.' });
  }
});

export default router;
