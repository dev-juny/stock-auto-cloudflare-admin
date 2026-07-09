const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    sessionStorage.setItem('admin_token', 'mock-token');
  });

  await page.route('**/api/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, username: 'admin' }),
  }));
  await page.route('**/api/dashboard', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      portfolio: { total_return: 12.5, mdd: 8.3, sharpe: 1.2, cagr: 15.3, pf_grade: 'A' },
      paper_trading: { win_rate: 62, total_trades: 48 },
      risk: { blocked: false, status: 'PASS', exposure_pct: 45, cash_ratio: 55, open_positions: 3, mdd: 8.3 },
      system: { exposure_pct: 45, cash_ratio_pct: 55, open_positions: 3, sell_trades: 12 },
      generation: { current: 12, last_run: '2026-07-09 10:30', next_scheduled: '2026-07-09 14:30', status: 'idle', population: 50 },
      readiness: { grade: 'PASS', score: 85, passed: 8, total: 10, verdict: 'PASS' },
      validation: { active: true, started_at: '2026-06-09' }
    }),
  }));
  await page.route('**/api/scheduler/jobs*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      jobs: [
        { job_id: 'evolution', job_name: 'Evolution Job', cron_expression: '0 */4 * * *', status: 'idle', next_run_time: '2026-07-09T14:00:00Z', description: 'Evolution cycle' },
        { job_id: 'market_data_sync', job_name: 'Market Data Sync', cron_expression: '0 */6 * * *', status: 'PAUSED', next_run_time: null, latest_trade_date: '2026-07-08' },
        { job_id: 'validation', job_name: 'Validation Run', cron_expression: '0 2 * * *', status: 'idle', next_run_time: '2026-07-10T02:00:00Z' },
      ]
    }),
  }));
  await page.route('**/api/scheduler/evolution', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      status: { current_generation: 12, status: 'idle', last_run_at_kst: '2026-07-09 10:30', next_scheduled_run_kst: '2026-07-09 14:30', population_size: 50, active_strategies: 15 },
      config: { min_generation_interval_hours: 4 },
      recent_generations: [
        { generation: 12, population_size: 50, avg_fitness: 72.5, avg_return: 8.5, avg_winrate: 58.2, avg_mdd: 12.3, created_at_kst: '2026-07-09 10:30' },
        { generation: 11, population_size: 48, avg_fitness: 68.1, avg_return: 7.2, avg_winrate: 55.8, avg_mdd: 13.1, created_at_kst: '2026-07-09 06:00' },
        { generation: 10, population_size: 50, avg_fitness: 65.3, avg_return: 6.8, avg_winrate: 54.1, avg_mdd: 14.5, created_at_kst: '2026-07-09 02:00' },
      ]
    }),
  }));
  await page.route('**/api/strategies/top*', route => route.fulfill({ status: 200, body: JSON.stringify({ items: [], total: 0 }) }));
  await page.route('**/api/logs*', route => route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) }));
  await page.route('**/api/positions', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
  await page.route('**/api/trades*', route => route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) }));
  await page.route('**/api/evolution/*', route => route.fulfill({ status: 200, body: JSON.stringify({}) }));
  await page.route('**/api/risk/check', route => route.fulfill({ status: 200, body: JSON.stringify({}) }));
  await page.route('**/api/risk/settings*', route => route.fulfill({ status: 200, body: JSON.stringify({}) }));
  await page.route('**/api/settings', route => route.fulfill({ status: 200, body: JSON.stringify({}) }));
  await page.route('**/api/validation/*', route => route.fulfill({ status: 200, body: JSON.stringify({}) }));
  await page.route('**/api/portfolio/*', route => route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) }));
  await page.route('**/api/paper-trading/*', route => route.fulfill({ status: 200, body: JSON.stringify({}) }));
  await page.route('**/api/backtest/*', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));

  // 모바일 390x844
  await page.goto('https://stock-admin.hjjun1006.workers.dev');
  await page.waitForTimeout(2000);

  // Scheduler
  await page.getByText('Scheduler').click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'test-results/debug-scheduler-mobile.png', fullPage: false });

  // 각 섹션 위치
  const info = await page.evaluate(() => {
    const main = document.querySelector('main');
    const bottomNav = document.querySelector('.fixed.bottom-0');
    const allCards = document.querySelectorAll('.rounded-2xl');
    return {
      mainBottom: main?.getBoundingClientRect().bottom,
      mainScrollHeight: main?.scrollHeight,
      mainClientHeight: main?.clientHeight,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      docScrollHeight: document.documentElement.scrollHeight,
      docClientHeight: document.documentElement.clientHeight,
      bottomNavTop: bottomNav?.getBoundingClientRect().top,
      bottomNavHeight: bottomNav?.getBoundingClientRect().height,
      cards: Array.from(allCards).map(c => {
        const r = c.getBoundingClientRect();
        return { top: r.top.toFixed(0), bottom: r.bottom.toFixed(0), height: r.height.toFixed(0), text: c.textContent.substring(0, 40) };
      }),
    };
  });
  console.log('Mobile Scheduler:', JSON.stringify(info, null, 2));

  await browser.close();
})();
