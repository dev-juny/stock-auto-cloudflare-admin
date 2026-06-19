export const loginScreen = `
<div id="loginScreen" class="login-wrap">
  <div class="login-box">
    <h2>🔐 관리자 로그인</h2>
    <input id="username" placeholder="아이디" autocomplete="username">
    <input id="password" type="password" placeholder="비밀번호" autocomplete="current-password">
    <button onclick="login()">로그인</button>
    <p id="loginMsg" style="color:#f85149;font-size:12px;margin-top:8px;text-align:center"></p>
  </div>
</div>
`;
