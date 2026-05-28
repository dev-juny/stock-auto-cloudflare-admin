export const backtestCard = `
<div class="card">
  <h3>백테스트 파라미터</h3>
  <div class="backtest-params">
    <label>익절률 (fixedTakeProfitPct)
      <input id="bt_takeProfit" type="number" value="0.07" step="0.01">
    </label>
    <label>본절 활성화 (breakEvenActivationPct)
      <input id="bt_breakEvenAct" type="number" value="0.07" step="0.01">
    </label>
    <label>트레일링 활성화 (trailingActivationPct)
      <input id="bt_trailAct" type="number" value="0.03" step="0.01">
    </label>
    <label>트레일링 스탑 (trailingStopPct)
      <input id="bt_trailStop" type="number" value="0.03" step="0.01">
    </label>
    <label>정체 청산일 (stallExitDays)
      <input id="bt_stallDays" type="number" value="2" step="1">
    </label>
    <label>순위 후보 제한 (rankingCandidateLimit)
      <input id="bt_rankLimit" type="number" value="30" step="1">
    </label>
    <label>최대 동시 포지션 (maxConcurrentPositions)
      <input id="bt_maxPos" type="number" value="10" step="1">
    </label>
    <label>최소 거래량 (minVolume)
      <input id="bt_minVol" type="number" value="500000" step="10000">
    </label>
    <label>최대 변동성 (maxVolatility)
      <input id="bt_maxVol" type="number" value="0.12" step="0.01">
    </label>
  </div>
</div>

<div class="card">
  <h3>시뮬레이션</h3>
  <div class="backtest-form">
    <label>진입 가격
      <input id="bt_entryPrice" type="number" step="1" placeholder="10000">
    </label>
  </div>
  <div style="margin-bottom:8px;font-size:12px;color:#8b949e">일별 가격 추가</div>
  <div id="btPriceList" class="price-inputs"></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn" onclick="addPriceInput()">+ 가격 추가</button>
    <button class="btn" onclick="runBacktest()">시뮬레이션 실행</button>
  </div>
</div>

<div class="card" id="btResult" style="min-height:200px">
  <p style="color:#8b949e;font-size:14px">가격을 추가하고 시뮬레이션을 실행하세요.</p>
</div>

<div class="card">
  <h3>코스피 백테스트</h3>
  <div class="scan-section">
    <h4>단일 종목</h4>
    <div class="scan-ticker-row">
      <label>종목코드
        <input id="btScanTicker" type="text" placeholder="005930" maxlength="6" style="width:80px">
      </label>
      <label>진입일자
        <input id="btEntryDate" type="date" style="width:140px">
      </label>
      <button class="btn" onclick="runTickerBacktest()">시뮬레이션 실행</button>
    </div>
  </div>
  <div class="scan-section">
    <h4>코스피 전체 스캔</h4>
    <p style="font-size:12px;color:#8b949e;margin:0 0 8px">모든 코스피 종목의 5년치 데이터로 PositionManager 청산 신호를 탐지합니다. (수 분 소요)</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn" id="btnStartScan" onclick="startKospiScan()">스캔 시작</button>
    </div>
    <div id="scanProgress" class="hidden" style="margin-top:8px">
      <div class="scan-progress">
        <span id="scanProgressLabel">0%</span>
        <div class="scan-progress-bar"><div class="scan-progress-fill" id="scanProgressFill"></div></div>
      </div>
      <div class="scan-status-text" id="scanStatusText">준비 중...</div>
    </div>
  </div>
</div>

<div class="card hidden" id="scanResultsCard">
  <h3>스캔 결과 <span style="font-size:12px;color:#8b949e;font-weight:400" id="scanResultCount"></span></h3>
  <div style="overflow-x:auto">
    <table class="scan-results-table" id="scanResultsTable">
      <thead>
        <tr>
          <th>종목코드</th>
          <th>종목명</th>
          <th>업종</th>
          <th>진입일</th>
          <th>진입가</th>
          <th>청산일</th>
          <th>청산가</th>
          <th>사유</th>
          <th>수익률</th>
          <th>보유일</th>
        </tr>
      </thead>
      <tbody id="scanResultsBody"></tbody>
    </table>
  </div>
</div>
`;
