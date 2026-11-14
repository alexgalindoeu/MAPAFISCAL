/* =============================================================================
 * Mapafiscal — informe completo de la declaración (PDF imprimible).
 *
 * Desglose línea a línea, deducciones aplicadas, comparación en los 19 territorios y «cómo
 * pagar menos», todo calculado por el motor (irpfsim.js: liquidar, compararTerritorios,
 * optimizar). Se descarga con window.print() y el diseño @media print de «informe» en
 * css/mapafiscal.css: sin librerías.
 *
 * Desbloqueo (decisión de Alex, negocio/otros-ingresos.md §1): plan de pago, pago único de
 * 1,99 € (interruptor `informePago`) o anuncio bonificado (interruptor `informeAnuncio`).
 * Aceptar cookies NO desbloquea. Con los dos interruptores apagados, basta con tener sesión
 * iniciada (decisión provisional para incentivar el registro). El PDF que no se ha pagado
 * (ni va incluido en un plan) lleva un banner propio: AdSense no funciona dentro de un PDF.
 *
 * app.js expone lo justo en window.MapafiscalApp y avisa con «mapafiscal:sesion».
 * En Node (test/informe.test.mjs) exporta la lógica pura: desbloqueo, contenido y html.
 * ========================================================================== */
(function () {
  "use strict";
  const H = (typeof window !== "undefined" && window.irpfsim) || (typeof require === "function" ? require("./irpfsim.js") : null);

  // ---- utilidades ----------------------------------------------------------------------
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur = (n, dec = 2) => {
    const v = Math.abs(n || 0).toFixed(dec).split(".");
    return (n < -0.004 ? "−" : "") + miles(v[0]) + (dec ? "," + v[1] : "") + " €";
  };
  const eur0 = n => eur(n, 0);
  const pct = n => (100 * (n || 0)).toFixed(2).replace(".", ",") + " %";
  const num = x => (Number.isFinite(+x) ? +x : 0);
  const red2 = n => Math.round((n + 1e-9) * 100) / 100;

  const CORTO = { "ES-AN": "Andalucía", "ES-AR": "Aragón", "ES-AS": "Asturias", "ES-IB": "Illes Balears", "ES-CN": "Canarias",
    "ES-CB": "Cantabria", "ES-CL": "Castilla y León", "ES-CM": "Castilla-La Mancha", "ES-CT": "Cataluña", "ES-EX": "Extremadura",
    "ES-GA": "Galicia", "ES-MD": "Madrid", "ES-MC": "Murcia", "ES-RI": "La Rioja", "ES-VC": "C. Valenciana",
    "ES-PV-VI": "Araba/Álava", "ES-PV-BI": "Bizkaia", "ES-PV-SS": "Gipuzkoa", "ES-NC": "Navarra" };
  const REGIMEN = { comun: "Régimen común", foral_pais_vasco: "Foral · País Vasco", foral_navarra: "Foral · Navarra" };
  const nombreT = (P, t) => CORTO[t] || (P.territorios[t] ? P.territorios[t].nombre : t);

  // ---- 1. desbloqueo -------------------------------------------------------------------
  // e = { cfg, demo, usuario, plan, comprado, recompensa }. Cualquier otra cosa (p. ej. haber
  // aceptado cookies) se ignora a propósito: no es una vía de desbloqueo.
  // Devuelve { desbloqueado, via, banner, opciones }. via: plan | pago | anuncio | registro | demo.
  function desbloqueo(e) {
    e = e || {};
    const cfg = e.cfg || {};
    const pago = !!cfg.informePago, anuncio = !!cfg.informeAnuncio;
    const si = (via, banner) => ({ desbloqueado: true, via, banner, opciones: [] });
    if (e.usuario && e.plan && e.plan !== "gratis") return si("plan", false);
    if (pago && e.usuario && e.comprado) return si("pago", false);
    if (anuncio && e.recompensa) return si("anuncio", true);
    // la versión autónoma (artifact, sin cuentas) no puede pedir sesión ni cobrar
    if (e.demo) return si("demo", true);
    if (!pago && !anuncio) {
      if (e.usuario) return si("registro", true);
      return { desbloqueado: false, via: null, banner: true, opciones: ["acceso", "plan"] };
    }
    const opciones = [];
    if (anuncio) opciones.push("anuncio");
    if (pago) opciones.push("pago");
    opciones.push("plan");
    return { desbloqueado: false, via: null, banner: true, opciones };
  }

  // ---- 2. contenido (todo sale del motor) -----------------------------------------------
  const NOMBRES_DED = {
    minimoPersonal: "Mínimo personal (deducción foral)", minimoFamiliar: "Mínimo familiar (deducción foral)",
    trabajo: "Deducción por rendimientos del trabajo", maternidad: "Deducción por maternidad",
    familiaNumerosa: "Deducción por familia numerosa", discapacidadFamiliaresCargo: "Deducción por familiares con discapacidad a cargo",
    alquilerVivienda: "Deducción por alquiler de vivienda habitual", adquisicionVivienda: "Deducción por adquisición de vivienda habitual",
    emancipacion: "Deducción por arrendamiento para emancipación", pensionJubilacion: "Deducción por pensiones de jubilación bajas",
    viviendaTransitoria: "Deducción por inversión en vivienda habitual (régimen transitorio)", donativos: "Deducción por donativos (Ley 49/2002)"
  };
  const BLOQUE_DED = {
    minimoPersonal: "minimo_personal_deduccion", minimoFamiliar: "minimo_familiar_deduccion", trabajo: "deduccion_trabajo_cuota",
    alquilerVivienda: "deduccion_alquiler_vivienda", adquisicionVivienda: "deduccion_adquisicion_vivienda",
    emancipacion: "deduccion_emancipacion", pensionJubilacion: "deduccion_pension_jubilacion",
    viviendaTransitoria: "deduccion_vivienda_transitoria", donativos: "deduccion_donativos",
    maternidad: "deduccion_maternidad", familiaNumerosa: "deduccion_familia_numerosa_y_discapacidad_cargo",
    discapacidadFamiliaresCargo: "deduccion_familia_numerosa_y_discapacidad_cargo"
  };
  const nombreDed = id => NOMBRES_DED[id] || id.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim().toLowerCase().replace(/^./, c => c.toUpperCase());
  function bloqueDed(P, reg, id) {
    const fuente = reg === "foral_navarra" ? P.navarra : reg === "foral_pais_vasco" ? P.foral_pv : P.estatal;
    return (BLOQUE_DED[id] && fuente && fuente[BLOQUE_DED[id]]) || null;
  }
  function tipoMarginal(P, liq, terr) {
    const b = liq.baseLiquidableGeneral || 0, reg = P.territorios[terr].regimen;
    if (reg === "comun") return H.tipoMarginal(b, P.estatal.escala_general_estatal) + H.tipoMarginal(b, P.territorios[terr].escala_general_autonomica);
    if (reg === "foral_pais_vasco") return H.tipoMarginal(b, P.foral_pv.escala_general_foral);
    return H.tipoMarginal(b, P.navarra.escala_general_foral);
  }

  // Aportación a planes de pensiones / EPSV que maximiza el ahorro de este año, buscando con
  // el motor (no con una regla fija): el límite efectivo es la reducción que da el motor con
  // una aportación muy alta. En Navarra la reducción del art. 55 de su TR no está en el motor.
  function planOptimo(hogar, P) {
    const terr = P.territorios[hogar.territorio];
    if (!terr || terr.regimen === "foral_navarra") return null;
    const d1 = hogar.miembros.find(m => m.rol === "declarante");
    if (!d1) return null;
    const a0 = num(d1.previsionSocial && d1.previsionSocial.aportacionIndividual);
    const con = a => {
      const h2 = JSON.parse(JSON.stringify(hogar));
      const m = h2.miembros.find(x => x.id === d1.id);
      m.previsionSocial = Object.assign({}, m.previsionSocial || {}, { aportacionIndividual: a });
      return H.liquidar(h2, P, "auto");
    };
    const red = l => num(l.reduccionesBase && l.reduccionesBase.previsionSocial);
    let limite = a0 + Math.max(0, red(con(1e7)) - red(con(a0)));
    if (terr.regimen === "foral_pais_vasco") limite = Math.min(limite, P.foral_pv.reduccion_prevision_social.limite_individual_no_empleo);
    const margen = Math.max(0, limite - a0);
    const irpf = a => H.irpfAnual(con(a));
    const sin = irpf(a0), ahorroMax = red2(sin - irpf(a0 + margen));
    if (margen < 10 || ahorroMax < 1) return { aportacionActual: a0, limite: red2(limite), extra: 0, ahorro: 0, alMaximo: margen < 10 };
    let lo = 0, hi = margen;
    for (let k = 0; k < 40 && hi - lo > 1; k++) { const m = (lo + hi) / 2; if (sin - irpf(a0 + m) >= ahorroMax - 0.5) hi = m; else lo = m; }
    const extra = Math.min(margen, Math.ceil(hi / 10) * 10);
    const ahorro = red2(sin - irpf(a0 + extra));
    const bloque = terr.regimen === "foral_pais_vasco" ? P.foral_pv.reduccion_prevision_social : P.estatal.reduccion_prevision_social;
    return { aportacionActual: a0, limite: red2(limite), extra, ahorro, porEuro: extra ? ahorro / extra : 0, alMaximo: false,
      norma: bloque && bloque.norma };
  }

  // Todo lo que lleva el informe, como datos (lo prueba test/informe.test.mjs).
  function contenido(hogar, P) {
    const terr = hogar.territorio, T = P.territorios[terr];
    if (!T) throw new Error("Territorio desconocido: " + terr);
    const reg = T.regimen, comun = reg === "comun";
    const liq = H.liquidar(hogar, P, "auto");
    const ret = num(liq.retenciones);
    const impr = num(liq.deduccionesCuotaDiferencial && liq.deduccionesCuotaDiferencial.total);
    const drt = num(liq.deduccionRendimientosTrabajo && liq.deduccionRendimientosTrabajo.total);
    const cuota = liq.cuotaResultanteAutoliquidacion, cd = liq.cuotaDiferencial;
    const hayResultado = ret > 0 || impr > 0;
    const nombreCuota = drt ? "Cuota resultante" : "Cuota líquida";
    const rotulo = !hayResultado ? `Tu ${nombreCuota.toLowerCase()} del IRPF` : cd < -0.004 ? "A devolver" : cd > 0.004 ? "A ingresar" : "Ni a pagar ni a devolver";
    const otraModo = liq.modoTributacionElegido === "conjunta" ? "individual" : "conjunta";
    const otra = liq.comparativa ? liq.comparativa[otraModo] : null;

    // situación de partida (sin datos personales: solo importes y la composición del hogar)
    const cr = liq.componentesRenta || {};
    const miembros = hogar.miembros || [];
    const n = rol => miembros.filter(m => m.rol === rol).length;
    const situacion = [["Territorio de residencia fiscal", `${T.nombre} (${REGIMEN[reg] || reg})`], ["Ejercicio", String(P.ejercicio)],
      ["Unidad familiar", [n("conyuge") ? "con pareja" : "sin pareja", n("descendiente") ? `${n("descendiente")} ${n("descendiente") === 1 ? "hijo" : "hijos"}` : "",
        n("ascendiente") ? `${n("ascendiente")} ${n("ascendiente") === 1 ? "ascendiente" : "ascendientes"} a cargo` : ""].filter(Boolean).join(", ")]];
    const ingTrabajo = miembros.reduce((s, m) => s + num(m.trabajo && m.trabajo.dinerarias), 0);
    if (ingTrabajo) situacion.push(["Rendimientos íntegros del trabajo", eur(ingTrabajo)]);
    if (ret) situacion.push(["Retenciones e ingresos a cuenta", eur(ret)]);

    // desglose línea a línea
    const desglose = [];
    const f = (concepto, casilla, importe, tipo = "") => desglose.push({ concepto, casilla, importe: red2(importe), tipo });
    if (cr.trabajoPrevio) f("Rendimiento neto previo del trabajo", "", cr.trabajoPrevio);
    if (cr.reduccionTrabajo) f("Reducción por obtención de rendimientos del trabajo", "", -cr.reduccionTrabajo, "menos");
    if (cr.trabajoNeto) f("Rendimiento neto reducido del trabajo", "", cr.trabajoNeto, "info");
    if (cr.capitalMobiliarioGeneral) f("Capital mobiliario (base general)", "", cr.capitalMobiliarioGeneral, "info");
    if (cr.capitalInmobiliario) f("Rendimiento neto del capital inmobiliario", "", cr.capitalInmobiliario, "info");
    if (cr.actividades) f("Rendimiento neto de actividades económicas", "", cr.actividades, "info");
    if (cr.gananciasGeneral) f("Ganancias y pérdidas patrimoniales (base general)", "", cr.gananciasGeneral, "info");
    f("Base imponible general", "0435", liq.baseImponibleGeneral, "sub");
    if (cr.capitalMobiliarioAhorro) f("Capital mobiliario (base del ahorro)", "", cr.capitalMobiliarioAhorro, "info");
    if (cr.gananciasAhorro) f("Ganancias y pérdidas patrimoniales (base del ahorro)", "", cr.gananciasAhorro, "info");
    if (liq.baseImponibleAhorro) f("Base imponible del ahorro", "0460", liq.baseImponibleAhorro, "sub");
    const rb = liq.reduccionesBase || {};
    if (rb.previsionSocial) f("Reducción por aportaciones a sistemas de previsión social", "", -rb.previsionSocial, "menos");
    if (rb.pensionesCompensatorias) f("Reducción por pensiones compensatorias", "", -rb.pensionesCompensatorias, "menos");
    if (rb.tributacionConjunta) f("Reducción por tributación conjunta", "", -rb.tributacionConjunta, "menos");
    f("Base liquidable general", "0500", liq.baseLiquidableGeneral, "sub");
    if (liq.baseLiquidableAhorro) f("Base liquidable del ahorro", "0510", liq.baseLiquidableAhorro, "sub");
    if (comun) {
      const m = liq.minimoPersonalFamiliar;
      if (m && m.total) f("Mínimo personal y familiar (tributa al 0 %)", "", m.total, "info");
      const mA = liq.minimoPersonalFamiliarAutonomico;
      if (mA && m && Math.abs(mA.total - m.total) > 0.005) f(`Mínimo autonómico de ${nombreT(P, terr)} (solo cuota autonómica)`, "", mA.total, "info");
      f("Cuota íntegra estatal", "", liq.cuotaIntegraEstatal);
      f("Cuota íntegra autonómica", "0546", liq.cuotaIntegraAutonomica);
      const de = liq.deduccionesEstatales, deTot = de ? num(de.totalEstatal) + num(de.totalAutonomico) : 0;
      if (deTot) f("Deducciones generales (vivienda anterior a 2013, donativos)", "", -deTot, "menos");
      const da = num(liq.deduccionesAutonomicas && liq.deduccionesAutonomicas.total);
      if (da) f("Deducciones autonómicas", "0564", -da, "menos");
      if (liq.bonificacionResidencia) f("Bonificación por residencia", "", -liq.bonificacionResidencia, "menos");
      f("Cuota líquida estatal", "", liq.cuotaLiquidaEstatal, "info");
      f("Cuota líquida autonómica", "", liq.cuotaLiquidaAutonomica, "info");
    } else {
      f("Cuota íntegra foral", "", liq.cuotaIntegraAutonomica);
      if (liq.minoracionCuota) f("Minoración general de la cuota", "", -liq.minoracionCuota, "menos");
      const da = num(liq.deduccionesAutonomicas && liq.deduccionesAutonomicas.total);
      if (da) f(reg === "foral_navarra" ? "Deducciones de la cuota (mínimos y trabajo)" : "Deducciones forales", "", -da, "menos");
    }
    f("Cuota líquida total", "", liq.cuotaLiquidaTotal, "sub");
    if (drt) { f("Deducción por obtención de rendimientos del trabajo", "", -drt, "menos"); f("Cuota resultante de la autoliquidación", "", cuota, "sub"); }
    if (impr) f(reg === "foral_navarra" ? "Deducciones sobre la cuota diferencial" : "Deducciones por maternidad, familia numerosa o discapacidad", "", -impr, "menos");
    if (ret) f("Retenciones e ingresos a cuenta", "", -ret, "menos");
    if (hayResultado) f(cd < 0 ? "Resultado: a devolver" : "Resultado: a ingresar", "", Math.abs(cd), "total");
    else desglose[desglose.length - 1].tipo = "total";

    // deducciones aplicadas, con su norma
    const deducciones = [];
    const lista = (T.deducciones_autonomicas && T.deducciones_autonomicas.lista) || [];
    for (const [id, v] of Object.entries((liq.deduccionesAutonomicas && liq.deduccionesAutonomicas.detalle) || {})) {
      if (!(v > 0)) continue;
      const inf = comun ? lista.find(d => d.id === id) : bloqueDed(P, reg, id);
      deducciones.push({ id, nombre: (inf && inf.nombre) || nombreDed(id), importe: red2(v),
        norma: (inf && inf.norma) || (comun ? "" : reg === "foral_navarra" ? "Texto Refundido del IRPF de Navarra" : "Normativa foral del Territorio Histórico"),
        estado: (inf && inf.estado) || "" });
    }
    for (const [id, v] of Object.entries((liq.deduccionesCuotaDiferencial && liq.deduccionesCuotaDiferencial.detalle) || {})) {
      if (!(v > 0)) continue;
      const inf = bloqueDed(P, reg, id);
      deducciones.push({ id, nombre: nombreDed(id), importe: red2(v), norma: ((inf && inf.norma) || "Arts. 81 y 81 bis LIRPF") + " · se resta de la cuota diferencial", estado: (inf && inf.estado) || "" });
    }
    for (const [id, v] of Object.entries((liq.deduccionesEstatales && liq.deduccionesEstatales.detalle) || {})) {
      if (!(v > 0)) continue;
      const inf = bloqueDed(P, "comun", id);
      deducciones.push({ id, nombre: nombreDed(id), importe: red2(v), norma: ((inf && inf.norma) || "LIRPF") + " · mitad estatal, mitad autonómica", estado: (inf && inf.estado) || "" });
    }
    if (drt) {
      const inf = P.estatal.deduccion_obtencion_rendimientos_trabajo || {};
      deducciones.push({ id: "obtencionRendimientosTrabajo", nombre: "Deducción por obtención de rendimientos del trabajo", importe: red2(drt), norma: inf.norma || "", estado: inf.estado || "" });
    }

    // comparación en los 19 territorios (misma situación)
    const cmp = H.compararTerritorios(hogar, P);
    const yo = cmp.find(c => c.territorio === terr);
    const base = yo ? yo.cuotaResultanteAutoliquidacion : cuota;
    const filas = cmp.map(c => ({ territorio: c.territorio, nombre: nombreT(P, c.territorio), regimen: c.regimen,
      cuota: red2(c.cuotaResultanteAutoliquidacion), tipoMedio: c.tipoMedioEfectivo, dif: red2(c.cuotaResultanteAutoliquidacion - base),
      tuyo: c.territorio === terr })).sort((a, b) => a.cuota - b.cuota);
    const puesto = 1 + filas.filter(c => c.cuota < base - 0.5).length;
    const comparacion = { filas, puesto, total: filas.length, barato: filas[0], caro: filas[filas.length - 1] };

    // cómo pagar menos: lo que calcula el optimizador del motor, con la aportación óptima al
    // plan de pensiones calculada con más precisión (planOptimo) en lugar de por escalones
    let opt = { recomendaciones: [] };
    try { opt = H.optimizar(hogar, P); } catch (e) { /* sin palancas */ }
    const plan = planOptimo(hogar, P);
    const consejos = [];
    if (plan && plan.extra > 0 && plan.ahorro >= 1) consejos.push({ id: "plan_pensiones", categoria: "prevision",
      titulo: `Aportar ${eur0(plan.extra)} más a un plan de pensiones o EPSV antes del 31-12`,
      detalle: `Es la aportación que da el máximo ahorro este año: tu IRPF baja ${eur0(plan.ahorro)} (${Math.round(100 * plan.porEuro)} céntimos por euro aportado). ` +
        `Por encima de ${eur0(plan.aportacionActual + plan.extra)} en total ya no ahorra más este año.${plan.norma ? " " + plan.norma + "." : ""}`,
      ahorro: plan.ahorro });
    for (const r of opt.recomendaciones) {
      if (r.id === "plan_pensiones" && plan) continue;
      if (r.id === "modo" && r.yaAplicado) { consejos.push(Object.assign({}, r, { titulo: "Ya aplicada: declaración " + liq.modoTributacionElegido, yaAplicado: true })); continue; }
      consejos.push({ id: r.id, categoria: r.categoria, titulo: r.titulo, detalle: r.detalle, ahorro: r.ahorro });
    }

    // avisos de calidad de los datos
    const avisos = [];
    const da = T.deducciones_autonomicas;
    if (da && da.estado && da.estado !== "cargado") avisos.push(`Las deducciones de ${T.nombre} están en estado «${da.estado}» en el motor.`);
    if (deducciones.some(d => d.estado && d.estado !== "confirmado")) avisos.push("Alguna deducción aplicada usa parámetros provisionales o pendientes de confirmar con el boletín oficial.");

    return {
      ejercicio: P.ejercicio, territorio: { id: terr, nombre: T.nombre, corto: nombreT(P, terr), regimen: reg, regimenTxt: REGIMEN[reg] || reg },
      situacion,
      resumen: { rotulo, cifra: red2(hayResultado ? Math.abs(cd) : cuota), estado: !hayResultado ? "" : cd < -0.004 ? "gana" : cd > 0.004 ? "pierde" : "",
        cuota: red2(cuota), nombreCuota, cuotaDiferencial: red2(cd), retenciones: ret, hayResultado,
        tipoMedio: liq.tipoMedioEfectivo, tipoMarginal: tipoMarginal(P, liq, terr), modo: liq.modoTributacionElegido,
        otraModalidad: otra != null ? { modo: otraModo, cuota: red2(otra) } : null },
      desglose, deducciones, comparacion, consejos, planOptimo: plan, avisos,
      obligado: liq.obligacionDeclarar ? liq.obligacionDeclarar.obligado : null
    };
  }

  // ---- 3. HTML del informe (pantalla e impresión) ---------------------------------------
  const CAT = { declaracion: "Declaración", prevision: "Ahorro", territorio: "Residencia", deduccion_potencial: "Deducción" };
  const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true" class="inf-logo"><rect width="32" height="32" rx="8" fill="#1f3fc4"/><path fill="#fff" d="M7 10.5 13 8v15.5L7 26z"/><path fill="#ffd23f" d="M13 8l6 2.5V26l-6-2.5z"/><path fill="#fff" fill-opacity=".55" d="M19 10.5 25 8v15.5L19 26z"/></svg>';

  // o = { banner, afiliado: { texto, enlace, imagen }, fecha, web }
  function html(c, o) {
    o = o || {};
    const web = o.web || "https://mapafiscal.es/";
    const r = c.resumen;
    const filaD = d => `<tr class="${d.tipo}"><td>${esc(d.concepto)}</td><td class="cas">${d.casilla ? `<span class="cod">${d.casilla}</span>` : ""}</td><td class="imp">${d.importe < 0 ? "−" + eur(-d.importe) : eur(d.importe)}</td></tr>`;
    const banner = !o.banner ? "" : (o.afiliado && o.afiliado.enlace
      ? `<aside class="inf-banner"><span class="inf-banner-etq">Enlace patrocinado</span><a href="${esc(o.afiliado.enlace)}" rel="sponsored noopener">${o.afiliado.imagen ? `<img src="${esc(o.afiliado.imagen)}" alt="${esc(o.afiliado.texto || "")}">` : esc(o.afiliado.texto || o.afiliado.enlace)}</a></aside>`
      : `<aside class="inf-banner">${LOGO}<div><b>Informe gratuito de Mapafiscal.</b> Con el plan Gestor tienes los informes de toda tu cartera de clientes, siempre recalculados y sin este aviso.
          <a href="${esc(web)}#planes">${esc(web.replace(/^https?:\/\//, "").replace(/\/$/, ""))}/#planes</a></div></aside>`);
    return `<article class="inf-doc">
  <header class="inf-cab">${LOGO}<div><p class="inf-marca">Mapafiscal</p><h1>Informe de tu IRPF ${c.ejercicio}</h1>
    <p class="inf-sub">${esc(c.territorio.nombre)} · ${esc(c.territorio.regimenTxt)}${o.fecha ? ` · generado el ${esc(o.fecha)}` : ""}</p></div></header>
  ${banner}
  <section class="inf-sec inf-resumen">
    <div class="inf-cifra ${r.estado}"><span>${esc(r.rotulo)}</span><b>${eur(r.cifra)}</b></div>
    <dl class="inf-kpis">
      <div><dt>${esc(r.nombreCuota)}</dt><dd>${eur(r.cuota)}</dd></div>
      <div><dt>Tipo medio efectivo</dt><dd>${pct(r.tipoMedio)}</dd></div>
      <div><dt>Tipo marginal</dt><dd>${pct(r.tipoMarginal)}</dd></div>
      <div><dt>Modalidad</dt><dd>${r.modo === "conjunta" ? "Conjunta" : "Individual"}${r.otraModalidad ? `<small>${r.otraModalidad.modo}: ${eur0(r.otraModalidad.cuota)}</small>` : ""}</dd></div>
    </dl>
    ${c.obligado === true ? '<p class="inf-nota">Con estos datos estás obligado a presentar la declaración (art. 96 LIRPF).</p>' : c.obligado === false ? '<p class="inf-nota">Con estos datos no estás obligado a declarar (art. 96 LIRPF).</p>' : ""}
  </section>
  <section class="inf-sec"><h2>Situación de partida</h2>
    <dl class="inf-situacion">${c.situacion.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></section>
  <section class="inf-sec"><h2>Desglose de la liquidación</h2>
    <table class="desglose inf-tabla"><thead><tr><th>Concepto</th><th class="cas">Casilla</th><th class="imp">Importe</th></tr></thead><tbody>${c.desglose.map(filaD).join("")}</tbody></table></section>
  <section class="inf-sec"><h2>Deducciones aplicadas</h2>
    ${c.deducciones.length ? `<table class="inf-tabla"><thead><tr><th>Deducción</th><th>Norma</th><th class="imp">Importe</th></tr></thead><tbody>${c.deducciones.map(d =>
      `<tr><td>${esc(d.nombre)}</td><td class="inf-norma">${esc(d.norma)}${d.estado && d.estado !== "confirmado" ? ` <span class="inf-estado">${esc(d.estado)}</span>` : ""}</td><td class="imp">−${eur(d.importe)}</td></tr>`).join("")}</tbody></table>`
      : '<p class="inf-nota">Con estos datos no se aplica ninguna deducción.</p>'}</section>
  <section class="inf-sec"><h2>Cómo pagar menos</h2>
    ${c.consejos.length ? `<ol class="inf-consejos">${c.consejos.map(k => `<li><div class="inf-con-cab"><b>${esc(k.titulo)}</b><span>${k.ahorro == null ? "" : (k.yaAplicado ? "" : "−") + eur0(k.ahorro) + "/año"}</span></div>
      <p><span class="inf-cat">${esc(CAT[k.categoria] || k.categoria)}</span>${esc(k.detalle)}</p></li>`).join("")}</ol>`
      : '<p class="inf-nota">El motor no detecta palancas de ahorro relevantes para esta situación.</p>'}</section>
  <footer class="inf-pie">
    ${c.avisos.map(a => `<p>${esc(a)}</p>`).join("")}
    <p>Simulación orientativa calculada por el motor de Mapafiscal con la normativa del ejercicio ${c.ejercicio} (escalas, mínimos y deducciones con su norma en ${esc(web.replace(/\/$/, ""))}/#metodologia). No sustituye a la declaración oficial ni a un asesoramiento profesional. Los datos no se guardan: el informe se calcula en tu navegador.</p>
  </footer>
</article>`;
  }

  const API = { desbloqueo, contenido, planOptimo, html, PRECIO: 1.99 };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }
  window.MapafiscalInforme = API;

  // ==== navegador ==========================================================================
  const CFG = window.MAPAFISCAL_CONFIG || {};
  const $ = id => document.getElementById(id);
  const PENDIENTE = "mapafiscal.informePendiente", RECOMPENSA = "mapafiscal.informeRecompensa";
  const guardar = (almacen, k, v) => { try { v == null ? almacen.removeItem(k) : almacen.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const leer = (almacen, k) => { try { return JSON.parse(almacen.getItem(k) || "null"); } catch (e) { return null; } };
  const app = () => window.MapafiscalApp;
  const precioTxt = () => eur(num(CFG.informePrecio) || API.PRECIO);

  let comprado = {};          // ejercicio -> true (informes_comprados)
  async function comprobarCompra(ej) {
    const a = app(), s = a && a.sesion();
    if (!CFG.informePago || !a || !a.sb || !s.usuario) return false;
    if (comprado[ej]) return true;
    const { data } = await a.sb.from("informes_comprados").select("id").eq("ejercicio", ej).limit(1);
    comprado[ej] = !!(data && data.length);
    return comprado[ej];
  }
  async function estado() {
    const a = app(), s = a.sesion(), P = a.P();
    const rec = leer(sessionStorage, RECOMPENSA);
    return desbloqueo({ cfg: CFG, demo: !a.sb, usuario: !!s.usuario, plan: s.plan,
      comprado: await comprobarCompra(P.ejercicio), recompensa: !!(rec && rec.ejercicio === P.ejercicio) });
  }

  // capa del informe (fuera de <main>): barra con «Descargar PDF» y el documento o el candado
  function capa() {
    let el = $("informe");
    if (el) return el;
    el = document.createElement("div");
    el.id = "informe"; el.className = "informe"; el.hidden = true;
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Informe completo");
    el.innerHTML = `<div class="inf-barra"><span class="inf-barra-tit">Informe completo</span>
      <button class="btn btn-pri btn-sm" type="button" id="inf-pdf" hidden>Descargar PDF</button>
      <button class="btn btn-sec btn-sm" type="button" id="inf-cerrar">Cerrar</button></div><div class="inf-cuerpo" id="inf-cuerpo"></div>`;
    document.body.appendChild(el);
    $("inf-cerrar").addEventListener("click", cerrar);
    $("inf-pdf").addEventListener("click", descargar);
    el.addEventListener("keydown", e => { if (e.key === "Escape") cerrar(); });
    el.addEventListener("click", e => { const b = e.target.closest("[data-inf]"); if (b) accion(b.dataset.inf); });
    return el;
  }
  function cerrar() { const el = $("informe"); if (el) el.hidden = true; document.body.classList.remove("con-informe"); const b = $("btn-informe"); if (b) b.focus(); }

  async function abrir() {
    const a = app(), u = a && a.ultimo();
    if (!u) return;
    const el = capa(), cuerpo = $("inf-cuerpo");
    el.hidden = false; document.body.classList.add("con-informe");
    cuerpo.innerHTML = '<p class="inf-cargando">Preparando el informe…</p>';
    const e = await estado();
    $("inf-pdf").hidden = !e.desbloqueado;
    if (e.desbloqueado) {
      const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
      cuerpo.innerHTML = html(contenido(u.hogar, a.P()), { banner: e.banner, afiliado: CFG.informeAfiliado, fecha, web: CFG.webPublica || "https://mapafiscal.es/" });
    } else cuerpo.innerHTML = candado(e);
    $("inf-cerrar").focus();
  }

  function candado(e) {
    const s = app().sesion();
    const OP = {
      acceso: `<button class="btn btn-pri" type="button" data-inf="acceso">Crear cuenta gratis o entrar</button><p class="ayuda">Con la cuenta gratuita, el informe es gratis (por ahora).</p>`,
      anuncio: `<button class="btn btn-pri" type="button" data-inf="anuncio">Ver un anuncio (~1 minuto)</button>`,
      pago: `<button class="btn btn-sec" type="button" data-inf="pago">Pago único de ${precioTxt()}</button>${s.usuario ? "" : '<p class="ayuda">Para pagar hace falta una cuenta (gratis).</p>'}`,
      plan: `<a class="btn btn-txt" href="#planes" data-inf="planes">Incluido en el plan Gestor</a>`
    };
    return `<div class="inf-candado tarjeta"><h2>Desbloquea tu informe completo</h2>
      <p>Desglose línea a línea, deducciones aplicadas con su norma y cómo pagar menos, en un PDF para guardar.</p>
      <div class="inf-opciones">${e.opciones.map(o => OP[o]).join("")}</div>
      <p class="ayuda">El resultado básico de la calculadora sigue siendo gratis y sin condiciones.</p>
      <p class="mensaje" id="inf-msg" role="status"></p></div>`;
  }

  // lo que hay que recuperar si la página se recarga (enlace del correo, Google o Stripe)
  function recordarPendiente() {
    const u = app().ultimo();
    if (u) guardar(localStorage, PENDIENTE, { hogar: u.hogar, ejercicio: app().P().ejercicio, t: Date.now() });
  }
  async function accion(que) {
    const a = app(), s = a.sesion(), msg = $("inf-msg");
    if (que === "planes") { cerrar(); return; }
    if (que === "acceso" || (que === "pago" && !s.usuario)) {
      recordarPendiente();
      a.abrirAcceso(que === "pago" ? `Inicia sesión o crea tu cuenta para pagar el informe completo (${precioTxt()}, IVA incluido).`
        : "Crea tu cuenta gratis o inicia sesión para descargar el informe completo.", { destino: "calculadora" });
      return;
    }
    if (que === "pago") {
      recordarPendiente();
      if (msg) msg.textContent = "Abriendo el pago…";
      const { data, error } = await a.sb.functions.invoke("crear-checkout", { body: { producto: "informe", ejercicio: a.P().ejercicio, volver: location.origin + location.pathname } });
      if (!error && data && data.url) { location.href = data.url; return; }
      let codigo = null;
      try { codigo = (await error.context.json()).error; } catch (e) { /* sin cuerpo JSON */ }
      if (codigo === "ya_incluido") { await a.recargarSesion(); abrir(); return; }
      if (msg) { msg.textContent = "El pago no está disponible en este momento. Inténtalo de nuevo más tarde."; msg.className = "mensaje error"; }
      return;
    }
    if (que === "anuncio") {
      if (msg) msg.textContent = "Cargando el anuncio…";
      let ok = false;
      try { ok = await verAnuncios(Math.min(3, Math.max(1, num(CFG.informeAnuncios) || 1))); } catch (e) { ok = false; }
      if (ok) { guardar(sessionStorage, RECOMPENSA, { ejercicio: a.P().ejercicio, t: Date.now() }); abrir(); }
      else if (msg) { msg.textContent = "No hay ningún anuncio disponible ahora mismo. Prueba más tarde o con otra opción."; msg.className = "mensaje error"; }
    }
  }

  // Anuncio bonificado: true solo si se ha visto hasta el final (la recompensa la concede la red).
  // Gancho: window.MapafiscalInforme.proveedorAnuncio = async () => boolean sustituye al de GPT.
  async function verAnuncios(n) {
    if (!CFG.informeAnuncio) return false;
    const ver = API.proveedorAnuncio || anuncioGpt;
    for (let i = 0; i < n; i++) if (!await ver(i, n)) return false;
    return true;
  }
  /*ANUNCIO-BONIFICADO*/
  // Google Publisher Tag, formato «rewarded» (Ad Manager). Requiere `informeAnuncioUnidad`
  // (ruta del bloque, p. ej. "/1234567/informe_bonificado") y el consentimiento de la CMP.
  function anuncioGpt() {
    const unidad = CFG.informeAnuncioUnidad;
    if (!unidad) return Promise.resolve(false);
    return new Promise(resolver => {
      window.googletag = window.googletag || { cmd: [] };
      if (!document.querySelector("script[data-gpt]")) {
        const sc = document.createElement("script");
        sc.async = true; sc.dataset.gpt = "1";
        sc.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
        sc.onerror = () => resolver(false);
        document.head.appendChild(sc);
      }
      const gt = window.googletag;
      gt.cmd.push(() => {
        const slot = gt.defineOutOfPageSlot(unidad, gt.enums.OutOfPageFormat.REWARDED);
        if (!slot) { resolver(false); return; }
        slot.addService(gt.pubads());
        let concedido = false;
        const fin = () => { gt.destroySlots([slot]); resolver(concedido); };
        gt.pubads().addEventListener("rewardedSlotReady", ev => { if (ev.slot === slot) ev.makeRewardedVisible(); });
        gt.pubads().addEventListener("rewardedSlotGranted", ev => { if (ev.slot === slot) concedido = true; });
        gt.pubads().addEventListener("rewardedSlotClosed", ev => { if (ev.slot === slot) fin(); });
        gt.pubads().addEventListener("slotRenderEnded", ev => { if (ev.slot === slot && ev.isEmpty) fin(); });
        gt.enableServices();
        gt.display(slot);
      });
    });
  }
  /*/ANUNCIO-BONIFICADO*/

  // «Descargar PDF»: imprime solo el informe (css: body.imprimiendo-informe) con un título que
  // el navegador usa como nombre del fichero.
  function descargar() {
    const P = app().P(), u = app().ultimo();
    const titulo = document.title;
    document.title = `Informe IRPF ${P.ejercicio} - ${nombreT(P, u.hogar.territorio)} - Mapafiscal`;
    document.body.classList.add("imprimiendo-informe");
    const fin = () => { document.body.classList.remove("imprimiendo-informe"); document.title = titulo; window.removeEventListener("afterprint", fin); };
    window.addEventListener("afterprint", fin);
    window.print();
    setTimeout(fin, 1000);   // navegadores sin afterprint (print() ya ha vuelto)
  }

  // Tras volver del acceso o de Stripe: recuperar la situación y abrir el informe.
  let esperandoPago = /informe=pagado/.test(location.hash);
  async function alCargarSesion() {
    const a = app();
    if (!a) return;
    const p = leer(localStorage, PENDIENTE);
    const vigente = p && Date.now() - p.t < 2 * 3600e3;
    if (!vigente || !a.sesion().usuario) { if (!vigente) guardar(localStorage, PENDIENTE, null); return; }
    if (esperandoPago) {
      esperandoPago = false;
      // el webhook apunta el pago en unos segundos
      for (let i = 0; i < 10 && !await comprobarCompra(p.ejercicio); i++) { delete comprado[p.ejercicio]; await new Promise(r => setTimeout(r, 2000)); }
    }
    guardar(localStorage, PENDIENTE, null);
    await a.restaurar(p.hogar, p.ejercicio);
    a.irA("calculadora");
    abrir();
  }

  function iniciar() {
    const b = $("btn-informe");
    if (!b) return;
    // app.js arranca tras cargar los datos: puede llegar después que este script
    if (!app()) { document.addEventListener("mapafiscal:app", iniciar, { once: true }); return; }
    b.hidden = false;
    b.addEventListener("click", abrir);
    document.addEventListener("mapafiscal:sesion", alCargarSesion);
    if (app().sesionCargada()) alCargarSesion();
  }
  iniciar();
})();
