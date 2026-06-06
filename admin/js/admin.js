/* ═══════════════════════════════════════════════════════
   DISCOVER VAAVU – Admin Panel v2
   Fixed: image paths, auto-collect on publish,
          single-step publish flow, token UX
═══════════════════════════════════════════════════════ */

const REPO         = 'Anoof12/discover-vaavu';
const CONTENT_PATH = 'data/content.json';
const ADMIN_PATH   = 'data/admin.json';
const API          = 'https://api.github.com';

let siteData = null;   // live content.json in memory
let fileSHA  = null;   // current file SHA on GitHub
let adminCfg = null;   // admin.json (password hash)

/* ══════════════════════════════════════════
   BOOT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  adminCfg = await fetchAdminConfig();

  if (isLoggedIn()) {
    showShell();
    await loadContent();
  } else {
    document.getElementById('loginScreen').classList.remove('hidden');
  }

  initLogin();
  initNavigation();
  initSidebar();
  initPublish();
  initSettings();
  initTokenBanner();
});

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
function isLoggedIn() { return sessionStorage.getItem('dv_admin') === '1'; }

function initLogin() {
  const form  = document.getElementById('loginForm');
  const input = document.getElementById('loginPass');
  const err   = document.getElementById('loginError');

  document.getElementById('togglePass').addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const hash   = await sha256(input.value.trim());
    const stored = adminCfg?.passwordHash || 'd08d2cff6926fcee3437879d79ca7ef40088757a3817709fdb3c1364ae1989fe';
    if (hash === stored) {
      sessionStorage.setItem('dv_admin', '1');
      showShell();
      await loadContent();
    } else {
      err.textContent = 'Incorrect password. Try again.';
      input.value = '';
      input.focus();
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('dv_admin');
    location.reload();
  });
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function showShell() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminShell').classList.remove('hidden');
}

/* ══════════════════════════════════════════
   LOAD CONTENT
══════════════════════════════════════════ */
async function fetchAdminConfig() {
  try {
    const r = await fetch(`${API}/repos/${REPO}/contents/${ADMIN_PATH}`, { headers: ghHeaders() });
    if (!r.ok) return null;
    const j = await r.json();
    return JSON.parse(atob(j.content.replace(/\n/g, '')));
  } catch { return null; }
}

async function loadContent() {
  setStatus('loading', '⟳ Loading…');
  const token = getToken();

  if (token) {
    try {
      const r = await fetch(`${API}/repos/${REPO}/contents/${CONTENT_PATH}`, { headers: ghHeaders() });
      if (r.ok) {
        const j  = await r.json();
        fileSHA  = j.sha;
        siteData = JSON.parse(atob(j.content.replace(/\n/g, '')));
        setStatus('success', '✓ Connected to GitHub');
        populateForms();
        return;
      }
    } catch { /* fall through to local */ }
  }

  /* Fallback: load from local file */
  try {
    const r = await fetch('../data/content.json?v=' + Date.now());
    siteData = await r.json();
    setStatus('', token ? '⚠ GitHub load failed – showing local data' : '⚠ No token – add one in Settings');
  } catch {
    siteData = defaultContent();
    setStatus('', 'Using defaults');
  }
  populateForms();
}

/* ══════════════════════════════════════════
   IMAGE PATH HELPER
   Fixes assets/ paths for use inside /admin/
══════════════════════════════════════════ */
function adminImg(path) {
  if (!path) return '';
  if (path.startsWith('assets/')) return '../' + path;
  return path;
}

/* ══════════════════════════════════════════
   POPULATE FORMS
══════════════════════════════════════════ */
function populateForms() {
  if (!siteData) return;
  const { hero, stats, about, excursions, contact } = siteData;

  setVal('heroTagline',    hero.tagline);
  setVal('heroTitleInput', hero.title);
  setVal('heroSubtitle',   hero.subtitle);
  setVal('heroDesc',       hero.description);

  setVal('statGuests',       stats.guests);
  setVal('statExcursions',   stats.excursionTypes);
  setVal('statSatisfaction', stats.satisfaction);
  setVal('statExperience',   stats.experience);

  setVal('aboutBody1', about.body1);
  setVal('aboutBody2', about.body2);

  setVal('contactAddress',   contact.address);
  setVal('contactPhone',     contact.phone);
  setVal('contactEmail',     contact.email);
  setVal('contactHours',     contact.hours);
  setVal('contactFacebook',  contact.facebook);
  setVal('contactInstagram', contact.instagram);

  document.getElementById('dashExCount').textContent =
    excursions.filter(e => e.active !== false).length;

  renderExcursionList();
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el && v !== undefined) el.value = v;
}

/* ══════════════════════════════════════════
   COLLECT ALL FORM DATA INTO siteData
   Called automatically before every publish
══════════════════════════════════════════ */
function collectAllFormData() {
  if (!siteData) return;

  siteData.hero.tagline     = document.getElementById('heroTagline').value.trim();
  siteData.hero.title       = document.getElementById('heroTitleInput').value.trim();
  siteData.hero.subtitle    = document.getElementById('heroSubtitle').value.trim();
  siteData.hero.description = document.getElementById('heroDesc').value.trim();

  siteData.stats.guests         = +document.getElementById('statGuests').value || 0;
  siteData.stats.excursionTypes = +document.getElementById('statExcursions').value || 0;
  siteData.stats.satisfaction   = +document.getElementById('statSatisfaction').value || 0;
  siteData.stats.experience     = +document.getElementById('statExperience').value || 0;

  siteData.about.body1 = document.getElementById('aboutBody1').value.trim();
  siteData.about.body2 = document.getElementById('aboutBody2').value.trim();

  siteData.contact.address   = document.getElementById('contactAddress').value.trim();
  siteData.contact.phone     = document.getElementById('contactPhone').value.trim();
  siteData.contact.email     = document.getElementById('contactEmail').value.trim();
  siteData.contact.hours     = document.getElementById('contactHours').value.trim();
  siteData.contact.facebook  = document.getElementById('contactFacebook').value.trim();
  siteData.contact.instagram = document.getElementById('contactInstagram').value.trim();
}

/* ══════════════════════════════════════════
   EXCURSION LIST
══════════════════════════════════════════ */
function renderExcursionList() {
  const list = document.getElementById('excursionList');
  if (!list || !siteData) return;
  list.innerHTML = '';

  siteData.excursions.forEach((ex, idx) => {
    const card = document.createElement('div');
    card.className = `ex-admin-card${ex.active === false ? ' inactive' : ''}`;
    card.innerHTML = `
      <span class="drag-handle">⠿</span>
      <div class="ex-admin-thumb" style="background-image:url('${adminImg(ex.image)}')"></div>
      <div class="ex-admin-info">
        <h4>${ex.title}</h4>
        <div class="ex-admin-meta">
          <span class="ex-meta-tag">${ex.tagLabel || ''}</span>
          <span class="ex-meta-tag">${ex.price || ex.duration || ''}</span>
          <span class="ex-meta-tag ${ex.active === false ? 'inactive' : ''}">${ex.active === false ? 'Hidden' : 'Active'}</span>
        </div>
      </div>
      <div class="ex-admin-actions">
        <button class="btn-edit-ex" data-idx="${idx}">Edit</button>
        <button class="btn-del-ex"  data-idx="${idx}">Delete</button>
      </div>`;
    list.appendChild(card);
  });

  list.querySelectorAll('.btn-edit-ex').forEach(b =>
    b.addEventListener('click', () => openDrawer(+b.dataset.idx))
  );
  list.querySelectorAll('.btn-del-ex').forEach(b =>
    b.addEventListener('click', () => deleteExcursion(+b.dataset.idx))
  );
}

/* ── Drawer ── */
let editingIdx = null;

document.getElementById('addExcursionBtn').addEventListener('click', () => openDrawer(null));
document.getElementById('drawerClose').addEventListener('click',    closeDrawer);
document.getElementById('drawerCancel').addEventListener('click',   closeDrawer);
document.getElementById('drawerOverlay').addEventListener('click',  closeDrawer);

document.getElementById('exImage').addEventListener('input', function () {
  document.getElementById('exImgPreview').style.backgroundImage =
    this.value ? `url('${adminImg(this.value)}')` : '';
});

function openDrawer(idx) {
  editingIdx = idx;
  document.getElementById('drawerTitle').textContent = idx === null ? 'Add Excursion' : 'Edit Excursion';

  if (idx !== null) {
    const ex = siteData.excursions[idx];
    setVal('exId',        ex.id);
    setVal('exTitle',     ex.title);
    setVal('exTagLabel',  ex.tagLabel);
    setVal('exImage',     ex.image);
    setVal('exPrice',     ex.price);
    setVal('exCategory',  ex.category);
    setVal('exShortDesc', ex.shortDesc);
    setVal('exFullDesc',  ex.fullDesc);
    setVal('exDuration',  ex.duration);
    setVal('exGroupSize', ex.groupSize);
    setVal('exTiming',    ex.timing);
    setVal('exExtraMeta', ex.extraMeta);
    setVal('exIncludes',  (ex.includes || []).join('\n'));
    setVal('exNote',      ex.note);
    document.getElementById('exActive').checked = ex.active !== false;
    document.getElementById('exImgPreview').style.backgroundImage =
      ex.image ? `url('${adminImg(ex.image)}')` : '';
  } else {
    ['exId','exTitle','exTagLabel','exImage','exPrice','exShortDesc',
     'exFullDesc','exDuration','exGroupSize','exTiming','exExtraMeta','exIncludes','exNote']
      .forEach(id => setVal(id, ''));
    document.getElementById('exActive').checked = true;
    document.getElementById('exImgPreview').style.backgroundImage = '';
  }

  document.getElementById('drawerOverlay').classList.add('open');
  document.getElementById('excursionDrawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('excursionDrawer').classList.remove('open');
  editingIdx = null;
}

document.getElementById('drawerSave').addEventListener('click', () => {
  const title = document.getElementById('exTitle').value.trim();
  if (!title) { toast('Title is required', 'err'); return; }

  const ex = {
    id:        document.getElementById('exId').value.trim() || slugify(title),
    title,
    category:  document.getElementById('exCategory').value,
    tagLabel:  document.getElementById('exTagLabel').value.trim() || capFirst(document.getElementById('exCategory').value),
    image:     document.getElementById('exImage').value.trim(),
    price:     document.getElementById('exPrice').value.trim(),
    shortDesc: document.getElementById('exShortDesc').value.trim(),
    fullDesc:  document.getElementById('exFullDesc').value.trim(),
    duration:  document.getElementById('exDuration').value.trim(),
    groupSize: document.getElementById('exGroupSize').value.trim(),
    timing:    document.getElementById('exTiming').value.trim(),
    extraMeta: document.getElementById('exExtraMeta').value.trim(),
    includes:  document.getElementById('exIncludes').value.split('\n').map(s => s.trim()).filter(Boolean),
    note:      document.getElementById('exNote').value.trim(),
    active:    document.getElementById('exActive').checked
  };

  if (editingIdx === null) {
    siteData.excursions.push(ex);
    toast('✓ Excursion added — click Publish to go live', 'ok');
  } else {
    siteData.excursions[editingIdx] = ex;
    toast('✓ Excursion updated — click Publish to go live', 'ok');
  }

  renderExcursionList();
  document.getElementById('dashExCount').textContent =
    siteData.excursions.filter(e => e.active !== false).length;
  closeDrawer();
});

function deleteExcursion(idx) {
  if (!confirm(`Delete "${siteData.excursions[idx].title}"?`)) return;
  siteData.excursions.splice(idx, 1);
  renderExcursionList();
  toast('Excursion deleted — click Publish to go live', 'ok');
}

/* ══════════════════════════════════════════
   PUBLISH  (collects ALL form data first)
══════════════════════════════════════════ */
function initPublish() {
  document.getElementById('publishBtn').addEventListener('click', publish);
}

async function publish() {
  const token = getToken();
  if (!token) {
    toast('⚠ Add a GitHub token in Settings first', 'err');
    switchSection('settings');
    return;
  }
  if (!siteData) { toast('No data to publish', 'err'); return; }

  /* ← KEY FIX: always collect latest form values before encoding */
  collectAllFormData();

  const btn = document.getElementById('publishBtn');
  btn.disabled = true;
  setStatus('loading', '⟳ Publishing…');

  try {
    /* Get latest SHA to avoid conflicts */
    const check = await fetch(`${API}/repos/${REPO}/contents/${CONTENT_PATH}`, { headers: ghHeaders() });
    if (check.ok) fileSHA = (await check.json()).sha;

    /* Encode JSON → base64 using TextEncoder (handles all Unicode safely) */
    const jsonStr = JSON.stringify(siteData, null, 2);
    const bytes   = new TextEncoder().encode(jsonStr);
    let   binary  = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    const content = btoa(binary);

    const body = { message: 'Update site content via admin panel', content };
    if (fileSHA) body.sha = fileSHA;

    const r = await fetch(`${API}/repos/${REPO}/contents/${CONTENT_PATH}`, {
      method:  'PUT',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });

    if (!r.ok) {
      const errJson = await r.json().catch(() => ({}));
      throw new Error(errJson.message || `HTTP ${r.status}`);
    }

    fileSHA = (await r.json()).content.sha;
    setStatus('success', '✓ Published!');
    toast('🚀 Published! Site updates in ~1 minute.', 'ok');
  } catch (e) {
    console.error('Publish error:', e);
    setStatus('error', '✗ Failed');
    toast(`✗ ${e.message}`, 'err');
  } finally {
    btn.disabled = false;
  }
}

/* ══════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════ */
function initSettings() {
  const tokenInput = document.getElementById('githubToken');

  document.getElementById('toggleToken').addEventListener('click', () => {
    tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
  });

  tokenInput.value = getToken();

  document.getElementById('saveTokenBtn').addEventListener('click', () => {
    const t = tokenInput.value.trim();
    if (!t) { toast('Paste a token first', 'err'); return; }
    localStorage.setItem('dv_gh_token', t);
    toast('✓ Token saved', 'ok');
    initTokenBanner();
    loadContent();
  });

  document.getElementById('testTokenBtn').addEventListener('click', async () => {
    const t   = tokenInput.value.trim();
    const msg = document.getElementById('tokenMsg');
    if (!t) { msg.className = 'pass-msg err'; msg.textContent = 'Enter a token first.'; return; }
    msg.className = 'pass-msg'; msg.textContent = 'Testing…';
    try {
      const r = await fetch(`${API}/repos/${REPO}`, {
        headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json' }
      });
      if (r.ok) {
        const j = await r.json();
        msg.className = 'pass-msg ok';
        msg.textContent = `✓ Connected! Repo: ${j.full_name}`;
      } else {
        const e = await r.json();
        msg.className = 'pass-msg err';
        msg.textContent = `✗ ${e.message || 'Invalid token'}`;
      }
    } catch {
      msg.className = 'pass-msg err';
      msg.textContent = '✗ Network error.';
    }
  });

  document.getElementById('changePassBtn').addEventListener('click', changePassword);
}

async function changePassword() {
  const current = document.getElementById('currentPass').value;
  const newPw   = document.getElementById('newPass').value;
  const confirm = document.getElementById('confirmPass').value;
  const msg     = document.getElementById('passMsg');

  const stored  = adminCfg?.passwordHash || 'd08d2cff6926fcee3437879d79ca7ef40088757a3817709fdb3c1364ae1989fe';
  if (await sha256(current) !== stored) {
    msg.className = 'pass-msg err'; msg.textContent = 'Current password is incorrect.'; return;
  }
  if (newPw.length < 8) {
    msg.className = 'pass-msg err'; msg.textContent = 'New password must be at least 8 characters.'; return;
  }
  if (newPw !== confirm) {
    msg.className = 'pass-msg err'; msg.textContent = 'Passwords do not match.'; return;
  }

  const token = getToken();
  if (!token) {
    msg.className = 'pass-msg err'; msg.textContent = 'GitHub token required.'; return;
  }

  try {
    const newHash = await sha256(newPw);
    const newCfg  = { ...adminCfg, passwordHash: newHash };
    const bytes   = new TextEncoder().encode(JSON.stringify(newCfg, null, 2));
    let   binary  = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    const content = btoa(binary);

    const gr  = await fetch(`${API}/repos/${REPO}/contents/${ADMIN_PATH}`, { headers: ghHeaders() });
    const gj  = await gr.json();

    await fetch(`${API}/repos/${REPO}/contents/${ADMIN_PATH}`, {
      method: 'PUT',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Update admin password', content, sha: gj.sha })
    });

    adminCfg = newCfg;
    msg.className = 'pass-msg ok'; msg.textContent = '✓ Password updated!';
    ['currentPass','newPass','confirmPass'].forEach(id => document.getElementById(id).value = '');
  } catch {
    msg.className = 'pass-msg err'; msg.textContent = 'Failed — check your GitHub token.';
  }
}

/* ══════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════ */
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection(item.dataset.section);
      if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('mobile-open');
    });
  });
  document.querySelectorAll('.dash-card[data-section]').forEach(card =>
    card.addEventListener('click', () => switchSection(card.dataset.section))
  );
  document.getElementById('goToSettings')?.addEventListener('click', (e) => {
    e.preventDefault(); switchSection('settings');
  });
}

function switchSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById(`sec-${name}`)?.classList.remove('hidden');
  document.querySelector(`.nav-item[data-section="${name}"]`)?.classList.add('active');
  const titles = {
    dashboard: 'Dashboard', hero: 'Hero Section', stats: 'Stats',
    about: 'About', excursions: 'Excursions', contact: 'Contact Info', settings: 'Settings'
  };
  document.getElementById('topbarTitle').textContent = titles[name] || name;
}

/* ══════════════════════════════════════════
   SIDEBAR TOGGLE
══════════════════════════════════════════ */
function initSidebar() {
  document.getElementById('sidebarToggle').addEventListener('click', () =>
    document.getElementById('sidebar').classList.toggle('mobile-open')
  );
}

/* ══════════════════════════════════════════
   TOKEN BANNER
══════════════════════════════════════════ */
function initTokenBanner() {
  const box = document.getElementById('tokenInfoBox');
  if (box) box.style.display = getToken() ? 'none' : 'block';
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function getToken() { return localStorage.getItem('dv_gh_token') || ''; }

function ghHeaders(token) {
  const t = token || getToken();
  const h = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

function setStatus(type, text) {
  const el = document.getElementById('publishStatus');
  el.className   = `publish-status ${type}`;
  el.textContent = text;
}

let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function capFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function defaultContent() {
  return {
    hero: { tagline: 'Welcome to', title: 'Discover Vaavu',
            subtitle: 'Islandbreak Excursion · V. Fulidhoo, Maldives',
            description: 'Dive into the crystal-clear waters of Vaavu Atoll.' },
    stats: { guests: 500, excursionTypes: 9, satisfaction: 100, experience: 5 },
    about: { body1: '', body2: '' },
    excursions: [],
    contact: { address: '', phone: '', email: '', hours: '', facebook: '#', instagram: '#' }
  };
}

window.addEventListener('beforeunload', e => {
  if (document.querySelector('.drawer.open')) { e.preventDefault(); e.returnValue = ''; }
});
