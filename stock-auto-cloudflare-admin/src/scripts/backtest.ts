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
            '<td>' + (r.isBreakEven ? '✓' : '') + '</td>' +
            '</tr>'
        }).join(''),
        '</tbody>',
      '</table>',
    ].join('')
  } else {
    container.innerHTML = '<p style="color:#8b949e">종료 신호 없이 시뮬레이션이 종료되었습니다.</p>'
  }
}
`;
