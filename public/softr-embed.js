/*
 * Script compartido para los bloques de código de Softr que embeben los
 * reportes (Growth, Influencers, Prensa, Performance, Cashflow). Reemplaza
 * la lógica que antes estaba duplicada en cada bloque (ver el commit que
 * agrega esto para el bloque viejo de Influencers, que sirvió de base).
 *
 * Qué resuelve: antes, qué secciones tenía "contratadas" un cliente vivía
 * en campos PBI_* por USUARIO en la tabla de Softr — dar de alta un
 * cliente nuevo significaba tocar esos campos en cada fila de usuario, y
 * el punto del menú era solo cosmético (el iframe cargaba igual aunque el
 * campo estuviera vacío). Ahora esa decisión vive en una sola tabla por
 * CLIENTE (client_products en Supabase) y se resuelve vía
 * /api/portal/products — un alta de cliente es una fila, no N campos.
 *
 * Cada bloque de Softr solo necesita:
 *   <div id="report-outer-<slug>">
 *     <iframe id="report-dashboard-<slug>"></iframe>
 *     <div id="report-empty-<slug>">...</div>
 *   </div>
 *   <script src=".../softr-embed.js" data-report="<slug>" data-path="/reportes/<slug>/secure"></script>
 */
(function () {
  var scriptEl = document.currentScript;
  if (!scriptEl) return;

  var REPORT_ORIGIN = "https://claude-ecru-three.vercel.app";
  var reportSlug = scriptEl.dataset.report;
  var reportPath = scriptEl.dataset.path;
  if (!reportSlug || !reportPath) return;

  // Nombre del producto (como aparece en el menú) -> clave en client_products.
  var SECTION_FIELDS = {
    Growth: "growth",
    Influencers: "influencers",
    Prensa: "prensa",
    Performance: "performance",
    Cashflow: "cashflow",
  };

  var lastProductos = null;

  function paintMenuDots(productos) {
    document.querySelectorAll(".coolmetrics-status-dot").forEach(function (dot) {
      dot.remove();
    });
    document.querySelectorAll('a, button, [role="link"], [role="menuitem"]').forEach(function (element) {
      var text = element.textContent.replace(/OFF/g, "").trim();
      Object.keys(SECTION_FIELDS).forEach(function (sectionName) {
        if (text !== sectionName) return;
        var active = !!(productos && productos[SECTION_FIELDS[sectionName]]);
        var dot = document.createElement("span");
        dot.className = "coolmetrics-status-dot " + (active ? "active" : "inactive");
        dot.title = active ? "Activo" : "No contratado";
        element.appendChild(dot);
      });
    });
  }

  function run() {
    var iframe = document.getElementById("report-dashboard-" + reportSlug);
    var emptyState = document.getElementById("report-empty-" + reportSlug);
    if (!iframe) return;

    var userEmail = (window.logged_in_user && window.logged_in_user.softr_user_email) || "";
    var userToken = (window.logged_in_user && window.logged_in_user.AsisToken) || "";

    if (!userEmail || !userToken) {
      if (emptyState) emptyState.style.display = "flex";
      return;
    }

    var query = "u=" + encodeURIComponent(userEmail) + "&t=" + encodeURIComponent(userToken);

    fetch(REPORT_ORIGIN + "/api/portal/products?" + query)
      .then(function (res) {
        return res.ok ? res.json() : Promise.reject(new Error("status " + res.status));
      })
      .then(function (data) {
        lastProductos = data && data.productos;
        paintMenuDots(lastProductos);
        var active = !!(lastProductos && lastProductos[reportSlug]);
        if (active) {
          iframe.src = REPORT_ORIGIN + reportPath + "?" + query;
          iframe.style.display = "block";
          if (emptyState) emptyState.style.display = "none";
        } else {
          iframe.style.display = "none";
          if (emptyState) emptyState.style.display = "flex";
        }
      })
      .catch(function () {
        // Si /api/portal/products falla (red, server caído), no bloqueamos
        // el acceso: se muestra el reporte igual, como pasaba antes de esto.
        iframe.src = REPORT_ORIGIN + reportPath + "?" + query;
        iframe.style.display = "block";
        if (emptyState) emptyState.style.display = "none";
      });

    window.addEventListener("message", function (event) {
      if (event.origin !== REPORT_ORIGIN) return;
      if (!event.data || event.data.source !== "coolmetrics-report") return;
      if (typeof event.data.height === "number" && event.data.height > 0) {
        iframe.style.height = event.data.height + "px";
      }
      if (typeof event.data.wheelDeltaY === "number") {
        window.scrollBy({ top: event.data.wheelDeltaY, left: 0, behavior: "auto" });
      }
    });

    var menuTimer;
    new MutationObserver(function () {
      clearTimeout(menuTimer);
      menuTimer = setTimeout(function () {
        if (lastProductos) paintMenuDots(lastProductos);
      }, 250);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
