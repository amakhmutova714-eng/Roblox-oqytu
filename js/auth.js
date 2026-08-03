const AUTH_TOKEN_KEY = 'roblox_auth_token';
const AUTH_NAME_KEY  = 'roblox_auth_name';

function getAuthToken() { return localStorage.getItem(AUTH_TOKEN_KEY); }
function getAuthName()  { return localStorage.getItem(AUTH_NAME_KEY);  }

function saveAuth(token, name) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_NAME_KEY, name);
  updateNavAuthArea();
}

function logout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_NAME_KEY);
  updateNavAuthArea();
}

function isLoggedIn() { return !!getAuthToken(); }

function updateNavAuthArea() {
  const el = document.getElementById('nav-auth-area');
  if (!el) return;
  if (isLoggedIn()) {
    el.innerHTML = `
      <span class="nav-user-name">👤 ${escAuthHtml(getAuthName())}</span>
      <button class="nav-logout-btn" onclick="logout()">Шығу</button>`;
  } else {
    el.innerHTML = `<button class="nav-login-btn" onclick="openAuthModal()">Кіру</button>`;
  }
}

function openAuthModal(tab) {
  document.getElementById('auth-overlay').style.display = 'flex';
  switchAuthTab(tab || 'login');
  clearAuthErrors();
}

function closeAuthModal() {
  document.getElementById('auth-overlay').style.display = 'none';
}

function switchAuthTab(tab) {
  document.getElementById('auth-login-form').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('auth-register-form').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  clearAuthErrors();
}

function clearAuthErrors() {
  const le = document.getElementById('login-error');
  const re = document.getElementById('reg-error');
  if (le) { le.style.display = 'none'; le.textContent = ''; }
  if (re) { re.style.display = 'none'; re.textContent = ''; }
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

async function submitLogin() {
  const contact  = (document.getElementById('login-contact').value  || '').trim();
  const password = (document.getElementById('login-password').value || '').trim();
  if (!contact || !password) {
    showAuthError('login-error', 'Барлық өрістерді толтыр'); return;
  }
  try {
    const res  = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact, password })
    });
    const data = await res.json();
    if (!res.ok) { showAuthError('login-error', data.error || 'Қате'); return; }
    saveAuth(data.token, data.name);
    closeAuthModal();
  } catch { showAuthError('login-error', 'Желі қатесі'); }
}

async function submitRegister() {
  const name     = (document.getElementById('reg-name').value     || '').trim();
  const contact  = (document.getElementById('reg-contact').value  || '').trim();
  const password = (document.getElementById('reg-password').value || '').trim();
  if (!name || !contact || !password) {
    showAuthError('reg-error', 'Барлық өрістерді толтыр'); return;
  }
  try {
    const res  = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contact, password })
    });
    const data = await res.json();
    if (!res.ok) { showAuthError('reg-error', data.error || 'Қате'); return; }
    saveAuth(data.token, data.name);
    closeAuthModal();
  } catch { showAuthError('reg-error', 'Желі қатесі'); }
}

function escAuthHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Close on overlay click
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeAuthModal();
    });
  }
  updateNavAuthArea();
});
