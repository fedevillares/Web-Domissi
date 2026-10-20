/* Domissi Hermanos — sugerencias en vivo del buscador del navbar.
   Usa DomissiSearch (search-core.js). Combobox accesible: flechas, Enter, Esc. */
(function () {
  "use strict";
  var form = document.querySelector(".nav-search");
  var input = form && form.querySelector(".nav-search__input");
  var S = window.DomissiSearch;
  if (!form || !input || !S) return;

  var box = document.createElement("div");
  box.className = "nav-suggest";
  box.id = "navSuggest";
  box.setAttribute("role", "listbox");
  box.setAttribute("aria-label", "Sugerencias de búsqueda");
  box.hidden = true;
  form.appendChild(box);

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", "navSuggest");

  var options = [];
  var active = -1;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function highlight(label, q) {
    var nl = S.normalize(label), nq = S.normalize(q);
    var i = nq ? nl.indexOf(nq) : -1;
    if (i < 0 || nl.length !== label.length) return esc(label);
    return esc(label.slice(0, i)) + "<mark>" + esc(label.slice(i, i + nq.length)) + "</mark>" + esc(label.slice(i + nq.length));
  }
  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function render() {
    var q = input.value.trim();
    var html = "";
    var n = 0;
    function opt(href, inner, extra) {
      var id = "navSuggest-" + n++;
      return '<a id="' + id + '" class="nav-suggest__item' + (extra || "") + '" role="option" aria-selected="false" href="' + href + '">' + inner + "</a>";
    }
    if (!q) {
      html += '<p class="nav-suggest__head">Categorías populares</p>';
      S.popular().slice(0, 6).forEach(function (it) {
        html += opt(S.url(it), "<span>" + esc(it.label) + "</span>" + arrow);
      });
    } else {
      var res = S.search(q, 6);
      if (res.length) {
        html += '<p class="nav-suggest__head">Productos</p>';
        res.forEach(function (it) {
          html += opt(S.url(it), '<span>' + highlight(it.label, q) + "<small>" + esc(it.categoryLabel) + "</small></span>" + arrow);
        });
        html += opt("buscar.html?q=" + encodeURIComponent(q), "<span>Ver todos los resultados de “" + esc(q) + "”</span>" + arrow, " nav-suggest__all");
      } else {
        html += '<p class="nav-suggest__empty">No encontramos “' + esc(q) + "” en el catálogo.</p>";
        html += opt(S.waLink(q), "<span>Consultalo por WhatsApp con un asesor</span>" + arrow, " nav-suggest__all");
      }
    }
    box.innerHTML = html;
    options = Array.prototype.slice.call(box.querySelectorAll("[role=option]"));
    active = -1;
    input.removeAttribute("aria-activedescendant");
  }
  function open() {
    render();
    box.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function close() {
    box.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }
  function setActive(i) {
    if (!options.length) return;
    if (active > -1) { options[active].classList.remove("is-active"); options[active].setAttribute("aria-selected", "false"); }
    active = (i + options.length) % options.length;
    options[active].classList.add("is-active");
    options[active].setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", options[active].id);
    options[active].scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("focus", open);
  input.addEventListener("input", open);
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); if (box.hidden) open(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (box.hidden) open(); setActive(active - 1); }
    else if (e.key === "Escape") { if (!box.hidden) { e.preventDefault(); close(); } }
    else if (e.key === "Enter" && active > -1) { e.preventDefault(); window.location.href = options[active].getAttribute("href"); }
  });
  box.addEventListener("mousedown", function (e) { e.preventDefault(); });
  box.addEventListener("mousemove", function (e) {
    var a = e.target.closest && e.target.closest("[role=option]");
    if (a) { var i = options.indexOf(a); if (i !== active) setActive(i); }
  });
  document.addEventListener("click", function (e) { if (!form.contains(e.target)) close(); });
  form.addEventListener("focusout", function () {
    setTimeout(function () { if (!form.contains(document.activeElement)) close(); }, 0);
  });
})();
