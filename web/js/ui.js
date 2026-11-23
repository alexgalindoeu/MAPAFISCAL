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

  // ---- pictogramas de las herramientas ------------------------------------------------------
  // Mismo lenguaje que la M del logo: polígonos macizos de bordes rectos (nada de trazos,
  // esquinas redondeadas ni círculos), rejilla de 24×24, verticales y una diagonal de unos
  // 60° (avance de 0,55 por unidad de altura). Azul (var(--marca)) por defecto; como mucho una
  // pieza amarilla (class="r", var(--resalte)) que marca lo importante. Los usan la portada
  // (web/js/app.js, 28 px) y el panel «Todo» (20 px); el CSS está en .ico de mapafiscal.css.
  const ICONOS = {
    // hoja de declaración con la esquina cortada, dos renglones y la casilla del resultado
    calculadora: '<path fill-rule="evenodd" d="M4 2h11l5 9v11H4zM7 6.5v2.5h6V6.5zM7 11.5V14h9v-2.5z"/><polygon class="r" points="10,16.5 17,16.5 17,20 10,20"/>',
    // dos barras desiguales; la diferencia, en amarillo sobre la más baja
    comparar: '<polygon points="3,4 10,4 10,21 3,21"/><polygon points="14,13 21,13 21,21 14,21"/><polygon class="r" points="14,4 21,4 21,11 14,11"/>',
    // la nómina entera y el trozo que se va (impuestos), separado por la diagonal
    nomina: '<polygon points="2,9 11,9 16.5,19 2,19"/><polygon class="r" points="13,5.5 22,5.5 22,15.5 18.5,15.5"/>',
    // un escalón; el peldaño nuevo, en amarillo
    subida: '<polygon points="2,22 2,15 10,15 10,22"/><polygon points="12,22 12,10 22,10 22,22"/><polygon class="r" points="12,4 22,4 22,8 12,8"/>',
    // depósito que se llena por escalones
    hucha: '<polygon points="2,3 5,3 5,19 19,19 19,3 22,3 22,22 2,22"/><polygon class="r" points="7,17 17,17 17,7 12.5,7 12.5,11.5 7,11.5"/>',
    // el mismo depósito, abierto por abajo y vaciándose
    rescate: '<polygon points="2,3 5,3 5,19 10,19 10,22 2,22"/><polygon points="14,19 19,19 19,3 22,3 22,22 14,22"/><polygon class="r" points="7,13 17,13 17,17 13.5,17 13.5,24 10.5,24 10.5,17 7,17"/>',
    // dos bloques que encajan por la diagonal sobre una misma base
    pareja: '<polygon points="2,4 12,4 3.5,18 2,18"/><polygon points="14.5,4 22,4 22,18 6,18"/><polygon class="r" points="2,20 22,20 22,22.5 2,22.5"/>',
    // dos pagadores: un bloque grande y otro pequeño (el segundo, el que cambia la cuenta)
    dospagadores: '<polygon points="2,4 14,4 14,20 2,20"/><polygon class="r" points="16,11 22,11 22,20 16,20"/>',
    // flecha inversa: del neto que quieres al bruto que pides
    bruto: '<polygon points="10,10 22,10 22,14 10,14"/><polygon class="r" points="2,12 7,3 11,3 6,12 11,21 7,21"/>',
    // porción recortada y desplazada por la diagonal
    deducciones: '<polygon points="2,2 19,2 19,6 11.5,19 2,19"/><polygon class="r" points="22,9 22,22 14.5,22"/>',
    // tres columnas alternativas; la elegida, en amarillo
    escenarios: '<polygon points="2,9 7,9 7,21 2,21"/><polygon class="r" points="9.5,4 14.5,4 14.5,21 9.5,21"/><polygon points="17,12 22,12 22,21 17,21"/>',
    // archivador de tres cajones con la etiqueta de uno
    cartera: '<path fill-rule="evenodd" d="M4 2h16v6H4zM4 9.5h16v6H4zM4 17h16v5H4zM9 4h6v1.5H9zM9 18.5h6V20H9z"/><polygon class="r" points="9,11.5 15,11.5 15,13.5 9,13.5"/>',
    // libro de pie y otro apoyado en ángulo
    libro: '<polygon points="3,3 8,3 8,21 3,21"/><polygon class="r" points="10,21 14.5,21 22,8 17.5,8"/><polygon points="2,22 22,22 22,23.5 2,23.5"/>',
    // casa con el tejado a la diagonal de la M y la puerta
    vivienda: '<polygon points="12,1.5 20,15.5 20,22 4,22 4,15.5"/><polygon class="r" points="10,15 14,15 14,22 10,22"/>',
    // fragmento de mapa: un territorio y su vecino
    territorio: '<polygon points="2,7 9,3 14,6 11.5,13 14.5,21 6,21 2,15"/><polygon class="r" points="16,4 22,6.5 21,15 17,19 13.5,12.5"/>',
    // una «A» angular con el travesaño en amarillo
    glosario: '<polygon points="2,22 9.5,2 13.5,2 6.5,22"/><polygon points="15,7 22,22 17.5,22 13,12.5"/><polygon class="r" points="5,13.5 19,13.5 19,17 5,17"/>'
  };
  const icono = (k, clase = "") => ICONOS[k] ? `<svg class="ico${clase ? " " + clase : ""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONOS[k]}</svg>` : "";


  // ---- catálogo del panel «Todo lo que ofrecemos» -----------------------------------------
  // href que empieza por "#": vista de la aplicación (index.html). Si no, página estática.
  const CATALOGO = [
    { grupo: "Calcular", items: [
      { titulo: "Calculadora de la renta", texto: "¿A pagar o a devolver? Tu IRPF al detalle, con las casillas de Renta Web.", href: "#calculadora", icono: "calculadora" },
      { titulo: "Sueldo neto", texto: "De bruto a neto en 12 o 14 pagas, en tu territorio.", href: "#sueldo-neto", icono: "nomina" },
      { titulo: "Sueldo al mes", texto: "Tu bruto anual entre 12, 14 o 15 pagas, en bruto y en neto.", href: "#sueldo-mes", icono: "nomina" },
      { titulo: "¿Qué sueldo bruto pido?", texto: "De neto a bruto, en los 19 territorios, y qué oferta de trabajo te deja más.", href: "#bruto-necesario", icono: "bruto" },
      { titulo: "¿Cuánto neto gano con mi subida?", texto: "Lo que de verdad llega al bolsillo de cada euro de subida.", href: "#sueldo-neto?subida", icono: "subida" },
      { titulo: "Dos pagadores", texto: "Si te obliga a declarar y cuánto te puede salir a pagar.", href: "#dos-pagadores", icono: "dospagadores" },
      { titulo: "¿Cuánto me devuelve Hacienda?", texto: "Hijos, alquiler, hipoteca, discapacidad, donativos… situación a situación.", href: "/cuanto-me-devuelve/", icono: "deducciones" }
    ] },
    { grupo: "Comparar", items: [
      { titulo: "Comparador de territorios", texto: "Tu misma situación en los 19 territorios, en mapa y en ranking.", href: "#comparar", icono: "comparar" },
      { titulo: "¿Conjunta o individual?", texto: "Qué declaración os conviene y cuánto os ahorráis.", href: "#conjunta", icono: "pareja" },
      { titulo: "Escenarios «¿y si…?»", texto: "Compara a la vez varias versiones de tu renta.", href: "#escenarios", icono: "escenarios" },
      { titulo: "Dónde se paga menos IRPF", texto: "Rankings de los 19 territorios para sueldos de referencia.", href: "/comparar-sueldo/", icono: "comparar" }
    ] },
    { grupo: "Planificar", items: [
      { titulo: "Ahorra antes del 31 de diciembre", texto: "Plan de pensiones y donativos: cuánto te rebajan el IRPF de este año.", href: "#plan-pensiones", icono: "hucha" },
      { titulo: "Rescatar el plan de pensiones", texto: "Cuánto tributa sacarlo de golpe, en renta o repartido en años.", href: "#rescate-plan", icono: "rescate" }
    ] },
    { grupo: "Guías y páginas", items: [
      { titulo: "Guías del IRPF", texto: "Tramos, mínimos, deducciones y calendario, con su norma.", href: "/guias/", icono: "libro" },
      { titulo: "Glosario del IRPF", texto: "Los términos de la renta, de la A a la Z.", href: "/glosario/", icono: "glosario" },
      { titulo: "Vivienda", texto: "Segunda vivienda, alquiler y venta: cómo tributan en el IRPF.", href: "/vivienda/", icono: "vivienda" },
      { titulo: "IRPF por territorio", texto: "Escala, mínimo y deducciones de cada comunidad y territorio foral.", href: "/irpf/", icono: "territorio" },
      { titulo: "Sueldo neto por importe", texto: "Tablas de bruto a neto de 15.000 a 100.000 € en los 19 territorios.", href: "/sueldo-neto/", icono: "nomina" },
      { titulo: "Declaración conjunta: casos", texto: "Con hijos, un solo sueldo, pareja de hecho o separados.", href: "/declaracion-conjunta/", icono: "pareja" },
      { titulo: "Dos pagadores: casos", texto: "Cuánto sale a pagar según lo que cobres del segundo.", href: "/dos-pagadores/", icono: "dospagadores" },
      { titulo: "Rescate del plan: casos", texto: "Lo que tributa rescatar según el importe y el territorio.", href: "/rescate-plan-pensiones/", icono: "rescate" },
      { titulo: "Cómo calculamos", texto: "El motor, las fuentes oficiales y lo que aún no cubrimos.", href: "#metodologia", icono: "calculadora" }
    ] },
    { grupo: "Profesionales", items: [
      { titulo: "Mis clientes", texto: "Para asesores y gestorías: tu cartera guardada y siempre recalculada.", href: "#clientes", icono: "cartera", plan: true },
      { titulo: "Planes", texto: "Gratis para particulares; plan Gestor para profesionales.", href: "#planes", icono: "cartera" }
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
        <li><a class="panel-item" href="${esc(resolver(it.href, opc))}">${icono(it.icono)}<span class="panel-txt"><b>${esc(it.titulo)}${it.plan ? ' <span class="plan-chip">Gestor</span>' : ""}</b><span>${esc(it.texto)}</span></span></a></li>`).join("")}</ul></section>`).join("");
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
    // El panel abierto es una entrada del historial (misma dirección): «atrás» (botón o gesto
    // del móvil) lo cierra en vez de salir de la página. Al cerrarlo de otra forma se quita esa
    // entrada; si se cierra por un enlace, se navega después de quitarla.
    let panel = null, origen = null, enHistorial = false, porHistorial = false, destino = null;
    const irDestino = () => { if (destino) { const u = destino; destino = null; location.assign(u); } };
    global.addEventListener("popstate", () => {
      if (panel && panel.open) { porHistorial = true; cerrar(); }
      else irDestino();
    });
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
        const a = e.target.closest("a");
        if (a && enHistorial && !(e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && a.target !== "_blank") {
          // primero se quita la entrada del panel; luego se sigue el enlace (popstate → irDestino)
          e.preventDefault(); e.stopPropagation();
          destino = a.href; cerrar();
          setTimeout(irDestino, 600);      // por si el navegador no avisa de la vuelta
          return;
        }
        if (e.target === panel || e.target.closest("[data-cerrar-panel]") || a) cerrar();
      });
      panel.addEventListener("close", () => {
        doc.documentElement.classList.remove("panel-abierto");
        if (bPanel) bPanel.setAttribute("aria-expanded", "false");
        if (origen && origen.focus && !destino) origen.focus({ preventScroll: true });
        if (enHistorial) {
          enHistorial = false;
          if (!porHistorial) { try { history.back(); } catch (e) { irDestino(); } }
        }
        porHistorial = false;
      });
      doc.body.appendChild(panel);
    }
    function abrir() {
      if (!panel) crearPanel();
      origen = doc.activeElement;
      if (typeof panel.showModal === "function") panel.showModal(); else panel.setAttribute("open", "");
      doc.documentElement.classList.add("panel-abierto");
      if (bPanel) bPanel.setAttribute("aria-expanded", "true");
      try { history.pushState(Object.assign({}, history.state, { panel: true }), ""); enHistorial = true; } catch (e) { /* sin historial */ }
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

    // Barra superior en el móvil: se aparta al bajar y vuelve al subir (CSS: .appbar.recogida).
    const appbar = doc.querySelector(".appbar");
    if (appbar && global.matchMedia) {
      const estrecha = global.matchMedia("(max-width: 760px)");
      let yAnt = global.scrollY, pendiente = false;
      global.addEventListener("scroll", () => {
        if (pendiente) return;
        pendiente = true;
        global.requestAnimationFrame(() => {
          pendiente = false;
          const y = global.scrollY, d = y - yAnt;
          if (!estrecha.matches || y < 120 || appbar.contains(doc.activeElement)) appbar.classList.remove("recogida");
          else if (d > 6) appbar.classList.add("recogida");
          else if (d < -6) appbar.classList.remove("recogida");
          if (Math.abs(d) > 6 || y < 120) yAnt = y;
        });
      }, { passive: true });
    }

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

  const API = { CLAVE_TEMA, SCRIPT_TEMA, CATALOGO, ICONOS, icono, REDES, HTML_BTN_TEMA, HTML_BTN_PANEL, resolver, htmlPanel, htmlRedes };
  if (typeof module === "object" && module.exports) module.exports = API;
  else global.MapafiscalUI = API;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
    else montar();
  }
})(typeof window !== "undefined" ? window : globalThis);
