export const backtestJs = `
// ── Comma formatting ──
function comma(el) {
  var v = el.value.replace(/[^0-9]/g, '')
  if (v) el.value = Number(v).toLocaleString()
  else el.value = ''
}
function numVal(id) {
  var el = document.getElementById(id)
  if (!el) return 0
  return parseInt(el.value.replace(/,/g, '')) || 0
}
function floatVal(id) {
  var el = document.getElementById(id)
  if (!el) return 0
  return parseFloat(el.value.replace(/,/g, '')) || 0
}

// ── Parameter persistence ──
var PARAM_IDS = ['bt_takeProfit','bt_breakEvenAct','bt_trailAct','bt_trailStop','bt_stopLoss','bt_stallDays','bt_rankLimit','bt_maxPos','bt_minVol','bt_maxVol','bt_baseAmt','bt_entryType','bt_entryTrigger','bt_entryConditions','bt_commission','bt_tax','bt_slippage']
var TEXTAREA_IDS = ['bt_entryConditions']

function saveParams() {
  var obj = {}
  PARAM_IDS.forEach(function (id) {
    var el = document.getElementById(id)
    if (!el) return
    if (TEXTAREA_IDS.indexOf(id) >= 0) {
      obj[id] = el.value.split('\\n')
    } else {
      obj[id] = el.value
    }
  })
  try { localStorage.setItem('bt_params', JSON.stringify(obj)) } catch (e) {}
}

function loadParams() {
  try {
    var raw = localStorage.getItem('bt_params')
    if (!raw) return
    var obj = JSON.parse(raw)
    PARAM_IDS.forEach(function (id) {
      var el = document.getElementById(id)
      if (!el || obj[id] === undefined) return
      if (TEXTAREA_IDS.indexOf(id) >= 0) {
        el.value = Array.isArray(obj[id]) ? obj[id].join('\\n') : obj[id]
      } else {
        el.value = obj[id]
      }
      if (id === 'bt_minVol' || id === 'bt_baseAmt') comma(el)
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
  stop_loss: '손절',
  stall_exit: '시세 정체',
}
var REASON_ABBR = { take_profit: 'TP', trailing_stop: 'TS', break_even: 'BE', stop_loss: 'SL', stall_exit: 'SE' }

// ── Backtest scan with date range ──
var _scanPollTimer = null
var _retryTimer = null
var _lastScanConfig = null
var _lastScanId = null
try { var _savedId = localStorage.getItem('bt_last_scan_id'); if (_savedId) _lastScanId = _savedId } catch (e) {}
var _scanCompleted = false

var _pageSize = 50
var _currentPage = 1

function runBacktestRange(skipConfirm) {
  saveDates()

  var config = _readParams()
  config.rankingCandidateLimit = parseInt(document.getElementById('bt_rankLimit').value) || 30
  var mp = parseInt(document.getElementById('bt_maxPos').value) || 10
  var ba = numVal('bt_baseAmt') || 1000000

  var tp = config.fixedTakeProfitPct
  var be = config.breakEvenActivationPct
  var ta = config.trailingActivationPct
  var ts = config.trailingStopPct
  var sd = config.stallExitDays
  var sl = config.stopLossPct
  var mv = config.minVolume
  var mvol = config.maxVolatility
  var rl = config.rankingCandidateLimit

  if (!tp || tp <= 0) { showAlert('익절률은 0보다 커야 합니다.'); return }
  if (!be || be <= 0) { showAlert('본절 활성화는 0보다 커야 합니다.'); return }
  if (!ta || ta <= 0) { showAlert('트레일링 활성화는 0보다 커야 합니다.'); return }
  if (!ts || ts <= 0) { showAlert('트레일링 스탑은 0보다 커야 합니다.'); return }
  if (!sd || sd < 1) { showAlert('정체 청산일은 1일 이상이어야 합니다.'); return }
  if (mv < 0) { showAlert('최소 거래량은 0 이상이어야 합니다.'); return }
  if (!mvol || mvol <= 0 || mvol > 1) { showAlert('최대 변동성은 0~1 사이여야 합니다.'); return }
  if (!rl || rl < 1) { showAlert('순위 후보 제한은 1 이상이어야 합니다.'); return }
  if (!ba || ba < 1) { showAlert('기준 금액은 1원 이상이어야 합니다.'); return }

  config.maxConcurrentPositions = mp
  window._baseAmt = ba
  var startDate = document.getElementById('btStartDate').value
  var endDate = document.getElementById('btEndDate').value
  if (!startDate || !endDate) { showAlert('시작일과 종료일을 모두 선택하세요.'); return }
  if (startDate >= endDate) { showAlert('종료일은 시작일보다 이후여야 합니다.'); return }
  var maxDays = 1825
  var daysDiff = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
  if (daysDiff > maxDays) { showAlert('백테스트 기간은 최대 5년(1825일)까지 가능합니다.'); return }

  var etLabel = { momentum: '모멘텀', breakout: '돌파', pullback: '되돌림', hybrid: '혼합' }[config.entryType] || config.entryType
  var etrLabel = { next_close: '당일 종가', next_open: '다음일 시가', intraday: '장중', breakout_confirm: '돌파 확인' }[config.entryTrigger] || config.entryTrigger
  var pct = function (v) { return (v * 100).toFixed(1) }

  var dateRange = startDate + ' ~ ' + endDate
  var summary =
    '  기간: ' + dateRange + '\\n' +
    '  [진입] ' + etLabel + '  |  시점: ' + etrLabel + '\\n' +
    '  [청산] 익절률: ' + pct(tp) + '%  |  본절: ' + pct(be) + '%\\n' +
    '         트레일링: ' + pct(ta) + '% / ' + pct(ts) + '%  |  손절: ' + (sl ? pct(sl) + '%' : '없음') + '  |  정체: ' + sd + '일\\n' +
    '  [비용] 수수료: ' + pct(config.commission) + '%  |  세금: ' + pct(config.tax) + '%  |  슬리피지: ' + pct(config.slippage) + '%\\n' +
    '  [유니버스] 최소거래량: ' + mv.toLocaleString() + '  |  최대변동성: ' + pct(mvol) + '%  |  후보: ' + rl + '개\\n' +
    '  [포지션] 최대: ' + mp + '종목  |  1회: ' + ba.toLocaleString() + '원'

  if (!skipConfirm) {
    showConfirm('백테스트를 실행하시겠습니까?\\n' + summary).then(function (ok) {
      if (!ok) return
      _doScan(startDate, endDate, config, ba)
    })
  } else {
    _doScan(startDate, endDate, config, ba)
  }
}

function _doScan(startDate, endDate, config, baseAmt) {
  _scanCompleted = false
  _lastScanConfig = { startDate: startDate, endDate: endDate, config: config, baseAmt: baseAmt }

  var btn = document.getElementById('btnStartScan')
  btn.disabled = false
  btn.textContent = '취소'
  btn.onclick = function () { cancelScan() }
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
      base_amt: baseAmt || 1000000,
    }),
  })
    .then(function (r) { return r.json() })
    .then(function (data) {
      if (!data || !data.scan_id) {
        // Backend returned invalid response (proxy abort or restart)
        if (_retryTimer) clearTimeout(_retryTimer)
        _retryTimer = setTimeout(function () {
          if (_lastScanConfig) {
            _doScan(_lastScanConfig.startDate, _lastScanConfig.endDate, _lastScanConfig.config, _lastScanConfig.baseAmt)
          }
        }, 3000)
        return
      }
      _lastScanId = data.scan_id
      try { localStorage.setItem('bt_last_scan_id', data.scan_id) } catch (e) {}
      if (_scanPollTimer) clearTimeout(_scanPollTimer)
      startPolling(data.scan_id)
    })
    .catch(function (e) {
      // Network error - retry after 3s
      if (_retryTimer) clearTimeout(_retryTimer)
      _retryTimer = setTimeout(function () {
        if (_lastScanConfig) {
          _doScan(_lastScanConfig.startDate, _lastScanConfig.endDate, _lastScanConfig.config, _lastScanConfig.baseAmt)
        }
      }, 3000)
    })
}

function startPolling(scanId) {
  pollScanStatus(scanId)
}

function pollScanStatus(scanId) {
  fetch('/api/backtest/scan/' + scanId)
    .then(function (r) { return r.json() })
    .then(function (data) {
      if (data && data.message === 'Scan not found') {
        if (_lastScanId) { try { localStorage.removeItem('bt_last_scan_id') } catch (e) {}; _lastScanId = null }
        if (_scanPollTimer) clearTimeout(_scanPollTimer)
        _scanPollTimer = null
        if (_retryTimer) clearTimeout(_retryTimer)
        _retryTimer = setTimeout(function () {
          if (_lastScanConfig) {
            _doScan(_lastScanConfig.startDate, _lastScanConfig.endDate, _lastScanConfig.config, _lastScanConfig.baseAmt)
          } else {
            resetScanButton()
          }
        }, 3000)
        return
      }
      if (!data || !data.status) {
        if (_scanPollTimer) clearTimeout(_scanPollTimer)
        _scanPollTimer = setTimeout(function () { pollScanStatus(scanId) }, 2000)
        return
      }
      updateScanProgress(data)
      if (data.status === 'completed') {
        if (_scanPollTimer) clearTimeout(_scanPollTimer)
        _scanPollTimer = null
        // Portfolio became available after async build — just update portfolio
        if (data.portfolio && data.portfolio.length > 0 && _scanCompleted) {
          window._scanPortfolio = data.portfolio
          window._scanPortfolioTradeStats = data.portfolio_trade_stats
          window._portfolioBuilding = data.portfolio_building
          renderPortfolio()
          updateStatsWithPortfolio(data.portfolio, data.portfolio_trade_stats)
          return
        }
        // First completion — render results and trigger portfolio build
        if (!_scanCompleted) {
          _scanCompleted = true
          renderScanResults(data)
          resetScanButton()
          showAlert('백테스트 완료: ' + (data.completed || 0) + '개 청산 신호 탐지됨')
        }
        // Check portfolio building status
        if (!data.portfolio || (Array.isArray(data.portfolio) && data.portfolio.length === 0)) {
          if (data.portfolio_building === 'running' || data.portfolio_building === 'completed') {
            _scanPollTimer = setTimeout(function () { pollScanStatus(window._lastScanId) }, 2000)
          } else if (data.portfolio_building !== 'failed') {
            buildPortfolio(window._lastScanId)
          }
        }
      } else if (data.status === 'cancelled') {
        if (_scanPollTimer) clearTimeout(_scanPollTimer)
        _scanPollTimer = null
        showAlert('백테스트 취소됨')
        resetScanButton()
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
      // Poll failed (network error), retry in 3s
      if (_scanPollTimer) clearTimeout(_scanPollTimer)
      _scanPollTimer = setTimeout(function () { pollScanStatus(scanId) }, 3000)
    })
}

function updateScanProgress(data) {
  var pct = data.total > 0 ? Math.round(data.processed / data.total * 100) : 0
  document.getElementById('scanProgressFill').style.width = pct + '%'
  document.getElementById('scanProgressLabel').textContent = (data.processed || 0) + '/' + (data.total || 0) + ' (' + pct + '%)'
  document.getElementById('scanStatusText').textContent = data.message || '처리 중...'
}

function renderScanResults(data) {
  document.getElementById('scanResultsCard').classList.remove('hidden')

  var results = data.results || []
  results.sort(function (a, b) { return Math.abs(b.pnl) - Math.abs(a.pnl) })

  window._scanResults = results
  window._scanPortfolio = data.portfolio || []
  window._scanPortfolioTradeStats = data.portfolio_trade_stats
  window._baseAmt = window._baseAmt || 1000000
  window._portfolioBuilding = data.portfolio_building
  _currentPage = 1

  renderStats(results)
  renderPage()
  renderPortfolio()
  // renderStrategy() — 제거됨
}

function updateStatsWithPortfolio(portfolio, tradeStats) {
  if (!portfolio || portfolio.length === 0) {
    var ids = ['pfWinRate','pfAvgWin','pfAvgLoss','pfProfitFactor','pfBestTrade','pfWorstTrade','pfTotalReturn','pfTotalProfit']
    ids.forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = '-' })
    return
  }
  var last = portfolio[portfolio.length - 1]
  document.getElementById('pfTotalReturn').textContent = ((last.pnl_pct || 0) * 100).toFixed(2) + '%'
  document.getElementById('pfTotalProfit').textContent = (last.pnl_amt || 0).toLocaleString() + '원'
  if (tradeStats) {
    document.getElementById('pfWinRate').textContent = (tradeStats.winRate || 0).toFixed(1) + '%'
    document.getElementById('pfAvgWin').textContent = (tradeStats.avgWin || 0).toFixed(2) + '%'
    document.getElementById('pfAvgLoss').textContent = (tradeStats.avgLoss || 0).toFixed(2) + '%'
    document.getElementById('pfProfitFactor').innerHTML = (tradeStats.profitFactor || 0) === 99 ? '&infin;' : (tradeStats.profitFactor || 0).toFixed(2)
    document.getElementById('pfBestTrade').textContent = (tradeStats.bestPnl || 0).toFixed(2) + '%'
    document.getElementById('pfWorstTrade').textContent = (tradeStats.worstPnl || 0).toFixed(2) + '%'
  }
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
  document.getElementById('statsBestTrade').textContent = (bestPnl * 100).toFixed(2) + '%'
  document.getElementById('statsWorstTrade').textContent = (worstPnl * 100).toFixed(2) + '%'
  document.getElementById('statsBar').classList.remove('hidden')

  updateStatsWithPortfolio(window._scanPortfolio, window._scanPortfolioTradeStats)
  window._scanStats = {
    winRate: winRate / 100,
    avgWin: avgWin * ba,
    avgLoss: Math.abs(avgLoss * ba),
    profitFactor: profitFactor === Infinity ? 99 : profitFactor,
    totalReturnPct: totalPnl * 100,
    totalProfit: totalPnl * ba,
    bestTrade: bestPnl * ba,
    worstTrade: worstPnl * ba,
    closedTrades: total,
  }
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
      '<td><button class="btn btn-detail" data-idx="' + idx + '">보기</button></td>' +
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
    if (window._portfolioBuilding === 'running') {
      container.innerHTML = '<div style="color:#8b949e;text-align:center;padding:2rem">포트폴리오 시뮬레이션을 생성 중입니다...</div>'
    } else if (window._portfolioBuilding === 'failed') {
      container.innerHTML = '<div style="color:#f85149;text-align:center;padding:2rem">포트폴리오 생성 실패</div>'
    } else {
      container.innerHTML = '<div style="color:#8b949e;text-align:center;padding:2rem">포트폴리오 데이터가 없습니다.</div>'
    }
    return
  }

  try {
    var rows = portfolio.map(function (s) {
      var pnlCls = s.pnl_pct >= 0 ? 'scan-positive' : 'scan-negative'
      var holdingsHtml = (s.holdings || []).map(function (h) {
        var cls = 'pos-hold'
        if (h.status === '매수') cls = 'pos-buy'
        else if (h.status === '매도') cls = 'pos-sell'
        else if (h.status === '트레일링') cls = 'pos-trailing'
        else if (h.status === 'BE') cls = 'pos-be'
        var label = h.status === '매도' ? '매도가' : '현재가'
        var price = (h.current_price || 0).toLocaleString()
        var profitCls = h.profit_amt >= 0 ? 'scan-positive' : 'scan-negative'
        var reasonStr = h.reason ? ' (' + h.reason + ')' : ''
        return '<div class="portfolio-pos">' +
          '<span class="' + cls + ' pos-ticker">' + (h.ticker || '') + '</span>' +
          '<span class="pos-name">' + (h.name || '') + '</span>' +
          '<span class="pos-sep">|</span>' +
          '<span class="pos-label">진입</span><span class="pos-val">' + (h.entry_price || 0).toLocaleString() + '</span>' +
          '<span class="pos-sep">|</span>' +
          '<span class="pos-label">' + label + '</span><span class="pos-val">' + price + '</span>' +
          '<span class="pos-sep">|</span>' +
          '<span class="pos-label">' + (h.shares || 0) + '주</span>' +
          '<span class="pos-sep">|</span>' +
          '<span class="' + profitCls + '">' + (h.profit_amt || 0).toLocaleString() + '원 (' + ((h.pnl_pct || 0) * 100).toFixed(2) + '%)</span>' +
          '<span class="pos-sep">|</span>' +
          '<span class="' + cls + '">' + (h.status || '') + reasonStr + '</span>' +
          '</div>'
      }).join('')

      return '<tr>' +
        '<td>' + (s.date || '') + '</td>' +
        '<td>' + (s.positions_count || 0) + '</td>' +
        '<td>' + holdingsHtml + '</td>' +
        '<td>' + (s.cash || 0).toLocaleString() + '</td>' +
        '<td>' + (s.total_value || 0).toLocaleString() + '</td>' +
        '<td class="' + pnlCls + '">' + ((s.pnl_pct || 0) * 100).toFixed(2) + '%</td>' +
        '<td class="' + pnlCls + '">' + (s.pnl_amt || 0).toLocaleString() + '</td>' +
        '</tr>'
    })

    var last = portfolio[portfolio.length - 1]
    container.innerHTML = [
      '<div class="portfolio-summary">',
        '<span class="ps-item">기준금액: <strong>' + ba.toLocaleString() + '원</strong></span>',
        '<span class="ps-item">최종수익률: <strong style="color:' + (last.pnl_pct >= 0 ? '#3fb950' : '#f85149') + '">' + ((last.pnl_pct || 0) * 100).toFixed(2) + '%</strong></span>',
        '<span class="ps-item">최종수익금: <strong style="color:' + (last.pnl_amt >= 0 ? '#3fb950' : '#f85149') + '">' + (last.pnl_amt || 0).toLocaleString() + '원</strong></span>',
        '<span class="ps-item">총거래일: <strong>' + portfolio.length + '일</strong></span>',
      '</div>',
      '<table class="portfolio-table">',
        '<thead><tr><th>날짜</th><th>보유</th><th>보유종목</th><th>현금</th><th>총평가액</th><th>수익률</th><th>수익금</th></tr></thead>',
        '<tbody>' + rows.join('') + '</tbody>',
      '</table>',
    ].join('')
  } catch (e) {
    container.innerHTML = '<div style="color:#f85149;text-align:center;padding:2rem">포트폴리오 렌더링 오류: ' + e.message + '</div>'
  }
}

// ── Backtest detail view (TradingView chart modal) ──
var _detailChart = null

function showBacktestDetail(ticker, entryDate, name) {
  var config = _readParams()

  var startDate = document.getElementById('btStartDate').value
  var endDate = document.getElementById('btEndDate').value

  var overlay = document.getElementById('detailModalOverlay')
  document.getElementById('detailModalTitle').textContent = (name || '') + ' (' + ticker + ')'
  overlay.classList.add('active')
  document.body.style.overflow = 'hidden'

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
  var gridEl = document.getElementById('detailModalGrid')
  if (!gridEl) return
  gridEl.innerHTML = [
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
  _detailChart = null
  switchDetailTab('chart')
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
  document.body.style.overflow = ''
  if (_detailChart) { _detailChart.remove(); _detailChart = null }
  _detailData = null
  document.getElementById('detailModalStats').innerHTML = ''
  document.getElementById('detailTabChart').innerHTML = ''
  document.getElementById('detailTabGrid').innerHTML = ''
}

function cancelScan() {
  var btn = document.getElementById('btnStartScan')
  if (!btn || btn.textContent !== '취소') return
  var scanId = _lastScanId
  if (!scanId) return
  if (_scanPollTimer) clearTimeout(_scanPollTimer)
  _scanPollTimer = null
  btn.disabled = true
  btn.textContent = '취소 중...'
  btn.onclick = null
  fetch('/api/backtest/scan/' + scanId + '/cancel', { method: 'POST' })
    .then(function (r) { return r.json() })
    .then(function () {
      resetScanButton()
      showAlert('백테스트 취소됨')
    })
    .catch(function () {
      resetScanButton()
    })
}

function resetScanButton() {
  var btn = document.getElementById('btnStartScan')
  btn.disabled = false
  btn.textContent = '백테스트 실행'
  btn.onclick = function () { runBacktestRange() }
}

function buildPortfolio(scanId) {
  fetch('/api/backtest/scan/' + scanId + '/portfolio', { method: 'POST' })
    .then(function (r) { return r.json() })
    .then(function (result) {
      if (result.status === 'running') {
        setTimeout(function () { pollScanStatus(scanId) }, 2000)
      } else if (result.status === 'failed') {
        pollScanStatus(scanId)
      } else if (result.status === 'completed') {
        window._scanPortfolio = result.portfolio || []
        window._scanPortfolioTradeStats = result.portfolio_trade_stats
        window._portfolioBuilding = result.portfolio_building
        renderPortfolio()
        updateStatsWithPortfolio(result.portfolio || [], result.portfolio_trade_stats)
      }
    })
    .catch(function () {
      setTimeout(function () { buildPortfolio(scanId) }, 5000)
    })
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
          '<td>' + (p.name ? p.name + ' (' + p.ticker + ')' : p.ticker) + '</td>' +
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

// ── Strategy config: breadth, saved configs, scheduler ──
function refreshBreadth() {
  showLoading()
  fetch('/api/backtest/breadth/refresh', { method: 'POST' })
    .then(function (r) { return r.json() })
    .then(function (d) {
      hideLoading()
      if (d.error) { showAlert('BREADTH 계산 실패: ' + d.error); return }
      loadStrategyConfig()
    })
    .catch(function (e) { hideLoading(); showAlert('BREADTH 갱신 실패: ' + e.message) })
}

function loadStrategyConfig() {
  showLoading()
  fetch('/api/backtest/breadth')
    .then(function (r) { return r.json() })
    .then(function (d) {
      var el = document.getElementById('breadthDisplay')
      if (!el) return
      if (d.breadth_pct !== undefined && d.total_stocks > 0) {
        var pct = (d.breadth_pct * 100).toFixed(1)
        var clr = d.breadth_pct >= 0.5 ? '#3fb950' : d.breadth_pct >= 0.3 ? '#d29922' : '#f85149'
        el.textContent = pct + '%'
        el.style.color = clr
        document.getElementById('breadthDetail').textContent = d.above_ma + '/' + d.total_stocks + ' 종목이 20일선 위'
      } else {
        el.textContent = '--'
        document.getElementById('breadthDetail').textContent = '계산 필요'
      }
    })
    .catch(function () {})

  fetch('/api/backtest/configs')
    .then(function (r) { return r.json() })
    .then(function (list) {
      var el = document.getElementById('savedConfigsList')
      if (!el) return
      if (!list || list.length === 0) {
        el.innerHTML = '<span style="color:#484f58">저장된 설정이 없습니다.</span>'
        return
      }
      var active = list.find(function (c) { return c.is_active })
      if (active) {
        var p = tryParseJson(active.params)
        document.getElementById('activeConfigName').textContent = active.name
        var detail = ''
        if (p) {
          var et_ = p.entryType ? { momentum: '모멘텀', breakout: '돌파', pullback: '되돌림' }[p.entryType] || p.entryType : '?'
          var tp_ = p.fixedTakeProfitPct !== undefined ? (p.fixedTakeProfitPct * 100).toFixed(0) + '%' : '?%'
          var ts_ = p.trailingStopPct !== undefined ? (p.trailingStopPct * 100).toFixed(0) + '%' : '?%'
          var sl_ = p.stopLossPct ? (p.stopLossPct * 100).toFixed(0) + '%' : 'SL없음'
          var stall_ = p.stallExitDays !== undefined ? p.stallExitDays + '일' : '?일'
          detail = et_ + '  |  TP:' + tp_ + '  TS:' + ts_ + '  SL:' + sl_ + '  정체:' + stall_
        }
        document.getElementById('activeConfigDetail').textContent = detail
        loadConfigPortfolio(active.id)
      }
      var html = '<table style="width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed">' +
        '<thead><tr style="color:#484f58;font-size:10px;border-bottom:1px solid #21262d">' +
        '<th style="width:28px;padding:4px 2px"><input type="checkbox" id="configSelectAll" onchange="toggleSelectAllConfigs()" style="accent-color:#238636;cursor:pointer;display:block;margin:0"></th>' +
        '<th style="text-align:left;padding:4px 6px;font-weight:400">설정명</th>' +
        '<th style="width:130px;padding:4px 6px;font-weight:400;text-align:center">실행</th>' +
        '<th style="width:24px;padding:4px 2px"></th>' +
        '</tr></thead><tbody>' +
        list.slice(0, 10).map(function (c) {
          var p = tryParseJson(c.params) || {}
          var paramParts = []
          if (p.entryType) paramParts.push({ momentum: '모멘텀', breakout: '돌파' }[p.entryType] || p.entryType)
          if (p.fixedTakeProfitPct !== undefined) paramParts.push('TP ' + (p.fixedTakeProfitPct * 100).toFixed(0) + '%')
          if (p.trailingStopPct !== undefined) paramParts.push('TS ' + (p.trailingStopPct * 100).toFixed(0) + '%')
          if (p.stopLossPct) paramParts.push('SL ' + (p.stopLossPct * 100).toFixed(0) + '%')
          if (p.stallExitDays !== undefined) paramParts.push('정체 ' + p.stallExitDays + '일')
          if (p.maxConcurrentPositions !== undefined) paramParts.push('포지션' + p.maxConcurrentPositions + '개')
          var paramLine = paramParts.length > 0
            ? '<span style="color:#8b949e;font-size:11px">' + paramParts.join(' <span style="color:#30363d">/</span> ') + '</span>'
            : ''
          var dateStr = c.created_at ? '<span style="color:#484f58;font-size:10px;margin-left:8px">' + c.created_at + '</span>' : ''
          var actionHtml = c.is_active
            ? '<button class="btn" onclick="deactivateConfig()" style="font-size:10px;padding:1px 6px;background:#21262d;color:#f85149;border:1px solid #f85149">해제</button>'
            : '<button class="btn" onclick="activateConfig(' + c.id + ')" style="font-size:10px;padding:1px 6px">적용</button>'
          var detailBtn = '<button class="btn" onclick="showConfigDetail(' + c.id + ')" style="font-size:10px;padding:1px 6px;background:#21262d;color:#c9d1d9;border:1px solid #30363d">\uC0C1\uC138</button>'
          var chk = '<input type="checkbox" class="config-chk" value="' + c.id + '" style="accent-color:#238636;cursor:pointer;display:block">'
          var delBtn = '<button class="config-del-btn" data-id="' + c.id + '" style="background:none;border:none;color:#484f58;cursor:pointer;font-size:14px;padding:2px;line-height:1" title="삭제">&times;</button>'
          return '<tr style="border-bottom:1px solid #21262d">' +
            '<td style="padding:6px 2px;vertical-align:middle">' + chk + '</td>' +
            '<td style="padding:6px 6px">' +
            '<div style="color:#c9d1d9;font-weight:600;font-size:12px">' + c.name + '</div>' +
            '<div style="display:flex;align-items:baseline;flex-wrap:wrap">' +
            paramLine +
            dateStr +
            '</div>' +
            '</td>' +
            '<td style="padding:6px 6px;text-align:center;vertical-align:middle;white-space:nowrap"><div style="display:inline-flex;gap:4px">' +
            detailBtn + actionHtml +
            '</div></td>' +
            '<td style="padding:6px 2px;vertical-align:middle">' + delBtn + '</td>' +
            '</tr>'
        }).join('') +
        '</tbody></table>'
      el.innerHTML = html
      // event delegation for delete buttons
      el.onclick = function (e) {
        var target = e.target
        if (target.classList.contains('config-del-btn')) {
          var id = parseInt(target.getAttribute('data-id'))
          var name = ''
          for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) { name = list[i].name; break }
          }
          deleteOneConfig(id, name)
        }
      }
    })
    .catch(function () { hideLoading() })

  fetch('/api/backtest/scheduler-config')
    .then(function (r) { return r.json() })
    .then(function (d) {
      var intEl = document.getElementById('schedulerInterval')
      var thEl = document.getElementById('breadthThreshold')
      var upEl = document.getElementById('breadthUpper')
      if (intEl) intEl.value = d.interval_seconds || 60
      if (thEl) thEl.value = d.breadth_threshold || 0.3
      if (upEl) upEl.value = d.breadth_upper || 0.7
      hideLoading()
    })
    .catch(function () { hideLoading() })
}

function tryParseJson(s) {
  try { return JSON.parse(s) } catch (e) { return null }
}

function toggleSelectAllConfigs() {
  var checked = document.getElementById('configSelectAll').checked
  var boxes = document.querySelectorAll('.config-chk')
  for (var i = 0; i < boxes.length; i++) { boxes[i].checked = checked }
}

function toggleDeleteBtn() {
  var checked = document.querySelectorAll('.config-chk:checked').length
  var btn = document.getElementById('btnDeleteConfigs')
  if (btn) btn.style.display = checked > 0 ? 'inline-block' : 'none'
}

function deleteOneConfig(id, name) {
  showConfirm("'" + name + "' 설정을 삭제하시겠습니까?").then(function (ok) {
    if (!ok) return
    fetch('/api/backtest/configs/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
      .then(function (r) { return r.json() })
      .then(function (d) {
        if (d.error) { showAlert('삭제 실패: ' + d.error); return }
        showAlert('삭제되었습니다.')
        loadStrategyConfig()
      })
      .catch(function (e) { showAlert('삭제 실패: ' + e.message) })
  })
}

function deleteAllConfigs() {
  showConfirm('모든 저장된 설정을 삭제하시겠습니까?').then(function (ok) {
    if (!ok) return
    fetch('/api/backtest/configs/list')
      .then(function (r) { return r.json() })
      .then(function (list) {
        if (!list || list.length === 0) { showAlert('삭제할 설정이 없습니다.'); return }
        var ids = list.map(function (c) { return c.id })
        return fetch('/api/backtest/configs/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: ids }),
        })
      })
      .then(function (r) { return r ? r.json() : null })
      .then(function (d) {
        if (d && d.error) { showAlert('삭제 실패: ' + d.error); return }
        showAlert('전체 삭제되었습니다.')
        loadStrategyConfig()
      })
      .catch(function (e) { showAlert('삭제 실패: ' + e.message) })
  })
}

function deleteSelectedConfigs() {
  var checked = document.querySelectorAll('.config-chk:checked')
  if (checked.length === 0) return
  var ids = [].map.call(checked, function (el) { return parseInt(el.value) })
  showConfirm(checked.length + '개 설정을 삭제하시겠습니까?').then(function (ok) {
    if (!ok) return
    fetch('/api/backtest/configs/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids }),
    })
      .then(function (r) { return r.json() })
      .then(function (d) {
        if (d.error) { showAlert('삭제 실패: ' + d.error); return }
        showAlert(ids.length + '개 설정이 삭제되었습니다.')
        loadStrategyConfig()
      })
      .catch(function (e) { showAlert('삭제 실패: ' + e.message) })
  })
}

function activateConfig(id) {
  fetch('/api/backtest/configs/' + id + '/activate', { method: 'POST' })
    .then(function (r) { return r.json() })
    .then(function () {
      showAlert('전략이 적용되었습니다.')
      loadStrategyConfig()
      loadConfigPortfolio(id)
    })
    .catch(function (e) { showAlert('적용 실패: ' + e.message) })
}

function deactivateConfig() {
  fetch('/api/backtest/configs/deactivate', { method: 'POST' })
    .then(function (r) { return r.json() })
    .then(function () {
      showAlert('전략이 해제되었습니다.')
      loadStrategyConfig()
      document.getElementById('configPortfolioArea').style.display = 'none'
    })
    .catch(function (e) { showAlert('해제 실패: ' + e.message) })
}

function showConfigDetail(id) {
  fetch('/api/backtest/configs')
    .then(function (r) { return r.json() })
    .then(function (list) {
      var c = list.find(function (x) { return x.id === id })
      if (!c) { showAlert('설정을 찾을 수 없습니다.'); return }
      var p = tryParseJson(c.params) || {}
      var s = tryParseJson(c.result_summary) || {}
      var lines = []
      lines.push('이름: ' + c.name + '  (' + c.created_at + ')')
      lines.push('')
      lines.push('【기간 및 금액】')
      lines.push('시작일: ' + (s.start_date || '-'))
      lines.push('종료일: ' + (s.end_date || '-'))
      lines.push('기준금액: ' + (s.base_amt || 0).toLocaleString() + '원')
      if (s.winRate !== undefined) {
        lines.push('')
        lines.push('【백테스트 결과】')
        lines.push('승률: ' + (s.winRate * 100).toFixed(1) + '%')
        lines.push('Profit Factor: ' + (s.profitFactor || 0).toFixed(2))
        lines.push('총수익률: ' + (s.totalReturnPct || 0).toFixed(1) + '%')
        lines.push('총수익금: ' + (s.totalProfit || 0).toLocaleString() + '원')
        lines.push('평균승리: ' + (s.avgWin || 0).toLocaleString() + '원')
        lines.push('평균손실: ' + (s.avgLoss || 0).toLocaleString() + '원')
        lines.push('최고수익: ' + (s.bestTrade || 0).toLocaleString() + '원')
        lines.push('최대손실: ' + (s.worstTrade || 0).toLocaleString() + '원')
        lines.push('체결거래: ' + (s.closedTrades || 0) + '회')
      }
      lines.push('')
      lines.push('【백테스트 파라미터】')
      lines.push('[Entry] 유형: ' + (p.entryType || 'momentum'))
      lines.push('[Entry] 시점: ' + (p.entryTrigger || 'next_close'))
      if (p.entryConditions) lines.push('[Entry] 조건: ' + (Array.isArray(p.entryConditions) ? p.entryConditions.join('; ') : p.entryConditions))
      lines.push('[Exit] 익절률: ' + ((p.fixedTakeProfitPct || 0) * 100).toFixed(0) + '%')
      lines.push('[Exit] 본절 활성화: ' + ((p.breakEvenActivationPct || 0) * 100).toFixed(0) + '%')
      lines.push('[Exit] 트레일링 활성화: ' + ((p.trailingActivationPct || 0) * 100).toFixed(0) + '%')
      lines.push('[Exit] 트레일링 스탑: ' + ((p.trailingStopPct || 0) * 100).toFixed(0) + '%')
      lines.push('[Exit] 손절: ' + (p.stopLossPct ? (p.stopLossPct * 100).toFixed(0) + '%' : '없음'))
      lines.push('[Exit] 정체 청산일: ' + (p.stallExitDays || '-') + '일')
      lines.push('[Universe] 최소 거래량: ' + (p.minVolume || 0).toLocaleString())
      lines.push('[Universe] 최대 변동성: ' + ((p.maxVolatility || 0) * 100).toFixed(0) + '%')
      lines.push('[Universe] 후보 제한: ' + (p.rankingCandidateLimit || '-') + '개')
      lines.push('[Position] 최대 동시 포지션: ' + (p.maxConcurrentPositions || '-') + '개')
      lines.push('[Position] 기준 금액: ' + ((p.base_amt || 0)).toLocaleString() + '원')
      lines.push('[Costs] 수수료: ' + ((p.commission || 0.02) * 100).toFixed(3) + '%')
      lines.push('[Costs] 세금: ' + ((p.tax || 0.15) * 100).toFixed(3) + '%')
      lines.push('[Costs] 슬리피지: ' + ((p.slippage || 0.1) * 100).toFixed(2) + '%')
      var body = document.getElementById('configDetailBody')
      if (!body) return
      var actionHtml = c.is_active
        ? '<span style="color:#3fb950;font-weight:600">✓ 이미 적용 중인 전략입니다</span>'
        : '<button class="btn" onclick="activateConfig(' + c.id + ');document.getElementById(\\'configDetailOverlay\\').classList.remove(\\'active\\')" style="font-size:12px;padding:6px 16px">전략으로 적용</button>'
      body.innerHTML = lines.join('\\n') + '\\n\\n' + actionHtml
      document.getElementById('configDetailOverlay').classList.add('active')
    })
    .catch(function () {})
}

function _readParams() {
  var ec = document.getElementById('bt_entryConditions').value
  return {
    fixedTakeProfitPct: parseFloat(document.getElementById('bt_takeProfit').value) || 0.07,
    breakEvenActivationPct: parseFloat(document.getElementById('bt_breakEvenAct').value) || 0.07,
    trailingActivationPct: parseFloat(document.getElementById('bt_trailAct').value) || 0.03,
    trailingStopPct: parseFloat(document.getElementById('bt_trailStop').value) || 0.03,
    stopLossPct: parseFloat(document.getElementById('bt_stopLoss').value) || 0,
    stallExitDays: parseInt(document.getElementById('bt_stallDays').value) || 2,
    rankingCandidateLimit: parseInt(document.getElementById('bt_rankLimit').value) || 30,
    maxConcurrentPositions: parseInt(document.getElementById('bt_maxPos').value) || 10,
    minVolume: numVal('bt_minVol') || 500000,
    maxVolatility: parseFloat(document.getElementById('bt_maxVol').value) || 0.12,
    entryType: document.getElementById('bt_entryType').value || 'momentum',
    entryTrigger: document.getElementById('bt_entryTrigger').value || 'next_close',
    entryConditions: ec ? ec.split('\\n').filter(Boolean) : ['daily volume > minVolume', 'daily volatility < maxVolatility'],
    commission: parseFloat(document.getElementById('bt_commission').value) || 0.0002,
    tax: parseFloat(document.getElementById('bt_tax').value) || 0.0015,
    slippage: parseFloat(document.getElementById('bt_slippage').value) || 0.001,
  }
}

function saveParamConfig() {
  var params = _readParams()
  var startDate = document.getElementById('btStartDate').value
  var endDate = document.getElementById('btEndDate').value
  var baseAmt = floatVal('bt_baseAmt') || 1000000
  var defaultName = '설정 ' + startDate + '~' + endDate

  showPrompt('설정 이름을 입력하세요:', defaultName).then(function (name) {
    if (!name) return
    var resultSummary = { start_date: startDate, end_date: endDate, base_amt: baseAmt }
    return fetch('/api/backtest/configs/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, params: params, start_date: startDate, end_date: endDate, base_amt: baseAmt, result_summary: resultSummary }),
    })
      .then(function (r) { return r.json() })
      .then(function (d) {
        if (d.error) { showAlert('저장 실패: ' + d.error); return }
        showAlert('설정이 저장되었습니다.')
      })
      .catch(function (e) { showAlert('저장 실패: ' + e.message) })
  })
}

function saveCurrentConfig() {
  var params = _readParams()
  var startDate = document.getElementById('btStartDate').value
  var endDate = document.getElementById('btEndDate').value
  var defaultName = '설정 ' + startDate + '~' + endDate

  showPrompt('설정 이름을 입력하세요:', defaultName).then(function (name) {
    if (!name) return
    var resultSummary = { start_date: startDate, end_date: endDate, base_amt: 0 }
    if (window._scanStats) {
      resultSummary.winRate = window._scanStats.winRate
      resultSummary.avgWin = window._scanStats.avgWin
      resultSummary.avgLoss = window._scanStats.avgLoss
      resultSummary.profitFactor = window._scanStats.profitFactor
      resultSummary.totalReturnPct = window._scanStats.totalReturnPct
      resultSummary.totalProfit = window._scanStats.totalProfit
      resultSummary.bestTrade = window._scanStats.bestTrade
      resultSummary.worstTrade = window._scanStats.worstTrade
      resultSummary.closedTrades = window._scanStats.closedTrades
    }
    authFetch('/api/balance')
      .then(function (r) { return r.json() })
      .then(function (d) {
        var cash = 0
        if (d.output2 && d.output2[0] && d.output2[0].prvs_rcdl_exc_amt) {
          cash = parseFloat(d.output2[0].prvs_rcdl_exc_amt) || 0
        }
        resultSummary.base_amt = cash > 0 ? cash : (floatVal('bt_baseAmt') || 1000000)
        return fetch('/api/backtest/configs/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, params: params, start_date: startDate, end_date: endDate, base_amt: resultSummary.base_amt, result_summary: resultSummary }),
        })
      })
      .then(function (r) { return r.json() })
      .then(function (d) {
        if (d.error) { showAlert('저장 실패: ' + d.error); return }
        showAlert('설정이 저장되었습니다.')
      })
      .catch(function (e) { showAlert('저장 실패: ' + e.message) })
  })
}
function loadConfigPortfolio(id) {
  fetch('/api/backtest/configs/' + id + '/portfolio')
    .then(function (r) { return r.json() })
    .then(function (portfolio) {
      var area = document.getElementById('configPortfolioArea')
      var body = document.getElementById('configPortfolioBody')
      if (!area || !body) return
      if (!portfolio || portfolio.length === 0) {
        area.style.display = 'none'
        return
      }
      area.style.display = 'block'

      var stats = calcPortfolioStats(portfolio)
      body.innerHTML = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">' +
        '<span>총수익률: <strong>' + stats.totalReturnPct.toFixed(1) + '%</strong></span>' +
        '<span>총수익금: <strong>' + stats.totalProfit.toLocaleString() + '원</strong></span>' +
        '<span>승률: <strong>' + (stats.winRate * 100).toFixed(0) + '%</strong></span>' +
        '<span>Profit Factor: <strong>' + stats.profitFactor.toFixed(2) + '</strong></span>' +
        '</div>' +
        '<div style="overflow-x:auto;max-height:400px;overflow-y:auto">' +
        '<table class="table" style="width:100%;font-size:11px">' +
        '<thead><tr class="sticky-header">' +
        '<th>날짜</th><th>보유종목</th><th>현금</th><th>총평가액</th><th>수익률</th><th>수익금</th>' +
        '</tr></thead><tbody>' +
        portfolio.map(function (row) {
          var pct = (row.equity - row.deposit) / row.deposit * 100
          var profit = row.equity - row.deposit
          var posHtml = ''
          if (row.holdings && row.holdings.length > 0) {
            posHtml = row.holdings.map(function (h) {
              var statusLabel = ''
              if (h.status === 'entry') statusLabel = '<span style="color:#3fb950">▲진입</span>'
              else if (h.status === 'trailing') statusLabel = '<span style="color:#d29922">●트레일링</span>'
              else if (h.status === 'be') statusLabel = '<span style="color:#58a6ff">●손절방어</span>'
              var priceInfo = ''
              if (h.sell_price !== undefined) {
                priceInfo = '<span style="color:#f85149">매도 ' + h.sell_price.toLocaleString() + '</span>'
              } else {
                priceInfo = '<span style="color:#3fb950">' + h.entry_price.toLocaleString() + '</span>'
              }
              var pnl = (h.sell_price || h.current_price || h.entry_price) - h.entry_price
              return '<div style="display:flex;gap:6px;align-items:center">' +
                '<span>' + (h.name || h.code) + '</span>' +
                priceInfo +
                (h.shares ? '<span style="color:#484f58">x' + h.shares + '</span>' : '') +
                '<span style="color:' + (pnl >= 0 ? '#3fb950' : '#f85149') + '">' +
                (pnl >= 0 ? '+' : '') + pnl.toLocaleString() +
                '</span>' +
                statusLabel +
                '</div>'
            }).join('')
          } else {
            posHtml = '<span style="color:#484f58">없음</span>'
          }
          return '<tr>' +
            '<td style="white-space:nowrap">' + row.date + '</td>' +
            '<td style="max-width:300px">' + posHtml + '</td>' +
            '<td style="text-align:right">' + (row.cash || 0).toLocaleString() + '</td>' +
            '<td style="text-align:right">' + (row.equity || 0).toLocaleString() + '</td>' +
            '<td style="text-align:right;color:' + (pct >= 0 ? '#3fb950' : '#f85149') + '">' +
            (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%</td>' +
            '<td style="text-align:right;color:' + (profit >= 0 ? '#3fb950' : '#f85149') + '">' +
            (profit >= 0 ? '+' : '') + profit.toLocaleString() + '</td>' +
            '</tr>'
        }).join('') +
        '</tbody></table></div>'
    })
    .catch(function () {})
}

function calcPortfolioStats(portfolio) {
  var totalReturnPct = 0
  var wins = 0, losses = 0
  var totalWinAmt = 0, totalLossAmt = 0
  var closedTrades = 0
  var deposit = 0
  var lastEquity = 0
  if (portfolio.length > 0) {
    deposit = portfolio[0].deposit || 0
    lastEquity = portfolio[portfolio.length - 1].equity || deposit
    totalReturnPct = deposit > 0 ? (lastEquity - deposit) / deposit * 100 : 0
  }
  portfolio.forEach(function (row) {
    if (row.trades) {
      row.trades.forEach(function (t) {
        if (t.type === 'sell') {
          var pnl = t.sell_price - t.entry_price
          closedTrades++
          if (pnl >= 0) { wins++; totalWinAmt += pnl }
          else { losses++; totalLossAmt += Math.abs(pnl) }
        }
      })
    }
  })
  var winRate = closedTrades > 0 ? wins / closedTrades : 0
  var avgWin = wins > 0 ? totalWinAmt / wins : 0
  var avgLoss = losses > 0 ? totalLossAmt / losses : 0
  var profitFactor = totalLossAmt > 0 ? totalWinAmt / totalLossAmt : totalWinAmt > 0 ? 99 : 0
  return {
    totalReturnPct: totalReturnPct,
    totalProfit: lastEquity - deposit,
    winRate: winRate,
    avgWin: avgWin,
    avgLoss: avgLoss,
    profitFactor: profitFactor,
    closedTrades: closedTrades,
  }
}

function updateSchedulerConfig() {
  showLoading()
  var interval = parseInt(document.getElementById('schedulerInterval').value) || 60
  var threshold = parseFloat(document.getElementById('breadthThreshold').value) || 0.3
  var upper = parseFloat(document.getElementById('breadthUpper').value) || 0.7
  fetch('/api/backtest/scheduler-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interval_seconds: interval, breadth_threshold: threshold, breadth_upper: upper }),
  })
    .then(function (r) { return r.json() })
    .then(function () {
      hideLoading()
      showAlert('실행 주기와 BREADTH 하한/상한이 업데이트되었습니다.')
    })
    .catch(function (e) { hideLoading(); showAlert('업데이트 실패: ' + e.message) })
}

// ── Trade logs ──
function loadBatchStatus() {
  console.log('loadBatchStatus() called')
  fetch('/api/backtest/load-data/logs')
    .then(function (r) { return r.json() })
    .then(function (logs) {
      var el = document.getElementById('batchStatusBody')
      if (!el) return
      if (!logs || logs.length === 0) {
        el.innerHTML = '<span style="color:#484f58">아직 적재 이력이 없습니다.</span>'
        return
      }
      function okLabel(s) { return s === 'completed' ? '성공' : s === 'failed' ? '실패' : s === 'running' ? '진행' : s === 'skipped' ? '건너뜀' : s }
      function okColor(s) { return s === 'completed' ? '#3fb950' : s === 'skipped' ? '#d29922' : '#f85149' }
      var rows = logs.slice(0, 20).map(function (log) {
        var dbtn = log.error_msg
          ? '<button class="btn-detail" onclick="showBatchLogDetail(' + log.id + ')" style="font-size:10px;padding:1px 6px">상세보기</button>'
          : ''
        var cls = log === logs[0] ? ' style="background:#161b22"' : ''
        var dt = log.finished_at || log.started_at || '-'
        return '<tr' + cls + '>' +
          '<td style="color:' + okColor(log.status) + ';font-weight:600">' + okLabel(log.status) + '</td>' +
          '<td>' + (log.kospi_loaded || 0) + '</td>' +
          '<td>' + (log.kosdaq_loaded || 0) + '</td>' +
          '<td style="color:#484f58">' + dt + '</td>' +
          '<td>' + dbtn + '</td>' +
          '</tr>'
      }).join('')
      el.innerHTML =
        '<table class="scan-results-table">' +
        '<thead><tr>' +
        '<th>성공여부</th><th>코스피</th><th>코스닥</th><th>일시</th><th></th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>'
    })
    .catch(function (e) { console.error('loadBatchStatus error:', e) })
}

window.showBatchLogDetail = function (id) {
  fetch('/api/backtest/load-data/logs')
    .then(function (r) { return r.json() })
    .then(function (logs) {
      var log = logs.find(function (l) { return l.id == id })
      if (!log) return
      var body = document.getElementById('batchLogDetailBody')
      if (!body) return
      body.innerHTML =
        'ID: ' + log.id + '\\n' +
        '상태: ' + log.status + '\\n' +
        '시작: ' + log.started_at + '\\n' +
        '완료: ' + log.finished_at + '\\n' +
        'KOSPI: ' + log.kospi_loaded + ' 종목\\n' +
        'KOSDAQ: ' + log.kosdaq_loaded + ' 종목\\n' +
        '총 행: ' + log.total_rows + '\\n' +
        (log.error_msg ? '\\n에러:\\n' + log.error_msg : '')
      document.getElementById('batchLogOverlay').classList.add('active')
    })
    .catch(function () {})
}

function loadTradeLogs() {
  fetch('/api/backtest/trades?limit=50')
    .then(function (r) { return r.json() })
    .then(function (list) {
      var el = document.getElementById('tradeLogBody')
      if (!el) return
      if (!list || list.length === 0) {
        el.innerHTML = '<tr><td colspan="6" style="color:#8b949e;text-align:center">거래 내역이 없습니다.</td></tr>'
        return
      }
      var html = list.map(function (t) {
        var actCls = t.action === 'SELL' ? 'scan-negative' : 'scan-positive'
        return '<tr>' +
          '<td>' + (t.traded_at || '') + '</td>' +
          '<td>' + (t.name ? t.name + ' (' + t.ticker + ')' : t.ticker) + '</td>' +
          '<td class="' + actCls + '">' + t.action + '</td>' +
          '<td>' + (t.price ? t.price.toLocaleString() : '') + '</td>' +
          '<td>' + (t.quantity || '') + '</td>' +
          '<td>' + (t.reason || '') + '</td>' +
          '</tr>'
      }).join('')
      el.innerHTML = html
    })
    .catch(function () {})
}

// ── Event delegation for tabs and buttons ──
document.addEventListener('click', function (e) {
  var tab = e.target.closest('.detail-tab')
  if (tab && tab.dataset.tab) { switchDetailTab(tab.dataset.tab); return }
  var rtab = e.target.closest('.results-tab')
  if (rtab && rtab.dataset.view) {
    document.querySelectorAll('.results-tab').forEach(function (b) { b.classList.toggle('active', b === rtab) })
    document.querySelectorAll('.results-view').forEach(function (v) { v.classList.toggle('active', v.id === 'resultsView' + rtab.dataset.view.charAt(0).toUpperCase() + rtab.dataset.view.slice(1)) })
    if (rtab.dataset.view === 'portfolio') {
      renderPortfolio()
      if (!window._scanPortfolio || window._scanPortfolio.length === 0) {
        if (window._lastScanId) {
          pollScanStatus(window._lastScanId)
        } else {
          var c = document.getElementById('portfolioContent')
          if (c) c.innerHTML = '<div style="color:#8b949e;text-align:center;padding:2rem">백테스트를 먼저 실행해주세요.</div>'
        }
      }
    }
    return
  }
  var btn = e.target.closest('.btn-detail')
  if (btn && btn.dataset.idx !== undefined && window._scanResults) {
    var r = window._scanResults[parseInt(btn.dataset.idx)]
    if (r) showBacktestDetail(r.ticker, r.entry_date, r.name)
  }
})

function loadRealBalance() {
  var el = document.getElementById('bt_baseAmt')
  if (!el) return
  authFetch('/api/balance')
    .then(function (r) { return r.json() })
    .then(function (d) {
      if (d.output2 && d.output2[0] && d.output2[0].prvs_rcdl_exc_amt) {
        var cash = parseFloat(d.output2[0].prvs_rcdl_exc_amt) || 0
        if (cash > 0) { el.value = cash; comma(el) }
      }
    })
    .catch(function () {})
}

// ── Init ──
document.addEventListener('DOMContentLoaded', function () {
  loadParams()
  initDates()
  loadStrategyConfig()
  loadTradeLogs()
  loadBatchStatus()
  comma(document.getElementById('bt_minVol'))
  comma(document.getElementById('bt_baseAmt'))
})
`;
