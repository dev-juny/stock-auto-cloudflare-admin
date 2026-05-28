export const balanceCard = `
<div class="card">
  <h3>💰 계좌 잔고</h3>
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
  </div>
  <button onclick="loadBalance()" style="width:auto;margin-top:1rem;background:#1f6feb">잔고 새로고침</button>
</div>
`;
