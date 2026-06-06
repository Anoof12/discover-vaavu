/* ═══════════════════════════════════════════════════════
   DISCOVER VAAVU – Admin Panel
   Loads content.json from GitHub, lets admin edit,
   then commits changes back via GitHub Contents API.
═══════════════════════════════════════════════════════ */

const REPO          = 'Anoof12/discover-vaavu';
const CONTENT_PATH  = 'data/content.json';
const ADMIN_PATH    = 'data/admin.json';
const API           = 'https://api.github.com';

let siteData   = null;   // live content.json object
let fileSHA    = null;   // SHA of current content.json on GitHub (needed for PUT)
let adminCfg   = null;   // admin.json (password hash)
let unsaved    = false;  // dirty flag

/* ══════════════════════════════════════════
   BOOT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  adminCfg = await fetchAdminConfig();

  if (isLoggedIn()) {
    showShell();
    await loadContentData();
  } else {
    document.getElementById('loginScreen').classList.remove('hidden');
  }

  initLoginForm();
  initNavigation();
  initSidebar();
  initPublish();
  initSettings();
  initTokenInfo();
});

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
function isLoggedIn() {
  return sessionStorage.getItem('dv_admin') === '1';
}

function initLoginForm() {
  const form   = document.getElementById('loginForm');
  const toggle = document.getElementById('togglePass');
  const input  = document.getElementById('loginPass');
  const err    = document.getElementById('loginError');

  toggle.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const hash = await sha256(input.value.trim());
    const stored = adminCfg?.passwordHash || 'd08d2cff6926fcee3437879d79ca7ef40088757a3817709fdb3c1364ae1989fe';
    if (hash === stored) {
      sessionStorage.setItem('dv_admin', '1');
      document.getElementById('loginScreen').classList.add('hidden');
      showShell();
      await loadContentData();
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
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ══════════════════════════════════════════
   SHOW SHELL
══════════════════════════════════════════ */
function showShell() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminShell').classList.remove('hidden');
}

/* ══════════════════════════════════════════
   FETCH DATA FROM GITHUB
══════════════════════════════════════════ */
async function fetchAdminConfig() {
  try {
    const r = await fetch(`${API}/repos/${REPO}/contents/${ADMIN_PATH}`, { headers: ghHeaders() });
    if (!r.ok) return null;
    const j = await r.json();
    return JSON.parse(atob(j.content.replace(/\n/g, '')));
  } catch { return null; }
}

async function loadContentData() {
  setStatus('loading', '⟳ Loading…');
  try {
    const r = await fetch(`${API}/repos/${REPO}/contents/${CONTENT_PATH}`, { headers: ghHeaders() });
    if (r.status === 401 || r.status === 403) {
      setStatus('', 'No token – edits local only');
      await loadContentFallback();
      return;
    }
    if (!r.ok) throw new Error('API error');
    const j  = await r.json();
    fileSHA  = j.sha;
    siteData = JSON.parse(atob(j.content.replace(/\n/g, '')));
    setStatus('success', '✓ Loaded from GitHub');
  } catch {
    await loadContentFallback();
  }
  populateForms();
}

async function loadContentFallback() {
  try {
    const r = await fetch('../data/content.json?v=' + Date.now());
    siteData = await r.json();
    setStatus('', 'Loaded locally');
  } catch {
    siteData = defaultContent();
    setStatus('', 'Using defaults');
  }
  /* populateForms() intentionally omitted — loadContentData() always calls it */
}

/* ══════════════════════════════════════════
   POPULATE FORMS FROM siteData
══════════════════════════════════════════ */
function populateForms() {
  if (!siteData) return;
  const { hero, stats, about, excursions, contact } = siteData;

  /* Hero */
  val('heroTagline',   hero.tagline);
  val('heroTitleInput', hero.title);
  val('heroSubtitle',  hero.subtitle);
  val('heroDesc',      hero.description);

  /* Stats */
  val('statGuests',       stats.guests);
  val('statExcursions',   stats.excursionTypes);
  val('statSatisfaction', stats.satisfaction);
  val('statExperience',   stats.experience);

  /* About */
  val('aboutBody1', about.body1);
  val('aboutBody2', about.body2);

  /* Contact */
  val('contactAddress',   contact.address);
  val('contactPhone',     contact.phone);
  val('contactEmail',     contact.email);
  val('contactHours',     contact.hours);
  val('contactFacebook',  contact.facebook);
  val('contactInstagram', contact.instagram);

  /* Dashboard count */
  const active = excursions.filter(e => e.active !== false).length;
  document.getElementById('dashExCount').textContent = active;

  /* Excursion list */
  renderExcursionList();

  /* Save-section buttons */
  document.querySelectorAll('.btn-save').forEach(btn => {
    btn.onclick = () => saveSection(btn.dataset.target);
  });
}

function val(id, v) {
  const el = document.getElementById(id);
  if (el && v !== undefined) el.value = v;
}

/* ══════════════════════════════════════════
   SAVE SECTION (local edit only — publish separately)
══════════════════════════════════════════ */
function saveSection(target) {
  if (!siteData) return;

  if (target === 'hero') {
    siteData.hero.tagline     = document.getElementById('heroTagline').value.trim();
    siteData.hero.title       = document.getElementById('heroTitleInput').value.trim();
    siteData.hero.subtitle    = document.getElementById('heroSubtitle').value.trim();
    siteData.hero.description = document.getElementById('heroDesc').value.trim();
  }
  if (target === 'stats') {
    siteData.stats.guests          = +document.getElementById('statGuests').value;
    siteData.stats.excursionTypes  = +document.getElementById('statExcursions').value;
    siteData.stats.satisfaction    = +document.getElementById('statSatisfaction').value;
    siteData.stats.experience      = +document.getElementById('statExperience').value;
  }
  if (target === 'about') {
    siteData.about.body1 = document.getElementById('aboutBody1').value.trim();
    siteData.about.body2 = document.getElementById('aboutBody2').value.trim();
  }
  if (target === 'contact') {
    siteData.contact.address   = document.getElementById('contactAddress').value.trim();
    siteData.contact.phone     = document.getElementById('contactPhone').value.trim();
    siteData.contact.email     = document.getElementById('contactEmail').value.trim();
    siteData.contact.hours     = document.getElementById('contactHours').value.trim();
    siteData.contact.facebook  = document.getElementById('contactFacebook').value.trim();
    siteData.contact.instagram = document.getElementById('contactInstagram').value.trim();
  }

  unsaved = true;
  toast('✓ Saved locally — click Publish to go live', 'ok');
  setStatus('', '● Unpublished changes');
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
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <div class="ex-admin-thumb" style="background-image:url('${ex.image}')"></div>
      <div class="ex-admin-info">
        <h4>${ex.title}</h4>
        <div class="ex-admin-meta">
          <span class="ex-meta-tag">${ex.tagLabel}</span>
          <span class="ex-meta-tag">${ex.duration}</span>
          <span class="ex-meta-tag ${ex.active===false?'inactive':''}">${ex.active===false?'Hidden':'Active'}</span>
        </div>
      </div>
      <div class="ex-admin-actions">
        <button class="btn-edit-ex" data-idx="${idx}">Edit</button>
        <button class="btn-del-ex"  data-idx="${idx}">Delete</button>
      </div>`;
    list.appendChild(card);
  });

  list.querySelectorAll('.btn-edit-ex').forEach(btn =>
    btn.addEventListener('click', () => openDrawer(+btn.dataset.idx))
  );
  list.querySelectorAll('.btn-del-ex').forEach(btn =>
    btn.addEventListener('click', () => deleteExcursion(+btn.dataset.idx))
  );
}

/* ── Add / Edit drawer ── */
let editingIdx = null;

document.getElementById('addExcursionBtn').addEventListener('click', () => openDrawer(null));
document.getElementById('drawerClose').addEventListener('click',  closeDrawer);
document.getElementById('drawerCancel').addEventListener('click', closeDrawer);
document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);

document.getElementById('exImage').addEventListener('input', function() {
  const preview = document.getElementById('exImgPreview');
  preview.style.backgroundImage = this.value ? `url('${this.value}')` : '';
});

function openDrawer(idx) {
  editingIdx = idx;
  const isNew = idx === null;
  document.getElementById('drawerTitle').textContent = isNew ? 'Add Excursion' : 'Edit Excursion';

  if (!isNew) {
    const ex = siteData.excursions[idx];
    val('exId',        ex.id);
    val('exTitle',     ex.title);
    val('exTagLabel',  ex.tagLabel);
    val('exImage',     ex.image);
    val('exCategory',  ex.category);
    val('exShortDesc', ex.shortDesc);
    val('exFullDesc',  ex.fullDesc);
    val('exDuration',  ex.duration);
    val('exGroupSize', ex.groupSize);
    val('exTiming',    ex.timing);
    val('exExtraMeta', ex.extraMeta);
    val('exIncludes',  (ex.includes||[]).join('\n'));
    val('exNote',      ex.note);
    document.getElementById('exActive').checked = ex.active !== false;
    document.getElementById('exImgPreview').style.backgroundImage = ex.image ? `url('${ex.image}')` : '';
  } else {
    ['exId','exTitle','exTagLabel','exImage','exShortDesc','exFullDesc',
     'exDuration','exGroupSize','exTiming','exExtraMeta','exIncludes','exNote'].forEach(id => val(id,''));
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
    shortDesc: document.getElementById('exShortDesc').value.trim(),
    fullDesc:  document.getElementById('exFullDesc').value.trim(),
    duration:  document.getElementById('exDuration').value.trim(),
    groupSize: document.getElementById('exGroupSize').value.trim(),
    timing:    document.getElementById('exTiming').value.trim(),
    extraMeta: document.getElementById('exExtraMeta').value.trim(),
    includes:  document.getElementById('exIncludes').value.split('\n').map(s=>s.trim()).filter(Boolean),
    note:      document.getElementById('exNote').value.trim(),
    active:    document.getElementById('exActive').checked
  };

  if (editingIdx === null) {
    siteData.excursions.push(ex);
  } else {
    siteData.excursions[editingIdx] = ex;
  }

  unsaved = true;
  renderExcursionList();
  closeDrawer();
  document.getElementById('dashExCount').textContent = siteData.excursions.filter(e=>e.active!==false).length;
  toast(editingIdx === null ? '✓ Excursion added' : '✓ Excursion updated', 'ok');
  setStatus('', '● Unpublished changes');
});

function deleteExcursion(idx) {
  if (!confirm(`Delete "${siteData.excursions[idx].title}"? This cannot be undone.`)) return;
  siteData.excursions.splice(idx, 1);
  unsaved = true;
  renderExcursionList();
  toast('Excursion deleted', 'ok');
  setStatus('', '● Unpublished changes');
}

/* ══════════════════════════════════════════
   PUBLISH TO GITHUB
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

  const btn = document.getElementById('publishBtn');
  btn.disabled = true;
  setStatus('loading', '⟳ Publishing…');

  try {
    /* Always fetch the latest SHA right before publishing to avoid conflicts */
    const check = await fetch(`${API}/repos/${REPO}/contents/${CONTENT_PATH}`, { headers: ghHeaders(token) });
    if (check.ok) {
      const checkJson = await check.json();
      fileSHA = checkJson.sha;
    }

    /* Encode JSON to base64 safely — handles Unicode without deprecated unescape() */
    const jsonStr = JSON.stringify(siteData, null, 2);
    const bytes   = new TextEncoder().encode(jsonStr);
    let   binary  = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    const content = btoa(binary);
    const body    = { message: 'Update site content via admin panel', content };
    if (fileSHA) body.sha = fileSHA;

    const r = await fetch(`${API}/repos/${REPO}/contents/${CONTENT_PATH}`, {
      method:  'PUT',
      headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    if (!r.ok) {
      const errJson = await r.json().catch(() => ({}));
      const errMsg  = errJson.message || `HTTP ${r.status}`;
      console.error('GitHub API error:', errJson);
      throw new Error(errMsg);
    }
    const j = await r.json();
    fileSHA = j.content.sha;
    unsaved = false;
    setStatus('success', '✓ Published!');
    toast('🚀 Published! Site rebuilds in ~1 minute.', 'ok');
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
  /* Token save */
  const tokenToggle = document.getElementById('toggleToken');
  const tokenInput  = document.getElementById('githubToken');
  tokenToggle.addEventListener('click', () => {
    tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
  });
  tokenInput.value = getToken() || '';
  document.getElementById('saveTokenBtn').addEventListener('click', () => {
    const t = tokenInput.value.trim();
    localStorage.setItem('dv_gh_token', t);
    toast('✓ Token saved', 'ok');
    initTokenInfo();
    loadContentData();
  });

  document.getElementById('testTokenBtn').addEventListener('click', async () => {
    const t   = document.getElementById('githubToken').value.trim();
    const msg = document.getElementById('tokenMsg');
    if (!t) { msg.className = 'pass-msg err'; msg.textContent = 'Enter a token first.'; return; }
    msg.className = 'pass-msg'; msg.textContent = 'Testing…';
    try {
      const r = await fetch(`${API}/repos/${REPO}`, { headers: { 'Authorization': `Bearer ${t}`, 'Accept': 'application/vnd.github+json' } });
      if (r.ok) {
        const j = await r.json();
        msg.className = 'pass-msg ok';
        msg.textContent = `✓ Connected! Repo: ${j.full_name} (${j.private ? 'private' : 'public'})`;
      } else {
        const e = await r.json();
        msg.className = 'pass-msg err';
        msg.textContent = `✗ ${e.message || 'Invalid token or no access'}`;
      }
    } catch {
      msg.className = 'pass-msg err'; msg.textContent = '✗ Network error — check your connection.';
    }
  });

  /* Change password */
  document.getElementById('changePassBtn').addEventListener('click', changePassword);
}

async function changePassword() {
  const current  = document.getElementById('currentPass').value;
  const newPw    = document.getElementById('newPass').value;
  const confirm  = document.getElementById('confirmPass').value;
  const msg      = document.getElementById('passMsg');

  const stored = adminCfg?.passwordHash || 'd08d2cff6926fcee3437879d79ca7ef40088757a3817709fdb3c1364ae1989fe';
  const curHash = await sha256(current);
  if (curHash !== stored) {
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
    msg.className = 'pass-msg err'; msg.textContent = 'GitHub token required to save password change.'; return;
  }

  const newHash = await sha256(newPw);
  const newCfg  = { ...adminCfg, passwordHash: newHash };
  const content = btoa(JSON.stringify(newCfg, null, 2));

  try {
    /* Get current admin.json SHA */
    const gr = await fetch(`${API}/repos/${REPO}/contents/${ADMIN_PATH}`, { headers: ghHeaders(token) });
    const gj = await gr.json();

    await fetch(`${API}/repos/${REPO}/contents/${ADMIN_PATH}`, {
      method: 'PUT',
      headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
      body:   JSON.stringify({ message: 'Update admin password', content, sha: gj.sha })
    });
    adminCfg = newCfg;
    msg.className = 'pass-msg ok'; msg.textContent = '✓ Password updated successfully.';
    document.getElementById('currentPass').value = '';
    document.getElementById('newPass').value = '';
    document.getElementById('confirmPass').value = '';
  } catch {
    msg.className = 'pass-msg err'; msg.textContent = 'Failed to save — check your GitHub token.';
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
      if (window.innerWidth <= 900) {
        document.getElementById('sidebar').classList.remove('mobile-open');
      }
    });
  });
  document.querySelectorAll('.dash-card[data-section]').forEach(card => {
    card.addEventListener('click', () => switchSection(card.dataset.section));
  });
  document.getElementById('goToSettings')?.addEventListener('click', (e) => {
    e.preventDefault(); switchSection('settings');
  });
}

function switchSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

  const sec  = document.getElementById(`sec-${name}`);
  const item = document.querySelector(`.nav-item[data-section="${name}"]`);
  if (sec)  sec.classList.remove('hidden');
  if (item) item.classList.add('active');

  const titles = { dashboard:'Dashboard', hero:'Hero Section', stats:'Stats', about:'About', excursions:'Excursions', contact:'Contact Info', settings:'Settings' };
  document.getElementById('topbarTitle').textContent = titles[name] || name;
}

/* ══════════════════════════════════════════
   SIDEBAR TOGGLE
══════════════════════════════════════════ */
function initSidebar() {
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('mobile-open');
  });
}

/* ══════════════════════════════════════════
   TOKEN INFO BOX
══════════════════════════════════════════ */
function initTokenInfo() {
  const box = document.getElementById('tokenInfoBox');
  if (!box) return;
  box.style.display = getToken() ? 'none' : 'block';
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function getToken() {
  return localStorage.getItem('dv_gh_token') || '';
}

function ghHeaders(token) {
  const t = token || getToken();
  const h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

function setStatus(type, text) {
  const el = document.getElementById('publishStatus');
  el.className = `publish-status ${type}`;
  el.textContent = text;
}

let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g,'');
}
function capFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function defaultContent() {
  return {
    hero:{ tagline:'Welcome to', title:'Discover Vaavu', subtitle:'Islandbreak Excursion · V. Fulidhoo, Maldives', description:'Dive into the crystal-clear waters of Vaavu Atoll.' },
    stats:{ guests:500, excursionTypes:8, satisfaction:100, experience:5 },
    about:{ body1:'', body2:'' },
    excursions:[],
    contact:{ address:'', phone:'', email:'', hours:'', facebook:'#', instagram:'#' }
  };
}

/* Warn before leaving with unsaved changes */
window.addEventListener('beforeunload', e => {
  if (unsaved) { e.preventDefault(); e.returnValue = ''; }
});
