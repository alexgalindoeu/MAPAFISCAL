/* =============================================================================
 * Mapafiscal — ¿cuánto tributa rescatar mi plan de pensiones? (vista #rescate-plan)
 * Motor: irpfsim.rescatePlan (paridad con R/16_rescate_plan.R). Lo cobrado es rendimiento
 * del trabajo; en capital, lo aportado hasta el 31-12-2006 se reduce un 40 % (DT 12.ª LIRPF)
 * si se cobra en plazo. Régimen común: el País Vasco y Navarra tienen reglas forales propias
 * que el motor aún no recoge, y no se ofrecen. Se carga después de app.js, que muestra la
 * vista y avisa con «mapafiscal:vista». Un enlace a #rescate-plan?t=ES-AN abre ese territorio.
 * ========================================================================== */
(function () {
  "use strict";
  const H = (typeof window !== "undefined" && window.irpfsim) || (typeof require === "function" ? require("./irpfsim.js") : null);
  const NAVEGADOR = typeof window !== "undefined" && typeof document !== "undefined";
  if (NAVEGADOR) window.MAPAFISCAL_HERRAMIENTAS = Object.assign(window.MAPAFISCAL_HERRAMIENTAS || {}, {
    "rescate-plan": { titulo: "¿Cuánto tributa rescatar mi plan?", icono: "calendario", href: "#rescate-plan",
      texto: "El IRPF de rescatar tu plan de pensiones de una vez, como renta o mixto, con la reducción del 40 % de lo aportado antes de 2007." }
  });
  if (NAVEGADOR) document.dispatchEvent(new CustomEvent("mapafiscal:herramientas"));
  if (!H || (NAVEGADOR && !document.getElementById("v-rescate-plan"))) return;

  const ORDEN = ["ES-AN", "ES-AR", "ES-AS", "ES-IB", "ES-CN", "ES-CB", "ES-CL", "ES-CM", "ES-CT", "ES-EX", "ES-GA",
    "ES-MD", "ES-MC", "ES-RI", "ES-VC"];
  const FORMAS = { capital: "De una vez (capital)", mixto: "Mixto", renta: "Como renta" };

  // ---- cálculos (también los usa test/rescate.test.mjs) --------------------------------
  const territorios = P => ORDEN.filter(t => P.territorios[t] && P.territorios[t].regimen === "comun");
  const rescate = (P, o) => H.rescatePlan(o, P);
  function porTerritorio(P, o) {
    return territorios(P).map(t => {
      const r = rescate(P, Object.assign({}, o, { territorio: t }));
      return { territorio: t, capital: r.capital.extra, mixto: r.mixto.extra, renta: r.renta.extra, mejor: r.mejor, minimo: r[r.mejor].extra };
    }).sort((a, b) => a.minimo - b.minimo);
  }
  function porAnios(P, o, lista) {
    return lista.map(n => { const r = rescate(P, Object.assign({}, o, { anios: n })); return { anios: n, renta: r.renta.extra, mixto: r.mixto.extra }; });
  }
  const CALCULOS = { territorios, rescate, porTerritorio, porAnios };
  if (typeof module !== "undefined" && module.exports) { module.exports = CALCULOS; return; }
  window.MapafiscalRescate = CALCULOS;

  // ---- utilidades ----------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur0 = n => (n < -0.5 ? "−" : "") + miles(Math.abs(Math.round(n || 0)).toString()) + " €";
  const pct = n => (100 * (n || 0)).toFixed(1).replace(".", ",") + " %";
  const num = id => { const v = parseFloat($(id).value); return Number.isFinite(v) ? Math.max(0, v) : 0; };
  const fila = (c, i, cls = "") => `<tr class="${cls}"><td>${c}</td><td class="cas"></td><td class="imp">${i}</td></tr>`;
  const barra = (v, max) => `<span class="hr-barra"><i style="width:${max > 0 ? Math.max(2, Math.round(100 * v / max)) : 0}%"></i></span>`;

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

  let P = null, forma = "capital";
  const inicial = (location.hash.match(/[?&]t=(ES-[A-Z]{2})\b/) || [])[1];
  const datosForm = () => ({ territorio: $("rp-territorio").value, antes2007: num("rp-antes"), despues2007: num("rp-despues"),
    otrosIngresos: num("rp-otros"), tipoOtros: $("rp-tipo-otros").value, edad: num("rp-edad") || 65,
    anioContingencia: Math.round(num("rp-contingencia")) || P.ejercicio, anios: parseInt($("rp-anios").value, 10) || 5 });

  function pintar() {
    const o = datosForm();
    $("rp-forma-anios").hidden = forma === "capital";
    document.querySelectorAll('input[name="rp-forma"]').forEach(r => { r.checked = r.value === forma; });
    let r;
    try { r = rescate(P, o); } catch (e) { $("rp-principal").innerHTML = '<p class="vacio">Revisa los datos introducidos.</p>'; return; }
    const total = o.antes2007 + o.despues2007, terr = P.territorios[o.territorio].nombre;
    const tu = r[forma], mejor = r[r.mejor], ahorro = tu.extra - mejor.extra;
    const nombreForma = k => k === "capital" ? FORMAS.capital : k === "mixto" ? `Mixto: lo anterior a 2007 de una vez y el resto en ${r.anios} años` : `Como renta, en ${r.anios} años`;
    $("rp-chip").textContent = `${terr} · ${P.ejercicio}`;
    $("rp-tarjeta").className = "tarjeta tarjeta-resultado" + (r.mejor === forma ? " gana" : "");
    $("rp-principal").innerHTML = `<div class="res-etq">IRPF extra por rescatar ${eur0(total)} · ${esc(nombreForma(forma))}</div>
      <div class="res-cifra">${eur0(tu.extra)}</div>
      <p class="res-sub">${total > 0 ? `Te quedan <b>${eur0(total - tu.extra)}</b> del plan (el ${pct(total > 0 ? tu.extra / total : 0)} se va en IRPF). ` : "Indica cuánto tienes en el plan. "}
        ${r.mejor === forma ? "Es la opción que menos tributa con tus datos." : `La opción que menos tributa es <b>${esc(nombreForma(r.mejor).toLowerCase())}</b>: ${eur0(mejor.extra)}, ${eur0(ahorro)} menos.`}</p>
      <dl class="kpis"><div><dt>De una vez</dt><dd>${eur0(r.capital.extra)}</dd></div>
      <div><dt>Mixto (${r.anios} años)</dt><dd>${eur0(r.mixto.extra)}</dd></div><div><dt>Renta (${r.anios} años)</dt><dd>${eur0(r.renta.extra)}</dd></div></dl>`;
    const max = Math.max(r.capital.extra, r.mixto.extra, r.renta.extra, 1);
    $("rp-graficos").innerHTML = `<div class="rp-barras">` + ["capital", "mixto", "renta"].map(k =>
      `<div class="rp-barra${k === r.mejor ? " mejor" : ""}${k === forma ? " tuya" : ""}"><span>${esc(k === "capital" ? "De una vez" : k === "mixto" ? "Mixto" : "Renta")}</span>
        <span class="hr-barra"><i style="width:${Math.max(2, Math.round(100 * r[k].extra / max))}%"></i></span><b>${eur0(r[k].extra)}</b></div>`).join("") + `</div>`;
    // detalle: cobros e IRPF extra año a año de la opción elegida
    const filas = [];
    if (o.antes2007 > 0) filas.push(fila(r.enPlazo ? `Reducción del 40 % de lo aportado hasta 2006 (${eur0(o.antes2007)}), solo cobrándolo en capital`
      : "Sin reducción del 40 %: el rescate en capital queda fuera del plazo de la DT 12.ª", r.enPlazo ? "−" + eur0(r.reduccion) : "—", r.enPlazo ? "hr-resta" : "info"));
    filas.push(fila("IRPF del año sin rescatar (tus otros ingresos)", eur0(r.irpfSin)));
    tu.cobros.forEach((c, i) => filas.push(fila(`${P.ejercicio + i}: cobras ${eur0(c)}${i === 0 && forma !== "renta" && r.reduccion > 0 ? " (con la reducción)" : ""}`, "+" + eur0(tu.anual[i]))));
    filas.push(fila("IRPF extra por el rescate", eur0(tu.extra), "total"));
    $("rp-desglose").innerHTML = filas.join("");
    const lista = porAnios(P, o, [2, 3, 4, 5, 10, 15]);
    $("rp-anios-tabla").innerHTML = `<thead><tr><th>Repartido en</th><th class="num">Mixto</th><th class="num">Renta</th></tr></thead><tbody>
      <tr><td>1 año (de una vez)</td><td class="num">${eur0(r.capital.extra)}</td><td class="num">${eur0(r.capital.extra)}</td></tr>` +
      lista.map(x => `<tr class="${x.anios === r.anios ? "tu" : ""}"><td>${x.anios} años</td><td class="num">${eur0(x.mixto)}</td><td class="num">${eur0(x.renta)}</td></tr>`).join("") + "</tbody>";
    const rk = porTerritorio(P, o), maxT = Math.max(...rk.map(x => x.minimo), 1);
    $("rp-t-ranking").textContent = `IRPF extra del rescate en los ${rk.length} territorios de régimen común, de menos a más`;
    $("rp-ranking").innerHTML = `<thead><tr><th>#</th><th>Territorio</th><th class="num">De una vez</th><th class="num ocultable">Mixto</th><th class="num ocultable">Renta</th><th class="num">Mejor</th></tr></thead><tbody>` +
      rk.map((x, i) => `<tr class="${x.territorio === o.territorio ? "tu" : ""}" data-t="${x.territorio}"><td class="pos">${i + 1}</td><td>${esc(P.territorios[x.territorio].nombre)}${barra(x.minimo, maxT)}</td>
        <td class="num">${eur0(x.capital)}</td><td class="num ocultable">${eur0(x.mixto)}</td><td class="num ocultable">${eur0(x.renta)}</td><td class="num">${esc(x.mejor === "capital" ? "De una vez" : x.mejor === "mixto" ? "Mixto" : "Renta")}</td></tr>`).join("") + "</tbody>";
    const d = P.estatal.prestaciones_prevision_dt12;
    $("rp-nota").textContent = `Ejercicio ${P.ejercicio}: normativa del IRPF estatal y autonómica de ${P.ejercicio}; los años siguientes se calculan con la misma. ` +
      `Lo que cobras del plan es rendimiento del trabajo (art. 17.2.a.3.º LIRPF) y se suma a tus otros ingresos. La reducción del 40 % (DT 12.ª LIRPF) solo se aplica a lo aportado hasta el 31-12-2006, cobrado en forma de capital en un único año: ` +
      `si te jubilaste desde ${d.anio_regimen_2015}, ese año o los ${d.plazo_desde_2015_anios} siguientes; entre ${d.anio_regimen_2011} y ${d.anio_regimen_2015 - 1}, hasta el ${d.plazo_2011_2014_anios}.º año siguiente; antes, hasta ${d.ultimo_anio_anterior_2011}. ` +
      "Tributación individual, sin otras rentas ni deducciones: para tu caso completo, usa la calculadora. El País Vasco y Navarra regulan el rescate en su normativa foral y no se incluyen.";
  }

  cargarP().then(p => {
    P = p;
    const sel = $("rp-territorio");
    sel.innerHTML = territorios(P).map(t => `<option value="${t}">${esc(P.territorios[t].nombre)}</option>`).join("");
    sel.value = inicial && territorios(P).includes(inicial) ? inicial : "ES-MD";
    $("rp-contingencia").value = String(P.ejercicio);
    let t1;
    $("rp-form").addEventListener("input", () => { clearTimeout(t1); t1 = setTimeout(pintar, 120); });
    $("rp-form").addEventListener("change", pintar);
    document.querySelectorAll('input[name="rp-forma"]').forEach(r => r.addEventListener("change", () => { forma = r.value; pintar(); }));
    $("rp-ranking").addEventListener("click", e => { const tr = e.target.closest("tr[data-t]"); if (tr) { sel.value = tr.dataset.t; pintar(); } });
    window.addEventListener("hashchange", () => {
      const t = (location.hash.match(/^#rescate-plan[?&]t=(ES-[A-Z]{2})\b/) || [])[1];
      if (t && territorios(P).includes(t)) { sel.value = t; pintar(); }
    });
    document.addEventListener("mapafiscal:vista", e => { if (e.detail && e.detail.vista === "rescate-plan") pintar(); });
    if (!$("v-rescate-plan").hidden) pintar();
  }).catch(() => { /* app.js ya avisa si no hay datos */ });
})();
