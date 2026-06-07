// ── Intersection Observer for scroll animations ──
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Stagger feature cards
        if (entry.target.classList.contains('feature-card')) {
          const cards = document.querySelectorAll('.feature-card');
          cards.forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 80);
          });
          observer.unobserve(entry.target);
        }
      }
    });
  },
  { threshold: 0.12 }
);

// Observe feature cards (observe first one to trigger stagger)
const firstCard = document.querySelector('.feature-card');
if (firstCard) observer.observe(firstCard);

// Observe download card
const downloadCard = document.querySelector('.download-card');
if (downloadCard) observer.observe(downloadCard);

// ── Sticky Nav shadow on scroll ──
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 10) {
    nav.style.boxShadow = '0 2px 20px rgba(0,0,0,0.08)';
  } else {
    nav.style.boxShadow = 'none';
  }
}, { passive: true });

// ── Download button click tracking ──
document.querySelectorAll('[id$="-download-btn"], #main-download-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Animate the button briefly
    btn.style.transform = 'scale(0.96)';
    setTimeout(() => { btn.style.transform = ''; }, 150);
  });
});

// ── Smooth scroll for anchor links ──
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Phone mockup gentle float animation ──
const phone = document.querySelector('.phone');
if (phone) {
  let tick = 0;
  const float = () => {
    tick += 0.02;
    phone.style.transform = `translateY(${Math.sin(tick) * 8}px)`;
    requestAnimationFrame(float);
  };
  float();
}
