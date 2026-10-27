/* Domissi Hermanos — comportamiento compartido entre páginas */
(function () {
  "use strict";

  /* ---------- Header: barra fija; al bajar se compacta (sube la franja de contacto) ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var ticking = false;
    var onScroll = function () {
      header.classList.toggle("is-condensed", window.scrollY > 20);
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(onScroll);
          ticking = true;
        }
      },
      { passive: true }
    );
    onScroll();
  }

  /* ---------- Hero: parallax muy sutil del fondo ---------- */
  var heroEl = document.querySelector(".hero");
  if (heroEl && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var parallaxTicking = false;
    var updateParallax = function () {
      var rect = heroEl.getBoundingClientRect();
      var progress = Math.min(Math.max(-rect.top / (rect.height || 1), 0), 1);
      heroEl.style.setProperty("--parallax-y", (progress * 42) + "px");
      parallaxTicking = false;
    };
    updateParallax();
    window.addEventListener(
      "scroll",
      function () {
        if (!parallaxTicking) {
          window.requestAnimationFrame(updateParallax);
          parallaxTicking = true;
        }
      },
      { passive: true }
    );
  }

  /* ---------- Menú mobile off-canvas ---------- */
  var toggle = document.querySelector(".menu-toggle");
  var mobileNav = document.querySelector(".mobile-nav");
  var closeBtn = document.querySelector(".mobile-nav__close");

  function openMenu() {
    mobileNav.classList.add("is-open");
    document.body.style.overflow = "hidden";
    toggle.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    mobileNav.classList.remove("is-open");
    document.body.style.overflow = "";
    toggle.setAttribute("aria-expanded", "false");
  }
  if (toggle && mobileNav) {
    toggle.addEventListener("click", openMenu);
    if (closeBtn) closeBtn.addEventListener("click", closeMenu);
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---------- Revelado sutil al hacer scroll ----------
     Doble mecanismo: IntersectionObserver como método principal, más una
     verificación directa por getBoundingClientRect en cada scroll/resize
     como red de seguridad (un scroll muy rápido puede saltear el callback
     del observer en algunos motores). Nada debe quedar invisible para siempre. */
  var revealEls = Array.prototype.slice.call(
    document.querySelectorAll("[data-reveal], [data-reveal-group]")
  );
  if (revealEls.length) {
    var reveal = function (el) { el.classList.add("is-visible"); };
    var isNear = function (el) {
      var r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 1.05 && r.bottom > -200;
    };
    var checkAll = function () {
      revealEls = revealEls.filter(function (el) {
        if (isNear(el)) { reveal(el); return false; }
        return true;
      });
      if (!revealEls.length) {
        window.removeEventListener("scroll", checkAll);
        window.removeEventListener("resize", checkAll);
      }
    };

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              reveal(entry.target);
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0, rootMargin: "0px 0px 120px 0px" }
      );
      revealEls.forEach(function (el) { io.observe(el); });
    }

    checkAll();
    window.addEventListener("scroll", checkAll, { passive: true });
    window.addEventListener("resize", checkAll);
    /* red final: nada queda oculto más de 3s, sin importar el motor de scroll */
    setTimeout(function () { revealEls.forEach(reveal); }, 3000);
  }

  /* ---------- Imágenes decorativas bajo el pliegue: se piden a 300 px del viewport ----------
     (el lazy nativo usa un umbral de varios miles de px con red lenta y compite con el LCP) */
  var lazyImgs = Array.prototype.slice.call(document.querySelectorAll("img[data-lazy-src]"));
  if (lazyImgs.length) {
    var loadLazy = function (img) { img.src = img.getAttribute("data-lazy-src"); img.removeAttribute("data-lazy-src"); };
    if ("IntersectionObserver" in window) {
      var lazyIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          lazyIo.unobserve(e.target);
          var img = e.target.querySelector("img[data-lazy-src]");
          if (img) loadLazy(img);
        });
      }, { rootMargin: "300px 0px" });
      lazyImgs.forEach(function (img) { lazyIo.observe(img.closest(".offer-panel, .cta-cell") || img.parentNode); });
    } else {
      window.addEventListener("load", function () { lazyImgs.forEach(loadLazy); });
    }
  }

  /* ---------- Hero: carrusel de 3 slides (autoplay, flechas, dots, swipe) ---------- */
  var heroSlides = document.querySelectorAll(".hero__slide");
  var heroDots = document.querySelectorAll(".hero__dots button");
  var heroEl = document.getElementById("hero");
  if (heroEl && heroSlides.length > 1) {
    var HERO_DELAY = 5500; /* 5,5 s por slide + 0,6 s de transición (CSS) */
    var current = 0;
    var timer = null;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* los slides 2 y 3 no se piden hasta que carga la página: no compiten con el LCP */
    var hydrate = function (slide) {
      var src = slide.querySelector("source[data-srcset]");
      var im = slide.querySelector("img[data-src]");
      if (src) { src.srcset = src.getAttribute("data-srcset"); src.removeAttribute("data-srcset"); }
      if (im) { im.src = im.getAttribute("data-src"); im.removeAttribute("data-src"); }
    };
    var hydrateAll = function () { heroSlides.forEach(hydrate); };
    if (document.readyState === "complete") hydrateAll();
    else window.addEventListener("load", function () { setTimeout(hydrateAll, 200); }, { once: true });
    var goTo = function (index) {
      index = (index + heroSlides.length) % heroSlides.length;
      heroSlides[current].classList.remove("is-active");
      heroSlides[current].setAttribute("aria-hidden", "true");
      heroDots[current] && heroDots[current].classList.remove("is-active");
      heroDots[current] && heroDots[current].setAttribute("aria-selected", "false");
      current = index;
      heroSlides[current].classList.add("is-active");
      heroSlides[current].removeAttribute("aria-hidden");
      heroDots[current] && heroDots[current].classList.add("is-active");
      heroDots[current] && heroDots[current].setAttribute("aria-selected", "true");
      hydrate(heroSlides[current]);
    };
    var stop = function () { clearInterval(timer); timer = null; };
    var start = function () {
      stop();
      if (reduce) return;
      timer = setInterval(function () { goTo(current + 1); }, HERO_DELAY);
    };
    heroSlides.forEach(function (sl, i) { if (i) sl.setAttribute("aria-hidden", "true"); });
    heroDots.forEach(function (dot, i) {
      dot.addEventListener("click", function () { goTo(i); start(); });
    });
    var prev = heroEl.querySelector("[data-hero-prev]");
    var next = heroEl.querySelector("[data-hero-next]");
    prev && prev.addEventListener("click", function () { goTo(current - 1); start(); });
    next && next.addEventListener("click", function () { goTo(current + 1); start(); });

    /* swipe táctil */
    var sx = 0, sy = 0, tracking = false;
    heroEl.addEventListener("touchstart", function (e) {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true; stop();
    }, { passive: true });
    heroEl.addEventListener("touchend", function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goTo(dx < 0 ? current + 1 : current - 1);
      start();
    }, { passive: true });
    heroEl.addEventListener("touchcancel", function () { tracking = false; start(); }, { passive: true });

    /* pausa solo con foco de teclado: el hero ocupa toda la pantalla, así que
       pausar con el mouse encima frenaría el autoplay casi siempre */
    heroEl.addEventListener("focusin", function (e) {
      if (e.target.matches && e.target.matches(":focus-visible")) stop();
    });
    heroEl.addEventListener("focusout", function (e) {
      if (!heroEl.contains(e.relatedTarget)) start();
    });
    document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
    heroEl.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { goTo(current - 1); start(); }
      if (e.key === "ArrowRight") { goTo(current + 1); start(); }
    });
    start();
  }

  /* ---------- Historia: crossfade de imágenes institucionales ---------- */
  var storyFrames = document.querySelectorAll(".story__frame img");
  if (storyFrames.length > 1) {
    var sCurrent = 0;
    setInterval(function () {
      storyFrames[sCurrent].classList.remove("is-active");
      sCurrent = (sCurrent + 1) % storyFrames.length;
      storyFrames[sCurrent].classList.add("is-active");
    }, 3200);
  }
})();
