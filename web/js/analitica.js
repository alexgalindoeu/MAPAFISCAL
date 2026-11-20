/* =============================================================================
 * Mapafiscal — analítica sin cookies (GoatCounter, https://www.goatcounter.com).
 *
 * Con `analitica: "goatcounter"` en config.js cuenta páginas vistas (las vistas de la web,
 * p. ej. «/#calculadora») y los eventos del embudo de EVENTOS. GoatCounter no guarda nada en
 * el navegador (ni cookies ni localStorage) ni la IP: no hace falta aviso de consentimiento.
 *
 * Reglas:
 * - Nunca datos personales ni importes: solo el nombre de la vista o del evento, de una lista
 *   cerrada. La ruta se construye aquí (nunca location.search ni el hash real, que puede llevar
 *   parámetros de Stripe o del acceso) y del referente solo se manda el dominio.
 * - En la demo o la versión autónoma no se carga nada (empaquetar.mjs quita además el script).
 * - Los demás scripts no dependen de este: avisan con el evento DOM «mapafiscal:medir»
 *   ({ detail: { evento } }) o con un elemento [data-medir="evento"] al pulsarlo.
 *
 * En Node (test/analitica.test.mjs) exporta la lógica pura.
 * ========================================================================== */
(function () {
  "use strict";

  const EVENTOS = ["calculo_iniciado", "calculo_completado", "resultado_compartido", "pdf_descargado", "registro", "suscripcion_iniciada", "carriles_uno", "carriles_dos"];
  const VISTA = /^[a-z0-9-]{1,40}$/;

  function activa(cfg) {
    cfg = cfg || {};
    return cfg.analitica === "goatcounter" && !cfg.demo && /^[a-z0-9-]{2,50}$/.test(cfg.goatcounterCodigo || "");
  }
  // Ruta de una vista de la web: «inicio» es la portada; lo que no sea un nombre de vista, también.
  function rutaVista(pathname, vista) {
    const base = /^\/[A-Za-z0-9\/._-]*$/.test(pathname || "") ? pathname.replace(/index\.html$/, "") : "/";
    return vista && vista !== "inicio" && VISTA.test(vista) ? base + "#" + vista : base;
  }
  // Datos para goatcounter.count() de un evento; null si no está en la lista.
  function datosEvento(nombre) {
    if (!EVENTOS.includes(nombre)) return null;
    return { path: nombre, title: nombre, event: true };
  }
  // Solo el dominio del referente, y nada si es la propia web.
  function referente(ref, origen) {
    try {
      const u = new URL(ref);
      if (!/^https?:$/.test(u.protocol) || u.origin === origen) return "";
      return u.origin;
    } catch (e) { return ""; }
  }

  const API = { EVENTOS, activa, rutaVista, datosEvento, referente };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  // ==== navegador ==========================================================================
  const cfg = window.MAPAFISCAL_CONFIG || {};
  if (!activa(cfg)) return;

  const cola = [];
  let listo = false;
  function enviar(datos) {
    if (listo && window.goatcounter && typeof window.goatcounter.count === "function") {
      try { window.goatcounter.count(datos); } catch (e) { /* la analítica nunca rompe la web */ }
    } else cola.push(datos);
  }
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = "https://" + cfg.goatcounterCodigo + ".goatcounter.com/count";
  s.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
  s.onload = () => { listo = true; cola.splice(0).forEach(enviar); };
  document.head.appendChild(s);

  // páginas vistas: la de entrada y cada cambio de vista (app.js puede avisar dos veces seguidas)
  let ultimaRuta = null, primera = true;
  function vista(v) {
    const path = rutaVista(location.pathname, v);
    if (path === ultimaRuta) return;
    ultimaRuta = path;
    enviar({ path, title: v || "inicio", referrer: primera ? referente(document.referrer, location.origin) : "" });
    primera = false;
  }
  vista((location.hash || "#inicio").slice(1).split(/[?&=]/)[0]);
  document.addEventListener("mapafiscal:vista", e => vista(e.detail && e.detail.vista));

  // eventos: cada uno una vez por carga de página, salvo los que pueden repetirse con sentido
  const REPETIBLES = new Set(["pdf_descargado", "resultado_compartido", "suscripcion_iniciada"]);
  const hechos = new Set();
  function evento(nombre) {
    const d = datosEvento(nombre);
    if (!d || (!REPETIBLES.has(nombre) && hechos.has(nombre))) return;
    hechos.add(nombre);
    enviar(d);
  }
  document.addEventListener("mapafiscal:medir", e => evento(e.detail && e.detail.evento));
  document.addEventListener("click", e => {
    const el = e.target.closest && e.target.closest("[data-medir]");
    if (el) evento(el.dataset.medir);
  });

  // embudo del cálculo: «iniciado» al tocar el formulario (o la mini-calculadora de la portada);
  // «completado» cuando, ya iniciado, hay un resultado y el usuario deja de teclear 3 s.
  let iniciado = false, pausa = null;
  const enCalculo = t => t && t.closest && t.closest("#form, #minicalc");
  ["input", "change"].forEach(tipo => document.addEventListener(tipo, e => {
    if (!enCalculo(e.target) || iniciado) return;
    iniciado = true;
    evento("calculo_iniciado");
  }, true));
  document.addEventListener("mapafiscal:resultado", () => {
    if (!iniciado) return;
    clearTimeout(pausa);
    pausa = setTimeout(() => evento("calculo_completado"), 3000);
  });

  window.MapafiscalAnalitica = { evento };
})();
