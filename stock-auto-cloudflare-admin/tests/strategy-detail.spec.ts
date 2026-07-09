import { test, expect } from '@playwright/test';

test.use({ baseURL: 'https://stock-admin.hjjun1006.workers.dev' })

const MOBILE_VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
]

const mockStrategy = {
  strategy_id: 101,
  name: 'TestStrategy_V12',
  generation: 12,
  version: 3,
  fitness: 85.42,
  return_pct: 32.15,
  win_rate: 62.5,
  mdd: 8.3,
  profit_factor: 2.15,
  total_trades: 58,
  entry_type: 'breakout',
  stop_loss: 0.05,
  take_profit: 0.15,
  trailing_stop: 0.03,
  max_concurrent_positions: 3,
  ranking_candidate_limit: 5,
  universe_stocks: [
    { ticker: 'AAPL', name: 'Apple Inc.', market: 'US' },
    { ticker: 'MSFT', name: 'Microsoft Corporation', market: 'US' },
    { ticker: 'GOOGL', name: 'Alphabet Inc.', market: 'US' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', market: 'US' },
    { ticker: 'TSLA', name: 'Tesla Inc.', market: 'US' },
    { ticker: 'NVDA', name: 'NVIDIA Corporation', market: 'US' },
  ]
}

async function mockForDetail(page: import('@playwright/test').Page) {
  await page.route('**/api/strategies/top*', (route) => {
    const url = route.request().url()
    if (url.includes('/top/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockStrategy) })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ items: [mockStrategy], total: 1 }),
    })
  })
  await page.route('**/api/risk/check', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ risk_status: 'PASS', blocked: false, total_exposure: 45, cash_ratio: 55, open_positions: 3, portfolio_mdd: 8.3, today_pnl_pct: 0.5, avg_unrealized_pnl: 1.2, reasons: [], single_asset_ratio: 15 }),
  }))
  await page.route('**/api/portfolio/promotion-history*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [
      { id: 1, strategy_id: 101, strategy_name: 'TestStrategy_V12', action: 'promoted', fitness: 85.42, reason: 'High fitness score', promoted_at: '2026-07-08T10:30:00Z' },
      { id: 2, strategy_id: 102, strategy_name: 'OldStrategy_V5', action: 'demoted', fitness: 42.1, reason: 'Low win rate', promoted_at: '2026-07-07T14:00:00Z' },
    ], total: 2 }),
  }))
  await page.route('**/api/validation/status', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ is_active: true, started_at: '2026-06-09T00:00:00Z', today: { cumulative_return: 5.2, mdd: 3.1, win_rate: 58.3 } }),
  }))
  await page.route('**/api/live-trading/readiness', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ready: false, checks: [
      { name: 'Minimum Balance', passed: true, actual: 10000000, threshold: 5000000, detail: 'Account balance exceeds minimum requirement' },
      { name: 'Max Drawdown', passed: false, actual: 18.5, threshold: 15, detail: 'Current drawdown exceeds threshold' },
      { name: 'Win Rate', passed: true, actual: 62.5, threshold: 50, detail: 'Win rate meets minimum requirement' },
    ] }),
  }))
}

async function checkOverflow(page: import('@playwright/test').Page) {
  return await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const errors: string[] = [];
    all.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > document.documentElement.scrollWidth + 1 && rect.width > 10) {
        errors.push(`Overflow: ${el.tagName}.${el.className} (${rect.right.toFixed(0)} > ${document.documentElement.scrollWidth})`);
      }
    });
    return errors.slice(0, 20);
  });
}

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`Strategy Detail - ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Metrics tab - no overflow', async ({ page }) => {
      await mockForDetail(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Strategy' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(1000);

      await page.locator('tbody tr').first().click();
      await page.waitForTimeout(1000);

      const detail = page.locator('.fixed.inset-0.z-50');
      await expect(detail).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: `test-results/strategy-detail-metrics-${vp.name}.png`, fullPage: false });
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Risk tab - no overflow', async ({ page }) => {
      await mockForDetail(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Strategy' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(1000);
      await page.locator('tbody tr').first().click();
      await page.waitForTimeout(1000);

      await page.locator('button').filter({ hasText: 'Risk' }).click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: `test-results/strategy-detail-risk-${vp.name}.png`, fullPage: false });
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Promotion tab - no overflow', async ({ page }) => {
      await mockForDetail(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Strategy' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(1000);
      await page.locator('tbody tr').first().click();
      await page.waitForTimeout(1000);

      await page.locator('button').filter({ hasText: 'Promotion' }).click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: `test-results/strategy-detail-promotion-${vp.name}.png`, fullPage: false });
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Validation tab - no overflow', async ({ page }) => {
      await mockForDetail(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Strategy' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(1000);
      await page.locator('tbody tr').first().click();
      await page.waitForTimeout(1000);

      await page.locator('button').filter({ hasText: 'Validation' }).click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: `test-results/strategy-detail-validation-${vp.name}.png`, fullPage: false });
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });

    test('Readiness tab - no overflow', async ({ page }) => {
      await mockForDetail(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const nav = page.locator('nav button').filter({ hasText: 'Strategy' });
      if (await nav.count() > 0) await nav.click();
      await page.waitForTimeout(1000);
      await page.locator('tbody tr').first().click();
      await page.waitForTimeout(1000);

      await page.locator('button').filter({ hasText: 'Readiness' }).click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: `test-results/strategy-detail-readiness-${vp.name}.png`, fullPage: false });
      const overflow = await checkOverflow(page);
      expect(overflow).toEqual([]);
    });
  });
}
