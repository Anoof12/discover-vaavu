/* ═══════════════════════════════════════════════════════
   DISCOVER VAAVU – main.js
   Loads content from data/content.json so admin changes
   are reflected on the live site automatically.
═══════════════════════════════════════════════════════ */

/* ── Navbar scroll ── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

/* ── Hamburger ── */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const closeMenu  = document.getElementById('closeMenu');
hamburger.addEventListener('click', () => mobileMenu.classList.add('open'));
closeMenu.addEventListener('click', () => mobileMenu.classList.remove('open'));
document.querySelectorAll('.mob-link').forEach(l =>
  l.addEventListener('click', () => mobileMenu.classList.remove('open'))
);

/* ── Reveal on scroll ── */
function initReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 80);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}

/* ── Stat counter ── */
function initStats(data) {
  const map = {
    'stat-guests':       data.stats.guests,
    'stat-excursions':   data.stats.excursionTypes,
    'stat-satisfaction': data.stats.satisfaction,
    'stat-experience':   data.stats.experience
  };
  Object.entries(map).forEach(([id, target]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.target = target;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      let start = 0;
      const step = target / 60;
      const timer = setInterval(() => {
        start += step;
        if (start >= target) { el.textContent = target; clearInterval(timer); return; }
        el.textContent = Math.floor(start);
      }, 22);
      obs.unobserve(el);
    }, { threshold: 0.5 });
    obs.observe(el);
  });
}

/* ── Floating particles ── */
function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  function spawn() {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 5 + 2;
    const left = Math.random() * 100;
    const dur  = Math.random() * 8 + 6;
    const del  = Math.random() * 4;
    p.style.cssText = `width:${size}px;height:${size}px;left:${left}%;animation-duration:${dur}s;animation-delay:${del}s;opacity:${Math.random()*0.5+0.2};`;
    container.appendChild(p);
    setTimeout(() => p.remove(), (dur + del) * 1000);
  }
  setInterval(spawn, 600);
  for (let i = 0; i < 15; i++) spawn();
}

/* ── Populate Hero ── */
function populateHero(h) {
  setText('heroTagline', h.tagline);
  setText('heroTitle', h.title);
  setText('heroSub', h.subtitle);
  setText('heroDesc', h.description);
}

/* ── Populate About ── */
function populateAbout(a) {
  setText('aboutBody1', a.body1);
  setText('aboutBody2', a.body2);
}

/* ── Populate Contact ── */
function populateContact(c) {
  setText('contactAddress', c.address);
  setText('contactPhone',   c.phone);
  setText('contactEmail',   c.email);
  setText('contactHours',   c.hours);
  setHref('socialFacebook', c.facebook);
  setHref('socialInstagram', c.instagram);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el && val) el.textContent = val;
}
function setHref(id, val) {
  const el = document.getElementById(id);
  if (el && val) el.href = val;
}

/* ── Render Excursions ── */
function renderExcursions(excursions) {
  const grid = document.getElementById('excursionsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  excursions.filter(e => e.active !== false).forEach(ex => {
    const card = document.createElement('div');
    card.className = 'ex-card';
    card.dataset.cat = ex.category;
    card.dataset.reveal = '';
    card.innerHTML = `
      <div class="ex-img-wrap">
        <div class="ex-img" style="background-image:url('${ex.image}')"></div>
        <div class="ex-tag">${ex.tagLabel}</div>
        ${ex.price ? `<div class="ex-price">${ex.price}</div>` : ''}
      </div>
      <div class="ex-body">
        <h3>${ex.title}</h3>
        <p>${ex.shortDesc}</p>
        <div class="ex-meta">
          <span>⏱ ${ex.duration}</span>
          <span>👥 ${ex.groupSize}</span>
          <span>🕐 ${ex.timing}</span>
        </div>
        <button class="ex-detail-btn" data-id="${ex.id}">View Details</button>
      </div>`;
    grid.appendChild(card);
  });

  /* Re-attach filter, modal, reveal for newly created cards */
  attachFilterListeners();
  attachModalListeners(excursions);
  initReveal();
}

/* ── Filter tabs ── */
function attachFilterListeners() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.replaceWith(btn.cloneNode(true)); // remove old listeners
  });
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.ex-card').forEach(card => {
        const match = filter === 'all' || card.dataset.cat === filter;
        card.style.transition = 'opacity 0.3s,transform 0.3s';
        if (match) {
          card.classList.remove('hidden');
          card.style.opacity = '1';
          card.style.transform = 'scale(1)';
        } else {
          card.style.opacity = '0';
          card.style.transform = 'scale(0.95)';
          setTimeout(() => card.classList.add('hidden'), 300);
        }
      });
    });
  });
}

/* ── Modal ── */
function attachModalListeners(excursions) {
  const overlay    = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');

  function openModal(id) {
    const ex = excursions.find(e => e.id === id);
    if (!ex) return;
    document.getElementById('modalImg').style.backgroundImage = `url('${ex.image}')`;
    document.getElementById('modalTag').textContent   = ex.tagLabel;
    document.getElementById('modalTitle').textContent = ex.title;
    document.getElementById('modalDesc').textContent  = ex.fullDesc;
    document.getElementById('modalMeta').innerHTML    = [
      `⏱ ${ex.duration}`, `👥 ${ex.groupSize}`, `🕐 ${ex.timing}`, ex.extraMeta ? `✨ ${ex.extraMeta}` : ''
    ].filter(Boolean).map(m => `<span>${m}</span>`).join('');
    document.getElementById('modalIncludes').innerHTML = (ex.includes||[]).map(i=>`<li>${i}</li>`).join('');
    document.getElementById('modalNote').textContent   = ex.note || '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.ex-detail-btn').forEach(btn =>
    btn.addEventListener('click', () => openModal(btn.dataset.id))
  );
  if (modalClose) { modalClose.onclick = closeModal; }
  overlay.onclick = e => { if (e.target === overlay) closeModal(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

/* ── Parallax hero ── */
window.addEventListener('scroll', () => {
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg && window.scrollY < window.innerHeight) {
    heroBg.style.transform = `scale(1.1) translateY(${window.scrollY * 0.25}px)`;
  }
});

/* ── Active nav highlight ── */
const sections = document.querySelectorAll('section[id]');
const navAs    = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 120) current = s.id; });
  navAs.forEach(a => {
    a.style.color = a.getAttribute('href') === `#${current}` ? 'var(--teal-lt)' : '';
  });
});

/* ══════════════════════════════════════
   BOOT – fetch content.json and render
══════════════════════════════════════ */
async function boot() {
  initParticles();

  let data;
  try {
    const res = await fetch('data/content.json?v=' + Date.now());
    data = await res.json();
  } catch {
    /* Fallback: render defaults so site never breaks */
    console.warn('Could not load content.json, using embedded defaults.');
    data = getDefaults();
  }

  populateHero(data.hero);
  populateAbout(data.about);
  populateContact(data.contact);
  renderExcursions(data.excursions);
  initStats(data);
  initReveal();
}

boot();

/* ── Embedded defaults (shown if JSON fetch fails) ── */
function getDefaults() {
  return {
    hero: {
      tagline: 'Welcome to',
      title: 'Discover Vaavu',
      subtitle: 'Islandbreak Excursion · V. Fulidhoo, Maldives',
      description: 'Dive into the crystal-clear waters of Vaavu Atoll. Experience the magic of the Indian Ocean aboard our vessel Jasmine.'
    },
    stats: { guests: 500, excursionTypes: 8, satisfaction: 100, experience: 5 },
    about: {
      body1: 'Discover Vaavu is the excursion arm of Island Break Guest House, nestled on the beautiful island of Fulidhoo in Vaavu Atoll.',
      body2: 'Our boat Jasmine is your gateway to Vaavu\'s pristine reefs, hidden sandbars, and abundant marine life.'
    },
    excursions: [],
    contact: {
      address: 'V. Fulidhoo, Vaavu Atoll, Maldives',
      phone: '+960 XXX XXXX',
      email: 'info@discovervaavu.mv',
      hours: 'Daily · Sunrise to Sunset',
      facebook: '#',
      instagram: '#'
    }
  };
}
