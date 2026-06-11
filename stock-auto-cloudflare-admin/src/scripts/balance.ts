export const balanceJs = `
async function loadBalance() {
  if (!getToken()) return
  try {
    const r = await authFetch(API + '/api/balance')
    const d = await r.json()
    const out1 = d.output1 || []
    const out2 = d.output2 || {}
    const total = out1.reduce((s, i) => s + Number(i.evlu_amt || 0), 0)
    const pnl = out1.reduce((s, i) => s + Number(i.evlu_pfls_amt || 0), 0)

    document.getElementById('bTotal').textContent = '\u20A9' + Number(total).toLocaleString()
    var cashAmt = Number(out2[0]?.prvs_rcdl_exc_amt || 0)
    document.getElementById('bCash').textContent = '\u20A9' + cashAmt.toLocaleString()
    document.getElementById('bPnl').textContent = (pnl >= 0 ? '+' : '') + Number(pnl).toLocaleString()
    document.getElementById('bPnl').className = pnl >= 0 ? 'val pos-pnl' : 'val neg-pnl'
    document.getElementById('bGrandTotal').textContent = '\u20A9' + (total + cashAmt).toLocaleString()

    var area = document.getElementById('holdingsArea')
    var body = document.getElementById('holdingsBody')
    if (!area || !body) return
    area.style.display = ''
    var items = out1.filter(function (i) { return Number(i.evlu_amt || 0) > 0 })
    renderPieChart(items, total + cashAmt)
    if (items.length === 0) {
      body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#484f58;padding:2rem">보유 종목이 없습니다</td></tr>'
    } else {
      body.innerHTML = items.map(function (i) {
      var code = i.pdno || ''
      var name = i.prdt_name || code
      var qty = Number(i.hldg_qty || 0)
      var avgPx = Number(i.pchs_avg_pric || 0)
      var curPx = Number(i.prpr || 0)
      var evlu = Number(i.evlu_amt || 0)
      var profit = Number(i.evlu_pfls_amt || 0)
      var pct = Number(i.pfls_rt || 0)
      var pnlCls = profit >= 0 ? 'pos-pnl' : 'neg-pnl'
      return '<tr class="holding-row" data-code="' + code + '" data-name="' + name.replace(/"/g, '') + '" style="border-bottom:1px solid #21262d;cursor:pointer">' +
        '<td style="padding:6px"><div>' + name + '</div><div style="font-size:10px;color:#484f58">' + code + '</div></td>' +
        '<td style="padding:6px;text-align:right">' + qty.toLocaleString() + '</td>' +
        '<td style="padding:6px;text-align:right">' + avgPx.toLocaleString() + '</td>' +
        '<td style="padding:6px;text-align:right">' + curPx.toLocaleString() + '</td>' +
        '<td style="padding:6px;text-align:right">' + evlu.toLocaleString() + '</td>' +
        '<td style="padding:6px;text-align:right;color:' + (profit >= 0 ? '#3fb950' : '#f85149') + '">' + (profit >= 0 ? '+' : '') + profit.toLocaleString() + '</td>' +
        '<td style="padding:6px;text-align:right;color:' + (profit >= 0 ? '#3fb950' : '#f85149') + '">' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%</td>' +
        '</tr>'
      }).join('')
    }
  } catch (e) {
    document.getElementById('bTotal').textContent = '\uC870\uD68C\uC2E4\uD328'
  }
}

function renderPieChart(items, grandTotal) {
  var chartEl = document.getElementById('holdingsPieChart')
  var legendEl = document.getElementById('holdingsLegend')
  if (!chartEl || !legendEl) return
  var total = items.reduce(function (s, i) { return s + Number(i.evlu_amt || 0) }, 0)
  var cx = 80, cy = 80, r = 70, ir = 45
  if (total === 0) {
    chartEl.innerHTML = '<svg width="160" height="160" viewBox="0 0 160 160" style="display:block">' +
      '<circle cx="80" cy="80" r="70" fill="none" stroke="#21262d" stroke-width="50" />' +
      '<circle cx="80" cy="80" r="45" fill="#0d1117" />' +
      '<text x="80" y="77" text-anchor="middle" fill="#c9d1d9" font-size="13" font-weight="700">\u20A9' + (grandTotal || 0).toLocaleString() + '</text>' +
      '<text x="80" y="90" text-anchor="middle" fill="#8b949e" font-size="9">\uCD1D \uACC4\uC88C\uC794\uACE0</text>' +
      '</svg>'
    legendEl.innerHTML = '<div style="color:#484f58;font-size:11px;padding:8px 0">\uBCF4\uC720 \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</div>'
    return
  }
  var colors = ['#f0883e','#58a6ff','#3fb950','#bc8cff','#f85149','#79c0ff','#d2a8ff','#ff7b72','#a5d6ff','#ffa657','#7ee787','#e3b341']
  var cx = 80, cy = 80, r = 70, ir = 45
  var paths = [], legend = '', angle = 0
  items.forEach(function (i, idx) {
    var val = Number(i.evlu_amt || 0)
    var pct = val / total
    var a = pct * 360
    if (a >= 360) a = 359.999
    var sr = angle * Math.PI / 180
    var er = (angle + a) * Math.PI / 180
    var sx = cx + r * Math.sin(sr)
    var sy = cy - r * Math.cos(sr)
    var ex = cx + r * Math.sin(er)
    var ey = cy - r * Math.cos(er)
    var large = a > 180 ? 1 : 0
    var c = colors[idx % colors.length]
    var d = 'M' + cx + ',' + cy + ' L' + sx + ',' + sy + ' A' + r + ',' + r + ' 0 ' + large + ',1 ' + ex + ',' + ey + ' Z'
    var isx = cx + ir * Math.sin(sr)
    var isy = cy - ir * Math.cos(sr)
    var iex = cx + ir * Math.sin(er)
    var iey = cy - ir * Math.cos(er)
    var dd = 'M' + isx + ',' + isy + ' A' + ir + ',' + ir + ' 0 ' + large + ',1 ' + iex + ',' + iey + ' Z'
    paths.push('<path d="' + d + '" fill="' + c + '" />')
    paths.push('<path d="' + dd + '" fill="#0d1117" />')
    var name = i.prdt_name || ''
    legend += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span style="width:10px;height:10px;border-radius:2px;background:' + c + ';flex-shrink:0"></span><span style="color:#c9d1d9;font-size:11px">' + name + '</span><span style="margin-left:auto;color:#8b949e;font-size:11px">' + (pct * 100).toFixed(1) + '%</span></div>'
    angle += a
  })
  chartEl.innerHTML = '<svg width="160" height="160" viewBox="0 0 160 160" style="display:block">' +
    paths.join('') +
    '<text x="80" y="77" text-anchor="middle" fill="#c9d1d9" font-size="13" font-weight="700">\u20A9' + total.toLocaleString() + '</text>' +
    '<text x="80" y="90" text-anchor="middle" fill="#8b949e" font-size="9">\uCD1D \uD3C9\uAC00\uAE08\uC561</text>' +
    '</svg>'
  legendEl.innerHTML = legend
}

function showTradeDetail(code, name) {
  document.getElementById('tradeDetailTitle').textContent = name + ' (' + code + ') \uAC70\uB798 \uB0B4\uC5ED'
  var body = document.getElementById('tradeDetailBody')
  body.innerHTML = '<div style="text-align:center;color:#8b949e;padding:2rem">\uB85C\uB529 \uC911...</div>'
  document.getElementById('tradeDetailOverlay').classList.add('active')
  authFetch(API + '/api/backtest/trades?ticker=' + code + '&limit=20')
    .then(function (r) { return r.json() })
    .then(function (list) {
      if (!list || list.length === 0) {
        body.innerHTML = '<div style="text-align:center;color:#8b949e;padding:2rem">\uAC70\uB798 \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</div>'
        return
      }
      var html = '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
        '<thead><tr style="color:#484f58;border-bottom:1px solid #21262d">' +
        '<th style="text-align:left;padding:4px 6px">\uC77C\uC2DC</th>' +
        '<th style="text-align:center;padding:4px 6px">\uAD6C\uBD84</th>' +
        '<th style="text-align:right;padding:4px 6px">\uAC00\uACA9</th>' +
        '<th style="text-align:right;padding:4px 6px">\uC218\uB7C9</th>' +
        '<th style="text-align:left;padding:4px 6px">\uC0AC\uC720</th>' +
        '</tr></thead><tbody>' +
        list.map(function (t) {
          var cls = t.action === 'SELL' ? 'neg-pnl' : 'pos-pnl'
          return '<tr style="border-bottom:1px solid #21262d">' +
            '<td style="padding:4px 6px">' + (t.traded_at || '') + '</td>' +
            '<td style="padding:4px 6px;text-align:center" class="' + cls + '">' + t.action + '</td>' +
            '<td style="padding:4px 6px;text-align:right">' + (t.price ? Number(t.price).toLocaleString() : '') + '</td>' +
            '<td style="padding:4px 6px;text-align:right">' + (t.quantity || '') + '</td>' +
            '<td style="padding:4px 6px">' + (t.reason || '') + '</td>' +
            '</tr>'
        }).join('') +
        '</tbody></table>'
      body.innerHTML = html
    })
    .catch(function () { body.innerHTML = '<div style="text-align:center;color:#f85149;padding:2rem">\uC870\uD68C \uC2E4\uD328</div>' })
}

document.addEventListener('click', function (e) {
  var row = e.target.closest('.holding-row')
  if (row) {
    var code = row.getAttribute('data-code')
    var name = row.getAttribute('data-name') || code
    showTradeDetail(code, name)
  }
})
`;
