/* Domissi Hermanos — catálogo de productos.
   Vista general (sin parámetros) o vista de categoría: ?c=<cat>&s=<sub>&g=<grupo>&q=<texto>
   Datos: DOMISSI_CATALOG (categorías) + DOMISSI_PRODUCTS (filas). Fotos opcionales: DOMISSI_PHOTOS. */
(function () {
  "use strict";
  var root = document.getElementById("catalogRoot");
  var cats = window.DOMISSI_CATALOG || [];
  var groupNames = window.DOMISSI_GROUPS || [];
  var rows = window.DOMISSI_PRODUCTS || [];
  var photos = window.DOMISSI_PHOTOS || {};
  if (!root || !cats.length) return;

  var PAGE = 60;
  var WA = "https://wa.me/5493464609089?text=";
  var params = new URLSearchParams(window.location.search);

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function fmt(n) { return n.toLocaleString("es-AR", { maximumFractionDigits: 2 }); }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; return -1; }
  function url(c, s, g) {
    var u = "productos.html?c=" + c.id;
    if (s) u += "&s=" + s.id;
    if (g) u += "&g=" + g.id;
    return u;
  }

  /* Links viejos (?categoria=xxx) → resumen de productos */
  var LEGACY = { "hierros-mallas": "hierros-mallas", "mallastejidosymetalesdesp": "tejidos", "chapasptecho": "chapas-conformadas", "ang-pl-perfiles": "angulos-planchuelas", "aislantes": "aislantes", "barras-red-cua": "laminados", "canos": "canos", "chapaslisas": "chapas-lisas" };
  var legacy = params.get("categoria");
  if (legacy && !params.get("c") && LEGACY[legacy]) params.set("c", LEGACY[legacy]);

  var ic = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.1 1 2 1.3 2.3 1.4.3.2.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 .9c.3.2.5.2.6.4.1.2.1.8-.1 1.4Z"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'
  };

  function setTitle(t) { document.title = t + " — Domissi Hermanos"; }

  /* ---------------- Vista general ---------------- */
  function renderOverview() {
    setTitle("Productos");
    var html = '<section class="page-hero"><div class="wrap">' +
      '<span class="page-hero__eyebrow">Productos</span>' +
      '<h1 class="display-1">Acero para cada etapa de tu obra o tu producción.</h1>' +
      '<p class="lede">' + cats.length + " categorías, de la estructura al detalle. Elegí una y consultá precio y disponibilidad con un asesor.</p>" +
      '</div></section><section class="section"><div class="wrap">';
    groupNames.forEach(function (g, gi) {
      var list = cats.filter(function (c) { return c.group === gi; });
      if (!list.length) return;
      html += '<div class="cat-group"><h2 class="cat-group__title">' + esc(g) + '</h2><div class="cat-grid">' +
        list.map(function (c) {
          return '<a class="cat-card" href="' + url(c) + '"><div class="cat-card__img"><img src="' + c.image + '" alt="" loading="lazy"></div>' +
            '<div class="cat-card__body"><h3>' + esc(c.label) + "</h3><p>" + esc(c.intro || "") + '</p><span class="cat-card__count">' + c.count + " productos →</span></div></a>";
        }).join("") + "</div></div>";
    });
    root.innerHTML = html + "</div></section>";
  }

  /* ---------------- Vista categoría ---------------- */
  function renderCategory(ci) {
    var cat = cats[ci];
    var si = byId(cat.sub, params.get("s"));
    var sub = si >= 0 ? cat.sub[si] : null;
    var gi = sub ? byId(sub.groups, params.get("g")) : -1;
    var grp = gi >= 0 ? sub.groups[gi] : null;
    var query = params.get("q") || "";

    var title = grp ? grp.label : sub ? sub.label : cat.label;
    setTitle(title + (sub || grp ? " · " + cat.label : ""));

    var base = rows.filter(function (r) { return r[2] === ci; });
    var crumbs = '<nav class="crumbs" aria-label="Ruta"><a href="productos.html">Productos</a><span aria-hidden="true">/</span>' +
      (sub ? '<a href="' + url(cat) + '">' + esc(cat.label) + '</a><span aria-hidden="true">/</span><span>' + esc(sub.label) + "</span>" : "<span>" + esc(cat.label) + "</span>") + "</nav>";

    var html = '<section class="cat-cover"><div class="cat-cover__bg" style="background-image:url(\'' + cat.image + '\')"></div><div class="wrap">' +
      crumbs + "<h1>" + esc(cat.label) + "</h1>" + (cat.intro ? "<p>" + esc(cat.intro) + "</p>" : "") + "</div></section>" +
      '<section class="section"><div class="wrap catalog"><aside class="catalog__side" aria-label="Subcategorías"><h2>' + esc(cat.label) + "</h2><ul>" +
      '<li><a href="' + url(cat) + '"' + (!sub ? ' class="is-active"' : "") + ">Todo<small>" + cat.count + "</small></a></li>" +
      cat.sub.map(function (s) {
        return '<li><a href="' + url(cat, s) + '"' + (sub && s.id === sub.id ? ' class="is-active"' : "") + ">" + esc(s.label) + "<small>" + s.count + "</small></a></li>";
      }).join("") + '</ul><a class="side-other" href="productos.html">← Todas las categorías</a></aside>' +
      '<div class="catalog__main"><div class="catalog__bar"><h2>' + esc(title) + '</h2>' +
      '<label class="catalog__find">' + ic.search + '<input type="search" id="catFind" placeholder="Filtrar por medida o nombre…" aria-label="Filtrar productos" value="' + esc(query) + '"></label></div>';

    if (sub && sub.groups.length) {
      html += '<div class="chips" role="group" aria-label="Tipo">' +
        '<button type="button" data-g=""' + (!grp ? ' class="is-active"' : "") + ">Todos</button>" +
        sub.groups.map(function (g) {
          return '<button type="button" data-g="' + g.id + '"' + (grp && grp.id === g.id ? ' class="is-active"' : "") + ">" + esc(g.label) + " (" + g.count + ")</button>";
        }).join("") + "</div>";
    }
    html += '<p class="catalog__count" id="catCount" aria-live="polite"></p><div id="catTable"></div><div class="catalog__more" id="catMore"></div></div></div></section>';
    root.innerHTML = html;

    var find = document.getElementById("catFind");
    var table = document.getElementById("catTable");
    var count = document.getElementById("catCount");
    var more = document.getElementById("catMore");
    var shown = PAGE;
    var curGrp = grp;

    function filtered() {
      var q = norm(query).trim().split(/\s+/).filter(Boolean);
      return base.filter(function (r) {
        if (si >= 0 && r[3] !== si) return false;
        if (curGrp && r[4] !== byId(sub.groups, curGrp.id)) return false;
        if (!q.length) return true;
        var d = norm(r[1]) + " " + r[0];
        return q.every(function (t) { return d.indexOf(t) !== -1; });
      });
    }

    function waLink(r) {
      return WA + encodeURIComponent("Hola, te escribo a través del sitio web de Domissi. Quiero consultar por: " + r[1] + " (cód. " + r[0] + ").");
    }

    function draw() {
      var list = filtered();
      var page = list.slice(0, shown);
      if (!list.length) {
        var msg = "Hola, te escribo a través del sitio web de Domissi. Estoy buscando: " + (query || title) + ".";
        table.innerHTML = '<div class="catalog__empty"><p>No encontramos productos con ese filtro. Contanos qué necesitás y te respondemos.</p>' +
          '<a class="btn btn-whatsapp" href="' + WA + encodeURIComponent(msg) + '" target="_blank" rel="noopener">Consultar por WhatsApp</a></div>';
        count.textContent = "";
        more.innerHTML = "";
        return;
      }
      count.textContent = list.length + (list.length === 1 ? " producto" : " productos");
      table.innerHTML = '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Cód.</th><th>Descripción</th><th class="num col-largo">Largo</th><th class="num col-kg">Kg/un.</th><th class="col-venta">Se vende por</th><th></th></tr></thead><tbody>' +
        page.map(function (r) {
          var ph = photos[r[0]];
          return '<tr><td class="code">' + r[0] + '</td><td class="desc">' + esc(r[1]) + '</td><td class="num col-largo">' + (r[6] != null ? fmt(r[6]) + " m" : "—") +
            '</td><td class="num col-kg">' + (r[7] != null ? fmt(r[7]) : "—") + '</td><td class="col-venta">' + esc(r[5] || "—") +
            '</td><td class="act">' + (ph ? '<button type="button" data-photo="' + r[0] + '" aria-label="Ver foto de ' + esc(r[1]) + '">' + ic.cam + "Foto</button>" : "") +
            '<a href="' + waLink(r) + '" target="_blank" rel="noopener" aria-label="Consultar ' + esc(r[1]) + ' por WhatsApp">' + ic.wa + "Consultar</a></td></tr>";
        }).join("") + "</tbody></table></div>";
      more.innerHTML = list.length > shown ? '<button type="button" class="btn btn-secondary" id="moreBtn">Mostrar más (' + (list.length - shown) + ")</button>" : "";
    }

    function sync() {
      var p = new URLSearchParams();
      p.set("c", cat.id);
      if (sub) p.set("s", sub.id);
      if (curGrp) p.set("g", curGrp.id);
      if (query) p.set("q", query);
      history.replaceState(null, "", "?" + p.toString());
    }

    find.addEventListener("input", function () { query = find.value; shown = PAGE; sync(); draw(); });
    root.addEventListener("click", function (e) {
      var chip = e.target.closest(".chips button");
      if (chip) {
        curGrp = chip.dataset.g ? sub.groups[byId(sub.groups, chip.dataset.g)] : null;
        Array.prototype.forEach.call(root.querySelectorAll(".chips button"), function (b) { b.classList.toggle("is-active", b === chip); });
        shown = PAGE; sync(); draw(); return;
      }
      if (e.target.closest("#moreBtn")) { shown += PAGE; draw(); return; }
      var ph = e.target.closest("[data-photo]");
      if (ph) openPhoto(ph.dataset.photo);
    });
    draw();
  }

  /* ---------------- Foto individual (lightbox) ---------------- */
  function openPhoto(id) {
    var src = photos[id];
    var r = rows.filter(function (x) { return String(x[0]) === String(id); })[0];
    if (!src || !r) return;
    var dlg = document.getElementById("photoDialog");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "photoDialog";
      dlg.className = "photo-dialog";
      dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = '<img alt="' + esc(r[1]) + '" src="' + esc(src) + '"><div class="photo-dialog__cap"><strong>' + esc(r[1]) +
      '</strong><form method="dialog"><button class="btn btn-secondary">Cerrar</button></form></div>';
    dlg.showModal();
  }

  var ci = byId(cats, params.get("c"));
  if (ci >= 0) renderCategory(ci); else renderOverview();
})();
