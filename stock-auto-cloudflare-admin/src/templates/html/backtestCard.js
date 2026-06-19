export const backtestCard = `
<div class="card">
  <h3>백테스트 파라미터</h3>

  <div class="param-section">
    <div class="param-grid param-grid-compact">
      <label><span class="param-tag tag-univ">U</span>최소 일 거래량
        <input id="bt_minVol" type="text" value="500000" onchange="saveParams()" onkeyup="comma(this)" onblur="comma(this)">
      </label>
      <label><span class="param-tag tag-univ">U</span>최대 일 변동성
        <input id="bt_maxVol" type="number" value="0.12" step="0.01" onchange="saveParams()">
      </label>
      <label><span class="param-tag tag-univ">U</span>스크리닝 상위 종목 수
        <input id="bt_rankLimit" type="number" value="30" step="1" onchange="saveParams()">
      </label>
      <label><span class="param-tag tag-pos">P</span>동시 보유 종목 수
        <input id="bt_maxPos" type="number" value="10" step="1" onchange="saveParams()">
      </label>

      <label><span class="param-tag tag-entry">E</span>매수 전략
        <select id="bt_entryType" onchange="saveParams()">
          <option value="momentum">모멘텀</option>
          <option value="breakout">돌파</option>
          <option value="pullback">되돌림</option>
          <option value="hybrid">혼합</option>
          <option value="unknown">미지정</option>
        </select>
      </label>
      <label><span class="param-tag tag-entry">E</span>매수 시점
        <select id="bt_entryTrigger" onchange="saveParams()">
          <option value="next_close">당일 종가</option>
          <option value="next_open">다음일 시가</option>
          <option value="intraday">장중 체결</option>
          <option value="breakout_confirm">돌파 확인 후</option>
        </select>
      </label>
      <label><span class="param-tag tag-cost">C</span>거래 수수료
        <input id="bt_commission" type="number" value="0.0002" step="0.0001" onchange="saveParams()">
      </label>
      <label><span class="param-tag tag-cost">C</span>증권거래세
        <input id="bt_tax" type="number" value="0.0015" step="0.0001" onchange="saveParams()">
      </label>

      <label><span class="param-tag tag-exit">X</span>익절 (고정 수익률)
        <input id="bt_takeProfit" type="number" value="0.07" step="0.01" onchange="saveParams()">
      </label>
      <label><span class="param-tag tag-exit">X</span>본절 전환 (수익률)
        <input id="bt_breakEvenAct" type="number" value="0.07" step="0.01" onchange="saveParams()">
      </label>
      <label><span class="param-tag tag-exit">X</span>트레일링 시작 (수익률)
        <input id="bt_trailAct" type="number" value="0.03" step="0.01" onchange="saveParams()">
      </label>
      <label><span class="param-tag tag-exit">X</span>트레일링 폭 (고점 대비 %)
        <input id="bt_trailStop" type="number" value="0.03" step="0.01" onchange="saveParams()">
      </label>

      <label><span class="param-tag tag-exit">X</span>손절 (고정 손실률)
        <input id="bt_stopLoss" type="number" value="0" step="0.01" onchange="saveParams()">
      </label>
      <label><span class="param-tag tag-exit">X</span>정체 청산 (보유일)
        <input id="bt_stallDays" type="number" value="2" step="1" onchange="saveParams()">
      </label>
      <label><span class="param-tag tag-cost">C</span>슬리피지 (호가차)
        <input id="bt_slippage" type="number" value="0.001" step="0.0001" onchange="saveParams()">
      </label>
      <label><span class="param-tag tag-pos">P</span>1회 매수 금액
        <input id="bt_baseAmt" type="text" value="1000000" onchange="saveParams()" onkeyup="comma(this)" onblur="comma(this)">
      </label>
    </div>
    <div class="param-grid" style="margin-top:6px">
      <label class="param-full"><span class="param-tag tag-entry">E</span>매수 조건
        <textarea id="bt_entryConditions" rows="1" onchange="saveParams()">일 거래량 > 최소 거래량&#10;일 변동성 < 최대 변동성</textarea>
      </label>
    </div>
  </div>

  <button class="btn" onclick="saveParamConfig()" style="font-size:12px;padding:6px 14px">설정 저장</button>
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
  <h3>백테스트 결과 <span style="font-size:12px;color:#8b949e;font-weight:400" id="scanResultCount"></span>
    <button class="btn" onclick="saveCurrentConfig()" style="font-size:11px;padding:2px 10px;margin-left:8px;vertical-align:middle">현재 설정 저장</button>
  </h3>
  <div class="stats-bar hidden" id="statsBar">
    <div class="stats-section">
      <div class="stats-section-label">신호</div>
      <div class="stats-items">
        <div class="stat-item"><span class="stat-label">승률</span><span class="stat-val" id="statsWinRate">-</span></div>
        <div class="stat-item"><span class="stat-label">평균승리</span><span class="stat-val" id="statsAvgWin">-</span></div>
        <div class="stat-item"><span class="stat-label">평균손실</span><span class="stat-val" id="statsAvgLoss">-</span></div>
        <div class="stat-item"><span class="stat-label">수익 팩터</span><span class="stat-val" id="statsProfitFactor">-</span></div>
        <div class="stat-item"><span class="stat-label">최고수익</span><span class="stat-val" id="statsBestTrade">-</span></div>
        <div class="stat-item"><span class="stat-label">최대손실</span><span class="stat-val" id="statsWorstTrade">-</span></div>
      </div>
    </div>
    <div class="stats-section">
      <div class="stats-section-label">포트폴리오</div>
      <div class="stats-items">
        <div class="stat-item"><span class="stat-label">승률</span><span class="stat-val" id="pfWinRate">-</span></div>
        <div class="stat-item"><span class="stat-label">평균승리</span><span class="stat-val" id="pfAvgWin">-</span></div>
        <div class="stat-item"><span class="stat-label">평균손실</span><span class="stat-val" id="pfAvgLoss">-</span></div>
        <div class="stat-item"><span class="stat-label">수익 팩터</span><span class="stat-val" id="pfProfitFactor">-</span></div>
        <div class="stat-item"><span class="stat-label">최고수익</span><span class="stat-val" id="pfBestTrade">-</span></div>
        <div class="stat-item"><span class="stat-label">최대손실</span><span class="stat-val" id="pfWorstTrade">-</span></div>
        <div class="stat-item"><span class="stat-label">총수익률</span><span class="stat-val" id="pfTotalReturn">-</span></div>
        <div class="stat-item"><span class="stat-label">총수익금</span><span class="stat-val" id="pfTotalProfit">-</span></div>
      </div>
    </div>
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

<div id="detailModalOverlay" class="modal-overlay">
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
