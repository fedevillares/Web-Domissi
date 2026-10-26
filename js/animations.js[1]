/* ============================================================
   PSYWARE — animations.js
   Scroll reveal and the subtle particle background.
   No dependencies. Respects prefers-reduced-motion.
   ============================================================ */
(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------
     Scroll reveal: fades/slides in any [data-reveal] element,
     and staggers direct children of [data-stagger] containers.
     --------------------------------------------------------- */
  function initScrollReveal() {
    const revealTargets = document.querySelectorAll("[data-reveal], [data-stagger]");
    if (!revealTargets.length) return;

    revealTargets.forEach((el) => {
      const delay = el.getAttribute("data-reveal-delay");
      if (delay) el.style.setProperty("--reveal-delay", `${delay}ms`);
    });

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealTargets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    revealTargets.forEach((el) => observer.observe(el));
  }

  /* ---------------------------------------------------------
     Particle background: a handful of slow-drifting dots
     connected by faint lines when close together. Pauses when
     off-screen or when the tab is hidden, to save CPU/battery.
     --------------------------------------------------------- */
  function initParticles() {
    const canvas = document.getElementById("particles");
    if (!canvas || prefersReducedMotion) return;

    const ctx = canvas.getContext("2d");
    let width, height, particles, rafId;
    let running = true;

    const DENSITY = 14000; // px² per particle
    const MAX_PARTICLES = 70;
    const LINK_DIST = 130;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = Math.min(window.innerHeight, 900);
      const count = Math.min(MAX_PARTICLES, Math.floor((width * height) / DENSITY));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.4 + 0.6,
      }));
    }

    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(77, 178, 255, 0.5)";
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(1, 94, 234, ${0.16 * (1 - dist / LINK_DIST)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    resize();
    tick();

    window.addEventListener("resize", debounce(resize, 200));

    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) {
        rafId = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(rafId);
      }
    });
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    initScrollReveal();
    initParticles();
  });
})();
