/* =============================================================================
 * Mapafiscal — enlaces para compartir, deslizador de sueldo del comparador y comparador
 * de escenarios personales (#escenarios).
 *
 * - Compartir: la situación viaja entera en el hash (#vista?s=<código>), comprimida con
 *   deflate y en base64url. Nada pasa por el servidor. Al abrir el enlace se rellena el
 *   formulario y se calcula. Las herramientas (#sueldo-neto, #plan-pensiones…) guardan los
 *   valores de su formulario; la calculadora, el comparador y los escenarios, el hogar.
 * - Deslizador (#comparar): de 15.000 a 150.000 € brutos, recalcula los 19 territorios en vivo
 *   (ranking animado y gráfico de la cuota o el tipo medio frente al sueldo).
 * - Escenarios (#escenarios): la situación actual y variantes («me suben el sueldo», «tengo un
 *   hijo», «aporto al plan»…), todas liquidadas con irpfsim.liquidar.
 *
 * Usa window.MapafiscalApp (app.js): P(), formulario(), recalcular(), restaurar(), irA().
 * Los cálculos y el códec se exportan para Node (test/escenarios.test.mjs).
 * ========================================================================== */
(function () {
  "use strict";
  const NAVEGADOR = typeof window !== "undefined" && typeof document !== "undefined";
  const H = (NAVEGADOR && window.irpfsim) || (typeof require === "function" ? require("./irpfsim.js") : null);
  const F = (NAVEGADOR && window.formularioIrpf) || (typeof require === "function" ? require("./formulario.js") : null);
  const ESQ = (NAVEGADOR && window.MapafiscalEsquema) || (typeof require === "function" ? require("./esquema.js") : null);

  if (NAVEGADOR) {
    window.MAPAFISCAL_HERRAMIENTAS = Object.assign(window.MAPAFISCAL_HERRAMIENTAS || {}, {
      escenarios: { titulo: "¿Y si…? Compara tus escenarios", icono: "escenarios", href: "#escenarios",
        texto: "Una subida, un hijo, una aportación al plan de pensiones, mudarte o alquilar: cuánto cambia tu IRPF y lo que te queda." }
    });
    document.dispatchEvent(new CustomEvent("mapafiscal:herramientas"));
  }

  // ---- códec del enlace -----------------------------------------------------------------
  // Formato: «1» + base64url(deflate-raw(JSON)) o, sin CompressionStream, «0» + base64url(JSON).
  const aB64 = bytes => {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const deB64 = txt => {
    const s = atob(txt.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((txt.length + 3) % 4));
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  };
  const conFlujo = (bytes, flujo) => new Response(new Blob([bytes]).stream().pipeThrough(flujo)).arrayBuffer().then(b => new Uint8Array(b));
  const hayCompresion = () => typeof CompressionStream === "function" && typeof DecompressionStream === "function";

  async function codificar(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (hayCompresion()) {
      try { return "1" + aB64(await conFlujo(bytes, new CompressionStream("deflate-raw"))); } catch (e) { /* sin compresión */ }
    }
    return "0" + aB64(bytes);
  }
  async function decodificar(codigo) {
    try {
      if (!/^[01][A-Za-z0-9_-]+$/.test(codigo || "")) return null;
      let bytes = deB64(codigo.slice(1));
      if (codigo[0] === "1") {
        if (!hayCompresion()) return null;
        bytes = await conFlujo(bytes, new DecompressionStream("deflate-raw"));
      }
      const obj = JSON.parse(new TextDecoder().decode(bytes));
      return obj && typeof obj === "object" ? obj : null;
    } catch (e) { return null; }
  }

  // ---- hogar compacto -----------------------------------------------------------------
  // Se quita lo que el formulario rehace solo (ceros, «no», campos derivados) y las
  // cotizaciones cuando son las estimadas: así siguen al sueldo al abrir el enlace.
  const CONSERVAR = new Set(["rol", "edad", "convivenciaMeses"]);
  const DERIVADOS = new Set(["id", "ejercicio", "tipoUnidadFamiliar", "nacidoEnEjercicio"]);
  function podar(x) {
    if (Array.isArray(x)) return x.map(podar);
    if (!x || typeof x !== "object") return x;
    const o = {};
    for (const [k, v] of Object.entries(x)) {
      if (DERIVADOS.has(k)) continue;
      if (!CONSERVAR.has(k)) {
        if (v == null || v === false || v === 0 || v === "" || v === "no") continue;
        if (Array.isArray(v) && !v.length) continue;
      }
      const p = podar(v);
      if (p && typeof p === "object" && !Array.isArray(p) && !Object.keys(p).length && !CONSERVAR.has(k)) continue;
      o[k] = p;
    }
    return o;
  }
  const ssAuto = (t, P) => t.pensionJubilacion ? 0 : Math.round(H.cotizacionesTrabajador(+t.dinerarias || 0, P));
  // hogar -> { h, a }: a = declarantes con las cotizaciones estimadas
  function podarHogar(hogar, P) {
    const h = JSON.parse(JSON.stringify(hogar)), a = [];
    for (const m of h.miembros || []) {
      if ((m.rol === "declarante" || m.rol === "conyuge") && m.trabajo && Math.abs((+m.trabajo.cotizacionesSs || 0) - ssAuto(m.trabajo, P)) < 0.005) {
        delete m.trabajo.cotizacionesSs;
        a.push(m.rol === "declarante" ? "d1" : "d2");
      }
    }
    return { h: podar(h), a };
  }
  const contexto = P => ({ ejercicio: P.ejercicio, cotizar: s => H.cotizacionesTrabajador(s, P) });
  function estadoDesdeCompartido(h, a) {
    const e = F.estadoDesdeHogar(h || {});
    for (const id of a || []) if (e.personas[id]) e.personas[id].ssManual = false;
    return e;
  }
  const hogarDesdeEstado = (e, P) => F.hogarDesdeEstado(e, contexto(P));
  const hogarDesdeCompartido = (h, a, P) => hogarDesdeEstado(estadoDesdeCompartido(h, a), P);
  const clonar = x => JSON.parse(JSON.stringify(x));

  // ---- versión del formato ---------------------------------------------------------------
  // `schema_version` es la versión del formato del payload (no el ejercicio, que va en `e`).
  // Los enlaces anteriores no la llevan (versión 0) y se abren igual. El hogar (`h`) pasa por
  // migrarHogar (esquema.js): un importe en texto se convierte con aviso o se rechaza.
  // payload decodificado -> { ok, payload, avisos } | { ok: false, error }
  function leerCompartido(p) {
    if (!p || typeof p !== "object") return { ok: false, error: "El enlace no contiene datos válidos." };
    const avisos = [];
    const v = p.schema_version == null ? 0 : p.schema_version;
    if (!Number.isInteger(v) || v < 0) return { ok: false, error: `La versión del enlace («${p.schema_version}») no es válida.` };
    if (v > ESQ.VERSION) avisos.push(`Este enlace usa un formato más nuevo (versión ${v}) que el de esta página (versión ${ESQ.VERSION}): se abre con lo que se reconoce.`);
    const q = Object.assign({}, p, { schema_version: ESQ.VERSION });
    if (p.h != null) {
      // el hogar compartido hereda la versión del payload
      const m = ESQ.migrarHogar(Object.assign({}, p.h, { schema_version: Math.min(v, ESQ.VERSION) }));
      if (!m.ok) return { ok: false, error: m.error };
      q.h = ESQ.sinVersion(m.hogar);
      avisos.push(...m.avisos);
    }
    if (p.f != null && (typeof p.f !== "object" || Array.isArray(p.f))) return { ok: false, error: "Los campos del enlace no son válidos." };
    return { ok: true, payload: q, avisos };
  }

  // ---- escenarios -----------------------------------------------------------------------
  const TIPOS = {
    sueldo: { op: "Me suben (o bajan) el sueldo", campo: "Nuevo sueldo bruto anual", euros: true },
    hijo: { op: "Tengo un hijo", campo: "Edad del hijo o hija (0 si nace este año)", euros: false },
    plan: { op: "Aporto al plan de pensiones", campo: "Aportación anual", euros: true, def: 1500 },
    territorio: { op: "Me cambio de territorio", campo: "Nuevo territorio de residencia", terr: true },
    alquiler: { op: "Alquilo mi vivienda", campo: "Alquiler que pagas al año", euros: true, def: 9000 },
    compra: { op: "Compro vivienda", campo: "Pagos del año por la compra (hipoteca)", euros: true, def: 7200 },
    cuenta: { op: "Ahorro en una cuenta vivienda (forales)", campo: "Aportación anual a la cuenta", euros: true, def: 3000 }
  };
  function aplicar(estado, esc) {
    const e = clonar(estado), d1 = e.personas.d1, v = esc.v;
    const imp = Math.max(0, +v || 0);
    switch (esc.t) {
      case "sueldo": d1.salario = imp; d1.ssManual = false; break;
      case "hijo": e.hijos.push({ edad: Math.max(0, Math.min(40, Math.round(+v || 0))), discapacidad: "no", compartida: false, rentas: 0, gastos: {} }); break;
      case "plan": d1.planIndividual = imp; break;
      case "territorio": e.territorio = String(v); break;
      case "alquiler": d1.alquiler = imp; if (e.gastos) delete e.gastos.alquiler_vivienda_pagos; break;
      case "compra": d1.compra = imp; break;
      case "cuenta": d1.cuentaVivienda = imp; break;
      default: break;
    }
    return e;
  }
  const declarantes = h => h.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge");
  function resultado(P, estado) {
    const hogar = hogarDesdeEstado(estado, P);
    const liq = H.liquidar(hogar, P, "auto");
    const irpf = H.irpfAnual(liq);
    const bruto = F.ingresosBrutos(hogar);
    const cot = Math.round(declarantes(hogar).reduce((s, m) => s + (m.trabajo ? +m.trabajo.cotizacionesSs || 0 : 0), 0) * 100) / 100;
    return { hogar, liq, territorio: hogar.territorio, irpf, tipo: liq.tipoMedioEfectivo, bruto, cot,
      disponible: Math.round((bruto - cot - irpf) * 100) / 100 };
  }
  // situación actual, cada escenario y, con dos o más, todos a la vez
  function calcularEscenarios(P, estado, lista) {
    const base = resultado(P, estado);
    const filas = [{ clave: "actual", esc: null, r: base }];
    (lista || []).forEach((esc, i) => {
      if (!TIPOS[esc.t] || (esc.t === "territorio" && !P.territorios[esc.v])) return;
      filas.push({ clave: "e" + i, esc, r: resultado(P, aplicar(estado, esc)) });
    });
    if (filas.length > 2) {
      const todos = (lista || []).filter(x => TIPOS[x.t] && (x.t !== "territorio" || P.territorios[x.v])).reduce(aplicar, estado);
      filas.push({ clave: "todos", esc: null, todos: true, r: resultado(P, todos) });
    }
    for (const f of filas) {
      f.dIrpf = Math.round((f.r.irpf - base.irpf) * 100) / 100;
      f.dDisponible = Math.round((f.r.disponible - base.disponible) * 100) / 100;
    }
    return filas;
  }

  // ---- deslizador: hogar con otro sueldo y curvas -------------------------------------
  const hogarTipo = (P, territorio, sueldo) => ({ territorio, ejercicio: P.ejercicio, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no",
    miembros: [{ id: "d1", rol: "declarante", edad: 40, discapacidad: "no",
      trabajo: sueldo > 0 ? { dinerarias: sueldo, cotizacionesSs: Math.round(H.cotizacionesTrabajador(sueldo, P)) } : null }] });
  function hogarConSueldo(P, estado, sueldo) {
    if (!estado) return hogarTipo(P, "ES-MD", sueldo);
    return hogarDesdeEstado(aplicar(estado, { t: "sueldo", v: sueldo }), P);
  }
  // { territorio: valor } para un sueldo; métrica "cuota" o "tipo"
  function porTerritorio(P, hogar) {
    const o = {};
    for (const c of H.compararTerritorios(hogar, P)) o[c.territorio] = { cuota: c.cuotaResultanteAutoliquidacion, tipo: c.tipoMedioEfectivo };
    return o;
  }
  const SUELDO_MIN = 15000, SUELDO_MAX = 150000;
  const PUNTOS = (() => { const l = []; for (let s = SUELDO_MIN; s <= SUELDO_MAX; s += 5000) l.push(s); return l; })();

  const CALCULOS = { codificar, decodificar, leerCompartido, podar, podarHogar, estadoDesdeCompartido, hogarDesdeCompartido, aplicar,
    resultado, calcularEscenarios, hogarTipo, hogarConSueldo, porTerritorio, TIPOS, PUNTOS, SUELDO_MIN, SUELDO_MAX };
  if (typeof module !== "undefined" && module.exports) { module.exports = CALCULOS; return; }
  window.MapafiscalEscenarios = CALCULOS;
  if (!H || !F) return;

  // =====================================================================================
  // Navegador
  // =====================================================================================
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur0 = n => (n < -0.5 ? "−" : "") + miles(Math.abs(Math.round(n || 0)).toString()) + " €";
  const conSigno = n => Math.abs(n) < 0.5 ? "igual" : (n < 0 ? "−" : "+") + miles(Math.abs(Math.round(n)).toString()) + " €";
  const pct = (n, d = 2) => (100 * (n || 0)).toFixed(d).replace(".", ",") + " %";
  const ORDEN = ["ES-AN", "ES-AR", "ES-AS", "ES-IB", "ES-CN", "ES-CB", "ES-CL", "ES-CM", "ES-CT", "ES-EX", "ES-GA",
    "ES-MD", "ES-MC", "ES-RI", "ES-VC", "ES-PV-VI", "ES-PV-BI", "ES-PV-SS", "ES-NC"];
  const CORTO = { "ES-AN": "Andalucía", "ES-AR": "Aragón", "ES-AS": "Asturias", "ES-IB": "Illes Balears", "ES-CN": "Canarias",
    "ES-CB": "Cantabria", "ES-CL": "Castilla y León", "ES-CM": "Castilla-La Mancha", "ES-CT": "Cataluña", "ES-EX": "Extremadura",
    "ES-GA": "Galicia", "ES-MD": "Madrid", "ES-MC": "Murcia", "ES-RI": "La Rioja", "ES-VC": "C. Valenciana",
    "ES-PV-VI": "Araba/Álava", "ES-PV-BI": "Bizkaia", "ES-PV-SS": "Gipuzkoa", "ES-NC": "Navarra" };
  const App = () => window.MapafiscalApp || null;
  const P = () => App() && App().P();
  const corto = t => CORTO[t] || (P() && P().territorios[t] ? P().territorios[t].nombre : t);
  const movimientoReducido = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const vistaVisible = v => $("v-" + v) && !$("v-" + v).hidden;
  const estadoCalc = () => { const a = App(); return a && a.formulario ? clonar(a.formulario().estado) : null; };
  // ¿ha metido la persona algo en la calculadora (o en la portada)?
  function haySituacionPropia() {
    const e = estadoCalc();
    if (!e) return false;
    const limpio = x => { const y = clonar(x); delete y.territorio; delete y.ver; delete y.municipio; if (y.pareja !== "si") delete y.personas.d2; return JSON.stringify(y); };
    return limpio(e) !== limpio(F.estadoInicial());
  }

  // ---- compartir ------------------------------------------------------------------------
  const ICONO_ENLACE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.1-2.1a3 3 0 0 0-4.2-4.2l-.9.9"/><path d="M9.5 6.5a3 3 0 0 0-4.2 0L3.2 8.6a3 3 0 0 0 4.2 4.2l.9-.9"/></svg>';
  // payload de cada vista
  const VISTAS_HOGAR = ["calculadora", "comparar"];
  function payloadHogar() {
    const a = App(), u = a && a.ultimo();
    if (!u) return null;
    const { h, a: auto } = podarHogar(u.hogar, a.P());
    return { v: 1, schema_version: ESQ.VERSION, e: a.P().ejercicio, h, a: auto };
  }
  // herramientas: valores de los campos de su formulario (y de los selectores de su cabecera)
  function camposVista(v) {
    const raiz = $("v-" + v);
    return raiz ? [...raiz.querySelectorAll("input, select")].filter(el => !el.closest(".compartir") && !el.closest("[data-selector-ejercicio]") &&
      (el.id || (el.type === "radio" && el.name)) && el.type !== "button" && el.type !== "submit" && el.type !== "search") : [];
  }
  function payloadHerramienta(v) {
    const f = {};
    for (const el of camposVista(v)) {
      if (el.type === "radio") { if (el.checked) f["@" + el.name] = el.value; }
      else if (el.type === "checkbox") f[el.id] = el.checked ? 1 : 0;
      else f[el.id] = el.value;
    }
    return { v: 1, schema_version: ESQ.VERSION, f };
  }
  const payloads = {};        // vista -> función (escenarios la registra más abajo)
  function payloadDe(v) {
    if (payloads[v]) return payloads[v]();
    if (VISTAS_HOGAR.includes(v)) return payloadHogar();
    return payloadHerramienta(v);
  }
  async function enlaceDe(v) {
    const p = payloadDe(v);
    if (!p) return null;
    const base = location.href.split("#")[0];
    return base + "#" + v + "?s=" + await codificar(p);
  }
  function barraCompartir(v) {
    const d = document.createElement("div");
    d.className = "compartir";
    d.dataset.vista = v;
    d.innerHTML = botonCompartir(v) + `<span class="compartir-msg" id="compartir-msg-${esc(v)}" role="status"></span>`;
    return d;
  }
  const botonCompartir = v => `<button class="btn btn-sec" type="button" data-compartir="${esc(v)}">${ICONO_ENLACE}<span>Copiar enlace</span></button>`;
  async function compartir(boton) {
    const v = boton.dataset.compartir, msg = $("compartir-msg-" + v);
    const decir = t => { msg.textContent = t; clearTimeout(msg._t); msg._t = setTimeout(() => { msg.textContent = ""; }, 4000); };
    let url;
    try { url = await enlaceDe(v); } catch (e) { url = null; }
    if (!url) { decir("Calcula primero un resultado."); return; }
    const movil = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (movil && navigator.share) {
      try { await navigator.share({ title: document.title, text: "Mi simulación del IRPF en Mapafiscal", url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); decir("Enlace copiado. Quien lo abra verá esta misma simulación; no se guarda nada en ningún servidor."); return; }
    catch (e) { /* sin portapapeles: se muestra el enlace */ }
    msg.innerHTML = `<label class="compartir-manual">Copia este enlace <input type="text" readonly value="${esc(url)}"></label>`;
    const inp = msg.querySelector("input"); inp.focus(); inp.select();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("button[data-compartir]");
    if (b) { e.preventDefault(); compartir(b); }
  });
  // botones: calculadora (en sus acciones), comparador, herramientas y escenarios (tras su resultado)
  function ponerBotones() {
    const acc = document.querySelector("#tarjeta-resultado .acciones-res");
    if (acc && !acc.querySelector("[data-compartir]")) {
      acc.insertAdjacentHTML("beforeend", botonCompartir("calculadora"));
      acc.insertAdjacentHTML("afterend", '<p class="compartir-msg compartir-msg-calc" id="compartir-msg-calculadora" role="status"></p>');
    }
    const rk = document.querySelector("#v-comparar .comparar");
    if (rk && !document.querySelector('.compartir[data-vista="comparar"]')) rk.parentElement.insertBefore(barraCompartir("comparar"), rk.nextSibling);
    for (const s of document.querySelectorAll("main section.vista[id^='v-']")) {
      const v = s.id.slice(2);
      if (VISTAS_HOGAR.includes(v) || s.querySelector(".compartir")) continue;
      const t = s.querySelector(".tarjeta-resultado");
      if (t && s.querySelector("form")) t.parentElement.insertBefore(barraCompartir(v), t.nextSibling);
    }
  }

  // ---- abrir un enlace -------------------------------------------------------------------
  const espera = ms => new Promise(r => setTimeout(r, ms));
  async function hasta(cond, ms) {
    const t0 = Date.now();
    while (!cond()) { if (Date.now() - t0 > ms) return false; await espera(50); }
    return true;
  }
  const disparar = el => { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
  async function aplicarHerramienta(v, f) {
    const listo = () => camposVista(v).filter(el => el.tagName === "SELECT" && f[el.id] != null).every(el => [...el.options].some(o => o.value === String(f[el.id])));
    await hasta(listo, 6000);
    for (let pasada = 0; pasada < 2; pasada++) {
      for (const el of camposVista(v)) {
        if (el.type === "radio") {
          const val = f["@" + el.name];
          if (val != null && el.value === String(val) && !el.checked) { el.checked = true; disparar(el); }
        } else if (el.type === "checkbox") {
          if (f[el.id] != null && el.checked !== !!+f[el.id]) { el.checked = !!+f[el.id]; disparar(el); }
        } else if (f[el.id] != null && el.value !== String(f[el.id])) {
          el.value = String(f[el.id]); disparar(el);
        }
      }
    }
  }
  async function aplicarHogar(p) {
    const a = App();
    if (!p || !p.h || !a) return false;
    await a.restaurar(p.h, +p.e || null);
    if (p.a && p.a.length && a.formulario) {
      const f = a.formulario();
      for (const id of p.a) if (f.estado.personas[id]) f.estado.personas[id].ssManual = false;
      f.pintar();
      a.recalcular();
    }
    return true;
  }
  // aviso no bloqueante al abrir un enlace (formato nuevo, importe convertido o rechazado)
  function avisoEnlace(texto, error) {
    if (typeof console !== "undefined") (error ? console.error : console.warn)("[enlace] " + texto);
    let d = document.getElementById("aviso-enlace");
    if (!d) {
      d = document.createElement("div");
      d.id = "aviso-enlace"; d.setAttribute("role", "status");
      d.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:50;max-width:40rem;margin:0 auto;padding:.75rem 1rem;border-radius:8px;background:#fff8e1;color:#4a3b00;border:1px solid #e0c060;box-shadow:0 2px 8px rgba(0,0,0,.15)";
      d.addEventListener("click", () => d.remove());
      document.body.appendChild(d);
    }
    d.textContent = texto;
    if (error) d.style.background = "#fdecea";
  }
  async function abrirEnlace() {
    const m = location.hash.match(/^#([\w-]+)\?(?:[^#]*&)?s=([A-Za-z0-9_-]+)/);
    if (!m) return;
    const v = m[1], crudo = await decodificar(m[2]);
    try { history.replaceState(null, "", "#" + v); } catch (e) { /* sin historial */ }
    if (!crudo) return;
    const leido = leerCompartido(crudo);
    if (!leido.ok) { avisoEnlace("No se ha podido abrir el enlace compartido: " + leido.error, true); return; }
    if (leido.avisos.length) avisoEnlace(leido.avisos.join(" "), false);
    const p = leido.payload;
    if (p.f) await aplicarHerramienta(v, p.f);
    else if (p.h) {
      await aplicarHogar(p);
      if (v === "escenarios") cargarEscenarios(p.x || []);
      D.quien = null; D.curvas = {};
    }
    if (vistaVisible("comparar")) pintarDeslizador();
    if (vistaVisible("escenarios")) pintarEscenarios();
  }

  // =====================================================================================
  // Deslizador de sueldo (#comparar)
  // =====================================================================================
  const D = { quien: null, sueldo: 30000, curvas: {}, trabajo: 0, ultimo: null };
  const metrica = () => { const r = document.querySelector('input[name="metrica"]:checked'); return r && r.value === "tipo" ? "tipo" : "cuota"; };
  function territorioUsuario() { const a = App(), u = a && a.ultimo(); return u ? u.hogar.territorio : "ES-MD"; }
  function estadoDeslizador() {
    if (D.quien !== "tuya") return null;
    return estadoCalc();
  }
  function hogarDeslizador(sueldo) {
    const e = estadoDeslizador();
    return e ? hogarConSueldo(P(), e, sueldo) : hogarTipo(P(), territorioUsuario(), sueldo);
  }
  const claveCurva = () => P().ejercicio + "|" + D.quien + "|" + (D.quien === "tuya" ? JSON.stringify(estadoDeslizador()) : "");

  function montarDeslizador() {
    const raiz = $("desl");
    if (!raiz || raiz.dataset.listo) return;
    raiz.dataset.listo = "1";
    const r = $("desl-sueldo");
    r.min = SUELDO_MIN; r.max = SUELDO_MAX;
    let t = 0, tf = 0;
    r.addEventListener("input", () => {
      D.sueldo = +r.value;
      pintarValor();
      clearTimeout(t); t = setTimeout(() => pintarRanking(false), 30);
      clearTimeout(tf); tf = setTimeout(pintarFrase, 450);
    });
    document.querySelectorAll('input[name="desl-quien"]').forEach(x => x.addEventListener("change", () => {
      D.quien = x.value;
      if (D.quien === "tuya") { const e = estadoCalc(); if (e) D.sueldo = Math.max(SUELDO_MIN, Math.min(SUELDO_MAX, Math.round((+e.personas.d1.salario || 0) / 500) * 500)); }
      pintarDeslizador();
    }));
    document.querySelectorAll('input[name="metrica"]').forEach(x => x.addEventListener("change", () => { if (vistaVisible("comparar")) pintarDeslizador(); }));
    $("desl-ranking").addEventListener("mouseover", e => { const li = e.target.closest("li[data-t]"); enfocarLinea(li && li.dataset.t); });
    $("desl-ranking").addEventListener("mouseleave", () => enfocarLinea(null));
  }
  function enfocarLinea(t) {
    document.querySelectorAll("#desl-svg .desl-linea.foco").forEach(x => x.classList.remove("foco"));
    if (t) { const p = document.querySelector(`#desl-svg .desl-linea[data-t="${t}"]`); if (p) { p.classList.add("foco"); p.parentNode.appendChild(p); } }
  }
  function pintarValor() {
    const r = $("desl-sueldo");
    r.value = D.sueldo;
    const txt = eur0(D.sueldo);
    $("desl-valor").textContent = txt;
    r.setAttribute("aria-valuetext", txt.replace("€", "euros") + " brutos al año");
    r.style.setProperty("--avance", ((D.sueldo - SUELDO_MIN) / (SUELDO_MAX - SUELDO_MIN) * 100).toFixed(2) + "%");
  }
  function pintarDeslizador() {
    if (!$("desl") || !P()) return;
    montarDeslizador();
    if (D.quien == null) {
      D.quien = haySituacionPropia() ? "tuya" : "tipo";
      const e = estadoCalc();
      if (D.quien === "tuya" && e) D.sueldo = Math.max(SUELDO_MIN, Math.min(SUELDO_MAX, Math.round((+e.personas.d1.salario || 0) / 500) * 500));
    }
    document.querySelectorAll('input[name="desl-quien"]').forEach(x => { x.checked = x.value === D.quien; });
    const e = estadoCalc();
    $("desl-nota").textContent = D.quien === "tuya"
      ? `Con tu situación de la calculadora${e && e.pareja === "si" ? " (solo cambia tu sueldo; el de tu cónyuge se mantiene)" : ""}, en los 19 territorios. Ejercicio ${P().ejercicio}.`
      : `Persona sola de 40 años, sin hijos, con las cotizaciones del trabajador del ejercicio ${P().ejercicio}.`;
    pintarValor();
    pintarRanking(true);
    pintarFrase();
    pintarCurvas();
  }
  function pintarRanking(inicial) {
    const terr = territorioUsuario(), m = metrica();
    let datos;
    try { datos = porTerritorio(P(), hogarDeslizador(D.sueldo)); } catch (e) { return; }
    D.ultimo = datos;
    const ol = $("desl-ranking");
    const lista = ORDEN.filter(t => datos[t]).sort((a, b) => datos[a][m] - datos[b][m]);
    const vmin = datos[lista[0]][m], rango = (datos[lista[lista.length - 1]][m] - vmin) || 1;
    // FLIP: se recuerda dónde estaba cada fila, se reordena el DOM y se anima desde allí
    const antes = new Map();
    for (const li of ol.children) antes.set(li.dataset.t, li.getBoundingClientRect().top);
    const porT = new Map([...ol.children].map(li => [li.dataset.t, li]));
    lista.forEach((t, i) => {
      let li = porT.get(t);
      if (!li) {
        li = document.createElement("li");
        li.dataset.t = t;
        li.innerHTML = `<span class="desl-pos"></span><span class="desl-nombre">${esc(corto(t))}${P().territorios[t].regimen !== "comun" ? '<span class="regimen">foral</span>' : ""}</span><span class="desl-barra" aria-hidden="true"><i></i></span><span class="desl-cifra"></span>`;
      }
      li.classList.toggle("tu", t === terr);
      const v = datos[t][m];
      const pos = 1 + lista.filter(x => datos[x][m] < v - (m === "cuota" ? 0.5 : 0.00005)).length;
      li.querySelector(".desl-pos").textContent = pos + ".º";
      li.querySelector(".desl-cifra").textContent = m === "cuota" ? eur0(v) : pct(v);
      // la barra arranca en el más barato: así se ven las diferencias entre territorios
      li.querySelector(".desl-barra i").style.width = (8 + 92 * (v - vmin) / rango).toFixed(1) + "%";
      ol.appendChild(li);
    });
    if (!inicial && !movimientoReducido()) {
      for (const li of ol.children) {
        const y0 = antes.get(li.dataset.t);
        if (y0 == null) continue;
        const dy = y0 - li.getBoundingClientRect().top;
        if (Math.abs(dy) < 1) continue;
        li.style.transition = "none";
        li.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => { li.style.transition = ""; li.style.transform = ""; });
      }
    }
    pintarMarca();
  }
  function pintarFrase() {
    const d = D.ultimo, terr = territorioUsuario();
    if (!d || !d[terr]) return;
    const lista = ORDEN.filter(t => d[t]).sort((a, b) => d[a].cuota - d[b].cuota);
    const yo = d[terr].cuota, barato = lista[0], caro = lista[lista.length - 1];
    const pos = 1 + lista.filter(t => d[t].cuota < yo - 0.5).length;
    $("desl-frase").innerHTML = d[caro].cuota < 0.5 ? `Con <b>${eur0(D.sueldo)}</b> brutos no se paga IRPF en ningún territorio.`
      : `Con <b>${eur0(D.sueldo)}</b> brutos, en <b>${esc(corto(terr))}</b> pagarías <b>${eur0(yo)}</b> (tipo medio ${pct(d[terr].tipo)}), el ${pos}.º más barato de 19. ` +
        (pos === 1 ? `En ${esc(corto(caro))}, ${eur0(d[caro].cuota - yo)} más.` : `En ${esc(corto(barato))}, ${eur0(yo - d[barato].cuota)} menos; en ${esc(corto(caro))}, ${eur0(Math.max(0, d[caro].cuota - yo))} más.`);
  }
  // curvas de los 19 territorios: se calculan por tandas para no bloquear la página
  function pintarCurvas() {
    const clave = claveCurva();
    const c = D.curvas[clave];
    if (c && c.listo) { dibujar(c.puntos); return; }
    if (c) return;      // en marcha
    const cur = D.curvas[clave] = { puntos: [], listo: false };
    const trabajo = ++D.trabajo;
    let i = 0;
    const paso = () => {
      if (trabajo !== D.trabajo) { delete D.curvas[clave]; return; }
      const fin = Math.min(PUNTOS.length, i + 4);
      for (; i < fin; i++) {
        try { cur.puntos.push({ s: PUNTOS[i], d: porTerritorio(P(), hogarDeslizador(PUNTOS[i])) }); } catch (e) { /* punto sin cálculo */ }
      }
      if (i < PUNTOS.length) setTimeout(paso, 0);
      else { cur.listo = true; if (vistaVisible("comparar")) dibujar(cur.puntos); }
    };
    paso();
  }
  const G = { W: 480, H: 300, l: 54, r: 12, t: 12, b: 28 };
  const gx = s => G.l + (s - SUELDO_MIN) / (SUELDO_MAX - SUELDO_MIN) * (G.W - G.l - G.r);
  let gy = () => 0;
  function redondoArriba(v) {
    if (v <= 0) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v))), k = v / e;
    return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 2.5 ? 2.5 : k <= 5 ? 5 : 10) * e;
  }
  function dibujar(puntos) {
    const svg = $("desl-svg");
    if (!svg || !puntos.length) return;
    const m = metrica(), terr = territorioUsuario();
    const ymax = redondoArriba(Math.max(...puntos.flatMap(p => Object.values(p.d).map(x => x[m]))));
    gy = v => G.t + (1 - v / ymax) * (G.H - G.t - G.b);
    const fmtY = v => m === "cuota" ? (v >= 1000 ? miles(String(Math.round(v / 1000))) + " mil €" : eur0(v)) : (100 * v).toFixed(0) + " %";
    let h = `<title id="desl-svg-tit">${m === "cuota" ? "Cuota del IRPF" : "Tipo medio efectivo"} frente al sueldo bruto en los 19 territorios; ${esc(corto(terr))} resaltado</title>`;
    for (let k = 0; k <= 4; k++) {
      const v = ymax * k / 4, y = gy(v).toFixed(1);
      h += `<line class="desl-reticula" x1="${G.l}" x2="${G.W - G.r}" y1="${y}" y2="${y}"/><text class="desl-eje" x="${G.l - 8}" y="${(+y + 4).toFixed(1)}" text-anchor="end">${fmtY(v)}</text>`;
    }
    for (const s of [15000, 50000, 100000, 150000]) h += `<text class="desl-eje" x="${gx(s).toFixed(1)}" y="${G.H - 8}" text-anchor="middle">${miles(String(s / 1000))} mil €</text>`;
    const linea = t => "M" + puntos.filter(p => p.d[t]).map(p => gx(p.s).toFixed(1) + "," + gy(p.d[t][m]).toFixed(1)).join("L");
    const otros = ORDEN.filter(t => t !== terr && puntos[0].d[t]);
    h += otros.map(t => `<path class="desl-linea" data-t="${t}" d="${linea(t)}"><title>${esc(corto(t))}</title></path>`).join("");
    if (puntos[0].d[terr]) h += `<path class="desl-linea tu" data-t="${terr}" d="${linea(terr)}"><title>${esc(corto(terr))} (tu territorio)</title></path>`;
    h += `<g id="desl-marca"></g>`;
    svg.setAttribute("viewBox", `0 0 ${G.W} ${G.H}`);
    svg.innerHTML = h;
    $("desl-leyenda").innerHTML = `<span><i class="tu"></i>${esc(corto(terr))}</span><span><i></i>Los otros 18 territorios</span>`;
    pintarMarca();
  }
  function pintarMarca() {
    const g = $("desl-marca"), d = D.ultimo, terr = territorioUsuario();
    if (!g || !d || !d[terr]) return;
    const x = gx(D.sueldo).toFixed(1), y = gy(d[terr][metrica()]).toFixed(1);
    g.innerHTML = `<line class="desl-cursor" x1="${x}" x2="${x}" y1="${G.t}" y2="${G.H - G.b}"/><circle class="desl-punto" cx="${x}" cy="${y}" r="5.5"/>`;
  }

  // =====================================================================================
  // Comparador de escenarios (#escenarios)
  // =====================================================================================
  const E = { lista: [], base: null, montado: false };
  const MAX_ESCENARIOS = 8;
  function describir(x) {
    const v = x.v;
    switch (x.t) {
      case "sueldo": return `Sueldo de ${eur0(v)}`;
      case "hijo": return `Un hijo más (${Math.round(+v || 0)} ${+v === 1 ? "año" : "años"})`;
      case "plan": return `Aportas ${eur0(v)} al plan de pensiones`;
      case "territorio": return `Te mudas a ${corto(v)}`;
      case "alquiler": return `Pagas ${eur0(v)} de alquiler al año`;
      case "compra": return `Pagas ${eur0(v)} al año por la compra de tu vivienda`;
      case "cuenta": return `Aportas ${eur0(v)} a una cuenta vivienda`;
      default: return "";
    }
  }
  function estadoBase() {
    const modo = (document.querySelector('input[name="esc-base"]:checked') || {}).value || "calc";
    if (modo === "calc") return estadoCalc();
    const e = F.estadoInicial();
    e.territorio = $("esc-b-territorio").value || "ES-MD";
    e.personas.d1.salario = Math.max(0, window.MapafiscalImporte.valor($("esc-b-sueldo")));
    e.personas.d1.edad = Math.max(16, Math.min(110, +$("esc-b-edad").value || 35));
    return e;
  }
  function resumenBase(e) {
    const p = e.personas.d1, h = e.hijos.length;
    return `${eur0(p.salario)} de sueldo bruto en ${corto(e.territorio)}${e.pareja === "si" ? ", con cónyuge" : ""}${h ? `, ${h} ${h === 1 ? "hijo" : "hijos"}` : ", sin hijos"}.` +
      (e.pareja === "si" ? " Los escenarios cambian tus datos, no los de tu cónyuge." : "");
  }
  function opcionesTerritorio(sel, valor) {
    const T = P().territorios;
    sel.innerHTML = ORDEN.filter(t => T[t]).map(t => `<option value="${t}">${esc(T[t].nombre)}${T[t].regimen !== "comun" && !/foral/i.test(T[t].nombre) ? " (foral)" : ""}</option>`).join("");
    if (valor && T[valor]) sel.value = valor;
  }
  function montarEscenarios() {
    if (E.montado || !$("esc-form") || !P()) return;
    E.montado = true;
    $("esc-tipo").innerHTML = Object.entries(TIPOS).map(([k, x]) => `<option value="${k}">${esc(x.op)}</option>`).join("");
    opcionesTerritorio($("esc-terr"), "ES-PV-BI");
    opcionesTerritorio($("esc-b-territorio"), territorioUsuario());
    $("esc-tipo").addEventListener("change", pintarCampoValor);
    document.querySelectorAll('input[name="esc-base"]').forEach(r => r.addEventListener("change", () => { $("esc-basica").hidden = r.value !== "basica" || !r.checked; pintarEscenarios(); }));
    let t;
    $("esc-basica").addEventListener("input", () => { clearTimeout(t); t = setTimeout(pintarEscenarios, 120); });
    $("esc-basica").addEventListener("change", pintarEscenarios);
    $("esc-form").addEventListener("submit", e => {
      e.preventDefault();
      if (E.lista.length >= MAX_ESCENARIOS) { $("esc-msg").textContent = `Como mucho ${MAX_ESCENARIOS} escenarios: quita alguno para añadir otro.`; return; }
      const tipo = $("esc-tipo").value, def = TIPOS[tipo];
      const v = def.terr ? $("esc-terr").value : Math.max(0, window.MapafiscalImporte.valor($("esc-valor")));
      E.lista.push({ t: tipo, v });
      $("esc-msg").textContent = `Añadido: ${describir({ t: tipo, v })}.`;
      pintarEscenarios();
    });
    $("esc-lista").addEventListener("click", e => {
      const b = e.target.closest("button[data-quitar]");
      if (!b) return;
      const i = +b.dataset.quitar, quitado = E.lista.splice(i, 1)[0];
      $("esc-msg").textContent = quitado ? `Quitado: ${describir(quitado)}.` : "";
      pintarEscenarios();
      const sig = $("esc-lista").querySelector(`button[data-quitar="${Math.min(i, E.lista.length - 1)}"]`) || $("esc-tipo");
      sig.focus();
    });
    pintarCampoValor();
  }
  function pintarCampoValor() {
    const tipo = $("esc-tipo").value, def = TIPOS[tipo], e = estadoBase();
    $("esc-campo-valor").hidden = !!def.terr;
    $("esc-campo-terr").hidden = !def.terr;
    $("esc-valor-lbl").textContent = def.campo;
    $("esc-valor-suf").hidden = !def.euros;
    const inp = $("esc-valor");
    inp.step = def.euros ? 100 : 1;
    inp.max = def.euros ? "" : 40;
    inp.value = tipo === "sueldo" ? Math.round(((e ? +e.personas.d1.salario : 30000) || 30000) * 1.1 / 500) * 500 : tipo === "hijo" ? 0 : def.def || 0;
    $("esc-ayuda-valor").textContent = {
      plan: "Reducción de la base por aportaciones a planes de pensiones (con sus límites; en Navarra, según el motor).",
      alquiler: "Alquiler de tu vivienda habitual: cuenta en las comunidades y territorios forales que lo deducen, con sus requisitos de edad y renta.",
      compra: "Deducción por adquisición de vivienda habitual: existe en los territorios forales y en algunas comunidades; en el régimen común estatal solo para compras anteriores a 2013.",
      cuenta: "Cuenta vivienda: deducción del País Vasco y de Navarra.",
      hijo: "Cuenta su mínimo por descendiente y las deducciones por hijos de cada territorio."
    }[tipo] || "";
  }
  function pintarEscenarios() {
    if (!P() || !$("esc-form")) return;
    montarEscenarios();
    const modo = (document.querySelector('input[name="esc-base"]:checked') || {}).value || "calc";
    $("esc-basica").hidden = modo !== "basica";
    const e = estadoBase();
    if (!e) return;
    $("esc-base-resumen").textContent = (modo === "calc" ? "Tu situación de la calculadora: " : "Situación básica: ") + resumenBase(e);
    $("esc-lista").innerHTML = E.lista.length ? E.lista.map((x, i) => `<li><span>${esc(describir(x))}</span>
      <button class="btn btn-txt btn-sm" type="button" data-quitar="${i}" aria-label="Quitar el escenario: ${esc(describir(x))}">Quitar</button></li>`).join("")
      : `<li class="vacio">Aún no hay escenarios: elige un cambio y pulsa «Añadir escenario».</li>`;
    let filas;
    try { filas = calcularEscenarios(P(), e, E.lista); }
    catch (err) { $("esc-tabla").innerHTML = ""; $("esc-barras").innerHTML = '<p class="vacio">Revisa los datos de la situación actual.</p>'; return; }
    $("esc-chip").textContent = `${corto(e.territorio)} · ${P().ejercicio}`;
    const nombreFila = f => f.todos ? "Todo a la vez" : f.esc ? describir(f.esc) : "Situación actual";
    const cls = d => Math.abs(d) < 0.5 ? "" : d > 0 ? "gana" : "pierde";
    $("esc-tabla").innerHTML = `<thead><tr><th>Escenario</th><th class="num">IRPF</th><th class="num">Tipo medio</th><th class="num">Renta disponible</th><th class="num">Frente a hoy</th></tr></thead><tbody>` +
      filas.map(f => `<tr class="${f.clave === "actual" ? "tu" : ""}"><th scope="row">${esc(nombreFila(f))}</th>
        <td class="num">${eur0(f.r.irpf)}</td><td class="num">${pct(f.r.tipo)}</td><td class="num">${eur0(f.r.disponible)}</td>
        <td class="num dif ${cls(f.dDisponible)}">${f.clave === "actual" ? "—" : `${conSigno(f.dDisponible)}<small>IRPF ${conSigno(f.dIrpf)}</small>`}</td></tr>`).join("") + "</tbody>";
    const maxBruto = Math.max(...filas.map(f => f.r.bruto)) || 1;
    $("esc-barras").innerHTML = filas.map(f => {
      const b = f.r.bruto || 0, partes = [["neto", Math.max(0, f.r.disponible)], ["irpf", Math.max(0, f.r.irpf)], ["ss", f.r.cot]];
      const tot = partes.reduce((s, p) => s + p[1], 0) || 1;
      return `<div class="esc-barra${f.clave === "actual" ? " tu" : ""}"><div class="grafico-tit"><span>${esc(nombreFila(f))}</span><span>te quedan <b>${eur0(f.r.disponible)}</b>${f.clave === "actual" ? "" : ` <span class="dif ${cls(f.dDisponible)}">(${conSigno(f.dDisponible)})</span>`}</span></div>
        <div class="esc-pista" style="width:${Math.max(4, 100 * b / maxBruto).toFixed(1)}%"><div class="barra-reparto" role="img" aria-label="${esc(`${nombreFila(f)}: renta disponible ${eur0(f.r.disponible)}, IRPF ${eur0(f.r.irpf)}, Seguridad Social ${eur0(f.r.cot)}`)}">${partes.filter(p => p[1] > 0).map(p => `<i class="${p[0]}" style="flex-grow:${(p[1] / tot).toFixed(4)}"></i>`).join("")}</div></div></div>`;
    }).join("") + `<ul class="leyenda-reparto"><li><i style="background:var(--g-neto)"></i>Renta disponible</li><li><i style="background:var(--g-irpf)"></i>IRPF</li><li><i style="background:var(--g-ss)"></i>Seguridad Social</li></ul>`;
    const conTerr = E.lista.some(x => x.t === "territorio");
    $("esc-nota").textContent = "Renta disponible aproximada = ingresos brutos − cotizaciones del trabajador − IRPF del año. No resta el alquiler, la compra de la vivienda ni lo que aportes al plan de pensiones, que también salen de tu bolsillo." +
      (conTerr ? " Cambiar de residencia fiscal exige vivir allí más de 183 días al año y tener allí el centro de intereses." : "") +
      (E.lista.some(x => x.t === "hijo") ? " Un hijo más no cambia por sí solo el título de familia numerosa: indícalo en la calculadora si lo tienes." : "");
  }
  function cargarEscenarios(lista) {
    E.lista = (Array.isArray(lista) ? lista : []).filter(x => x && TIPOS[x.t]).slice(0, MAX_ESCENARIOS)
      .map(x => ({ t: x.t, v: x.t === "territorio" ? String(x.v) : Math.max(0, +x.v || 0) }));
    const r = document.querySelector('input[name="esc-base"][value="calc"]');
    if (r) r.checked = true;
    if (vistaVisible("escenarios")) pintarEscenarios();
  }
  payloads.escenarios = () => {
    const e = estadoBase();
    if (!e || !P()) return null;
    const { h, a } = podarHogar(hogarDesdeEstado(e, P()), P());
    return { v: 1, schema_version: ESQ.VERSION, e: P().ejercicio, h, a, x: E.lista };
  };

  // ---- arranque ----------------------------------------------------------------------
  document.addEventListener("mapafiscal:vista", e => {
    const v = e.detail && e.detail.vista;
    if (!App()) return;
    if (v === "comparar") pintarDeslizador();
    if (v === "escenarios") pintarEscenarios();
  });
  document.addEventListener("mapafiscal:ejercicio", () => {
    if (!App()) return;
    D.curvas = {};
    if ($("esc-terr") && E.montado) { const a = $("esc-terr").value, b = $("esc-b-territorio").value; opcionesTerritorio($("esc-terr"), a); opcionesTerritorio($("esc-b-territorio"), b); }
    if (vistaVisible("comparar")) pintarDeslizador();
    if (vistaVisible("escenarios")) pintarEscenarios();
  });
  function alArrancar() {
    ponerBotones();
    // tras el arranque de app.js (que pinta la vista del hash en el mismo turno)
    setTimeout(() => {
      abrirEnlace().catch(() => { /* enlace no válido: se queda la página tal cual */ });
      if (vistaVisible("comparar")) pintarDeslizador();
      if (vistaVisible("escenarios")) pintarEscenarios();
    }, 0);
  }
  if (window.MapafiscalApp) alArrancar();
  else document.addEventListener("mapafiscal:app", alArrancar, { once: true });
  window.addEventListener("hashchange", () => { if (/[?&]s=/.test(location.hash)) abrirEnlace().catch(() => {}); });
})();
