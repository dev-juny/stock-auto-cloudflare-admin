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
`;
