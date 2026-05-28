export const backtestJs = `
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

    // 1. Fixed take profit
    if (profitPct >= config.fixedTakeProfitPct) {
      signal = 'SELL'; reason = 'take_profit'
    }
    // 2. Trailing stop
    else if (peakProfitPct >= config.trailingActivationPct) {
      var dropRatio = 1 - config.trailingStopPct
      if (price < highest * dropRatio) {
        signal = 'SELL'; reason = 'trailing_stop'
      }
    }
    // 3. Break-even stop
    else if (isBreakEven && price <= entryPrice) {
      signal = 'SELL'; reason = 'break_even'
    }

    // 4. Activate break-even
    if (!isBreakEven && profitPct >= config.breakEvenActivationPct) {
      isBreakEven = true
    }

    // 5. Stall exit
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

// ── UI ──
function runBacktest() {
  // Read params
  var config = {
    fixedTakeProfitPct: parseFloat(document.getElementById('bt_takeProfit').value) || 0.07,
    breakEvenActivationPct: parseFloat(document.getElementById('bt_breakEvenAct').value) || 0.07,
    trailingActivationPct: parseFloat(document.getElementById('bt_trailAct').value) || 0.03,
    trailingStopPct: parseFloat(document.getElementById('bt_trailStop').value) || 0.03,
    stallExitDays: parseInt(document.getElementById('bt_stallDays').value) || 2,
  }

  var entryPrice = parseFloat(document.getElementById('bt_entryPrice').value)
  if (!entryPrice || entryPrice <= 0) { showAlert('진입 가격을 입력하세요.'); return }

  // Collect daily prices
  var priceElements = document.querySelectorAll('.bt-price-input')
  var dailyPrices = []
  priceElements.forEach(function (el) {
    var val = parseFloat(el.value)
    if (!isNaN(val) && val > 0) dailyPrices.push(val)
  })

  if (dailyPrices.length === 0) { showAlert('일별 가격을 하나 이상 추가하세요.'); return }

  var result = simulateBacktest(config, entryPrice, dailyPrices)
  renderBacktestResult(result, config, entryPrice)
}

function addPriceInput() {
  var container = document.getElementById('btPriceList')
  var input = document.createElement('div')
  input.className = 'price-tag'
  var dayNum = container.children.length + 1
  input.innerHTML = '<span class="day-num">D' + dayNum + '</span> <input type="number" class="bt-price-input" step="1" placeholder="가격"> <span class="remove-price" onclick="this.parentElement.remove();updatePriceLabels()">✕</span>'
  container.appendChild(input)
}

function updatePriceLabels() {
  var container = document.getElementById('btPriceList')
  var items = container.querySelectorAll('.price-tag')
  items.forEach(function (el, i) {
    el.querySelector('.day-num').textContent = 'D' + (i + 1)
  })
}

var REASON_LABELS = {
  take_profit: '익절',
  trailing_stop: '트레일링 스탑',
  break_even: '본절',
  stall_exit: '시세 정체',
}
var REASON_ABBR = { take_profit: 'TP', trailing_stop: 'TS', break_even: 'BE', stall_exit: 'SE' }

function renderBacktestResult(result, config, entryPrice) {
  var container = document.getElementById('btResult')
  if (result.exitDay !== -1) {
    var exitLabel = REASON_LABELS[result.exitReason] || result.exitReason
    container.innerHTML = [
      '<div class="result-summary">',
        '<div class="stat"><div class="val ' + (result.pnl >= 0 ? 'profit-positive' : 'profit-negative') + '">' + result.pnl.toFixed(2) + '%</div><div class="label">수익률</div></div>',
        '<div class="stat"><div class="val">' + (result.exitDay || '-') + '</div><div class="label">청산일 (D+' + (result.exitDay || '') + ')</div></div>',
        '<div class="stat"><div class="val">' + (exitLabel) + '</div><div class="label">청산 사유</div></div>',
        '<div class="stat"><div class="val">' + (result.exitPrice ? result.exitPrice.toLocaleString() : '-') + '</div><div class="label">청산 가격</div></div>',
      '</div>',
      '<div id="btChart" class="backtest-chart-container"></div>',
      '<table class="backtest-result-table">',
        '<thead><tr><th>일차</th><th>가격</th><th>수익률</th><th>고점</th><th>고점대비%</th><th>신호</th><th>사유</th><th>본절</th></tr></thead>',
        '<tbody>',
        result.results.map(function (r) {
          var signalClass = r.signal === 'SELL' ? 'signal-sell' : 'signal-hold'
          var profitClass = r.profitPct >= 0 ? 'profit-positive' : 'profit-negative'
          var peakDrop = ((r.highest - r.price) / r.highest * 100).toFixed(1)
          return '<tr>' +
            '<td>' + r.day + '</td>' +
            '<td>' + r.price.toLocaleString() + '</td>' +
            '<td class="' + profitClass + '">' + (r.profitPct * 100).toFixed(2) + '%</td>' +
            '<td>' + r.highest.toLocaleString() + '</td>' +
            '<td>' + peakDrop + '%</td>' +
            '<td class="' + signalClass + '">' + r.signal + '</td>' +
            '<td>' + (REASON_LABELS[r.reason] || r.reason || '-') + '</td>' +
            '<td>' + (r.isBreakEven ? '\u2713' : '') + '</td>' +
            '</tr>'
        }).join(''),
        '</tbody>',
      '</table>',
    ].join('')
    renderChart(result, entryPrice)
  } else {
    container.innerHTML = '<p style="color:#8b949e">종료 신호 없이 시뮬레이션이 종료되었습니다.</p>'
  }
}

// ── TradingView Lightweight Charts ──
var _btChart = null

function renderChart(result, entryPrice) {
  var container = document.getElementById('btChart')
  if (!container) return
  if (_btChart) { _btChart.remove(); _btChart = null }

  var chart = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 480,
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
      timeVisible: false,
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

  // Build chart_data with simulated OHLC
  var basePrice = entryPrice
  var chartData = result.results.map(function (r, i) {
    var prevPrice = i > 0 ? result.results[i - 1].price : entryPrice
    var open = (i === 0) ? entryPrice : prevPrice
    var close = r.price
    var high = Math.max(open, close) * (1 + Math.random() * 0.005)
    var low = Math.min(open, close) * (1 - Math.random() * 0.005)
    var d = new Date(2026, 0, 2 + i)
    var timeStr = d.toISOString().slice(0, 10)
    return { time: timeStr, open: open, high: high, low: low, close: close }
  })

  candleSeries.setData(chartData)

  // Build markers
  var markers = []
  // Buy marker at day 1
  markers.push({
    time: chartData[0].time,
    position: 'belowBar',
    color: '#2196F3',
    shape: 'arrowUp',
    text: 'BUY',
  })
  // Sell marker
  result.results.forEach(function (r, i) {
    if (r.signal === 'SELL') {
      markers.push({
        time: chartData[i].time,
        position: 'aboveBar',
        color: '#E91E63',
        shape: 'arrowDown',
        text: REASON_ABBR[r.reason] || 'EXIT',
      })
    }
  })
  candleSeries.setMarkers(markers)

  chart.timeScale().fitContent()
  _btChart = chart

  // Resize handler
  function onResize() { chart.applyOptions({ width: container.clientWidth }) }
  window.addEventListener('resize', onResize)
  chart._resizeHandler = onResize
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
          '<td><button class="btn btn-danger" style="padding:4px 8px;font-size:11px" onclick="forceRemovePosition(\'' + p.ticker + '\')">삭제</button></td>' +
          '</tr>'
      }).join('')
    })
    .catch(function () {})
}

function forceRemovePosition(ticker) {
  showConfirm(ticker + ' 포지션을 강제 청산하시겠습니까?', function () {
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
`;
