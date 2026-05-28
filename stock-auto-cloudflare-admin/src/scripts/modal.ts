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
`;
