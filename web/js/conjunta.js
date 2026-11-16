/* =============================================================================
 * Mapafiscal — «¿Declaración conjunta o individual?» (#conjunta) y «Dos pagadores:
 * ¿me sale a pagar?» (#dos-pagadores).
 * Motor: irpfsim.js (liquidar, que ya compara la conjunta con las individuales, y la
 * obligación de declarar del art. 96 LIRPF). Se carga después de app.js, que muestra las
 * vistas y avisa con «mapafiscal:vista». Los cálculos se exportan para Node: los usan
 * test/conjunta.test.mjs y las páginas estáticas de tools/seo_conjunta.mjs.
 * ========================================================================== */
(function () {
  "use strict";
  const H = (typeof window !== "undefined" && window.irpfsim) || (typeof require === "function" ? require("./irpfsim.js") : null);
  const NAVEGADOR = typeof window !== "undefined" && typeof document !== "undefined";
  if (NAVEGADOR) window.MAPAFISCAL_HERRAMIENTAS = Object.assign(window.MAPAFISCAL_HERRAMIENTAS || {}, {
    conjunta: { titulo: "¿Declaración conjunta o individual?", icono: "calculadora", href: "#conjunta",
      texto: "Tu pareja y tus hijos: qué modalidad os sale mejor, cuánto ahorráis y por qué, en los 19 territorios." },
    "dos-pagadores": { titulo: "Dos pagadores: ¿me sale a pagar?", icono: "nomina", href: "#dos-pagadores",
      texto: "Si has tenido dos empresas: si estás obligado a declarar y cuánto te tocará pagar o te devolverán." }
  });
  if (NAVEGADOR) document.dispatchEvent(new CustomEvent("mapafiscal:herramientas"));
  if (!H || (NAVEGADOR && !document.getElementById("v-conjunta"))) return;

  const red2 = n => Math.round((n + 1e-9) * 100) / 100;
  const ORDEN = ["ES-AN", "ES-AR", "ES-AS", "ES-IB", "ES-CN", "ES-CB", "ES-CL", "ES-CM", "ES-CT", "ES-EX", "ES-GA",
    "ES-MD", "ES-MC", "ES-RI", "ES-VC", "ES-PV-VI", "ES-PV-BI", "ES-PV-SS", "ES-NC"];
  const territorios = P => ORDEN.filter(t => P.territorios[t]);
  const cuota = liq => liq.cuotaResultanteAutoliquidacion;

  // ---- ¿conjunta o individual? -------------------------------------------------------
  // o: { territorio, tipo: "matrimonio" | "monoparental" | "pareja-hecho",
  //      a: { bruto, edad, contrato }, b: { bruto, edad, contrato }, hijos: [edades] }
  function adulto(P, id, rol, x) {
    const bruto = Math.max(0, +x.bruto || 0);
    return { id, rol, edad: x.edad || 40, discapacidad: "no",
      trabajo: bruto > 0 ? { dinerarias: bruto, cotizacionesSs: H.cotizacionesTrabajador(bruto, P, x.contrato || "indefinido") } : null };
  }
  function hogarPareja(P, o) {
    const mono = o.tipo === "monoparental";
    const miembros = [adulto(P, "d1", "declarante", o.a)];
    if (!mono) miembros.push(adulto(P, "d2", "conyuge", o.b));
    (o.hijos || []).forEach((e, i) => miembros.push({ id: "h" + (i + 1), rol: "descendiente", edad: e, rentasPropias: 0, nacidoEnEjercicio: e === 0 }));
    // pareja de hecho: no hay unidad familiar con los dos (art. 82 LIRPF), solo individual
    const tipo = o.tipo === "matrimonio" ? "biparental" : mono ? ((o.hijos || []).length ? "monoparental" : "ninguna") : "ninguna";
    return { territorio: o.territorio, ejercicio: P.ejercicio, tipoUnidadFamiliar: tipo, familiaNumerosa: (o.hijos || []).length >= 3 ? "general" : "no", miembros };
  }
  function conjunta(P, o) {
    const hogar = hogarPareja(P, o);
    const ind = H.liquidar(hogar, P, "individual");
    const puede = hogar.tipoUnidadFamiliar !== "ninguna";
    const conj = puede ? H.liquidar(hogar, P, "conjunta") : null;
    // cuota individual de cada uno: la del otro sin rentas es 0 (en individual cada uno
    // se liquida con sus rentas; los mínimos por hijos se reparten igual)
    let porPersona = [cuota(ind)];
    if (o.tipo !== "monoparental") {
      const soloA = cuota(H.liquidar(hogarPareja(P, Object.assign({}, o, { b: Object.assign({}, o.b, { bruto: 0 }) })), P, "individual"));
      porPersona = [soloA, red2(cuota(ind) - soloA)];
    }
    const cInd = cuota(ind), cConj = conj ? cuota(conj) : null;
    const mejor = conj && cConj < cInd ? "conjunta" : "individual";
    return { hogar, ind, conj, cuotaIndividual: cInd, cuotaConjunta: cConj, porPersona, mejor,
      ahorro: conj ? red2(Math.abs(cInd - cConj)) : 0, regimen: P.territorios[o.territorio].regimen };
  }
  // sueldo del segundo a partir del cual la individual ya sale mejor (null si nunca, hasta 80.000)
  function umbralSegundoSueldo(P, o) {
    if (o.tipo !== "matrimonio") return null;
    const sale = b => { const r = conjunta(P, Object.assign({}, o, { b: Object.assign({}, o.b, { bruto: b }) })); return r.cuotaConjunta < r.cuotaIndividual; };
    if (!sale(0)) return 0;
    let lo = 0, hi = null;
    for (let b = 1000; b <= 80000; b += 1000) { if (!sale(b)) { hi = b; break; } lo = b; }
    if (hi == null) return null;
    while (hi - lo > 50) { const m = (lo + hi) / 2; if (sale(m)) lo = m; else hi = m; }
    return Math.round(hi / 50) * 50;
  }
  function conjuntaPorTerritorio(P, o) {
    return territorios(P).map(t => {
      const r = conjunta(P, Object.assign({}, o, { territorio: t }));
      return { territorio: t, individual: r.cuotaIndividual, conjunta: r.cuotaConjunta, mejor: r.mejor, ahorro: r.ahorro,
        pagais: r.mejor === "conjunta" ? r.cuotaConjunta : r.cuotaIndividual };
    }).sort((x, y) => x.pagais - y.pagais);
  }

  // ---- dos pagadores -------------------------------------------------------------------
  // o: { territorio, edad, hijos: [edades], p1: { bruto, contrato, retencion }, p2: {…} }
  // retencion null o vacía: se estima como lo que retendría esa empresa si fuera tu único
  // pagador (el IRPF del año de ese sueldo solo), con el 2 % mínimo de los contratos de
  // duración inferior al año (art. 86.2 RIRPF).
  function retencionEstimada(P, o, p) {
    const bruto = Math.max(0, +p.bruto || 0);
    if (!bruto) return 0;
    const irpf = H.sueldoNeto({ bruto, territorio: o.territorio, edad: o.edad, hijos: o.hijos || [], tipoContrato: p.contrato || "indefinido" }, P).irpf;
    return red2(p.contrato === "temporal" && irpf > 0 ? Math.max(irpf, 0.02 * bruto) : irpf);
  }
  const tieneRet = p => p.retencion != null && p.retencion !== "" && Number.isFinite(+p.retencion);
  function dosPagadores(P, o) {
    const b1 = Math.max(0, +o.p1.bruto || 0), b2 = Math.max(0, +o.p2.bruto || 0);
    const c1 = H.cotizacionesTrabajador(b1, P, o.p1.contrato || "indefinido"), c2 = H.cotizacionesTrabajador(b2, P, o.p2.contrato || "indefinido");
    const r1 = tieneRet(o.p1) ? Math.max(0, +o.p1.retencion) : retencionEstimada(P, o, o.p1);
    const r2 = tieneRet(o.p2) ? Math.max(0, +o.p2.retencion) : retencionEstimada(P, o, o.p2);
    const hijos = o.hijos || [];
    const hogar = { territorio: o.territorio, ejercicio: P.ejercicio, tipoUnidadFamiliar: hijos.length ? "monoparental" : "ninguna", familiaNumerosa: hijos.length >= 3 ? "general" : "no",
      miembros: [{ id: "d1", rol: "declarante", edad: o.edad || 40, discapacidad: "no", retenciones: r1 + r2,
        trabajo: b1 + b2 > 0 ? { dinerarias: b1 + b2, cotizacionesSs: c1 + c2, otrosPagadores: Math.min(b1, b2) } : null }]
        .concat(hijos.map((e, i) => ({ id: "h" + (i + 1), rol: "descendiente", edad: e, rentasPropias: 0, nacidoEnEjercicio: e === 0 }))) };
    const liq = H.liquidar(hogar, P, "auto");
    const ob = liq.obligacionDeclarar && liq.obligacionDeclarar.porPersona && liq.obligacionDeclarar.porPersona.d1;
    const irpf = H.irpfAnual(liq);
    return { bruto: b1 + b2, segundo: Math.min(b1, b2), cotizaciones: red2(c1 + c2), retenciones: [red2(r1), red2(r2)],
      estimada: [!tieneRet(o.p1), !tieneRet(o.p2)], irpf, resultado: liq.cuotaDiferencial, liquidacion: liq,
      obligado: ob ? ob.obligado : null, limite: ob ? ob.limiteTrabajo : null, motivo: ob ? ob.motivo : null,
      regimen: P.territorios[o.territorio].regimen };
  }
  // mismo total, distintos repartos entre los dos pagadores (lo que paga el segundo)
  function escenariosSegundo(P, o, segundos) {
    const total = (+o.p1.bruto || 0) + (+o.p2.bruto || 0);
    return segundos.filter(s => s < total).map(s => {
      const r = dosPagadores(P, Object.assign({}, o, { p1: { bruto: total - s, contrato: o.p1.contrato }, p2: { bruto: s, contrato: o.p2.contrato } }));
      return { segundo: s, obligado: r.obligado, resultado: r.resultado };
    });
  }
  function dosPagadoresPorTerritorio(P, o) {
    return territorios(P).map(t => {
      const r = dosPagadores(P, Object.assign({}, o, { territorio: t }));
      return { territorio: t, resultado: r.resultado, irpf: r.irpf, obligado: r.obligado, retenciones: red2(r.retenciones[0] + r.retenciones[1]) };
    });
  }

  const CALCULOS = { hogarPareja, conjunta, umbralSegundoSueldo, conjuntaPorTerritorio,
    retencionEstimada, dosPagadores, escenariosSegundo, dosPagadoresPorTerritorio, ORDEN };
  if (typeof module !== "undefined" && module.exports) { module.exports = CALCULOS; return; }
  window.MapafiscalConjunta = CALCULOS;

  // =====================================================================================
  // Interfaz
  // =====================================================================================
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur = (n, dec = 0) => { const v = Math.abs(n || 0).toFixed(dec).split("."); return (n < -0.004 && Math.abs(n) >= 0.5 ? "−" : "") + miles(v[0]) + (dec ? "," + v[1] : "") + " €"; };
  const num = id => { const v = parseFloat($(id).value); return Number.isFinite(v) ? Math.max(0, v) : 0; };
  const CORTO = { "ES-IB": "Illes Balears", "ES-VC": "C. Valenciana", "ES-PV-VI": "Araba/Álava", "ES-PV-BI": "Bizkaia", "ES-PV-SS": "Gipuzkoa" };
  const nombre = (P, t) => CORTO[t] || P.territorios[t].nombre;
  const foral = (P, t) => P.territorios[t].regimen !== "comun" ? '<span class="regimen">foral</span>' : "";
  const fila = (c, i, cls = "") => `<tr class="${cls}"><td>${c}</td><td class="cas"></td><td class="imp">${i}</td></tr>`;

  const PS = {};
  async function datos(idScript, url) {
    const el = document.getElementById(idScript);
    if (el) return JSON.parse(el.textContent);
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("No se pudo cargar " + url);
    return r.json();
  }
  async function cargarDatos() {
    const P0 = await datos("datos-params", "datos/params.json");
    PS[P0.ejercicio] = P0;
    try { const P1 = await datos("datos-params-" + (P0.ejercicio + 1), "datos/params_" + (P0.ejercicio + 1) + ".json"); PS[P1.ejercicio] = P1; } catch (e) { /* solo el por defecto */ }
  }
  const ejercicios = () => Object.keys(PS).map(Number).sort();
  const ejercicioActual = () => { const y = new Date().getFullYear(), e = ejercicios(); return e.includes(y) ? y : e[e.length - 1]; };

  function hijos(selId, contId) {
    let edades = [];
    const pintar = () => {
      const n = parseInt($(selId).value, 10) || 0;
      while (edades.length < n) edades.push(edades.length ? Math.min(25, edades[edades.length - 1] + 3) : 4);
      edades = edades.slice(0, n);
      $(contId).innerHTML = edades.map((e, i) => `<label>Edad del hijo ${i + 1} <input type="number" min="0" max="30" step="1" value="${e}" data-edad="${i}"></label>`).join("");
      $(contId).hidden = n === 0;
    };
    $(contId).addEventListener("input", e => { const i = e.target.dataset.edad; if (i != null) edades[+i] = Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0)); });
    $(selId).addEventListener("change", pintar);
    pintar();
    return () => edades.slice();
  }

  // ---- #conjunta ------------------------------------------------------------------------
  let edadesCj;
  const P_cj = () => PS[+$("cj-ejercicio").value] || PS[ejercicioActual()];
  const datosCj = () => ({ territorio: $("cj-territorio").value, tipo: $("cj-tipo").value, hijos: edadesCj(),
    a: { bruto: num("cj-a-bruto"), edad: num("cj-a-edad") || 40 }, b: { bruto: num("cj-b-bruto"), edad: num("cj-b-edad") || 40 } });

  function porQue(P, o, r) {
    const li = [];
    const regimen = r.regimen;
    if (!r.conj) {
      li.push(o.tipo === "pareja-hecho"
        ? "Las parejas de hecho no forman unidad familiar entre ellas (art. 82 de la Ley del IRPF): cada uno hace su declaración. Solo uno de los dos podría declarar en conjunta con los hijos, y al convivir no tendría la reducción de familia monoparental, así que no compensa."
        : "Sin hijos menores (o mayores con discapacidad) a tu cargo no hay unidad familiar monoparental: solo cabe la declaración individual.");
      return li;
    }
    const red = r.conj.reduccionesBase && r.conj.reduccionesBase.tributacionConjunta;
    if (red) li.push(`<b>Reducción por tributación conjunta:</b> la conjunta resta ${eur(red)} de la base imponible (${o.tipo === "matrimonio" ? "matrimonio" : "familia monoparental"}). En individual no existe.`);
    if (regimen === "comun" && r.conj.minimoPersonalFamiliar) {
      const mC = r.conj.minimoPersonalFamiliar;
      li.push(`<b>Mínimos:</b> en conjunta el mínimo del contribuyente (${eur(mC.contribuyente)}) cuenta una sola vez para la unidad familiar; en individual cada uno aplica el suyo. Los mínimos por hijos (${eur(mC.descendientes)} en total) son los mismos en las dos modalidades: en individual se reparten a medias.`);
    }
    if (o.tipo === "matrimonio") {
      li.push(`<b>Progresividad:</b> en conjunta se suman los ingresos de los dos (${eur(o.a.bruto + o.b.bruto)}) y tributan con una sola escala, así que los euros del segundo sueldo pagan al tipo del primero. Por eso la conjunta solo gana cuando uno de los dos gana poco o nada.`);
    }
    if (regimen === "foral_pais_vasco") li.push("En el País Vasco los mínimos son deducciones de la cuota, y la conjunta tiene su propia reducción de la base.");
    if (regimen === "foral_navarra") li.push("En Navarra la conjunta no tiene una reducción fija: se calcula con sus propias reglas de la unidad familiar.");
    return li;
  }

  function pintarCj() {
    const P = P_cj(), o = datosCj();
    $("cj-b-bloque").hidden = o.tipo === "monoparental";
    let r;
    try { r = conjunta(P, o); } catch (e) { $("cj-principal").innerHTML = '<p class="vacio">Revisa los datos introducidos.</p>'; return; }
    $("cj-chip").textContent = `${nombre(P, o.territorio)} · ${P.ejercicio}`;
    $("cj-tarjeta").className = "tarjeta tarjeta-resultado" + (r.conj && r.ahorro >= 1 ? " gana" : "");
    const conviene = !r.conj ? "Individual" : r.ahorro < 1 ? "Da igual" : r.mejor === "conjunta" ? "Conjunta" : "Individual";
    $("cj-principal").innerHTML = `<div class="res-etq">Os conviene la declaración</div>
      <div class="res-cifra">${conviene}</div>
      <p class="res-sub">${!r.conj ? "En vuestro caso no hay opción de conjunta." : r.ahorro < 1 ? "Las dos modalidades salen igual." :
        `Ahorráis <b>${eur(r.ahorro)}</b> frente a la ${r.mejor === "conjunta" ? "individual" : "conjunta"}.`}</p>
      <dl class="kpis"><div><dt>Individual${o.tipo === "monoparental" ? "" : " (los dos)"}</dt><dd>${eur(r.cuotaIndividual)}</dd></div>
      <div><dt>Conjunta</dt><dd>${r.conj ? eur(r.cuotaConjunta) : "—"}</dd></div>
      ${r.porPersona.length > 1 ? `<div><dt>Individual: cada uno</dt><dd>${eur(r.porPersona[0])} + ${eur(r.porPersona[1])}</dd></div>` : ""}</dl>`;
    // desglose de las dos modalidades
    const filas = [];
    const col = (n, ind, conj) => `<tr><td>${n}</td><td class="imp">${ind}</td><td class="imp">${conj}</td></tr>`;
    const d = (l, k) => l ? eur(typeof k === "function" ? k(l) : l[k]) : "—";
    filas.push(`<thead><tr><th>Concepto</th><th class="num">Individual</th><th class="num">Conjunta</th></tr></thead><tbody>`);
    filas.push(col("Base imponible", d(r.ind, "baseImponibleGeneral"), d(r.conj, "baseImponibleGeneral")));
    filas.push(col("Reducción por tributación conjunta", "—", r.conj ? "−" + d(r.conj, l => l.reduccionesBase.tributacionConjunta || 0) : "—"));
    filas.push(col("Base liquidable", d(r.ind, "baseLiquidableGeneral"), d(r.conj, "baseLiquidableGeneral")));
    if (r.regimen === "comun") {
      const minInd = o.tipo === "monoparental" ? r.ind.minimoPersonalFamiliar.total
        : r.ind.minimoPersonalFamiliar.total + H.liquidar(hogarPareja(P, Object.assign({}, o, { a: Object.assign({}, o.b), b: Object.assign({}, o.a) })), P, "individual").minimoPersonalFamiliar.total;
      filas.push(col("Mínimo personal y familiar", eur(minInd), d(r.conj, l => l.minimoPersonalFamiliar.total)));
    }
    filas.push(col("Cuota íntegra", d(r.ind, "cuotaIntegraTotal"), d(r.conj, "cuotaIntegraTotal")));
    filas.push(`<tr class="total"><td>IRPF del año (cuota resultante)</td><td class="imp">${eur(r.cuotaIndividual)}</td><td class="imp">${r.conj ? eur(r.cuotaConjunta) : "—"}</td></tr></tbody>`);
    $("cj-desglose").innerHTML = filas.join("");
    const um = umbralSegundoSueldo(P, o);
    const motivos = porQue(P, o, r);
    if (o.tipo === "matrimonio" && um != null) motivos.push(um === 0
      ? "Con estos datos la conjunta no compensa ni aunque el segundo no ganara nada."
      : `<b>El punto de corte:</b> con el sueldo de ${eur(o.a.bruto)}, la conjunta os sale mejor mientras el otro sueldo no pase de unos <b>${eur(um)}</b> brutos al año.`);
    $("cj-porque").innerHTML = motivos.map(m => `<li>${m}</li>`).join("");
    // territorios
    const lista = conjuntaPorTerritorio(P, o);
    $("cj-ranking").innerHTML = `<thead><tr><th>#</th><th>Territorio</th><th class="num">Individual</th><th class="num">Conjunta</th><th class="num">Conviene</th></tr></thead><tbody>` +
      lista.map((x, i) => `<tr class="${x.territorio === o.territorio ? "tu" : ""}" data-t="${x.territorio}"><td class="pos">${i + 1}</td><td>${esc(nombre(P, x.territorio))}${foral(P, x.territorio)}</td>
        <td class="num">${eur(x.individual)}</td><td class="num">${x.conjunta == null ? "—" : eur(x.conjunta)}</td>
        <td class="num dif ${x.conjunta != null && x.ahorro >= 1 && x.mejor === "conjunta" ? "gana" : ""}">${x.conjunta == null ? "Individual" : x.ahorro < 1 ? "Igual" : (x.mejor === "conjunta" ? "Conjunta" : "Individual") + " (−" + eur(x.ahorro) + ")"}</td></tr>`).join("") + "</tbody>";
    $("cj-nota").textContent = `Ejercicio ${P.ejercicio}. Cuotas con sueldos del trabajo, cotizaciones del trabajador calculadas y los mínimos y deducciones generales de cada territorio; sin otras rentas ni deducciones por gastos. Para vuestro caso completo, usad la calculadora: compara las dos modalidades con todos los datos.`;
  }

  // ---- #dos-pagadores --------------------------------------------------------------------
  let edadesDp;
  const P_dp = () => PS[+$("dp-ejercicio").value] || PS[ejercicioActual()];
  const retVal = id => { const v = $(id).value.trim(); return v === "" ? null : Math.max(0, parseFloat(v) || 0); };
  const datosDp = () => ({ territorio: $("dp-territorio").value, edad: num("dp-edad") || 35, hijos: edadesDp(),
    p1: { bruto: num("dp-b1"), contrato: $("dp-c1").value, retencion: retVal("dp-r1") },
    p2: { bruto: num("dp-b2"), contrato: $("dp-c2").value, retencion: retVal("dp-r2") } });
  const MOTIVO = { trabajo: "tus rendimientos del trabajo superan el límite", alta_reta: "estás de alta como autónomo",
    capital: "tus rentas del capital superan 1.600 €", imputaciones: "tus imputaciones de inmuebles superan 1.000 €", otras_rentas: "tienes otras rentas" };

  function pintarDp() {
    const P = P_dp(), o = datosDp();
    let r;
    try { r = dosPagadores(P, o); } catch (e) { $("dp-principal").innerHTML = '<p class="vacio">Revisa los datos introducidos.</p>'; return; }
    const od = P.estatal.obligacion_declarar, pagar = r.resultado > 0.5, devolver = r.resultado < -0.5;
    const noObligado = r.obligado === false;
    $("dp-chip").textContent = `${nombre(P, o.territorio)} · ${P.ejercicio}`;
    $("dp-tarjeta").className = "tarjeta tarjeta-resultado" + (devolver || noObligado ? " gana" : pagar ? " pierde" : "");
    const etiq = r.obligado == null ? "Obligación de declarar: según la norma foral" : r.obligado ? "Estás obligado a declarar" : "No estás obligado a declarar";
    $("dp-principal").innerHTML = `<div class="res-etq">${etiq}</div>
      <div class="res-cifra ${pagar ? "pierde" : devolver ? "gana" : ""}">${pagar ? "A pagar " + eur(r.resultado) : devolver ? "A devolver " + eur(-r.resultado) : "Ni pagar ni devolver"}</div>
      <p class="res-sub">${noObligado && pagar ? "Como no estás obligado, si no presentas la declaración no tendrás que pagar esa diferencia." :
        noObligado && devolver ? "No estás obligado, pero te conviene presentarla para que te devuelvan lo retenido de más." :
        r.obligado && pagar ? "Es lo habitual con dos pagadores: cada empresa te retuvo como si fuera la única." : "Resultado de la declaración con tus retenciones."}</p>
      <dl class="kpis"><div><dt>IRPF del año</dt><dd>${eur(r.irpf)}</dd></div><div><dt>Retenido entre las dos</dt><dd>${eur(r.retenciones[0] + r.retenciones[1])}</dd></div>
      <div><dt>Segundo pagador</dt><dd>${eur(r.segundo)}</dd></div></dl>`;
    // obligación de declarar
    const ob = [];
    if (r.obligado == null) ob.push(`En ${esc(nombre(P, o.territorio))} la obligación de declarar la regula su norma foral, con límites propios. Lo que te sale a pagar o a devolver sí se calcula con su IRPF.`);
    else {
      ob.push(`Con un solo pagador no tendrías que declarar hasta ${eur(od.trabajo_un_pagador)} de rendimientos del trabajo. Si el segundo y siguientes pagadores te pagan, sumados, más de ${eur(od.segundo_pagador_umbral)}, el límite baja a <b>${eur(od.trabajo_varios_pagadores)}</b> (art. 96 de la Ley del IRPF).`);
      ob.push(r.segundo > od.segundo_pagador_umbral
        ? `Tu segundo pagador te ha pagado ${eur(r.segundo)}, más de ${eur(od.segundo_pagador_umbral)}: tu límite es ${eur(r.limite)} y has cobrado ${eur(r.bruto)} brutos. ${r.obligado ? "Estás obligado" + (r.motivo && r.motivo !== "trabajo" ? " porque " + MOTIVO[r.motivo] : "") + "." : "No llegas: no estás obligado."}`
        : `Tu segundo pagador no pasa de ${eur(od.segundo_pagador_umbral)}: se aplica el límite de ${eur(od.trabajo_un_pagador)}. ${r.obligado ? "Estás obligado" + (r.motivo ? " porque " + MOTIVO[r.motivo] : "") + "." : "No estás obligado."}`);
    }
    $("dp-obligacion").innerHTML = ob.map(x => `<p>${x}</p>`).join("");
    // desglose
    const filas = [fila("Sueldo del primer pagador", eur(o.p1.bruto)), fila("Sueldo del segundo pagador", eur(o.p2.bruto)),
      fila("Cotizaciones a la Seguridad Social", "−" + eur(r.cotizaciones), "hr-resta"),
      fila("IRPF del año con los dos sueldos sumados", eur(r.irpf), "sub"),
      fila(`Retención del primer pagador${r.estimada[0] ? " (estimada)" : ""}`, "−" + eur(r.retenciones[0]), "hr-resta"),
      fila(`Retención del segundo pagador${r.estimada[1] ? " (estimada)" : ""}`, "−" + eur(r.retenciones[1]), "hr-resta"),
      fila(pagar ? "Resultado: a pagar" : "Resultado: a devolver", eur(Math.abs(r.resultado)), "total")];
    $("dp-desglose").innerHTML = filas.join("");
    // escenarios: mismo total, otro reparto
    const esc2 = escenariosSegundo(P, Object.assign({}, o, { p1: { bruto: o.p1.bruto, contrato: o.p1.contrato }, p2: { bruto: o.p2.bruto, contrato: o.p2.contrato } }),
      [0, 1000, 1500, 2000, 4000, 6000, 8000, 10000, 15000]);
    $("dp-escenarios").innerHTML = `<thead><tr><th>Si el segundo te pagara</th><th class="num">¿Obligado?</th><th class="num">Resultado (retenciones estimadas)</th></tr></thead><tbody>` +
      esc2.map(x => `<tr class="${Math.abs(x.segundo - r.segundo) < 1 ? "tu" : ""}"><td>${eur(x.segundo)} <span class="nota-inline">(y el primero ${eur(r.bruto - x.segundo)})</span></td>
        <td class="num">${x.obligado == null ? "Norma foral" : x.obligado ? "Sí" : "No"}</td>
        <td class="num dif ${x.resultado > 0.5 ? "pierde" : x.resultado < -0.5 ? "gana" : ""}">${x.resultado > 0.5 ? "A pagar " + eur(x.resultado) : x.resultado < -0.5 ? "A devolver " + eur(-x.resultado) : "0 €"}</td></tr>`).join("") + "</tbody>";
    $("dp-t-escenarios").textContent = `Con ${eur(r.bruto)} en total, según lo que te pague el segundo`;
    // territorios
    const lista = dosPagadoresPorTerritorio(P, o).sort((a, b) => a.resultado - b.resultado);
    $("dp-ranking").innerHTML = `<thead><tr><th>#</th><th>Territorio</th><th class="num">IRPF del año</th><th class="num">Retenciones</th><th class="num">Resultado</th></tr></thead><tbody>` +
      lista.map((x, i) => `<tr class="${x.territorio === o.territorio ? "tu" : ""}" data-t="${x.territorio}"><td class="pos">${i + 1}</td><td>${esc(nombre(P, x.territorio))}${foral(P, x.territorio)}</td>
        <td class="num">${eur(x.irpf)}</td><td class="num">${eur(x.retenciones)}</td>
        <td class="num dif ${x.resultado > 0.5 ? "pierde" : x.resultado < -0.5 ? "gana" : ""}">${x.resultado > 0.5 ? "+" + eur(x.resultado) : x.resultado < -0.5 ? "−" + eur(-x.resultado) : "0 €"}</td></tr>`).join("") + "</tbody>";
    $("dp-nota").textContent = `Ejercicio ${P.ejercicio}. Si dejas una retención en blanco, se estima como la que te haría esa empresa si fuera tu único pagador (con el 2 % mínimo de los contratos de menos de un año). Las empresas aplican el procedimiento de retenciones del Reglamento del IRPF (arts. 80 a 89), así que la cifra real puede variar: pon las de tu certificado de retenciones o tu última nómina para afinar. Sin otras rentas ni deducciones por gastos.`;
  }

  // ---- arranque --------------------------------------------------------------------------
  const opciones = (P, sel, valor) => {
    sel.innerHTML = territorios(P).map(t => `<option value="${t}">${esc(P.territorios[t].nombre)}${P.territorios[t].regimen !== "comun" ? " (foral)" : ""}</option>`).join("");
    sel.value = P.territorios[valor] ? valor : sel.options[0].value;
  };
  cargarDatos().then(() => {
    const P = PS[ejercicioActual()];
    for (const id of ["cj-ejercicio", "dp-ejercicio"]) { $(id).innerHTML = ejercicios().map(y => `<option value="${y}">${y}</option>`).join(""); $(id).value = String(ejercicioActual()); }
    opciones(P, $("cj-territorio"), "ES-MD"); opciones(P, $("dp-territorio"), "ES-MD");
    edadesCj = hijos("cj-hijos", "cj-edades"); edadesDp = hijos("dp-hijos", "dp-edades");
    const enlazar = (form, f) => { let t; $(form).addEventListener("input", () => { clearTimeout(t); t = setTimeout(f, 150); }); $(form).addEventListener("change", f); };
    enlazar("cj-form", pintarCj); enlazar("dp-form", pintarDp);
    $("cj-ranking").addEventListener("click", e => { const tr = e.target.closest("tr[data-t]"); if (tr) { $("cj-territorio").value = tr.dataset.t; pintarCj(); } });
    $("dp-ranking").addEventListener("click", e => { const tr = e.target.closest("tr[data-t]"); if (tr) { $("dp-territorio").value = tr.dataset.t; pintarDp(); } });
    document.addEventListener("mapafiscal:vista", e => {
      const v = e.detail && e.detail.vista;
      if (v === "conjunta") pintarCj();
      if (v === "dos-pagadores") pintarDp();
    });
    if (!$("v-conjunta").hidden) pintarCj();
    if (!$("v-dos-pagadores").hidden) pintarDp();
  }).catch(() => { /* app.js ya avisa si no hay datos */ });
})();
