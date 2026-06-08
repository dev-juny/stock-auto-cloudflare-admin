export const tradeLogsCard = `
<div class="card">
  <h3>거래 로그</h3>
  <div style="display:flex;gap:8px;margin-bottom:0.75rem;align-items:center">
    <button class="btn" onclick="loadTradeLogs()" style="font-size:12px;padding:4px 12px">새로고침</button>
    <span id="tradeLogBreadth" style="font-size:12px;color:#8b949e"></span>
  </div>
  <div style="max-height:300px;overflow-y:auto">
    <table class="active-positions-table" style="font-size:12px">
      <thead>
        <tr><th>일시</th><th>종목</th><th>구분</th><th>가격</th><th>수량</th><th>사유</th></tr>
      </thead>
      <tbody id="tradeLogBody">
        <tr><td colspan="6" style="color:#8b949e;text-align:center">데이터 없음</td></tr>
      </tbody>
    </table>
  </div>
</div>
`;
