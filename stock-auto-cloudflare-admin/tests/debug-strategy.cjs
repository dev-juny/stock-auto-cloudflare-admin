const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  // 모든 요청 로깅
  page.on('request', req => {
    if (req.url().includes('/api/')) console.log('REQ:', req.method(), req.url().substring(0, 130));
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text().substring(0, 200));
  });
  page.on('pageerror', err => console.log('PAGE CRASH:', err.message.substring(0, 200)));

  // sessionStorage에 토큰 설정
  await page.addInitScript(() => {
    sessionStorage.setItem('admin_token', 'mock-jwt-token');
  });

  // API mocking
  const mockStrategyData = {
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
  };

  // Auth
  await page.route('**/api/auth/me', route => {
    console.log('  -> Mocked /api/auth/me');
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, username: 'admin' }),
    });
  });
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 200, body: '{}' }));

  // Dashboard (첫 로딩시 필요)
  await page.route('**/api/dashboard', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      portfolio: { total_return: 12.5, mdd: 8.3, sharpe: 1.2, cagr: 15.3, pf_grade: 'A' },
      paper_trading: { win_rate: 62, total_trades: 48, sell_trades: 20, total_return: 8.5, profit_factor: 1.8, open_positions: 3 },
      risk: { blocked: false, status: 'PASS', exposure_pct: 45, cash_ratio: 55, open_positions: 3, mdd: 8.3 },
      system: { exposure_pct: 45, cash_ratio_pct: 55, open_positions: 3, sell_trades: 12 },
      generation: { current: 12, last_run: '2026-07-09 10:30', next_scheduled: '2026-07-09 14:30', status: 'idle', population: 50 },
      readiness: { grade: 'PASS', score: 85, passed: 8, total: 10, verdict: 'PASS' },
      validation: { active: true, started_at: '2026-06-09' }
    }),
  }));

  // Strategy API - 모든 /api/strategies/top 경로
  await page.route(/\/api\/strategies\/top/, route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    console.log(`  -> Strategies route: ${path}`);
    if (path.endsWith('/top') || path === '/api/strategies/top') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            strategy_id: 101, name: 'TestStrategy_V12', generation: 12, version: 3,
            fitness: 85.42, return_pct: 32.15, win_rate: 62.5, mdd: 8.3,
            profit_factor: 2.15, total_trades: 58, entry_type: 'breakout',
            stop_loss: 0.05, take_profit: 0.15, trailing_stop: 0.03,
            max_concurrent_positions: 3, ranking_candidate_limit: 5,
          }], total: 1
        }),
      });
    }
    if (path.startsWith('/api/strategies/top/')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(mockStrategyData),
      });
    }
    return route.continue();
  });

  // Detail 탭 API들
  await page.route('**/api/risk/check', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      risk_status: 'PASS', blocked: false, portfolio_mdd: 8.3, avg_unrealized_pnl: 1.2,
      today_pnl_pct: 0.5, open_positions: 3, cash_ratio: 55, single_asset_ratio: 15, reasons: []
    }),
  }));
  await page.route('**/api/portfolio/promotion-history*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      items: [
        { id: 1, strategy_id: 101, strategy_name: 'TestStrategy_V12', action: 'promoted', fitness: 85.42, reason: 'High fitness', promoted_at: '2026-07-08T10:30:00Z' },
        { id: 2, strategy_id: 102, strategy_name: 'OldStrategy', action: 'demoted', fitness: 42.1, reason: 'Low win rate', promoted_at: '2026-07-07T14:00:00Z' },
      ], total: 2
    }),
  }));
  await page.route('**/api/validation/status', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      is_active: true, started_at: '2026-06-09T00:00:00Z',
      today: { cumulative_return: 5.2, mdd: 3.1, win_rate: 58.3 }
    }),
  }));
  await page.route('**/api/live-trading/readiness', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      ready: false, checks: [
        { name: 'Minimum Balance', passed: true, actual: 10000000, threshold: 5000000, detail: 'Balance OK' },
        { name: 'Max Drawdown', passed: false, actual: 18.5, threshold: 15, detail: 'Exceeds threshold' },
      ]
    }),
  }));

  await page.goto('https://stock-admin.hjjun1006.workers.dev');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/debug-initial.png' });

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('BODY:', bodyText);

  // Bottom navigation에서 Strategy 찾기
  const navs = page.locator('nav');
  const navCount = await navs.count();
  console.log(`Nav elements: ${navCount}`);

  // Bottom navigation buttons (하단에 있는 버튼들)
  const bottomBtns = page.locator('.fixed.bottom-0 button, nav button, [class*="bottom"] button');
  const bbCount = await bottomBtns.count();
  console.log(`Bottom buttons: ${bbCount}`);

  // 모든 버튼 텍스트 출력
  const allBtns = page.locator('button');
  const total = await allBtns.count();
  for (let i = 0; i < total; i++) {
    const txt = (await allBtns.nth(i).textContent()).trim();
    if (txt) console.log(`  button[${i}]: "${txt.substring(0, 40)}"`);
  }

  // Strategy 버튼 클릭
  const strategyBtn = page.getByText('Strategy', { exact: true });
  await strategyBtn.click();
  await page.waitForTimeout(2000);
  console.log('\n--- Strategy page loaded ---');

  // 전략 행 클릭하여 detail 모달 열기
  const row = page.locator('tbody tr').first();
  const rowCount = await row.count();
  console.log(`Strategy rows: ${rowCount}`);

  if (rowCount > 0) {
    console.log('Clicking strategy row...');
    await row.click();
    await page.waitForTimeout(3000); // API 호출 대기

    await page.screenshot({ path: 'test-results/debug-modal.png' });

    // 모달이 떴는지 확인
    const modalVisible = await page.evaluate(() => {
      const fixed = document.querySelectorAll('.fixed');
      return Array.from(fixed).map(el => ({
        zIndex: getComputedStyle(el).zIndex,
        visible: el.offsetParent !== null,
        text: el.innerText.substring(0, 200)
      }));
    });
    console.log('Modal check:', JSON.stringify(modalVisible, null, 2));

    // 페이지 에러 확인
    const pageErrors = await page.evaluate(() => {
      return window.__playwright_errors || [];
    });
    console.log('Page errors check:', pageErrors);

    // API 응답 확인을 위한 로깅
    console.log('Waiting for detail API calls to complete...');
  }

  // Overflow 체크 (페이지 전체)
  const overflow = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const errors = [];
    all.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > document.documentElement.scrollWidth + 1 && rect.width > 10) {
        const cls = typeof el.className === 'string' ? el.className.substring(0, 80) : String(el.className);
        errors.push(`${el.tagName}.${cls} (${rect.right.toFixed(0)}px > ${document.documentElement.scrollWidth}px)`);
      }
    });
    return errors;
  });
  if (overflow.length > 0) {
    console.log(`\nOverflow errors (${overflow.length}):`);
    overflow.slice(0, 15).forEach(e => console.log('  ', e));
  } else {
    console.log('\nOverflow: NONE');
  }

  await browser.close();
})();
