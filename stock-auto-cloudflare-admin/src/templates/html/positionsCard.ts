export const positionsCard = `
<div class="card">
  <h3>실전 포지션</h3>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1rem;align-items:end">
    <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#8b949e">
      종목코드
      <input id="posTicker" style="background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:6px 8px;color:#c9d1d9;font-size:13px;width:100px" placeholder="005930">
    </label>
    <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#8b949e">
      진입가
      <input id="posPrice" type="number" style="background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:6px 8px;color:#c9d1d9;font-size:13px;width:100px" placeholder="50000">
    </label>
    <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#8b949e">
      수량
      <input id="posQty" type="number" style="background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:6px 8px;color:#c9d1d9;font-size:13px;width:80px" placeholder="10">
    </label>
    <button class="btn" onclick="addPosition()" style="margin-bottom:0">포지션 추가</button>
    <button class="btn" onclick="loadActivePositions()" style="background:#30363d;margin-bottom:0">새로고침</button>
  </div>
  <table class="active-positions-table">
    <thead>
      <tr>
        <th>종목</th><th>매수가</th><th>현재가</th><th>수익률</th><th>최고가</th><th>보유일</th><th>관리</th>
      </tr>
    </thead>
    <tbody id="positionsBody">
      <tr><td colspan="7" style="color:#8b949e;text-align:center">로딩 중...</td></tr>
    </tbody>
  </table>
</div>
`;
