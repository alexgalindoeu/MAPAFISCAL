// Anuncios (Google AdSense) en los huecos laterales. No toca la lógica de app.js: solo
// escucha eventos que ya dispara app.js (o los que se acuerden con Cuentas) y decide si
// mostrar, ocultar o cargar un hueco. Ver docs/negocio (fuera del repo) para el porqué de
// cada decisión: negocio/anuncios.md.
//
// Nada de esto carga ningún script de Google mientras `anuncios` sea false o el usuario
// tenga plan Gestor: en ese caso los huecos quedan `hidden` y esta cola no hace nada.
//
// Pendiente antes de poner `anuncios: true` (revisión de PR #51, no bloquea esta rama):
// 1. `tienePlan` no está expuesta por app.js todavía — hay que acordar con Cuentas cómo se
//    sabe si hay plan (exponerla en window o pasarla en el detalle del evento de abajo).
// 2. Nadie dispara todavía el evento `mapafiscal:resultado`: falta cablearlo en app.js.
// 3. Falta una CMP certificada por Google (obligatoria en el EEE antes de cargar
//    adsbygoogle.js): se integra junto con el banner de cookies de negocio/anuncios.md §3.
(function () {
  "use strict";

  const cfg = window.MAPAFISCAL_CONFIG || {};
  if (!cfg.anuncios || !cfg.adsenseCliente) return;

  // Un usuario con plan de pago no ve anuncios. `tienePlan()` la expone app.js; si no existe
  // todavía (versión vieja cacheada, o pendiente el punto 1 de arriba), nos quedamos sin
  // cargar nada por prudencia.
  const tienePlan = typeof window.tienePlan === "function" ? window.tienePlan : () => true;

  // Un hueco por id, con el id del bloque `<ins>` de AdSense que le corresponde (se crea en
  // la cuenta tras la aprobación; hasta entonces queda "" y ese hueco no se muestra, sin
  // pedir un anuncio a medio configurar). `carril: true` son los dos del margen de la
  // página: solo se muestran si la media query de .anuncio-carril (≥1600px) los deja ver —
  // AdSense no permite pedir anuncios a huecos que la propia página mantiene invisibles.
  const HUECOS = [
    { id: "anuncio-calc", slot: cfg.adsenseHuecoCalc || "" },
    { id: "anuncio-comparar", slot: cfg.adsenseHuecoComparar || "" },
    { id: "anuncio-rail-izq", slot: cfg.adsenseHuecoRailIzq || "", carril: true },
    { id: "anuncio-rail-der", slot: cfg.adsenseHuecoRailDer || "", carril: true }
  ];
  const CARRIL_VISIBLE = () => window.matchMedia("(min-width: 1600px)").matches;
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

  function mostrarHueco(hueco) {
    if (!hueco.slot) return; // sin bloque creado en AdSense todavía: no se pide nada
    if (hueco.carril && !CARRIL_VISIBLE()) return; // la página lo tiene oculto: no se pide
    const el = document.getElementById(hueco.id);
    if (!el || !el.hidden) return;
    el.hidden = false;
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.dataset.adClient = cfg.adsenseCliente;
    ins.dataset.adSlot = hueco.slot;
    ins.dataset.adFormat = "auto";
    ins.dataset.fullWidthResponsive = "true";
    el.appendChild(ins);
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
