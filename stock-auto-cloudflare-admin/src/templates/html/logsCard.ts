export const logsCard = `
<div class="card">
  <h3>📋 거래 로그</h3>
  <div class="log-toolbar">
    <label class="log-check-all"><input type="checkbox" id="selectAll" onchange="toggleSelectAll()"> 전체선택</label>
    <span id="logSelectedCount" class="log-count">0개 선택</span>
    <button id="deleteSelectedBtn" class="log-del-btn" onclick="deleteSelected()">선택삭제</button>
  </div>
  <div id="tradeLogs" style="max-height:300px;overflow-y:auto"><p style="color:#8b949e">로딩 중...</p></div>
</div>
`;
