const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto('https://stock-admin.hjjun1006.workers.dev');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/debug-login.png' });

  // Mock the auth and strategy data
  await page.route('**/api/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ username: 'admin' }),
  }));

  await page.route('**/api/strategies/top*', (route) => {
    const url = route.request().url();
    if (url.includes('/top/')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          strategy_id: 101, name: 'TestStrategy_V12', generation: 12, version: 3,
          fitness: 85.42, return_pct: 32.15, win_rate: 62.5, mdd: 8.3,
          profit_factor: 2.15, total_trades: 58, entry_type: 'breakout',
          stop_loss: 0.05, take_profit: 0.15, trailing_stop: 0.03,
          max_concurrent_positions: 3, ranking_candidate_limit: 5,
          universe_stocks: [
            { ticker: 'AAPL', name: 'Apple Inc.', market: 'US' },
            { ticker: 'MSFT', name: 'Microsoft Corporation', market: 'US' },
            { ticker: 'GOOGL', name: 'Alphabet Inc.', market: 'US' },
            { ticker: 'AMZN', name: 'Amazon.com Inc.', market: 'US' },
            { ticker: 'TSLA', name: 'Tesla Inc.', market: 'US' },
            { ticker: 'NVDA', name: 'NVIDIA Corporation', market: 'US' },
          ]
        })
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ items: [
        { strategy_id: 101, name: 'TestStrategy_V12', generation: 12, version: 3,
          fitness: 85.42, return_pct: 32.15, win_rate: 62.5, mdd: 8.3,
          profit_factor: 2.15, total_trades: 58, entry_type: 'breakout',
          stop_loss: 0.05, take_profit: 0.15, trailing_stop: 0.03,
          max_concurrent_positions: 3, ranking_candidate_limit: 5 },
      ], total: 1 }),
    });
  });

  await page.goto('https://stock-admin.hjjun1006.workers.dev');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/debug-after-goto.png' });

  // Navigate to strategy tab
  const navButtons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('nav button')).map(b => ({ text: b.textContent.trim(), visible: b.offsetParent !== null }))
  );
  console.log('Nav buttons:', JSON.stringify(navButtons, null, 2));

  const strategyBtn = page.locator('nav button').filter({ hasText: 'Strategy' });
  console.log('Strategy button count:', await strategyBtn.count());

  if (await strategyBtn.count() > 0) {
    await strategyBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/debug-strategy-page.png' });

    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('Strategy page body:', bodyText);

    // Try to click the first row in tbody
    const rows = page.locator('tbody tr');
    console.log('Table rows:', await rows.count());

    if (await rows.count() > 0) {
      await rows.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/debug-detail-open.png' });

      // Check if modal appeared
      const modalVisible = await page.evaluate(() => {
        const fixedEls = document.querySelectorAll('.fixed.inset-0');
        return Array.from(fixedEls).map(el => ({
          visible: el.offsetParent !== null,
          zIndex: getComputedStyle(el).zIndex,
          innerText: el.innerText.substring(0, 200)
        }));
      });
      console.log('Modal check:', JSON.stringify(modalVisible, null, 2));

      // Check overflow
      const overflow = await page.evaluate(() => {
        const all = document.querySelectorAll('*');
        const errors = [];
        all.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > document.documentElement.scrollWidth + 1 && rect.width > 10) {
            errors.push(`${el.tagName}.${el.className} (${rect.right.toFixed(0)} > ${document.documentElement.scrollWidth})`);
          }
        });
        return errors.slice(0, 20);
      });
      console.log('Overflow errors:', JSON.stringify(overflow, null, 2));
    }
  }

  await browser.close();
})();
