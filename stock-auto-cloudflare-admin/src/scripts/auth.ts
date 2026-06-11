export const authJs = `
const API = '';

function getToken() {
  return sessionStorage.getItem('admin_token') || ''
}
function setToken(t) {
  if (t) sessionStorage.setItem('admin_token', t)
  else sessionStorage.removeItem('admin_token')
}
function authFetch(url, opts = {}) {
  const t = getToken()
  const h = opts.headers || {}
  if (t) h['Authorization'] = 'Bearer ' + t
  return fetch(url, { ...opts, headers: h, credentials: 'include' })
}

async function checkSession() {
  const t = getToken()
  if (!t) {
    document.getElementById('loadingScreen').classList.add('hidden')
    document.getElementById('loginScreen').classList.remove('hidden')
    return
  }
  try {
    const r = await authFetch(API + '/api/auth/me')
    if (r.ok) { showDashboard(); return }
  } catch (e) {}
  setToken('')
  document.getElementById('loadingScreen').classList.add('hidden')
  document.getElementById('loginScreen').classList.remove('hidden')
}

var _refreshTimer = 0

function showDashboard() {
  document.getElementById('loadingScreen').classList.add('hidden')
  document.getElementById('loginScreen').classList.add('hidden')
  document.getElementById('appScreen').classList.remove('hidden')
  refreshAll()
  if (_refreshTimer) clearInterval(_refreshTimer)
  _refreshTimer = setInterval(refreshAll, 30000)
}

async function login() {
  const u = document.getElementById('username').value
  const p = document.getElementById('password').value
  try {
    const r = await fetch(API + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
      credentials: 'include',
    })
    const d = await r.json()
    if (d.success) { setToken(d.token); showDashboard() }
    else { document.getElementById('loginMsg').textContent = d.message }
  } catch (e) {
    document.getElementById('loginMsg').textContent = '서버 연결 실패'
  }
}

async function logout() {
  setToken('')
  if (_refreshTimer) clearInterval(_refreshTimer)
  await fetch(API + '/api/auth/logout', { method: 'POST', credentials: 'include' })
  location.reload()
}
`;
