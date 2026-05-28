export const balanceJs = `
async function loadBalance() {
  try {
    const r = await authFetch(API + '/api/balance')
    const d = await r.json()
    const out1 = d.output1 || []
    const out2 = d.output2 || {}
    const total = out1.reduce((s, i) => s + Number(i.evlu_amt || 0), 0)
    const pnl = out1.reduce((s, i) => s + Number(i.evlu_pfls_amt || 0), 0)

    document.getElementById('bTotal').textContent = '₩' + Number(total).toLocaleString()
    document.getElementById('bCash').textContent = '₩' + Number(out2[0]?.prvs_rcdl_exc_amt || 0).toLocaleString()
    document.getElementById('bPnl').textContent = (pnl >= 0 ? '+' : '') + Number(pnl).toLocaleString()
    document.getElementById('bPnl').className = pnl >= 0 ? 'val pos-pnl' : 'val neg-pnl'
  } catch (e) {
    document.getElementById('bTotal').textContent = '조회실패'
  }
}
`;
