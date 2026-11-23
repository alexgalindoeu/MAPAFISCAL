/* =============================================================================
 * Mapafiscal — comparar dos ofertas de trabajo (vista #ofertas)
 * Cada oferta: bruto anual, territorio, 12 o 14 pagas y, si quieres, tu aportación a un plan
 * de pensiones de empleo. Resultado lado a lado (neto anual y mensual, IRPF, cotizaciones y
 * tipo medio) y la diferencia real en neto. No calcula nada propio: usa irpfsim.sueldoNeto
 * (paridad con R/15_sueldo_neto.R). Se carga después de app.js, que muestra la vista y avisa
 * con «mapafiscal:vista».
 * Enlace para compartir: #ofertas?a=<bruto>,<territorio>,<pagas>[,<plan>]&b=…
 * Las páginas /comparar-ofertas/ (tools/seo_comparadores.mjs) usan los mismos cálculos.
 * ========================================================================== */
(function () {
  "use strict";
  const H = (typeof window !== "undefined" && window.irpfsim) || (typeof require === "function" ? require("./irpfsim.js") : null);
  const NAVEGADOR = typeof window !== "undefined" && typeof document !== "undefined";
  if (NAVEGADOR) window.MAPAFISCAL_HERRAMIENTAS = Object.assign(window.MAPAFISCAL_HERRAMIENTAS || {}, {
    ofertas: { titulo: "Comparar dos ofertas de trabajo", icono: "ofertas", href: "#ofertas",
      texto: "Dos sueldos lado a lado, cada uno en su territorio y con sus pagas: qué te deja de verdad cada mes." }
  });
  if (NAVEGADOR) document.dispatchEvent(new CustomEvent("mapafiscal:herramientas"));
  if (!H || (NAVEGADOR && !document.getElementById("v-ofertas"))) return;

  const ORDEN = ["ES-AN", "ES-AR", "ES-AS", "ES-IB", "ES-CN", "ES-CB", "ES-CL", "ES-CM", "ES-CT", "ES-EX", "ES-GA",
    "ES-MD", "ES-MC", "ES-RI", "ES-VC", "ES-PV-VI", "ES-PV-BI", "ES-PV-SS", "ES-NC"];
  const TOPE = 5e6;
  // situación común a las dos ofertas: la de las páginas de sueldo neto
  const SITUACION = { edad: 35, hijos: [], tipoContrato: "indefinido" };
  const POR_DEFECTO = { a: { bruto: 32000, territorio: "ES-MD", pagas: 14, plan: 0 }, b: { bruto: 31000, territorio: "ES-PV-BI", pagas: 12, plan: 0 } };

  // ---- cálculos (también los usan test/ofertas.test.mjs y tools/seo_comparadores.mjs) ----
  const limpiar = (P, o, def) => {
    const n = (v, d) => Number.isFinite(+v) && v !== "" && v != null ? Math.max(0, Math.min(TOPE, +v)) : d;
    const t = o && P.territorios[o.territorio] ? o.territorio : def.territorio;
    return { bruto: n(o && o.bruto, def.bruto), territorio: t, pagas: o && +o.pagas === 12 ? 12 : o && +o.pagas === 14 ? 14 : def.pagas,
      plan: Math.min(n(o && o.plan, 0), n(o && o.bruto, def.bruto)) };
  };
  // Una oferta, en euros enteros que cuadran: bruto − SS − IRPF − plan = neto en mano.
  // El ahorro del plan es lo que baja el IRPF por aportar (la misma liquidación sin él).
  function calcularOferta(P, o) {
    const caso = Object.assign({}, SITUACION, { bruto: o.bruto, territorio: o.territorio });
    const con = H.sueldoNeto(Object.assign({}, caso, { aportacionPlan: o.plan || 0 }), P);
    const sin = o.plan > 0 ? H.sueldoNeto(caso, P) : con;
    const b = Math.round(o.bruto), ss = Math.round(con.cotizaciones), plan = Math.round(o.plan || 0);
    const n = Math.round(con.neto - (o.plan || 0));
    const pagas = o.pagas === 12 ? 12 : 14;
    return { territorio: o.territorio, pagas, bruto: b, cotizaciones: ss, irpf: b - ss - plan - n, plan, neto: n,
      netoMes: Math.round(n / 12), netoPaga: Math.round(n / pagas), brutoPaga: Math.round(b / pagas),
      tipoMedio: b > 0 ? (b - ss - plan - n) / b : 0, cargaTotal: b > 0 ? (b - plan - n) / b : 0,
      ahorroPlan: Math.round(sin.irpf - con.irpf) };
  }
  const LETRA = { a: "A", b: "B" };
  function compararOfertas(P, A, B) {
    const a = calcularOferta(P, A), b = calcularOferta(P, B);
    const difAnual = a.neto - b.neto;
    return { a, b, difAnual, difMes: Math.round(difAnual / 12), difBruto: a.bruto - b.bruto,
      mejor: difAnual > 0 ? "a" : difAnual < 0 ? "b" : null };
  }
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur0 = n => (n < -0.5 ? "−" : "") + miles(Math.abs(Math.round(n || 0)).toString()) + " €";
  // «La oferta B te deja 120 €/mes más aunque su bruto sea 1.000 € menor.»
  function frase(r) {
    if (!r.mejor) return "Las dos ofertas te dejan el mismo neto.";
    const otra = r.mejor === "a" ? "b" : "a";
    const mes = Math.abs(r.difMes), anual = Math.abs(r.difAnual);
    const cuanto = mes >= 1 ? `${eur0(mes)}/mes más (${eur0(anual)} al año)` : `${eur0(anual)} más al año`;
    const dBruto = r[r.mejor].bruto - r[otra].bruto;
    const aunque = dBruto < 0 ? ` aunque su bruto sea ${eur0(-dBruto)} menor` : dBruto === 0 ? " con el mismo bruto" : "";
    const planes = ["a", "b"].filter(k => r[k].plan > 0).map(k => `la oferta ${LETRA[k]} aparta además ${eur0(r[k].plan)} al año en su plan de empleo`);
    return `La oferta ${LETRA[r.mejor]} te deja ${cuanto}${aunque}.` + (planes.length ? ` En mano: ${planes.join(" y ")}, que siguen siendo tuyos.` : "");
  }
  // enlace para compartir: a=32000,ES-MD,14[,plan]
  const parteEnlace = o => [Math.round(o.bruto), o.territorio, o.pagas].concat(o.plan > 0 ? [Math.round(o.plan)] : []).join(",");
  const enlace = (A, B) => `#ofertas?a=${parteEnlace(A)}&b=${parteEnlace(B)}`;
  function leerEnlace(hash) {
    const q = String(hash || "").split("?")[1] || "", out = {};
    for (const par of q.split("&")) {
      const [k, v] = par.split("=");
      if ((k !== "a" && k !== "b") || !v) continue;
      const [bruto, territorio, pagas, plan] = decodeURIComponent(v).split(",");
      out[k] = { bruto: bruto === "" ? undefined : +bruto, territorio, pagas: +pagas, plan: plan === undefined ? 0 : +plan };
    }
    return out;
  }
  const CALCULOS = { SITUACION, POR_DEFECTO, limpiar, calcularOferta, compararOfertas, frase, enlace, leerEnlace };
  if (typeof module !== "undefined" && module.exports) { module.exports = CALCULOS; return; }
  window.MapafiscalOfertas = CALCULOS;

  // ---- utilidades ----------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const conSigno = n => (n > 0.5 ? "+" : "") + eur0(n);
  const pct = n => (100 * (n || 0)).toFixed(1).replace(".", ",") + "&nbsp;%";
  const leer = id => window.MapafiscalImporte ? window.MapafiscalImporte.valor($(id)) : parseFloat($(id).value);
  const escribir = (id, v) => { $(id).value = window.MapafiscalImporte ? window.MapafiscalImporte.formatearImporte(v) : String(v); };
  async function datos(idScript, url) {
    const el = document.getElementById(idScript);
    if (el) return JSON.parse(el.textContent);
    const cache = window.__mapafiscalJson = window.__mapafiscalJson || {};
    if (!cache[url]) cache[url] = fetch(url, { cache: "no-cache" }).then(r => {
      if (!r.ok) throw new Error("No se pudo cargar " + url);
      return r.text();
    }).catch(e => { delete cache[url]; throw e; });
    return JSON.parse(await cache[url]);
  }

  let P = null;
  const nombre = t => P.territorios[t].nombre;
  const leerOferta = k => limpiar(P, { bruto: leer("of-" + k + "-bruto"), territorio: $("of-" + k + "-territorio").value,
    pagas: $("of-" + k + "-pagas").value, plan: leer("of-" + k + "-plan") }, POR_DEFECTO[k]);
  function rellenar(k, o) {
    escribir("of-" + k + "-bruto", o.bruto); escribir("of-" + k + "-plan", o.plan || 0);
    $("of-" + k + "-territorio").value = o.territorio; $("of-" + k + "-pagas").value = String(o.pagas);
  }
  function desdeEnlace() {
    const e = leerEnlace(location.hash);
    for (const k of ["a", "b"]) rellenar(k, limpiar(P, e[k] || POR_DEFECTO[k], POR_DEFECTO[k]));
  }

  function pintar() {
    const A = leerOferta("a"), B = leerOferta("b"), r = compararOfertas(P, A, B);
    const rot = window.MapafiscalConfianza ? window.MapafiscalConfianza.rotuloEjercicio(P.ejercicio).corto : "Ejercicio " + P.ejercicio;
    $("of-chip").textContent = rot;
    $("of-tarjeta").className = "tarjeta tarjeta-resultado" + (r.mejor ? " gana" : "");
    $("of-principal").innerHTML = `<div class="res-etq">Diferencia de neto en mano · A − B</div>
      <div class="res-cifra">${conSigno(r.difMes)} <small>al mes</small></div>
      <p class="res-sub" id="of-frase">${esc(frase(r))}</p>
      <dl class="kpis bn-ofertas">${["a", "b"].map(k => `<div class="${r.mejor === k ? "gana" : ""}"><dt>Oferta ${LETRA[k]} · ${esc(nombre(r[k].territorio))}</dt>
        <dd>${eur0(r[k].netoMes)}<small> al mes</small></dd><dd class="bn-mes">${eur0(r[k].netoPaga)} × ${r[k].pagas} pagas</dd></div>`).join("")}
        <div><dt>Diferencia al año</dt><dd>${conSigno(r.difAnual)}</dd><dd class="bn-mes">bruto: ${conSigno(r.difBruto)}</dd></div></dl>`;
    const filas = [["Bruto anual", "bruto"], ["Cotizaciones a la Seguridad Social", "cotizaciones"], ["IRPF del año", "irpf"]]
      .concat(r.a.plan || r.b.plan ? [["Tu aportación al plan de empleo", "plan"]] : [])
      .concat([["Neto en mano al año", "neto"], ["Neto al mes (12 pagas)", "netoMes"]]);
    $("of-tabla").innerHTML = `<caption class="sr">Las dos ofertas, cifra a cifra</caption><thead><tr><th scope="col">Concepto</th><th scope="col" class="num">Oferta A</th><th scope="col" class="num">Oferta B</th><th scope="col" class="num">A − B</th></tr></thead><tbody>` +
      filas.map(([t, k]) => `<tr class="${k === "neto" ? "total" : ""}"><th scope="row">${t}</th><td class="num">${eur0(r.a[k])}</td><td class="num">${eur0(r.b[k])}</td><td class="num">${conSigno(r.a[k] - r.b[k])}</td></tr>`).join("") +
      `<tr class="info"><th scope="row">Neto de cada paga</th><td class="num">${eur0(r.a.netoPaga)} <small>× ${r.a.pagas}</small></td><td class="num">${eur0(r.b.netoPaga)} <small>× ${r.b.pagas}</small></td><td class="num"></td></tr>` +
      `<tr class="info"><th scope="row">Tipo medio del IRPF</th><td class="num">${pct(r.a.tipoMedio)}</td><td class="num">${pct(r.b.tipoMedio)}</td><td class="num"></td></tr>` +
      `<tr class="info"><th scope="row">IRPF + Seguridad Social sobre el bruto</th><td class="num">${pct(r.a.cargaTotal)}</td><td class="num">${pct(r.b.cargaTotal)}</td><td class="num"></td></tr>` +
      (r.a.plan || r.b.plan ? `<tr class="info"><th scope="row">IRPF que te ahorras por el plan</th><td class="num">${eur0(r.a.ahorroPlan)}</td><td class="num">${eur0(r.b.ahorroPlan)}</td><td class="num"></td></tr>` : "") + "</tbody>";
    const url = location.href.split("#")[0] + enlace(A, B);
    $("of-enlace").value = url;
    try { if (/^#ofertas/.test(location.hash) || !location.hash) history.replaceState(null, "", enlace(A, B)); } catch (e) { /* vista previa sin historial */ }
    $("of-nota").textContent = `Ejercicio ${P.ejercicio}. Neto tras la Seguridad Social del trabajador y el IRPF del año (después de la declaración, no la retención de cada nómina), ` +
      `para una persona de ${SITUACION.edad} años sin hijos, con contrato indefinido y tributación individual. Las 14 pagas reparten el mismo bruto en 12 mensualidades y 2 extras. ` +
      "Tu aportación al plan de empleo se descuenta del neto en mano y reduce la base del IRPF con los límites de la ley (no se cuentan las contribuciones de la empresa). Cifras redondeadas al euro.";
  }

  async function copiar() {
    const msg = $("of-copiado"), url = $("of-enlace").value;
    try { await navigator.clipboard.writeText(url); msg.textContent = "Enlace copiado. Quien lo abra verá estas mismas dos ofertas."; }
    catch (e) { $("of-enlace").focus(); $("of-enlace").select(); msg.textContent = "Copia el enlace del campo."; }
  }

  datos("datos-params", "datos/params.json").then(p => {
    P = p;
    const opciones = ORDEN.filter(t => P.territorios[t]).map(t => `<option value="${t}">${esc(nombre(t))}${P.territorios[t].regimen !== "comun" && !/foral/i.test(nombre(t)) ? " (foral)" : ""}</option>`).join("");
    $("of-a-territorio").innerHTML = opciones; $("of-b-territorio").innerHTML = opciones;
    desdeEnlace();
    let t1;
    $("of-form").addEventListener("input", () => { clearTimeout(t1); t1 = setTimeout(pintar, 150); });
    $("of-form").addEventListener("change", pintar);
    $("of-form").addEventListener("submit", e => e.preventDefault());
    $("of-copiar").addEventListener("click", copiar);
    window.addEventListener("hashchange", () => { if (/^#ofertas\?/.test(location.hash)) { desdeEnlace(); pintar(); } });
    document.addEventListener("mapafiscal:vista", e => { if (e.detail && e.detail.vista === "ofertas") pintar(); });
    if (!$("v-ofertas").hidden) pintar();
  }).catch(() => { /* app.js ya avisa si no hay datos */ });
})();
