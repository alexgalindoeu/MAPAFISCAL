/* =============================================================================
 * Mapafiscal — aplicación web
 * Motor: irpfsim.js (port validado del motor R). Datos: params.json + mapa_es.json.
 * Backend opcional: Supabase (cuentas, clientes, lista de espera, pagos).
 * ========================================================================== */
(async function () {
  "use strict";
  const CFG = window.MAPAFISCAL_CONFIG || {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur = (n, dec = 2) => {
    const v = Math.abs(n || 0).toFixed(dec).split(".");
    return (n < -0.004 ? "−" : "") + miles(v[0]) + (dec ? "," + v[1] : "") + " €";
  };
  const eur0 = n => eur(n, 0);
  const pct = n => (100 * (n || 0)).toFixed(2).replace(".", ",") + " %";
  const num = id => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : 0; };
  const camel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

  // ---- datos: embebidos (versión autónoma) o servidos junto a la web ---------------
  async function datos(idScript, url) {
    const el = document.getElementById(idScript);
    if (el) return JSON.parse(el.textContent);
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("No se pudo cargar " + url);
    return r.json();
  }
  let P, MAPA;
  try {
    [P, MAPA] = await Promise.all([datos("datos-params", "datos/params.json"), datos("datos-mapa", "datos/mapa_es.json")]);
  } catch (e) {
    document.querySelector("main").innerHTML = `<div class="tarjeta" style="margin-top:32px">No se han podido cargar los datos de la normativa (${esc(e.message)}). Recarga la página.</div>`;
    return;
  }
  const T = P.territorios;
  $("pie-generado").textContent = "parámetros generados el " + P.generado.split("-").reverse().join("/");

  // ---- Supabase ----------------------------------------------------------------------
  const sb = (!CFG.demo && CFG.supabaseUrl && window.supabase)
    ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;
  const sesion = { usuario: null, perfil: null, clientes: [] };
  let clienteAbierto = null;    // { id, alias, notas }

  // ---- territorios --------------------------------------------------------------------
  const ORDEN = ["ES-AN", "ES-AR", "ES-AS", "ES-IB", "ES-CN", "ES-CB", "ES-CL", "ES-CM", "ES-CT", "ES-EX", "ES-GA",
    "ES-MD", "ES-MC", "ES-RI", "ES-VC", "ES-PV-VI", "ES-PV-BI", "ES-PV-SS", "ES-NC"];
  const CORTO = { "ES-AN": "Andalucía", "ES-AR": "Aragón", "ES-AS": "Asturias", "ES-IB": "Illes Balears", "ES-CN": "Canarias",
    "ES-CB": "Cantabria", "ES-CL": "Castilla y León", "ES-CM": "Castilla-La Mancha", "ES-CT": "Cataluña", "ES-EX": "Extremadura",
    "ES-GA": "Galicia", "ES-MD": "Madrid", "ES-MC": "Murcia", "ES-RI": "La Rioja", "ES-VC": "C. Valenciana",
    "ES-PV-VI": "Araba/Álava", "ES-PV-BI": "Bizkaia", "ES-PV-SS": "Gipuzkoa", "ES-NC": "Navarra" };
  const REGIMEN = { comun: "Régimen común", foral_pais_vasco: "Foral · País Vasco", foral_navarra: "Foral · Navarra" };
  const corto = t => CORTO[t] || (T[t] ? T[t].nombre : t);

  const selTerr = $("f-territorio");
  selTerr.innerHTML = ORDEN.filter(c => T[c]).map(c =>
    `<option value="${c}">${esc(T[c].nombre)}${T[c].regimen !== "comun" ? " (foral)" : ""}</option>`).join("");
  selTerr.value = "ES-MD";

  // ---- gastos que dan derecho a deducción, según territorio ---------------------------
  const ETIQUETAS = {
    gastos_guarderia: "Guardería o escuela infantil",
    gastos_idiomas_informatica: "Clases de idiomas o informática",
    gastos_idiomas_extranjeros: "Clases extraescolares de idiomas",
    gastos_libros_texto: "Libros de texto y material escolar",
    cuotas_ss_empleada_hogar: "Cotizaciones a la Seguridad Social de empleada del hogar",
    gastos_empleada_hogar: "Salario de la persona que cuida de tus hijos en casa",
    gastos_escuela_infantil_cyl: "Escuela infantil o guardería (hijos de 0 a 3 años)",
    gastos_cuidado_hijos: "Cuidado de hijos pequeños (guardería o cuidador)",
    gastos_conciliacion_menores: "Cuidado de hijos menores de 6 años",
    gastos_deporte: "Gimnasio, clubes y actividades deportivas",
    gastos_emancipacion: "Gastos de emancipación (mudanza, mobiliario, fianza)",
    gastos_estudios_no_superiores: "Gastos de estudios no universitarios de tus hijos",
    gastos_enfermedad: "Gastos de enfermedad (consultas, dentista, óptica)",
    gastos_escolaridad: "Escolaridad en educación obligatoria",
    gastos_idiomas: "Clases de idiomas extranjeros",
    gastos_vestuario_escolar: "Uniformes y vestuario escolar",
    gastos_internet: "Conexión a internet (jóvenes emancipados)",
    gastos_luz_gas: "Luz y gas de la vivienda (jóvenes emancipados)",
    gastos_abonos_culturales: "Abonos culturales (teatro, música, cine)",
    rehabilitacion_vivienda_pagos: "Obras de rehabilitación de tu vivienda habitual",
    donativos_lengua_catalana: "Donativos para el fomento de la lengua catalana",
    donativos_investigacion: "Donativos a centros de investigación",
    inversion_angel_inversor: "Inversión en empresas de nueva creación",
    inversion_cooperativas_cat: "Aportaciones al capital de cooperativas"
  };
  const etiqueta = c => ETIQUETAS[c] || c.replace(/_/g, " ").replace(/^./, m => m.toUpperCase());

  function camposDe(terr) {
    const lista = (T[terr] && T[terr].deducciones_autonomicas && T[terr].deducciones_autonomicas.lista) || [];
    const hogar = new Map(), hijo = new Map();
    for (const d of lista) {
      if (!d.campo || d.campo === "alquiler_vivienda_pagos") continue;
      if (d.tipo === "porcentaje_campo_hijo") {
        const prev = hijo.get(d.campo);
        const max = d.edad_hijo_max != null ? d.edad_hijo_max : 25;
        hijo.set(d.campo, prev == null ? max : Math.max(prev, max));
      } else if (d.tipo === "porcentaje_campo") hogar.set(d.campo, true);
    }
    return { hogar: [...hogar.keys()], hijo: [...hijo.entries()] };
  }

  // deducciones del territorio que dependen del municipio de residencia
  function reglasMunicipio(terr) {
    const lista = (T[terr] && T[terr].deducciones_autonomicas && T[terr].deducciones_autonomicas.lista) || [];
    const tramos = new Set();
    let despoblada = false;
    for (const d of lista) {
      if (d.municipio_hab_max != null) tramos.add(d.municipio_hab_max);
      if (d.incremento_municipio) tramos.add(d.incremento_municipio.hab_max);
      if (d.requiere_zona_despoblada || d.excluye_zona_despoblada) despoblada = true;
    }
    return { tramos: [...tramos].sort((a, b) => a - b), despoblada, hay: tramos.size > 0 || despoblada };
  }
  function pintarAyudaMunicipio() {
    const terr = selTerr.value, r = reglasMunicipio(terr);
    const habitantes = n => (n + 1) % 1000 === 0 ? "menos de " + miles(String(n + 1)) : "hasta " + miles(String(n));
    const partes = [];
    if (r.tramos.length) partes.push("municipios de " + r.tramos.map(habitantes).join(" y de ") + " habitantes");
    if (r.despoblada) partes.push("zonas de la lista oficial de despoblación");
    $("ayuda-municipio").textContent = r.hay
      ? `En ${corto(terr)} hay deducciones para ${partes.join(" y para ")}.`
      : `En ${corto(terr)} ninguna deducción depende del municipio; el dato cuenta al comparar con otros territorios.`;
  }

  // ---- estado del formulario ----------------------------------------------------------
  let hijos = [];                 // [{ edad, gastos: { campo: importe } }]
  const gastosHogar = {};         // campo -> importe (se conserva al cambiar de territorio)
  let ssManual = false;

  function pintarHijos() {
    const terr = selTerr.value, { hijo: camposHijo } = camposDe(terr);
    $("lista-hijos").innerHTML = hijos.map((h, i) => {
      const extras = camposHijo.filter(([, max]) => h.edad <= max).map(([c]) =>
        `<label>${esc(etiqueta(c))} <input type="number" min="0" step="10" data-hijo="${i}" data-campo="${c}" value="${h.gastos[c] || 0}" aria-label="${esc(etiqueta(c))}, hijo ${i + 1}"> €</label>`).join("");
      return `<li class="hijo">
        <span class="hijo-n">Hijo ${i + 1}</span>
        <input type="number" min="0" max="30" step="1" value="${h.edad}" data-hijo-edad="${i}" aria-label="Edad del hijo ${i + 1}">
        <div class="hijo-extra">${h.edad === 0 ? '<span class="ayuda">Nacido en 2025</span>' : '<span class="ayuda">años</span>'}${extras}</div>
        <button class="btn btn-txt btn-sm" type="button" data-quitar="${i}" aria-label="Quitar hijo ${i + 1}">Quitar</button>
      </li>`;
    }).join("");
  }
  function pintarGastosTerritorio() {
    const terr = selTerr.value, { hogar: campos } = camposDe(terr);
    $("campo-compra").hidden = T[terr].regimen !== "foral_pais_vasco";
    // deducciones estatales (vivienda anterior a 2013 y donativos): solo régimen común
    for (const id of ["campo-hipoteca", "campo-donativos", "casilla-donativos-rec"]) $(id).hidden = T[terr].regimen !== "comun";
    pintarAyudaMunicipio();
    if (!campos.length) { $("gastos-territorio").innerHTML = ""; return; }
    $("gastos-territorio").innerHTML = `<p class="gastos-titulo">Otros gastos con deducción en ${esc(corto(terr))}</p>` +
      campos.map(c => `<div class="campo"><label for="g-${c}">${esc(etiqueta(c))}</label>
        <div class="con-sufijo"><input type="number" id="g-${c}" min="0" step="10" data-gasto="${c}" value="${gastosHogar[c] || 0}"><span>€</span></div></div>`).join("");
  }

  $("form").addEventListener("input", e => {
    const t = e.target;
    if ((t.id === "f-salario" || t.id === "f-pension") && !ssManual)
      $("f-ss").value = $("f-pension").checked ? 0 : Math.round(num("f-salario") * 0.0635);
    if (t.id === "f-ss") { ssManual = true; $("ayuda-ss").textContent = "Importe introducido por ti."; }
    if (t.dataset.hijoEdad != null) {
      hijos[+t.dataset.hijoEdad].edad = Math.max(0, Math.min(30, parseInt(t.value, 10) || 0));
      clearTimeout(pintarHijos._t); pintarHijos._t = setTimeout(() => { const f = document.activeElement && document.activeElement.dataset.hijoEdad; pintarHijos(); if (f != null) { const el = document.querySelector(`[data-hijo-edad="${f}"]`); if (el) { el.focus(); el.select && el.select(); } } }, 600);
    }
    if (t.dataset.hijo != null && t.dataset.campo) hijos[+t.dataset.hijo].gastos[t.dataset.campo] = parseFloat(t.value) || 0;
    if (t.dataset.gasto) gastosHogar[t.dataset.gasto] = parseFloat(t.value) || 0;
    if (t.name === "pareja") $("bloque-pareja").hidden = t.value !== "si";
    recalcular();
  });
  selTerr.addEventListener("change", () => { pintarHijos(); pintarGastosTerritorio(); recalcular(); });
  $("btn-hijo").addEventListener("click", () => { hijos.push({ edad: 5, gastos: {} }); pintarHijos(); recalcular(); });
  $("lista-hijos").addEventListener("click", e => {
    const q = e.target.closest("[data-quitar]");
    if (q) { hijos.splice(+q.dataset.quitar, 1); pintarHijos(); recalcular(); }
  });

  // ---- formulario -> hogar (forma que consume irpfsim.js) --------------------------------
  function construirHogar(territorio) {
    const pareja = document.querySelector('input[name="pareja"]:checked').value === "si";
    const salario = num("f-salario"), ganancia = num("f-ganancias");
    const d1 = {
      id: "d1", rol: "declarante", edad: num("f-edad") || 40, discapacidad: $("f-discapacidad").value,
      desempleado: $("f-desempleado").checked,
      trabajo: salario > 0 ? { dinerarias: salario, cotizacionesSs: num("f-ss"), pensionJubilacion: $("f-pension").checked } : null,
      capitalMobiliario: (num("f-intereses") > 0 || num("f-dividendos") > 0) ? { intereses: num("f-intereses"), dividendos: num("f-dividendos") } : null,
      capitalInmobiliario: num("f-alquileres") > 0 ? [{ ingresos: num("f-alquileres"), gastosDeducibles: 0 }] : null,
      actividades: num("f-actividad") > 0 ? { metodo: "directa_simplificada", rendimientoNetoPrevio: num("f-actividad") } : null,
      ganancias: ganancia !== 0 ? [{ valorTransmision: Math.max(0, ganancia), valorAdquisicion: Math.max(0, -ganancia),
        fechaAdquisicion: "2020-01-15", fechaTransmision: "2025-06-30", tipoElemento: "accion_cotizada", esTransmision: true }] : [],
      previsionSocial: num("f-pensiones") > 0 ? { aportacionIndividual: num("f-pensiones") } : null,
      alquilerViviendaPagos: num("f-alquiler"),
      adquisicionViviendaPagos: num("f-compra"),
      viviendaTransitoriaPagos: num("f-hipoteca"),
      donativos: num("f-donativos"), donativosRecurrentes: $("f-donativos-rec").checked,
      retenciones: num("f-retenciones")
    };
    for (const [c, v] of Object.entries(gastosHogar)) if (v > 0) d1[camel(c)] = v;
    const miembros = [d1];
    if (pareja) {
      const ps = num("f-pareja-salario");
      miembros.push({ id: "d2", rol: "conyuge", edad: num("f-pareja-edad") || 40,
        trabajo: ps > 0 ? { dinerarias: ps, cotizacionesSs: Math.round(ps * 0.0635) } : null, retenciones: 0 });
    }
    hijos.forEach((h, i) => {
      const m = { id: "h" + (i + 1), rol: "descendiente", edad: h.edad, rentasPropias: 0, nacidoEnEjercicio: h.edad === 0 };
      for (const [c, v] of Object.entries(h.gastos)) if (v > 0) m[camel(c)] = v;
      miembros.push(m);
    });
    const asc = $("f-ascendientes").value;
    if (asc === "65") miembros.push({ id: "a1", rol: "ascendiente", edad: 70, rentasPropias: 0 });
    if (asc === "75" || asc === "75x2") miembros.push({ id: "a1", rol: "ascendiente", edad: 80, rentasPropias: 0 });
    if (asc === "75x2") miembros.push({ id: "a2", rol: "ascendiente", edad: 80, rentasPropias: 0 });
    const hab = parseInt($("f-municipio").value, 10);
    return {
      territorio, ejercicio: P.ejercicio,
      tipoUnidadFamiliar: pareja ? "biparental" : (hijos.length ? "monoparental" : "ninguna"),
      familiaNumerosa: $("f-familia-numerosa").value,
      municipioHabitantes: Number.isFinite(hab) && hab > 0 ? hab : null,
      zonaDespoblada: $("f-despoblada").checked,
      miembros
    };
  }

  // hogar guardado -> formulario (abrir cliente)
  function rellenarFormulario(h) {
    const d1 = h.miembros.find(m => m.rol === "declarante") || {};
    const d2 = h.miembros.find(m => m.rol === "conyuge");
    const set = (id, v) => { $(id).value = v == null ? 0 : v; };
    selTerr.value = h.territorio;
    set("f-salario", d1.trabajo ? d1.trabajo.dinerarias : 0);
    set("f-ss", d1.trabajo ? d1.trabajo.cotizacionesSs : 0); ssManual = true;
    $("f-pension").checked = !!(d1.trabajo && d1.trabajo.pensionJubilacion);
    $("f-municipio").value = h.municipioHabitantes != null ? h.municipioHabitantes : "";
    $("f-despoblada").checked = !!h.zonaDespoblada;
    set("f-intereses", d1.capitalMobiliario ? d1.capitalMobiliario.intereses : 0);
    set("f-dividendos", d1.capitalMobiliario ? d1.capitalMobiliario.dividendos : 0);
    const g = (d1.ganancias || [])[0];
    set("f-ganancias", g ? (g.valorTransmision || 0) - (g.valorAdquisicion || 0) : 0);
    set("f-alquileres", d1.capitalInmobiliario && d1.capitalInmobiliario[0] ? d1.capitalInmobiliario[0].ingresos : 0);
    set("f-actividad", d1.actividades ? d1.actividades.rendimientoNetoPrevio : 0);
    set("f-pensiones", d1.previsionSocial ? d1.previsionSocial.aportacionIndividual : 0);
    set("f-alquiler", d1.alquilerViviendaPagos); set("f-compra", d1.adquisicionViviendaPagos);
    set("f-hipoteca", d1.viviendaTransitoriaPagos); set("f-donativos", d1.donativos);
    $("f-donativos-rec").checked = !!d1.donativosRecurrentes;
    set("f-retenciones", d1.retenciones); set("f-edad", d1.edad);
    $("f-discapacidad").value = d1.discapacidad || "no";
    $("f-desempleado").checked = !!d1.desempleado;
    document.querySelector(`input[name="pareja"][value="${d2 ? "si" : "no"}"]`).checked = true;
    $("bloque-pareja").hidden = !d2;
    if (d2) { set("f-pareja-edad", d2.edad); set("f-pareja-salario", d2.trabajo ? d2.trabajo.dinerarias : 0); }
    $("f-familia-numerosa").value = h.familiaNumerosa || "no";
    const asc = h.miembros.filter(m => m.rol === "ascendiente");
    $("f-ascendientes").value = asc.length >= 2 ? "75x2" : asc.length ? (asc[0].edad >= 75 ? "75" : "65") : "0";
    const conocidos = new Set(["id", "rol", "edad", "discapacidad", "desempleado", "trabajo", "capitalMobiliario", "capitalInmobiliario",
      "actividades", "ganancias", "previsionSocial", "alquilerViviendaPagos", "adquisicionViviendaPagos", "retenciones", "rentasPropias", "nacidoEnEjercicio",
      "viviendaTransitoriaPagos", "donativos", "donativosRecurrentes"]);
    const snake = s => s.replace(/[A-Z]/g, c => "_" + c.toLowerCase());
    for (const k of Object.keys(gastosHogar)) delete gastosHogar[k];
    for (const [k, v] of Object.entries(d1)) if (!conocidos.has(k) && typeof v === "number") gastosHogar[snake(k)] = v;
    hijos = h.miembros.filter(m => m.rol === "descendiente").map(m => {
      const gastos = {};
      for (const [k, v] of Object.entries(m)) if (!conocidos.has(k) && typeof v === "number") gastos[snake(k)] = v;
      return { edad: m.edad, gastos };
    });
    pintarHijos(); pintarGastosTerritorio(); recalcular();
  }

  // ---- cálculo y resultado ------------------------------------------------------------
  let ultima = null;   // { hogar, liq }
  function tipoMarginal(liq, terr) {
    const b = liq.baseLiquidableGeneral || 0, reg = T[terr].regimen;
    if (reg === "comun") return irpfsim.tipoMarginal(b, P.estatal.escala_general_estatal) + irpfsim.tipoMarginal(b, T[terr].escala_general_autonomica);
    if (reg === "foral_pais_vasco") return irpfsim.tipoMarginal(b, P.foral_pv.escala_general_foral);
    return irpfsim.tipoMarginal(b, P.navarra.escala_general_foral);
  }
  function infoDeduccion(terr, id) {
    const l = (T[terr].deducciones_autonomicas && T[terr].deducciones_autonomicas.lista) || [];
    return l.find(d => d.id === id) || null;
  }
  const NOMBRES_DED = {
    minimoPersonal: "Mínimo personal (deducción foral)", minimoFamiliar: "Mínimo familiar (deducción foral)",
    trabajo: "Deducción por rendimientos del trabajo", maternidad: "Deducción por maternidad",
    familiaNumerosa: "Deducción por familia numerosa", discapacidadFamiliaresCargo: "Deducción por familiares con discapacidad a cargo",
    alquilerVivienda: "Deducción por alquiler de vivienda habitual", adquisicionVivienda: "Deducción por adquisición de vivienda habitual",
    emancipacion: "Deducción por arrendamiento para emancipación", pensionJubilacion: "Deducción por pensiones de jubilación bajas",
    viviendaTransitoria: "Deducción por inversión en vivienda habitual (régimen transitorio)", donativos: "Deducción por donativos (Ley 49/2002)"
  };
  // bloque de params del que sale cada deducción estatal o foral (para citar su norma y su estado)
  const BLOQUE_DED = {
    minimoPersonal: "minimo_personal_deduccion", minimoFamiliar: "minimo_familiar_deduccion", trabajo: "deduccion_trabajo_cuota",
    alquilerVivienda: "deduccion_alquiler_vivienda", adquisicionVivienda: "deduccion_adquisicion_vivienda",
    emancipacion: "deduccion_emancipacion", pensionJubilacion: "deduccion_pension_jubilacion",
    viviendaTransitoria: "deduccion_vivienda_transitoria", donativos: "deduccion_donativos",
    maternidad: "deduccion_maternidad", familiaNumerosa: "deduccion_familia_numerosa_y_discapacidad_cargo",
    discapacidadFamiliaresCargo: "deduccion_familia_numerosa_y_discapacidad_cargo"
  };
  function bloqueDed(reg, id) {
    const fuente = reg === "foral_navarra" ? P.navarra : reg === "foral_pais_vasco" ? P.foral_pv : P.estatal;
    return (BLOQUE_DED[id] && fuente && fuente[BLOQUE_DED[id]]) || null;
  }
  const etqProvisional = '<span class="etq etq-prov" title="Importe o requisitos pendientes de cotejo con la norma">provisional</span>';
  const nombreDed = id => NOMBRES_DED[id] || id.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim().toLowerCase().replace(/^./, c => c.toUpperCase());

  function recalcular() {
    const terr = selTerr.value;
    const hogar = construirHogar(terr);
    let liq;
    try { liq = irpfsim.liquidar(hogar, P, "auto"); }
    catch (e) { $("res-principal").innerHTML = `<p class="vacio">Revisa los datos introducidos.</p>`; return; }
    ultima = { hogar, liq };
    const reg = T[terr].regimen, comun = reg === "comun";
    const ret = num("f-retenciones");
    const cd = liq.cuotaDiferencial;
    // deducciones que se restan de la cuota diferencial (maternidad, familia numerosa, Navarra 68.B…):
    // pueden dar un resultado a devolver aunque no haya retenciones
    const impr = (liq.deduccionesCuotaDiferencial && liq.deduccionesCuotaDiferencial.total) || 0;
    const hayResultado = ret > 0 || impr > 0;
    // deducción por obtención de rendimientos del trabajo (DA 61.ª): cuota líquida -> cuota resultante
    const drt = (liq.deduccionRendimientosTrabajo && liq.deduccionRendimientosTrabajo.total) || 0;
    const cuota = liq.cuotaResultanteAutoliquidacion;
    const nombreCuota = drt ? "Cuota resultante" : "Cuota líquida";

    // cifra principal
    if (hayResultado) {
      const devolver = cd < 0;
      $("res-principal").innerHTML = `<div class="res-etq">Resultado de la declaración</div>
        <div class="res-cifra ${devolver ? "gana" : ""}">${devolver ? "A devolver" : "A ingresar"} ${eur(Math.abs(cd))}</div>
        <p class="res-sub">${nombreCuota} <b>${eur(cuota)}</b>${impr ? ` · deducciones sobre la cuota diferencial <b>${eur(impr)}</b>` : ""}${ret ? ` · retenciones <b>${eur(ret)}</b>` : ""}</p>`;
    } else {
      $("res-principal").innerHTML = `<div class="res-etq">${nombreCuota} del IRPF · ${esc(corto(terr))}</div>
        <div class="res-cifra">${eur(cuota)}</div>
        <p class="res-sub">${drt ? `Incluye la deducción por obtención de rendimientos del trabajo (${eur(drt)}). ` : ""}Añade tus retenciones (paso 5) para saber si te sale a pagar o a devolver.</p>`;
    }
    $("bm-etq").textContent = hayResultado ? (cd < 0 ? "A devolver" : "A ingresar") : nombreCuota + " · " + corto(terr);
    $("bm-cifra").textContent = eur(hayResultado ? Math.abs(cd) : cuota);
    $("bm-cifra").className = "bm-cifra" + (hayResultado && cd < 0 ? " gana" : "");
    const otra = liq.modoTributacionElegido === "conjunta" ? liq.comparativa.individual : liq.comparativa.conjunta;
    const ahorroModo = otra != null ? otra - cuota : 0;
    $("res-kpis").innerHTML = `
      <div><dt>Tipo medio efectivo</dt><dd>${pct(liq.tipoMedioEfectivo)}</dd></div>
      <div><dt>Tipo marginal</dt><dd>${pct(tipoMarginal(liq, terr))}</dd></div>
      <div><dt>Mejor modalidad</dt><dd>${liq.modoTributacionElegido === "conjunta" ? "Conjunta" : "Individual"}</dd></div>`;
    $("btn-guardar-cliente").textContent = clienteAbierto ? "Guardar cambios del cliente" : "Guardar como cliente";

    // desglose
    const filas = [];
    const f = (concepto, casilla, importe, cls = "") => filas.push(`<tr class="${cls}"><td>${concepto}</td><td class="cas">${casilla ? `<span class="cod">${casilla}</span>` : ""}</td><td class="imp">${importe}</td></tr>`);
    f("Base imponible general", "0435", eur(liq.baseImponibleGeneral));
    if (liq.baseImponibleAhorro) f("Base imponible del ahorro", "0460", eur(liq.baseImponibleAhorro));
    const reducciones = liq.baseImponibleGeneral - liq.baseLiquidableGeneral;
    if (reducciones > 0.5) f("Reducciones de la base (planes de pensiones, tributación conjunta)", "", "−" + eur(reducciones), "menos");
    f("Base liquidable general", "0500", eur(liq.baseLiquidableGeneral), "sub");
    if (liq.baseLiquidableAhorro) f("Base liquidable del ahorro", "0510", eur(liq.baseLiquidableAhorro), "sub");
    if (comun) {
      if (liq.minimoPersonalFamiliar && liq.minimoPersonalFamiliar.total) f("Mínimo personal y familiar (parte de la base que tributa al 0 %)", "", eur(liq.minimoPersonalFamiliar.total), "info");
      // mínimo con los importes propios de la comunidad, que solo cuenta para la cuota autonómica
      const mAut = liq.minimoPersonalFamiliarAutonomico;
      if (mAut && Math.abs(mAut.total - liq.minimoPersonalFamiliar.total) > 0.005) f("Mínimo autonómico de " + esc(corto(terr)) + " (solo para la cuota autonómica)", "", eur(mAut.total), "info");
      f("Cuota íntegra estatal", "", eur(liq.cuotaIntegraEstatal));
      f("Cuota íntegra autonómica", "0546", eur(liq.cuotaIntegraAutonomica));
      const de = liq.deduccionesEstatales, deTot = de ? de.totalEstatal + de.totalAutonomico : 0;
      if (deTot) f("Deducciones generales (vivienda anterior a 2013, donativos)", "", "−" + eur(deTot), "menos");
      const da = (liq.deduccionesAutonomicas && liq.deduccionesAutonomicas.total) || 0;
      if (da) f("Deducciones autonómicas", "0564", "−" + eur(da), "menos");
    } else {
      f("Cuota íntegra foral", "", eur(liq.cuotaIntegraAutonomica));
      if (liq.minoracionCuota) f("Minoración general de la cuota", "", "−" + eur(liq.minoracionCuota), "menos");
      const da = (liq.deduccionesAutonomicas && liq.deduccionesAutonomicas.total) || 0;
      if (da) f(reg === "foral_navarra" ? "Deducciones de la cuota (mínimos y trabajo)" : "Deducciones forales", "", "−" + eur(da), "menos");
    }
    f("Cuota líquida total", "", eur(liq.cuotaLiquidaTotal), "sub");
    if (drt) {
      f("Deducción por obtención de rendimientos del trabajo", "", "−" + eur(drt), "menos");
      f("Cuota resultante de la autoliquidación", "", eur(cuota), "sub");
    }
    if (impr) f(reg === "foral_navarra" ? "Deducciones sobre la cuota diferencial (emancipación, pensiones)"
      : "Deducciones por maternidad, familia numerosa o discapacidad", "", "−" + eur(impr), "menos");
    if (ret) f("Retenciones e ingresos a cuenta", "", "−" + eur(ret), "menos");
    if (hayResultado) f(cd < 0 ? "Resultado: a devolver" : "Resultado: a ingresar", "", eur(Math.abs(cd)), "total");
    else filas[filas.length - 1] = filas[filas.length - 1].replace('class="sub"', 'class="total"');
    $("res-desglose").innerHTML = filas.join("");

    // deducciones aplicadas
    const det = Object.assign({}, (liq.deduccionesAutonomicas && liq.deduccionesAutonomicas.detalle) || {});
    const detImp = (liq.deduccionesCuotaDiferencial && liq.deduccionesCuotaDiferencial.detalle) || {};
    const items = Object.entries(det).filter(([, v]) => v > 0).map(([id, v]) => {
      const inf = comun ? infoDeduccion(terr, id) : bloqueDed(reg, id);
      const prov = inf && inf.estado === "provisional" ? etqProvisional : "";
      const norma = inf && inf.norma ? inf.norma : (comun ? "" : (reg === "foral_navarra" ? "Texto Refundido del IRPF de Navarra" : "Normativa foral del Territorio Histórico"));
      return `<li><span class="ded-nombre">${esc(nombreDed(id))}${prov}</span><span class="ded-norma">${esc(norma)}</span><span class="ded-imp">−${eur(v)}</span></li>`;
    }).concat(Object.entries(detImp).filter(([, v]) => v > 0).map(([id, v]) => {
      const inf = bloqueDed(reg, id);
      const prov = inf && inf.estado === "provisional" ? etqProvisional : "";
      const norma = (inf && inf.norma ? inf.norma : "Arts. 81 y 81 bis LIRPF") + " · se resta de la cuota diferencial";
      return `<li><span class="ded-nombre">${esc(nombreDed(id))}${prov}</span><span class="ded-norma">${esc(norma)}</span><span class="ded-imp">−${eur(v)}</span></li>`;
    }));
    const detEst = (liq.deduccionesEstatales && liq.deduccionesEstatales.detalle) || {};
    for (const [id, v] of Object.entries(detEst).filter(([, v]) => v > 0)) {
      const inf = bloqueDed("comun", id);
      items.push(`<li><span class="ded-nombre">${esc(nombreDed(id))}</span><span class="ded-norma">${esc(inf && inf.norma ? inf.norma : "LIRPF")} · mitad en la cuota estatal y mitad en la autonómica</span><span class="ded-imp">−${eur(v)}</span></li>`);
    }
    if (drt) {
      const inf = P.estatal.deduccion_obtencion_rendimientos_trabajo;
      items.push(`<li><span class="ded-nombre">Deducción por obtención de rendimientos del trabajo${inf.estado === "provisional" ? etqProvisional : ""}</span><span class="ded-norma">${esc(inf.norma)} · se resta de la cuota líquida total</span><span class="ded-imp">−${eur(drt)}</span></li>`);
    }
    $("res-deducciones").innerHTML = items.length ? items.join("")
      : `<li class="vacio">Con estos datos no se aplica ninguna deducción. Revisa los gastos del paso 4: dependen de tu territorio.</li>`;

    // palancas (optimizador)
    const CAT = { declaracion: "Declaración", prevision: "Ahorro", territorio: "Residencia", deduccion_potencial: "Revisar" };
    let opt = { recomendaciones: [] };
    try { opt = irpfsim.optimizar(hogar, P); } catch (e) { /* sin palancas */ }
    const recs = opt.recomendaciones.filter(r => !(r.id === "modo" && r.yaAplicado)).slice(0, 5);
    $("res-palancas").innerHTML = recs.length ? recs.map(r => `<li><div class="pal-cab"><span class="pal-tit">${esc(r.titulo)}</span>
        ${r.ahorro == null ? '<span class="pal-imp rev">a revisar</span>' : `<span class="pal-imp">−${eur0(r.ahorro)}/año</span>`}</div>
        <div class="pal-det"><span class="etq etq-prov" style="margin:0 6px 0 0;background:var(--marca-suave);color:var(--marca-tinta)">${CAT[r.categoria] || r.categoria}</span>${esc(r.detalle)}</div></li>`).join("")
      : `<li class="vacio">No se detectan palancas de ahorro relevantes para esta situación.</li>`;
    if (ahorroModo >= 1) $("res-palancas").insertAdjacentHTML("afterbegin",
      `<li><div class="pal-cab"><span class="pal-tit">Ya aplicada: declaración ${liq.modoTributacionElegido}</span><span class="pal-imp">−${eur0(ahorroModo)}/año</span></div><div class="pal-det">Frente a la declaración ${liq.modoTributacionElegido === "conjunta" ? "individual" : "conjunta"}.</div></li>`);

    // avisos
    const av = [];
    const da = T[terr].deducciones_autonomicas;
    if (comun && da && da.lista) {
      const pend = (da.pendientes || []).filter(p => typeof p === "string" && p[0] !== "(").length;
      av.push(`${esc(T[terr].nombre)}: ${da.lista.length} deducciones autonómicas modeladas${pend ? `; ${pend} del catálogo oficial aún no (inversión y donativos, entre otras)` : ""}.`);
    }
    if (reg === "foral_pais_vasco") av.push("País Vasco: deducciones familiares y de vivienda con los importes de 2025; algunos de Bizkaia y Álava están pendientes de cotejo.");
    if (reg === "foral_navarra") av.push("Navarra: incluye alquiler, emancipación y pensiones de jubilación bajas; faltan las deducciones por adquisición de vivienda y por familia numerosa, así que la cuota puede estar algo sobreestimada.");
    if (reglasMunicipio(terr).hay && hogar.municipioHabitantes == null && !hogar.zonaDespoblada)
      av.push(`No has indicado tu municipio: las deducciones de ${esc(corto(terr))} para municipios pequeños o zonas en riesgo de despoblación no se aplican.`);
    if (num("f-actividad") > 0) av.push("La actividad económica se calcula en estimación directa simplificada; los módulos no están modelados.");
    if (hijos.some(h => h.edad === 0)) av.push("Los hijos de 0 años se tratan como nacidos en 2025.");
    $("res-avisos").innerHTML = `<summary>Qué no recoge este cálculo (${av.length})</summary><ul>${av.map(a => `<li>${a}</li>`).join("")}</ul>`;

    if (vistaActual() === "comparar") pintarComparacion();
  }

  // ---- comparación entre territorios ---------------------------------------------------
  let metrica = "cuota";
  let cmpCache = {};
  document.querySelectorAll('input[name="metrica"]').forEach(r => r.addEventListener("change", () => { metrica = r.value; pintarComparacion(); }));

  function pintarComparacion() {
    if (!ultima) return;
    const terr = selTerr.value;
    const cmp = irpfsim.compararTerritorios(ultima.hogar, P);
    const val = c => metrica === "cuota" ? c.cuotaResultanteAutoliquidacion : c.tipoMedioEfectivo;
    const fmt = v => metrica === "cuota" ? eur0(v) : pct(v);
    const yo = cmp.find(c => c.territorio === terr);
    const base = yo ? val(yo) : 0;
    const difs = cmp.map(c => val(c) - base);
    const maxAbs = Math.max(...difs.map(Math.abs)) || 1;
    const umbralIgual = metrica === "cuota" ? 0.5 : 0.00005;
    const clase = d => {
      if (Math.abs(d) < umbralIgual) return "--m-0";
      const k = Math.min(3, Math.ceil(Math.abs(d) / maxAbs * 3));
      return d < 0 ? `--m-g${k}` : `--m-r${k}`;
    };
    const porT = Object.fromEntries(cmp.map(c => [c.territorio, c]));
    cmpCache = porT;

    // mapa
    const svg = $("mapa");
    svg.setAttribute("viewBox", MAPA.viewBox.join(" "));
    let h = "";
    for (const t of Object.keys(MAPA.territorios)) {
      const c = porT[t]; if (!c) continue;
      const color = t === terr ? "var(--m-tu)" : `var(${clase(val(c) - base)})`;
      h += `<path class="terr${t === terr ? " tu" : ""}" data-t="${t}" d="${MAPA.territorios[t]}" fill="${color}" tabindex="0" role="button" aria-label="${esc(T[t].nombre)}: ${fmt(val(c))}"/>`;
    }
    h += `<path class="fronteras" d="${MAPA.fronteras}"/><path class="recuadro" d="${MAPA.recuadroCanarias}"/>`;
    const ct = MAPA.centros[terr];
    if (ct) h += `<text class="etq-mapa" x="${ct[0]}" y="${ct[1] + 5}" text-anchor="middle">Tú</text>`;
    svg.innerHTML = `<title id="mapa-titulo">Mapa de España por territorio fiscal</title>` + h;

    // leyenda
    const pasos = ["--m-g3", "--m-g2", "--m-g1", "--m-0", "--m-r1", "--m-r2", "--m-r3"];
    $("leyenda").innerHTML = `<span class="leyenda-grupo">Pagas menos<span class="leyenda-rampa">${pasos.map(p => `<span style="background:var(${p})"></span>`).join("")}</span>Pagas más</span>
      <span class="leyenda-grupo"><span style="width:14px;height:12px;border-radius:3px;background:var(--m-tu);display:inline-block"></span>Tu territorio</span>`;

    // ranking
    const orden = cmp.slice().sort((a, b) => val(a) - val(b));
    $("ranking").innerHTML = `<thead><tr><th>#</th><th>Territorio</th><th class="num">${metrica === "cuota" ? "Cuota" : "Tipo medio"}</th><th class="num ocultable">${metrica === "cuota" ? "Tipo medio" : "Cuota"}</th><th class="num">Diferencia</th></tr></thead><tbody>` +
      orden.map((c, i) => {
        const d = val(c) - base, tu = c.territorio === terr;
        const dtxt = tu ? "—" : (Math.abs(d) < umbralIgual ? "igual" : (d < 0 ? "−" : "+") + (metrica === "cuota" ? eur0(Math.abs(d)) : (100 * Math.abs(d)).toFixed(2).replace(".", ",") + " p.p."));
        return `<tr class="${tu ? "tu" : ""}" data-t="${c.territorio}"><td class="pos">${i + 1}</td><td>${esc(corto(c.territorio))}${c.regimen !== "comun" ? '<span class="regimen">foral</span>' : ""}</td>
          <td class="num">${fmt(val(c))}</td><td class="num ocultable">${metrica === "cuota" ? pct(c.tipoMedioEfectivo) : eur0(c.cuotaResultanteAutoliquidacion)}</td>
          <td class="num dif ${d < -umbralIgual ? "gana" : d > umbralIgual ? "pierde" : ""}">${dtxt}</td></tr>`;
      }).join("") + "</tbody>";

    const barato = orden[0], caro = orden[orden.length - 1];
    let txt = `Con tu situación, en <b>${esc(corto(terr))}</b> pagas <b>${eur0(yo.cuotaResultanteAutoliquidacion)}</b> de IRPF. `;
    if (barato.territorio === terr) txt += `Es el territorio más barato de los 19; el más caro es ${esc(corto(caro.territorio))} (+${eur0(caro.cuotaResultanteAutoliquidacion - yo.cuotaResultanteAutoliquidacion)}).`;
    else txt += `El más barato es <b>${esc(corto(barato.territorio))}</b>, donde pagarías <b>${eur0(yo.cuotaResultanteAutoliquidacion - barato.cuotaResultanteAutoliquidacion)} menos</b>; el más caro, ${esc(corto(caro.territorio))}.`;
    $("comp-entradilla").innerHTML = txt;
    const hg = ultima.hogar;
    const notaMunicipio = hg.municipioHabitantes != null || hg.zonaDespoblada
      ? ` Se supone un municipio ${hg.municipioHabitantes != null ? `de ${miles(String(hg.municipioHabitantes))} habitantes` : "del mismo tipo"} en cada territorio${hg.zonaDespoblada ? ", incluido en su lista oficial de despoblación" : ""}.`
      : "";
    $("comp-nota").textContent = "Misma situación personal y económica en cada territorio, con su escala, mínimos y las deducciones modeladas." + notaMunicipio + " Cambiar de residencia fiscal exige vivir allí más de 183 días al año y tener allí el centro de intereses.";
  }

  // tooltip y clic en el mapa / ranking
  const tip = $("mapa-tip");
  $("mapa").addEventListener("mousemove", e => {
    const p = e.target.closest(".terr");
    if (!p || !ultima || !cmpCache[p.dataset.t]) { tip.hidden = true; return; }
    const t = p.dataset.t, c = cmpCache[t];
    const yo = ultima.liq.cuotaResultanteAutoliquidacion, d = c.cuotaResultanteAutoliquidacion - yo;
    tip.innerHTML = `<b>${esc(T[t].nombre)}</b>Cuota ${eur0(c.cuotaResultanteAutoliquidacion)} · ${pct(c.tipoMedioEfectivo)}<br>${t === selTerr.value ? "Tu territorio" : (d < 0 ? `${eur0(-d)} menos que en ${esc(corto(selTerr.value))}` : `${eur0(d)} más que en ${esc(corto(selTerr.value))}`)}`;
    const r = $("mapa").parentElement.getBoundingClientRect();
    tip.hidden = false;
    tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 190) + "px";
    tip.style.top = (e.clientY - r.top + 14) + "px";
  });
  $("mapa").addEventListener("mouseleave", () => { tip.hidden = true; });
  const elegirTerritorio = t => { if (!t || !T[t]) return; selTerr.value = t; pintarHijos(); pintarGastosTerritorio(); recalcular(); irA("calculadora"); };
  $("mapa").addEventListener("click", e => { const p = e.target.closest(".terr"); if (p) elegirTerritorio(p.dataset.t); });
  $("mapa").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.dataset.t) { e.preventDefault(); elegirTerritorio(e.target.dataset.t); } });
  $("ranking").addEventListener("click", e => { const tr = e.target.closest("tr[data-t]"); if (tr) elegirTerritorio(tr.dataset.t); });

  // ---- cuentas y clientes (Supabase) ----------------------------------------------------
  const dlgAcceso = $("dlg-acceso"), dlgGuardar = $("dlg-guardar");
  // El enlace mágico vuelve a la página sin hash (Supabase le añade #access_token=…);
  // la vista a la que ir después se recuerda aquí (la pestaña del enlace es otra).
  const TRAS_ACCESO = "mapafiscal.trasAcceso";
  const recordar = (clave, valor) => { try { valor == null ? localStorage.removeItem(clave) : localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ } };
  const recordado = clave => { try { return localStorage.getItem(clave); } catch (e) { return null; } };
  const paginaActual = () => location.origin + location.pathname;
  function abrirAcceso(motivo) {
    if (!sb) { irA("clientes"); return; }
    $("acceso-msg").textContent = motivo || ""; $("acceso-msg").className = "mensaje";
    dlgAcceso.showModal(); $("acceso-email").focus();
  }
  $("btn-enviar-enlace").addEventListener("click", async () => {
    const email = $("acceso-email").value.trim(), msg = $("acceso-msg");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = "Escribe un correo válido."; msg.className = "mensaje error"; return; }
    $("btn-enviar-enlace").disabled = true;
    recordar(TRAS_ACCESO, vistaActual() === "planes" ? "planes" : "clientes");
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: paginaActual() } });
    $("btn-enviar-enlace").disabled = false;
    if (error) { msg.textContent = "No se pudo enviar el enlace: " + error.message; msg.className = "mensaje error"; }
    else { msg.textContent = `Te hemos enviado un enlace a ${email}. Ábrelo desde este navegador para entrar.`; msg.className = "mensaje ok"; }
  });
  $("btn-cuenta").addEventListener("click", () => { if (sesion.usuario) irA("clientes"); else abrirAcceso(); });

  async function cargarSesion() {
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    sesion.usuario = data.session ? data.session.user : null;
    if (sesion.usuario) {
      const [p, c] = await Promise.all([
        sb.from("perfiles").select("nombre, despacho, plan").eq("id", sesion.usuario.id).maybeSingle(),
        sb.from("clientes").select("id, alias, notas, territorio, hogar, cuota_liquida, resultado, actualizado_en").order("actualizado_en", { ascending: false })
      ]);
      sesion.perfil = p.data || { plan: "gratis" };
      sesion.clientes = c.data || [];
    } else { sesion.perfil = null; sesion.clientes = []; }
    $("btn-cuenta").textContent = sesion.usuario ? "Mi cuenta" : "Acceder";
    if (vistaActual() === "clientes") pintarClientes();
    if (vistaActual() === "planes") pintarPlanes();
  }
  if (sb) sb.auth.onAuthStateChange(evento => {
    const destino = recordado(TRAS_ACCESO);
    if (evento === "SIGNED_IN" && destino) { recordar(TRAS_ACCESO, null); setTimeout(() => irA(destino), 0); }
    setTimeout(cargarSesion, 0);    // fuera del callback: supabase-js no admite llamadas de auth dentro
  });
  if (!sb) $("btn-cuenta").hidden = true;

  function pintarClientes() {
    const cont = $("cli-contenido");
    $("cli-acciones").hidden = true;
    if (!sb) {
      cont.innerHTML = `<div class="tarjeta estado-vacio"><h2>Tu cartera de clientes, en la web de Mapafiscal</h2>
        <p>Esta vista previa funciona sin cuenta. Para guardar clientes necesitas acceder desde la web de Mapafiscal con tu correo.</p>
        <a class="btn btn-sec" href="#planes">Ver planes</a></div>`;
      return;
    }
    if (!sesion.usuario) {
      cont.innerHTML = `<div class="tarjeta estado-vacio"><h2>Accede para gestionar tus clientes</h2>
        <p>Guarda la situación fiscal de cada cliente, vuelve a calcularla cuando quieras y compárala entre territorios. Te enviamos un enlace de acceso: no hay contraseñas.</p>
        <button class="btn btn-pri" type="button" id="cli-acceder">Acceder con mi correo</button></div>`;
      $("cli-acceder").addEventListener("click", () => abrirAcceso());
      return;
    }
    $("cli-acciones").hidden = false;
    const plan = (sesion.perfil && sesion.perfil.plan) || "gratis";
    const limite = plan === "gratis" ? 3 : null;
    const q = $("cli-buscar").value.trim().toLowerCase();
    const lista = sesion.clientes.filter(c => !q || c.alias.toLowerCase().includes(q) || (c.notas || "").toLowerCase().includes(q));
    const barra = `<div class="cuenta-barra"><span>${esc(sesion.usuario.email)} <span class="plan-chip">Plan ${plan === "gratis" ? "Gratis" : plan === "gestor" ? "Gestor" : "Despacho"}</span>
        ${limite ? ` · ${sesion.clientes.length} de ${limite} clientes de prueba` : ` · ${sesion.clientes.length} clientes`}</span>
      <span>${plan === "gratis" ? '<a class="btn btn-txt btn-sm" href="#planes">Mejorar plan</a>' : (CFG.pagosActivos ? '<button class="btn btn-txt btn-sm" type="button" id="cli-portal">Gestionar suscripción</button>' : "")}
      <button class="btn btn-txt btn-sm" type="button" id="cli-salir">Cerrar sesión</button></span></div>`;
    const aviso = avisoPago ? `<div class="aviso-demo" role="status" style="background:var(--gana-suave);color:var(--gana)">${AVISOS_PAGO[avisoPago]}</div>` : "";
    if (!sesion.clientes.length) {
      cont.innerHTML = aviso + barra + `<div class="tarjeta estado-vacio"><h2>Todavía no tienes clientes</h2>
        <p>Rellena la calculadora con la situación de un cliente y pulsa «Guardar como cliente». Quedará aquí para abrirla, actualizarla o imprimir su informe.</p>
        <a class="btn btn-pri" href="#calculadora">Ir a la calculadora</a></div>`;
    } else {
      cont.innerHTML = aviso + barra + `<div class="tarjeta tarjeta-tabla" style="margin-top:0"><div class="envoltorio"><table class="tabla-clientes">
        <thead><tr><th>Cliente</th><th>Territorio</th><th class="num">Cuota líquida</th><th class="num">Resultado</th><th>Actualizado</th><th class="acc"><span class="sr">Acciones</span></th></tr></thead>
        <tbody>${lista.map(c => {
          const r = c.resultado || {};
          const res = r.retenciones ? (r.cuotaDiferencial < 0 ? `<span style="color:var(--gana)">A devolver ${eur0(-r.cuotaDiferencial)}</span>` : `A ingresar ${eur0(r.cuotaDiferencial)}`) : "—";
          return `<tr><td><div class="alias">${esc(c.alias)}</div>${c.notas ? `<div class="notas">${esc(c.notas)}</div>` : ""}</td>
            <td>${esc(corto(c.territorio))}</td><td class="num">${c.cuota_liquida != null ? eur(+c.cuota_liquida) : "—"}</td><td class="num">${res}</td>
            <td>${new Date(c.actualizado_en).toLocaleDateString("es-ES")}</td>
            <td class="acc"><button class="btn btn-txt btn-sm" data-abrir="${c.id}">Abrir</button><button class="btn btn-txt btn-sm" data-informe="${c.id}">Informe</button><button class="btn btn-peligro btn-sm" data-borrar="${c.id}">Eliminar</button></td></tr>`;
        }).join("") || `<tr><td colspan="6" class="vacio">Ningún cliente coincide con la búsqueda.</td></tr>`}</tbody></table></div></div>`;
    }
    $("cli-salir").addEventListener("click", async () => { await sb.auth.signOut(); cerrarCliente(); });
    const portal = $("cli-portal");
    if (portal) portal.addEventListener("click", () => irAFuncion("portal-facturacion", {}));
  }
  $("cli-buscar").addEventListener("input", pintarClientes);
  $("cli-contenido").addEventListener("click", async e => {
    const b = e.target.closest("button[data-abrir], button[data-informe], button[data-borrar]");
    if (!b) return;
    const id = b.dataset.abrir || b.dataset.informe || b.dataset.borrar;
    const c = sesion.clientes.find(x => x.id === id);
    if (!c) return;
    if (b.dataset.borrar) {
      if (!confirm(`¿Eliminar a «${c.alias}»? Esta acción no se puede deshacer.`)) return;
      const { error } = await sb.from("clientes").delete().eq("id", id);
      if (error) { alert("No se pudo eliminar: " + error.message); return; }
      if (clienteAbierto && clienteAbierto.id === id) cerrarCliente();
      await cargarSesion();
      return;
    }
    abrirCliente(c);
    if (b.dataset.informe) setTimeout(() => window.print(), 300);
  });

  function abrirCliente(c) {
    clienteAbierto = { id: c.id, alias: c.alias, notas: c.notas || "" };
    $("cliente-alias").textContent = c.alias;
    $("barra-cliente").hidden = false;
    rellenarFormulario(c.hogar);
    irA("calculadora");
  }
  function cerrarCliente() {
    clienteAbierto = null;
    $("barra-cliente").hidden = true;
    $("btn-guardar-cliente").textContent = "Guardar como cliente";
  }
  $("btn-cerrar-cliente").addEventListener("click", cerrarCliente);

  $("btn-guardar-cliente").addEventListener("click", () => {
    if (!sb) { irA("clientes"); return; }
    if (!sesion.usuario) { abrirAcceso("Accede con tu correo para guardar clientes."); return; }
    $("guardar-alias").value = clienteAbierto ? clienteAbierto.alias : "";
    $("guardar-notas").value = clienteAbierto ? clienteAbierto.notas : "";
    $("guardar-msg").textContent = ""; $("guardar-msg").className = "mensaje";
    $("t-guardar").textContent = clienteAbierto ? "Guardar cambios del cliente" : "Guardar cliente";
    dlgGuardar.showModal(); $("guardar-alias").focus();
  });
  $("btn-confirmar-guardar").addEventListener("click", async () => {
    const alias = $("guardar-alias").value.trim(), msg = $("guardar-msg");
    if (!alias) { msg.textContent = "Pon un alias para reconocer al cliente."; msg.className = "mensaje error"; return; }
    const { hogar, liq } = ultima;
    const fila = {
      alias, notas: $("guardar-notas").value.trim() || null, territorio: hogar.territorio, ejercicio: P.ejercicio, hogar,
      resultado: { cuotaLiquidaTotal: liq.cuotaLiquidaTotal, cuotaResultanteAutoliquidacion: liq.cuotaResultanteAutoliquidacion,
        cuotaDiferencial: liq.cuotaDiferencial, retenciones: num("f-retenciones"),
        tipoMedioEfectivo: liq.tipoMedioEfectivo, modo: liq.modoTributacionElegido, motor: P.generado },
      cuota_liquida: liq.cuotaLiquidaTotal
    };
    $("btn-confirmar-guardar").disabled = true;
    const r = clienteAbierto
      ? await sb.from("clientes").update(fila).eq("id", clienteAbierto.id).select().single()
      : await sb.from("clientes").insert(fila).select().single();
    $("btn-confirmar-guardar").disabled = false;
    if (r.error) {
      const limite = /máximo de/.test(r.error.message);
      msg.innerHTML = limite ? `${esc(r.error.message)} <a href="#planes">Ver el plan Gestor</a>.` : "No se pudo guardar: " + esc(r.error.message);
      msg.className = "mensaje error";
      return;
    }
    clienteAbierto = { id: r.data.id, alias: r.data.alias, notas: r.data.notas || "" };
    $("cliente-alias").textContent = r.data.alias; $("barra-cliente").hidden = false;
    dlgGuardar.close();
    await cargarSesion();
    recalcular();
  });

  // ---- planes, lista de espera y pagos ----------------------------------------------------
  // Vuelta de Stripe (#gestor?pago=ok): el webhook cambia el plan en unos segundos.
  const AVISOS_PAGO = {
    esperando: "Pago completado. Estamos activando tu plan Gestor…",
    activado: "Plan Gestor activado. ¡Gracias por suscribirte!",
    retraso: "Pago recibido. Tu plan se activará en unos minutos: recarga la página si no lo ves."
  };
  let avisoPago = sb && /pago=ok/.test(location.hash) ? "esperando" : null;
  async function esperarPlan(intentos) {
    await cargarSesion();
    if (!sesion.usuario) { avisoPago = null; return; }
    if (sesion.perfil && sesion.perfil.plan !== "gratis") avisoPago = "activado";
    else if (intentos > 1) { setTimeout(() => esperarPlan(intentos - 1), 2000); return; }
    else avisoPago = "retraso";
    try { history.replaceState(null, "", "#clientes"); } catch (e) { /* sin historial */ }
    pintarClientes();
  }
  // Al volver de Stripe con «Atrás» la página puede salir de la caché con el botón desactivado.
  window.addEventListener("pageshow", e => { if (e.persisted && vistaActual() === "planes") pintarPlanes(); });

  let periodo = "mensual";
  document.querySelectorAll('input[name="periodo"]').forEach(r => r.addEventListener("change", () => { periodo = r.value; pintarPlanes(); }));

  // Abre Stripe (checkout o portal) a través de una Edge Function; devuelve false si no se pudo.
  const ERRORES_PAGO = {
    ya_suscrito: "Ya tienes una suscripción activa. Puedes cambiarla desde «Gestionar suscripción» en tu cuenta.",
    sin_suscripcion: "No encontramos ninguna suscripción asociada a tu cuenta.",
    pagos_no_configurados: "El pago no está disponible todavía. Apúntate a la lista de espera y te avisamos.",
    precio_no_configurado: "El pago no está disponible todavía. Apúntate a la lista de espera y te avisamos."
  };
  async function irAFuncion(nombre, cuerpo) {
    const { data, error } = await sb.functions.invoke(nombre, { body: { ...cuerpo, volver: paginaActual() } });
    if (!error && data && data.url) { location.href = data.url; return true; }
    let codigo = null;
    try { codigo = (await error.context.json()).error; } catch (e) { /* sin cuerpo JSON */ }
    if (codigo === "sin_sesion") { abrirAcceso("Tu sesión ha caducado. Vuelve a acceder con tu correo."); return false; }
    alert(ERRORES_PAGO[codigo] || "No se ha podido abrir el pago. Inténtalo de nuevo en unos minutos.");
    if (codigo === "ya_suscrito") cargarSesion();
    return false;
  }

  const importe = n => Number.isInteger(n) ? eur0(n) : eur(n);
  function pintarPlanes() {
    const pr = CFG.precios || {};
    const plan = sesion.perfil ? sesion.perfil.plan : "gratis";
    const PERIODO = { semanal: [pr.gestorSemanal, "semana"], mensual: [pr.gestorMensual, "mes"], anual: [pr.gestorAnual, "año"] };
    const [cifra, unidad] = PERIODO[periodo] || PERIODO.mensual;
    const precioGestor = `${importe(cifra)}<small> / ${unidad}</small>`;
    const notaGestor = periodo === "anual" && pr.gestorAnual ? `Equivale a ${eur(pr.gestorAnual / 12)} al mes. IVA incluido.`
      : periodo === "semanal" ? "Pensado para la campaña de la renta. IVA incluido." : "IVA incluido.";
    const ctaGestor = plan !== "gratis"
      ? `<button class="btn btn-sec" type="button" disabled>Tu plan actual</button>`
      : (CFG.pagosActivos && sb ? `<button class="btn btn-pri" type="button" id="cta-gestor">Suscribirme</button>`
        : `<button class="btn btn-pri" type="button" data-espera="gestor">Quiero acceso anticipado</button>`);
    $("planes").innerHTML = `
      <div class="plan">
        <h2>Gratis</h2><p class="plan-para">Para calcular tu propia declaración.</p>
        <div class="plan-precio">0 €</div><p class="plan-precio-nota">Sin cuenta.</p>
        <ul><li>IRPF 2025 con tu situación real</li><li>Comparación en los 19 territorios</li><li>Desglose con casillas y deducciones aplicadas</li><li>Palancas de ahorro para tu caso</li></ul>
        <a class="btn btn-sec" href="#calculadora">Usar la calculadora</a>
      </div>
      <div class="plan destacado">
        <span class="plan-cinta">Para asesores y gestorías</span>
        <h2>Gestor</h2><p class="plan-para">Tu cartera de clientes, siempre calculada.</p>
        <div class="plan-precio">${precioGestor}</div><p class="plan-precio-nota">${notaGestor}</p>
        <ul><li>Todo lo del plan Gratis</li><li>Clientes ilimitados, guardados en la nube (UE)</li><li>Optimización por cliente: pensiones, conjunta, deducciones</li><li>Informe de cada cliente listo para imprimir</li><li>Recalcular la cartera cuando cambia la normativa</li></ul>
        ${ctaGestor}
        <div class="espera" id="espera-gestor" hidden></div>
      </div>
      <div class="plan">
        <h2>Despacho</h2><p class="plan-para">Para equipos con varios asesores.</p>
        <div class="plan-precio texto">A medida</div><p class="plan-precio-nota">Según usuarios y volumen.</p>
        <ul><li>Todo lo del plan Gestor</li><li>Varias cuentas en el mismo despacho</li><li>API para integrar con tu software de gestión</li><li>Soporte prioritario</li></ul>
        <button class="btn btn-sec" type="button" data-espera="despacho">Hablemos</button>
        <div class="espera" id="espera-despacho" hidden></div>
      </div>`;
    $("nota-precios").textContent = CFG.pagosActivos
      ? "Pago seguro con Stripe. Puedes cambiar de periodo o darte de baja cuando quieras desde tu cuenta."
      : CFG.preciosOrientativos ? "Precios orientativos: la suscripción todavía no está abierta. Apúntate y te avisaremos." : "";
    const cta = $("cta-gestor");
    if (cta) cta.addEventListener("click", async () => {
      if (!sesion.usuario) { abrirAcceso("Accede con tu correo para suscribirte."); return; }
      cta.disabled = true; cta.textContent = "Abriendo el pago…";
      if (!await irAFuncion("crear-checkout", { plan: "gestor", periodo })) { cta.disabled = false; cta.textContent = "Suscribirme"; }
    });
  }
  $("planes").addEventListener("click", e => {
    const b = e.target.closest("[data-espera]");
    if (!b) return;
    const plan = b.dataset.espera, caja = $("espera-" + plan);
    if (!sb) { location.href = `mailto:${CFG.contacto || ""}?subject=${encodeURIComponent("Mapafiscal — plan " + plan)}`; return; }
    caja.hidden = false;
    caja.innerHTML = `<label class="ayuda" for="espera-email-${plan}">Te escribimos en cuanto abramos el plan ${plan === "gestor" ? "Gestor" : "Despacho"}.</label>
      <div class="fila"><input type="email" id="espera-email-${plan}" placeholder="tu@correo.es" autocomplete="email" value="${esc(sesion.usuario ? sesion.usuario.email : "")}"><button class="btn btn-pri btn-sm" type="button" data-apuntar="${plan}">Apuntarme</button></div>
      <p class="mensaje" id="espera-msg-${plan}" role="status"></p>`;
    b.hidden = true;
    $("espera-email-" + plan).focus();
  });
  $("planes").addEventListener("click", async e => {
    const b = e.target.closest("[data-apuntar]");
    if (!b) return;
    const plan = b.dataset.apuntar, email = $("espera-email-" + plan).value.trim(), msg = $("espera-msg-" + plan);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = "Escribe un correo válido."; msg.className = "mensaje error"; return; }
    b.disabled = true;
    const { error } = await sb.from("lista_espera").insert({ email, plan, origen: "web-planes" });
    b.disabled = false;
    if (error && error.code !== "23505") { msg.textContent = "No se pudo guardar: " + error.message; msg.className = "mensaje error"; return; }
    msg.textContent = error ? "Ya estabas en la lista. ¡Gracias!" : "Apuntado. Te avisaremos."; msg.className = "mensaje ok";
  });

  // ---- metodología: cobertura -------------------------------------------------------------
  function pintarCobertura() {
    const filas = ORDEN.filter(t => T[t]).map(t => {
      const da = T[t].deducciones_autonomicas;
      if (T[t].regimen !== "comun") return `<tr><td>${esc(corto(t))}</td><td colspan="3" class="ayuda">${REGIMEN[T[t].regimen]}: mínimos y deducciones de la normativa foral</td></tr>`;
      const n = da && da.lista ? da.lista.length : 0;
      const prov = da && da.lista ? da.lista.filter(d => d.estado === "provisional").length : 0;
      const pend = da && da.pendientes ? da.pendientes.filter(p => typeof p === "string" && p[0] !== "(").length : 0;
      const tot = n + pend || 1;
      return `<tr><td>${esc(corto(t))}</td><td class="num">${n}</td><td class="num">${prov}</td><td><div class="barra" title="${n} de ~${n + pend} deducciones del catálogo"><i style="width:${Math.round(100 * n / tot)}%"></i></div></td></tr>`;
    });
    $("cobertura").innerHTML = `<thead><tr><th>Territorio</th><th class="num">Modeladas</th><th class="num">Provisionales</th><th>Del catálogo oficial</th></tr></thead><tbody>${filas.join("")}</tbody>`;
  }

  // ---- navegación -------------------------------------------------------------------------
  const VISTAS = ["calculadora", "comparar", "clientes", "planes", "metodologia"];
  let vistaSel = null;           // vista elegida en esta sesión (no depende de poder tocar el hash)
  function vistaDeHash() {
    const h = location.hash.slice(1).split("?")[0];
    if (h === "gestor") return "clientes";
    return VISTAS.includes(h) ? h : null;
  }
  function vistaActual() { return vistaSel || vistaDeHash() || "calculadora"; }
  function irA(v) {
    vistaSel = v;
    try { history.replaceState(null, "", "#" + v); } catch (e) { /* entorno sin historial (vista previa) */ }
    mostrarVista();
  }
  // enlaces internos (#vista): cambian de vista sin navegar
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const v = a.getAttribute("href").slice(1).split("?")[0];
    if (VISTAS.includes(v)) { e.preventDefault(); irA(v); }
  });
  function mostrarVista() {
    const v = vistaActual();
    for (const x of VISTAS) $("v-" + x).hidden = x !== v;
    $("barra-movil").hidden = v !== "calculadora";
    document.body.classList.toggle("en-calculadora", v === "calculadora");
    document.querySelectorAll(".nav a").forEach(a => a.toggleAttribute("aria-current", a.dataset.vista === v));
    document.querySelectorAll(".nav a[aria-current]").forEach(a => a.setAttribute("aria-current", "page"));
    if (v === "comparar") pintarComparacion();
    if (v === "clientes") pintarClientes();
    if (v === "planes") pintarPlanes();
    if (v === "metodologia") pintarCobertura();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", () => { const v = vistaDeHash(); if (v) { vistaSel = v; mostrarVista(); } });
  $("bm-ver").addEventListener("click", e => { e.preventDefault(); $("t-res").scrollIntoView({ behavior: "smooth", block: "start" }); });

  // ---- arranque --------------------------------------------------------------------------
  pintarHijos(); pintarGastosTerritorio(); recalcular(); mostrarVista();
  if (avisoPago) esperarPlan(15); else cargarSesion();
})();
