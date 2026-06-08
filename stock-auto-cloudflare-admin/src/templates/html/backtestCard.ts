export const backtestCard = `
<div class="card">
  <h3>백테스트 파라미터</h3>
  <div class="backtest-params">
    <label>익절률 (fixedTakeProfitPct)
      <input id="bt_takeProfit" type="number" value="0.07" step="0.01" onchange="saveParams()">
    </label>
    <label>본절 활성화 (breakEvenActivationPct)
      <input id="bt_breakEvenAct" type="number" value="0.07" step="0.01" onchange="saveParams()">
    </label>
    <label>트레일링 활성화 (trailingActivationPct)
      <input id="bt_trailAct" type="number" value="0.03" step="0.01" onchange="saveParams()">
    </label>
    <label>트레일링 스탑 (trailingStopPct)
      <input id="bt_trailStop" type="number" value="0.03" step="0.01" onchange="saveParams()">
    </label>
    <label>정체 청산일 (stallExitDays)
      <input id="bt_stallDays" type="number" value="2" step="1" onchange="saveParams()">
    </label>
    <label>순위 후보 제한 (rankingCandidateLimit)
      <input id="bt_rankLimit" type="number" value="30" step="1" onchange="saveParams()">
    </label>
    <label>최대 동시 포지션 (maxConcurrentPositions)
      <input id="bt_maxPos" type="number" value="10" step="1" onchange="saveParams()">
    </label>
    <label>최소 거래량 (minVolume)
      <input id="bt_minVol" type="number" value="500000" step="10000" onchange="saveParams()">
    </label>
    <label>최대 변동성 (maxVolatility)
      <input id="bt_maxVol" type="number" value="0.12" step="0.01" onchange="saveParams()">
    </label>
    <label>기준 금액 (baseAmount)
      <input id="bt_baseAmt" type="number" value="1000000" step="100000" onchange="saveParams()">
    </label>
  </div>
</div>

<div class="card">
  <h3>백테스트 실행</h3>
  <div class="backtest-form">
    <label>시작일
      <input id="btStartDate" type="date">
    </label>
    <label>종료일
      <input id="btEndDate" type="date">
    </label>
  </div>
  <p style="font-size:12px;color:#8b949e;margin:0 0 8px">선택한 기간의 모든 종목 데이터로 백테스트를 실행합니다. (수 분 소요)</p>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <button class="btn" id="btnStartScan" onclick="runBacktestRange()">백테스트 실행</button>
    <button class="btn btn-danger" id="btnLoadData" onclick="loadAllStockData()">데이터 적재</button>
  </div>
  <div id="scanProgress" class="hidden" style="margin-top:8px">
    <div class="scan-progress">
      <span id="scanProgressLabel">0%</span>
      <div class="scan-progress-bar"><div class="scan-progress-fill" id="scanProgressFill"></div></div>
    </div>
    <div class="scan-status-text" id="scanStatusText">준비 중...</div>
  </div>
</div>

<div class="card hidden" id="scanResultsCard">
  <h3>백테스트 결과 <span style="font-size:12px;color:#8b949e;font-weight:400" id="scanResultCount"></span></h3>
  <div class="stats-bar hidden" id="statsBar">
    <div class="stat-item"><span class="stat-label">승률</span><span class="stat-val" id="statsWinRate">-</span></div>
    <div class="stat-item"><span class="stat-label">평균승리</span><span class="stat-val" id="statsAvgWin">-</span></div>
    <div class="stat-item"><span class="stat-label">평균손실</span><span class="stat-val" id="statsAvgLoss">-</span></div>
    <div class="stat-item"><span class="stat-label">Profit Factor</span><span class="stat-val" id="statsProfitFactor">-</span></div>
    <div class="stat-item"><span class="stat-label">총수익률</span><span class="stat-val" id="statsTotalReturn">-</span></div>
    <div class="stat-item"><span class="stat-label">총수익금</span><span class="stat-val" id="statsTotalProfit">-</span></div>
    <div class="stat-item"><span class="stat-label">최고수익</span><span class="stat-val" id="statsBestTrade">-</span></div>
    <div class="stat-item"><span class="stat-label">최대손실</span><span class="stat-val" id="statsWorstTrade">-</span></div>
  </div>
  <div class="results-tab-bar">
    <button class="results-tab active" data-view="signals">신호</button>
    <button class="results-tab" data-view="portfolio">포트폴리오</button>
  </div>
  <div class="results-view active" id="resultsViewSignals">
    <div style="overflow-x:auto">
      <table class="scan-results-table" id="scanResultsTable">
        <thead>
          <tr>
            <th>종목코드</th>
            <th>종목명</th>
            <th>구분</th>
            <th>업종</th>
            <th>진입일</th>
            <th>진입가</th>
            <th>청산일</th>
            <th>청산가</th>
            <th>사유</th>
            <th>수익률</th>
            <th>수익금</th>
            <th>보유일</th>
            <th>상세</th>
          </tr>
        </thead>
        <tbody id="scanResultsBody"></tbody>
      </table>
    </div>
    <div class="pagination-bar hidden" id="paginationBar">
      <div class="pagination-controls">
        <button class="btn-pagination" id="btnPrevPage" onclick="changePage(-1)">이전</button>
        <span id="pageIndicator">1</span>
        <button class="btn-pagination" id="btnNextPage" onclick="changePage(1)">다음</button>
      </div>
      <div id="paginationInfo" class="pagination-info"></div>
    </div>
  </div>
  <div class="results-view" id="resultsViewPortfolio">
    <div id="portfolioContent" style="overflow-x:auto"></div>
  </div>
</div>

<div id="detailModalOverlay" class="modal-overlay" onclick="if(event.target===this)closeDetailView()">
  <div class="detail-modal-box">
    <div class="detail-modal-header">
      <h3 id="detailModalTitle" style="margin:0"></h3>
      <button class="modal-close-btn" onclick="closeDetailView()">&times;</button>
    </div>
    <div id="detailModalBody" class="detail-modal-body">
      <div class="detail-modal-stats" id="detailModalStats"></div>
      <div class="detail-tab-bar">
        <button class="detail-tab active" data-tab="chart">차트</button>
        <button class="detail-tab" data-tab="grid">거래내역</button>
      </div>
      <div class="detail-tab-content">
        <div class="detail-tab-pane active" id="detailTabChart">
          <div class="detail-modal-chart" id="detailChart"></div>
        </div>
        <div class="detail-tab-pane" id="detailTabGrid">
          <div class="detail-modal-grid" id="detailModalGrid"></div>
        </div>
      </div>
    </div>
  </div>
</div>
`;
