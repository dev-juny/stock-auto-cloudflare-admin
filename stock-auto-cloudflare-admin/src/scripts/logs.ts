export const logsJs = `
async function loadLogs() {
  try {
    const r = await authFetch(API + '/api/logs?limit=50')
    const logs = await r.json()
    const el = document.getElementById('tradeLogs')
    if (!logs.length) { el.innerHTML = '<p style="color:#8b949e">로그 없음</p>'; return }
    el.innerHTML = logs.map(function (l) {
      return '<div class="log-entry">' +
        '<input type="checkbox" class="log-check" value="' + l.LOG_ID + '">' +
        '<span class="log-body">' +
        '<span style="color:#8b949e">' + new Date(l.CREATED_AT).toLocaleString() + '</span> ' +
        '<span class="badge ' + (l.LOG_LEVEL === 'ERROR' ? 'off' : 'on') + '">' + l.LOG_LEVEL + '</span> ' +
        '<span>' + l.SOURCE + '</span> — ' +
        l.MESSAGE +
        (l.CONTEXT ? ' <span style="color:#8b949e">' + l.CONTEXT + '</span>' : '') +
        '</span></div>'
    }).join('')
    updateSelectedCount()
  } catch (e) { /* ignore */ }
}

function toggleSelectAll() {
  var checked = document.getElementById('selectAll').checked
  var boxes = document.querySelectorAll('.log-check')
  for (var i = 0; i < boxes.length; i++) boxes[i].checked = checked
  updateSelectedCount()
}

function updateSelectedCount() {
  var checked = document.querySelectorAll('.log-check:checked').length
  document.getElementById('logSelectedCount').textContent = checked + '개 선택'
  document.getElementById('deleteSelectedBtn').disabled = checked === 0
}

async function deleteSelected() {
  var boxes = document.querySelectorAll('.log-check:checked')
  if (!boxes.length) return
  var ids = []
  for (var i = 0; i < boxes.length; i++) ids.push(boxes[i].value)

  var ok = await showConfirm(ids.length + '개 로그를 삭제하시겠습니까?')
  if (!ok) return

  try {
    var deleted = 0
    for (var i = 0; i < ids.length; i++) {
      var r = await authFetch(API + '/api/logs/' + ids[i], { method: 'DELETE' })
      var d = await r.json()
      if (d.success) deleted++
    }
    loadLogs()
    showAlert(deleted + '개 로그가 삭제되었습니다.')
  } catch (e) {
    showAlert('삭제 중 오류 발생')
  }
}

// 체크 변경 시 카운트 + 하이라이트 갱신
document.addEventListener('change', function (e) {
  if (e.target.classList.contains('log-check')) {
    e.target.closest('.log-entry').classList.toggle('log-entry-selected', e.target.checked)
    updateSelectedCount()
  }
})
`;
