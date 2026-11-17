// =============================================================================
// Mapafiscal — piezas comunes de la interfaz en todas las páginas (aplicación, páginas SEO,
// guías, legales y 404):
//   - tema claro / oscuro / automático (botón de la barra, guardado en localStorage);
//   - panel lateral «Todo lo que ofrecemos» (todas las herramientas agrupadas);
//   - enlaces a las redes sociales del pie (window.MAPAFISCAL_CONFIG.redes).
// El <head> de cada página lleva un script mínimo que aplica el tema guardado antes de
// pintar (sin parpadeo); ver SCRIPT_TEMA, que tools/seo_comun.mjs copia tal cual.
// En Node (tools/seo_comun.mjs y los tests) exporta el catálogo y los generadores de HTML.
// =============================================================================
(function (global) {
  "use strict";

  const CLAVE_TEMA = "mf-tema";
  // Script del <head>: aplica el tema guardado antes del primer pintado.
  const SCRIPT_TEMA = `<script>try{var t=localStorage.getItem("${CLAVE_TEMA}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}<\/script>`; // «<\/» para que no cierre el <script> al incrustarlo

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- iconos de línea (24×24, trazo con currentColor) ----------------------------------
  const ICONOS = {
    calculadora: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15v3M8.5 18h.01M12 18h.01"/>',
    mapa: '<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    cartera: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18"/>',
    nomina: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5h1M16.5 14.5h1"/>',
    hucha: '<path d="M4 12a7 6 0 0 1 13.4-2.4L20 9v4l-2 1a7 6 0 0 1-2 3v2h-2.5v-1.2a8 8 0 0 1-3 0V19H8v-2a6 6 0 0 1-4-5z"/><path d="M10 7.5h3M15 11h.01"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>',
    grafico: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>',
    subida: '<path d="M4 18 10 12l4 4 6-7"/><path d="M15 9h5v5"/>',
    pareja: '<circle cx="8.5" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3 20a5.5 5.5 0 0 1 11 0M13.5 20a4.5 4.5 0 0 1 7.5-3.4"/>',
    dospagadores: '<rect x="3" y="4" width="11" height="8" rx="1.5"/><rect x="10" y="12" width="11" height="8" rx="1.5"/><path d="M6 8h5M13 16h5"/>',
    rescate: '<path d="M12 3v9M8 8l4 4 4-4"/><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    devolucion: '<path d="M4 9h12a4 4 0 0 1 0 8H9"/><path d="M8 5 4 9l4 4"/>',
    libro: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
    territorio: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    ranking: '<path d="M5 20v-6h4v6M10 20V8h4v12M15 20v-9h4v9M3 20h18"/>',
    lupa: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>',
    escudo: '<path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    estrella: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'
  };
  const icono = k => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONOS[k] || ICONOS.grafico}</svg>`;

  // ---- catálogo del panel «Todo lo que ofrecemos» -----------------------------------------
  // href que empieza por "#": vista de la aplicación (index.html). Si no, página estática.
  const CATALOGO = [
    { grupo: "Calcular", items: [
      { titulo: "Calculadora de la renta", texto: "¿A pagar o a devolver? Tu IRPF al detalle, con las casillas de Renta Web.", href: "#calculadora", icono: "calculadora" },
      { titulo: "Sueldo neto", texto: "De bruto a neto en 12 o 14 pagas, en tu territorio.", href: "#sueldo-neto", icono: "nomina" },
      { titulo: "¿Cuánto neto gano con mi subida?", texto: "Lo que de verdad llega al bolsillo de cada euro de subida.", href: "#sueldo-neto?subida", icono: "subida" },
      { titulo: "Dos pagadores", texto: "Si te obliga a declarar y cuánto te puede salir a pagar.", href: "#dos-pagadores", icono: "dospagadores" },
      { titulo: "¿Cuánto me devuelve Hacienda?", texto: "Hijos, alquiler, hipoteca, discapacidad, donativos… situación a situación.", href: "/cuanto-me-devuelve/", icono: "devolucion" }
    ] },
    { grupo: "Comparar", items: [
      { titulo: "Comparador de territorios", texto: "Tu misma situación en los 19 territorios, en mapa y en ranking.", href: "#comparar", icono: "mapa" },
      { titulo: "¿Conjunta o individual?", texto: "Qué declaración os conviene y cuánto os ahorráis.", href: "#conjunta", icono: "pareja" },
      { titulo: "Escenarios «¿y si…?»", texto: "Compara a la vez varias versiones de tu renta.", href: "#escenarios", icono: "grafico" },
      { titulo: "Dónde se paga menos IRPF", texto: "Rankings de los 19 territorios para sueldos de referencia.", href: "/comparar-sueldo/", icono: "ranking" }
    ] },
    { grupo: "Planificar", items: [
      { titulo: "Ahorra antes del 31 de diciembre", texto: "Plan de pensiones y donativos: cuánto te rebajan el IRPF de este año.", href: "#plan-pensiones", icono: "hucha" },
      { titulo: "Rescatar el plan de pensiones", texto: "Cuánto tributa sacarlo de golpe, en renta o repartido en años.", href: "#rescate-plan", icono: "rescate" }
    ] },
    { grupo: "Guías y páginas", items: [
      { titulo: "Guías del IRPF", texto: "Tramos, mínimos, deducciones y calendario, con su norma.", href: "/guias/", icono: "libro" },
      { titulo: "IRPF por territorio", texto: "Escala, mínimo y deducciones de cada comunidad y territorio foral.", href: "/irpf/", icono: "territorio" },
      { titulo: "Sueldo neto por importe", texto: "Tablas de bruto a neto de 15.000 a 100.000 € en los 19 territorios.", href: "/sueldo-neto/", icono: "nomina" },
      { titulo: "Declaración conjunta: casos", texto: "Con hijos, un solo sueldo, pareja de hecho o separados.", href: "/declaracion-conjunta/", icono: "pareja" },
      { titulo: "Dos pagadores: casos", texto: "Cuánto sale a pagar según lo que cobres del segundo.", href: "/dos-pagadores/", icono: "dospagadores" },
      { titulo: "Rescate del plan: casos", texto: "Lo que tributa rescatar según el importe y el territorio.", href: "/rescate-plan-pensiones/", icono: "rescate" },
      { titulo: "Cómo calculamos", texto: "El motor, las fuentes oficiales y lo que aún no cubrimos.", href: "#metodologia", icono: "lupa" }
    ] },
    { grupo: "Profesionales", items: [
      { titulo: "Mis clientes", texto: "Para asesores y gestorías: tu cartera guardada y siempre recalculada.", href: "#clientes", icono: "cartera", plan: true },
      { titulo: "Planes", texto: "Gratis para particulares; plan Gestor para profesionales.", href: "#planes", icono: "estrella" }
    ] }
  ];

  // Dirección final de un enlace del catálogo. enApp: estamos en index.html (vistas por #).
  // base: prefijo de las páginas estáticas ("" en la web; "https://mapafiscal.es" en la
  // versión autónoma, que no las lleva dentro).
  function resolver(href, { enApp, base = "" }) {
    if (href.startsWith("#")) return enApp ? href : base + "/index.html" + href;
    return base + href;
  }

  function htmlPanel(opc) {
    const grupos = CATALOGO.map((g, i) => `
      <section class="panel-grupo" aria-labelledby="panel-g${i}"><h3 class="rotulo" id="panel-g${i}">${esc(g.grupo)}</h3><ul>${g.items.map(it => `
        <li><a class="panel-item" href="${esc(resolver(it.href, opc))}"><span class="panel-ico">${icono(it.icono)}</span><span class="panel-txt"><b>${esc(it.titulo)}${it.plan ? ' <span class="plan-chip">Gestor</span>' : ""}</b><span>${esc(it.texto)}</span></span></a></li>`).join("")}</ul></section>`).join("");
    return `<div class="panel-in">
      <div class="panel-cab"><h2 id="panel-todo-t">Todo lo que ofrecemos</h2>
        <button class="panel-cerrar" type="button" data-cerrar-panel aria-label="Cerrar el panel"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>
      <nav class="panel-cuerpo" aria-label="Todas las herramientas">${grupos}</nav>
    </div>`;
  }

  // ---- redes sociales ---------------------------------------------------------------------
  const REDES = [
    { k: "x", nombre: "X", svg: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="relleno" d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.59-6.64 7.59H.47l8.6-9.83L0 1.15h7.59l5.24 6.93zm-1.29 19.5h2.04L6.49 3.24H4.3z"/></svg>' },
    { k: "reddit", nombre: "Reddit", svg: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><ellipse cx="12" cy="14.5" rx="8" ry="5.6"/><circle cx="4.6" cy="10.6" r="1.8"/><circle cx="19.4" cy="10.6" r="1.8"/><path d="M12 8.9 13.4 3.6l4.4 1"/><circle cx="19.2" cy="5" r="1.4"/><circle class="relleno" cx="9" cy="13.4" r="1.15"/><circle class="relleno" cx="15" cy="13.4" r="1.15"/><path d="M9 16.6c1.8 1.2 4.2 1.2 6 0"/></svg>' },
    { k: "facebook", nombre: "Facebook", svg: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="relleno" d="M24 12.07C24 5.44 18.63.07 12 .07S0 5.44 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.38H7.08v-3.47h3.05V9.43c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.23 2.69.23v2.95h-1.51c-1.49 0-1.96.93-1.96 1.88v2.25h3.33l-.53 3.47h-2.8v8.38C19.61 23.03 24 18.06 24 12.07z"/></svg>' }
  ];
  const urlValida = u => typeof u === "string" && /^https:\/\/[^\s"<>]+$/.test(u.trim());
  // HTML del bloque de redes, o "" si no hay ninguna con URL.
  function htmlRedes(redes) {
    const r = redes || {};
    const enlaces = REDES.filter(x => urlValida(r[x.k])).map(x =>
      `<a class="red red-${x.k}" href="${esc(r[x.k].trim())}" rel="me noopener" target="_blank" aria-label="Mapafiscal en ${x.nombre} (se abre en otra pestaña)" title="Mapafiscal en ${x.nombre}">${x.svg}</a>`);
    return enlaces.length ? `<p class="pie-redes"><span class="pie-redes-txt">Síguenos</span>${enlaces.join("")}</p>` : "";
  }

  // ---- tema -------------------------------------------------------------------------------
  const TEMAS = ["auto", "light", "dark"];
  const ETIQUETA_TEMA = { auto: "automático (como el sistema)", light: "claro", dark: "oscuro" };
  const ICONO_TEMA = {
    auto: '<circle cx="12" cy="12" r="8"/><path class="relleno" d="M12 4a8 8 0 0 1 0 16z"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    dark: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'
  };
  const HTML_BTN_TEMA = `<button class="btn-icono tema-btn" id="btn-tema" type="button" aria-label="Tema: automático (como el sistema). Cambiar a claro" title="Tema: automático"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONO_TEMA.auto}</svg></button>`;
  const HTML_BTN_PANEL = `<button class="btn-icono panel-btn" id="btn-todo" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="panel-todo" aria-label="Todo lo que ofrecemos" title="Todo lo que ofrecemos"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6.5h16M4 12h16M4 17.5h10"/></svg><span class="panel-btn-txt">Todo</span></button>`;

  function leerTema() {
    try { const t = localStorage.getItem(CLAVE_TEMA); return t === "light" || t === "dark" ? t : "auto"; } catch (e) { return "auto"; }
  }
  function aplicarTema(t, guardar) {
    const raiz = document.documentElement;
    if (t === "light" || t === "dark") raiz.setAttribute("data-theme", t); else raiz.removeAttribute("data-theme");
    if (guardar) { try { if (t === "auto") localStorage.removeItem(CLAVE_TEMA); else localStorage.setItem(CLAVE_TEMA, t); } catch (e) { /* sin almacenamiento: solo esta visita */ } }
    const b = document.getElementById("btn-tema");
    if (b) {
      const sig = TEMAS[(TEMAS.indexOf(t) + 1) % TEMAS.length];
      b.setAttribute("aria-label", `Tema: ${ETIQUETA_TEMA[t]}. Cambiar a ${ETIQUETA_TEMA[sig]}`);
      b.title = `Tema: ${ETIQUETA_TEMA[t]}`;
      b.dataset.tema = t;
      b.querySelector("svg").innerHTML = ICONO_TEMA[t];
    }
  }

  // ---- montaje en el navegador ---------------------------------------------------------------
  function montar() {
    const doc = document, cfg = global.MAPAFISCAL_CONFIG || {};
    const enApp = !!doc.getElementById("v-inicio");
    const http = /^https?:$/.test(location.protocol);
    const base = (enApp && cfg.demo) || !http ? "https://mapafiscal.es" : "";
    const barra = doc.querySelector(".appbar-in");

    // Botones de la barra: van en el HTML de la aplicación y de las páginas generadas; en las
    // demás (legales, 404) se añaden aquí.
    if (barra && !doc.getElementById("btn-todo")) barra.insertAdjacentHTML("afterbegin", HTML_BTN_PANEL);
    if (barra && !doc.getElementById("btn-tema")) {
      const der = barra.querySelector(".appbar-der");
      if (der) der.insertAdjacentHTML("afterbegin", HTML_BTN_TEMA);
      else barra.insertAdjacentHTML("beforeend", `<div class="appbar-der">${HTML_BTN_TEMA}</div>`);
    }

    // Tema
    aplicarTema(leerTema(), false);
    const bTema = doc.getElementById("btn-tema");
    if (bTema) bTema.addEventListener("click", () => {
      const t = TEMAS[(TEMAS.indexOf(leerTema()) + 1) % TEMAS.length];
      aplicarTema(t, true);
    });
    global.addEventListener("storage", e => { if (e.key === CLAVE_TEMA) aplicarTema(leerTema(), false); });

    // Panel lateral
    const bPanel = doc.getElementById("btn-todo");
    let panel = null, origen = null;
    function crearPanel() {
      panel = doc.createElement("dialog");
      panel.className = "panel-todo";
      panel.id = "panel-todo";
      panel.setAttribute("aria-labelledby", "panel-todo-t");
      panel.innerHTML = htmlPanel({ enApp, base });
      // marca la página o vista actual
      const aqui = enApp ? (location.hash || "#inicio") : location.pathname;
      for (const a of panel.querySelectorAll("a.panel-item")) {
        const h = a.getAttribute("href");
        if ((enApp && h === aqui) || (!enApp && !h.includes("#") && h.replace(base, "") !== "/" && aqui.startsWith(h.replace(base, "")))) a.setAttribute("aria-current", "page");
      }
      panel.addEventListener("click", e => {
        if (e.target === panel || e.target.closest("[data-cerrar-panel]") || e.target.closest("a")) cerrar();
      });
      panel.addEventListener("close", () => {
        doc.documentElement.classList.remove("panel-abierto");
        if (bPanel) bPanel.setAttribute("aria-expanded", "false");
        if (origen && origen.focus) origen.focus();
      });
      doc.body.appendChild(panel);
    }
    function abrir() {
      if (!panel) crearPanel();
      origen = doc.activeElement;
      if (typeof panel.showModal === "function") panel.showModal(); else panel.setAttribute("open", "");
      doc.documentElement.classList.add("panel-abierto");
      if (bPanel) bPanel.setAttribute("aria-expanded", "true");
      const actual = panel.querySelector('[aria-current="page"]') || panel.querySelector(".panel-item");
      if (actual) actual.focus();
    }
    function cerrar() {
      if (!panel) return;
      if (typeof panel.close === "function" && panel.open) panel.close();
      else { panel.removeAttribute("open"); panel.dispatchEvent(new Event("close")); }
    }
    if (bPanel) bPanel.addEventListener("click", abrir);
    doc.addEventListener("keydown", e => { if (e.key === "Escape" && panel && panel.open) { e.preventDefault(); cerrar(); } });

    // Redes del pie (las páginas generadas ya las llevan en el HTML)
    const pie = doc.querySelector(".pie-in");
    if (pie && !pie.querySelector(".pie-redes")) {
      const html = htmlRedes(cfg.redes);
      if (html) {
        const primero = pie.querySelector("p");
        if (primero) primero.insertAdjacentHTML("afterend", html); else pie.insertAdjacentHTML("beforeend", html);
      }
    }
  }

  const API = { CLAVE_TEMA, SCRIPT_TEMA, CATALOGO, ICONOS, REDES, HTML_BTN_TEMA, HTML_BTN_PANEL, resolver, htmlPanel, htmlRedes };
  if (typeof module === "object" && module.exports) module.exports = API;
  else global.MapafiscalUI = API;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
    else montar();
  }
})(typeof window !== "undefined" ? window : globalThis);
