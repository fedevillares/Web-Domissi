/* Domissi Hermanos — buscador rápido global (overlay)
   Se abre con Ctrl/Cmd+K desde cualquier página. Filtra en vivo por
   coincidencia parcial, se navega con flechas + Enter, y cierra con Esc,
   click afuera o al elegir un resultado. El ícono de lupa del navbar ya
   no abre este overlay: ahora es el botón submit del input de búsqueda
   visible en la barra de navegación (ver .nav-search en styles.css). */
(function () {
  "use strict";
  var overlay = document.getElementById("searchOverlay");
  if (!overlay || !window.DomissiSearch) return;

  var input = overlay.querySelector("#overlaySearchInput");
  var clearBtn = overlay.querySelector("#overlaySearchClear");
  var results = overlay.querySelector("#overlayResults");
  var activeIndex = -1;
  var currentItems = [];
  var lastFocused = null;

  var iconClock =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z"/></svg>';
  var iconArrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderPopular() {
    var chips = window.DomissiSearch.popular();
    results.innerHTML =
      '<p class="search-overlay__hint">Categorías</p>' +
      chips
        .map(function (c, i) {
          return resultRow(c, i);
        })
        .join("");
    currentItems = chips;
    activeIndex = -1;
  }

  function resultRow(item, index) {
    return (
      '<button type="button" class="result-row" role="option" data-index="' + index + '">' +
      '<span class="result-row__icon">' + iconClock + "</span>" +
      '<span class="result-row__text"><span class="result-row__label">' + item.label + "</span>" +
      (item.categoryLabel && item.categoryLabel !== item.label
        ? '<span class="result-row__context">' + item.categoryLabel + "</span>"
        : "") +
      "</span>" +
      '<span class="result-row__arrow">' + iconArrow + "</span>" +
      "</button>"
    );
  }

  function renderResults(query) {
    var matches = window.DomissiSearch.search(query, 8);
    currentItems = matches;
    activeIndex = -1;
    if (!matches.length) {
      results.innerHTML =
        '<div class="search-empty">' +
        "<p>No encontramos resultados exactos para “" + escapeHtml(query) + "”.</p>" +
        '<a class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener" href="' +
        window.DomissiSearch.waLink(query) +
        '">Consultar por WhatsApp</a>' +
        "</div>";
      return;
    }
    results.innerHTML = matches.map(resultRow).join("");
  }

  function setActive(i) {
    var rows = results.querySelectorAll(".result-row");
    rows.forEach(function (r) { r.classList.remove("is-active"); });
    if (rows[i]) {
      rows[i].classList.add("is-active");
      rows[i].scrollIntoView({ block: "nearest" });
    }
    activeIndex = i;
  }

  function goTo(item) {
    window.location.href = window.DomissiSearch.url(item);
  }

  results.addEventListener("click", function (e) {
    var row = e.target.closest(".result-row");
    if (!row) return;
    var item = currentItems[Number(row.dataset.index)];
    if (item) goTo(item);
  });

  function open() {
    lastFocused = document.activeElement;
    overlay.classList.add("is-open");
    document.body.classList.add("search-open");
    input.value = "";
    clearBtn.hidden = true;
    renderPopular();
    setTimeout(function () { input.focus(); }, 50);
  }

  function close() {
    overlay.classList.remove("is-open");
    document.body.classList.remove("search-open");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  overlay.querySelectorAll("[data-search-close]").forEach(function (el) {
    el.addEventListener("click", close);
  });

  input.addEventListener("input", function () {
    clearBtn.hidden = !input.value;
    if (input.value.trim()) renderResults(input.value.trim());
    else renderPopular();
  });

  clearBtn.addEventListener("click", function () {
    input.value = "";
    clearBtn.hidden = true;
    renderPopular();
    input.focus();
  });

  input.addEventListener("keydown", function (e) {
    var rows = results.querySelectorAll(".result-row");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      var pick = currentItems[activeIndex >= 0 ? activeIndex : 0];
      if (pick) goTo(pick);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
    var isK = e.key === "k" || e.key === "K";
    if ((e.metaKey || e.ctrlKey) && isK) {
      e.preventDefault();
      if (overlay.classList.contains("is-open")) close();
      else open();
    }
  });
})();
