export const modalJs = `
function showAlert(msg) {
  return new Promise(function (resolve) {
    document.getElementById('modalMessage').textContent = msg
    document.getElementById('modalOkBtn').style.display = 'inline-block'
    document.getElementById('modalCancelBtn').style.display = 'none'
    document.getElementById('modalOverlay').classList.add('active')

    document.getElementById('modalOkBtn').onclick = function () {
      document.getElementById('modalOverlay').classList.remove('active')
      resolve()
    }
  })
}

function showConfirm(msg) {
  return new Promise(function (resolve) {
    document.getElementById('modalMessage').textContent = msg
    document.getElementById('modalOkBtn').style.display = 'inline-block'
    document.getElementById('modalCancelBtn').style.display = 'inline-block'
    document.getElementById('modalOkBtn').textContent = '확인'
    document.getElementById('modalOverlay').classList.add('active')

    document.getElementById('modalOkBtn').onclick = function () {
      document.getElementById('modalOverlay').classList.remove('active')
      resolve(true)
    }
    document.getElementById('modalCancelBtn').onclick = function () {
      document.getElementById('modalOverlay').classList.remove('active')
      resolve(false)
    }
  })
}

function showPrompt(label, defaultValue) {
  return new Promise(function (resolve) {
    var msg = document.getElementById('modalMessage')
    msg.innerHTML = '<div style="margin-bottom:8px;font-size:13px;color:#c9d1d9">' + label + '</div>' +
      '<input id="modalPromptInput" type="text" style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:8px 10px;color:#c9d1d9;font-size:14px;outline:none">'
    var input = document.getElementById('modalPromptInput')
    if (input) { input.value = defaultValue || ''; input.focus(); input.select() }
    document.getElementById('modalOkBtn').style.display = 'inline-block'
    document.getElementById('modalOkBtn').textContent = '확인'
    document.getElementById('modalCancelBtn').style.display = 'inline-block'

    document.getElementById('modalOverlay').classList.add('active')

    document.getElementById('modalOkBtn').onclick = function () {
      var val = document.getElementById('modalPromptInput')
      document.getElementById('modalOverlay').classList.remove('active')
      resolve(val ? val.value : '')
    }
    document.getElementById('modalCancelBtn').onclick = function () {
      document.getElementById('modalOverlay').classList.remove('active')
      resolve(null)
    }
  })
}

var _loadingCount = 0

function showLoading(msg) {
  _loadingCount++
  var el = document.getElementById('loadingBar')
  if (!el) {
    el = document.createElement('div')
    el.id = 'loadingBar'
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;background:#238636;z-index:9999;transition:opacity .3s'
    document.body.appendChild(el)
  }
  el.style.opacity = '1'
  el.style.width = '30%'
  setTimeout(function () { if (el) el.style.width = '70%' }, 200)
}

function hideLoading() {
  _loadingCount--
  if (_loadingCount > 0) return
  _loadingCount = 0
  var el = document.getElementById('loadingBar')
  if (el) {
    el.style.width = '100%'
    setTimeout(function () {
      el.style.opacity = '0'
      setTimeout(function () { if (el) el.style.width = '30%' }, 300)
    }, 200)
  }
}
`;
