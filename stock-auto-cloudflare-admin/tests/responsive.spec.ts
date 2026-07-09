import { test, expect } from '@playwright/test';

test.use({ baseURL: 'https://stock-admin.hjjun1006.workers.dev' })

const RESOLUTIONS = [
  { name: 'Mobile 360x800', width: 360, height: 800 },
  { name: 'Mobile 375x812', width: 375, height: 812 },
  { name: 'Mobile 390x844', width: 390, height: 844 },
  { name: 'Mobile 412x915', width: 412, height: 915 },
  { name: 'Tablet 768x1024', width: 768, height: 1024 },
  { name: 'Tablet 820x1180', width: 820, height: 1180 },
  { name: 'Desktop 1366x768', width: 1366, height: 768 },
  { name: 'Desktop 1440x900', width: 1440, height: 900 },
  { name: 'Desktop 1920x1080', width: 1920, height: 1080 },
];

async function mockAllApis(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ username: 'admin' }),
  }));
  await page.route('**/api/dashboard', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      system: { exposure_pct: 45, cash_ratio_pct: 55, open_positions: 3, sell_trades: 12 },
      portfolio: { total_return: 12.5, mdd: 8.3, sharpe: 1.2, cagr: 15.3, pf_grade: 'A' },
      paper_trading: { win_rate: 62, total_trades: 48, sell_trades: 20, total_return: 8.5, profit_factor: 1.8, open_positions: 3 },
      risk: { blocked: false, status: 'PASS', exposure_pct: 45, cash_ratio: 55, open_positions: 3, mdd: 8.3 },
      generation: { current: 12, last_run: '2026-07-09 10:30', next_scheduled: '2026-07-09 14:30', status: 'idle', population: 50 },
      readiness: { grade: 'PASS', score: 85, passed: 8, total: 10, verdict: 'PASS' },
      validation: { active: true, started_at: '2026-06-09', metrics: { total_return: 5.2, sharpe_ratio: 1.1, win_rate: 58 }, advanced_metrics: { alpha: 0.02, beta: 0.8 }, progress: { progress_pct: 30 } }
    }),
  }));
  await page.route('**/api/logs*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [] }),
  }));
  await page.route('**/api/positions', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([]),
  }));
  await page.route('**/api/trades*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [] }),
  }));
  await page.route('**/api/strategies/top*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [], total: 0 }),
  }));
  await page.route('**/api/evolution/status', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ current_generation: 5, is_running: false, status: 'idle' }),
  }));
  await page.route('**/api/evolution/strategies', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([]),
  }));
  await page.route('**/api/evolution/generations', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([]),
  }));
  await page.route('**/api/risk/check', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ risk_status: 'PASS', blocked: false, total_exposure: 45, cash_ratio: 55, open_positions: 3, portfolio_mdd: 8.3, today_pnl_pct: 0.5, reasons: [] }),
  }));
  await page.route('**/api/risk/settings*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ max_portfolio_allocation: 100, max_position_allocation: 20, daily_loss_limit: 5, daily_profit_lock: 10, risk_mode: 'moderate' }),
  }));
  await page.route('**/api/settings', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ backtest_interval: '1h', evolution_enabled: true, population_size: 50, mutation_rate: 0.1, crossover_rate: 0.7, elite_ratio: 0.2, tournament_size: 5, max_generations: 0, fitness_return_weight: 0.5, fitness_winrate_weight: 0.3, fitness_mdd_penalty: 0.2, mdd_threshold: 20, winrate_threshold: 45, return_threshold: 20 }),
  }));
  await page.route('**/api/validation/status', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ is_active: false }),
  }));
  await page.route('**/api/validation/dashboard', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ active: false }),
  }));
  await page.route('**/api/scheduler/jobs*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ jobs: [] }),
  }));
  await page.route('**/api/scheduler/evolution', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: null, config: null, recent_generations: [] }),
  }));
  await page.route('**/api/portfolio/strategies*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [], total_allocation: 0 }),
  }));
  await page.route('**/api/portfolio/backtest/results*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [] }),
  }));
  await page.route('**/api/paper-trading/status', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ cash: 5000000, total_value: 5500000, invested: 500000, positions_count: 3, total_trades: 10, total_pnl: 500000, broker: 'mock' }),
  }));
  await page.route('**/api/paper-trading/positions', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [] }),
  }));
  await page.route('**/api/paper-trading/trades', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [] }),
  }));
  await page.route('**/api/backtest/configs', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([]),
  }));
}

async function checkOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const errors: string[] = [];
    all.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > document.documentElement.scrollWidth + 1 && rect.width > 10) {
        errors.push(`Overflow right: ${el.tagName}.${el.className} (${rect.right.toFixed(0)} > ${document.documentElement.scrollWidth})`);
      }
    });
    return errors.slice(0, 10);
  });
  return overflow;
}

for (const res of RESOLUTIONS) {
  test.describe(`Resolution: ${res.name}`, () => {
    test.use({ viewport: { width: res.width, height: res.height } });

    test('Login page - no overflow', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Dashboard - no overflow', async ({ page }) => {
      await mockAllApis(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Portfolio - no overflow', async ({ page }) => {
      await mockAllApis(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Portfolio' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(500);
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Evolution - no overflow', async ({ page }) => {
      await mockAllApis(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Evolution' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(500);
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Strategy - no overflow', async ({ page }) => {
      await mockAllApis(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Strategy' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(500);
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Paper Trade - no overflow', async ({ page }) => {
      await mockAllApis(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Paper Trade' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(500);
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Validation - no overflow', async ({ page }) => {
      await mockAllApis(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Validation' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(500);
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Risk - no overflow', async ({ page }) => {
      await mockAllApis(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Risk' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(500);
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Logs - no overflow', async ({ page }) => {
      await mockAllApis(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Logs' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(500);
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Settings - no overflow', async ({ page }) => {
      await mockAllApis(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Settings' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(500);
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Scheduler - no overflow', async ({ page }) => {
      await mockAllApis(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Scheduler' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(500);
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });
  });
}
