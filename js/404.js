/* Domissi Hermanos — página 404: accesos directos a las categorías del catálogo. */
(function () {
  "use strict";
  var host = document.getElementById("nfCats");
  var cats = window.DOMISSI_CATALOG || [];
  if (!host || !cats.length) return;
  host.innerHTML = cats.map(function (c) {
    return '<a href="productos.html?c=' + c.id + '">' + c.label.replace(/[&<>"]/g, "") + "</a>";
  }).join("");
})();
