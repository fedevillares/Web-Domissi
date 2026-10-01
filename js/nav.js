/* Domissi Hermanos — menú de productos (desktop: mega menú · mobile: acordeón)
   Se arma solo a partir de window.DOMISSI_CATALOG (generado desde el Excel). */
(function () {
  "use strict";
  var cats = window.DOMISSI_CATALOG || [];
  var groups = window.DOMISSI_GROUPS || [];
  if (!cats.length) return;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function catUrl(c) { return "productos.html?c=" + c.id; }
  function subUrl(c, s) { return "productos.html?c=" + c.id + "&s=" + s.id; }
  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* ---------- Desktop: mega menú ---------- */
  var mega = document.getElementById("mega");
  var item = document.querySelector("[data-mega-item]");
  if (mega && item) {
    var catsHtml = groups.map(function (g, gi) {
      var list = cats.filter(function (c) { return c.group === gi; });
      if (!list.length) return "";
      return '<div class="mega__group"><h6>' + esc(g) + "</h6>" + list.map(function (c) {
        return '<a class="mega__cat" href="' + catUrl(c) + '" data-cat="' + c.id + '">' + esc(c.label) + "<small>" + c.count + "</small></a>";
      }).join("") + "</div>";
    }).join("");

    var panelsHtml = cats.map(function (c) {
      return '<div class="mega__panel" data-panel="' + c.id + '"><div>' +
        "<h5>" + esc(c.label) + "</h5>" +
        '<a class="mega__all" href="' + catUrl(c) + '">Ver toda la categoría ' + arrow + "</a>" +
        '<div class="mega__subs">' + c.sub.map(function (s) {
          return '<a href="' + subUrl(c, s) + '">' + esc(s.label) + "<small>" + s.count + "</small></a>";
        }).join("") + "</div></div>" +
        '<a class="mega__thumb" href="' + catUrl(c) + '" tabindex="-1" aria-hidden="true"><img src="' + c.image + '" alt="" loading="lazy"></a></div>';
    }).join("");

    mega.innerHTML = '<div class="wrap mega__in"><div class="mega__cats">' + catsHtml + '</div><div class="mega__pane">' + panelsHtml + "</div></div>";

    var toggle = item.querySelector(".mega-toggle");
    var catLinks = Array.prototype.slice.call(mega.querySelectorAll(".mega__cat"));
    var panels = Array.prototype.slice.call(mega.querySelectorAll(".mega__panel"));
    var closeTimer = null;

    var activate = function (id) {
      catLinks.forEach(function (a) { a.classList.toggle("is-active", a.dataset.cat === id); });
      panels.forEach(function (p) { p.classList.toggle("is-active", p.dataset.panel === id); });
    };
    var open = function () {
      clearTimeout(closeTimer);
      if (!mega.classList.contains("is-open")) {
        if (!mega.querySelector(".mega__cat.is-active")) activate(cats[0].id);
        mega.classList.add("is-open");
        item.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
      }
    };
    var close = function () {
      clearTimeout(closeTimer);
      mega.classList.remove("is-open");
      item.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };
    var closeSoon = function () {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(close, 160);
    };

    item.addEventListener("mouseenter", open);
    item.addEventListener("mouseleave", closeSoon);
    mega.addEventListener("mouseenter", function () { clearTimeout(closeTimer); });
    mega.addEventListener("mouseleave", closeSoon);
    toggle.addEventListener("click", function () {
      mega.classList.contains("is-open") ? close() : open();
    });
    catLinks.forEach(function (a) {
      a.addEventListener("mouseenter", function () { activate(a.dataset.cat); });
      a.addEventListener("focus", function () { activate(a.dataset.cat); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mega.classList.contains("is-open")) { close(); toggle.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (!mega.contains(e.target) && !item.contains(e.target)) close();
    });
    mega.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
  }

  /* ---------- Mobile: acordeón dentro del menú off-canvas ---------- */
  var mobileList = document.querySelector("#mobileNav > ul");
  if (mobileList) {
    var first = mobileList.querySelector("li");
    var html = '<li><details><summary>Productos</summary><ul>' +
      '<li><a href="productos.html">Ver todo el catálogo</a></li>' +
      groups.map(function (g, gi) {
        var list = cats.filter(function (c) { return c.group === gi; });
        return '<li class="m-group" role="presentation"><span class="m-group">' + esc(g) + "</span></li>" + list.map(function (c) {
          return '<li><details><summary>' + esc(c.label) + '</summary><ul>' +
            '<li><a href="' + catUrl(c) + '">Ver toda la categoría</a></li>' +
            c.sub.map(function (s) { return '<li><a href="' + subUrl(c, s) + '">' + esc(s.label) + "</a></li>"; }).join("") +
            "</ul></details></li>";
        }).join("");
      }).join("") + "</ul></details></li>";
    var tmp = document.createElement("ul");
    tmp.innerHTML = html;
    if (first && /productos/i.test(first.textContent)) mobileList.replaceChild(tmp.firstChild, first);
  }
})();
