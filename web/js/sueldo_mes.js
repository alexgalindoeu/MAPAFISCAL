/* =============================================================================
 * Mapafiscal — sueldo al mes (vista #sueldo-mes)
 * «31.000 entre 14», «48.000 / 12», «en 12 pagas»: cuánto es al mes un bruto anual en 12,
 * 14 o 15 pagas, con las extras aparte o prorrateadas. No calcula ningún impuesto: el neto
 * anual sale de irpfsim.sueldoNeto (paridad con R/15_sueldo_neto.R) y aquí solo se reparte
 * entre las pagas. Se carga después de app.js, que muestra la vista y avisa con «mapafiscal:vista».
 * También pasa el bruto de precio por hora a mensual y a anual (horas semanales, 40 por defecto)
 * y calcula la jornada parcial: el bruto a jornada completa por el porcentaje de jornada es el
 * que se pasa al motor.
 * Enlace directo: #sueldo-mes?b=31000&p=14&t=ES-MD (y &e=<edad>, &pr=1 para prorrateadas,
 * &u=mes|hora para un importe mensual o por hora, &h=<horas semanales>, &j=<% de jornada>).
 * La página /sueldo-mensual/ (tools/seo_sueldo_mensual.mjs) usa estas mismas funciones.
 * ========================================================================== */
(function () {
  "use strict";
  const H = (typeof window !== "undefined" && window.irpfsim) || (typeof require === "function" ? require("./irpfsim.js") : null);
  const NAVEGADOR = typeof window !== "undefined" && typeof document !== "undefined";
  if (NAVEGADOR) window.MAPAFISCAL_HERRAMIENTAS = Object.assign(window.MAPAFISCAL_HERRAMIENTAS || {}, {
    "sueldo-mes": { titulo: "Sueldo al mes", icono: "nomina", href: "#sueldo-mes",
      texto: "Tu bruto anual entre 12, 14 o 15 pagas: cuánto cobras cada mes, en bruto y en neto, y en los meses con paga extra." }
  });
  if (NAVEGADOR) document.dispatchEvent(new CustomEvent("mapafiscal:herramientas"));
  if (!H || (NAVEGADOR && !document.getElementById("v-sueldo-mes"))) return;

  const ORDEN = ["ES-AN", "ES-AR", "ES-AS", "ES-IB", "ES-CN", "ES-CB", "ES-CL", "ES-CM", "ES-CT", "ES-EX", "ES-GA",
    "ES-MD", "ES-MC", "ES-RI", "ES-VC", "ES-PV-VI", "ES-PV-BI", "ES-PV-SS", "ES-NC"];
  const PAGAS = [12, 14, 15];
  const TOPE = 1e7;
  const EDAD = 40;          // la misma que el supuesto de las páginas de sueldo neto
  const HORAS = 40;         // horas semanales a jornada completa, por defecto
  const SEMANAS = 52;       // semanas del año para pasar de precio por hora a anual
  const UNIDADES = ["anio", "mes", "hora"];
  const red2 = n => Math.round((n + 1e-9) * 100) / 100;

  // ---- cálculos (también los usan test/sueldo_mes.test.mjs y la página /sueldo-mensual/) ---
  // o: { territorio, edad, hijos, tipoContrato }. El neto anual del motor, una sola vez.
  function anual(P, o, bruto) {
    const s = H.sueldoNeto(Object.assign({ edad: EDAD, hijos: [], tipoContrato: "indefinido" }, o, { bruto }), P);
    return { bruto: s.bruto, cotizaciones: s.cotizaciones, irpf: s.irpf, neto: s.neto };
  }
  // Reparto de un bruto y un neto anuales en `pagas` pagas iguales: 12 mensualidades y
  // pagas − 12 extras, que se cobran en otros tantos meses junto a la mensualidad. Con las
  // extras prorrateadas, las 12 nóminas son iguales (el año / 12). División simple: el neto
  // se reparte en la misma proporción que el bruto.
  function reparto(a, pagas, prorrateadas) {
    const p = PAGAS.includes(+pagas) ? +pagas : 12, extras = p - 12, pr = !!prorrateadas && extras > 0;
    const brutoPaga = a.bruto / p, netoPaga = a.neto / p;
    return {
      pagas: p, extras, prorrateadas: pr, brutoAnual: a.bruto, netoAnual: a.neto,
      brutoPaga: red2(brutoPaga), netoPaga: red2(netoPaga),
      // lo que se cobra en un mes sin paga extra
      brutoMes: red2(pr ? a.bruto / 12 : brutoPaga), netoMes: red2(pr ? a.neto / 12 : netoPaga),
      // lo que se cobra en un mes con paga extra (mensualidad + extra); null si no hay
      brutoMesExtra: extras && !pr ? red2(2 * brutoPaga) : null, netoMesExtra: extras && !pr ? red2(2 * netoPaga) : null
    };
  }
  const calcular = (P, o, bruto, pagas, prorrateadas) => { const a = anual(P, o, bruto); return { anual: a, ...reparto(a, pagas, prorrateadas) }; };
  // 12, 14 y 15 pagas con el mismo bruto anual: el neto anual no cambia, solo su reparto.
  function comparativa(P, o, bruto, prorrateadas) {
    const a = anual(P, o, bruto);
    return { anual: a, filas: PAGAS.map(p => reparto(a, p, prorrateadas)) };
  }
  // ---- precio por hora ↔ mensual ↔ anual, y jornada parcial (aritmética, sin impuestos) ----
  // Bruto anual a jornada completa de un importe: al año, al mes (por las pagas) o por hora
  // (horas semanales × 52 semanas).
  function brutoAnualDe(importe, unidad, { pagas = 12, horas = HORAS } = {}) {
    const v = Math.max(0, +importe || 0);
    return red2(unidad === "hora" ? v * horas * SEMANAS : unidad === "mes" ? v * (PAGAS.includes(+pagas) ? +pagas : 12) : v);
  }
  // Jornada parcial: el bruto a jornada completa por el porcentaje (1-100) de jornada.
  const jornadaParcial = (brutoCompleto, pct) => red2(brutoCompleto * Math.max(0, Math.min(100, pct == null ? 100 : +pct)) / 100);
  // El mismo bruto anual en las tres unidades; el precio por hora, con las horas de verdad
  // trabajadas (horas semanales × jornada).
  function equivalencias(brutoAnual, { pagas = 12, horas = HORAS, jornada = 100 } = {}) {
    const h = horas * Math.max(0, Math.min(100, jornada)) / 100;
    return { anual: red2(brutoAnual), mensual: red2(brutoAnual / (PAGAS.includes(+pagas) ? +pagas : 12)),
      hora: h > 0 ? red2(brutoAnual / (h * SEMANAS)) : null, horasSemana: red2(h) };
  }
  // ---- enlace directo -------------------------------------------------------------------
  function leerEnlace(hash) {
    const q = String(hash || "").split("?")[1] || "", r = {};
    for (const par of q.split("&")) {
      const [k, v = ""] = par.split("=").map(s => decodeURIComponent(s.replace(/\+/g, " ")));
      if (k === "b") { const n = Number(v.replace(",", ".")); if (Number.isFinite(n) && n >= 0) r.bruto = Math.min(TOPE / 2, n); }
      else if (k === "p" && PAGAS.includes(+v)) r.pagas = +v;
      else if (k === "t" && /^ES-[A-Z]{2}(-[A-Z]{2})?$/.test(v)) r.territorio = v;
      else if (k === "e" && /^\d{1,3}$/.test(v) && +v >= 16 && +v <= 110) r.edad = +v;
      else if (k === "pr") r.prorrateadas = v !== "0";
      else if (k === "u" && UNIDADES.includes(v)) r.unidad = v;
      else if (k === "h" && /^\d{1,2}(\.\d+)?$/.test(v) && +v > 0 && +v <= 80) r.horas = +v;
      else if (k === "j" && /^\d{1,3}$/.test(v) && +v >= 1 && +v <= 100) r.jornada = +v;
    }
    return r;
  }
  const enlace = ({ bruto, pagas, territorio, edad, prorrateadas, unidad, horas, jornada }) => "#sueldo-mes?" + [
    `b=${red2(bruto)}`, pagas ? `p=${pagas}` : "", territorio ? `t=${territorio}` : "",
    edad && edad !== EDAD ? `e=${edad}` : "", prorrateadas ? "pr=1" : "", unidad && unidad !== "anio" ? `u=${unidad}` : "",
    horas && horas !== HORAS ? `h=${horas}` : "", jornada && jornada !== 100 ? `j=${jornada}` : ""].filter(Boolean).join("&");

  const CALCULOS = { PAGAS, EDAD, HORAS, SEMANAS, anual, reparto, calcular, comparativa, brutoAnualDe, jornadaParcial, equivalencias, leerEnlace, enlace };
  if (typeof module !== "undefined" && module.exports) { module.exports = CALCULOS; return; }
  window.MapafiscalSueldoMes = CALCULOS;

  // ---- utilidades ----------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur = (n, dec = 2) => { const v = Math.abs(n || 0).toFixed(dec).split("."); return (n < -0.004 ? "−" : "") + miles(v[0]) + (dec ? "," + v[1] : "") + " €"; };
  const leer = id => window.MapafiscalImporte ? window.MapafiscalImporte.valor($(id)) : parseFloat($(id).value);
  const num = id => { const v = leer(id); return Number.isFinite(v) ? Math.max(0, Math.min(TOPE / 2, v)) : 0; };
  const MESES_EXTRA = { 14: "normalmente junio y diciembre", 15: "normalmente junio, diciembre y una tercera según el convenio" };

  async function datos(idScript, url) {
    const el = document.getElementById(idScript);
    if (el) return JSON.parse(el.textContent);
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("No se pudo cargar " + url);
    return r.json();
  }
  // el ejercicio en curso (params_<año>.json) o, si no está, el por defecto (como bruto.js)
  async function cargarP() {
    const P0 = await datos("datos-params", "datos/params.json");
    const y = new Date().getFullYear();
    if (P0.ejercicio === y) return P0;
    try { return await datos("datos-params-" + y, "datos/params_" + y + ".json"); } catch (e) { /* el por defecto */ }
    try { return await datos("datos-params-" + (P0.ejercicio + 1), "datos/params_" + (P0.ejercicio + 1) + ".json"); } catch (e) { return P0; }
  }

  let P = null;
  const nombre = t => P.territorios[t].nombre;
  const pagasSel = () => { const r = document.querySelector('input[name="sm-pagas"]:checked'); return r ? +r.value : 14; };
  const entrada = () => {
    const pagas = pagasSel(), unidad = UNIDADES.includes($("sm-unidad").value) ? $("sm-unidad").value : "anio", horas = Math.max(1, Math.min(80, parseFloat($("sm-horas").value) || HORAS));
    const jornada = Math.max(1, Math.min(100, parseInt($("sm-jornada").value, 10) || 100)), importe = num("sm-bruto");
    const completo = brutoAnualDe(importe, unidad, { pagas, horas });
    return { importe, unidad, horas, jornada, completo, bruto: jornadaParcial(completo, jornada), pagas, territorio: $("sm-territorio").value,
      edad: Math.max(16, Math.min(110, parseInt($("sm-edad").value, 10) || EDAD)), prorrateadas: $("sm-prorrateo").checked };
  };

  function aplicarEnlace(h) {
    const e = leerEnlace(h);
    if (e.bruto != null) $("sm-bruto").value = window.MapafiscalImporte ? window.MapafiscalImporte.formatearImporte(e.bruto) : String(e.bruto);
    if (e.pagas) document.querySelectorAll('input[name="sm-pagas"]').forEach(r => { r.checked = +r.value === e.pagas; });
    if (e.territorio && P.territorios[e.territorio]) $("sm-territorio").value = e.territorio;
    if (e.edad) $("sm-edad").value = e.edad;
    if (e.prorrateadas != null) $("sm-prorrateo").checked = e.prorrateadas;
    if (e.unidad) $("sm-unidad").value = e.unidad;
    if (e.horas) $("sm-horas").value = e.horas;
    if (e.jornada) $("sm-jornada").value = e.jornada;
  }

  function pintar() {
    const x = entrada(), o = { territorio: x.territorio, edad: x.edad };
    const c = comparativa(P, o, x.bruto, x.prorrateadas), r = c.filas.find(f => f.pagas === x.pagas);
    $("sm-prorrateo").disabled = x.pagas === 12;
    $("sm-chip").textContent = `${nombre(x.territorio)} · ${P.ejercicio}`;
    const extra = r.netoMesExtra != null
      ? `<p class="res-sub">En los ${r.extras} meses con paga extra (${esc(MESES_EXTRA[r.pagas])}) cobras <b>${eur(r.netoMesExtra)}</b> netos (${eur(r.brutoMesExtra)} brutos).</p>`
      : r.prorrateadas ? `<p class="res-sub">Con las ${r.extras} extras prorrateadas cobras 12 nóminas iguales: cada una lleva su parte de las extras.</p>`
        : `<p class="res-sub">En 12 pagas no hay pagas extra: cobras lo mismo todos los meses.</p>`;
    const eq = equivalencias(x.bruto, x), UNI = { anio: "al año", mes: "al mes", hora: "la hora" };
    const parcial = x.jornada < 100 ? `<p class="res-sub" id="sm-parcial">Con una jornada del ${x.jornada} %: ${eur(x.bruto)} brutos al año (el ${x.jornada} % de ${eur(x.completo)} a jornada completa). Es el bruto con el que se calcula el neto.</p>` : "";
    const equiv = `<p class="res-sub" id="sm-equiv">${x.unidad !== "anio" ? `${eur(x.importe)} brutos ${UNI[x.unidad]} son ${eur(x.completo)} al año a jornada completa (${x.unidad === "hora" ? `${x.horas} h × ${SEMANAS} semanas` : `× ${x.pagas} pagas`}). ` : ""}` +
      `Equivale a <b>${eur(eq.anual)}</b> al año, <b>${eur(eq.mensual)}</b> por paga en ${x.pagas} pagas y <b>${eq.hora != null ? eur(eq.hora) : "—"}</b> la hora (${String(eq.horasSemana).replace(".", ",")} h a la semana).</p>`;
    $("sm-principal").innerHTML = `<div class="res-etq">${eur(x.bruto)} brutos al año en ${r.pagas} pagas${r.prorrateadas ? " (extras prorrateadas)" : ""} son, cada mes,</div>
      <div class="res-cifra" id="sm-neto-mes">${eur(r.netoMes)} <small>netos</small></div>
      <p class="res-sub">${eur(r.brutoMes)} brutos al mes (${eur(x.bruto)} ÷ ${r.prorrateadas ? 12 : r.pagas}).</p>${extra}${parcial}${equiv}
      <dl class="kpis"><div><dt>Bruto al mes</dt><dd>${eur(r.brutoMes)}</dd></div><div><dt>Neto al mes</dt><dd>${eur(r.netoMes)}</dd></div>
      <div><dt>Neto en un mes con extra</dt><dd>${r.netoMesExtra != null ? eur(r.netoMesExtra) : "—"}</dd></div><div><dt>Neto al año</dt><dd>${eur(c.anual.neto)}</dd></div></dl>
      <p class="sm-frase"><b>El neto anual es el mismo; cambia cómo se reparte.</b></p>`;
    const col = f => f.pagas === x.pagas ? ' class="num tu"' : ' class="num"';
    const celdas = fn => c.filas.map(f => `<td${col(f)}>${fn(f)}</td>`).join("");
    const sinPr = c.filas.map(f => reparto(c.anual, f.pagas, false));
    $("sm-tabla").innerHTML = `<caption class="sr">Mismo bruto anual en 12, 14 y 15 pagas</caption><thead><tr><th></th>${c.filas.map(f => `<th scope="col"${col(f)}>${f.pagas} pagas</th>`).join("")}</tr></thead><tbody>
      <tr><td>Bruto de cada paga</td>${celdas(f => eur(f.brutoPaga))}</tr>
      <tr><td>Neto de cada paga</td>${celdas(f => eur(f.netoPaga))}</tr>
      <tr><td>Meses con paga extra</td>${celdas(f => f.extras || "—")}</tr>
      <tr><td>Neto de un mes con extra</td>${sinPr.map((f, i) => `<td${col(c.filas[i])}>${f.netoMesExtra != null ? eur(f.netoMesExtra) : "—"}</td>`).join("")}</tr>
      <tr><td>Extras prorrateadas: neto al mes</td>${celdas(() => eur(c.anual.neto / 12))}</tr>
      <tr class="total"><td>Neto al año</td>${celdas(() => eur(c.anual.neto))}</tr></tbody>`;
    $("sm-desglose").innerHTML = [["Sueldo bruto anual", eur(c.anual.bruto), ""], ["Cotizaciones a la Seguridad Social", "−" + eur(c.anual.cotizaciones), "hr-resta"],
      ["IRPF del año (tras la declaración)", "−" + eur(c.anual.irpf), "hr-resta"], ["Neto al año", eur(c.anual.neto), "total"]]
      .map(([t, i, cls]) => `<tr class="${cls}"><td>${t}</td><td class="cas"></td><td class="imp">${i}</td></tr>`).join("");
    $("sm-nota").textContent = `Ejercicio ${P.ejercicio}. Neto tras la Seguridad Social del trabajador y el IRPF del año (lo que queda después de la declaración, no la retención de cada nómina), ` +
      "para una persona sin hijos, con contrato indefinido y tributación individual. El precio por hora usa las horas semanales por 52 semanas; con jornada parcial, " +
      "el bruto a jornada completa se multiplica por el porcentaje de jornada y ese es el que se pasa al motor. Se reparte a partes iguales entre las pagas, igual que el bruto; en la nómina real la Seguridad Social " +
      "se cotiza cada mes con la prorrata de las extras y la retención puede variar, así que cada paga concreta puede salir algo distinta. Para tu caso completo, usa la calculadora.";
    try { if (/^#sueldo-mes/.test(location.hash)) history.replaceState(null, "", enlace(Object.assign({}, x, { bruto: x.importe }))); } catch (e) { /* sin historial */ }
  }

  cargarP().then(p => {
    P = p;
    $("sm-territorio").innerHTML = ORDEN.filter(t => P.territorios[t]).map(t => `<option value="${t}">${esc(nombre(t))}${P.territorios[t].regimen !== "comun" && !/foral/i.test(nombre(t)) ? " (foral)" : ""}</option>`).join("");
    $("sm-territorio").value = "ES-MD";
    aplicarEnlace(location.hash);
    let t1;
    $("sm-form").addEventListener("input", () => { clearTimeout(t1); t1 = setTimeout(pintar, 150); });
    $("sm-form").addEventListener("change", pintar);
    window.addEventListener("hashchange", () => { if (/^#sueldo-mes\?/.test(location.hash)) { aplicarEnlace(location.hash); pintar(); } });
    document.addEventListener("mapafiscal:vista", e => { if (e.detail && e.detail.vista === "sueldo-mes") pintar(); });
    if (!$("v-sueldo-mes").hidden) pintar();
  }).catch(() => { /* app.js ya avisa si no hay datos */ });
})();
