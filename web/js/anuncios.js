// Anuncios (Google AdSense): carriles laterales «como en los periódicos» en escritorio y
// huecos en el flujo de la página. No toca la lógica de app.js: solo lee
// window.MAPAFISCAL_CUENTA y escucha «mapafiscal:cuenta» y «mapafiscal:vista».
//
// Reglas (negocio/anuncios.md, fuera del repo):
// - Con `anuncios: false` (o en la demo) no se ejecuta nada: ni Google, ni CMP, ni huecos.
// - Quien tiene plan de pago no ve anuncios ni el aviso de cookies.
// - Nada se pide a Google hasta saber si hay plan; cada hueco se llena una sola vez, cuando
//   está a punto de verse (IntersectionObserver) y con el navegador libre. Sin recargas.
// - Nunca en el formulario de cálculo ni pegados a botones; nunca en Planes, Mis clientes,
//   Perfil ni Metodología. Sin anuncios automáticos, anclados ni intersticiales.
// - Espacio reservado (CSS) para que el contenido no salte al cargar el anuncio.
// - Consentimiento: con `consentimiento: "google"`, la CMP certificada de Google
//   («Privacidad y mensajes» de AdSense, TCF) sale sola con adsbygoogle.js: no hay banner
//   propio. Con `"propio"`, un aviso con «Aceptar» y «Rechazar» iguales, y no se carga nada
//   de Google hasta que se acepta. Cualquier otro valor: no se cargan anuncios.
(function () {
  "use strict";

  const cfg = window.MAPAFISCAL_CONFIG || {};
  if (!cfg.anuncios || !cfg.adsenseCliente || cfg.demo) return;

  const HUECOS = [
    { id: "anuncio-rail-izq", slot: cfg.adsenseHuecoRailIzq || "", carril: true },
    { id: "anuncio-rail-der", slot: cfg.adsenseHuecoRailDer || "", carril: true },
    { id: "anuncio-calc-medio", slot: cfg.adsenseHuecoMovil || "" },
    { id: "anuncio-calc", slot: cfg.adsenseHuecoCalc || "" },
    { id: "anuncio-comparar", slot: cfg.adsenseHuecoComparar || "" }
  ].filter(h => h.slot && document.getElementById(h.id));
  if (!HUECOS.length) return;

  // Vistas sin anuncios: los carriles se ocultan al entrar en ellas.
  const SIN_ANUNCIOS = new Set(["planes", "clientes", "perfil", "metodologia"]);
  const PISTA_PLAN = "mapafiscal.sinAnuncios";        // «tenía plan»: evita reservar los carriles
  const CONSENTIMIENTO = "mapafiscal.consentimiento"; // solo en modo "propio"
  const CONSENT_MS = 24 * 30 * 24 * 3600 * 1000;      // 24 meses como máximo (AEPD §3.2.8)
  const html = document.documentElement;

  const leer = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

  // Tamaños de los carriles: AdSense pide definirlos en un <style> de la página, no en una
  // hoja externa (ayuda de AdSense 9183363), y sin data-ad-format en el <ins>.
  const estilo = document.createElement("style");
  estilo.textContent =
    ".mf_carril{display:inline-block;width:160px;height:600px}" +
    "@media (min-width:1920px){.mf_carril{width:300px;height:600px}}";
  document.head.appendChild(estilo);

  // 1. Provisional, sin esperar a la red: se reserva el espacio (carriles y huecos) salvo que
  //    este navegador ya sepa que hay plan. Así casi nadie ve saltos de diseño.
  function reservar(si) {
    html.classList.toggle("con-carriles", si && HUECOS.some(h => h.carril));
    HUECOS.forEach(h => { const el = document.getElementById(h.id); if (!h.lleno) el.hidden = !si; });
  }
  reservar(!leer(PISTA_PLAN));

  // 2. Al conocer la cuenta: con plan, todo fuera; sin plan, adelante.
  let permitido = false;
  function alConocerCuenta(c) {
    if (!c || !c.cargada) return;
    guardar(PISTA_PLAN, c.conPlan ? "1" : null);
    if (c.conPlan) {
      permitido = false;
      reservar(false);
      HUECOS.forEach(h => { document.getElementById(h.id).hidden = true; });
      return;
    }
    reservar(true);
    if (permitido) return;
    permitido = true;
    pedirConsentimientoYObservar();
  }

  // 3. Consentimiento.
  let consentido = false;
  function pedirConsentimientoYObservar() {
    const modo = cfg.consentimiento || "google";
    if (modo === "google") { consentido = true; observar(); return; }
    if (modo !== "propio") return;                     // sin CMP no se carga nada
    const previo = leerConsentimiento();
    if (previo === "si") { consentido = true; observar(); return; }
    if (previo === "no") return;
    observar();                                        // el aviso sale al ir a verse un anuncio
  }
  function leerConsentimiento() {
    try {
      const v = JSON.parse(leer(CONSENTIMIENTO) || "null");
      if (v && Date.now() - v.t < CONSENT_MS) return v.si ? "si" : "no";
    } catch (e) { /* valor corrupto: se vuelve a preguntar */ }
    return null;
  }
  let aviso = null;
  function mostrarAviso() {
    if (aviso) { aviso.hidden = false; return; }
    aviso = document.createElement("div");
    aviso.className = "aviso-cookies";
    aviso.setAttribute("role", "region");
    aviso.setAttribute("aria-label", "Cookies de publicidad");
    aviso.innerHTML =
      '<p>Mostramos anuncios de Google para mantener Mapafiscal gratis. ¿Aceptas que Google use cookies para ello? ' +
      'La web funciona igual si rechazas. <a href="legal/cookies.html#publicidad">Más información</a></p>' +
      '<div class="aviso-cookies-botones">' +
      '<button type="button" class="btn btn-sec btn-sm" data-consentir="no">Rechazar</button>' +
      '<button type="button" class="btn btn-sec btn-sm" data-consentir="si">Aceptar</button></div>';
    aviso.addEventListener("click", e => {
      const b = e.target.closest("[data-consentir]");
      if (!b) return;
      const si = b.dataset.consentir === "si";
      guardar(CONSENTIMIENTO, JSON.stringify({ si, t: Date.now() }));
      aviso.hidden = true;
      if (si) { consentido = true; pendientes.forEach(llenar); pendientes.length = 0; }
      else if (huboAnuncio) location.reload();          // retirar el consentimiento: sin anuncios ya
    });
    document.body.appendChild(aviso);
  }

  // 4. Carga diferida: cada hueco se llena cuando entra (casi) en pantalla.
  let io = null, scriptPuesto = false, huboAnuncio = false;
  const pendientes = [];
  function observar() {
    if (io || !("IntersectionObserver" in window)) { if (!io) HUECOS.forEach(alVerse); return; }
    io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      alVerse(HUECOS.find(h => h.id === e.target.id));
    }), { rootMargin: "300px 0px" });
    HUECOS.forEach(h => io.observe(document.getElementById(h.id)));
  }
  function alVerse(h) {
    if (!h || h.lleno || !permitido) return;
    if (!consentido) { if (!pendientes.includes(h)) pendientes.push(h); mostrarAviso(); return; }
    const ir = () => llenar(h);
    if ("requestIdleCallback" in window) requestIdleCallback(ir, { timeout: 2000 }); else setTimeout(ir, 200);
  }
  function llenar(h) {
    const el = document.getElementById(h.id);
    if (!permitido || h.lleno || !el || el.hidden) return;
    h.lleno = true; huboAnuncio = true;
    if (!scriptPuesto) {
      scriptPuesto = true;
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.adsenseCliente);
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
    }
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle" + (h.carril ? " mf_carril" : "");
    ins.dataset.adClient = cfg.adsenseCliente;
    ins.dataset.adSlot = h.slot;
    if (!h.carril) {
      ins.style.display = "block";
      ins.dataset.adFormat = "auto";
      ins.dataset.fullWidthResponsive = "true";
    }
    el.appendChild(ins);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }

  // Carriles fuera en las vistas sin anuncios (son de página, no de vista).
  function alCambiarVista(v) { html.classList.toggle("vista-sin-anuncios", SIN_ANUNCIOS.has(v)); }
  document.addEventListener("mapafiscal:vista", e => alCambiarVista(e.detail && e.detail.vista));
  alCambiarVista((location.hash || "#inicio").slice(1));

  // Enlace del pie para cambiar la decisión sobre cookies (AEPD §3.2.9).
  const enlace = document.getElementById("pie-configurar-cookies");
  if (enlace) {
    enlace.hidden = false;
    enlace.addEventListener("click", e => {
      if ((cfg.consentimiento || "google") === "google") {
        // Sin adsbygoogle.js cargado no hay CMP ni nada que retirar: el enlace lleva a la
        // política de cookies (su href). Con él, se reabre el mensaje de Google.
        if (!scriptPuesto) return;
        e.preventDefault();
        window.googlefc = window.googlefc || {};
        window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
        window.googlefc.callbackQueue.push(() => window.googlefc.showRevocationMessage());
      } else { e.preventDefault(); mostrarAviso(); }
    });
  }

  document.addEventListener("mapafiscal:cuenta", e => alConocerCuenta(e.detail));
  alConocerCuenta(window.MAPAFISCAL_CUENTA);
})();
