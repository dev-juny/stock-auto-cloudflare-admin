export const strategyCard = `
<div class="card">
  <h3>전략 설정</h3>
  <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:0.75rem">
    <div style="font-size:12px;color:#8b949e">
      <div style="color:#c9d1d9;font-weight:600;margin-bottom:4px">시장 BREADTH</div>
      <div id="breadthDisplay" style="font-size:20px;font-weight:700">--</div>
      <div id="breadthDetail" style="font-size:11px;color:#484f58"></div>
    </div>
    <div style="font-size:12px;color:#8b949e">
      <div style="color:#c9d1d9;font-weight:600;margin-bottom:4px">적용 전략</div>
      <div id="activeConfigName" style="font-size:14px;color:#58a6ff">기본 설정</div>
      <div id="activeConfigDetail" style="font-size:11px;color:#484f58"></div>
    </div>
    <div style="font-size:12px;color:#8b949e">
      <div style="color:#c9d1d9;font-weight:600;margin-bottom:4px">실행 주기</div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <input id="schedulerInterval" type="number" value="60" style="background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:4px 6px;color:#c9d1d9;font-size:13px;width:60px">
        <span style="color:#8b949e">초</span>
        <button class="btn" onclick="updateSchedulerConfig()" style="font-size:11px;padding:3px 10px">적용</button>
      </div>
    </div>
    <div style="font-size:12px;color:#8b949e">
      <div style="color:#c9d1d9;font-weight:600;margin-bottom:4px">BREADTH 하한</div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <input id="breadthThreshold" type="number" value="0.3" step="0.05" min="0" max="1" style="background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:4px 6px;color:#c9d1d9;font-size:13px;width:60px">
        <span style="color:#8b949e">(%이하 진입보류)</span>
      </div>
    </div>
  </div>
  <div id="savedConfigsArea" style="margin-top:8px;border-top:1px solid #21262d;padding-top:8px">
    <div style="font-size:12px;color:#8b949e;margin-bottom:6px">저장된 백테스트 설정</div>
    <div id="savedConfigsList" style="font-size:12px;color:#8b949e">로딩 중...</div>
  </div>
</div>
`;
