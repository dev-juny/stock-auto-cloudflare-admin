export const backtestJs = `
// ── Parameter persistence ──
var PARAM_IDS = ['bt_takeProfit','bt_breakEvenAct','bt_trailAct','bt_trailStop','bt_stallDays','bt_rankLimit','bt_maxPos','bt_minVol','bt_maxVol','bt_baseAmt']

function saveParams() {
  var obj = {}
  PARAM_IDS.forEach(function (id) { obj[id] = document.getElementById(id).value })
  try { localStorage.setItem('bt_params', JSON.stringify(obj)) } catch (e) {}
}

function loadParams() {
  try {
    var raw = localStorage.getItem('bt_params')
    if (!raw) return
    var obj = JSON.parse(raw)
    PARAM_IDS.forEach(function (id) {
      var el = document.getElementById(id)
      if (el && obj[id] !== undefined) el.value = obj[id]
    })
  } catch (e) {}
}

// ── Date range defaults ──
function initDates() {
  var now = new Date()
  var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  var start = new Date(end)
  try {
    var saved = localStorage.getItem('bt_dates')
    if (saved) {
      var d = JSON.parse(saved)
      document.getElementById('btStartDate').value = d.start || ''
      document.getElementById('btEndDate').value = d.end || ''
      return
    }
  } catch (e) {}
  start.setFullYear(start.getFullYear() - 5)
  document.getElementById('btStartDate').value = start.toISOString().slice(0, 10)
  document.getElementById('btEndDate').value = end.toISOString().slice(0, 10)
}

function saveDates() {
  try {
    localStorage.setItem('bt_dates', JSON.stringify({
      start: document.getElementById('btStartDate').value,
      end: document.getElementById('btEndDate').value,
    }))
  } catch (e) {}
}

// ── PositionManager equivalent (client-side) ──
function simulateBacktest(config, entryPrice, dailyPrices) {
  var highest = entryPrice
  var holdingDays = 0
  var isBreakEven = false
  var results = []
  var exitDay = -1
  var exitReason = null
  var exitPrice = null

  for (var i = 0; i < dailyPrices.length; i++) {
    var price = dailyPrices[i]
    holdingDays++

    if (price > highest) highest = price

    var profitPct = (price - entryPrice) / entryPrice
    var peakProfitPct = (highest - entryPrice) / entryPrice

    var signal = 'HOLD'
    var reason = ''

    if (profitPct >= config.fixedTakeProfitPct) {
      signal = 'SELL'; reason = 'take_profit'
    }
    else if (peakProfitPct >= config.trailingActivationPct) {
      var dropRatio = 1 - config.trailingStopPct
      if (price < highest * dropRatio) {
        signal = 'SELL'; reason = 'trailing_stop'
      }
    }
    else if (isBreakEven && price <= entryPrice) {
      signal = 'SELL'; reason = 'break_even'
    }

    if (!isBreakEven && profitPct >= config.breakEvenActivationPct) {
      isBreakEven = true
    }

    if (signal === 'HOLD' && holdingDays >= config.stallExitDays && peakProfitPct < config.trailingActivationPct) {
      signal = 'SELL'; reason = 'stall_exit'
    }

    results.push({
      day: i + 1,
      price: price,
      highest: highest,
      profitPct: profitPct,
      peakProfitPct: peakProfitPct,
      signal: signal,
      reason: reason,
      isBreakEven: isBreakEven,
    })

    if (signal === 'SELL' && exitDay === -1) {
      exitDay = i + 1
      exitReason = reason
      exitPrice = price
    }
  }

  var pnl = exitPrice !== null
    ? ((exitPrice - entryPrice) / entryPrice * 100)
    : ((dailyPrices[dailyPrices.length - 1] - entryPrice) / entryPrice * 100)

  return {
    results: results,
    exitDay: exitDay,
    exitReason: exitReason,
    exitPrice: exitPrice,
    pnl: pnl,
    holdingDays: holdingDays,
    totalDays: dailyPrices.length,
  }
}

var REASON_LABELS = {
  take_profit: '익절',
  trailing_stop: '트레일링 스탑',
  break_even: '본절',
  stall_exit: '시세 정체',
}
var REASON_ABBR = { take_profit: 'TP', trailing_stop: 'TS', break_even: 'BE', stall_exit: 'SE' }

// ── Backtest scan with date range ──
var _scanPollTimer = null

var _pageSize = 50
var _currentPage = 1

function runBacktestRange() {
  saveDates()

  // Parameter validation
  var tp = parseFloat(document.getElementById('bt_takeProfit').value)
  var be = parseFloat(document.getElementById('bt_breakEvenAct').value)
  var ta = parseFloat(document.getElementById('bt_trailAct').value)
  var ts = parseFloat(document.getElementById('bt_trailStop').value)
  var sd = parseInt(document.getElementById('bt_stallDays').value)
  var mv = parseInt(document.getElementById('bt_minVol').value)
  var mvol = parseFloat(document.getElementById('bt_maxVol').value)
  var rl = parseInt(document.getElementById('bt_rankLimit').value)
  var mp = parseInt(document.getElementById('bt_maxPos').value) || 10
  var ba = parseInt(document.getElementById('bt_baseAmt').value) || 1000000

  if (!tp || tp <= 0) { showAlert('익절률은 0보다 커야 합니다.'); return }
  if (!be || be <= 0) { showAlert('본절 활성화는 0보다 커야 합니다.'); return }
  if (!ta || ta <= 0) { showAlert('트레일링 활성화는 0보다 커야 합니다.'); return }
  if (!ts || ts <= 0) { showAlert('트레일링 스탑은 0보다 커야 합니다.'); return }
  if (!sd || sd < 1) { showAlert('정체 청산일은 1일 이상이어야 합니다.'); return }
  if (mv < 0) { showAlert('최소 거래량은 0 이상이어야 합니다.'); return }
  if (!mvol || mvol <= 0 || mvol > 1) { showAlert('최대 변동성은 0~1 사이여야 합니다.'); return }
  if (!rl || rl < 1) { showAlert('순위 후보 제한은 1 이상이어야 합니다.'); return }
  if (!ba || ba < 1) { showAlert('기준 금액은 1원 이상이어야 합니다.'); return }

  var config = {
    fixedTakeProfitPct: tp,
    breakEvenActivationPct: be,
    trailingActivationPct: ta,
    trailingStopPct: ts,
    stallExitDays: sd,
    minVolume: mv,
    maxVolatility: mvol,
    rankingCandidateLimit: rl,
    maxConcurrentPositions: mp,
  }

  window._baseAmt = ba

  var startDate = document.getElementById('btStartDate').value
  var endDate = document.getElementById('btEndDate').value
  if (!startDate || !endDate) { showAlert('시작일과 종료일을 모두 선택하세요.'); return }
  if (startDate >= endDate) { showAlert('종료일은 시작일보다 이후여야 합니다.'); return }

  var pct = function (v) { return (v * 100).toFixed(1) }

  var dateRange = startDate + ' ~ ' + endDate
  var summary =
    '  기간: ' + dateRange + '\\n' +
    '  익절률: ' + pct(tp) + '%  |  본절: ' + pct(be) + '%\\n' +
    '  트레일링: ' + pct(ta) + '% / ' + pct(ts) + '%  |  정체청산: ' + sd + '일\\n' +
    '  최소거래량: ' + mv.toLocaleString() + '  |  최대변동성: ' + pct(mvol) + '%\\n' +
    '  후보제한: ' + rl + '개  |  최대보유: ' + mp + '종목  |  기준금액: ' + ba.toLocaleString() + '원'

  showConfirm('백테스트를 실행하시겠습니까?\\n' + summary).then(function (ok) {
    if (!ok) return

    document.getElementById('btnStartScan').disabled = true
    document.getElementById('btnStartScan').textContent = '백테스트 중...'
    document.getElementById('scanProgress').classList.remove('hidden')
    document.getElementById('scanResultsCard').classList.add('hidden')
    document.getElementById('scanResultsBody').innerHTML = ''
    document.getElementById('paginationBar').classList.add('hidden')

    fetch('/api/backtest/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: 'SCAN',
        config: config,
        start_date: startDate,
        end_date: endDate,
        base_amt: window._baseAmt || 1000000,
      }),
    })
      .then(function (r) { return r.json() })
      .then(function (data) {
        if (_scanPollTimer) clearTimeout(_scanPollTimer)
        startPolling(data.scan_id)
      })
      .catch(function (e) {
        showAlert('백테스트 실패: ' + e.message)
        resetScanButton()
      })
  })
}

function startPolling(scanId) {
  pollScanStatus(scanId)
}

function pollScanStatus(scanId) {
  fetch('/api/backtest/scan/' + scanId)
    .then(function (r) { return r.json() })
    .then(function (data) {
      updateScanProgress(data)
      if (data.status === 'completed') {
        if (_scanPollTimer) clearTimeout(_scanPollTimer)
        _scanPollTimer = null
        renderScanResults(data)
        resetScanButton()
        showAlert('백테스트 완료: ' + (data.completed || 0) + '개 청산 신호 탐지됨')
      } else if (data.status === 'failed') {
        if (_scanPollTimer) clearTimeout(_scanPollTimer)
        _scanPollTimer = null
        showAlert('백테스트 실패: ' + data.message)
        resetScanButton()
      } else {
        _scanPollTimer = setTimeout(function () { pollScanStatus(scanId) }, 2000)
      }
    })
    .catch(function () {
      if (_scanPollTimer) clearTimeout(_scanPollTimer)
      _scanPollTimer = null
      resetScanButton()
    })
}

function updateScanProgress(data) {
  var pct = data.total > 0 ? Math.round(data.processed / data.total * 100) : 0
  document.getElementById('scanProgressFill').style.width = pct + '%'
  document.getElementById('scanProgressLabel').textContent = data.processed + '/' + data.total + ' (' + pct + '%)'
  document.getElementById('scanStatusText').textContent = data.message || '처리 중...'
}

function renderScanResults(data) {
  document.getElementById('scanResultsCard').classList.remove('hidden')

  var results = data.results || []
  results.sort(function (a, b) { return Math.abs(b.pnl) - Math.abs(a.pnl) })

  window._scanResults = results
  window._scanPortfolio = data.portfolio || []
  window._baseAmt = window._baseAmt || 1000000
  _currentPage = 1

  renderStats(results)
  renderPage()
  renderPortfolio()
}

function renderStats(results) {
  var ba = window._baseAmt || 1000000
  var total = results.length
  if (total === 0) {
    document.getElementById('scanResultCount').textContent = '(탐지된 신호 없음)'
    document.getElementById('statsBar').classList.add('hidden')
    return
  }

  var wins = results.filter(function (r) { return r.pnl > 0 })
  var losses = results.filter(function (r) { return r.pnl <= 0 })
  var winRate = total > 0 ? (wins.length / total * 100) : 0
  var avgWin = wins.length > 0 ? wins.reduce(function (s, r) { return s + r.pnl }, 0) / wins.length : 0
  var avgLoss = losses.length > 0 ? losses.reduce(function (s, r) { return s + r.pnl }, 0) / losses.length : 0
  var totalPnl = results.reduce(function (s, r) { return s + r.pnl }, 0)
  var totalProfit = wins.reduce(function (s, r) { return s + r.pnl }, 0)
  var totalLoss = Math.abs(losses.reduce(function (s, r) { return s + r.pnl }, 0))
  var profitFactor = totalLoss > 0 ? (totalProfit / totalLoss) : (totalProfit > 0 ? Infinity : 0)
  var bestPnl = results.reduce(function (m, r) { return Math.max(m, r.pnl) }, -Infinity)
  var worstPnl = results.reduce(function (m, r) { return Math.min(m, r.pnl) }, Infinity)

  document.getElementById('scanResultCount').textContent = '(총 ' + total + '건 | ' + wins.length + '승 ' + losses.length + '패)'
  document.getElementById('statsWinRate').textContent = winRate.toFixed(1) + '%'
  document.getElementById('statsAvgWin').textContent = (avgWin * 100).toFixed(2) + '%'
  document.getElementById('statsAvgLoss').textContent = (avgLoss * 100).toFixed(2) + '%'
  document.getElementById('statsProfitFactor').textContent = profitFactor === Infinity ? '&infin;' : profitFactor.toFixed(2)
  document.getElementById('statsTotalReturn').textContent = (totalPnl * 100).toFixed(2) + '%'
  document.getElementById('statsBestTrade').textContent = (bestPnl * 100).toFixed(2) + '%'
  document.getElementById('statsWorstTrade').textContent = (worstPnl * 100).toFixed(2) + '%'
  document.getElementById('statsTotalProfit').textContent = (totalPnl * ba).toLocaleString() + '원'
  document.getElementById('statsBar').classList.remove('hidden')
}

function renderPage() {
  var results = window._scanResults || []
  var tbody = document.getElementById('scanResultsBody')
  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" style="color:#8b949e;text-align:center">탐지된 청산 신호가 없습니다.</td></tr>'
    document.getElementById('paginationBar').classList.add('hidden')
    return
  }

  var REASON_LABELS_SCAN = {
    take_profit: 'TP',
    trailing_stop: 'TS',
    break_even: 'BE',
    stall_exit: 'SE',
  }

  var totalItems = results.length
  var totalPages = Math.ceil(totalItems / _pageSize) || 1
  if (_currentPage > totalPages) _currentPage = totalPages
  var start = (_currentPage - 1) * _pageSize
  var end = Math.min(start + _pageSize, totalItems)
  var pageItems = results.slice(start, end)

  var ba = window._baseAmt || 1000000
  tbody.innerHTML = pageItems.map(function (r, i) {
    var idx = start + i
    var pnlPct = (r.pnl * 100)
    var pnlClass = pnlPct >= 0 ? 'scan-positive' : 'scan-negative'
    var profitAmt = r.pnl * ba
    var profitClass = profitAmt >= 0 ? 'scan-positive' : 'scan-negative'
    var reason = REASON_LABELS_SCAN[r.exit_reason] || r.exit_reason || '-'
    var exitDate = r.exit_date || '-'
    var exitPrice = r.exit_price ? r.exit_price.toLocaleString() : '-'
    return '<tr>' +
      '<td>' + r.ticker + '</td>' +
      '<td>' + (r.name || '-') + '</td>' +
      '<td>' + (r.market || '-') + '</td>' +
      '<td>' + (r.sector || '-') + '</td>' +
      '<td>' + r.entry_date + '</td>' +
      '<td>' + r.entry_price.toLocaleString() + '</td>' +
      '<td>' + exitDate + '</td>' +
      '<td>' + exitPrice + '</td>' +
      '<td>' + reason + '</td>' +
      '<td class="' + pnlClass + '">' + pnlPct.toFixed(2) + '%</td>' +
      '<td class="' + profitClass + '">' + profitAmt.toLocaleString() + '</td>' +
      '<td>' + r.holding_days + '</td>' +
      '<td><button class="btn btn-detail" data-idx="' + idx + '">상세보기</button></td>' +
      '</tr>'
  }).join('')

  // Pagination info
  document.getElementById('paginationInfo').textContent = end + ' / ' + totalItems
  document.getElementById('pageIndicator').textContent = _currentPage + '/' + totalPages
  document.getElementById('btnPrevPage').disabled = _currentPage <= 1
  document.getElementById('btnNextPage').disabled = _currentPage >= totalPages
  document.getElementById('paginationBar').classList.remove('hidden')
}

function changePage(delta) {
  var results = window._scanResults || []
  var totalPages = Math.ceil(results.length / _pageSize) || 1
  var newPage = _currentPage + delta
  if (newPage < 1 || newPage > totalPages) return
  _currentPage = newPage
  renderPage()
  document.getElementById('scanResultsTable').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ── Portfolio simulation view ──
function renderPortfolio() {
  var portfolio = window._scanPortfolio || []
  var ba = window._baseAmt || 1000000
  var container = document.getElementById('portfolioContent')
  if (!container) return
  if (!portfolio || portfolio.length === 0) {
    container.innerHTML = '<div style="color:#8b949e;text-align:center;padding:2rem">포트폴리오 데이터가 없습니다.</div>'
    return
  }

  var rows = portfolio.map(function (s) {
    var pnlCls = s.pnl_pct >= 0 ? 'scan-positive' : 'scan-negative'
    var holdingsHtml = (s.holdings || []).map(function (h) {
      var cls = 'pos-hold'
      if (h.status === '매수') cls = 'pos-buy'
      else if (h.status === '매도') cls = 'pos-sell'
      else if (h.status === '트레일링') cls = 'pos-trailing'
      else if (h.status === 'BE') cls = 'pos-be'
      var name = h.name || ''
      return '<div class="portfolio-pos">' +
        '<span class="' + cls + '">' + h.ticker + '</span>' +
        ' <span style="color:#8b949e">' + name + '</span>' +
        ' <span style="color:#484f58">|</span> 진입가 ' + h.entry_price.toLocaleString() +
        ' <span class="' + cls + '">' + h.status + '</span>' +
        '</div>'
    }).join('')

    return '<tr>' +
      '<td>' + s.date + '</td>' +
      '<td>' + (s.positions_count || 0) + '</td>' +
      '<td>' + holdingsHtml + '</td>' +
      '<td>' + s.cash.toLocaleString() + '</td>' +
      '<td>' + s.total_value.toLocaleString() + '</td>' +
      '<td class="' + pnlCls + '">' + (s.pnl_pct * 100).toFixed(2) + '%</td>' +
      '<td class="' + pnlCls + '">' + s.pnl_amt.toLocaleString() + '</td>' +
      '</tr>'
  }).join('')

  var last = portfolio[portfolio.length - 1]
  container.innerHTML = [
    '<div class="portfolio-summary">',
      '<span class="ps-item">기준금액: <strong>' + ba.toLocaleString() + '원</strong></span>',
      '<span class="ps-item">최종수익률: <strong style="color:' + (last.pnl_pct >= 0 ? '#3fb950' : '#f85149') + '">' + (last.pnl_pct * 100).toFixed(2) + '%</strong></span>',
      '<span class="ps-item">최종수익금: <strong style="color:' + (last.pnl_amt >= 0 ? '#3fb950' : '#f85149') + '">' + last.pnl_amt.toLocaleString() + '원</strong></span>',
      '<span class="ps-item">총거래일: <strong>' + portfolio.length + '일</strong></span>',
    '</div>',
    '<table class="portfolio-table">',
      '<thead><tr><th>날짜</th><th>보유</th><th>보유종목</th><th>현금</th><th>총평가액</th><th>수익률</th><th>수익금</th></tr></thead>',
      '<tbody>' + rows + '</tbody>',
    '</table>',
  ].join('')
}

// ── Backtest detail view (TradingView chart modal) ──
var _detailChart = null

function showBacktestDetail(ticker, entryDate, name) {
  var config = {
    fixedTakeProfitPct: parseFloat(document.getElementById('bt_takeProfit').value) || 0.07,
    breakEvenActivationPct: parseFloat(document.getElementById('bt_breakEvenAct').value) || 0.07,
    trailingActivationPct: parseFloat(document.getElementById('bt_trailAct').value) || 0.03,
    trailingStopPct: parseFloat(document.getElementById('bt_trailStop').value) || 0.03,
    stallExitDays: parseInt(document.getElementById('bt_stallDays').value) || 2,
    minVolume: parseInt(document.getElementById('bt_minVol').value) || 0,
    maxVolatility: parseFloat(document.getElementById('bt_maxVol').value) || 1.0,
    rankingCandidateLimit: parseInt(document.getElementById('bt_rankLimit').value) || 9999,
  }

  var startDate = document.getElementById('btStartDate').value
  var endDate = document.getElementById('btEndDate').value

  var overlay = document.getElementById('detailModalOverlay')
  document.getElementById('detailModalTitle').textContent = (name || '') + ' (' + ticker + ')'
  overlay.classList.add('active')

  var statsEl = document.getElementById('detailModalStats')
  document.getElementById('detailTabChart').innerHTML = '<div class="detail-modal-chart" id="detailChart"></div>'
  document.getElementById('detailTabGrid').innerHTML = '<div class="detail-modal-grid" id="detailModalGrid"></div>'
  statsEl.innerHTML = '<div class="detail-loading">로딩 중...</div>'

  fetch('/api/backtest/ticker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker: ticker, entry_date: entryDate, config: config, start_date: startDate, end_date: endDate }),
  })
    .then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error(d.detail || 'Failed') })
      return r.json()
    })
    .then(function (data) {
      renderDetailView(data, ticker)
    })
    .catch(function (e) {
      statsEl.innerHTML = '<div class="detail-error">로딩 실패: ' + e.message + '</div>'
    })
}

var _detailData = null

function switchDetailTab(tab) {
  document.querySelectorAll('.detail-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab) })
  document.querySelectorAll('.detail-tab-pane').forEach(function (p) { p.classList.toggle('active', p.id === 'detailTab' + tab.charAt(0).toUpperCase() + tab.slice(1)) })
  if (tab === 'chart') {
    if (_detailChart === null && _detailData) {
      renderDetailChart(_detailData.data, _detailData.ticker)
    } else if (_detailChart) {
      var c = document.getElementById('detailChart')
      if (c) _detailChart.resize(c.clientWidth, Math.max(c.clientHeight, 300))
    }
  }
}

function renderDetailView(data, ticker) {
  _detailData = { data: data, ticker: ticker }
  var statsEl = document.getElementById('detailModalStats')
  var chartPane = document.getElementById('detailTabChart')
  var gridPane = document.getElementById('detailTabGrid')
  var ba = window._baseAmt || 1000000
  var exitLabel = (data.exit_reason && REASON_LABELS[data.exit_reason]) || data.exit_reason || '없음'
  var pnlPct = (data.pnl * 100)
  var profitAmt = data.pnl * ba

  var SIGNAL_LABEL = { 'BUY': '매수', 'HOLD': '홀드', 'SELL': '매도', 'NONE': '-' }
  statsEl.innerHTML = [
    '<div class="result-summary">',
      '<div class="stat"><div class="val ' + (pnlPct >= 0 ? 'profit-positive' : 'profit-negative') + '">' + pnlPct.toFixed(2) + '%</div><div class="label">수익률</div></div>',
      '<div class="stat"><div class="val ' + (profitAmt >= 0 ? 'profit-positive' : 'profit-negative') + '">' + profitAmt.toLocaleString() + '원</div><div class="label">수익금</div></div>',
      '<div class="stat"><div class="val">' + (data.exit_day ? 'D+' + data.exit_day : '미청산') + '</div><div class="label">청산 시점</div></div>',
      '<div class="stat"><div class="val">' + exitLabel + '</div><div class="label">청산 사유</div></div>',
    '</div>',
  ].join('')
  gridPane.innerHTML = [
    '<table class="backtest-result-table">',
      '<thead><tr><th>일자</th><th>구분</th><th>시가</th><th>최저가</th><th>최고가</th><th>종가</th><th>진입가</th><th>사유</th></tr></thead>',
      '<tbody>',
      (data.trades || []).map(function (t) {
        var entryPrice = data.entry_price || 0
        var label = SIGNAL_LABEL[t.signal] || t.signal
        var signalClass = ({ 'BUY': 'signal-buy', 'HOLD': 'signal-hold', 'SELL': 'signal-sell', 'NONE': 'signal-none' })[t.signal] || ''
        return '<tr>' +
          '<td>' + t.date + '</td>' +
          '<td class="' + signalClass + '">' + label + '</td>' +
          '<td>' + (t.open || 0).toLocaleString() + '</td>' +
          '<td>' + (t.low || 0).toLocaleString() + '</td>' +
          '<td>' + (t.high || 0).toLocaleString() + '</td>' +
          '<td>' + (t.close || 0).toLocaleString() + '</td>' +
          '<td>' + entryPrice.toLocaleString() + '</td>' +
          '<td>' + (REASON_LABELS[t.reason] || t.reason || '-') + '</td>' +
          '</tr>'
      }).join(''),
      '</tbody>',
    '</table>',
  ].join('')

  // Reset tabs to chart
  switchDetailTab('chart')
  renderDetailChart(data, ticker)
}

function renderDetailChart(data, ticker) {
  var container = document.getElementById('detailChart')
  if (!container) return
  if (_detailChart) { _detailChart.remove(); _detailChart = null }

  // Wait for modal to be visible before measuring
  requestAnimationFrame(function () {
    var w = Math.min(container.clientWidth, 900)
    var h = Math.max(container.clientHeight, 300)
    var chart = LightweightCharts.createChart(container, {
      width: w,
      height: h,
      layout: {
        background: { color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#1c2128' },
        horzLines: { color: '#1c2128' },
      },
      crosshair: { mode: 0 },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: '#30363d' },
    })

    var candleSeries = chart.addCandlestickSeries({
      upColor: '#3fb950',
      downColor: '#f85149',
      borderDownColor: '#f85149',
      borderUpColor: '#3fb950',
      wickDownColor: '#f85149',
      wickUpColor: '#3fb950',
    })

    candleSeries.setData(data.chart_data.map(function (c) {
      return { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }
    }))

    candleSeries.setMarkers(data.markers)
    chart.timeScale().fitContent()
    _detailChart = chart
  })
}

function closeDetailView() {
  document.getElementById('detailModalOverlay').classList.remove('active')
  if (_detailChart) { _detailChart.remove(); _detailChart = null }
  _detailData = null
  document.getElementById('detailModalStats').innerHTML = ''
  document.getElementById('detailTabChart').innerHTML = ''
  document.getElementById('detailTabGrid').innerHTML = ''
}

function resetScanButton() {
  var btn = document.getElementById('btnStartScan')
  btn.disabled = false
  btn.textContent = '백테스트 실행'
}

// ── Load all stock data into Oracle ──
var _dataLoading = false
var _loadPollTimer = null

function loadAllStockData() {
  if (_dataLoading) return
  showConfirm('국내주식 전체 데이터(5년치)를 Oracle VM에 적재하시겠습니까?\\n수 분 소요됩니다.').then(function (ok) {
    if (!ok) return

    _dataLoading = true
    var btn = document.getElementById('btnLoadData')
    btn.disabled = true
    btn.textContent = '데이터 적재 시작 중...'

    fetch('/api/backtest/load-data', { method: 'POST' })
      .then(function (r) { return r.json() })
      .then(function (data) {
        if (data.status === 'started' || data.status === 'running') {
          btn.textContent = '데이터 적재 중... (0%)'
          if (_loadPollTimer) clearInterval(_loadPollTimer)
          _loadPollTimer = setInterval(function () { pollLoadStatus() }, 3000)
          pollLoadStatus()
        } else if (data.status === 'completed') {
          showAlert('데이터 적재 완료: ' + (data.loaded || 0) + '개 종목, ' + (data.rows || 0) + '개 행')
          resetLoadButton()
        } else {
          showAlert('데이터 적재 실패: ' + (data.error || data.message || '알 수 없는 오류'))
          resetLoadButton()
        }
      })
      .catch(function (e) {
        showAlert('데이터 적재 요청 실패: ' + e.message)
        resetLoadButton()
      })
  })
}

function pollLoadStatus() {
  fetch('/api/backtest/load-data/status')
    .then(function (r) { return r.json() })
    .then(function (data) {
      var btn = document.getElementById('btnLoadData')
      if (data.status === 'completed') {
        clearInterval(_loadPollTimer)
        _loadPollTimer = null
        showAlert('데이터 적재 완료: ' + (data.loaded || 0) + '개 종목, ' + (data.rows || 0) + '개 행')
        resetLoadButton()
      } else if (data.status === 'failed') {
        clearInterval(_loadPollTimer)
        _loadPollTimer = null
        showAlert('데이터 적재 실패: ' + (data.error || '알 수 없는 오류'))
        resetLoadButton()
      } else if (data.status === 'running' || data.status === 'started') {
        btn.textContent = '데이터 적재 중...'
      }
    })
    .catch(function () {
      // ignore poll errors
    })
}

function resetLoadButton() {
  _dataLoading = false
  if (_loadPollTimer) { clearInterval(_loadPollTimer); _loadPollTimer = null }
  var btn = document.getElementById('btnLoadData')
  btn.disabled = false
  btn.textContent = '데이터 적재'
}

// ── Active Positions (from Python backend) ──
function loadActivePositions() {
  fetch('/api/positions')
    .then(function (r) { return r.json() })
    .then(function (data) {
      var tbody = document.getElementById('positionsBody')
      if (!tbody) return
      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:#8b949e;text-align:center">활성 포지션이 없습니다.</td></tr>'
        return
      }
      tbody.innerHTML = data.map(function (p) {
        var profitClass = p.profit_pct >= 0 ? 'pos-profit' : 'pos-loss'
        var profitStr = p.profit_pct ? (p.profit_pct * 100).toFixed(2) + '%' : '-'
        return '<tr>' +
          '<td>' + p.ticker + '</td>' +
          '<td>' + (p.entry_price ? p.entry_price.toLocaleString() : '-') + '</td>' +
          '<td>' + (p.current_price ? p.current_price.toLocaleString() : '-') + '</td>' +
          '<td class="' + profitClass + '">' + profitStr + '</td>' +
          '<td>' + (p.highest_price ? p.highest_price.toLocaleString() : '-') + '</td>' +
          '<td>' + p.holding_days + '</td>' +
          '<td><button class="btn btn-danger" style="padding:4px 8px;font-size:11px" data-ticker="' + p.ticker + '" onclick="forceRemovePosition(this.dataset.ticker)">삭제</button></td>' +
          '</tr>'
      }).join('')
    })
    .catch(function () {})
}

function forceRemovePosition(ticker) {
  showConfirm(ticker + ' 포지션을 강제 청산하시겠습니까?').then(function (ok) {
    if (!ok) return
    fetch('/api/positions/' + ticker, { method: 'DELETE' })
      .then(function (r) { return r.json() })
      .then(function () {
        showAlert('청산 완료')
        loadActivePositions()
      })
      .catch(function () { showAlert('청산 실패') })
  })
}

function addPosition() {
  var ticker = document.getElementById('posTicker').value.trim().toUpperCase()
  var price = parseFloat(document.getElementById('posPrice').value)
  var qty = parseInt(document.getElementById('posQty').value)
  if (!ticker || !price || !qty) { showAlert('종목코드, 가격, 수량을 모두 입력하세요.'); return }
  fetch('/api/positions/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker: ticker, entry_price: price, quantity: qty }),
  })
    .then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error(d.detail) })
      return r.json()
    })
    .then(function () {
      showAlert('포지션 등록 완료')
      document.getElementById('posTicker').value = ''
      document.getElementById('posPrice').value = ''
      document.getElementById('posQty').value = ''
      loadActivePositions()
    })
    .catch(function (e) { showAlert('등록 실패: ' + e.message) })
}

// ── Event delegation for tabs and buttons ──
document.addEventListener('click', function (e) {
  var tab = e.target.closest('.detail-tab')
  if (tab && tab.dataset.tab) { switchDetailTab(tab.dataset.tab); return }
  var rtab = e.target.closest('.results-tab')
  if (rtab && rtab.dataset.view) {
    document.querySelectorAll('.results-tab').forEach(function (b) { b.classList.toggle('active', b === rtab) })
    document.querySelectorAll('.results-view').forEach(function (v) { v.classList.toggle('active', v.id === 'resultsView' + rtab.dataset.view.charAt(0).toUpperCase() + rtab.dataset.view.slice(1)) })
    if (rtab.dataset.view === 'portfolio') { var pc = document.getElementById('portfolioContent'); if (pc && !pc.innerHTML.trim()) renderPortfolio() }
    return
  }
  var btn = e.target.closest('.btn-detail')
  if (btn && btn.dataset.idx !== undefined && window._scanResults) {
    var r = window._scanResults[parseInt(btn.dataset.idx)]
    if (r) showBacktestDetail(r.ticker, r.entry_date, r.name)
  }
})

// ── Init ──
document.addEventListener('DOMContentLoaded', function () {
  loadParams()
  initDates()
})
`;
