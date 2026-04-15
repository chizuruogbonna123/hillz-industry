/* ══════════════════════════════════════════
   ROLES & PERMISSIONS
══════════════════════════════════════════ */
const ROLES = {
  admin:   { label:'👑 Admin',   cls:'rb-admin',   canWrite:true,  canDelete:true,  canManageUsers:true },
  manager: { label:'🛠 Manager', cls:'rb-manager', canWrite:true,  canDelete:false, canManageUsers:false },
  viewer:  { label:'👁 Viewer',  cls:'rb-viewer',  canWrite:false, canDelete:false, canManageUsers:false },
};
let selectedRegRole = 'admin';

function selectRegRole(el) {
  document.querySelectorAll('.role-opt').forEach(r => r.className = 'role-opt');
  const role = el.dataset.role;
  el.classList.add(`active-${role}`);
  selectedRegRole = role;
}

function applyRoleUI() {
  const role = currentUser?.role || 'viewer';
  const perm = ROLES[role] || ROLES.viewer;
  document.querySelectorAll('.write-only').forEach(el => {
    el.style.display = perm.canWrite ? '' : 'none';
  });
  document.querySelectorAll('.write-only-form').forEach(el => {
    el.style.display = perm.canWrite ? '' : 'none';
  });
  const navUsers = document.getElementById('nav-users');
  if (navUsers) navUsers.style.display = perm.canManageUsers ? 'flex' : 'none';
  const badge = document.getElementById('role-badge-sidebar');
  badge.textContent = perm.label;
  badge.className = `role-badge-sidebar ${perm.cls}`;
  const heroBadge = document.getElementById('hero-role-badge');
  if (heroBadge) heroBadge.textContent = perm.label;
  document.getElementById('sidebar-role-lbl').textContent = perm.label;
}

/* ══════════════════════════════════════════
   AUTH SYSTEM
══════════════════════════════════════════ */
const AUTH_USERS_KEY   = 'hillz_v3_auth_users';
const AUTH_SESSION_KEY = 'hillz_v3_auth_session';
let authStorageFallback = { users: null, session: null };

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    if (key === AUTH_USERS_KEY) return authStorageFallback.users;
    if (key === AUTH_SESSION_KEY) return authStorageFallback.session;
    return null;
  }
}
function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (key === AUTH_USERS_KEY) authStorageFallback.users = value;
    if (key === AUTH_SESSION_KEY) authStorageFallback.session = value;
  }
}
function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    if (key === AUTH_USERS_KEY) authStorageFallback.users = null;
    if (key === AUTH_SESSION_KEY) authStorageFallback.session = null;
  }
}

function getAuthUsers() {
  try {
    const raw = safeStorageGet(AUTH_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveAuthUsers(users) {
  safeStorageSet(AUTH_USERS_KEY, JSON.stringify(users));
}
function getAuthSession() {
  try {
    const raw = safeStorageGet(AUTH_SESSION_KEY);
    if (!raw) return null;
    const { username } = JSON.parse(raw);
    return getAuthUsers().find(u => u.username === username) || null;
  } catch (e) {
    return null;
  }
}
function setAuthSession(username) {
  safeStorageSet(AUTH_SESSION_KEY, JSON.stringify({ username, created: Date.now() }));
}
function clearAuthSession() {
  safeStorageRemove(AUTH_SESSION_KEY);
}
function initAuthUsers() {
  const users = getAuthUsers();
  if (!users.length) {
    saveAuthUsers([{ username: 'admin', name: 'Admin User', password: 'admin', role: 'admin', joinDate: new Date().toLocaleDateString() }]);
  }
}
initAuthUsers();

function apiSession() {
  const user = getAuthSession();
  return Promise.resolve({ user: user ? { username: user.username, name: user.name, role: user.role, joinDate: user.joinDate } : null });
}
function apiLogin(username, password) {
  const users = getAuthUsers();
  const user = users.find(u => u.username === username);
  if (!user || user.password !== password) {
    return Promise.reject(new Error('Invalid username or password.'));
  }
  setAuthSession(username);
  return Promise.resolve({ username: user.username, name: user.name, role: user.role, joinDate: user.joinDate });
}
function apiRegister(payload) {
  const users = getAuthUsers();
  if (users.some(u => u.username === payload.username)) {
    return Promise.reject(new Error('Username is already taken.'));
  }
  const newUser = {
    username: payload.username,
    name: payload.name,
    password: payload.password,
    role: payload.role || 'viewer',
    joinDate: new Date().toLocaleDateString(),
  };
  users.push(newUser);
  saveAuthUsers(users);
  return Promise.resolve({ username: newUser.username, name: newUser.name, role: newUser.role, joinDate: newUser.joinDate });
}
function apiLogout() {
  clearAuthSession();
  return Promise.resolve({ ok: true });
}
function apiChangePassword(payload) {
  const sessionUser = getAuthSession();
  if (!sessionUser) return Promise.reject(new Error('No active session.'));
  const users = getAuthUsers();
  const user = users.find(u => u.username === sessionUser.username);
  if (!user) return Promise.reject(new Error('No active user.'));
  if (user.password !== payload.currentPassword) return Promise.reject(new Error('Current password is incorrect.'));
  if (payload.newPassword.length < 6) return Promise.reject(new Error('New password must be at least 6 characters.'));
  if (payload.newPassword !== payload.confirmPassword) return Promise.reject(new Error('New passwords do not match.'));
  user.password = payload.newPassword;
  saveAuthUsers(users);
  return Promise.resolve({ ok: true });
}
function apiGetUsers() {
  const users = getAuthUsers();
  return Promise.resolve(users.map(u => ({ username: u.username, name: u.name, role: u.role, joinDate: u.joinDate })));
}
function apiUpdateUserRole(username, role) {
  const users = getAuthUsers();
  const user = users.find(u => u.username === username);
  if (!user) return Promise.reject(new Error('User not found.'));
  user.role = role;
  saveAuthUsers(users);
  return Promise.resolve({ username: user.username, name: user.name, role: user.role, joinDate: user.joinDate });
}
function apiDeleteUser(username) {
  const users = getAuthUsers();
  const index = users.findIndex(u => u.username === username);
  if (index === -1) return Promise.reject(new Error('User not found.'));
  users.splice(index, 1);
  saveAuthUsers(users);
  const sessionUser = getAuthSession();
  if (sessionUser?.username === username) clearAuthSession();
  return Promise.resolve({ ok: true });
}
function apiFetch(path, opts = {}) {
  const init = {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  };
  if (opts.body && typeof opts.body !== 'string') {
    init.body = JSON.stringify(opts.body);
  }
  return fetch(path, init).then(async res => {
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = data?.error || data?.message || res.statusText || 'Request failed';
      throw new Error(err);
    }
    return data;
  });
}

let currentUser = null;

function switchTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('form-login').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? '' : 'none';
  clearAuthMessages();
}

function clearAuthMessages() {
  ['login-err','reg-err','reg-ok'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('show'); el.textContent = ''; }
  });
}

function showErr(id, msg) { const el = document.getElementById(id); if(el){el.textContent = msg; el.classList.add('show');} }
function showOk(id, msg)  { const el = document.getElementById(id); if(el){el.textContent = msg; el.classList.add('show');} }

function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

function checkPwStrength(pw) {
  const wrap = document.getElementById('pw-strength-wrap');
  const fill = document.getElementById('pw-strength-fill');
  const lbl  = document.getElementById('pw-strength-label');
  if (!pw) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const score = getPwScore(pw);
  const configs = [{w:'20%',bg:'var(--rose)',t:'Weak'},{w:'50%',bg:'#f59e0b',t:'Fair'},{w:'75%',bg:'var(--sky)',t:'Good'},{w:'100%',bg:'var(--green)',t:'Strong'}];
  const c = configs[Math.min(score, 3)];
  fill.style.width = c.w; fill.style.background = c.bg;
  lbl.textContent = c.t; lbl.style.color = c.bg;
}
function checkPwStrength2(pw) {
  const wrap = document.getElementById('cpw-strength-wrap');
  const fill = document.getElementById('cpw-strength-fill');
  const lbl  = document.getElementById('cpw-strength-label');
  if (!pw) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const score = getPwScore(pw);
  const configs = [{w:'20%',bg:'var(--rose)',t:'Weak'},{w:'50%',bg:'#f59e0b',t:'Fair'},{w:'75%',bg:'var(--sky)',t:'Good'},{w:'100%',bg:'var(--green)',t:'Strong'}];
  const c = configs[Math.min(score, 3)];
  fill.style.width = c.w; fill.style.background = c.bg;
  lbl.textContent = c.t; lbl.style.color = c.bg;
}
function getPwScore(pw) {
  let s = 0;
  if (pw.length >= 6)  s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 3);
}

async function doLogin() {
  document.getElementById('login-err').classList.remove('show');
  const username = document.getElementById('l-user').value.trim();
  const password = document.getElementById('l-pass').value;
  if (!username || !password) { showErr('login-err', 'Please enter username and password.'); return; }
  try {
    const result = await apiLogin(username, password);
    currentUser = { username: result.username, name: result.name, role: result.role || 'viewer' };
    enterApp();
  } catch (err) {
    showErr('login-err', err.message);
    document.getElementById('l-pass').value = '';
  }
}

async function doRegister() {
  document.getElementById('reg-err').classList.remove('show');
  document.getElementById('reg-ok').classList.remove('show');
  const name  = document.getElementById('r-name').value.trim();
  const uname = document.getElementById('r-user').value.trim();
  const pass  = document.getElementById('r-pass').value;
  const pass2 = document.getElementById('r-pass2').value;
  if (!name)  { showErr('reg-err','Please enter your full name.'); return; }
  if (!uname) { showErr('reg-err','Please choose a username.'); return; }
  if (uname.length < 3) { showErr('reg-err','Username must be at least 3 characters.'); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(uname)) { showErr('reg-err','Username: letters, numbers and underscores only.'); return; }
  if (pass.length < 6)  { showErr('reg-err','Password must be at least 6 characters.'); return; }
  if (pass !== pass2)   { showErr('reg-err','Passwords do not match.'); return; }
  try {
    await apiRegister({ username: uname, name, password: pass, role: selectedRegRole });
    showOk('reg-ok', `✓ Account created as ${selectedRegRole}! Sign in as "${uname}".`);
    ['r-name','r-user','r-pass','r-pass2'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('pw-strength-wrap').style.display = 'none';
    setTimeout(() => switchTab('login'), 1600);
  } catch (err) {
    showErr('reg-err', err.message);
  }
}

function enterApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.add('visible');
  const displayName = currentUser.name || currentUser.username;
  document.getElementById('sidebar-username').textContent = displayName;
  document.getElementById('hero-username').textContent    = displayName;
  document.getElementById('user-av-initials').textContent = displayName.charAt(0).toUpperCase();
  applyRoleUI();
  loadState();
  renderAll();
  tick();
  pushNotif({ type:'success', ico:'👋', title:`Welcome back, ${displayName}!`, msg:`You're signed in as ${ROLES[currentUser.role].label}. ${new Date().toLocaleString()}`, cat:'info' });
  setTimeout(checkReminders, 800);
}

async function doLogout() {
  if (!confirm('Sign out?')) return;
  try {
    await apiLogout();
  } catch (err) {
    console.warn('Logout failed:', err.message);
  }
  currentUser = null;
  toggleUserMenu(true);
  notifications = [];
  document.getElementById('app').classList.remove('visible');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('l-user').value = '';
  document.getElementById('l-pass').value = '';
  clearAuthMessages();
  closeMobileSidebar();
}

let userMenuOpen = false;
function toggleUserMenu(forceClose) {
  userMenuOpen = forceClose ? false : !userMenuOpen;
  document.getElementById('user-dropdown').classList.toggle('open', userMenuOpen);
  document.getElementById('user-chevron').textContent = userMenuOpen ? '▲' : '▼';
}
document.addEventListener('click', e => {
  if (!document.getElementById('user-menu-btn')?.contains(e.target) &&
      !document.getElementById('user-dropdown')?.contains(e.target)) {
    if (userMenuOpen) toggleUserMenu(true);
  }
  const panel = document.getElementById('notif-panel');
  const notifBtns = document.querySelectorAll('.notif-btn');
  let clickedNotifBtn = false;
  notifBtns.forEach(b => { if(b.contains(e.target)) clickedNotifBtn = true; });
  if (!panel.classList.contains('hidden') && !panel.contains(e.target) && !clickedNotifBtn) {
    panel.classList.add('hidden');
  }
});

function openChangePassword() {
  toggleUserMenu(true);
  ['cpw-current','cpw-new','cpw-confirm'].forEach(id => document.getElementById(id).value = '');
  ['cpw-err','cpw-ok'].forEach(id => { const e=document.getElementById(id); if(e){e.classList.remove('show'); e.textContent='';} });
  document.getElementById('cpw-strength-wrap').style.display = 'none';
  document.getElementById('mo-cpw').classList.add('open');
}
function closeCpw() { document.getElementById('mo-cpw').classList.remove('open'); }

async function doChangePassword() {
  const cur  = document.getElementById('cpw-current').value;
  const nw   = document.getElementById('cpw-new').value;
  const conf = document.getElementById('cpw-confirm').value;
  ['cpw-err','cpw-ok'].forEach(id => { const e=document.getElementById(id); if(e){e.classList.remove('show'); e.textContent='';} });
  if (!cur || !nw || !conf) { showErr('cpw-err','All fields are required.'); return; }
  try {
    await apiChangePassword({ currentPassword: cur, newPassword: nw, confirmPassword: conf });
    showOk('cpw-ok','✓ Password updated successfully!');
    ['cpw-current','cpw-new','cpw-confirm'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('cpw-strength-wrap').style.display = 'none';
    pushNotif({ type:'success', ico:'🔑', title:'Password Changed', msg:'Your password was updated successfully.', cat:'info' });
    setTimeout(() => closeCpw(), 1400);
  } catch (err) {
    showErr('cpw-err', err.message);
  }
}

(async function checkSession() {
  try {
    const session = await apiSession();
    if (session?.user) {
      currentUser = session.user;
      enterApp();
    }
  } catch (err) {
    console.warn('No active session:', err.message);
  }
})();

/* ══════════════════════════════════════════
   MOBILE SIDEBAR
══════════════════════════════════════════ */
function toggleMobileSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const hamburger= document.getElementById('hamburger-btn');
  const open = sidebar.classList.toggle('mobile-open');
  overlay.classList.toggle('show', open);
  hamburger.classList.toggle('open', open);
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.remove('show');
  document.getElementById('hamburger-btn').classList.remove('open');
}

/* ══════════════════════════════════════════
   NOTIFICATIONS SYSTEM
══════════════════════════════════════════ */
let notifications = [];
let notifFilter = 'all';
let notifPanelOpen = false;

function pushNotif({ type='info', ico='🔔', title, msg, cat='info' }) {
  const n = {
    id: Date.now() + Math.random(),
    type, ico, title, msg, cat,
    time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
    unread: true
  };
  notifications.unshift(n);
  if (notifications.length > 50) notifications.pop();
  updateNotifBadges();
  renderNotifPanel();
  showNotifToast(n);
}

function showNotifToast(n) {
  const container = document.getElementById('notif-toast-container');
  const el = document.createElement('div');
  el.className = `notif-toast-item ${n.type}`;
  el.innerHTML = `<div class="notif-toast-title">${n.ico} ${n.title}</div><div class="notif-toast-msg">${n.msg}</div>`;
  el.onclick = () => el.remove();
  container.appendChild(el);
  setTimeout(() => { if(el.parentNode) el.remove(); }, 4000);
}

function updateNotifBadges() {
  const unread = notifications.filter(n => n.unread).length;
  ['notif-badge-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = unread > 9 ? '9+' : unread;
    el.classList.toggle('hidden', unread === 0);
  });
  const udCount = document.getElementById('ud-notif-count');
  if (udCount) udCount.textContent = unread > 0 ? unread : '';
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  notifPanelOpen = !notifPanelOpen;
  panel.classList.toggle('hidden', !notifPanelOpen);
  if (notifPanelOpen) renderNotifPanel();
}

function setNotifTab(f, el) {
  notifFilter = f;
  document.querySelectorAll('.ntab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderNotifPanel();
}

function markAllRead() {
  notifications.forEach(n => n.unread = false);
  updateNotifBadges();
  renderNotifPanel();
}

function deleteNotif(id) {
  notifications = notifications.filter(n => n.id !== id);
  updateNotifBadges();
  renderNotifPanel();
}

function renderNotifPanel() {
  const list = document.getElementById('notif-list');
  let filtered = [...notifications];
  if (notifFilter === 'unread') filtered = filtered.filter(n => n.unread);
  else if (notifFilter !== 'all') filtered = filtered.filter(n => n.cat === notifFilter);
  if (!filtered.length) {
    list.innerHTML = `<div class="notif-empty-state"><div style="font-size:28px;opacity:.3;margin-bottom:8px;">🔔</div><div style="font-size:13px;">${notifications.length ? 'No notifications in this category' : 'No notifications yet'}</div></div>`;
    return;
  }
  list.innerHTML = filtered.map(n => `
    <div class="notif-item ${n.unread?'unread':''}" onclick="markNotifRead(${n.id})">
      <div class="notif-item-ico">${n.ico}</div>
      <div class="notif-item-body">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-msg">${n.msg}</div>
        <div class="notif-item-time">${n.time}</div>
      </div>
      <button class="notif-item-del" onclick="event.stopPropagation();deleteNotif(${n.id})">✕</button>
    </div>`).join('');
}

function markNotifRead(id) {
  const n = notifications.find(x => x.id === id);
  if (n) { n.unread = false; updateNotifBadges(); renderNotifPanel(); }
}

function checkReminders() {
  const urgentNotes = S.notes.filter(n => n.cat === 'urgent' && n.pinned);
  if (urgentNotes.length) {
    pushNotif({ type:'warning', ico:'🔴', title:`${urgentNotes.length} Urgent Pinned Note${urgentNotes.length>1?'s':''}`, msg:`You have urgent pinned notes. Check Notes section.`, cat:'warning' });
  }
  const matCost = S.materials.reduce((s,m) => s+m.totalCost, 0);
  const rev     = S.products.reduce((s,p) => s+p.totalRev, 0);
  if (matCost > 0 && rev > 0 && matCost > rev) {
    pushNotif({ type:'warning', ico:'⚠️', title:'Loss Alert', msg:`Materials cost (${fmt(matCost)}) exceeds revenue (${fmt(rev)}). Review finances.`, cat:'warning' });
  }
  const inactive = S.workers.filter(w => w.status === 'inactive').length;
  if (inactive > 0) {
    pushNotif({ type:'info', ico:'👤', title:`${inactive} Inactive Worker${inactive>1?'s':''}`, msg:'Some workers are marked inactive. Review HR.', cat:'info' });
  }
}

/* ══════════════════════════════════════════
   USER MANAGEMENT
══════════════════════════════════════════ */
let editingUserUsername = null;

async function renderUsersSection() {
  if (!currentUser || ROLES[currentUser.role]?.canManageUsers !== true) return;
  let users = [];
  try {
    users = await apiGetUsers();
  } catch (err) {
    console.warn('Failed to load users:', err.message);
  }
  const list  = document.getElementById('users-list');
  document.getElementById('users-count-lbl').textContent = `${users.length} user${users.length!==1?'s':''}`;
  if (!users.length) {
    list.innerHTML = `<div class="empty"><div class="empty-ico">👥</div><div style="font-size:13px;">No users</div></div>`;
    return;
  }
  const avC = ['av-g','av-t','av-r','av-v','av-gr','av-s'];
  list.innerHTML = users.map((u, i) => {
    const role = ROLES[u.role] || ROLES.viewer;
    const isSelf = u.username === currentUser.username;
    return `<div class="user-row">
      <div class="av ${avC[i%avC.length]}" style="width:38px;height:38px;font-size:14px;">${u.name.charAt(0).toUpperCase()}</div>
      <div class="user-row-info">
        <div class="user-row-name">${u.name} ${isSelf?'<span style="font-size:10px;color:var(--gold);font-weight:600;">(you)</span>':''}</div>
        <div class="user-row-meta">@${u.username} · Joined ${u.joinDate||'—'}</div>
      </div>
      <span class="badge ${role.cls.replace('rb-','b-').replace('admin','gold').replace('manager','teal').replace('viewer','violet')}">${role.label}</span>
      <div class="user-row-actions">
        ${!isSelf ? `<button class="btn btn-edit btn-sm" onclick="openEditUser('${u.username}')">✏️ Role</button>` : ''}
        ${!isSelf ? `<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.username}')">Remove</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function openEditUser(username) {
  const users = await apiGetUsers();
  const user  = users.find(u => u.username === username);
  if (!user) return;
  editingUserUsername = username;
  document.getElementById('edit-user-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg3);border-radius:var(--r2);margin-bottom:16px;">
      <div class="av av-g" style="width:40px;height:40px;font-size:15px;">${user.name.charAt(0).toUpperCase()}</div>
      <div><div style="font-weight:600;">${user.name}</div><div style="font-size:12px;color:var(--text3);">@${user.username}</div></div>
    </div>
    <div class="fg"><label>Role</label>
      <select id="edit-user-role" style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r3);padding:9px 11px;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);outline:none;width:100%;">
        <option value="admin"   ${user.role==='admin'   ?'selected':''}>👑 Admin — full access</option>
        <option value="manager" ${user.role==='manager' ?'selected':''}>🛠 Manager — read/write</option>
        <option value="viewer"  ${user.role==='viewer'  ?'selected':''}>👁 Viewer — read only</option>
      </select>
    </div>`;
  openMo('mo-edit-user');
}

async function saveUserRole() {
  const newRole = document.getElementById('edit-user-role').value;
  try {
    await apiUpdateUserRole(editingUserUsername, newRole);
    closeMo('mo-edit-user');
    renderUsersSection();
    toast(`✓ ${editingUserUsername}'s role updated to ${newRole}`);
    pushNotif({ type:'info', ico:'👥', title:'User Role Updated', msg:`@${editingUserUsername} is now a ${newRole}.`, cat:'info' });
  } catch (err) {
    toast(`⚠️ ${err.message}`);
  }
}

async function deleteUser(username) {
  if (!confirm(`Remove user "${username}"? This cannot be undone.`)) return;
  try {
    await apiDeleteUser(username);
    renderUsersSection();
    toast('✓ User removed');
    pushNotif({ type:'warning', ico:'🗑️', title:'User Removed', msg:`Account @${username} was deleted.`, cat:'warning' });
  } catch (err) {
    toast(`⚠️ ${err.message}`);
  }
}

/* ══════════════════════════════════════════
   APP STATE
══════════════════════════════════════════ */
let S = { workers:[], departments:[], materials:[], products:[], customers:[], notes:[], activity:[] };
let matEditId=null, prodEditId=null, workerEditId=null;
let wFilter='all', wSearch='', matSearch='', prodSearch='';

function loadState() { try { const d=localStorage.getItem('hillz_v3'); if(d) S=JSON.parse(d); } catch(e){} }
function saveState() { localStorage.setItem('hillz_v3', JSON.stringify(S)); }

function canWrite() { return ROLES[currentUser?.role]?.canWrite === true; }
function canDelete(){ return ROLES[currentUser?.role]?.canDelete === true; }

/* NAV */
function nav(id, el) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  el.classList.add('active');
  closeMobileSidebar();
  if (id === 'users') renderUsersSection();
  else renderAll();
}

/* MODALS */
function openMo(id) { document.getElementById(id).classList.add('open'); if(id==='mo-worker') popDeptSel('wm-dept'); }
function closeMo(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.mo').forEach(m => m.addEventListener('click', e=>{ if(e.target===m) m.classList.remove('open'); }));

/* HELPERS */
function fmt(n) { return '₦'+Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2}); }
const avColors=['av-g','av-t','av-r','av-v','av-gr','av-s'];
function makeAvatar(name,i){ return `<div class="av ${avColors[i%avColors.length]}">${name.charAt(0).toUpperCase()}</div>`; }
function makeAvatarLarge(name,i,size=54){ return `<div class="wdetail-av ${avColors[i%avColors.length]}" style="width:${size}px;height:${size}px;">${name.charAt(0).toUpperCase()}</div>`; }

let toastTimer;
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.remove(), 2800);
}

function addActivity(msg,col) {
  S.activity.unshift({msg,col,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});
  if(S.activity.length>12) S.activity.pop();
}
function today(){ return new Date().toISOString().slice(0,10); }
function gv(id){ return document.getElementById(id)?.value || ''; }
function sv(id,v){ const el=document.getElementById(id); if(el) el.value=v; }

function updateShiftLabels(){
  const n=new Date();
  const dayStr=n.toLocaleDateString('en-NG',{weekday:'short',day:'numeric',month:'short'});
  const tomorrow=new Date(n); tomorrow.setDate(n.getDate()+1);
  const tmrStr=tomorrow.toLocaleDateString('en-NG',{weekday:'short',day:'numeric',month:'short'});
  document.getElementById('day-shift-label').textContent=`${dayStr} · 06:00–18:00`;
  document.getElementById('night-shift-label').textContent=`${dayStr} 18:00 – ${tmrStr} 06:00`;
}

/* ══ WORKERS ══ */
function popDeptSel(id){ const s=document.getElementById(id); if(!s)return; s.innerHTML='<option value="">— Select —</option>';S.departments.forEach(d=>{s.innerHTML+=`<option value="${d.name}">${d.name}</option>`;}); }
function openAddWorker(){ if(!canWrite()){toast('⛔ Viewer role cannot add records');return;} workerEditId=null;document.getElementById('mo-worker-title').innerHTML='Add Worker <button class="mo-close" onclick="closeMo(\'mo-worker\')">✕</button>';document.getElementById('wm-save-btn').textContent='Save Worker';['wm-name','wm-id','wm-role','wm-phone','wm-salary'].forEach(id=>sv(id,''));sv('wm-dept','');sv('wm-shift','day');sv('wm-status','active');openMo('mo-worker'); }
function openEditWorker(id){ if(!canWrite()){toast('⛔ No permission');return;} const w=S.workers.find(x=>x.id===id);if(!w)return;workerEditId=id;closeMo('mo-worker-detail');popDeptSel('wm-dept');sv('wm-name',w.name);sv('wm-id',w.empId);sv('wm-role',w.role);sv('wm-dept',w.dept||'');sv('wm-shift',w.shift);sv('wm-status',w.status);sv('wm-phone',w.phone||'');sv('wm-salary',w.salary||'');document.getElementById('mo-worker-title').innerHTML='✏️ Edit Worker <button class="mo-close" onclick="closeMo(\'mo-worker\')">✕</button>';document.getElementById('wm-save-btn').textContent='Update Worker';document.getElementById('mo-worker').classList.add('open'); }
function saveWorker(){
  if(!canWrite()){toast('⛔ No permission');return;}
  const name=gv('wm-name').trim();if(!name){alert('Enter name');return;}
  if(workerEditId!==null){
    const w=S.workers.find(x=>x.id===workerEditId);
    if(w){w.name=name;w.empId=gv('wm-id').trim()||w.empId;w.role=gv('wm-role').trim()||'Staff';w.dept=gv('wm-dept');w.shift=gv('wm-shift');w.status=gv('wm-status');w.phone=gv('wm-phone').trim();w.salary=parseFloat(gv('wm-salary'))||0;}
    workerEditId=null;toast(`✓ Worker "${name}" updated`);
    pushNotif({ type:'info', ico:'👤', title:'Worker Updated', msg:`${name}'s profile was updated.`, cat:'info' });
  } else {
    const w={id:Date.now(),name,empId:gv('wm-id').trim()||`EMP-${String(S.workers.length+1).padStart(3,'0')}`,role:gv('wm-role').trim()||'Staff',dept:gv('wm-dept'),shift:gv('wm-shift'),status:gv('wm-status'),phone:gv('wm-phone').trim(),salary:parseFloat(gv('wm-salary'))||0,dateAdded:new Date().toLocaleDateString()};
    S.workers.push(w);
    addActivity(`👤 Worker "${w.name}" added`,w.status==='active'?'green':'rose');
    toast(`✓ Worker "${w.name}" added`);
    pushNotif({ type:'success', ico:'👤', title:'Worker Added', msg:`${w.name} (${w.role}) joined ${w.dept||'no dept'} — ${w.shift} shift.`, cat:'info' });
  }
  saveState();closeMo('mo-worker');renderAll();
}
function openWorkerDetail(id){
  const w=S.workers.find(x=>x.id===id);if(!w)return;
  const idx=S.workers.indexOf(w);
  document.getElementById('worker-detail-content').innerHTML=`
    <div class="wdetail-header">${makeAvatarLarge(w.name,idx)}
      <div><div class="wdetail-name">${w.name}</div><div class="wdetail-role">${w.role}${w.dept?' · '+w.dept:''}</div>
        <div style="margin-top:8px;"><span class="badge ${w.status==='active'?'b-green':'b-rose'}"><span class="bdot"></span>${w.status==='active'?'Active':'Inactive'}</span>&nbsp;<span class="badge ${w.shift==='day'?'b-gold':'b-violet'}"><span class="bdot"></span>${w.shift==='day'?'☀️ Day Shift':'🌙 Night Shift'}</span></div>
      </div>
    </div>
    <div class="wdetail-grid">
      <div class="wdetail-field"><div class="wdetail-label">Employee ID</div><div class="wdetail-val mono">${w.empId}</div></div>
      <div class="wdetail-field"><div class="wdetail-label">Department</div><div class="wdetail-val">${w.dept||'— Not assigned'}</div></div>
      <div class="wdetail-field"><div class="wdetail-label">Phone</div><div class="wdetail-val mono">${w.phone||'—'}</div></div>
      <div class="wdetail-field"><div class="wdetail-label">Salary</div><div class="wdetail-val mono" style="color:var(--gold)">${w.salary?fmt(w.salary):'—'}</div></div>
      <div class="wdetail-field"><div class="wdetail-label">Shift</div><div class="wdetail-val">${w.shift==='day'?'☀️ Day (06:00–18:00)':'🌙 Night (18:00–06:00)'}</div></div>
      <div class="wdetail-field"><div class="wdetail-label">Date Added</div><div class="wdetail-val mono">${w.dateAdded||'—'}</div></div>
    </div>`;
  const editBtn = document.getElementById('wdetail-edit-btn');
  const delBtn  = document.getElementById('wdetail-del-btn');
  if (editBtn) { editBtn.style.display = canWrite() ? '' : 'none'; editBtn.onclick=()=>openEditWorker(id); }
  if (delBtn)  { delBtn.style.display  = canDelete() ? '' : 'none'; delBtn.onclick=()=>{ if(!confirm(`Remove ${w.name}?`))return; S.workers=S.workers.filter(x=>x.id!==id); saveState(); closeMo('mo-worker-detail'); renderAll(); toast('Worker removed'); pushNotif({type:'warning',ico:'👤',title:'Worker Removed',msg:`${w.name} was removed from the roster.`,cat:'warning'}); }; }
  openMo('mo-worker-detail');
}
function delWorker(id){ if(!canDelete()){toast('⛔ No permission to delete');return;} if(!confirm('Remove worker?'))return;S.workers=S.workers.filter(w=>w.id!==id);saveState();renderAll();toast('Worker removed'); }
function togWorker(id){ if(!canWrite()){toast('⛔ No permission');return;} const w=S.workers.find(x=>x.id===id);if(!w)return;w.status=w.status==='active'?'inactive':'active';saveState();renderAll();toast(`Status → ${w.status}`); }
function filterWorkers(q){ wSearch=q.toLowerCase();renderWorkers(); }
function setWF(f,el){ wFilter=f;document.querySelectorAll('.ftab').forEach(t=>t.classList.remove('active'));el.classList.add('active');renderWorkers(); }
function renderWorkers(){
  const grid=document.getElementById('workers-grid');
  const list=S.workers.filter(w=>{ const ms=!wSearch||w.name.toLowerCase().includes(wSearch)||w.role.toLowerCase().includes(wSearch);const mf=wFilter==='all'||w.status===wFilter;return ms&&mf; });
  if(!list.length){ grid.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-ico">👤</div><div style="font-size:13px;">No workers found</div></div>`;return; }
  const wr=canWrite(), dl=canDelete();
  grid.innerHTML=list.map((w,i)=>`
    <div class="wcard" onclick="openWorkerDetail(${w.id})">
      <div class="wc-hd">${makeAvatar(w.name,i)}<div><div class="wc-nm">${w.name}</div><div class="wc-rl">${w.role}${w.dept?' · '+w.dept:''}</div></div><div style="margin-left:auto"><span class="badge ${w.status==='active'?'b-green':'b-rose'}"><span class="bdot"></span>${w.status==='active'?'Active':'Inactive'}</span></div></div>
      <div class="wc-info"><div class="wc-row"><span class="wc-k">ID</span><span class="wc-v">${w.empId}</span></div><div class="wc-row"><span class="wc-k">Shift</span><span class="wc-v">${w.shift==='day'?'☀️ Day':'🌙 Night'}</span></div><div class="wc-row"><span class="wc-k">Phone</span><span class="wc-v">${w.phone||'—'}</span></div><div class="wc-row"><span class="wc-k">Salary</span><span class="wc-v">${w.salary?fmt(w.salary):'—'}</span></div></div>
      <div class="wc-foot" onclick="event.stopPropagation()">${wr?`<button class="btn btn-edit btn-sm" onclick="openEditWorker(${w.id})">✏️ Edit</button><button class="btn ${w.status==='active'?'btn-ghost':'btn-primary'} btn-sm" onclick="togWorker(${w.id})">${w.status==='active'?'Deactivate':'Activate'}</button>`:''} ${dl?`<button class="btn btn-danger btn-sm" onclick="delWorker(${w.id})">Remove</button>`:''}</div>
    </div>`).join('');
}

/* ══ DEPARTMENTS ══ */
function saveDept(){
  if(!canWrite()){toast('⛔ No permission');return;}
  const name=gv('dm-name').trim();if(!name){alert('Enter name');return;}
  const d={id:Date.now(),name,head:gv('dm-head').trim()||'TBD',icon:gv('dm-icon').trim()||'🏢',desc:gv('dm-desc').trim()};
  S.departments.push(d);saveState();
  addActivity(`🏢 Dept "${d.name}" created`,'teal');
  closeMo('mo-dept');['dm-name','dm-head','dm-icon','dm-desc'].forEach(id=>sv(id,''));
  renderAll();toast(`✓ Dept "${d.name}" added`);
  pushNotif({ type:'info', ico:'🏢', title:'Department Created', msg:`"${d.name}" department is now active.`, cat:'info' });
}
function delDept(id){ if(!canDelete()){toast('⛔ No permission');return;} if(!confirm('Remove dept?'))return;S.departments=S.departments.filter(d=>d.id!==id);saveState();closeMo('mo-dept-workers');renderAll(); }
function openDeptWorkers(id){
  const d=S.departments.find(x=>x.id===id);if(!d)return;
  const workers=S.workers.filter(w=>w.dept===d.name);
  document.getElementById('mo-dept-workers-title').innerHTML=`${d.icon} ${d.name} <button class="mo-close" onclick="closeMo('mo-dept-workers')">✕</button>`;
  const ac=workers.filter(w=>w.status==='active').length,dc=workers.filter(w=>w.shift==='day').length,nc=workers.filter(w=>w.shift==='night').length;
  document.getElementById('dept-workers-content').innerHTML=`
    <div class="dept-mo-header"><div class="dept-mo-ico">${d.icon}</div><div><div class="dept-mo-nm">${d.name}</div><div class="dept-mo-meta">Head: ${d.head}${d.desc?' · '+d.desc:''}</div><div style="display:flex;gap:7px;margin-top:7px;flex-wrap:wrap;"><span class="badge b-teal">${workers.length} worker${workers.length!==1?'s':''}</span><span class="badge b-green">${ac} active</span><span class="badge b-gold">${dc} day</span><span class="badge b-violet">${nc} night</span></div></div></div>
    ${workers.length?workers.map((w,i)=>`<div class="dept-worker-row">${makeAvatar(w.name,i)}<div class="dept-worker-info"><div class="dept-worker-name">${w.name}</div><div class="dept-worker-role">${w.role} · ${w.empId}</div></div><span class="badge ${w.shift==='day'?'b-gold':'b-violet'}">${w.shift==='day'?'☀️ Day':'🌙 Night'}</span><span class="badge ${w.status==='active'?'b-green':'b-rose'}" style="margin-left:5px;">${w.status==='active'?'Active':'Inactive'}</span></div>`).join(''):`<div class="empty" style="padding:30px 0;"><div class="empty-ico">👤</div><div style="font-size:13px;">No workers assigned yet</div></div>`}`;
  const delBtn = document.getElementById('dept-del-btn');
  if (delBtn) { delBtn.style.display = canDelete() ? '' : 'none'; delBtn.onclick=()=>delDept(id); }
  openMo('mo-dept-workers');
}
function renderDepts(){
  const g=document.getElementById('dept-grid');
  if(!S.departments.length){ g.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-ico">🏢</div><div style="font-size:13px;">No departments yet</div></div>`;return; }
  g.innerHTML=S.departments.map(d=>{ const wc=S.workers.filter(w=>w.dept===d.name).length,ac=S.workers.filter(w=>w.dept===d.name&&w.status==='active').length;return`<div class="dcard" onclick="openDeptWorkers(${d.id})"><div class="dcard-ico">${d.icon}</div><div class="dcard-nm">${d.name}</div><div class="dcard-cnt">${wc} worker${wc!==1?'s':''} · ${ac} active</div>${d.desc?`<div style="font-size:12px;color:var(--text3);margin-bottom:10px;">${d.desc}</div>`:''}<div style="font-size:12px;color:var(--text2);">Head: <strong>${d.head}</strong></div><div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);font-size:11px;color:var(--teal);font-weight:600;">Tap to view workers →</div></div>`; }).join('');
}

/* ══ MATERIALS ══ */
function matPreview(){ const q=parseFloat(gv('mf-qty'))||0,c=parseFloat(gv('mf-cost'))||0,costUnit=gv('mf-cost-unit')||'unit',t=q*c;const el=document.getElementById('mat-preview');if(el) el.textContent=t>0?`→ Total: ${fmt(t)} @ ${fmt(c)}/${costUnit}`:''; }
function saveMaterial(){
  if(!canWrite()){toast('⛔ No permission');return;}
  const name=gv('mf-name').trim();if(!name){alert('Enter material name');return;}
  const qty=parseFloat(gv('mf-qty'))||0,cost=parseFloat(gv('mf-cost'))||0,costUnit=gv('mf-cost-unit').trim()||'unit';
  if(matEditId!==null){ const m=S.materials.find(x=>x.id===matEditId);if(m){m.name=name;m.qty=qty;m.unit=costUnit;m.unitCost=cost;m.costUnit=costUnit;m.totalCost=qty*cost;m.date=gv('mf-date')||today();m.supplier=gv('mf-supplier').trim()||'—';}matEditId=null;document.getElementById('mat-form-title').textContent='📦 Add Material Purchase';const mc=document.getElementById('mat-cancel');if(mc) mc.style.display='none';toast('✓ Material updated'); }
  else { const m={id:Date.now(),name,qty,unit:costUnit,unitCost:cost,costUnit,date:gv('mf-date')||today(),supplier:gv('mf-supplier').trim()||'—',totalCost:qty*cost};S.materials.push(m);addActivity(`📦 Material "${name}" — ${fmt(qty*cost)}`,'rose');toast(`✓ Material "${name}" added`);
    pushNotif({ type:'info', ico:'📦', title:'Material Purchased', msg:`${name} · ${qty} ${m.unit} · ${fmt(qty*cost)} total.`, cat:'info' }); }
  saveState();['mf-name','mf-qty','mf-cost','mf-cost-unit','mf-date','mf-supplier'].forEach(id=>sv(id,''));const mp=document.getElementById('mat-preview');if(mp) mp.textContent='';renderMaterials();updateDash();
}
function editMaterial(id){ if(!canWrite()){toast('⛔ No permission');return;} const m=S.materials.find(x=>x.id===id);if(!m)return;matEditId=id;sv('mf-name',m.name);sv('mf-qty',m.qty);sv('mf-cost',m.unitCost);sv('mf-cost-unit',m.costUnit||m.unit);sv('mf-date',m.date);sv('mf-supplier',m.supplier==='—'?'':m.supplier);document.getElementById('mat-form-title').textContent='✏️ Edit Material';const mc=document.getElementById('mat-cancel');if(mc) mc.style.display='inline-flex';const mp=document.getElementById('mat-preview');if(mp) mp.textContent=`→ Total: ${fmt(m.totalCost)}`;document.querySelector('#materials .inline-form')?.scrollIntoView({behavior:'smooth',block:'start'});toast('✎ Edit mode'); }
function cancelMatEdit(){ matEditId=null;['mf-name','mf-qty','mf-cost','mf-cost-unit','mf-date','mf-supplier'].forEach(id=>sv(id,''));document.getElementById('mat-form-title').textContent='📦 Add Material Purchase';const mc=document.getElementById('mat-cancel');if(mc) mc.style.display='none';const mp=document.getElementById('mat-preview');if(mp) mp.textContent=''; }
function delMaterial(id){ if(!canDelete()){toast('⛔ No permission');return;} if(!confirm('Delete material?'))return;S.materials=S.materials.filter(m=>m.id!==id);saveState();renderMaterials();updateDash();toast('Material deleted'); }
function filterMats(q){ matSearch=q.toLowerCase();renderMaterials(); }
function renderMaterials(){
  const total=S.materials.reduce((s,m)=>s+m.totalCost,0),qty=S.materials.reduce((s,m)=>s+m.qty,0);
  const mt=document.getElementById('mat-total');if(mt) mt.textContent=fmt(total);
  const ms=document.getElementById('mat-summary');if(ms) ms.textContent=`${qty.toLocaleString()} items · ${S.materials.length} type${S.materials.length!==1?'s':''}`;
  const tbody=document.getElementById('mat-tbody');if(!tbody) return;
  const list=S.materials.filter(m=>!matSearch||m.name.toLowerCase().includes(matSearch)||m.supplier.toLowerCase().includes(matSearch));
  const cl=document.getElementById('mat-count-lbl');if(cl) cl.textContent=`${list.length} record${list.length!==1?'s':''}`;
  const wr=canWrite(), dl=canDelete();
  if(!list.length){ tbody.innerHTML=`<tr><td colspan="8" style="color:var(--text3);text-align:center;padding:30px;">${matSearch?'No matching materials':'No materials yet — add one above'}</td></tr>`;return; }
  tbody.innerHTML=list.map((m,i)=>`<tr><td class="tnum" style="color:var(--text3)">${i+1}</td><td style="font-weight:600;color:var(--text)">${m.name}</td><td><span class="badge b-teal">${m.qty.toLocaleString()} ${m.unit}</span></td><td class="tnum">${fmt(m.unitCost)}/${m.costUnit||m.unit}</td><td class="tnum" style="color:var(--rose);font-weight:700">${fmt(m.totalCost)}</td><td style="font-size:12px;color:var(--text2)">${m.date}</td><td style="font-size:12px;color:var(--text3)">${m.supplier}</td><td style="text-align:right"><div class="row-acts" style="justify-content:flex-end">${wr?`<button class="btn btn-edit btn-sm" onclick="editMaterial(${m.id})">✏️ Edit</button>`:''} ${dl?`<button class="btn btn-danger btn-sm" onclick="delMaterial(${m.id})">Delete</button>`:''}</div></td></tr>`).join('');
}

/* ══ PRODUCTS ══ */
function prodPreview(){ const q=parseFloat(gv('pf-qty'))||0,p=parseFloat(gv('pf-price'))||0,t=q*p;const el=document.getElementById('prod-preview');if(el) el.textContent=t>0?`→ Total: ${fmt(t)}`:''; }
function saveProduct(){
  if(!canWrite()){toast('⛔ No permission');return;}
  const name=gv('pf-name').trim();if(!name){alert('Enter product name');return;}
  const qty=parseFloat(gv('pf-qty'))||0,price=parseFloat(gv('pf-price'))||0,customer=gv('pf-customer').trim()||'Walk-in';
  if(prodEditId!==null){ const p=S.products.find(x=>x.id===prodEditId);if(p){const oc=S.customers.find(c=>c.name===p.customer);if(oc){oc.totalSpent=(oc.totalSpent||0)-p.totalRev;oc.totalQty=(oc.totalQty||0)-p.qty;}p.name=name;p.qty=qty;p.unitPrice=price;p.totalRev=qty*price;p.customer=customer;p.date=gv('pf-date')||today();p.notes=gv('pf-notes').trim();const nc=S.customers.find(c=>c.name===customer);if(nc){nc.totalSpent=(nc.totalSpent||0)+p.totalRev;nc.totalQty=(nc.totalQty||0)+qty;}}prodEditId=null;document.getElementById('prod-form-title').textContent='🏷️ Record New Sale';const pc=document.getElementById('prod-cancel');if(pc) pc.style.display='none';toast('✓ Sale updated'); }
  else { const p={id:Date.now(),name,qty,unitPrice:price,totalRev: qty*price,customer,date:gv('pf-date')||today(),notes:gv('pf-notes').trim()};S.products.push(p);const c=S.customers.find(x=>x.name===customer);if(c){c.totalSpent=(c.totalSpent||0)+p.totalRev;c.totalQty=(c.totalQty||0)+qty;}addActivity(`🏷️ Sale: "${name}" → ${customer} — ${fmt(qty*price)}`,'green');toast('✓ Sale recorded');
    pushNotif({ type:'success', ico:'🏷️', title:'Sale Recorded', msg:`${qty}x ${name} → ${customer} · ${fmt(qty*price)}.`, cat:'info' }); }
  saveState();['pf-name','pf-qty','pf-price','pf-customer','pf-date','pf-notes'].forEach(id=>sv(id,''));const pp=document.getElementById('prod-preview');if(pp) pp.textContent='';renderProducts();renderCustomers();updateDash();
}
function editProduct(id){ if(!canWrite()){toast('⛔ No permission');return;} const p=S.products.find(x=>x.id===id);if(!p)return;prodEditId=id;sv('pf-name',p.name);sv('pf-qty',p.qty);sv('pf-price',p.unitPrice);sv('pf-customer',p.customer==='Walk-in'?'':p.customer);sv('pf-date',p.date);sv('pf-notes',p.notes||'');document.getElementById('prod-form-title').textContent='✏️ Edit Sale Record';const pc=document.getElementById('prod-cancel');if(pc) pc.style.display='inline-flex';const pp=document.getElementById('prod-preview');if(pp) pp.textContent=`→ Total: ${fmt(p.totalRev)}`;document.querySelector('#products .inline-form')?.scrollIntoView({behavior:'smooth',block:'start'});toast('✎ Edit mode'); }
function cancelProdEdit(){ prodEditId=null;['pf-name','pf-qty','pf-price','pf-customer','pf-date','pf-notes'].forEach(id=>sv(id,''));document.getElementById('prod-form-title').textContent='🏷️ Record New Sale';const pc=document.getElementById('prod-cancel');if(pc) pc.style.display='none';const pp=document.getElementById('prod-preview');if(pp) pp.textContent=''; }
function delProduct(id){ if(!canDelete()){toast('⛔ No permission');return;} if(!confirm('Delete sale?'))return;const p=S.products.find(x=>x.id===id);if(p){const c=S.customers.find(x=>x.name===p.customer);if(c){c.totalSpent=(c.totalSpent||0)-p.totalRev;c.totalQty=(c.totalQty||0)-p.qty;}}S.products=S.products.filter(x=>x.id!==id);saveState();renderProducts();renderCustomers();updateDash();toast('Sale deleted'); }
function filterProds(q){ prodSearch=q.toLowerCase();renderProducts(); }
function renderProducts(){
  const total=S.products.reduce((s,p)=>s+p.totalRev,0),qty=S.products.reduce((s,p)=>s+p.qty,0);
  const pt=document.getElementById('prod-total');if(pt) pt.textContent=fmt(total);
  const types=[...new Set(S.products.map(p=>p.name))].length;
  const ps=document.getElementById('prod-summary');if(ps) ps.textContent=`${qty.toLocaleString()} units · ${types} product${types!==1?'s':''}`;
  const tbody=document.getElementById('prod-tbody');if(!tbody) return;
  const list=S.products.filter(p=>!prodSearch||p.name.toLowerCase().includes(prodSearch)||p.customer.toLowerCase().includes(prodSearch));
  const cl=document.getElementById('prod-count-lbl');if(cl) cl.textContent=`${list.length} record${list.length!==1?'s':''}`;
  const wr=canWrite(), dl=canDelete();
  if(!list.length){ tbody.innerHTML=`<tr><td colspan="9" style="color:var(--text3);text-align:center;padding:30px;">${prodSearch?'No matching products':'No sales yet — record one above'}</td></tr>`;return; }
  tbody.innerHTML=list.map((p,i)=>`<tr><td class="tnum" style="color:var(--text3)">${i+1}</td><td style="font-weight:600;color:var(--text)">${p.name}</td><td><span class="badge b-teal">${p.qty.toLocaleString()}</span></td><td class="tnum">${fmt(p.unitPrice)}</td><td class="tnum" style="color:var(--green);font-weight:700">${fmt(p.totalRev)}</td><td style="font-size:12px;color:var(--text2);font-weight:500">${p.customer}</td><td style="font-size:12px;color:var(--text3)">${p.date}</td><td style="font-size:12px;color:var(--text3);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.notes||'—'}</td><td style="text-align:right"><div class="row-acts" style="justify-content:flex-end">${wr?`<button class="btn btn-edit btn-sm" onclick="editProduct(${p.id})">✏️ Edit</button>`:''} ${dl?`<button class="btn btn-danger btn-sm" onclick="delProduct(${p.id})">Delete</button>`:''}</div></td></tr>`).join('');
}

/* ══ CUSTOMERS ══ */
function saveCustomer(){
  if(!canWrite()){toast('⛔ No permission');return;}
  const name=gv('cm-name').trim();if(!name){alert('Enter name');return;}
  const c={id:Date.now(),name,email:gv('cm-email').trim(),phone:gv('cm-phone').trim(),company:gv('cm-company').trim(),date:gv('cm-date')||today(),addr:gv('cm-addr').trim(),totalSpent:0,totalQty:0};
  S.customers.push(c);saveState();addActivity(`⭐ Customer "${c.name}" registered`,'violet');closeMo('mo-customer');
  ['cm-name','cm-email','cm-phone','cm-company','cm-date','cm-addr'].forEach(id=>sv(id,''));renderCustomers();updateDash();toast(`✓ Customer "${c.name}" added`);
  pushNotif({ type:'success', ico:'⭐', title:'New Customer', msg:`${c.name}${c.company?' ('+c.company+')':''} was registered.`, cat:'info' });
}
function delCustomer(id){ if(!canDelete()){toast('⛔ No permission');return;} if(!confirm('Remove customer?'))return;S.customers=S.customers.filter(c=>c.id!==id);saveState();renderCustomers();updateDash();toast('Customer removed'); }
function renderCustomers(){
  const tbody=document.getElementById('cust-tbody');if(!tbody) return;
  const dl=canDelete();
  if(!S.customers.length){ tbody.innerHTML=`<tr><td colspan="7" style="color:var(--text3);text-align:center;padding:30px;">No customers yet</td></tr>`;return; }
  const sorted=[...S.customers].sort((a,b)=>(b.totalSpent||0)-(a.totalSpent||0));
  const medals=['🥇','🥈','🥉'];
  tbody.innerHTML=sorted.map((c,i)=>`<tr><td><span style="font-family:'Syne',sans-serif;font-weight:800;font-size:15px;color:${i===0?'var(--gold)':i===1?'var(--text2)':'#cd7f32'}">${medals[i]||i+1}</span></td><td><div style="display:flex;align-items:center;gap:9px;">${makeAvatar(c.name,i)}<div><div style="font-weight:500;font-size:13px;">${c.name}</div>${c.company?`<div style="font-size:11px;color:var(--text3)">${c.company}</div>`:''}</div></div></td><td style="font-size:12px;color:var(--text2)">${c.email||c.phone||'—'}</td><td><span class="badge b-teal">${(c.totalQty||0).toLocaleString()} units</span></td><td class="tnum" style="color:var(--gold);font-weight:700">${fmt(c.totalSpent||0)}</td><td style="font-size:12px;color:var(--text3)">${c.date}</td><td>${dl?`<button class="btn btn-danger btn-sm" onclick="delCustomer(${c.id})">Remove</button>`:''}</td></tr>`).join('');
}

/* ══ SHIFTS ══ */
function renderShifts(){
  updateShiftLabels();
  const day=S.workers.filter(w=>w.shift==='day'),night=S.workers.filter(w=>w.shift==='night');
  const dc=document.getElementById('day-cnt');if(dc) dc.textContent=`${day.length} worker${day.length!==1?'s':''}`;
  const nc=document.getElementById('night-cnt');if(nc) nc.textContent=`${night.length} worker${night.length!==1?'s':''}`;
  const rt=(list,tbId)=>{ const tb=document.getElementById(tbId);if(!tb)return;if(!list.length){tb.innerHTML=`<tr><td colspan="3" style="color:var(--text3);text-align:center;padding:22px;">None assigned</td></tr>`;return;}tb.innerHTML=list.map((w,i)=>`<tr><td><div style="display:flex;align-items:center;gap:8px;">${makeAvatar(w.name,i)}<div><div style="font-weight:500;font-size:13px;">${w.name}</div><div style="font-size:10.5px;color:var(--text3)">${w.empId}</div></div></div></td><td style="font-size:12px;color:var(--text2)">${w.dept||'—'}</td><td><span class="badge ${w.status==='active'?'b-green':'b-rose'}">${w.status==='active'?'Active':'Inactive'}</span></td></tr>`).join(''); };
  rt(day,'day-tbody'); rt(night,'night-tbody');
}

/* ══ CALCULATOR ══ */
let cs={d:'0',expr:'',operand:null,op:null,wait:false},calcMem=0,calcMemSet=false,calcHistory=[];
function calcUpdate(){ document.getElementById('cnum').textContent=cs.d;document.getElementById('cexpr').textContent=cs.expr;document.getElementById('cmem-ind').textContent=calcMemSet?`M = ${calcMem}`:'';document.querySelectorAll('.mb').forEach(b=>b.classList.remove('mem-active'));if(calcMemSet)document.getElementById('mr-btn').classList.add('mem-active'); }
function cN(n){ if(cs.wait){cs.d=n;cs.wait=false;}else{cs.d=(cs.d==='0'&&n!=='.')?n:(cs.d.length<16?cs.d+n:cs.d);}calcUpdate(); }
function cDot(){ if(cs.wait){cs.d='0.';cs.wait=false;calcUpdate();return;}if(!cs.d.includes('.')){cs.d+='.';calcUpdate();} }
function cBack(){ cs.d=cs.d.length>1?cs.d.slice(0,-1):'0';calcUpdate(); }
function cOp(o){ const v=parseFloat(cs.d);if(cs.operand!==null&&!cs.wait){const r=calcDo(cs.operand,cs.op,v);cs.d=String(r);cs.operand=r;}else{cs.operand=v;}cs.op=o;const sym={'+':'+','-':'−','*':'×','/':'÷'}[o];cs.expr=`${cs.operand} ${sym}`;cs.wait=true;calcUpdate(); }
function calcDo(a,o,b){ let r;if(o==='+')r=a+b;else if(o==='-')r=a-b;else if(o==='*')r=a*b;else if(o==='/')r=b!==0?a/b:NaN;else r=b;if(isNaN(r))return'Error';return Math.round(r*1e10)/1e10; }
function cEq(){ if(cs.op===null)return;const v=parseFloat(cs.d),sym={'+':'+','-':'−','*':'×','/':'÷'}[cs.op];const r=calcDo(cs.operand,cs.op,v);const exprStr=`${cs.operand} ${sym} ${v}`;pushHistory(exprStr,String(r));cs.expr=exprStr+' =';cs.d=String(r);cs.operand=null;cs.op=null;cs.wait=true;calcUpdate(); }
function cAC(){ cs={d:'0',expr:'',operand:null,op:null,wait:false};calcUpdate(); }
function cSign(){ if(cs.d!=='0'&&cs.d!=='Error'){cs.d=cs.d.startsWith('-')?cs.d.slice(1):'-'+cs.d;calcUpdate();} }
function cPct(){ cs.d=String(Math.round(parseFloat(cs.d)/100*1e10)/1e10);calcUpdate(); }
function mAdd(){ calcMem=Math.round((calcMem+parseFloat(cs.d))*1e10)/1e10;calcMemSet=true;calcUpdate();toast(`M+ → ${calcMem}`); }
function mSub(){ calcMem=Math.round((calcMem-parseFloat(cs.d))*1e10)/1e10;calcMemSet=true;calcUpdate();toast(`M− → ${calcMem}`); }
function mStore(){ calcMem=parseFloat(cs.d);calcMemSet=true;calcUpdate();toast(`MS → ${calcMem}`); }
function mRecall(){ if(!calcMemSet){toast('Memory empty');return;}cs.d=String(calcMem);cs.wait=false;calcUpdate();toast(`MR → ${calcMem}`); }
function mClear(){ calcMem=0;calcMemSet=false;calcUpdate();toast('Memory cleared'); }
function pushHistory(expr,result){ calcHistory.unshift({expr,result,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});if(calcHistory.length>30)calcHistory.pop();renderHistory(); }
function clearHistory(){ calcHistory=[];renderHistory(); }
function loadHistResult(val){ cs.d=val;cs.wait=false;calcUpdate();toast(`Loaded: ${val}`); }
function renderHistory(){ const el=document.getElementById('calc-hist-list');if(!el)return;if(!calcHistory.length){el.innerHTML=`<div class="hist-empty">No calculations yet.</div>`;return;}el.innerHTML=calcHistory.map(h=>`<div class="hist-item" onclick="loadHistResult('${h.result}')"><div><div class="hist-expr">${h.expr}</div><div style="font-size:9.5px;color:var(--text3);font-family:'JetBrains Mono',monospace;margin-top:2px;">${h.time}</div></div><span class="hist-result">= ${h.result}</span></div>`).join(''); }
document.addEventListener('keydown',e=>{ if(!document.getElementById('calculator')?.classList.contains('active'))return;const tag=document.activeElement.tagName;if(tag==='INPUT'||tag==='TEXTAREA')return;if('0123456789'.includes(e.key))cN(e.key);else if(e.key==='.')cDot();else if(['+','-','*','/'].includes(e.key)){e.preventDefault();cOp(e.key);}else if(e.key==='Enter'||e.key==='='){e.preventDefault();cEq();}else if(e.key==='Escape')cAC();else if(e.key==='Backspace'){e.preventDefault();cBack();} });

/* ══ NOTES ══ */
let noteCategory='general',notesFilter='all',noteSearch='';let expandedNotes=new Set();
function selectCat(el){ document.querySelectorAll('.cat-opt').forEach(c=>{c.className='cat-opt';});const cat=el.dataset.cat;el.classList.add('sel-'+cat);noteCategory=cat; }
function updateCharCount(){ const val=document.getElementById('nt-body').value;const counter=document.getElementById('char-counter');if(counter){counter.textContent=`${val.length} / 1000`;counter.className='char-counter'+(val.length>900?' over':val.length>700?' near':'');} }
function saveNote(){ const title=document.getElementById('nt-title').value.trim(),body=document.getElementById('nt-body').value.trim();if(!body){alert('Write something first');return;}S.notes.unshift({id:Date.now(),title:title||'Untitled',body,cat:noteCategory,pinned:false,date:new Date().toLocaleString()});saveState();clearNoteForm();renderNotes();toast('✓ Note saved'); }
function clearNoteForm(){ sv('nt-title','');sv('nt-body','');updateCharCount();document.querySelectorAll('.cat-opt').forEach(c=>{c.className='cat-opt';});document.querySelector('.cat-opt[data-cat="general"]')?.classList.add('sel-general');noteCategory='general'; }
function delNote(id){ S.notes=S.notes.filter(n=>n.id!==id);expandedNotes.delete(id);saveState();renderNotes(); }
function pinNote(id){ const n=S.notes.find(x=>x.id===id);if(n){n.pinned=!n.pinned;saveState();renderNotes();} }
function toggleExpand(id){ if(expandedNotes.has(id))expandedNotes.delete(id);else expandedNotes.add(id);renderNotes(); }
function setNotesFilter(f,el){ notesFilter=f;document.querySelectorAll('.nftab').forEach(t=>t.classList.remove('active'));el.classList.add('active');renderNotes(); }
function filterNotes(q){ noteSearch=q.toLowerCase();renderNotes(); }
const catLabels={general:'📋 General',meeting:'🤝 Meeting',reminder:'⏰ Reminder',idea:'💡 Idea',urgent:'🔴 Urgent'};
function renderNotes(){
  const countEl=document.getElementById('notes-count');if(countEl) countEl.textContent=S.notes.length;
  const el=document.getElementById('notes-list');if(!el) return;
  let list=[...S.notes].sort((a,b)=>b.pinned-a.pinned);
  if(notesFilter==='pinned')list=list.filter(n=>n.pinned);else if(notesFilter!=='all')list=list.filter(n=>n.cat===notesFilter);
  if(noteSearch)list=list.filter(n=>n.title.toLowerCase().includes(noteSearch)||n.body.toLowerCase().includes(noteSearch));
  if(!list.length){el.innerHTML=`<div class="empty"><div class="empty-ico">📝</div><div style="font-size:13px;">${S.notes.length?'No matching notes':'No notes yet'}</div></div>`;return;}
  el.innerHTML=list.map(n=>{ const isLong=n.body.length>160,isExpanded=expandedNotes.has(n.id);return`<div class="note-item${n.pinned?' pinned':''}"><div class="note-item-header">${n.pinned?'<span style="font-size:12px;">📌</span>':''}<div class="note-ttl">${n.title}</div><div class="note-actions"><button class="note-pin-btn${n.pinned?' pinned-on':''}" onclick="pinNote(${n.id})" title="${n.pinned?'Unpin':'Pin'}">📌</button><button class="note-del-btn" onclick="delNote(${n.id})" title="Delete">✕</button></div></div><div class="note-body${isExpanded?' expanded':''}">${n.body}</div>${isLong?`<button class="note-expand-btn" onclick="toggleExpand(${n.id})">${isExpanded?'▲ Show less':'▼ Show more'}</button>`:''}<div class="note-footer"><span class="nbadge nbadge-${n.cat}">${catLabels[n.cat]}</span><span class="note-meta">${n.date}</span></div></div>`; }).join('');
}

/* ══ DASHBOARD ══ */
function updateDash(){
  const tw=S.workers.length,act=S.workers.filter(w=>w.status==='active').length,inact=tw-act;
  const day=S.workers.filter(w=>w.shift==='day').length,night=S.workers.filter(w=>w.shift==='night').length;
  const matCost=S.materials.reduce((s,m)=>s+m.totalCost,0),matQty=S.materials.reduce((s,m)=>s+m.qty,0);
  const rev=S.products.reduce((s,p)=>s+p.totalRev,0),revQty=S.products.reduce((s,p)=>s+p.qty,0);
  const net=rev-matCost;
  const setEl=(id,v)=>{ const e=document.getElementById(id);if(e) e.textContent=v; };
  setEl('k-workers',tw); setEl('k-workers-d',`${act} active · ${inact} inactive`); setEl('k-depts',S.departments.length);
  setEl('k-matcost',fmt(matCost)); setEl('k-matqty',matQty.toLocaleString()+' items'); setEl('k-revenue',fmt(rev)); setEl('k-prodqty',revQty.toLocaleString()+' units sold'); setEl('k-custs',S.customers.length);
  const pct=tw>0?Math.round(act/tw*100):0,circ=2*Math.PI*46;
  const arc=document.getElementById('donut-arc');if(arc) arc.setAttribute('stroke-dasharray',`${(pct/100)*circ} ${circ}`);
  setEl('donut-pct',pct+'%');
  const mx=tw||1;[['active',act],['inactive',inact],['day',day],['night',night]].forEach(([k,v])=>{ setEl(`d-${k}`,v);const bar=document.getElementById(`d-${k}-bar`);if(bar) bar.style.width=(v/mx*100)+'%'; });
  const sfm=document.getElementById('sf-mat');if(sfm) sfm.style.width='0%';
  const sfr=document.getElementById('sf-rev');if(sfr) sfr.style.width='0%';
  const bigger=Math.max(matCost,rev)||1;
  setTimeout(()=>{ if(sfm) sfm.style.width=(matCost/bigger*100)+'%'; if(sfr) sfr.style.width=(rev/bigger*100)+'%'; },100);
  setEl('sf-mat-v',fmt(matCost)); setEl('sf-rev-v',fmt(rev));
  const ne=document.getElementById('sf-net');if(ne){ne.textContent=fmt(Math.abs(net));ne.style.color=net>=0?'var(--green)':'var(--rose)';}
  setEl('sf-net-lbl',net>=0?'✓ Profit (revenue − materials)':'⚠ Loss (materials exceed revenue)');
  const ae=document.getElementById('dash-activity');const cm={green:'var(--green)',rose:'var(--rose)',teal:'var(--teal)',violet:'var(--violet)',gold:'var(--gold)'};
  if(ae) ae.innerHTML=S.activity.length?S.activity.map(a=>`<div class="act-item"><div class="act-dot" style="background:${cm[a.col]||'var(--gold)'};box-shadow:0 0 5px ${cm[a.col]||'var(--gold)'}"></div><div class="act-msg">${a.msg}</div><div class="act-time">${a.time}</div></div>`).join(''):`<div class="empty"><div class="empty-ico">📋</div><div style="font-size:13px;">No activity yet</div></div>`;
  const te=document.getElementById('dash-top-custs');const sc=[...S.customers].sort((a,b)=>(b.totalSpent||0)-(a.totalSpent||0)).slice(0,5);
  if(te) te.innerHTML=sc.length?sc.map((c,i)=>`<div class="top-cust"><div class="tc-rank" style="color:${i===0?'var(--gold)':i===1?'var(--text2)':'#cd7f32'}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>${makeAvatar(c.name,i)}<div class="tc-info"><div class="tc-name">${c.name}</div><div class="tc-meta">${(c.totalQty||0).toLocaleString()} units</div></div><div class="tc-amt">${fmt(c.totalSpent||0)}</div></div>`).join(''):`<div class="empty"><div class="empty-ico">⭐</div><div style="font-size:13px;">No customers yet</div></div>`;
  const de=document.getElementById('dash-depts-list');
  if(de) de.innerHTML=S.departments.length?S.departments.slice(0,5).map(d=>{const wc=S.workers.filter(w=>w.dept===d.name).length;return`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(28,32,48,.5);"><span style="font-size:18px;">${d.icon}</span><div style="flex:1;"><div style="font-size:13px;font-weight:500;">${d.name}</div><div style="font-size:11px;color:var(--text3)">${d.head}</div></div><span class="badge b-teal">${wc} workers</span></div>`;}).join(''):`<div class="empty" style="padding:16px 0;"><div style="font-size:13px;color:var(--text3);">No departments yet</div></div>`;
}

/* ══ CLOCK ══ */
function tick(){
  const n=new Date();
  const te=document.getElementById('dh-time');if(te) te.textContent=n.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const de=document.getElementById('dh-date');if(de) de.textContent=n.toLocaleDateString('en-NG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}
setInterval(tick,1000);

/* ══ INIT ══ */
function renderAll(){ renderWorkers();renderDepts();renderMaterials();renderProducts();renderCustomers();renderShifts();renderNotes();updateDash(); }
