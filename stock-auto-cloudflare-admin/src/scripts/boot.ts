export const bootJs = `
function refreshAll() { loadHealth(); loadBalance(); loadLogs(); if (typeof loadActivePositions === 'function') loadActivePositions() }

// ── 사이드바 내비게이션 ──
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open')
  document.getElementById('sidebarOverlay').classList.toggle('show')
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('sidebarOverlay').classList.remove('show')
}
function navigateTo(page) {
  document.querySelectorAll('.sidebar-item').forEach(function (el) {
    el.classList.toggle('active', el.getAttribute('onclick').indexOf(page) !== -1)
  })
  document.querySelectorAll('.page').forEach(function (el) {
    el.classList.toggle('active', el.id === page + 'Page')
  })
  closeSidebar()
  if (page === 'dashboard') refreshAll()
}

document.getElementById('loadingScreen').classList.remove('hidden')
document.getElementById('loginScreen').classList.add('hidden')
checkSession()
setInterval(refreshAll, 30000)

document.getElementById('password').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') login()
})
`;
