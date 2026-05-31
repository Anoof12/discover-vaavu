/* ═══════════════════════════════════════════════════════
   DISCOVER VAAVU – main.js
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
const revealEls = document.querySelectorAll('[data-reveal]');
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 80);
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
revealEls.forEach(el => revealObs.observe(el));

/* ── Stat counter ── */
const statNums = document.querySelectorAll('.stat-num');
const statsObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el     = e.target;
    const target = +el.dataset.target;
    let start    = 0;
    const step   = target / 60;
    const timer  = setInterval(() => {
      start += step;
      if (start >= target) { el.textContent = target; clearInterval(timer); return; }
      el.textContent = Math.floor(start);
    }, 22);
    statsObs.unobserve(el);
  });
}, { threshold: 0.5 });
statNums.forEach(n => statsObs.observe(n));

/* ── Floating particles ── */
function spawnParticle() {
  const container = document.getElementById('particles');
  if (!container) return;
  const p = document.createElement('div');
  p.className = 'particle';
  const size = Math.random() * 5 + 2;
  const left = Math.random() * 100;
  const dur  = Math.random() * 8 + 6;
  const del  = Math.random() * 4;
  p.style.cssText = `
    width:${size}px; height:${size}px;
    left:${left}%;
    animation-duration:${dur}s;
    animation-delay:${del}s;
    opacity:${Math.random() * 0.5 + 0.2};
  `;
  container.appendChild(p);
  setTimeout(() => p.remove(), (dur + del) * 1000);
}
setInterval(spawnParticle, 600);
for (let i = 0; i < 15; i++) spawnParticle();

/* ── Excursion filter ── */
const filterBtns = document.querySelectorAll('.filter-btn');
const exCards    = document.querySelectorAll('.ex-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    exCards.forEach(card => {
      const match = filter === 'all' || card.dataset.cat === filter;
      card.style.transition = 'opacity 0.3s, transform 0.3s';
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

/* ── Excursion data ── */
const excursionData = {
  whaleshark: {
    title: 'Whale Shark Encounter',
    tag: 'Wildlife',
    img: 'https://images.unsplash.com/photo-1560275619-4cc5fa59d3ae?w=800&q=80',
    desc: 'Join us for a once-in-a-lifetime experience swimming alongside whale sharks in the warm waters of Vaavu Atoll. Fulidhoo is one of the Maldives\' premier locations for these gentle giants, and our expert guides know exactly where to find them.',
    meta: ['⏱ 3–4 hours', '👥 Max 10 guests', '🌅 Morning departure', '🌊 Snorkel included'],
    includes: ['Snorkel mask & fins', 'Buoyancy vest', 'Towel & fresh water', 'Light refreshments', 'Expert marine guide', 'Safety briefing'],
    note: '🌿 Seasonal availability: Best from October to April. We follow strict eco-friendly guidelines — no touching, no flash photography.'
  },
  dolphin: {
    title: 'Dolphin Watching',
    tag: 'Wildlife',
    img: 'https://images.unsplash.com/photo-1607153333879-c174d265f1d2?w=800&q=80',
    desc: 'Spinner dolphins are abundant in Vaavu Atoll, and watching them leap and spin in our boat\'s wake is pure magic. We offer both sunrise and sunset departures for the most spectacular viewing light.',
    meta: ['⏱ 1.5–2 hours', '👥 Max 12 guests', '🌅 Sunrise / Sunset', '🛥️ Boat trip'],
    includes: ['Dolphin-watching cruise', 'Expert local guide', 'Fresh water & light snacks', 'Photography tips'],
    note: '📸 Bring your camera! Spinner dolphins are extremely active and almost always put on a show.'
  },
  manta: {
    title: 'Manta Ray Snorkel',
    tag: 'Wildlife',
    img: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800&q=80',
    desc: 'Vaavu Atoll is home to famous manta ray cleaning stations where you can glide alongside these majestic creatures. Our guides know the best times and spots for guaranteed encounters.',
    meta: ['⏱ 2–3 hours', '👥 Max 10 guests', '🌊 Seasonal', '🐠 All levels welcome'],
    includes: ['Snorkel gear', 'Life jacket', 'Marine biologist guide', 'Fresh water & towels', 'Light refreshments'],
    note: '🌿 Best from November to May. Manta rays gather at cleaning stations daily — encounters are almost guaranteed in season.'
  },
  snorkel: {
    title: 'Reef Snorkeling',
    tag: 'Water Activities',
    img: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80',
    desc: 'Dive into the crystal-clear waters of Fulidhoo\'s house reef and nearby dive spots. Encounter sea turtles, colourful reef fish, moray eels, and stunning coral formations in their natural habitat.',
    meta: ['⏱ 2–3 hours', '👥 Max 15 guests', '🐠 All levels', '🌊 Multiple spots'],
    includes: ['Snorkel mask, fins & vest', 'Underwater camera rental', 'Local reef guide', 'Fresh water & snacks', 'Post-snorkel beach time'],
    note: '🐢 Fulidhoo house reef is home to resident sea turtles — encounters are very common!'
  },
  sandbank: {
    title: 'Sandbank Picnic',
    tag: 'Scenic',
    img: 'https://images.unsplash.com/photo-1602002418816-5c0aeef426aa?w=800&q=80',
    desc: 'Step onto a pristine white sandbank rising from the turquoise ocean and enjoy a private picnic in the middle of the sea. This is a quintessential Maldives experience — completely secluded and absolutely breathtaking.',
    meta: ['⏱ Half day (4–5 hrs)', '👥 Max 12 guests', '🏝️ Private sandbank', '☀️ Daytime'],
    includes: ['Return speedboat transfer', 'Picnic spread', 'Snorkeling from the sandbank', 'Fresh coconuts', 'Sunshade & towels'],
    note: '🏝️ Sandbars shift with the tides — we scout the best one each day for your visit.'
  },
  sunset: {
    title: 'Sunset Cruise',
    tag: 'Scenic',
    img: 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=800&q=80',
    desc: 'There\'s no better way to end a day in the Maldives than aboard Jasmine as the sky turns gold, orange, and pink. This relaxed cruise takes you across the lagoon to catch the most stunning sunset views.',
    meta: ['⏱ 1.5 hours', '👥 Max 15 guests', '🌇 Evening', '🛥️ Aboard Jasmine'],
    includes: ['Cruise on Jasmine', 'Soft drinks & water', 'Light canapés', 'Dolphin spotting opportunity'],
    note: '🌅 Departure time varies by season to coincide with the golden hour — we\'ll confirm your exact time at booking.'
  },
  fishing: {
    title: 'Night Fishing',
    tag: 'Water Activities',
    img: 'https://images.unsplash.com/photo-1580019542155-247062e19ce4?w=800&q=80',
    desc: 'Experience authentic Maldivian handline fishing under a sky full of stars. Our fishermen will teach you traditional techniques, and any catch can be prepared at Island Break Guest House for a fresh fish dinner.',
    meta: ['⏱ 2–3 hours', '👥 Max 10 guests', '🌙 Evening/Night', '🎣 Beginner friendly'],
    includes: ['Fishing rods & bait', 'Local fisherman guide', 'Fresh water & snacks', 'Fish preparation (catch & cook)'],
    note: '🍽️ Catch-and-cook available! Any fish caught can be freshly prepared for your dinner at Island Break.'
  },
  islandhop: {
    title: 'Island Hopping',
    tag: 'Scenic',
    img: 'https://images.unsplash.com/photo-1589979481223-deb893043163?w=800&q=80',
    desc: 'Explore multiple islands in Vaavu Atoll in one epic day — from local inhabited islands to uninhabited nature reserves. Discover Maldivian culture, pristine beaches, and hidden gems only the locals know.',
    meta: ['⏱ Full day (6–8 hrs)', '👥 Max 12 guests', '🗺️ Explorer level', '🏝️ Multiple islands'],
    includes: ['Full-day boat charter', 'Island visits (2–3 stops)', 'Picnic lunch', 'Snorkeling at reef', 'Cultural experience', 'Fresh water & refreshments'],
    note: '🗺️ Route is customised based on tides and weather — we always ensure the best possible experience on the day.'
  }
};

/* ── Modal logic ── */
const overlay    = document.getElementById('modalOverlay');
const modal      = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');

function openModal(id) {
  const d = excursionData[id];
  if (!d) return;
  document.getElementById('modalImg').style.backgroundImage   = `url('${d.img}')`;
  document.getElementById('modalTag').textContent             = d.tag;
  document.getElementById('modalTitle').textContent           = d.title;
  document.getElementById('modalDesc').textContent            = d.desc;
  document.getElementById('modalMeta').innerHTML              = d.meta.map(m => `<span>${m}</span>`).join('');
  document.getElementById('modalIncludes').innerHTML          = d.includes.map(i => `<li>${i}</li>`).join('');
  document.getElementById('modalNote').textContent            = d.note;
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
modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ── Parallax hero ── */
window.addEventListener('scroll', () => {
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg && window.scrollY < window.innerHeight) {
    heroBg.style.transform = `scale(1.1) translateY(${window.scrollY * 0.25}px)`;
  }
});

/* ── Active nav link highlight ── */
const sections = document.querySelectorAll('section[id]');
const navAs    = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 120) current = s.id;
  });
  navAs.forEach(a => {
    a.style.color = a.getAttribute('href') === `#${current}` ? 'var(--teal-lt)' : '';
  });
});
