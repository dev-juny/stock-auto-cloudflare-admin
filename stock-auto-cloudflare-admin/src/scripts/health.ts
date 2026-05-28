export const healthJs = `
async function loadHealth() {
  try {
    const r = await fetch(API + '/api/health', { credentials: 'include' })
    const d = await r.json()
    document.getElementById('hStatus').textContent = d.status === 'ok' ? '정상' : '오류'
    document.getElementById('hUptime').textContent = formatUptime(d.uptime)
    document.getElementById('hDb').textContent = d.db || '--'
  } catch (e) {
    document.getElementById('hStatus').textContent = '연결실패'
  }
}

function formatUptime(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h + '시간 ' + m + '분'
}
`;
