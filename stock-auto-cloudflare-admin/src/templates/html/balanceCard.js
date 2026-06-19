export const balanceCard = `
<div class="card">
  <h3>계좌 잔고</h3>
  <div class="grid">
    <div class="stat">
      <div class="val" id="bTotal">--</div>
      <div class="label">총평가금액</div>
    </div>
    <div class="stat">
      <div class="val" id="bCash">--</div>
      <div class="label">예수금</div>
    </div>
    <div class="stat">
      <div class="val" id="bPnl">--</div>
      <div class="label">당일손익</div>
    </div>
    <div class="stat">
      <div class="val" id="bGrandTotal">--</div>
      <div class="label">총계좌잔고</div>
    </div>
  </div>
  <div id="holdingsArea" style="margin-top:12px;border-top:1px solid #21262d;padding-top:8px;display:none">
    <div style="font-size:12px;color:#c9d1d9;font-weight:600;margin-bottom:6px">보유 종목</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div id="holdingsPieChart" style="flex-shrink:0"></div>
      <div id="holdingsLegend" style="flex:1;min-width:140px;font-size:11px"></div>
    </div>
    <div id="holdingsTableWrap" style="overflow-x:auto;margin-top:8px">
      <table style="width:100%;font-size:11px;border-collapse:collapse">
        <thead><tr style="color:#484f58;border-bottom:1px solid #21262d">
          <th style="text-align:left;padding:4px 6px">종목</th>
          <th style="text-align:right;padding:4px 6px">수량</th>
          <th style="text-align:right;padding:4px 6px">매입가</th>
          <th style="text-align:right;padding:4px 6px">현재가</th>
          <th style="text-align:right;padding:4px 6px">평가금액</th>
          <th style="text-align:right;padding:4px 6px">손익</th>
          <th style="text-align:right;padding:4px 6px">수익률</th>
        </tr></thead>
        <tbody id="holdingsBody"></tbody>
      </table>
    </div>
  </div>
  <button onclick="loadBalance()" style="width:auto;margin-top:1rem;background:#1f6feb">잔고 새로고침</button>
</div>

<div class="modal-overlay" id="tradeDetailOverlay">
  <div class="detail-modal-box" style="max-width:500px;height:auto;max-height:80vh">
    <div class="detail-modal-header">
      <h3 style="margin:0" id="tradeDetailTitle">거래 내역</h3>
      <button class="modal-close-btn" onclick="document.getElementById('tradeDetailOverlay').classList.remove('active')">&times;</button>
    </div>
    <div id="tradeDetailBody" class="detail-modal-body" style="max-height:70vh;overflow-y:auto;font-size:12px;color:#c9d1d9;padding:1rem 0"></div>
  </div>
</div>`;
