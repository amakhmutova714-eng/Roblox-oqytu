const AUTH_TOKEN_KEY   = 'roblox_auth_token';
const AUTH_NAME_KEY    = 'roblox_auth_name';
const AUTH_PREMIUM_KEY = 'roblox_is_premium';

function getAuthToken()  { return localStorage.getItem(AUTH_TOKEN_KEY); }
function getAuthName()   { return localStorage.getItem(AUTH_NAME_KEY);  }
function isPremium()     { return localStorage.getItem(AUTH_PREMIUM_KEY) === 'true'; }

function saveAuth(token, name, premium) {
  localStorage.setItem(AUTH_TOKEN_KEY,   token);
  localStorage.setItem(AUTH_NAME_KEY,    name);
  localStorage.setItem(AUTH_PREMIUM_KEY, premium ? 'true' : 'false');
  updateNavAuthArea();
  // Refresh premium status from server
  refreshPremiumStatus();
}

function logout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_NAME_KEY);
  localStorage.removeItem(AUTH_PREMIUM_KEY);
  updateNavAuthArea();
}

function isLoggedIn() { return !!getAuthToken(); }

async function refreshPremiumStatus() {
  const token = getAuthToken();
  if (!token) return;
  try {
    const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return;
    const data = await res.json();
    localStorage.setItem(AUTH_PREMIUM_KEY, data.isPremium ? 'true' : 'false');
    updateNavAuthArea();
    if (typeof rebuildLessonView === 'function') rebuildLessonView();
  } catch {}
}

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

let _authOpenedForLessons = false;

function openAuthModal(tab, forLessons) {
  _authOpenedForLessons = !!forLessons;
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
    saveAuth(data.token, data.name, data.isPremium);
    closeAuthModal();
    if (_authOpenedForLessons) showPage('sabaqtar');
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
    saveAuth(data.token, data.name, data.isPremium);
    closeAuthModal();
    if (_authOpenedForLessons) showPage('sabaqtar');
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
  initWelcomePopup();
});

/* ══════════════════════════════════════════════════════════════
   WELCOME POPUP
══════════════════════════════════════════════════════════════ */
const WELCOME_KEY = 'roblox_welcome_agreed';

function initWelcomePopup() {
  if (localStorage.getItem(WELCOME_KEY) === 'yes') return;
  const overlay = document.getElementById('welcome-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
  }
}

function welcomeCheckChange() {
  const checked = document.getElementById('welcome-checkbox').checked;
  const btn = document.getElementById('welcome-yes-btn');
  btn.disabled = !checked;
}

function welcomeAgree() {
  localStorage.setItem(WELCOME_KEY, 'yes');
  const overlay = document.getElementById('welcome-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s';
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
  }
}

function welcomeDecline() {
  window.history.back();
  setTimeout(() => { window.location.href = 'about:blank'; }, 300);
}

/* ══════════════════════════════════════════════════════════════
   ADMIN PANEL (embedded in main site)
══════════════════════════════════════════════════════════════ */
const ADMIN_TOKEN_KEY = 'roblox_admin_token';
let admStudentsData = [];
let admActivityData = [];

function getAdminToken()  { return localStorage.getItem(ADMIN_TOKEN_KEY); }

function adminPanelLogin() {
  const pw = (document.getElementById('admin-pw-input').value || '').trim();
  if (!pw) return;
  fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  }).then(r => r.json()).then(data => {
    if (data.error) {
      const el = document.getElementById('admin-login-err');
      el.textContent = data.error;
      el.style.display = 'block';
      return;
    }
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    adminShowDashboard();
  }).catch(() => {});
}

function adminShowDashboard() {
  document.getElementById('admin-login-wrap').style.display    = 'none';
  document.getElementById('admin-dashboard-wrap').style.display = '';
  adminLoadAll();
}

function adminPanelLogout() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  document.getElementById('admin-login-wrap').style.display    = '';
  document.getElementById('admin-dashboard-wrap').style.display = 'none';
  document.getElementById('admin-pw-input').value = '';
}

function adminLoadAll() {
  adminLoadStats();
  adminLoadStudents();
}

async function adminLoadStats() {
  const token = getAdminToken();
  const res = await fetch('/api/admin/stats', { headers: { 'Authorization': 'Bearer ' + token } });
  if (!res.ok) return;
  const d = await res.json();
  document.getElementById('adm-stat-students').textContent = d.totalStudents;
  document.getElementById('adm-stat-visits').textContent   = d.totalVisits;
  document.getElementById('adm-stat-today').textContent    = d.todayVisits;
}

async function adminLoadStudents() {
  const token = getAdminToken();
  const res = await fetch('/api/admin/students', { headers: { 'Authorization': 'Bearer ' + token } });
  if (!res.ok) return;
  admStudentsData = await res.json();
  adminRenderStudents(admStudentsData);
}

async function adminLoadActivity() {
  const token = getAdminToken();
  const res = await fetch('/api/admin/activity', { headers: { 'Authorization': 'Bearer ' + token } });
  if (!res.ok) return;
  admActivityData = await res.json();
  adminRenderActivity(admActivityData);
}

function adminRenderStudents(list) {
  const tbody = document.getElementById('adm-students-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:2rem;">Оқушы жоқ</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(s => `
    <tr id="student-row-${s._id}">
      <td><strong>${escAuthHtml(s.name)}</strong></td>
      <td style="color:var(--text2)">${escAuthHtml(s.contact)}</td>
      <td style="color:var(--text2)">${adminFmtDate(s.registeredAt)}</td>
      <td style="color:var(--text2)">${adminFmtDate(s.lastSeenAt)}</td>
      <td><span class="adm-badge-green">${s.lessonsOpened} сабақ</span></td>
      <td><span class="adm-badge-blue">${s.totalVisits} рет</span></td>
      <td>
        <button class="adm-premium-btn ${s.isPremium ? 'active' : ''}"
          onclick="adminTogglePremium('${s._id}', this)">
          ${s.isPremium ? '⭐ Premium' : '— Тегін'}
        </button>
      </td>
    </tr>`).join('');
}

async function adminTogglePremium(studentId, btn) {
  const token = getAdminToken();
  btn.disabled = true;
  const res = await fetch('/api/admin/toggle-premium/' + studentId, {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();
  btn.disabled = false;
  if (data.isPremium !== undefined) {
    btn.classList.toggle('active', data.isPremium);
    btn.textContent = data.isPremium ? '⭐ Premium' : '— Тегін';
    const student = admStudentsData.find(s => s._id == studentId);
    if (student) student.isPremium = data.isPremium;
  }
}

function adminRenderActivity(list) {
  const tbody = document.getElementById('adm-activity-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text2);padding:2rem;">Тарих жоқ</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(a => `
    <tr>
      <td><strong>${escAuthHtml(a.studentName)}</strong></td>
      <td style="color:var(--text2)">${escAuthHtml(a.lessonTitle || a.lessonId)}</td>
      <td style="color:var(--text2)">${adminFmtDate(a.visitedAt)}</td>
    </tr>`).join('');
}

function adminFilterStudents() {
  const q = document.getElementById('adm-student-search').value.toLowerCase();
  adminRenderStudents(admStudentsData.filter(s =>
    s.name.toLowerCase().includes(q) || s.contact.toLowerCase().includes(q)
  ));
}

function adminFilterActivity() {
  const q = document.getElementById('adm-activity-search').value.toLowerCase();
  adminRenderActivity(admActivityData.filter(a =>
    (a.studentName||'').toLowerCase().includes(q) ||
    (a.lessonTitle||'').toLowerCase().includes(q)
  ));
}

function adminShowTab(id, btn) {
  document.getElementById('adm-tab-students').style.display = id === 'students' ? '' : 'none';
  document.getElementById('adm-tab-activity').style.display = id === 'activity' ? '' : 'none';
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (id === 'activity' && admActivityData.length === 0) adminLoadActivity();
}

function adminFmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function adminInitPage() {
  if (getAdminToken()) adminShowDashboard();
}
