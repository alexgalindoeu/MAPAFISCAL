// Anuncios (Google AdSense) en los huecos laterales. No toca la lógica de app.js: solo
// escucha eventos que ya dispara app.js (o los que se acuerden con Cuentas) y decide si
// mostrar, ocultar o cargar un hueco. Ver docs/negocio (fuera del repo) para el porqué de
// cada decisión: negocio/anuncios.md.
//
// Nada de esto carga ningún script de Google mientras `anuncios` sea false o el usuario
// tenga plan Pro: en ese caso los huecos quedan `hidden` y esta cola no hace nada.
(function () {
  "use strict";

  const cfg = window.MAPAFISCAL_CONFIG || {};
  if (!cfg.anuncios || !cfg.adsenseCliente) return;

  // Un usuario con plan de pago no ve anuncios. `tienePlan()` la expone app.js; si no existe
  // todavía (versión vieja cacheada), nos quedamos sin cargar nada por prudencia.
  const tienePlan = typeof window.tienePlan === "function" ? window.tienePlan : () => true;

  const HUECOS = ["anuncio-calc", "anuncio-comparar"]; // ids de los <aside> en index.html
  let cargado = false;

  function cargarScriptAdsense() {
    if (cargado) return;
    cargado = true;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.adsenseCliente);
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);
  }

  function mostrarHueco(id) {
    const el = document.getElementById(id);
    if (!el || !el.hidden) return;
    el.hidden = false;
    // Cada hueco es un bloque <ins class="adsbygoogle"> dentro del <aside>; adsbygoogle.js
    // rellena uno por elemento la primera vez que se le llama para él.
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }

  function alVerResultado() {
    if (tienePlan()) return;
    cargarScriptAdsense();
    HUECOS.forEach(mostrarHueco);
  }

  // Carga diferida: solo cuando el navegador está libre y el hueco está a punto de verse.
  // `app.js` dispara este evento cuando ya hay un resultado calculado o se abre "Comparar";
  // el nombre exacto se acuerda con la sesión de Cuentas antes de cablear el disparo real.
  document.addEventListener("mapafiscal:resultado", function () {
    if ("requestIdleCallback" in window) requestIdleCallback(alVerResultado, { timeout: 2000 });
    else setTimeout(alVerResultado, 300);
  });
})();
