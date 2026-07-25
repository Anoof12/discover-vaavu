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
  initStaticUploaders();
});

/* ══════════════════════════════════════════
   AUTH
   Passwords are hashed with salted PBKDF2 (100k rounds) so the hash
   published in data/admin.json can't be cracked with a rainbow table.
   Older configs without a salt are verified against plain SHA-256 for
   one login, then upgraded automatically the next time the password
   is changed. There is no server here — this only protects against
   casual/offline hash cracking, not someone who already holds a
   valid GitHub token with write access to this repo.
══════════════════════════════════════════ */
const PBKDF2_ITERATIONS = 100000;
const LOGIN_FAILS_KEY    = 'dv_admin_fails';
const LOGIN_UNLOCK_KEY   = 'dv_admin_unlock_at';

function isLoggedIn() { return sessionStorage.getItem('dv_admin') === '1'; }

function initLogin() {
  const form  = document.getElementById('loginForm');
  const input = document.getElementById('loginPass');
  const err   = document.getElementById('loginError');
  const submitBtn = form.querySelector('button[type="submit"]');

  document.getElementById('togglePass').addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  applyLoginLockout(submitBtn, err);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';

    if (!adminCfg) {
      err.textContent = 'Could not load admin config from GitHub. Check your connection and reload.';
      return;
    }

    const ok = await verifyPassword(input.value.trim(), adminCfg);
    if (ok) {
      sessionStorage.removeItem(LOGIN_FAILS_KEY);
      sessionStorage.removeItem(LOGIN_UNLOCK_KEY);
      sessionStorage.setItem('dv_admin', '1');
      showShell();
      await loadContent();
    } else {
      recordFailedLogin();
      applyLoginLockout(submitBtn, err);
      if (!err.textContent) err.textContent = 'Incorrect password. Try again.';
      input.value = '';
      input.focus();
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('dv_admin');
    location.reload();
  });
}

/* Slows down repeated guesses through the UI. Not real rate limiting
   (anyone with devtools can call verifyPassword directly), just a
   cheap deterrent for casual attempts. Unlock time is an absolute
   timestamp so refreshing the page can't reset the wait. */
function recordFailedLogin() {
  const n = (parseInt(sessionStorage.getItem(LOGIN_FAILS_KEY), 10) || 0) + 1;
  sessionStorage.setItem(LOGIN_FAILS_KEY, String(n));
  if (n >= 3) {
    const waitSec = Math.min(60, Math.pow(2, n - 2));
    sessionStorage.setItem(LOGIN_UNLOCK_KEY, String(Date.now() + waitSec * 1000));
  }
}

function applyLoginLockout(submitBtn, err) {
  const unlockAt = parseInt(sessionStorage.getItem(LOGIN_UNLOCK_KEY), 10) || 0;
  let remaining = Math.ceil((unlockAt - Date.now()) / 1000);
  if (remaining <= 0) return;

  submitBtn.disabled = true;
  err.textContent = `Too many attempts. Try again in ${remaining}s.`;
  const timer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(timer);
      submitBtn.disabled = false;
      err.textContent = '';
      sessionStorage.removeItem(LOGIN_UNLOCK_KEY);
    } else {
      err.textContent = `Too many attempts. Try again in ${remaining}s.`;
    }
  }, 1000);
}

async function verifyPassword(candidate, cfg) {
  if (cfg.salt && cfg.iterations) {
    const hash = await pbkdf2Hex(candidate, cfg.salt, cfg.iterations);
    return hash === cfg.passwordHash;
  }
  // Legacy unsalted config — verified once, upgraded on next password change.
  const hash = await sha256(candidate);
  return !!cfg.passwordHash && hash === cfg.passwordHash;
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSaltHex(bytes = 16) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2Hex(password, saltHex, iterations) {
  const saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
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
   IMAGE UPLOAD TO GITHUB
══════════════════════════════════════════ */
async function uploadImageToGitHub(file, repoPath, statusEl, thumbEl) {
  const token = getToken();
  if (!token) throw new Error('No GitHub token — add one in Settings first');

  // Show uploading state
  if (statusEl) { statusEl.className = 'upload-status uploading'; statusEl.textContent = `⟳ Uploading ${file.name}…`; }
  if (thumbEl)  thumbEl.style.backgroundImage = '';

  // Read file → base64
  const base64 = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res(reader.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  // Get existing SHA if file already exists
  let sha;
  try {
    const check = await fetch(`${API}/repos/${REPO}/contents/${repoPath}`, { headers: ghHeaders() });
    if (check.ok) sha = (await check.json()).sha;
  } catch { /* new file */ }

  // Upload via GitHub Contents API
  const body = { message: `Upload image: ${repoPath}`, content: base64 };
  if (sha) body.sha = sha;

  const r = await fetch(`${API}/repos/${REPO}/contents/${repoPath}`, {
    method:  'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });

  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.message || `HTTP ${r.status}`);
  }

  // Show success + local preview
  const localUrl = URL.createObjectURL(file);
  if (thumbEl)  thumbEl.style.backgroundImage = `url('${localUrl}')`;
  if (statusEl) { statusEl.className = 'upload-status done'; statusEl.textContent = `✓ Uploaded: ${file.name}`; }

  return repoPath;
}

/* Helper: wire a file-pick button to an upload flow */
function initImageUploader({ pickBtnId, fileInputId, statusId, thumbId, onSuccess, repoPathFn }) {
  const pickBtn   = document.getElementById(pickBtnId);
  const fileInput = document.getElementById(fileInputId);
  if (!pickBtn || !fileInput) return;

  pickBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast('Image too large — max 8MB', 'err'); return; }

    const statusEl = document.getElementById(statusId);
    const thumbEl  = document.getElementById(thumbId);

    pickBtn.disabled = true;
    try {
      const ext      = file.name.split('.').pop().toLowerCase();
      const repoPath = repoPathFn(ext);
      const path     = await uploadImageToGitHub(file, repoPath, statusEl, thumbEl);
      toast('✓ Photo uploaded! Click Publish to go live.', 'ok');
      if (onSuccess) onSuccess(path);
    } catch (e) {
      console.error(e);
      if (statusEl) { statusEl.className = 'upload-status error'; statusEl.textContent = `✗ ${e.message}`; }
      toast(`✗ Upload failed: ${e.message}`, 'err');
    } finally {
      pickBtn.disabled = false;
      fileInput.value  = '';
    }
  });
}

/* ══════════════════════════════════════════
   POPULATE FORMS
══════════════════════════════════════════ */
function populateForms() {
  if (!siteData) return;
  if (!siteData.reviews) siteData.reviews = [];
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
  setVal('contactWhatsapp',  contact.whatsapp);
  setVal('contactWechat',    contact.wechat);

  document.getElementById('dashExCount').textContent =
    excursions.filter(e => e.active !== false).length;

  renderExcursionList();
  renderReviewList();
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
  siteData.contact.whatsapp  = document.getElementById('contactWhatsapp').value.trim();
  siteData.contact.wechat    = document.getElementById('contactWechat').value.trim();
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
    const cover = (ex.images && ex.images[0]) || '';
    card.innerHTML = `
      <span class="drag-handle">⠿</span>
      <div class="ex-admin-thumb" style="background-image:url('${adminImg(cover)}')"></div>
      <div class="ex-admin-info">
        <h4>${ex.title}</h4>
        <div class="ex-admin-meta">
          ${(ex.tags || []).map(t => `<span class="ex-meta-tag">${t}</span>`).join('')}
          <span class="ex-meta-tag">${ex.duration || ''}</span>
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

/* ══════════════════════════════════════════
   STATIC PAGE UPLOADERS (Hero, About)
══════════════════════════════════════════ */
function initStaticUploaders() {
  // Hero background
  initImageUploader({
    pickBtnId:   'heroPickBtn',
    fileInputId: 'heroImageFile',
    statusId:    'heroUploadStatus',
    thumbId:     'heroImgPreview',
    repoPathFn:  (ext) => `assets/hero-bg.${ext}`,
    onSuccess:   (path) => {
      // Update CSS on live site via style.css — just inform user to publish
      // The CSS already references assets/hero-bg.jpg; uploading hero-bg.{ext}
      // with same ext keeps it working. Notify if ext changed.
      toast('✓ Hero photo uploaded! Publish to go live.', 'ok');
    }
  });

  // About photo
  initImageUploader({
    pickBtnId:   'aboutPickBtn',
    fileInputId: 'aboutImageFile',
    statusId:    'aboutUploadStatus',
    thumbId:     'aboutImgPreview',
    repoPathFn:  (ext) => `assets/about-img.${ext}`,
    onSuccess:   async (path) => {
      // Update index.html to point to new about image
      await updateAboutImageInHTML(path);
      toast('✓ About photo uploaded & linked! Publish to go live.', 'ok');
    }
  });
}

async function updateAboutImageInHTML(newPath) {
  try {
    const token = getToken();
    if (!token) return;
    // Fetch index.html from GitHub, replace about-img src, commit back
    const r = await fetch(`${API}/repos/${REPO}/contents/index.html`, { headers: ghHeaders() });
    if (!r.ok) return;
    const j   = await r.json();
    const html = atob(j.content.replace(/\n/g, ''));
    const updated = html.replace(
      /(<img[^>]*class="about-img"[^>]*src=")[^"]*(")/,
      `$1${newPath}$2`
    );
    const bytes = new TextEncoder().encode(updated);
    let   bin   = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    await fetch(`${API}/repos/${REPO}/contents/index.html`, {
      method:  'PUT',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: 'Update about image', content: btoa(bin), sha: j.sha })
    });
  } catch (e) { console.warn('Could not update about image path:', e); }
}

/* ── Drawer ── */
let editingIdx = null;
let currentExImages = [];

document.getElementById('addExcursionBtn').addEventListener('click', () => openDrawer(null));
document.getElementById('drawerClose').addEventListener('click',    closeDrawer);
document.getElementById('drawerCancel').addEventListener('click',   closeDrawer);
document.getElementById('drawerOverlay').addEventListener('click',  closeDrawer);

/* Excursion multi-image uploader inside drawer:
   each successful upload is appended to currentExImages rather than
   replacing a single value. */
initImageUploader({
  pickBtnId:   'exPickBtn',
  fileInputId: 'exImageFile',
  statusId:    'exUploadStatus',
  thumbId:     'exImgPreview',
  repoPathFn:  (ext) => {
    const id = document.getElementById('exId').value.trim()
              || slugify(document.getElementById('exTitle').value.trim())
              || 'excursion';
    return `assets/ex-${id}-${Date.now()}.${ext}`;
  },
  onSuccess: (path) => {
    currentExImages.push(path);
    renderExImageList();
    document.getElementById('exImgPreview').style.backgroundImage = '';
    document.getElementById('exUploadStatus').className = 'upload-status';
    document.getElementById('exUploadStatus').textContent = 'Add another photo, or save the excursion';
  }
});

function renderExImageList() {
  const list = document.getElementById('exImageList');
  list.innerHTML = currentExImages.map((path, i) => `
    <div class="multi-image-item">
      <div class="multi-image-thumb" style="background-image:url('${adminImg(path)}')"></div>
      ${i === 0 ? '<span class="multi-image-cover">Cover</span>' : ''}
      <button type="button" class="multi-image-remove" data-i="${i}" title="Remove photo">✕</button>
    </div>`).join('');
  list.querySelectorAll('.multi-image-remove').forEach(btn =>
    btn.addEventListener('click', () => {
      currentExImages.splice(+btn.dataset.i, 1);
      renderExImageList();
    })
  );
}

function openDrawer(idx) {
  editingIdx = idx;
  document.getElementById('drawerTitle').textContent = idx === null ? 'Add Excursion' : 'Edit Excursion';
  const tagInputs = document.querySelectorAll('#exTagGrid input[type="checkbox"]');

  if (idx !== null) {
    const ex = siteData.excursions[idx];
    setVal('exId',        ex.id);
    setVal('exTitle',     ex.title);
    setVal('exCategory',  ex.category);
    setVal('exShortDesc', ex.shortDesc);
    setVal('exFullDesc',  ex.fullDesc);
    setVal('exDuration',  ex.duration);
    setVal('exTiming',    ex.timing);
    setVal('exExtraMeta', ex.extraMeta);
    setVal('exIncludes',  (ex.includes || []).join('\n'));
    setVal('exNote',      ex.note);
    document.getElementById('exActive').checked = ex.active !== false;
    tagInputs.forEach(cb => { cb.checked = (ex.tags || []).includes(cb.value); });
    currentExImages = [...(ex.images || [])];
  } else {
    ['exId','exTitle','exShortDesc','exFullDesc','exDuration','exTiming','exExtraMeta','exIncludes','exNote']
      .forEach(id => setVal(id, ''));
    document.getElementById('exActive').checked = true;
    tagInputs.forEach(cb => { cb.checked = false; });
    currentExImages = [];
  }

  renderExImageList();
  document.getElementById('exImgPreview').style.backgroundImage = '';
  const status = document.getElementById('exUploadStatus');
  status.className = 'upload-status';
  status.textContent = currentExImages.length ? 'Add another photo, or save the excursion' : 'No photos yet — add one below';

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

  const tags = [...document.querySelectorAll('#exTagGrid input[type="checkbox"]:checked')].map(cb => cb.value);

  const ex = {
    id:        document.getElementById('exId').value.trim() || slugify(title),
    title,
    category:  document.getElementById('exCategory').value,
    tags,
    images:    [...currentExImages],
    shortDesc: document.getElementById('exShortDesc').value.trim(),
    fullDesc:  document.getElementById('exFullDesc').value.trim(),
    duration:  document.getElementById('exDuration').value.trim(),
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
   REVIEWS
══════════════════════════════════════════ */
function renderReviewList() {
  const list = document.getElementById('reviewList');
  if (!list || !siteData) return;
  list.innerHTML = '';

  (siteData.reviews || []).forEach((rv, idx) => {
    const card = document.createElement('div');
    card.className = 'ex-admin-card';
    const stars = '★'.repeat(rv.rating || 5) + '☆'.repeat(Math.max(0, 5 - (rv.rating || 5)));
    card.innerHTML = `
      <div class="ex-admin-thumb" style="background-image:url('${adminImg(rv.photo)}')"></div>
      <div class="ex-admin-info">
        <h4>${rv.name} <small style="color:var(--text-sm);font-weight:400;">— ${rv.country || ''}</small></h4>
        <div class="ex-admin-meta">
          <span class="ex-meta-tag">${stars}</span>
        </div>
      </div>
      <div class="ex-admin-actions">
        <button class="btn-edit-ex" data-idx="${idx}">Edit</button>
        <button class="btn-del-ex"  data-idx="${idx}">Delete</button>
      </div>`;
    list.appendChild(card);
  });

  list.querySelectorAll('.btn-edit-ex').forEach(b =>
    b.addEventListener('click', () => openReviewDrawer(+b.dataset.idx))
  );
  list.querySelectorAll('.btn-del-ex').forEach(b =>
    b.addEventListener('click', () => deleteReview(+b.dataset.idx))
  );
}

let editingReviewIdx = null;

document.getElementById('addReviewBtn').addEventListener('click', () => openReviewDrawer(null));
document.getElementById('reviewDrawerClose').addEventListener('click',  closeReviewDrawer);
document.getElementById('reviewDrawerCancel').addEventListener('click', closeReviewDrawer);
document.getElementById('reviewDrawerOverlay').addEventListener('click', closeReviewDrawer);

initImageUploader({
  pickBtnId:   'rvPickBtn',
  fileInputId: 'rvImageFile',
  statusId:    'rvUploadStatus',
  thumbId:     'rvImgPreview',
  repoPathFn:  (ext) => {
    const id = document.getElementById('rvId').value.trim() || `review-${Date.now()}`;
    return `assets/review-${id}.${ext}`;
  },
  onSuccess: (path) => {
    document.getElementById('rvImage').value = path;
  }
});

function openReviewDrawer(idx) {
  editingReviewIdx = idx;
  document.getElementById('reviewDrawerTitle').textContent = idx === null ? 'Add Review' : 'Edit Review';

  const thumb  = document.getElementById('rvImgPreview');
  const status = document.getElementById('rvUploadStatus');

  if (idx !== null) {
    const rv = siteData.reviews[idx];
    setVal('rvId',      rv.id);
    setVal('rvName',    rv.name);
    setVal('rvCountry', rv.country);
    setVal('rvRating',  rv.rating || 5);
    setVal('rvText',    rv.text);
    setVal('rvImage',   rv.photo);
    if (rv.photo) {
      thumb.style.backgroundImage = `url('${adminImg(rv.photo)}')`;
      status.className = 'upload-status done';
      status.textContent = `Current: ${rv.photo.split('/').pop()}`;
    } else {
      thumb.style.backgroundImage = '';
      status.className = 'upload-status';
      status.textContent = 'No photo selected';
    }
  } else {
    ['rvId','rvName','rvCountry','rvText','rvImage'].forEach(id => setVal(id, ''));
    setVal('rvRating', 5);
    thumb.style.backgroundImage = '';
    status.className = 'upload-status';
    status.textContent = 'No photo selected';
  }

  document.getElementById('reviewDrawerOverlay').classList.add('open');
  document.getElementById('reviewDrawer').classList.add('open');
}

function closeReviewDrawer() {
  document.getElementById('reviewDrawerOverlay').classList.remove('open');
  document.getElementById('reviewDrawer').classList.remove('open');
  editingReviewIdx = null;
}

document.getElementById('reviewDrawerSave').addEventListener('click', () => {
  const name = document.getElementById('rvName').value.trim();
  if (!name) { toast('Guest name is required', 'err'); return; }

  const rv = {
    id:      document.getElementById('rvId').value.trim() || slugify(name) + '-' + Date.now(),
    name,
    country: document.getElementById('rvCountry').value.trim(),
    rating:  +document.getElementById('rvRating').value || 5,
    text:    document.getElementById('rvText').value.trim(),
    photo:   document.getElementById('rvImage').value.trim()
  };

  if (!siteData.reviews) siteData.reviews = [];
  if (editingReviewIdx === null) {
    siteData.reviews.push(rv);
    toast('✓ Review added — click Publish to go live', 'ok');
  } else {
    siteData.reviews[editingReviewIdx] = rv;
    toast('✓ Review updated — click Publish to go live', 'ok');
  }

  renderReviewList();
  closeReviewDrawer();
});

function deleteReview(idx) {
  if (!confirm(`Delete review from "${siteData.reviews[idx].name}"?`)) return;
  siteData.reviews.splice(idx, 1);
  renderReviewList();
  toast('Review deleted — click Publish to go live', 'ok');
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

  if (!adminCfg || !(await verifyPassword(current, adminCfg))) {
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
    const salt    = randomSaltHex();
    const newHash = await pbkdf2Hex(newPw, salt, PBKDF2_ITERATIONS);
    const newCfg  = { ...adminCfg, passwordHash: newHash, salt, iterations: PBKDF2_ITERATIONS };
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
    about: 'About', excursions: 'Excursions', reviews: 'Reviews',
    contact: 'Contact Info', settings: 'Settings'
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
    reviews: [],
    contact: { address: '', phone: '', whatsapp: '', email: '', hours: '', facebook: '#', instagram: '#', wechat: '' }
  };
}

window.addEventListener('beforeunload', e => {
  if (document.querySelector('.drawer.open')) { e.preventDefault(); e.returnValue = ''; }
});
