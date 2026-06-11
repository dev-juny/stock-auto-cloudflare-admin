export const strategyCard = `
<div class="card">
  <h3>전략 설정</h3>
  <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:0.75rem">
    <div style="font-size:12px;color:#8b949e">
      <div style="color:#c9d1d9;font-weight:600;margin-bottom:4px">시장 BREADTH
        <button class="btn" onclick="refreshBreadth()" style="font-size:10px;padding:1px 8px;margin-left:6px">갱신</button>
      </div>
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
    <div style="font-size:12px;color:#8b949e">
      <div style="color:#c9d1d9;font-weight:600;margin-bottom:4px">BREADTH 상한</div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <input id="breadthUpper" type="number" value="0.7" step="0.05" min="0" max="1" style="background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:4px 6px;color:#c9d1d9;font-size:13px;width:60px">
        <span style="color:#8b949e">(%이상 진입보류)</span>
      </div>
    </div>
  </div>
  <div id="savedConfigsArea" style="margin-top:8px;border-top:1px solid #21262d;padding-top:8px">
    <div style="font-size:12px;color:#8b949e;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px">
      <span>저장된 백테스트 설정</span>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-danger" id="btnDeleteConfigs" onclick="deleteSelectedConfigs()" style="font-size:10px;padding:2px 8px">선택 삭제</button>
      </div>
    </div>
    <div id="savedConfigsList" style="font-size:12px;color:#8b949e;overflow-x:auto">로딩 중...</div>
  </div>
  <div id="configPortfolioArea" style="margin-top:8px;border-top:1px solid #21262d;padding-top:8px;display:none">
    <div style="font-size:12px;color:#8b949e;margin-bottom:6px">전략 포트폴리오 시뮬레이션</div>
    <div id="configPortfolioBody" style="font-size:11px;color:#c9d1d9"></div>
  </div>
</div>

<div class="modal-overlay" id="configDetailOverlay">
  <div class="detail-modal-box" style="max-width:500px;height:auto;max-height:80vh">
    <div class="detail-modal-header">
      <h3 style="margin:0">설정 상세</h3>
      <button class="modal-close-btn" onclick="document.getElementById('configDetailOverlay').classList.remove('active')">&times;</button>
    </div>
    <div id="configDetailBody" class="detail-modal-body" style="max-height:70vh;overflow-y:auto;font-size:12px;color:#c9d1d9;padding:1rem 0;white-space:pre-wrap"></div>
  </div>
</div>`;
