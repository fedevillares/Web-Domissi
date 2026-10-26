/* Domissi Hermanos — motor de búsqueda compartido (overlay + página /buscar)
   Búsqueda por coincidencia parcial (substring, sin distinguir acentos ni
   mayúsculas) sobre categorías y subcategorías reales del catálogo. No
   depende de un diccionario de términos exactos: "chap" ya encuentra
   "Chapas para techo". */
window.DomissiSearch = (function () {
  "use strict";

  function normalize(str) {
    return (str || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function buildIndex() {
    var items = [];
    (window.DOMISSI_CATALOG || []).forEach(function (cat) {
      cat.sub.forEach(function (sub) {
        items.push({
          label: sub.label,
          categoryLabel: cat.label,
          catId: cat.id,
          subId: sub.id,
          norm: normalize(sub.label + " " + cat.label)
        });
      });
    });
    return items;
  }

  var INDEX = null;
  function getIndex() {
    if (!INDEX) INDEX = buildIndex();
    return INDEX;
  }

  function search(query, limit) {
    var q = normalize(query);
    if (!q) return [];
    var seen = {};
    var results = getIndex()
      .filter(function (item) {
        return item.norm.indexOf(q) !== -1;
      })
      .filter(function (item) {
        var key = item.catId + "|" + item.subId;
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      })
      .sort(function (a, b) {
        var aStarts = normalize(a.label).indexOf(q) === 0 ? 0 : 1;
        var bStarts = normalize(b.label).indexOf(q) === 0 ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.label.length - b.label.length;
      });
    return results.slice(0, limit || 8);
  }

  function popular() {
    return (window.DOMISSI_CATALOG || []).map(function (cat) {
      return { label: cat.label, catId: cat.id, subId: cat.sub[0].id };
    });
  }

  function url(item) {
    return "productos.html?c=" + item.catId + "&s=" + item.subId;
  }

  function waLink(query) {
    var text = "Hola, te escribo a través del sitio web de Domissi. Estoy buscando: " + query + ".";
    return "https://wa.me/5493464609089?text=" + encodeURIComponent(text);
  }

  return { search: search, popular: popular, url: url, waLink: waLink, normalize: normalize };
})();
