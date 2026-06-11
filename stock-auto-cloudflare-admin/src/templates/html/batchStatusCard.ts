export const batchStatusCard = `
<div class="card">
  <h3>데이터 적재 현황</h3>
  <div id="batchStatusBody" style="font-size:12px;color:#8b949e">로딩 중...</div>
</div>
<div class="modal-overlay" id="batchLogOverlay">
  <div class="detail-modal-box" style="max-width:600px">
    <div class="detail-modal-header">
      <h3 style="margin:0">적재 로그 상세</h3>
      <button class="modal-close-btn" onclick="document.getElementById('batchLogOverlay').classList.remove('active')">&times;</button>
    </div>
    <div id="batchLogDetailBody" class="detail-modal-body" style="max-height:70vh;overflow-y:auto;white-space:pre-wrap;font-size:12px;color:#c9d1d9"></div>
  </div>
</div>
`;
