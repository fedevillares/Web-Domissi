/* Domissi Hermanos — página Buscar
   Filtra en vivo mientras se escribe (coincidencia parcial, sin distinguir
   acentos/mayúsculas) usando el mismo motor que el overlay del navbar.
   Enter navega al primer resultado; borrar el texto vuelve a las categorías
   populares; sin resultados muestra un CTA directo a WhatsApp con el término
   buscado, para no dejar al visitante sin salida. */
(function () {
  "use strict";
  var form = document.getElementById("searchForm");
  var input = document.getElementById("searchInput");
  var clearBtn = document.getElementById("searchClear");
  var resultsHost = document.getElementById("searchResults");
  var quickLinksSection = document.querySelector(".quick-links");
  var quickGrid = document.querySelector(".quick-grid");
  if (!form || !input || !window.DomissiSearch) return;

  var iconClock =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z"/></svg>';
  var iconArrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function resultRow(item, index) {
    return (
      '<button type="button" class="result-row" role="option" data-index="' + index + '">' +
      '<span class="result-row__icon">' + iconClock + "</span>" +
      '<span class="result-row__text"><span class="result-row__label">' + escapeHtml(item.label) + "</span>" +
      (item.categoryLabel && item.categoryLabel !== item.label
        ? '<span class="result-row__context">' + escapeHtml(item.categoryLabel) + "</span>"
        : "") +
      "</span>" +
      '<span class="result-row__arrow">' + iconArrow + "</span>" +
      "</button>"
    );
  }

  var currentItems = [];

  function showQuickLinks(show) {
    if (quickLinksSection) quickLinksSection.hidden = !show;
  }

  function renderEmptyState(query) {
    resultsHost.innerHTML =
      '<div class="search-empty">' +
      "<p>No encontramos resultados exactos para “" + escapeHtml(query) + "”. Probá con otra palabra o consultá directo con un asesor.</p>" +
      '<a class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener" href="' +
      window.DomissiSearch.waLink(query) +
      '">Consultar por WhatsApp</a>' +
      "</div>";
    currentItems = [];
  }

  function renderResults(query) {
    var matches = window.DomissiSearch.search(query, 12);
    currentItems = matches;
    if (!matches.length) {
      renderEmptyState(query);
      return;
    }
    resultsHost.innerHTML = matches.map(resultRow).join("");
  }

  function update() {
    var value = input.value.trim();
    clearBtn.hidden = !value;
    if (!value) {
      resultsHost.innerHTML = "";
      showQuickLinks(true);
      return;
    }
    showQuickLinks(false);
    renderResults(value);
  }

  resultsHost.addEventListener("click", function (e) {
    var row = e.target.closest(".result-row");
    if (!row) return;
    var item = currentItems[Number(row.dataset.index)];
    if (item) window.location.href = window.DomissiSearch.url(item);
  });

  input.addEventListener("input", update);

  clearBtn.addEventListener("click", function () {
    input.value = "";
    update();
    input.focus();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var value = input.value.trim();
    if (!value) return;
    if (currentItems.length) {
      window.location.href = window.DomissiSearch.url(currentItems[0]);
    }
  });

  if (quickGrid) {
    window.DomissiSearch.popular().forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = item.label;
      btn.addEventListener("click", function () {
        window.location.href = window.DomissiSearch.url(item);
      });
      quickGrid.appendChild(btn);
    });
  }

  /* Precarga el término si se llegó desde la barra de búsqueda del navbar (?q=) */
  var initialQuery = new URLSearchParams(window.location.search).get("q");
  if (initialQuery) input.value = initialQuery;

  update();
})();
