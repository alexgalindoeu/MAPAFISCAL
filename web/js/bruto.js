/* =============================================================================
 * Mapafiscal — bruto necesario y comparador de ofertas (vista #bruto-necesario)
 * «Quiero X € netos al mes (12 o 14 pagas) o al año: ¿qué bruto anual pido?» y «¿qué
 * oferta me deja más neto?». No calcula nada propio: usa irpfsim.sueldoNeto (paridad con
 * R/15_sueldo_neto.R) y busca la inversa por bisección sobre euros enteros. Se carga
 * después de app.js, que muestra la vista y avisa con «mapafiscal:vista».
 * Enlaces: #bruto-necesario?t=ES-AN abre ese territorio; #bruto-necesario?comparar, el comparador.
 * ========================================================================== */
(function () {
  "use strict";
  const H = (typeof window !== "undefined" && window.irpfsim) || (typeof require === "function" ? require("./irpfsim.js") : null);
  const NAVEGADOR = typeof window !== "undefined" && typeof document !== "undefined";
  if (NAVEGADOR) window.MAPAFISCAL_HERRAMIENTAS = Object.assign(window.MAPAFISCAL_HERRAMIENTAS || {}, {
    "bruto-necesario": { titulo: "¿Qué sueldo bruto pido?", icono: "nomina", href: "#bruto-necesario",
      texto: "El bruto anual que necesitas para cobrar el neto que quieres, en los 19 territorios, y qué oferta de trabajo te deja más." }
  });
  if (NAVEGADOR) document.dispatchEvent(new CustomEvent("mapafiscal:herramientas"));
  if (!H || (NAVEGADOR && !document.getElementById("v-bruto-necesario"))) return;

  const ORDEN = ["ES-AN", "ES-AR", "ES-AS", "ES-IB", "ES-CN", "ES-CB", "ES-CL", "ES-CM", "ES-CT", "ES-EX", "ES-GA",
    "ES-MD", "ES-MC", "ES-RI", "ES-VC", "ES-PV-VI", "ES-PV-BI", "ES-PV-SS", "ES-NC"];
  const TOPE = 1e7;   // bruto máximo que se busca

  // ---- cálculos (también los usa test/bruto.test.mjs) ----------------------------------
  const territorios = P => ORDEN.filter(t => P.territorios[t]);
  // o: { territorio, edad, hijos: [edades], tipoContrato }
  const neto = (P, o, bruto) => H.sueldoNeto(Object.assign({}, o, { bruto }), P);
  // neto anual que se quiere: periodo "mes12" | "mes14" | "anio"
  const netoAnualObjetivo = (importe, periodo) => Math.max(0, importe) * (periodo === "mes14" ? 14 : periodo === "mes12" ? 12 : 1);
  // Menor bruto anual, en euros enteros, cuyo neto llega al objetivo. El neto crece con el
  // bruto (ningún tipo marginal llega al 100 %), así que basta una bisección.
  function brutoNecesario(P, o, netoAnual) {
    if (!(netoAnual > 0)) return { bruto: 0, ...resumen(neto(P, o, 0)) };
    let lo = Math.floor(netoAnual) - 1, hi = Math.ceil(netoAnual * 1.25) + 1000;
    while (neto(P, o, hi).neto < netoAnual) { lo = hi; hi *= 2; if (hi > TOPE) throw new Error("Neto fuera de rango"); }
    while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if (neto(P, o, m).neto >= netoAnual) hi = m; else lo = m; }
    return { bruto: hi, ...resumen(neto(P, o, hi)) };
  }
  const resumen = s => ({ cotizaciones: s.cotizaciones, irpf: s.irpf, neto: s.neto });
  function porTerritorio(P, o, netoAnual) {
    return territorios(P).map(t => ({ territorio: t, ...brutoNecesario(P, Object.assign({}, o, { territorio: t }), netoAnual) }))
      .sort((a, b) => a.bruto - b.bruto || ORDEN.indexOf(a.territorio) - ORDEN.indexOf(b.territorio));
  }
  // Cifras redondeadas al euro que cuadran al leerlas: bruto − SS − IRPF = neto, y la
  // diferencia es la resta de los dos netos que se muestran.
  function cuadrar(bruto, s, pagas) {
    const b = Math.round(bruto), ss = Math.round(s.cotizaciones), n = Math.round(s.neto);
    return { bruto: b, cotizaciones: ss, irpf: b - ss - n, neto: n, pagas, netoPaga: Math.round(n / pagas), netoMes: Math.round(n / 12) };
  }
  // ofertas: [{ bruto, territorio, pagas }, …]; o: situación común (edad, hijos, contrato)
  function compararOfertas(P, o, a, b) {
    const ca = cuadrar(a.bruto, neto(P, Object.assign({}, o, { territorio: a.territorio }), a.bruto), a.pagas || 14);
    const cb = cuadrar(b.bruto, neto(P, Object.assign({}, o, { territorio: b.territorio }), b.bruto), b.pagas || 14);
    return { a: ca, b: cb, difAnual: ca.neto - cb.neto, difMes: ca.netoMes - cb.netoMes, difBruto: ca.bruto - cb.bruto,
      mejor: ca.neto > cb.neto ? "a" : cb.neto > ca.neto ? "b" : null };
  }
  const CALCULOS = { territorios, neto, netoAnualObjetivo, brutoNecesario, porTerritorio, cuadrar, compararOfertas };
  if (typeof module !== "undefined" && module.exports) { module.exports = CALCULOS; return; }
  window.MapafiscalBruto = CALCULOS;

  // ---- utilidades ----------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur0 = n => (n < -0.5 ? "−" : "") + miles(Math.abs(Math.round(n || 0)).toString()) + " €";
  const conSigno = n => (n > 0.5 ? "+" : "") + eur0(n);
  const pct = n => (100 * (n || 0)).toFixed(1).replace(".", ",") + " %";
  // importes en formato español (js/importe.js); sin el módulo (tests), como antes
  const leer = id => window.MapafiscalImporte ? window.MapafiscalImporte.valor($(id)) : parseFloat($(id).value);
  const num = id => { const v = leer(id); return Number.isFinite(v) ? Math.max(0, Math.min(TOPE / 2, v)) : 0; };
  const fila = (c, i, cls = "") => `<tr class="${cls}"><td>${c}</td><td class="cas"></td><td class="imp">${i}</td></tr>`;
  const barra = (v, max) => `<span class="hr-barra"><i style="width:${max > 0 ? Math.max(2, Math.round(100 * v / max)) : 0}%"></i></span>`;
  const PERIODOS = { mes12: "al mes, en 12 pagas", mes14: "al mes, en 14 pagas", anio: "al año" };

  async function datos(idScript, url) {
    const el = document.getElementById(idScript);
    if (el) return JSON.parse(el.textContent);
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("No se pudo cargar " + url);
    return r.json();
  }
  // el ejercicio en curso (params_<año>.json) o, si no está, el por defecto
  async function cargarP() {
    const P0 = await datos("datos-params", "datos/params.json");
    const y = new Date().getFullYear();
    if (P0.ejercicio === y) return P0;
    try { return await datos("datos-params-" + y, "datos/params_" + y + ".json"); } catch (e) { /* el por defecto */ }
    try { return await datos("datos-params-" + (P0.ejercicio + 1), "datos/params_" + (P0.ejercicio + 1) + ".json"); } catch (e) { return P0; }
  }

  let P = null, modo = /[?&]comparar\b/.test(location.hash) ? "comparar" : "bruto", edades = [];
  const inicial = (location.hash.match(/[?&]t=(ES-[A-Z]{2}(?:-[A-Z]{2})?)\b/) || [])[1];
  const nombre = t => P.territorios[t].nombre;
  const situacion = () => ({ territorio: $("bn-territorio").value, edad: num("bn-edad") || 35, hijos: edades.slice(), tipoContrato: $("bn-contrato").value });

  function pintarEdades() {
    const n = parseInt($("bn-hijos").value, 10) || 0;
    while (edades.length < n) edades.push(edades.length ? Math.min(25, edades[edades.length - 1] + 3) : 4);
    edades = edades.slice(0, n);
    $("bn-edades").innerHTML = edades.map((e, i) => `<label>Edad del hijo ${i + 1} <input type="number" min="0" max="30" step="1" value="${e}" data-edad="${i}"></label>`).join("");
  }

  function pintarBruto() {
    const o = situacion(), periodo = $("bn-periodo").value, importe = num("bn-neto");
    const objetivo = netoAnualObjetivo(importe, periodo), pagas = periodo === "mes12" ? 12 : 14;
    let r;
    try { r = brutoNecesario(P, o, objetivo); } catch (e) { $("bn-principal").innerHTML = '<p class="vacio">Revisa el neto: es demasiado alto para calcularlo.</p>'; return; }
    const c = cuadrar(r.bruto, r, pagas);
    $("bn-chip").textContent = `${nombre(o.territorio)} · ${P.ejercicio}`;
    $("bn-tarjeta").className = "tarjeta tarjeta-resultado";
    $("bn-principal").innerHTML = `<div class="res-etq">Para cobrar ${eur0(importe)} netos ${esc(PERIODOS[periodo])}, pide al menos</div>
      <div class="res-cifra">${eur0(c.bruto)} <small>brutos al año</small></div>
      <p class="res-sub">Unos <b>${eur0(c.bruto / pagas)}</b> brutos al mes en ${pagas} pagas. De cada 100 € brutos te quedan ${(c.bruto > 0 ? 100 * c.neto / c.bruto : 100).toFixed(0)} €.</p>
      <dl class="kpis"><div><dt>Seguridad Social</dt><dd>${eur0(c.cotizaciones)}</dd></div>
      <div><dt>IRPF del año</dt><dd>${eur0(c.irpf)}</dd></div><div><dt>Neto al año</dt><dd>${eur0(c.neto)}</dd></div></dl>`;
    $("bn-graficos").innerHTML = "";
    $("bn-t-desglose").textContent = "Desglose";
    $("bn-desglose").innerHTML = [fila("Sueldo bruto anual", eur0(c.bruto)), fila("Cotizaciones a la Seguridad Social", "−" + eur0(c.cotizaciones), "hr-resta"),
      fila("IRPF del año (tras la declaración)", "−" + eur0(c.irpf), "hr-resta"), fila("Neto al año", eur0(c.neto), "total"),
      fila("Neto al mes en 12 pagas", eur0(c.neto / 12), "info"), fila("Neto al mes en 14 pagas", eur0(c.neto / 14), "info")].join("");
    const rk = porTerritorio(P, o, objetivo), max = Math.max(...rk.map(x => x.bruto), 1), tuyo = c.bruto;
    $("bn-rank-tarjeta").hidden = false;
    $("bn-t-ranking").textContent = `Bruto anual necesario en los ${rk.length} territorios, de menos a más`;
    $("bn-ranking").innerHTML = `<caption class="sr">Pulsa un territorio para elegirlo</caption><thead><tr><th>#</th><th>Territorio</th><th class="num">Bruto anual</th><th class="num ocultable">IRPF</th><th class="num">Frente al tuyo</th></tr></thead><tbody>` +
      rk.map((x, i) => `<tr class="${x.territorio === o.territorio ? "tu" : ""}" data-t="${x.territorio}"><td class="pos">${i + 1}</td><td>${esc(nombre(x.territorio))}${barra(x.bruto, max)}</td>
        <td class="num">${eur0(x.bruto)}</td><td class="num ocultable">${eur0(x.irpf)}</td><td class="num">${x.territorio === o.territorio ? "—" : conSigno(x.bruto - tuyo)}</td></tr>`).join("") + "</tbody>";
  }

  const oferta = k => ({ bruto: num("bn-" + k + "-bruto"), territorio: $("bn-" + k + "-territorio").value, pagas: parseInt($("bn-" + k + "-pagas").value, 10) || 14 });
  function pintarComparar() {
    const o = situacion(), A = oferta("a"), B = oferta("b"), r = compararOfertas(P, o, A, B);
    const ab = k => k === "a" ? "A" : "B";
    $("bn-chip").textContent = `Ejercicio ${P.ejercicio}`;
    $("bn-tarjeta").className = "tarjeta tarjeta-resultado" + (r.mejor ? " gana" : "");
    const frase = r.mejor ? `La oferta <b>${ab(r.mejor)}</b> te deja <b>${eur0(Math.abs(r.difAnual))}</b> netos más al año (${eur0(Math.abs(r.difMes))} al mes en 12 pagas)` +
      (Math.sign(r.difBruto) && Math.sign(r.difBruto) !== Math.sign(r.difAnual) ? `, aunque su bruto es ${eur0(Math.abs(r.difBruto))} menor.` : ".") : "Las dos ofertas te dejan el mismo neto.";
    $("bn-principal").innerHTML = `<div class="res-etq">Oferta A frente a oferta B · neto al año</div>
      <div class="res-cifra">${conSigno(r.difAnual)}</div>
      <p class="res-sub">${frase}</p>
      <dl class="kpis bn-ofertas">${["a", "b"].map(k => `<div class="${r.mejor === k ? "gana" : ""}"><dt>Oferta ${ab(k)} · ${esc(nombre((k === "a" ? A : B).territorio))}</dt><dd>${eur0(r[k].neto)}<small> al año</small></dd>
        <dd class="bn-mes">${eur0(r[k].netoPaga)} × ${r[k].pagas} pagas</dd></div>`).join("")}
        <div><dt>Diferencia</dt><dd>${conSigno(r.difAnual)}<small> al año</small></dd><dd class="bn-mes">${conSigno(r.difMes)} al mes (12 pagas)</dd></div></dl>`;
    const max = Math.max(r.a.bruto, r.b.bruto, 1);
    $("bn-graficos").innerHTML = `<div class="rp-barras">` + ["a", "b"].map(k => `<div class="rp-barra${r.mejor === k ? " mejor" : ""}"><span>Oferta ${ab(k)}</span>
      <span class="hr-barra bn-reparto" role="img" aria-label="Neto ${eur0(r[k].neto)} de ${eur0(r[k].bruto)} brutos"><i style="width:${Math.round(100 * r[k].neto / max)}%"></i><i class="bn-imp" style="width:${Math.round(100 * (r[k].bruto - r[k].neto) / max)}%"></i></span><b>${pct(r[k].bruto ? r[k].neto / r[k].bruto : 0)}</b></div>`).join("") +
      `<p class="ayuda">Barra: lo que te queda neto (color) y lo que se llevan la Seguridad Social y el IRPF (gris); a la derecha, el porcentaje neto del bruto.</p></div>`;
    $("bn-t-desglose").textContent = "Las dos ofertas, cifra a cifra";
    $("bn-desglose").innerHTML = `<thead><tr><th></th><th class="num">Oferta A</th><th class="num">Oferta B</th><th class="num">A − B</th></tr></thead><tbody>` +
      [["Bruto anual", "bruto"], ["Seguridad Social", "cotizaciones"], ["IRPF del año", "irpf"], ["Neto al año", "neto"], ["Neto al mes (12 pagas)", "netoMes"]]
        .map(([t, k]) => `<tr class="${k === "neto" ? "total" : ""}"><td>${t}</td><td class="num">${eur0(r.a[k])}</td><td class="num">${eur0(r.b[k])}</td><td class="num">${conSigno(r.a[k] - r.b[k])}</td></tr>`).join("") +
      `<tr class="info"><td>Neto de cada paga</td><td class="num">${eur0(r.a.netoPaga)}<small> ×${r.a.pagas}</small></td><td class="num">${eur0(r.b.netoPaga)}<small> ×${r.b.pagas}</small></td><td class="num"></td></tr></tbody>`;
    $("bn-rank-tarjeta").hidden = true;
  }

  function pintar() {
    document.querySelectorAll('input[name="bn-modo"]').forEach(r => { r.checked = r.value === modo; });
    const cmp = modo === "comparar";
    $("bn-bloque-neto").hidden = cmp; $("bn-bloque-ofertas").hidden = !cmp; $("bn-campo-territorio").hidden = cmp;
    $("bn-desglose").className = cmp ? "ranking bn-tabla" : "desglose";
    $("t-bn").textContent = cmp ? "¿Qué oferta de trabajo me deja más neto?" : "¿Qué sueldo bruto pido?";
    if (cmp) pintarComparar(); else pintarBruto();
    $("bn-nota").textContent = `Ejercicio ${P.ejercicio}. Neto tras la Seguridad Social del trabajador y el IRPF del año (lo que queda después de la declaración, no la retención de cada nómina). ` +
      "Tributación individual; con hijos, como familia monoparental. Las 14 pagas reparten el mismo bruto anual en 12 mensualidades y 2 extras. " +
      "Cifras redondeadas al euro, de forma que bruto − Seguridad Social − IRPF = neto. Para tu caso completo, usa la calculadora.";
  }

  cargarP().then(p => {
    P = p;
    const opciones = territorios(P).map(t => `<option value="${t}">${esc(nombre(t))}${P.territorios[t].regimen !== "comun" && !/foral/i.test(nombre(t)) ? " (foral)" : ""}</option>`).join("");
    ["bn-territorio", "bn-a-territorio", "bn-b-territorio"].forEach(id => { $(id).innerHTML = opciones; });
    $("bn-territorio").value = inicial && P.territorios[inicial] ? inicial : "ES-MD";
    $("bn-a-territorio").value = $("bn-territorio").value; $("bn-b-territorio").value = "ES-CT";
    pintarEdades();
    let t1;
    $("bn-form").addEventListener("input", e => {
      const i = e.target.dataset && e.target.dataset.edad;
      if (i != null) edades[+i] = Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0));
      clearTimeout(t1); t1 = setTimeout(pintar, 150);
    });
    $("bn-form").addEventListener("change", e => { if (e.target.id === "bn-hijos") pintarEdades(); pintar(); });
    document.querySelectorAll('input[name="bn-modo"]').forEach(r => r.addEventListener("change", () => { modo = r.value; pintar(); }));
    $("bn-ranking").addEventListener("click", e => { const tr = e.target.closest("tr[data-t]"); if (tr) { $("bn-territorio").value = tr.dataset.t; pintar(); } });
    window.addEventListener("hashchange", () => {
      if (!/^#bruto-necesario/.test(location.hash)) return;
      if (/[?&]comparar\b/.test(location.hash)) modo = "comparar";
      const t = (location.hash.match(/[?&]t=(ES-[A-Z]{2}(?:-[A-Z]{2})?)\b/) || [])[1];
      if (t && P.territorios[t]) $("bn-territorio").value = t;
      pintar();
    });
    document.addEventListener("mapafiscal:vista", e => { if (e.detail && e.detail.vista === "bruto-necesario") pintar(); });
    if (!$("v-bruto-necesario").hidden) pintar();
  }).catch(() => { /* app.js ya avisa si no hay datos */ });
})();
