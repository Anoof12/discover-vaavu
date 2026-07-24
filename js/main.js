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

  const waDigits = (c.whatsapp || c.phone || '').replace(/[^\d]/g, '');
  setHref('methodWhatsapp', waDigits ? `https://wa.me/${waDigits}` : '#');
  setHref('methodInstagram', c.instagram);
  if (c.wechat) {
    setHref('methodWechat', `weixin://dl/chat?${encodeURIComponent(c.wechat)}`);
    const wechatEl = document.getElementById('methodWechat');
    if (wechatEl) wechatEl.querySelector('span').textContent = `WeChat: ${c.wechat}`;
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el && val) el.textContent = val;
}
function setHref(id, val) {
  const el = document.getElementById(id);
  if (el && val) el.href = val;
}

/* ── Tag badge helpers ── */
const TAG_ICONS = {
  'Best Seller':        '⭐',
  'Family Friendly':    '👨‍👩‍👧',
  'Snorkeling':         '🤿',
  'Shark Experience':   '🦈',
  'Dolphin Watching':   '🐬',
  'Resort Day Trip':    '🏝️',
  'Half Day':           '⏱️',
  'Full Day':           '🌞',
  'Beginner Friendly':  '🌱'
};
function tagSlug(tag) {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function renderBadges(tags) {
  return (tags || []).map(t =>
    `<span class="badge badge--${tagSlug(t)}">${TAG_ICONS[t] || '✦'} ${t}</span>`
  ).join('');
}

/* ── Image carousel builder ──
   Builds a track + arrows + dots inside a wrapper element.
   Returns { setIndex } so callers can control it externally if needed. */
function buildCarousel(wrapEl, trackEl, prevEl, nextEl, dotsEl, images, altBase) {
  const imgs = images && images.length ? images : ['assets/logo.png'];
  trackEl.innerHTML = imgs.map(src =>
    `<div class="carousel-slide" style="background-image:url('${src}')" role="img" aria-label="${altBase}"></div>`
  ).join('');

  const multi = imgs.length > 1;
  if (prevEl) prevEl.style.display = multi ? '' : 'none';
  if (nextEl) nextEl.style.display = multi ? '' : 'none';
  if (dotsEl) {
    dotsEl.style.display = multi ? '' : 'none';
    dotsEl.innerHTML = multi
      ? imgs.map((_, i) => `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Photo ${i + 1}"></button>`).join('')
      : '';
  }

  let idx = 0;
  function go(i) {
    idx = (i + imgs.length) % imgs.length;
    trackEl.style.transform = `translateX(-${idx * 100}%)`;
    if (dotsEl) dotsEl.querySelectorAll('.carousel-dot').forEach((d, di) => d.classList.toggle('active', di === idx));
  }
  if (prevEl) prevEl.onclick = (e) => { e.stopPropagation(); go(idx - 1); };
  if (nextEl) nextEl.onclick = (e) => { e.stopPropagation(); go(idx + 1); };
  if (dotsEl) dotsEl.querySelectorAll('.carousel-dot').forEach(d =>
    d.addEventListener('click', (e) => { e.stopPropagation(); go(+d.dataset.i); })
  );

  if (multi && wrapEl) {
    let startX = null;
    wrapEl.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    wrapEl.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) go(dx < 0 ? idx + 1 : idx - 1);
      startX = null;
    }, { passive: true });
  }

  go(0);
  return { go };
}

/* ── Render Excursions ── */
function renderExcursions(excursions, contact) {
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
        <div class="ex-img-track"></div>
        <button class="carousel-arrow carousel-prev" aria-label="Previous photo">&#10094;</button>
        <button class="carousel-arrow carousel-next" aria-label="Next photo">&#10095;</button>
        <div class="carousel-dots"></div>
        <div class="ex-badges">${renderBadges(ex.tags)}</div>
      </div>
      <div class="ex-body">
        <h3>${ex.title}</h3>
        <p>${ex.shortDesc}</p>
        <div class="ex-meta">
          <span>⏱ ${ex.duration}</span>
          <span>🕐 ${ex.timing}</span>
        </div>
        <button class="ex-detail-btn" data-id="${ex.id}">View Details</button>
      </div>`;
    grid.appendChild(card);

    const wrap  = card.querySelector('.ex-img-wrap');
    const track = card.querySelector('.ex-img-track');
    const prev  = card.querySelector('.carousel-prev');
    const next  = card.querySelector('.carousel-next');
    const dots  = card.querySelector('.carousel-dots');
    buildCarousel(wrap, track, prev, next, dots, ex.images, ex.title);
  });

  /* Re-attach filter, modal, reveal for newly created cards */
  attachFilterListeners();
  attachModalListeners(excursions, contact);
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
function attachModalListeners(excursions, contact) {
  const overlay    = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  const bookBtn    = document.getElementById('modalBookBtn');
  const waDigits   = ((contact && (contact.whatsapp || contact.phone)) || '').replace(/[^\d]/g, '');

  function openModal(id) {
    const ex = excursions.find(e => e.id === id);
    if (!ex) return;

    buildCarousel(
      document.querySelector('#modal .modal-img-wrap'),
      document.getElementById('modalImgTrack'),
      document.getElementById('modalPrev'),
      document.getElementById('modalNext'),
      document.getElementById('modalDots'),
      ex.images,
      ex.title
    );

    document.getElementById('modalTags').innerHTML = renderBadges(ex.tags);
    document.getElementById('modalTitle').textContent = ex.title;
    document.getElementById('modalDesc').textContent  = ex.fullDesc;
    document.getElementById('modalMeta').innerHTML    = [
      `⏱ ${ex.duration}`, `🕐 ${ex.timing}`, ex.extraMeta ? `✨ ${ex.extraMeta}` : ''
    ].filter(Boolean).map(m => `<span>${m}</span>`).join('');
    document.getElementById('modalIncludes').innerHTML = (ex.includes||[]).map(i=>`<li>${i}</li>`).join('');
    document.getElementById('modalNote').textContent   = ex.note || '';

    const waMessage = `Hello Discover Vaavu! I'd like to book the ${ex.title} excursion.`;
    bookBtn.href = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}` : '#';

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

/* ── Reviews carousel ── */
function initReviews(reviews) {
  const track = document.getElementById('reviewsTrack');
  const dots  = document.getElementById('reviewsDots');
  const carousel = document.getElementById('reviewsCarousel');
  if (!track || !reviews || !reviews.length) return;

  track.innerHTML = reviews.map(r => {
    const initials = (r.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const avatar = r.photo
      ? `<div class="review-avatar" style="background-image:url('${r.photo}')"></div>`
      : `<div class="review-avatar review-avatar-fallback">${initials}</div>`;
    const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(Math.max(0, 5 - (r.rating || 5)));
    return `
      <div class="review-card">
        ${avatar}
        <div class="review-stars">${stars}</div>
        <p class="review-text">"${r.text}"</p>
        <div class="review-name">${r.name}</div>
        <div class="review-country">${r.country}</div>
      </div>`;
  }).join('');

  dots.innerHTML = reviews.map((_, i) => `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Review ${i + 1}"></button>`).join('');

  let idx = 0;
  let timer;
  function go(i) {
    idx = (i + reviews.length) % reviews.length;
    track.style.transform = `translateX(-${idx * 100}%)`;
    dots.querySelectorAll('.carousel-dot').forEach((d, di) => d.classList.toggle('active', di === idx));
  }
  function next() { go(idx + 1); }
  function start() { timer = setInterval(next, 5000); }
  function stop()  { clearInterval(timer); }

  dots.querySelectorAll('.carousel-dot').forEach(d =>
    d.addEventListener('click', () => { go(+d.dataset.i); stop(); start(); })
  );
  carousel.addEventListener('mouseenter', stop);
  carousel.addEventListener('mouseleave', start);

  let startX = null;
  carousel.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; stop(); }, { passive: true });
  carousel.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) go(dx < 0 ? idx + 1 : idx - 1);
    startX = null;
    start();
  }, { passive: true });

  go(0);
  start();
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
  renderExcursions(data.excursions, data.contact);
  initReviews(data.reviews || []);
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
    reviews: [],
    contact: {
      address: 'V. Fulidhoo, Vaavu Atoll, Maldives',
      phone: '+960 XXX XXXX',
      whatsapp: '+960 XXX XXXX',
      email: 'info@discovervaavu.mv',
      hours: 'Daily · Sunrise to Sunset',
      facebook: '#',
      instagram: '#',
      wechat: ''
    }
  };
}
