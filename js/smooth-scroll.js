/* Scroll suave con Lenis. Se desactiva si el usuario prefiere menos movimiento. */
(function () {
  "use strict";
  if (typeof window.Lenis !== "function") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
  window.lenis = lenis;

  function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);

  /* Anclas internas (#id) con scroll suave que respeta el header fijo */
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute("href").length < 2) return;
    var target = null;
    try { target = document.querySelector(a.getAttribute("href")); } catch (err) { return; }
    if (!target) return;
    e.preventDefault();
    /* con la opción lerp Lenis no define duration/easing: se pasan a mano */
    lenis.scrollTo(target, {
      offset: -90,
      duration: 1.1,
      easing: function (t) { return 1 - Math.pow(1 - t, 4); }
    });
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });

  /* Menú móvil, buscador y diálogos abiertos: frenar el scroll de fondo */
  var lock = new MutationObserver(function () {
    var open = document.querySelector(".mobile-nav.is-open, .search-overlay.is-open, dialog[open]");
    open ? lenis.stop() : lenis.start();
  });
  lock.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "open"] });
})();
