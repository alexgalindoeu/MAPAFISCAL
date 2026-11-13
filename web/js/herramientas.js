/* =============================================================================
 * Mapafiscal — herramientas: sueldo neto por territorio, «¿cuánto neto gano con mi
 * subida?» y ahorro fiscal antes del 31-12 (plan de pensiones y donativos).
 * Motor: irpfsim.js (cotizacionesTrabajador, sueldoNeto, liquidar). Se carga después de
 * app.js, que muestra las vistas (#sueldo-neto, #plan-pensiones) y avisa con el evento
 * «mapafiscal:vista». Las cuentas a mano de cada herramienta están en docs/03.
 * ========================================================================== */
(function () {
  "use strict";
  const H = (typeof window !== "undefined" && window.irpfsim) || (typeof require === "function" ? require("./irpfsim.js") : null);

  // ---- tarjetas de la portada (app.js las junta con las suyas) ------------------------
  const NAVEGADOR = typeof window !== "undefined" && typeof document !== "undefined";
  if (NAVEGADOR) window.MAPAFISCAL_HERRAMIENTAS = Object.assign(window.MAPAFISCAL_HERRAMIENTAS || {}, {
    "sueldo-neto": { titulo: "Sueldo neto por territorio", icono: "nomina", href: "#sueldo-neto",
      texto: "Lo que te queda de tu sueldo bruto tras la Seguridad Social y el IRPF, en los 19 territorios." },
    subida: { titulo: "¿Cuánto neto gano con mi subida?", icono: "calculadora", href: "#sueldo-neto?subida",
      texto: "Cuánto de tu subida llega a tu bolsillo y qué parte se llevan Hacienda y la Seguridad Social." },
    "plan-pensiones": { titulo: "Ahorra en tu IRPF antes del 31 de diciembre", icono: "hucha", href: "#plan-pensiones",
      texto: "Lo que te devuelve aportar a tu plan de pensiones o donar este año, y cuánto conviene aportar." }
  });
  if (NAVEGADOR) document.dispatchEvent(new CustomEvent("mapafiscal:herramientas"));
  if (!H || (NAVEGADOR && !document.getElementById("v-sueldo-neto"))) return;

  // ---- utilidades ----------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur = (n, dec = 2) => {
    const v = Math.abs(n || 0).toFixed(dec).split(".");
    return (n < -0.004 ? "−" : "") + miles(v[0]) + (dec ? "," + v[1] : "") + " €";
  };
  const eur0 = n => eur(n, 0);
  const pct = (n, dec = 1) => (100 * (n || 0)).toFixed(dec).replace(".", ",") + " %";
  const num = id => { const v = parseFloat($(id).value); return Number.isFinite(v) ? Math.max(0, v) : 0; };
  const red2 = n => Math.round((n + 1e-9) * 100) / 100;

  const ORDEN = ["ES-AN", "ES-AR", "ES-AS", "ES-IB", "ES-CN", "ES-CB", "ES-CL", "ES-CM", "ES-CT", "ES-EX", "ES-GA",
    "ES-MD", "ES-MC", "ES-RI", "ES-VC", "ES-PV-VI", "ES-PV-BI", "ES-PV-SS", "ES-NC"];
  const CORTO = { "ES-AN": "Andalucía", "ES-AR": "Aragón", "ES-AS": "Asturias", "ES-IB": "Illes Balears", "ES-CN": "Canarias",
    "ES-CB": "Cantabria", "ES-CL": "Castilla y León", "ES-CM": "Castilla-La Mancha", "ES-CT": "Cataluña", "ES-EX": "Extremadura",
    "ES-GA": "Galicia", "ES-MD": "Madrid", "ES-MC": "Murcia", "ES-RI": "La Rioja", "ES-VC": "C. Valenciana",
    "ES-PV-VI": "Araba/Álava", "ES-PV-BI": "Bizkaia", "ES-PV-SS": "Gipuzkoa", "ES-NC": "Navarra" };

  // ---- datos: params.json (ejercicio por defecto) y params_<año>.json -------------------
  async function datos(idScript, url) {
    const el = document.getElementById(idScript);
    if (el) return JSON.parse(el.textContent);
    // Una sola descarga por fichero aunque lo pidan app.js y herramientas.js: se comparte el
    // texto (no el objeto) para que ninguno vea los cambios que haga el otro en sus datos.
    const cache = window.__mapafiscalJson = window.__mapafiscalJson || {};
    if (!cache[url]) cache[url] = fetch(url, { cache: "no-cache" }).then(r => {
      if (!r.ok) throw new Error("No se pudo cargar " + url);
      return r.text();
    }).catch(e => { delete cache[url]; throw e; });
    return JSON.parse(await cache[url]);
  }
  const PS = {};          // ejercicio -> params
  async function cargarDatos() {
    const P0 = await datos("datos-params", "datos/params.json");
    PS[P0.ejercicio] = P0;
    const otro = P0.ejercicio + 1;      // el año siguiente (2026), si se ha exportado
    try { const P1 = await datos("datos-params-" + otro, "datos/params_" + otro + ".json"); PS[P1.ejercicio] = P1; } catch (e) { /* solo el por defecto */ }
  }
  const ejercicios = () => Object.keys(PS).map(Number).sort();
  // el año en curso, o el más reciente de los disponibles
  const ejercicioActual = () => { const y = new Date().getFullYear(), e = ejercicios(); return e.includes(y) ? y : e[e.length - 1]; };
  const nombre = (P, t) => CORTO[t] || (P.territorios[t] ? P.territorios[t].nombre : t);
  const territorios = (P, filtro) => ORDEN.filter(t => P.territorios[t] && (!filtro || filtro(P.territorios[t])));
  const opcionesTerritorio = (P, sel, valor, filtro) => {
    sel.innerHTML = territorios(P, filtro).map(t => `<option value="${t}">${esc(P.territorios[t].nombre)}${P.territorios[t].regimen !== "comun" && !/foral/i.test(P.territorios[t].nombre) ? " (foral)" : ""}</option>`).join("");
    sel.value = P.territorios[valor] && [...sel.options].some(o => o.value === valor) ? valor : sel.options[0].value;
  };
  // ---- cálculos (también los usa test/herramientas.test.mjs) ----------------------------
  // IRPF del año y neto de una situación: ver irpfsim.sueldoNeto (paridad con R)
  const caso = (P, o) => H.sueldoNeto(o, P);
  function netoPorTerritorio(P, o) {
    return territorios(P).map(t => {
      const s = caso(P, Object.assign({}, o, { territorio: t }));
      return { territorio: t, neto: s.neto, irpf: s.irpf, cotizaciones: s.cotizaciones };
    }).sort((a, b) => b.neto - a.neto);
  }
  function subida(P, o, nuevo) {
    const a = caso(P, o), b = caso(P, Object.assign({}, o, { bruto: nuevo }));
    const dBruto = nuevo - o.bruto, dNeto = red2(b.neto - a.neto);
    return { actual: a, nuevo: b, dBruto, dNeto, dCot: red2(b.cotizaciones - a.cotizaciones), dIrpf: red2(b.irpf - a.irpf),
      tipoMarginal: dBruto > 0 ? 1 - dNeto / dBruto : null };
  }
  // plan de pensiones. En el País Vasco las aportaciones propias tienen su límite de 5.000 €
  // (limite_individual_no_empleo); en Navarra la reducción del art. 55 de su TR del IRPF no
  // está en el motor, así que esta herramienta no la ofrece.
  const planAplicable = P => t => P.territorios[t] && P.territorios[t].regimen !== "foral_navarra";
  function limitePlan(P, o) {
    const reg = P.territorios[o.territorio].regimen, emp = o.contribucionEmpresa || 0;
    // la reducción del motor con una aportación muy alta es el límite efectivo (incluye la empresarial)
    const l = liqPlan(P, o, 1e7).reduccionesBase.previsionSocial || 0;
    let propia = Math.max(0, l - emp);
    if (reg === "foral_pais_vasco") propia = Math.min(propia, P.foral_pv.reduccion_prevision_social.limite_individual_no_empleo);
    return red2(propia);
  }
  function hogarPlan(P, o, aportacion) {
    const cot = H.cotizacionesTrabajador(o.bruto, P, o.tipoContrato);
    const ps = (aportacion > 0 || o.contribucionEmpresa > 0) ? { aportacionIndividual: aportacion, contribucionEmpresarial: o.contribucionEmpresa || 0 } : null;
    return { territorio: o.territorio, ejercicio: P.ejercicio, tipoUnidadFamiliar: (o.hijos || []).length ? "monoparental" : "ninguna", familiaNumerosa: "no",
      miembros: [{ id: "d1", rol: "declarante", edad: o.edad || 40, trabajo: o.bruto > 0 ? { dinerarias: o.bruto, cotizacionesSs: cot } : null,
        previsionSocial: ps, donativos: o.donativos || 0, donativosRecurrentes: !!o.donativosRecurrentes }]
        .concat((o.hijos || []).map((e, i) => ({ id: "h" + (i + 1), rol: "descendiente", edad: e, rentasPropias: 0, nacidoEnEjercicio: e === 0 }))) };
  }
  const liqPlan = (P, o, aportacion) => H.liquidar(hogarPlan(P, o, aportacion), P, "auto");
  function plan(P, o) {
    const limite = limitePlan(P, o);
    const irpf = a => H.irpfAnual(liqPlan(P, o, Math.min(a, limite)));
    const sin = irpf(0), aport = Math.min(o.aportacion, limite);
    const ahorro = red2(sin - irpf(aport));
    const ahorroMax = red2(sin - irpf(limite));
    // la menor aportación que ya da el ahorro máximo (el ahorro crece con la aportación)
    let lo = 0, hi = limite;
    if (ahorroMax > 0.5) {
      for (let k = 0; k < 40 && hi - lo > 1; k++) { const m = (lo + hi) / 2; if (sin - irpf(m) >= ahorroMax - 0.5) hi = m; else lo = m; }
    }
    const optima = ahorroMax > 0.5 ? Math.ceil(hi / 10) * 10 : 0;
    return { limite, aportacionComputable: aport, exceso: red2(Math.max(0, o.aportacion - limite)), irpfSin: sin, irpfCon: red2(sin - ahorro),
      ahorro, ahorroMax, optima: Math.min(optima, limite), porEuro: aport > 0 ? ahorro / aport : 0 };
  }
  function planPorTerritorio(P, o) {
    return territorios(P, (x) => x.regimen !== "foral_navarra").map(t => {
      const r = plan(P, Object.assign({}, o, { territorio: t }));
      return { territorio: t, ahorro: r.ahorro, ahorroMax: r.ahorroMax, optima: r.optima };
    }).sort((a, b) => b.ahorro - a.ahorro || b.ahorroMax - a.ahorroMax);
  }
  // donativos (deducción estatal de la Ley 49/2002, territorios de régimen común)
  function donativos(P, o) {
    const sin = H.liquidar(hogarPlan(P, Object.assign({}, o, { donativos: 0 }), 0), P, "auto");
    const con = H.liquidar(hogarPlan(P, o, 0), P, "auto");
    const d = P.estatal.deduccion_donativos.ley49_2002;
    const baseMax = red2((sin.baseLiquidableGeneral + sin.baseLiquidableAhorro) * d.limite_base_liquidable_pct);
    const ahorro = red2(H.irpfAnual(sin) - H.irpfAnual(con));
    return { ahorro, coste: red2(o.donativos - ahorro), deduccion: (con.deduccionesEstatales && con.deduccionesEstatales.detalle.donativos) || 0,
      baseMax, irpfSin: H.irpfAnual(sin), irpfCon: H.irpfAnual(con) };
  }
  function donativosPorTerritorio(P, o) {
    return territorios(P, x => x.regimen === "comun").map(t => {
      const r = donativos(P, Object.assign({}, o, { territorio: t }));
      return { territorio: t, ahorro: r.ahorro, coste: r.coste };
    }).sort((a, b) => b.ahorro - a.ahorro);
  }
  const CALCULOS = { netoPorTerritorio, subida, plan, limitePlan, planPorTerritorio, donativos, donativosPorTerritorio };
  if (typeof module !== "undefined" && module.exports) { module.exports = CALCULOS; return; }
  window.MapafiscalHerramientas = CALCULOS;


  // nota discreta del ejercicio: qué normativa se aplica
  function notaEjercicio(P) {
    const ct = P.estatal.cotizaciones_trabajador;
    const ord = ct ? ct.norma.split(":")[0].replace(/, de cotización para \d{4}/, "") : "";
    return `Ejercicio ${P.ejercicio}: normativa del IRPF estatal, autonómica y foral de ${P.ejercicio}` +
      (P.ejercicio > 2025 ? " (en cada comunidad, la tarifa y las deducciones vigentes; si no ha aprobado cambios, las del año anterior)" : "") +
      `. Cotizaciones del trabajador: ${ord}.`;
  }

  // ---- hijos: número y edades (formularios de las dos vistas) ---------------------------
  function hijosWidget(selId, contId, edadesIniciales) {
    let edades = edadesIniciales.slice();
    const pintar = () => {
      const n = parseInt($(selId).value, 10) || 0;
      while (edades.length < n) edades.push(edades.length ? Math.min(25, edades[edades.length - 1] + 3) : 4);
      edades = edades.slice(0, n);
      $(contId).innerHTML = edades.map((e, i) => `<label>Edad del hijo ${i + 1} <input type="number" min="0" max="30" step="1" value="${e}" data-edad="${i}" aria-label="Edad del hijo ${i + 1}"></label>`).join("");
      $(contId).hidden = n === 0;
    };
    $(contId).addEventListener("input", e => {
      const i = e.target.dataset.edad;
      if (i != null) edades[+i] = Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0));
    });
    $(selId).addEventListener("change", pintar);
    pintar();
    return () => edades.slice();
  }

  // ---- pintado común ------------------------------------------------------------------
  const fila = (concepto, importe, cls = "") => `<tr class="${cls}"><td>${concepto}</td><td class="cas"></td><td class="imp">${importe}</td></tr>`;
  const barra = (v, max) => `<span class="hr-barra"><i style="width:${max > 0 ? Math.max(2, Math.round(100 * v / max)) : 0}%"></i></span>`;
  // barra de reparto como la del resultado de la calculadora (.barra-reparto + leyenda).
  // partes: [{ n: nombre, v: importe, c: clase de .barra-reparto, color: variable CSS }]
  function reparto(titulo, derecha, partes) {
    const tot = partes.reduce((s, p) => s + Math.max(0, p.v), 0) || 1;
    return `<div><div class="grafico-tit"><span>${titulo}</span><span>${derecha.replace(/ %/g, "&nbsp;%")}</span></div>
      <div class="barra-reparto" role="img" aria-label="${esc(partes.map(p => `${p.n}: ${eur0(p.v)}`).join(", "))}">${partes.filter(p => p.v > 0)
        .map(p => `<i class="${p.c}" style="flex-grow:${(p.v / tot).toFixed(4)}"></i>`).join("")}</div>
      <ul class="leyenda-reparto">${partes.map(p => `<li><i style="background:var(${p.color})"></i>${esc(p.n)} <b>${eur0(Math.max(0, p.v))}</b></li>`).join("")}</ul></div>`;
  }
  // cabecera de la tarjeta de resultado: chip del territorio y color del borde
  function cabecera(pre, P, terr, estado) {
    $(pre + "-chip").textContent = `${nombre(P, terr)} · ${P.ejercicio}`;
    $(pre + "-tarjeta").className = "tarjeta tarjeta-resultado" + (estado ? " " + estado : "");
  }
  const PARA_TI = { c: "neto", color: "--g-neto" }, IRPF = { c: "irpf", color: "--g-irpf" }, SS = { c: "ss", color: "--g-ss" };

  // ---- vista #sueldo-neto ---------------------------------------------------------------
  let modoNeto = /[?&]subida\b/.test(location.hash) ? "subida" : "neto";
  let edadesNeto;
  const P_neto = () => PS[+$("neto-ejercicio").value] || PS[ejercicioActual()];
  const datosNeto = () => ({ bruto: num("neto-bruto"), territorio: $("neto-territorio").value, edad: num("neto-edad") || 35,
    hijos: edadesNeto(), tipoContrato: $("neto-contrato").value });

  function pintarNeto() {
    const P = P_neto(), o = datosNeto(), terr = o.territorio;
    const enSubida = modoNeto === "subida";
    $("neto-campo-nuevo").hidden = !enSubida;
    $("neto-lbl-bruto").textContent = enSubida ? "Sueldo bruto anual actual" : "Sueldo bruto anual";
    document.querySelectorAll('input[name="neto-modo"]').forEach(r => { r.checked = r.value === modoNeto; });
    let s;
    try { s = caso(P, o); } catch (e) { $("neto-principal").innerHTML = `<p class="vacio">Revisa los datos introducidos.</p>`; $("neto-graficos").innerHTML = ""; return; }
    cabecera("neto", P, terr, enSubida ? "gana" : "");
    $("neto-nota").textContent = notaEjercicio(P) + " Tributación individual o conjunta, la más favorable. Sin otras rentas ni deducciones por gastos: para tu caso completo, usa la calculadora.";
    if (enSubida) return pintarSubida(P, o);

    const liq = s.liquidacion, ct = H.cotizacionesTrabajadorDetalle(o.bruto, P, o.tipoContrato);
    const efectivo = o.bruto > 0 ? (s.cotizaciones + s.irpf) / o.bruto : 0;
    $("neto-principal").innerHTML = `<div class="res-etq">Neto anual tras la declaración · ${esc(nombre(P, terr))} · ${P.ejercicio}</div>
      <div class="res-cifra">${eur0(s.neto)}</div>
      <p class="res-sub">No es la retención de la nómina: es lo que te queda una vez hecha la declaración de la renta.</p>
      <dl class="kpis"><div><dt>Al mes, en 12 pagas</dt><dd>${eur0(s.neto / 12)}</dd></div><div><dt>Al mes, en 14 pagas</dt><dd>${eur0(s.neto / 14)}</dd></div>
      <div><dt>Seguridad Social + IRPF</dt><dd>${pct(efectivo)}</dd></div></dl>`;
    $("neto-graficos").innerHTML = o.bruto > 0 ? reparto(`De tus ${eur0(o.bruto)} brutos`, `te quedan el ${(100 * s.neto / o.bruto).toFixed(0)} %`, [
      Object.assign({ n: "Para ti", v: s.neto }, PARA_TI), Object.assign({ n: "IRPF", v: s.irpf }, IRPF),
      Object.assign({ n: "Seguridad Social", v: s.cotizaciones }, SS)]) : "";
    const t = P.estatal.cotizaciones_trabajador.tipos, desemp = o.tipoContrato === "temporal" ? t.desempleo_temporal : t.desempleo_indefinido;
    const drt = (liq.deduccionRendimientosTrabajo && liq.deduccionRendimientosTrabajo.total) || 0;
    const impr = (liq.deduccionesCuotaDiferencial && liq.deduccionesCuotaDiferencial.total) || 0;
    const filas = [fila("Sueldo bruto anual", eur(o.bruto)),
      fila(`Contingencias comunes (${pct(t.contingencias_comunes, 2)})`, "−" + eur(ct.contingenciasComunes), "hr-resta"),
      fila(`Desempleo (${pct(desemp, 2)})`, "−" + eur(ct.desempleo), "hr-resta"),
      fila(`Formación profesional (${pct(t.formacion_profesional, 2)})`, "−" + eur(ct.formacionProfesional), "hr-resta"),
      fila(`Mecanismo de equidad intergeneracional (${pct(t.mei, 2)})`, "−" + eur(ct.mei), "hr-resta")];
    if (ct.solidaridad > 0) filas.push(fila("Cotización adicional de solidaridad (sueldo por encima de la base máxima)", "−" + eur(ct.solidaridad), "hr-resta"));
    filas.push(fila(`Cotizaciones a la Seguridad Social${ct.baseMensual < o.bruto / 12 - 0.005 ? ` · base máxima ${eur(P.estatal.cotizaciones_trabajador.base_maxima_mensual)}/mes` : ""}`, "−" + eur(s.cotizaciones), "sub"));
    filas.push(fila("Cuota líquida del IRPF", eur(liq.cuotaLiquidaTotal)));
    if (drt) filas.push(fila("Deducción por obtención de rendimientos del trabajo", "−" + eur(drt), "hr-resta"));
    if (impr) filas.push(fila("Deducciones por maternidad, familia numerosa o discapacidad", "−" + eur(impr), "hr-resta"));
    filas.push(fila(`IRPF del año (${pct(o.bruto > 0 ? s.irpf / o.bruto : 0)} del bruto)`, "−" + eur(s.irpf), "sub"));
    filas.push(fila("Sueldo neto anual", eur(s.neto), "total"));
    $("neto-desglose").innerHTML = filas.join("");

    const lista = netoPorTerritorio(P, o), yo = lista.find(x => x.territorio === terr);
    const min = lista[lista.length - 1].neto, max = lista[0].neto;
    $("neto-t-ranking").textContent = `Neto anual en los ${lista.length} territorios, de más a menos`;
    $("neto-ranking").innerHTML = `<thead><tr><th>#</th><th>Territorio</th><th class="num">Neto anual</th><th class="num ocultable">Al mes (14)</th><th class="num">Diferencia</th></tr></thead><tbody>` +
      lista.map((x, i) => {
        const d = x.neto - yo.neto, tu = x.territorio === terr;
        return `<tr class="${tu ? "tu" : ""}" data-t="${x.territorio}"><td class="pos">${i + 1}</td><td>${esc(nombre(P, x.territorio))}${P.territorios[x.territorio].regimen !== "comun" ? '<span class="regimen">foral</span>' : ""}${barra(x.neto - min, max - min)}</td>
          <td class="num">${eur0(x.neto)}</td><td class="num ocultable">${eur0(x.neto / 14)}</td>
          <td class="num dif ${d > 0.5 ? "gana" : d < -0.5 ? "pierde" : ""}">${tu ? "—" : Math.abs(d) < 0.5 ? "igual" : (d > 0 ? "+" : "−") + eur0(Math.abs(d))}</td></tr>`;
      }).join("") + "</tbody>";
  }

  function pintarSubida(P, o) {
    const nuevo = num("neto-nuevo"), r = subida(P, o, nuevo), terr = o.territorio;
    if (!(r.dBruto > 0)) {
      $("neto-principal").innerHTML = `<div class="res-etq">¿Cuánto neto gano con mi subida?</div><p class="vacio">Pon un sueldo nuevo mayor que el actual.</p>`;
      $("neto-desglose").innerHTML = ""; $("neto-ranking").innerHTML = ""; $("neto-graficos").innerHTML = ""; return;
    }
    $("neto-graficos").innerHTML = reparto(`De tu subida de ${eur0(r.dBruto)} brutos`, `te quedan el ${(100 * r.dNeto / r.dBruto).toFixed(0)} %`, [
      Object.assign({ n: "Para ti", v: r.dNeto }, PARA_TI), Object.assign({ n: "IRPF", v: r.dIrpf }, IRPF),
      Object.assign({ n: "Seguridad Social", v: r.dCot }, SS)]);
    const quedan = 100 * r.dNeto / r.dBruto;
    $("neto-principal").innerHTML = `<div class="res-etq">Con la subida ganas al año, en neto · ${esc(nombre(P, terr))} · ${P.ejercicio}</div>
      <div class="res-cifra gana">+${eur0(r.dNeto)}</div>
      <p class="res-sub">De cada 100 € brutos de subida te quedan <b>${quedan.toFixed(0)} €</b>. Neto anual tras la declaración (no es la retención de la nómina).</p>
      <dl class="kpis"><div><dt>Tipo marginal efectivo de la subida</dt><dd>${pct(r.tipoMarginal)}</dd></div>
      <div><dt>Al mes, en 12 pagas</dt><dd>+${eur0(r.dNeto / 12)}</dd></div><div><dt>Al mes, en 14 pagas</dt><dd>+${eur0(r.dNeto / 14)}</dd></div></dl>`;
    const f3 = (c, a, b, d, cls = "") => `<tr class="${cls}"><td>${c}</td><td class="imp">${a}</td><td class="imp">${b}</td><td class="imp">${d}</td></tr>`;
    const sg = v => (v > 0.004 ? "+" : v < -0.004 ? "−" : "") + eur(Math.abs(v));
    $("neto-desglose").innerHTML = `<thead><tr><th></th><th class="imp">Ahora</th><th class="imp">Con la subida</th><th class="imp">Diferencia</th></tr></thead>` +
      f3("Sueldo bruto", eur0(o.bruto), eur0(nuevo), sg(r.dBruto)) +
      f3("Seguridad Social", "−" + eur0(r.actual.cotizaciones), "−" + eur0(r.nuevo.cotizaciones), sg(-r.dCot), "hr-resta") +
      f3("IRPF del año", "−" + eur0(r.actual.irpf), "−" + eur0(r.nuevo.irpf), sg(-r.dIrpf), "hr-resta") +
      f3("Sueldo neto anual", eur0(r.actual.neto), eur0(r.nuevo.neto), sg(r.dNeto), "total") +
      f3("Neto al mes (14 pagas)", eur0(r.actual.neto / 14), eur0(r.nuevo.neto / 14), sg(r.dNeto / 14));
    const lista = territorios(P).map(t => {
      const x = subida(P, Object.assign({}, o, { territorio: t }), nuevo);
      return { territorio: t, dNeto: x.dNeto, tm: x.tipoMarginal };
    }).sort((a, b) => b.dNeto - a.dNeto);
    const yo = lista.find(x => x.territorio === terr), min = lista[lista.length - 1].dNeto, max = lista[0].dNeto;
    $("neto-t-ranking").textContent = "Lo que ganas en neto con la subida, por territorio";
    $("neto-ranking").innerHTML = `<thead><tr><th>#</th><th>Territorio</th><th class="num">Neto ganado</th><th class="num ocultable">Tipo marginal</th><th class="num">Diferencia</th></tr></thead><tbody>` +
      lista.map((x, i) => {
        const d = x.dNeto - yo.dNeto, tu = x.territorio === terr;
        return `<tr class="${tu ? "tu" : ""}" data-t="${x.territorio}"><td class="pos">${i + 1}</td><td>${esc(nombre(P, x.territorio))}${barra(x.dNeto - min, max - min)}</td>
          <td class="num">+${eur0(x.dNeto)}</td><td class="num ocultable">${pct(x.tm)}</td>
          <td class="num dif ${d > 0.5 ? "gana" : d < -0.5 ? "pierde" : ""}">${tu ? "—" : Math.abs(d) < 0.5 ? "igual" : (d > 0 ? "+" : "−") + eur0(Math.abs(d))}</td></tr>`;
      }).join("") + "</tbody>";
  }

  // ---- vista #plan-pensiones -----------------------------------------------------------
  let modoPp = "plan";
  let edadesPp;
  const P_pp = () => PS[ejercicioActual()];
  const datosPp = () => ({ bruto: num("pp-bruto"), territorio: $("pp-territorio").value, edad: num("pp-edad") || 45, hijos: edadesPp(),
    aportacion: num("pp-aportacion"), contribucionEmpresa: num("pp-empresa"), donativos: num("pp-donativo"), donativosRecurrentes: $("pp-recurrente").checked });

  function pintarPp() {
    const P = P_pp();
    $("pp-bloque-plan").hidden = modoPp !== "plan";
    $("pp-bloque-donativos").hidden = modoPp !== "donativos";
    // territorios donde se puede calcular cada herramienta
    const filtro = modoPp === "plan" ? (x => x.regimen !== "foral_navarra") : (x => x.regimen === "comun");
    const antes = $("pp-territorio").value || "ES-MD";
    opcionesTerritorio(P, $("pp-territorio"), antes, filtro);
    const o = datosPp();
    try { if (modoPp === "plan") pintarPlan(P, o); else pintarDonativos(P, o); }
    catch (e) { $("pp-principal").innerHTML = `<p class="vacio">Revisa los datos introducidos.</p>`; $("pp-graficos").innerHTML = ""; }
  }

  function pintarPlan(P, o) {
    const r = plan(P, o), terr = o.territorio, reg = P.territorios[terr].regimen;
    const anio = P.ejercicio;
    $("pp-principal").innerHTML = `<div class="res-etq">Ahorro en el IRPF de ${anio} · ${esc(nombre(P, terr))}</div>
      <div class="res-cifra ${r.ahorro > 0.5 ? "gana" : ""}">${eur0(r.ahorro)}</div>
      <p class="res-sub">${o.aportacion > 0 ? `Por aportar ${eur0(o.aportacion)} antes del 31 de diciembre${r.porEuro > 0 ? `: te devuelven ${(100 * r.porEuro).toFixed(0)} céntimos por cada euro` : ""}.` : "Indica cuánto piensas aportar."}
        ${r.exceso > 0.5 ? ` ${eur0(r.exceso)} superan tu límite y no reducen el IRPF de este año.` : ""}</p>
      <dl class="kpis"><div><dt>Tu límite este año</dt><dd>${eur0(r.limite)}</dd></div>
      <div><dt>Aportación que más ahorra</dt><dd>${eur0(r.optima)}</dd></div><div><dt>Ahorro máximo</dt><dd>${eur0(r.ahorroMax)}</dd></div></dl>`;
    cabecera("pp", P, terr, r.ahorro > 0.5 ? "gana" : "");
    const ap = r.aportacionComputable;
    $("pp-graficos").innerHTML = (ap > 0 ? reparto(`De tu aportación de ${eur0(ap)}`, `Hacienda pone el ${(100 * r.ahorro / ap).toFixed(0)} %`, [
      { n: "Te devuelve Hacienda", v: r.ahorro, c: "sobra", color: "--gana" }, Object.assign({ n: "Pones tú", v: Math.max(0, ap - r.ahorro) }, PARA_TI)]) : "") +
      (r.limite > 0 ? reparto(`Tu límite de ${eur0(r.limite)}`, ap >= r.limite - 0.5 ? "lo agotas" : `te quedan ${eur0(r.limite - ap)}`, [
        Object.assign({ n: "Aportas", v: ap }, IRPF), Object.assign({ n: "Margen hasta el límite", v: Math.max(0, r.limite - ap) }, PARA_TI)]) : "");
    const rs = P.estatal.reduccion_prevision_social, ct = H.cotizacionesTrabajador(o.bruto, P);
    const filas = [];
    if (reg === "comun") {
      const rend = Math.max(0, o.bruto + o.contribucionEmpresa - ct - P.estatal.trabajo_otros_gastos.generico);
      filas.push(fila(`30 % de tu rendimiento neto del trabajo (${eur0(rend)})`, eur(rs.limite_general_pct_rend * rend)));
      filas.push(fila(`Límite de aportaciones propias: ${eur0(rs.limite_general_abs)}${o.contribucionEmpresa > 0 ? ` + aportación de la empresa (hasta ${eur0(rs.incremento_contribucion_empresarial)})` : ""}`,
        eur(rs.limite_general_abs + Math.min(rs.incremento_contribucion_empresarial, o.contribucionEmpresa))));
      if (o.contribucionEmpresa > 0) filas.push(fila("Menos lo que aporta tu empresa", "−" + eur(o.contribucionEmpresa), "hr-resta"));
    } else {
      const pv = P.foral_pv.reduccion_prevision_social;
      filas.push(fila(`Aportaciones propias: hasta ${eur0(pv.limite_individual_no_empleo)} (normativa foral del País Vasco)`, eur(pv.limite_individual_no_empleo)));
    }
    filas.push(fila("Límite de tus aportaciones este año", eur(r.limite), "sub"));
    filas.push(fila("IRPF del año sin aportar", eur(r.irpfSin)));
    filas.push(fila(`IRPF del año aportando ${eur0(r.aportacionComputable)}`, eur(r.irpfCon)));
    filas.push(fila("Ahorro fiscal", eur(r.ahorro), "total"));
    $("pp-desglose").innerHTML = filas.join("");

    const lista = planPorTerritorio(P, o), max = Math.max(...lista.map(x => x.ahorro), 1);
    $("pp-t-ranking").textContent = `Ahorro por aportar ${eur0(o.aportacion)}, por territorio`;
    $("pp-ranking").innerHTML = `<thead><tr><th>#</th><th>Territorio</th><th class="num">Ahorro</th><th class="num ocultable">Ahorro máximo</th><th class="num">Mejor aportación</th></tr></thead><tbody>` +
      lista.map((x, i) => `<tr class="${x.territorio === terr ? "tu" : ""}" data-t="${x.territorio}"><td class="pos">${i + 1}</td><td>${esc(nombre(P, x.territorio))}${P.territorios[x.territorio].regimen !== "comun" ? '<span class="regimen">foral</span>' : ""}${barra(x.ahorro, max)}</td>
        <td class="num">${eur0(x.ahorro)}</td><td class="num ocultable">${eur0(x.ahorroMax)}</td><td class="num">${eur0(x.optima)}</td></tr>`).join("") + "</tbody>";
    $("pp-nota").textContent = `${notaEjercicio(P)} Cuenta lo aportado hasta el 31 de diciembre de ${anio}. La reducción aplaza el impuesto: al rescatar el plan, lo cobrado tributa como rendimiento del trabajo. ` +
      "Límites del art. 52 LIRPF (1.500 € más hasta 8.500 € de contribuciones empresariales, y el 30 % de los rendimientos netos del trabajo); en el País Vasco, los de su norma foral. Navarra tiene límites propios (art. 55 de su TR del IRPF) y no se incluye.";
  }

  function pintarDonativos(P, o) {
    const r = donativos(P, o), terr = o.territorio, d = P.estatal.deduccion_donativos.ley49_2002;
    $("pp-principal").innerHTML = `<div class="res-etq">Ahorro en el IRPF de ${P.ejercicio} por tus donativos · ${esc(nombre(P, terr))}</div>
      <div class="res-cifra ${r.ahorro > 0.5 ? "gana" : ""}">${eur0(r.ahorro)}</div>
      <p class="res-sub">${o.donativos > 0 ? `Donar ${eur0(o.donativos)} te cuesta en realidad <b>${eur0(r.coste)}</b>.` : "Indica cuánto piensas donar."}
        Los primeros ${eur0(d.tramo1_limite)} deducen el ${pct(d.tramo1_porcentaje, 0)}: donar ${eur0(d.tramo1_limite)} te cuesta ${eur0(d.tramo1_limite * (1 - d.tramo1_porcentaje))}.</p>
      <dl class="kpis"><div><dt>Primeros ${eur0(d.tramo1_limite)}</dt><dd>${pct(d.tramo1_porcentaje, 0)}</dd></div>
      <div><dt>Resto</dt><dd>${pct(o.donativosRecurrentes ? d.resto_porcentaje_recurrente : d.resto_porcentaje, 0)}</dd></div>
      <div><dt>Donativo máximo con deducción</dt><dd>${eur0(r.baseMax)}</dd></div></dl>`;
    cabecera("pp", P, terr, r.ahorro > 0.5 ? "gana" : "");
    $("pp-graficos").innerHTML = o.donativos > 0 ? reparto(`De tu donativo de ${eur0(o.donativos)}`, `Hacienda pone el ${(100 * r.ahorro / o.donativos).toFixed(0)} %`, [
      { n: "Te devuelve Hacienda", v: r.ahorro, c: "sobra", color: "--gana" }, Object.assign({ n: "Pones tú", v: Math.max(0, r.coste) }, PARA_TI)]) : "";
    const base = Math.min(o.donativos, r.baseMax), resto = Math.max(0, base - d.tramo1_limite);
    const rp = o.donativosRecurrentes ? d.resto_porcentaje_recurrente : d.resto_porcentaje;
    const filas = [fila(`${pct(d.tramo1_porcentaje, 0)} de los primeros ${eur0(Math.min(base, d.tramo1_limite))}`, eur(Math.min(base, d.tramo1_limite) * d.tramo1_porcentaje))];
    if (resto > 0) filas.push(fila(`${pct(rp, 0)} del resto (${eur0(resto)})${o.donativosRecurrentes ? ", por donar 3 años seguidos a la misma entidad" : ""}`, eur(resto * rp)));
    if (o.donativos > r.baseMax + 0.5) filas.push(fila(`Lo que pasa del 10 % de tu base liquidable no deduce (${eur0(o.donativos - r.baseMax)})`, "—", "info"));
    filas.push(fila("Deducción por donativos", eur(r.deduccion), "sub"));
    filas.push(fila("IRPF del año sin donar", eur(r.irpfSin)));
    filas.push(fila("IRPF del año con tus donativos", eur(r.irpfCon)));
    filas.push(fila("Ahorro fiscal", eur(r.ahorro), "total"));
    $("pp-desglose").innerHTML = filas.join("");
    const lista = donativosPorTerritorio(P, o), max = Math.max(...lista.map(x => x.ahorro), 1);
    $("pp-t-ranking").textContent = `Ahorro por donar ${eur0(o.donativos)}, por territorio`;
    $("pp-ranking").innerHTML = `<thead><tr><th>#</th><th>Territorio</th><th class="num">Ahorro</th><th class="num">Te cuesta</th></tr></thead><tbody>` +
      lista.map((x, i) => `<tr class="${x.territorio === terr ? "tu" : ""}" data-t="${x.territorio}"><td class="pos">${i + 1}</td><td>${esc(nombre(P, x.territorio))}${barra(x.ahorro, max)}</td>
        <td class="num">${eur0(x.ahorro)}</td><td class="num">${eur0(x.coste)}</td></tr>`).join("") + "</tbody>";
    $("pp-nota").textContent = `${notaEjercicio(P)} Deducción estatal por donativos a entidades de la Ley 49/2002 (art. 68.3 LIRPF y art. 19 de la Ley 49/2002), en los territorios de régimen común; el País Vasco y Navarra la regulan en su normativa foral. ` +
      `Cuentan los donativos hechos hasta el 31 de diciembre de ${P.ejercicio} con certificado de la entidad. Si la cuota no da para toda la deducción, el ahorro es menor.`;
  }

  // ---- arranque ------------------------------------------------------------------------
  const visible = id => { const s = $(id); return s && !s.hidden; };
  function pintarSiVisible() {
    if (visible("v-sueldo-neto")) pintarNeto();
    if (visible("v-plan-pensiones")) pintarPp();
  }
  // un enlace a #sueldo-neto?subida abre directamente la pestaña de la subida (antes de que
  // app.js cambie de vista, que quita el «?subida» del hash)
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest('a[href^="#sueldo-neto"]');
    if (a) modoNeto = /[?&]subida\b/.test(a.getAttribute("href")) ? "subida" : modoNeto;
  }, true);
  window.addEventListener("hashchange", () => { if (/^#sueldo-neto[?&]subida\b/.test(location.hash)) modoNeto = "subida"; });

  cargarDatos().then(() => {
    const P = PS[ejercicioActual()];
    $("neto-ejercicio").innerHTML = ejercicios().map(y => `<option value="${y}">${y}</option>`).join("");
    $("neto-ejercicio").value = String(ejercicioActual());
    opcionesTerritorio(P, $("neto-territorio"), "ES-MD");
    opcionesTerritorio(P, $("pp-territorio"), "ES-MD", x => x.regimen !== "foral_navarra");
    edadesNeto = hijosWidget("neto-hijos", "neto-edades", [4, 7, 10, 13, 16]);
    edadesPp = hijosWidget("pp-hijos", "pp-edades", [4, 7, 10, 13]);
    let t1, t2;
    $("neto-form").addEventListener("input", () => { clearTimeout(t1); t1 = setTimeout(pintarNeto, 120); });
    $("neto-form").addEventListener("change", pintarNeto);
    $("pp-form").addEventListener("input", () => { clearTimeout(t2); t2 = setTimeout(pintarPp, 120); });
    $("pp-form").addEventListener("change", pintarPp);
    document.querySelectorAll('input[name="neto-modo"]').forEach(r => r.addEventListener("change", () => { modoNeto = r.value; pintarNeto(); }));
    document.querySelectorAll('input[name="pp-modo"]').forEach(r => r.addEventListener("change", () => { modoPp = r.value; pintarPp(); }));
    // pulsar un territorio de una tabla lo elige
    $("neto-ranking").addEventListener("click", e => { const tr = e.target.closest("tr[data-t]"); if (tr) { $("neto-territorio").value = tr.dataset.t; pintarNeto(); } });
    $("pp-ranking").addEventListener("click", e => { const tr = e.target.closest("tr[data-t]"); if (tr) { $("pp-territorio").value = tr.dataset.t; pintarPp(); } });
    // las herramientas se abren ya calculadas con el territorio que la persona haya elegido en la
    // calculadora o en la portada (si no ha elegido otro aquí); si no, con Madrid
    const tocado = {};
    ["neto-territorio", "pp-territorio"].forEach(id => $(id).addEventListener("change", () => { tocado[id] = true; }));
    const terrElegido = () => ["f-territorio", "mc-territorio"].map(id => $(id) && $(id).value)
      .find(t => t && t !== "ES-MD" && P.territorios[t]) || null;
    const sincronizar = id => {
      const t = terrElegido(), sel = $(id);
      if (!tocado[id] && t && [...(sel.options || [])].some(x => x.value === t)) sel.value = t;
    };
    document.addEventListener("mapafiscal:vista", e => {
      const v = e.detail && e.detail.vista;
      if (v === "sueldo-neto") { sincronizar("neto-territorio"); pintarNeto(); }
      if (v === "plan-pensiones") { sincronizar("pp-territorio"); pintarPp(); }
    });
    pintarSiVisible();
  }).catch(() => { /* app.js ya avisa si no hay datos */ });
})();
