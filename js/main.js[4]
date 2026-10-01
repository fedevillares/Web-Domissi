const toggle = document.getElementById('navToggle');
const nav = document.getElementById('primaryNav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    toggle.textContent = open ? '✕' : '☰';
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', false);
    toggle.textContent = '☰';
  }));
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const siteNav = document.querySelector('.site-nav');
let lastScrollY = window.scrollY;
function onScrollDirection(y) {
  if (!siteNav || (nav && nav.classList.contains('open'))) return;
  const goingDown = y > lastScrollY;
  if (y > 120 && goingDown) siteNav.classList.add('nav-hidden');
  else if (!goingDown || y < 120) siteNav.classList.remove('nav-hidden');
  lastScrollY = y;
}

if (window.Lenis && !prefersReducedMotion) {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  lenis.on('scroll', ({ scroll }) => onScrollDirection(scroll));
  function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
} else {
  window.addEventListener('scroll', () => onScrollDirection(window.scrollY), { passive: true });
}

const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0, rootMargin: '0px 0px -32% 0px' });
document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => io.observe(el));

const quickForm = document.getElementById('quickQuoteForm');
if (quickForm) {
  quickForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = quickForm.nombre.value.trim();
    const empresa = quickForm.empresa.value.trim();
    const mensaje = quickForm.mensaje.value.trim();
    if (!nombre || !mensaje) return;
    const partes = [`Hola, soy ${nombre}${empresa ? ' de ' + empresa : ''}.`, mensaje];
    const texto = encodeURIComponent(partes.join(' '));
    window.open(`https://wa.me/5493416924220?text=${texto}`, '_blank', 'noopener');
  });
}
