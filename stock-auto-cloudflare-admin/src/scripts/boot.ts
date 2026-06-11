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
  history.pushState({ page: page }, '', window.location.pathname + '#' + page)
}

window.addEventListener('popstate', function (e) {
  var page = (e.state && e.state.page) || location.hash.replace('#', '') || 'dashboard'
  var el = document.querySelector('.sidebar-item[onclick*="' + page + '"]')
  if (el) navigateTo(page)
})

// Override initial page load to set state
document.addEventListener('DOMContentLoaded', function () {
  var page = location.hash.replace('#', '') || 'dashboard'
  history.replaceState({ page: page }, '', window.location.pathname + '#' + page)
})

document.getElementById('loadingScreen').classList.remove('hidden')
document.getElementById('loginScreen').classList.add('hidden')
checkSession()

document.getElementById('password').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') login()
})

window.addEventListener('unhandledrejection', function (e) {
  if (e.reason && e.reason.message && e.reason.message.indexOf('message channel closed') !== -1) {
    e.preventDefault()
  }
})
window.addEventListener('error', function (e) {
  if (e.message && e.message.indexOf('message channel closed') !== -1) {
    e.preventDefault()
  }
})
`;
