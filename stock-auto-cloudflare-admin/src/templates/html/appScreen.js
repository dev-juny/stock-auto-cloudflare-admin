import { statusCard } from './statusCard';
import { balanceCard } from './balanceCard';
import { backtestCard } from './backtestCard';
import { strategyCard } from './strategyCard';
import { tradeLogsCard } from './tradeLogsCard';
import { batchStatusCard } from './batchStatusCard';
export const appScreen = `
<div id="sidebarOverlay" class="sidebar-overlay" onclick="closeSidebar()"></div>
<nav id="sidebar" class="sidebar">
  <div class="sidebar-header">메뉴</div>
  <div class="sidebar-nav">
    <button class="sidebar-item active" onclick="navigateTo('dashboard')">📊 대시보드</button>
    <button class="sidebar-item" onclick="navigateTo('backtest')">📈 백테스트</button>
  </div>
</nav>
<div id="appScreen" class="hidden">
  <header>
    <div style="display:flex;align-items:center;gap:12px">
      <button class="hamburger" onclick="toggleSidebar()" aria-label="메뉴 열기">
        <span></span><span></span><span></span>
      </button>
      <h1>제이제이 연구소</h1>
    </div>
    <button onclick="logout()" style="width:auto;background:#30363d">로그아웃</button>
  </header>
  <main>
    <div id="dashboardPage" class="page active">
      ${statusCard}
      ${strategyCard}
      ${batchStatusCard}
      ${balanceCard}
      ${tradeLogsCard}
    </div>
    <div id="backtestPage" class="page">
      ${backtestCard}
    </div>
  </main>
</div>
`;
