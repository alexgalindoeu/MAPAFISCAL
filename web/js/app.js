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
  let T = P.territorios;

  // ---- ejercicio fiscal (2025, 2026…) ---------------------------------------------------
  // params.json trae el ejercicio por defecto; los demás se cargan bajo demanda de
  // datos/params_<año>.json. Solo se ofrecen los publicados (params/ejercicios.yaml →
  // P.ejercicios.publicados), más el que pida la URL con ?ejercicio=<año>, para probar un
  // ejercicio antes de publicarlo. Con un solo ejercicio, el selector no se muestra.
  const PARAMS = new Map([[P.ejercicio, P]]);
  const ejercicioUrl = (() => {
    const q = new URLSearchParams(location.search).get("ejercicio")
      || new URLSearchParams(location.hash.split("?")[1] || "").get("ejercicio");
    return /^20\d\d$/.test(q || "") ? +q : null;
  })();
  const EJERCICIOS = [...new Set([...((P.ejercicios && P.ejercicios.publicados) || [P.ejercicio]).map(Number),
    ...(ejercicioUrl ? [ejercicioUrl] : [])])].sort((a, b) => a - b);
  const textoEjercicios = () => EJERCICIOS.length > 1 ? EJERCICIOS.slice(0, -1).join(", ") + " y " + EJERCICIOS[EJERCICIOS.length - 1] : String(P.ejercicio);
  async function cargarParams(a) {
    if (PARAMS.has(a)) return PARAMS.get(a);
    const p = await datos("datos-params-" + a, `datos/params_${a}.json`);
    if (!p || !p.territorios || +p.ejercicio !== a) throw new Error(`los datos de ${a} no son válidos`);
    PARAMS.set(a, p);
    return p;
  }
  function pintarSelectoresEjercicio(cargando) {
    document.querySelectorAll("[data-selector-ejercicio]").forEach(el => {
      el.hidden = EJERCICIOS.length < 2;
      if (el.hidden) return;
      const id = "ej-" + el.dataset.selectorEjercicio;
      if (!el.querySelector("input")) el.innerHTML = `<span class="etiqueta" id="${id}-lbl">Ejercicio</span>
        <div class="segmentado" role="radiogroup" aria-labelledby="${id}-lbl">${EJERCICIOS.map(a =>
          `<label><input type="radio" name="${id}" value="${a}"><span>${a}</span></label>`).join("")}</div>`;
      el.querySelectorAll("input").forEach(r => { r.checked = +r.value === ejercicioPedido; r.disabled = !!cargando && +r.value !== ejercicioPedido; });
      el.setAttribute("aria-busy", cargando ? "true" : "false");
    });
  }
  let ejercicioPedido = P.ejercicio;
  async function cambiarEjercicio(a) {
    if (a === ejercicioPedido) return;
    ejercicioPedido = a;
    pintarSelectoresEjercicio(true);
    let nuevo;
    try { nuevo = await cargarParams(a); }
    catch (e) {
      if (ejercicioPedido === a) { ejercicioPedido = P.ejercicio; pintarSelectoresEjercicio(false); }
      alert(`No se han podido cargar los datos del ejercicio ${a}. Inténtalo de nuevo en unos minutos.`);
      return;
    }
    if (ejercicioPedido !== a) return;       // mientras cargaba se pidió otro ejercicio
    P = nuevo; T = P.territorios;
    aplicarEjercicio();
    pintarSelectoresEjercicio(false);
  }
  document.addEventListener("change", e => {
    const r = e.target.closest("[data-selector-ejercicio] input");
    if (r) cambiarEjercicio(+r.value);
  });

  // ---- Supabase ----------------------------------------------------------------------
  const MC = window.MapafiscalCuentas;
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
      if (d.tipo === "porcentaje_campos_hijo") {   // varios gastos por hijo (p. ej. Madrid, art. 11)
        const max = d.edad_hijo_max != null ? d.edad_hijo_max : 25;
        for (const c of Object.keys(d.campos || {})) { const prev = hijo.get(c); hijo.set(c, prev == null ? max : Math.max(prev, max)); }
        continue;
      }
      if (!d.campo || d.campo === "alquiler_vivienda_pagos") continue;
      if (d.tipo === "porcentaje_campo_hijo") {
        const prev = hijo.get(d.campo);
        const max = d.edad_hijo_max != null ? d.edad_hijo_max : 25;
        hijo.set(d.campo, prev == null ? max : Math.max(prev, max));
      } else if (d.tipo === "porcentaje_campo") hogar.set(d.campo, true);
    }
    return { hogar: [...hogar.keys()], hijo: [...hijo.entries()] };
  }

  // título de familia numerosa reciente (Madrid, art. 13 bis): la casilla solo se muestra si
  // algún territorio lo exige y el hogar es familia numerosa (cuenta también al comparar)
  const algunaDeduccion = cond => Object.values(T).some(t =>
    ((t.deducciones_autonomicas && t.deducciones_autonomicas.lista) || []).some(cond));
  let pideFnReciente = algunaDeduccion(d => d.requiere_familia_numerosa_reciente);
  const pintarFnReciente = () => { $("casilla-fn-reciente").hidden = !pideFnReciente || $("f-familia-numerosa").value === "no"; };

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
        <div class="hijo-extra">${h.edad === 0 ? `<span class="ayuda">Nacido en ${P.ejercicio}</span>` : '<span class="ayuda">años</span>'}${extras}</div>
        <button class="btn btn-txt btn-sm" type="button" data-quitar="${i}" aria-label="Quitar hijo ${i + 1}">Quitar</button>
      </li>`;
    }).join("");
    pintarTituloMonoparental();
  }
  // título autonómico de familia monoparental (C. Valenciana, Decreto 19/2018): se pregunta
  // si hay hijos y algún territorio lo exige (cuenta también al comparar territorios)
  let pideTituloMonoparental = algunaDeduccion(d => d.requiere_titulo_monoparental != null);
  function pintarTituloMonoparental() {
    $("campo-titulo-monoparental").hidden = !pideTituloMonoparental || hijos.length === 0;
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
      $("f-ss").value = $("f-pension").checked ? 0 : Math.round(irpfsim.cotizacionesTrabajador(num("f-salario"), P));
    if (t.id === "f-ss") { ssManual = true; $("ayuda-ss").textContent = "Importe introducido por ti."; }
    if (t.dataset.hijoEdad != null) {
      hijos[+t.dataset.hijoEdad].edad = Math.max(0, Math.min(30, parseInt(t.value, 10) || 0));
      clearTimeout(pintarHijos._t); pintarHijos._t = setTimeout(() => { const f = document.activeElement && document.activeElement.dataset.hijoEdad; pintarHijos(); if (f != null) { const el = document.querySelector(`[data-hijo-edad="${f}"]`); if (el) { el.focus(); el.select && el.select(); } } }, 600);
    }
    if (t.dataset.hijo != null && t.dataset.campo) hijos[+t.dataset.hijo].gastos[t.dataset.campo] = parseFloat(t.value) || 0;
    if (t.dataset.gasto) gastosHogar[t.dataset.gasto] = parseFloat(t.value) || 0;
    if (t.name === "pareja") $("bloque-pareja").hidden = t.value !== "si";
    if (t.id === "f-desempleado") $("campo-meses-desempleo").hidden = !t.checked;
    if (t.id === "f-familia-numerosa") pintarFnReciente();
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
      mesesDesempleo: $("f-desempleado").checked ? Math.max(1, Math.min(12, Math.round(num("f-meses-desempleo")) || 12)) : undefined,
      trabajo: salario > 0 ? { dinerarias: salario, cotizacionesSs: num("f-ss"), pensionJubilacion: $("f-pension").checked,
        otrosPagadores: num("f-otros-pagadores") } : null,
      capitalMobiliario: (num("f-intereses") > 0 || num("f-dividendos") > 0) ? { intereses: num("f-intereses"), dividendos: num("f-dividendos") } : null,
      capitalInmobiliario: num("f-alquileres") > 0 ? [{ ingresos: num("f-alquileres"), gastosDeducibles: 0 }] : null,
      actividades: num("f-actividad") > 0 ? { metodo: "directa_simplificada", rendimientoNetoPrevio: num("f-actividad") } : null,
      ganancias: ganancia !== 0 ? [{ valorTransmision: Math.max(0, ganancia), valorAdquisicion: Math.max(0, -ganancia),
        fechaAdquisicion: "2020-01-15", fechaTransmision: P.ejercicio + "-06-30", tipoElemento: "accion_cotizada", esTransmision: true }] : [],
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
        trabajo: ps > 0 ? { dinerarias: ps, cotizacionesSs: irpfsim.cotizacionesTrabajador(ps, P) } : null, retenciones: 0 });
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
      familiaNumerosaReciente: $("f-familia-numerosa").value !== "no" && $("f-fn-reciente").checked,
      municipioHabitantes: Number.isFinite(hab) && hab > 0 ? hab : null,
      zonaDespoblada: $("f-despoblada").checked,
      tituloMonoparental: $("campo-titulo-monoparental").hidden ? "no" : $("f-titulo-monoparental").value,
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
    set("f-otros-pagadores", d1.trabajo ? d1.trabajo.otrosPagadores : 0);
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
    $("f-meses-desempleo").value = d1.mesesDesempleo || 12; $("campo-meses-desempleo").hidden = !d1.desempleado;
    $("f-titulo-monoparental").value = h.tituloMonoparental || "no";
    document.querySelector(`input[name="pareja"][value="${d2 ? "si" : "no"}"]`).checked = true;
    $("bloque-pareja").hidden = !d2;
    if (d2) { set("f-pareja-edad", d2.edad); set("f-pareja-salario", d2.trabajo ? d2.trabajo.dinerarias : 0); }
    $("f-familia-numerosa").value = h.familiaNumerosa || "no";
    $("f-fn-reciente").checked = !!h.familiaNumerosaReciente; pintarFnReciente();
    const asc = h.miembros.filter(m => m.rol === "ascendiente");
    $("f-ascendientes").value = asc.length >= 2 ? "75x2" : asc.length ? (asc[0].edad >= 75 ? "75" : "65") : "0";
    const conocidos = new Set(["id", "rol", "edad", "discapacidad", "desempleado", "mesesDesempleo", "trabajo", "capitalMobiliario", "capitalInmobiliario",
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
  const nombreDed = id => NOMBRES_DED[id] || id.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim().toLowerCase().replace(/^./, c => c.toUpperCase());

  // ¿hay que presentar la declaración? (art. 96 LIRPF, calculado por el motor)
  function pintarObligacion(liq, reg) {
    const ob = liq.obligacionDeclarar, o = P.estatal.obligacion_declarar;
    if (!ob || ob.obligado === null) {
      $("res-obligacion").textContent = "";
      return;
    }
    const quien = id => id === "d1" ? "tú" : "tu pareja";
    const MOTIVO = {
      alta_reta: () => "tienes rendimientos de una actividad económica (autónomos de alta en el RETA declaran siempre)",
      trabajo: x => `los rendimientos del trabajo superan ${eur0(x.limiteTrabajo)}${x.limiteTrabajo < o.trabajo_un_pagador ? " (límite con más de un pagador)" : ""}`,
      capital: () => `los intereses, dividendos y ganancias con retención superan ${eur0(o.capital_y_ganancias_con_retencion)}`,
      imputaciones: () => `las rentas inmobiliarias imputadas superan ${eur0(o.rentas_inmobiliarias_imputadas)}`,
      otras_rentas: () => "hay rentas distintas del trabajo o del ahorro con retención (alquileres, ventas de acciones o fondos…)"
    };
    const obligados = Object.entries(ob.porPersona).filter(([, x]) => x.obligado);
    let txt;
    if (ob.obligado) {
      txt = "<b>Estás obligado a presentar la declaración</b>: " + obligados.map(([id, x]) =>
        (obligados.length > 1 || id !== "d1" ? quien(id) + ", " : "") + MOTIVO[x.motivo](x)).join("; ") + ".";
    } else {
      txt = "<b>No estás obligado a declarar</b> (art. 96 LIRPF)";
      if (ob.convienePresentar) txt += `, pero te conviene: te devolverían ${eur(Math.abs(liq.cuotaDiferencial))}`;
      txt += ".";
      const para = new Set(Object.values(ob.porPersona).flatMap(x => x.paraAplicar));
      const PARA = { vivienda_transitoria: "la deducción por vivienda anterior a 2013", prevision_social: "la reducción por aportaciones a planes de pensiones" };
      if (para.size) txt += " Para aplicar " + [...para].map(p => PARA[p]).join(" y ") + " tienes que presentarla.";
    }
    $("res-obligacion").innerHTML = txt;
  }

  // cifra grande: pasa de la anterior a la nueva en un instante (nada con movimiento reducido)
  const TASA_SS = 0.0635;
  const movimientoReducido = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let cifraPrev = null, cifraRaf = 0;
  function animarCifra(el, hasta) {
    cancelAnimationFrame(cifraRaf);
    const desde = cifraPrev == null ? hasta : cifraPrev;
    cifraPrev = hasta;
    if (movimientoReducido() || Math.abs(hasta - desde) < 1 || document.hidden) { el.textContent = eur(hasta); return; }
    const t0 = performance.now(), dur = 420;
    const paso = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = eur(desde + (hasta - desde) * e);
      if (k < 1) cifraRaf = requestAnimationFrame(paso);
    };
    cifraRaf = requestAnimationFrame(paso);
  }

  // barras del resultado: reparto de los ingresos y a quién va el IRPF
  function barra(titulo, derecha, partes) {
    const tot = partes.reduce((s, p) => s + Math.max(0, p.v), 0) || 1;
    return `<div><div class="grafico-tit"><span>${titulo}</span><span>${derecha}</span></div>
      <div class="barra-reparto" role="img" aria-label="${esc(partes.map(p => `${p.n}: ${eur0(p.v)}`).join(", "))}">${partes.filter(p => p.v > 0)
        .map(p => `<i class="${p.c}" style="flex-grow:${(p.v / tot).toFixed(4)}"></i>`).join("")}</div>
      <ul class="leyenda-reparto">${partes.map(p => `<li><i class="${p.c}" style="background:var(--g-${p.c})"></i>${esc(p.n)} <b>${eur0(Math.max(0, p.v))}</b>${p.extra || ""}</li>`).join("")}</ul></div>`;
  }
  function pintarGraficos(liq, hogar, terr, irpf) {
    const d1 = hogar.miembros.find(m => m.rol === "declarante"), d2 = hogar.miembros.find(m => m.rol === "conyuge");
    const trab = m => (m && m.trabajo ? m.trabajo.dinerarias : 0);
    const ss = m => (m && m.trabajo ? m.trabajo.cotizacionesSs || 0 : 0);
    const ingresos = trab(d1) + trab(d2) + num("f-intereses") + num("f-dividendos") + Math.max(0, num("f-ganancias")) + num("f-alquileres") + num("f-actividad");
    const cot = ss(d1) + ss(d2), impuesto = Math.max(0, irpf);
    const html = [];
    if (ingresos > 0) {
      const neto = Math.max(0, ingresos - cot - impuesto);
      html.push(barra(`De tus ${eur0(ingresos)} brutos`, `te quedan el ${(100 * neto / ingresos).toFixed(0)} %`, [
        { n: "Para ti", v: neto, c: "neto" }, { n: "IRPF", v: impuesto, c: "irpf" }, { n: "Seguridad Social", v: cot, c: "ss" }]));
    }
    const est = liq.cuotaLiquidaEstatal || 0, aut = liq.cuotaLiquidaAutonomica || 0;
    if (T[terr].regimen === "comun" && est + aut > 1) {
      html.push(barra("A quién va tu cuota líquida", `${(100 * aut / (est + aut)).toFixed(0)} % a ${esc(corto(terr))}`, [
        { n: "Estado", v: est, c: "estado" }, { n: corto(terr), v: aut, c: "autonomia" }]));
    }
    $("res-graficos").innerHTML = html.join("");
  }

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

    // cifra principal: a devolver (verde), a ingresar (rojo) o, sin retenciones, la cuota
    const estado = !hayResultado ? "" : cd < -0.004 ? "gana" : cd > 0.004 ? "pierde" : "";
    const cifra = hayResultado ? Math.abs(cd) : cuota;
    const rotuloCifra = !hayResultado ? `Tu ${nombreCuota.toLowerCase()} del IRPF` : estado === "gana" ? "A devolver" : estado === "pierde" ? "A ingresar" : "Ni a pagar ni a devolver";
    $("tarjeta-resultado").className = "tarjeta tarjeta-resultado" + (estado ? " " + estado : "");
    $("res-chip").textContent = `${corto(terr)} · ${P.ejercicio}`;
    $("res-principal").innerHTML = `<div class="res-etq">${rotuloCifra}</div>
      <div class="res-cifra ${estado}"><span aria-hidden="true" id="res-cifra"></span><span class="sr">${eur(cifra)}</span></div>
      ${hayResultado
        ? `<p class="res-sub">${nombreCuota} <b>${eur(cuota)}</b>${impr ? ` · deducciones sobre la cuota diferencial <b>${eur(impr)}</b>` : ""}${ret ? ` · retenciones <b>${eur(ret)}</b>` : ""}</p>`
        : `<p class="res-sub">${drt ? `Incluye la deducción por obtención de rendimientos del trabajo (${eur(drt)}). ` : ""}Añade tus retenciones (paso 5) para saber si te sale a pagar o a devolver.</p>`}`;
    animarCifra($("res-cifra"), cifra);
    $("bm-etq").textContent = hayResultado ? rotuloCifra : nombreCuota + " · " + corto(terr);
    $("bm-cifra").textContent = eur(cifra);
    $("bm-cifra").className = "bm-cifra" + (estado ? " " + estado : "");
    pintarGraficos(liq, hogar, terr, cuota - impr);
    const otra = liq.modoTributacionElegido === "conjunta" ? liq.comparativa.individual : liq.comparativa.conjunta;
    const ahorroModo = otra != null ? otra - cuota : 0;
    $("res-kpis").innerHTML = `
      <div><dt>Tipo medio efectivo</dt><dd>${pct(liq.tipoMedioEfectivo)}</dd></div>
      <div><dt>Tipo marginal</dt><dd>${pct(tipoMarginal(liq, terr))}</dd></div>
      <div><dt>Mejor modalidad</dt><dd>${liq.modoTributacionElegido === "conjunta" ? "Conjunta" : "Individual"}</dd></div>`;
    $("btn-guardar-cliente").textContent = clienteAbierto ? "Guardar cambios del cliente" : "Guardar como cliente";
    pintarObligacion(liq, reg);

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
      const norma = inf && inf.norma ? inf.norma : (comun ? "" : (reg === "foral_navarra" ? "Texto Refundido del IRPF de Navarra" : "Normativa foral del Territorio Histórico"));
      return `<li><span class="ded-nombre">${esc(nombreDed(id))}</span><span class="ded-norma">${esc(norma)}</span><span class="ded-imp">−${eur(v)}</span></li>`;
    }).concat(Object.entries(detImp).filter(([, v]) => v > 0).map(([id, v]) => {
      const inf = bloqueDed(reg, id);
      const norma = (inf && inf.norma ? inf.norma : "Arts. 81 y 81 bis LIRPF") + " · se resta de la cuota diferencial";
      return `<li><span class="ded-nombre">${esc(nombreDed(id))}</span><span class="ded-norma">${esc(norma)}</span><span class="ded-imp">−${eur(v)}</span></li>`;
    }));
    const detEst = (liq.deduccionesEstatales && liq.deduccionesEstatales.detalle) || {};
    for (const [id, v] of Object.entries(detEst).filter(([, v]) => v > 0)) {
      const inf = bloqueDed("comun", id);
      items.push(`<li><span class="ded-nombre">${esc(nombreDed(id))}</span><span class="ded-norma">${esc(inf && inf.norma ? inf.norma : "LIRPF")} · mitad en la cuota estatal y mitad en la autonómica</span><span class="ded-imp">−${eur(v)}</span></li>`);
    }
    if (drt) {
      const inf = P.estatal.deduccion_obtencion_rendimientos_trabajo;
      items.push(`<li><span class="ded-nombre">Deducción por obtención de rendimientos del trabajo</span><span class="ded-norma">${esc(inf.norma)} · se resta de la cuota líquida total</span><span class="ded-imp">−${eur(drt)}</span></li>`);
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
        <div class="pal-det"><span class="etq etq-cat">${CAT[r.categoria] || r.categoria}</span>${esc(r.detalle)}</div></li>`).join("")
      : `<li class="vacio">No se detectan palancas de ahorro relevantes para esta situación.</li>`;
    if (ahorroModo >= 1) $("res-palancas").insertAdjacentHTML("afterbegin",
      `<li><div class="pal-cab"><span class="pal-tit">Ya aplicada: declaración ${liq.modoTributacionElegido}</span><span class="pal-imp">−${eur0(ahorroModo)}/año</span></div><div class="pal-det">Frente a la declaración ${liq.modoTributacionElegido === "conjunta" ? "individual" : "conjunta"}.</div></li>`);

    // pista que pide un dato: el municipio cambia el resultado en este territorio
    const rm = reglasMunicipio(terr);
    const que = [rm.tramos.length ? "municipios pequeños" : "", rm.despoblada ? "zonas en riesgo de despoblación" : ""].filter(Boolean).join(" y ");
    const pista = rm.hay && hogar.municipioHabitantes == null && !hogar.zonaDespoblada
      ? `Indica tu municipio (paso 1): ${corto(terr)} tiene deducciones para ${que}.` : "";
    $("res-pista").textContent = pista;
    $("res-pista").hidden = !pista;

    pintarBotonesGuardar();
    if (vistaActual() === "comparar") pintarComparacion();
  }

  // ---- comparación entre territorios ---------------------------------------------------
  let metrica = "cuota";
  let cmpCache = {};
  document.querySelectorAll('input[name="metrica"]').forEach(r => r.addEventListener("change", () => { metrica = r.value; pintarComparacion(); }));

  // colores de la rampa: verde si pagas menos que en tu territorio, rojo si pagas más
  function rampa(difs, umbralIgual) {
    const maxAbs = Math.max(...difs.map(Math.abs)) || 1;
    return d => {
      if (Math.abs(d) < umbralIgual) return "--m-0";
      const k = Math.min(3, Math.ceil(Math.abs(d) / maxAbs * 3));
      return d < 0 ? `--m-g${k}` : `--m-r${k}`;
    };
  }
  // mapa coroplético: lo usan la portada y el comparador. Tu territorio va en amarillo
  // «de rotulador», dibujado el último para que su borde se vea entero.
  function dibujarMapa(svg, porT, terr, color, aria, titulo) {
    svg.setAttribute("viewBox", MAPA.viewBox.join(" "));
    let h = titulo ? `<title>${esc(titulo)}</title>` : "", tuyo = "";
    for (const t of Object.keys(MAPA.territorios)) {
      const c = porT[t]; if (!c) continue;
      const tu = t === terr;
      const p = `<path class="terr${tu ? " tu" : ""}" data-t="${t}" d="${MAPA.territorios[t]}" fill="${tu ? "var(--m-tu)" : `var(${color(c)})`}" tabindex="0" role="button" aria-label="${esc(aria(t, c))}"/>`;
      if (tu) tuyo = p; else h += p;
    }
    h += `<path class="fronteras" d="${MAPA.fronteras}"/><path class="recuadro" d="${MAPA.recuadroCanarias}"/>` + tuyo;
    const ct = MAPA.centros[terr];
    if (ct) h += `<text class="etq-mapa" x="${ct[0]}" y="${ct[1] + 5}" text-anchor="middle">Tú</text>`;
    svg.innerHTML = h;
  }
  const leyendaMapa = () => {
    const pasos = ["--m-g3", "--m-g2", "--m-g1", "--m-0", "--m-r1", "--m-r2", "--m-r3"];
    return `<span class="leyenda-grupo">Pagas menos<span class="leyenda-rampa">${pasos.map(p => `<span style="background:var(${p})"></span>`).join("")}</span>Pagas más</span>
      <span class="leyenda-grupo"><span class="leyenda-tu"></span>Tu territorio</span>`;
  };
  // puesto: 1 + territorios estrictamente más baratos (los empates comparten puesto)
  const puesto = (lista, val, yo, umbral) => 1 + lista.filter(c => val(c) < val(yo) - umbral).length;
  const ordinal = n => n + ".º";
  const nombres = l => l.length > 2 ? l.slice(0, 2).join(", ") + " y " + (l.length - 2) + " más" : l.join(" y ");

  function pintarComparacion() {
    if (!ultima) return;
    const terr = selTerr.value;
    const cmp = irpfsim.compararTerritorios(ultima.hogar, P);
    const val = c => metrica === "cuota" ? c.cuotaResultanteAutoliquidacion : c.tipoMedioEfectivo;
    const fmt = v => metrica === "cuota" ? eur0(v) : pct(v);
    const yo = cmp.find(c => c.territorio === terr);
    const base = yo ? val(yo) : 0;
    const umbralIgual = metrica === "cuota" ? 0.5 : 0.00005;
    const clase = rampa(cmp.map(c => val(c) - base), umbralIgual);
    const porT = Object.fromEntries(cmp.map(c => [c.territorio, c]));
    cmpCache = porT;

    dibujarMapa($("mapa"), porT, terr, c => clase(val(c) - base), (t, c) => `${T[t].nombre}: ${fmt(val(c))}`, "Mapa de España por territorio fiscal");
    $("leyenda").innerHTML = leyendaMapa();

    // ranking con una barra proporcional a la cifra
    const orden = cmp.slice().sort((a, b) => val(a) - val(b));
    const min = val(orden[0]), max = val(orden[orden.length - 1]), rango = max - min || 1;
    $("ranking").innerHTML = `<thead><tr><th>#</th><th>Territorio</th><th class="num">${metrica === "cuota" ? "Cuota" : "Tipo medio"}</th><th class="num ocultable">${metrica === "cuota" ? "Tipo medio" : "Cuota"}</th><th class="num">Diferencia</th></tr></thead><tbody>` +
      orden.map(c => {
        const d = val(c) - base, tu = c.territorio === terr;
        const dtxt = tu ? "Tú" : (Math.abs(d) < umbralIgual ? "igual" : (d < 0 ? "−" : "+") + (metrica === "cuota" ? eur0(Math.abs(d)) : (100 * Math.abs(d)).toFixed(2).replace(".", ",") + " p.p."));
        const cls = tu ? "tu" : d < -umbralIgual ? "barato" : d > umbralIgual ? "caro" : "";
        const ancho = Math.round(8 + 92 * (val(c) - min) / rango);
        return `<tr class="${cls}" data-t="${c.territorio}"><td class="pos">${puesto(cmp, val, c, umbralIgual)}</td><td class="rk-terr">${esc(corto(c.territorio))}${c.regimen !== "comun" ? '<span class="regimen">foral</span>' : ""}<span class="rk-barra" aria-hidden="true"><i style="width:${ancho}%"></i></span></td>
          <td class="num">${fmt(val(c))}</td><td class="num ocultable">${metrica === "cuota" ? pct(c.tipoMedioEfectivo) : eur0(c.cuotaResultanteAutoliquidacion)}</td>
          <td class="num dif ${d < -umbralIgual ? "gana" : d > umbralIgual ? "pierde" : ""}">${dtxt}</td></tr>`;
      }).join("") + "</tbody>";

    // resumen: tu puesto, el más barato, el más caro y la distancia entre los extremos
    const cuotaDe = c => c.cuotaResultanteAutoliquidacion;
    const porCuota = cmp.slice().sort((a, b) => cuotaDe(a) - cuotaDe(b));
    const barato = porCuota[0], caro = porCuota[porCuota.length - 1];
    const empatados = c => porCuota.filter(x => Math.abs(cuotaDe(x) - cuotaDe(c)) < 0.5).map(x => corto(x.territorio));
    $("comp-resumen").innerHTML = `
      <div class="tu"><dt>Tu territorio</dt><dd><span class="cifra-xl">${ordinal(puesto(cmp, cuotaDe, yo, 0.5))}</span><small>de 19 · ${esc(corto(terr))}, ${eur0(cuotaDe(yo))}</small></dd></div>
      <div><dt>Más barato</dt><dd><span class="cifra-xl">${eur0(cuotaDe(barato))}</span><small>${esc(nombres(empatados(barato)))}</small></dd></div>
      <div><dt>Más caro</dt><dd><span class="cifra-xl">${eur0(cuotaDe(caro))}</span><small>${esc(nombres(empatados(caro)))}</small></dd></div>
      <div><dt>De un extremo a otro</dt><dd><span class="cifra-xl">${eur0(cuotaDe(caro) - cuotaDe(barato))}</span><small>al año, con tu misma situación</small></dd></div>`;

    let txt = `Con tu situación, en <b>${esc(corto(terr))}</b> pagas <b>${eur0(cuotaDe(yo))}</b> de IRPF. `;
    if (cuotaDe(yo) - cuotaDe(barato) < 0.5) txt += `Es el territorio más barato de los 19; el más caro es ${esc(corto(caro.territorio))} (+${eur0(cuotaDe(caro) - cuotaDe(yo))}).`;
    else txt += `El más barato es <b>${esc(corto(barato.territorio))}</b>, donde pagarías <b>${eur0(cuotaDe(yo) - cuotaDe(barato))} menos</b>; el más caro, ${esc(corto(caro.territorio))}.`;
    $("comp-entradilla").innerHTML = txt;
    const hg = ultima.hogar;
    const notaMunicipio = hg.municipioHabitantes != null || hg.zonaDespoblada
      ? ` Se supone un municipio ${hg.municipioHabitantes != null ? `de ${miles(String(hg.municipioHabitantes))} habitantes` : "del mismo tipo"} en cada territorio${hg.zonaDespoblada ? ", incluido en su lista oficial de despoblación" : ""}.`
      : "";
    $("comp-nota").textContent = "Misma situación personal y económica en cada territorio, con su escala, sus mínimos y sus deducciones." + notaMunicipio + " Cambiar de residencia fiscal exige vivir allí más de 183 días al año y tener allí el centro de intereses.";
  }

  // tooltip de un mapa: cifra del territorio y diferencia con el tuyo
  function tooltipMapa(svg, tip, datosDe) {
    svg.addEventListener("mousemove", e => {
      const p = e.target.closest(".terr");
      const d = p && datosDe(p.dataset.t);
      if (!d) { tip.hidden = true; return; }
      tip.innerHTML = d;
      const r = svg.parentElement.getBoundingClientRect();
      tip.hidden = false;
      tip.style.left = Math.max(0, Math.min(e.clientX - r.left + 14, r.width - 190)) + "px";
      tip.style.top = (e.clientY - r.top + 14) + "px";
    });
    svg.addEventListener("mouseleave", () => { tip.hidden = true; });
  }
  const textoTip = (t, c, yo, terrYo) => {
    const d = c.cuotaResultanteAutoliquidacion - yo;
    return `<b>${esc(T[t].nombre)}</b>Cuota ${eur0(c.cuotaResultanteAutoliquidacion)} · ${pct(c.tipoMedioEfectivo)}<br>${t === terrYo ? "Tu territorio"
      : Math.abs(d) < 0.5 ? `Lo mismo que en ${esc(corto(terrYo))}` : d < 0 ? `${eur0(-d)} menos que en ${esc(corto(terrYo))}` : `${eur0(d)} más que en ${esc(corto(terrYo))}`}`;
  };
  tooltipMapa($("mapa"), $("mapa-tip"), t => ultima && cmpCache[t] ? textoTip(t, cmpCache[t], cmpCache[selTerr.value].cuotaResultanteAutoliquidacion, selTerr.value) : null);
  const elegirTerritorio = t => { if (!t || !T[t]) return; selTerr.value = t; pintarHijos(); pintarGastosTerritorio(); recalcular(); irA("calculadora"); };
  $("mapa").addEventListener("click", e => { const p = e.target.closest(".terr"); if (p) elegirTerritorio(p.dataset.t); });
  $("mapa").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.dataset.t) { e.preventDefault(); elegirTerritorio(e.target.dataset.t); } });
  $("ranking").addEventListener("click", e => { const tr = e.target.closest("tr[data-t]"); if (tr) elegirTerritorio(tr.dataset.t); });
  // pasar por una fila resalta su territorio en el mapa, y al revés
  const enfocar = t => {
    document.querySelectorAll("#mapa .terr.foco, #ranking tr.foco").forEach(x => x.classList.remove("foco"));
    if (t) document.querySelectorAll(`#mapa .terr[data-t="${t}"], #ranking tr[data-t="${t}"]`).forEach(x => x.classList.add("foco"));
  };
  $("ranking").addEventListener("mouseover", e => { const tr = e.target.closest("tr[data-t]"); enfocar(tr && tr.dataset.t); });
  $("ranking").addEventListener("mouseleave", () => enfocar(null));
  $("mapa").addEventListener("mouseover", e => { const p = e.target.closest(".terr"); enfocar(p && p.dataset.t); });
  $("mapa").addEventListener("mouseleave", () => enfocar(null));

  // ---- cuentas y clientes (Supabase) ----------------------------------------------------
  const dlgAcceso = $("dlg-acceso"), dlgGuardar = $("dlg-guardar"), dlgBorrar = $("dlg-borrar");
  // El enlace mágico y Google vuelven a la página sin hash (Supabase le añade #access_token=…).
  // Lo que había que hacer después se recuerda aquí, porque la pestaña del enlace es otra: la
  // vista a la que ir y, si se entró para suscribirse, el plan y el periodo elegidos.
  const TRAS_ACCESO = "mapafiscal.trasAcceso", PAGO_PENDIENTE = "mapafiscal.pagoPendiente";
  const recordar = (clave, valor) => { try { valor == null ? localStorage.removeItem(clave) : localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ } };
  const recordado = clave => { try { return localStorage.getItem(clave); } catch (e) { return null; } };
  const paginaActual = () => location.origin + location.pathname;

  // ¿Está activado el acceso con Google en Supabase (Authentication → Providers)? Mientras no
  // lo esté, el diálogo solo ofrece el enlace por correo.
  let google = null;
  function comprobarGoogle() {
    if (!google) google = fetch(CFG.supabaseUrl + "/auth/v1/settings", { headers: { apikey: CFG.supabaseKey } })
      .then(r => r.ok ? r.json() : {}).then(s => !!(s.external && s.external.google)).catch(() => false);
    return google;
  }

  // ---- casilla de aceptación de las condiciones ---------------------------------------------
  // Sin CFG.condicionesVersion no se exige la casilla, para no bloquear el acceso con una
  // condición que no se puede cumplir.
  const dlgCondiciones = $("dlg-condiciones");
  const ACEPTO_PENDIENTE = "mapafiscal.aceptoPendiente";
  const legalListo = () => !!CFG.condicionesVersion;
  // Solo al crear la cuenta: quien entra en una que ya existe la aceptó (si es de antes de la
  // versión vigente, se lo pide el diálogo «Antes de seguir»).
  function condicionesOk() {
    if (!legalListo() || modoAcceso !== "crear" || $("acceso-acepto").checked) return true;
    avisarAcceso("Para crear la cuenta, marca la casilla de las Condiciones y la Política de privacidad.");
    $("acceso-acepto").focus();
    return false;
  }
  // Sesión con las condiciones al día: nada que hacer. Si no, hay que volver a pedirlas (una
  // versión nueva, o una cuenta de antes de que existiera esta casilla): diálogo modal, sin
  // banners, que no deja seguir usando la cuenta hasta que se acepten.
  function comprobarCondiciones() {
    if (!legalListo() || !sesion.usuario) { if (dlgCondiciones.open) dlgCondiciones.close(); return; }
    if (sesion.perfil && sesion.perfil.condiciones_version === CFG.condicionesVersion) { if (dlgCondiciones.open) dlgCondiciones.close(); return; }
    if (dlgCondiciones.open) return;
    if (dlgAcceso.open) dlgAcceso.close();
    $("condiciones-acepto").checked = false;
    $("condiciones-msg").textContent = ""; $("condiciones-msg").className = "mensaje";
    dlgCondiciones.showModal();
  }
  // sin Escape: hasta aceptar o cerrar sesión
  dlgCondiciones.addEventListener("cancel", e => e.preventDefault());
  $("btn-condiciones-aceptar").addEventListener("click", async () => {
    const msg = $("condiciones-msg"), b = $("btn-condiciones-aceptar");
    if (!$("condiciones-acepto").checked) { msg.textContent = "Tienes que marcar la casilla para continuar."; msg.className = "mensaje error"; return; }
    b.disabled = true;
    const { error } = await sb.rpc("aceptar_condiciones", { p_version: CFG.condicionesVersion });
    b.disabled = false;
    if (error) { msg.textContent = "No se pudo guardar. " + MC.textoError(error).texto; msg.className = "mensaje error"; return; }
    sesion.perfil.condiciones_version = CFG.condicionesVersion;
    dlgCondiciones.close();
    mostrarBienvenida();
  });
  $("btn-condiciones-salir").addEventListener("click", async () => { await sb.auth.signOut(); dlgCondiciones.close(); cerrarCliente(); irA("inicio"); });

  // ---- cálculos guardados: ¿está la tabla desplegada? -----------------------------------------
  // Mientras no se aplique la migración de `calculos`, la web no ofrece guardar cálculos (ni lo
  // anuncia como ventaja). Sin sesión, la RLS responde «sin permiso»: la tabla existe.
  const CALCULO_PENDIENTE = "mapafiscal.calculoPendiente", BIENVENIDA = "mapafiscal.bienvenida.";
  let calculosOk = null;
  function comprobarCalculos() {
    if (!sb) return Promise.resolve(false);
    if (!calculosOk) calculosOk = sb.from("calculos").select("id").limit(1)
      .then(({ error, status }) => !error || !(status === 404 || error.code === "PGRST205" || error.code === "42P01"))
      .catch(() => false);
    return calculosOk;
  }

  // ---- diálogo de acceso: «Crear cuenta» y «Entrar» ------------------------------------------
  let accesoPara = null;         // { destino, pago } del diálogo de acceso abierto
  let modoAcceso = "crear", enviadoA = null, enviadoEn = 0, reloj = null, enlaceEnviado = false;
  const MODOS = {
    crear: { titulo: "Crea tu cuenta gratis", boton: "Crear cuenta con mi correo",
      cambio: '¿Ya tienes cuenta? <button class="btn-enlace" type="button" data-modo-ir="entrar">Entra</button>' },
    entrar: { titulo: "Entra en Mapafiscal", boton: "Enviarme el enlace para entrar",
      cambio: '¿Aún no tienes cuenta? <button class="btn-enlace" type="button" data-modo-ir="crear">Crea una gratis</button>' }
  };
  function avisarAcceso(texto, html) {
    const msg = $("acceso-msg");
    if (html) msg.innerHTML = html; else msg.textContent = texto || "";
    msg.className = texto || html ? "mensaje error" : "mensaje";
  }
  function ponerModo(m) {
    modoAcceso = m;
    for (const t of document.querySelectorAll(".acceso-modos [role=tab]")) {
      const sel = t.dataset.modo === m;
      t.setAttribute("aria-selected", String(sel)); t.tabIndex = sel ? 0 : -1;
    }
    $("t-acceso").textContent = MODOS[m].titulo;
    $("btn-enviar-txt").textContent = MODOS[m].boton;
    $("acceso-cambio").innerHTML = MODOS[m].cambio;
    $("acceso-ventajas").hidden = m !== "crear";
    $("acceso-legal").hidden = m !== "crear" || !legalListo();
    $("acceso-info").hidden = m !== "crear";
    avisarAcceso("");
  }
  function pintarVentajas(conCalculos) {
    $("acceso-ventajas").innerHTML = MC.ventajas({ calculos: conCalculos, ejercicios: EJERCICIOS.length, pagos: !!CFG.pagosActivos })
      .map(v => `<li><b>${esc(v.t)}</b><span>${esc(v.d)}</span></li>`).join("");
  }
  function mostrarPaso(enviado) {
    $("form-acceso").hidden = enviado; $("acceso-enviado").hidden = !enviado;
    if (!enviado) { clearInterval(reloj); reloj = null; }
  }
  function abrirAcceso(motivo, para, modo, error) {
    if (!sb) { irA("clientes"); return; }
    const v = vistaActual();
    accesoPara = para || { destino: ["planes", "clientes", "perfil"].includes(v) ? v : "cuenta" };
    enlaceEnviado = false;
    mostrarPaso(false);
    ponerModo(modo || "crear");
    const texto = $("acceso-motivo");
    texto.textContent = motivo || ""; texto.hidden = !motivo;
    pintarVentajas(false);
    comprobarCalculos().then(pintarVentajas);
    comprobarGoogle().then(g => { $("acceso-google").hidden = !g; });
    if (legalListo()) $("acceso-acepto").checked = false;
    $("acceso-email").removeAttribute("aria-invalid");
    $("acceso-sugerencia").hidden = true;
    ocupado($("btn-enviar-enlace"), false); ocupado($("btn-google"), false);
    if (error) avisarAcceso(error);
    if (!dlgAcceso.open) dlgAcceso.showModal();
    $("acceso-email").focus();
  }
  // Botón con estado de carga: deshabilitado y con un indicador, sin cambiar su tamaño.
  function ocupado(b, si) { b.disabled = si; b.classList.toggle("cargando", si); b.setAttribute("aria-busy", String(si)); }

  // Antes de enviar el enlace o de ir a Google: qué hacer al volver con la sesión iniciada, y si
  // se aceptaron las condiciones en esta pestaña (la pestaña que recibe la sesión puede ser otra).
  function prepararVuelta() {
    const p = accesoPara || { destino: "cuenta" };
    recordar(TRAS_ACCESO, p.destino);
    recordar(PAGO_PENDIENTE, p.pago ? JSON.stringify({ ...p.pago, t: Date.now() }) : null);
    recordar(ACEPTO_PENDIENTE, (legalListo() && modoAcceso === "crear" && $("acceso-acepto").checked) ? CFG.condicionesVersion : null);
    enlaceEnviado = true;
  }
  function pintarReloj() {
    const s = MC.segundosRestantes(enviadoEn, Date.now()), b = $("btn-reenviar");
    b.textContent = MC.textoReenvio(s); b.disabled = s > 0 || b.classList.contains("cargando");
    if (!s) { clearInterval(reloj); reloj = null; }
  }
  function mostrarEnviado() {
    mostrarPaso(true);
    $("acceso-enviado-a").textContent = enviadoA;
    $("acceso-enviado-para").textContent = modoAcceso === "crear" ? "activar tu cuenta" : "entrar";
    $("acceso-enviado-msg").textContent = ""; $("acceso-enviado-msg").className = "mensaje";
    const bandeja = MC.bandejaDe(enviadoA), a = $("acceso-bandeja");
    a.hidden = !bandeja;
    if (bandeja) { a.href = bandeja.url; a.textContent = "Abrir " + bandeja.nombre; }
    clearInterval(reloj); reloj = setInterval(pintarReloj, 1000); pintarReloj();
    $("t-enviado").focus();
  }
  async function enviarEnlace(reenvio) {
    const email = reenvio ? enviadoA : MC.normalizarCorreo($("acceso-email").value);
    const msg = reenvio ? $("acceso-enviado-msg") : $("acceso-msg"), b = reenvio ? $("btn-reenviar") : $("btn-enviar-enlace");
    if (!reenvio) {
      if (!MC.correoValido(email)) {
        $("acceso-email").setAttribute("aria-invalid", "true");
        avisarAcceso(email ? "Ese correo no parece válido. Revísalo: tiene que ser como nombre@ejemplo.es." : "Escribe tu correo electrónico.");
        $("acceso-email").focus();
        return;
      }
      $("acceso-email").removeAttribute("aria-invalid");
      if (!condicionesOk()) return;
    }
    ocupado(b, true); msg.textContent = ""; msg.className = "mensaje";
    prepararVuelta();
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: paginaActual(), shouldCreateUser: modoAcceso === "crear" } });
    ocupado(b, false);
    if (error) {
      const e = MC.textoError(error, modoAcceso);
      if (e.sinCuenta) msg.innerHTML = `${esc(e.texto)} <button class="btn-enlace" type="button" data-modo-ir="crear">Crear una cuenta con este correo</button>`;
      else msg.textContent = e.texto;
      msg.className = "mensaje error";
      if (reenvio && e.espera) { enviadoEn = Date.now() - (MC.ESPERA_REENVIO - e.espera) * 1000; clearInterval(reloj); reloj = setInterval(pintarReloj, 1000); }
      if (reenvio) pintarReloj();
      return;
    }
    enviadoA = email; enviadoEn = Date.now();
    if (reenvio) { msg.textContent = "Te hemos enviado otro enlace. Usa el más reciente."; msg.className = "mensaje ok"; clearInterval(reloj); reloj = setInterval(pintarReloj, 1000); pintarReloj(); }
    else mostrarEnviado();
  }
  $("form-acceso").addEventListener("submit", e => { e.preventDefault(); enviarEnlace(false); });
  $("btn-reenviar").addEventListener("click", () => enviarEnlace(true));
  $("btn-otro-correo").addEventListener("click", () => { mostrarPaso(false); $("acceso-email").select(); $("acceso-email").focus(); });
  // sugerencia de errata en el dominio («¿Querías decir …@gmail.com?»), sin corregir sola
  $("acceso-email").addEventListener("blur", () => {
    const s = MC.sugerirCorreo($("acceso-email").value), p = $("acceso-sugerencia");
    p.hidden = !s;
    if (s) p.innerHTML = `¿Querías decir <button class="btn-enlace" type="button" id="acceso-usar-sugerencia">${esc(s)}</button>?`;
  });
  $("acceso-email").addEventListener("input", () => { $("acceso-email").removeAttribute("aria-invalid"); if ($("acceso-msg").className.includes("error")) avisarAcceso(""); });
  dlgAcceso.addEventListener("click", e => {
    if (e.target.id === "acceso-usar-sugerencia") { $("acceso-email").value = e.target.textContent; $("acceso-sugerencia").hidden = true; $("acceso-email").focus(); return; }
    const ir = e.target.closest("[data-modo-ir]");
    if (ir) { mostrarPaso(false); ponerModo(ir.dataset.modoIr); $("acceso-email").focus(); return; }
    const tab = e.target.closest(".acceso-modos [role=tab]");
    if (tab) { ponerModo(tab.dataset.modo); return; }
    if (e.target === dlgAcceso) dlgAcceso.close();         // clic en el fondo
  });
  // pestañas con flechas (patrón WAI-ARIA)
  document.querySelector(".acceso-modos").addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const m = modoAcceso === "crear" ? "entrar" : "crear";
    ponerModo(e.key === "Home" ? "crear" : e.key === "End" ? "entrar" : m);
    $("tab-" + modoAcceso).focus();
  });
  $("btn-cerrar-acceso").addEventListener("click", () => dlgAcceso.close());
  dlgAcceso.addEventListener("close", () => {
    clearInterval(reloj); reloj = null;
    // se cerró sin pedir el enlace: no queda nada pendiente de guardar
    if (!enlaceEnviado) recordar(CALCULO_PENDIENTE, null);
  });
  $("btn-google").addEventListener("click", async () => {
    if (!condicionesOk()) return;
    const b = $("btn-google");
    ocupado(b, true);
    prepararVuelta();
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: paginaActual() } });
    if (error) {
      ocupado(b, false);
      const e = MC.textoError(error);
      avisarAcceso(e.sinGoogle ? e.texto : "No se ha podido abrir Google. Entra con tu correo: te mandamos un enlace.");
      $("acceso-google").hidden = true; google = Promise.resolve(false);
      $("acceso-email").focus();
      return;
    }
    // si el navegador no llega a salir hacia Google (bloqueado, sin red), se recupera el botón
    setTimeout(() => { if (document.visibilityState === "visible") ocupado(b, false); }, 8000);
  });
  $("btn-entrar").addEventListener("click", () => abrirAcceso(null, null, "entrar"));
  $("btn-cuenta").addEventListener("click", () => { if (sesion.usuario) irA("perfil"); else abrirAcceso(null, null, "crear"); });

  // Vuelta del enlace o de Google con error (caducado, Google sin configurar…): se limpia la
  // dirección y se explica en el diálogo, con el correo listo para pedir otro enlace.
  const errorVuelta = sb ? MC.errorDeVuelta(location.hash, location.search) : null;
  if (errorVuelta) {
    try { history.replaceState(null, "", location.pathname); } catch (e) { /* vista previa */ }
    if (errorVuelta.sinGoogle) google = Promise.resolve(false);
  }

  // Tras iniciar sesión: seguir al pago que se quería hacer, guardar el cálculo pendiente o ir a
  // la vista pedida. Solo lo hace la pestaña visible: si el enlace del correo abre otra
  // pestaña, la anterior no se mueve. Devuelve true si sale hacia el pago.
  function continuarTrasAcceso() {
    if (document.visibilityState === "hidden") return false;
    if (dlgAcceso.open) dlgAcceso.close();
    const destino = recordado(TRAS_ACCESO);
    let pago = null;
    try { pago = JSON.parse(recordado(PAGO_PENDIENTE) || "null"); } catch (e) { /* valor dañado */ }
    const calculo = MC.leerPendiente(recordado(CALCULO_PENDIENTE), Date.now());
    recordar(TRAS_ACCESO, null); recordar(PAGO_PENDIENTE, null); recordar(CALCULO_PENDIENTE, null);
    const vigente = pago && Date.now() - pago.t < 2 * 3600e3;
    if (vigente && !tienePlan()) { elegirPeriodo(pago.periodo); irA("planes"); iniciarPago(); return true; }
    if (vigente) { irA("perfil"); return false; }       // ya tenía plan: su suscripción está en Perfil
    if (calculo) { guardarPendiente(calculo, destino); return false; }
    if (destino) irA(destino === "cuenta" ? (tienePlan() ? "clientes" : "perfil") : destino);
    return false;
  }

  // Botones de la barra: «Entrar» y «Crear cuenta» sin sesión; con sesión, solo un avatar con las
  // iniciales del usuario (sustituye a los dos), que lleva a Perfil.
  const nombreDe = u => { const m = u.user_metadata || {}; return (sesion.perfil && sesion.perfil.nombre) || m.full_name || m.name || ""; };
  function pintarCuenta() {
    const b = $("btn-cuenta"), e = $("btn-entrar"), u = sesion.usuario;
    if (!u) {
      e.hidden = false;
      b.className = "btn btn-pri btn-sm"; b.textContent = "Crear cuenta";
      b.removeAttribute("title"); b.removeAttribute("aria-label");
      return;
    }
    e.hidden = true;
    b.className = "btn btn-avatar";
    b.textContent = MC.iniciales(nombreDe(u), u.email);
    b.title = u.email; b.setAttribute("aria-label", "Tu perfil (" + u.email + ")");
  }

  // ---- bienvenida del primer acceso -----------------------------------------------------------
  const dlgBienvenida = $("dlg-bienvenida");
  let calculoRecienGuardado = false;
  function mostrarBienvenida() {
    const u = sesion.usuario;
    if (!u || dlgCondiciones.open || dlgBienvenida.open) return;
    const clave = BIENVENIDA + u.id;
    if (!MC.tocaBienvenida(u, sesion.perfil, recordado(clave), Date.now())) return;
    recordar(clave, "1");
    const nombre = nombreDe(u);
    $("t-bienvenida").textContent = nombre ? `Hola, ${nombre.split(/\s+/)[0]}: ya tienes tu cuenta` : "Ya tienes tu cuenta";
    $("bienvenida-texto").textContent = calculoRecienGuardado
      ? "Tu cálculo ya está guardado. Lo tienes en tu perfil, desde cualquier dispositivo en el que entres con este correo."
      : (sesion.calculosOk ? "Cuando calcules tu renta, pulsa «Guarda este cálculo» y lo tendrás en tu perfil, desde cualquier dispositivo."
        : "Tu cuenta, tu plan y tus datos están en tu perfil, al que llegas desde el botón con tus iniciales.");
    $("bienvenida-nombre").value = nombre;
    $("bienvenida-despacho").value = (sesion.perfil && sesion.perfil.despacho) || "";
    $("bienvenida-msg").textContent = ""; $("bienvenida-msg").className = "mensaje";
    dlgBienvenida.showModal();
    $("bienvenida-nombre").focus();
  }
  $("btn-bienvenida-no").addEventListener("click", () => dlgBienvenida.close());
  $("form-bienvenida").addEventListener("submit", async e => {
    e.preventDefault();
    const b = $("btn-bienvenida-si"), msg = $("bienvenida-msg");
    const fila = { nombre: $("bienvenida-nombre").value.trim() || null, despacho: $("bienvenida-despacho").value.trim() || null };
    ocupado(b, true);
    const { error } = await sb.from("perfiles").update(fila).eq("id", sesion.usuario.id);
    ocupado(b, false);
    if (error) { msg.textContent = "No se pudo guardar. " + MC.textoError(error).texto; msg.className = "mensaje error"; return; }
    Object.assign(sesion.perfil, fila); pintarCuenta();
    if (vistaActual() === "perfil") pintarPerfil();
    dlgBienvenida.close();
  });

  let pendienteTrasAcceso = false, sesionCargada = false;
  async function cargarSesion() {
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    sesion.usuario = data.session ? data.session.user : null;
    sesion.ocultos = 0; sesion.suscripcion = null; sesion.calculos = [];
    sesion.calculosOk = await comprobarCalculos();
    if (sesion.usuario) {
      const [p, s, k] = await Promise.all([
        sb.from("perfiles").select("nombre, despacho, plan, condiciones_version, creado_en").eq("id", sesion.usuario.id).maybeSingle(),
        sb.from("suscripciones").select("plan, estado, periodo, periodo_fin, termina_en").eq("gestor_id", sesion.usuario.id).maybeSingle(),
        sesion.calculosOk ? sb.from("calculos").select("id, titulo, ejercicio, territorio, hogar, cuota_liquida, resultado, creado_en").order("creado_en", { ascending: false }).limit(50) : null
      ]);
      sesion.perfil = p.data || { plan: "gratis" };
      sesion.suscripcion = s.data || null;
      sesion.calculos = (k && k.data) || [];
      // Aceptación pendiente de esta pestaña (o de la que recibió el enlace/Google): se guarda
      // en cuanto se conoce el perfil, sin esperar a que el usuario vuelva a marcar la casilla.
      const pendiente = recordado(ACEPTO_PENDIENTE);
      if (pendiente) {
        recordar(ACEPTO_PENDIENTE, null);
        if (pendiente !== sesion.perfil.condiciones_version) {
          const { error } = await sb.rpc("aceptar_condiciones", { p_version: pendiente });
          if (!error) sesion.perfil.condiciones_version = pendiente;
        }
      }
      if (tienePlan()) {
        const c = await sb.from("clientes").select("id, alias, notas, territorio, hogar, cuota_liquida, resultado, actualizado_en").order("actualizado_en", { ascending: false });
        sesion.clientes = c.data || [];
      } else {
        // Sin plan, los clientes guardados (si los hay) siguen en la base de datos pero ocultos.
        sesion.clientes = [];
        const n = await sb.rpc("contar_mis_clientes");
        sesion.ocultos = n.data || 0;
      }
    } else { sesion.perfil = null; sesion.clientes = []; guardadoHogar = null; }
    sesionCargada = true;
    pintarCuenta();
    marcarPestanaClientes();
    pintarBotonesGuardar();
    pintarAvisosCuenta();
    comprobarCondiciones();
    if (vistaActual() === "clientes") pintarClientes();
    if (vistaActual() === "planes") pintarPlanes();
    if (vistaActual() === "perfil") pintarPerfil();
    let pagando = false;
    if (pendienteTrasAcceso && sesion.usuario) { pendienteTrasAcceso = false; pagando = continuarTrasAcceso(); }
    if (!pagando) mostrarBienvenida();
  }
  if (sb) sb.auth.onAuthStateChange(evento => {
    if (evento === "SIGNED_IN") {
      pendienteTrasAcceso = true;
      // con un pago pendiente, mientras se carga la cuenta se muestra ya «Planes»
      if (recordado(PAGO_PENDIENTE) && document.visibilityState !== "hidden") setTimeout(() => irA("planes"), 0);
    }
    setTimeout(cargarSesion, 0);    // fuera del callback: supabase-js no admite llamadas de auth dentro
  });
  if (sb) { comprobarGoogle(); comprobarCalculos(); }
  if (!sb) $("btn-cuenta").hidden = true;

  // ---- «Guarda este cálculo» -------------------------------------------------------------------
  // Con sesión, se guarda en el acto. Sin sesión, se recuerda el cálculo, se abre «Crear cuenta»
  // y se guarda al volver (continuarTrasAcceso). Con plan Gestor, el botón es «Guardar como
  // cliente» (su cartera); sin la tabla `calculos` desplegada, todo queda como antes.
  let guardadoHogar = null;      // hogar (JSON) del último cálculo guardado, para no duplicarlo
  function filaActual() {
    const { hogar, liq } = ultima;
    return MC.filaCalculo({ hogar, liq, ejercicio: P.ejercicio, territorio: hogar.territorio, nombreTerritorio: corto(hogar.territorio),
      retenciones: num("f-retenciones"), motor: P.generado });
  }
  function pintarBotonesGuardar() {
    const b = $("btn-guardar-calculo"), cli = $("btn-guardar-cliente");
    const ofrecer = !!(sb && sesion.calculosOk) && !tienePlan();
    b.hidden = !ofrecer;
    cli.hidden = ofrecer;                     // sin plan, «Guardar como cliente» solo llevaba al candado
    if (!ofrecer) return;
    const yaGuardado = ultima && guardadoHogar === JSON.stringify(ultima.hogar);
    b.classList.toggle("guardado", !!yaGuardado);
    if (!yaGuardado) { $("guardar-calculo-msg").textContent = ""; $("guardar-calculo-msg").className = "mensaje guardar-calculo-msg"; }
    $("btn-guardar-calculo-txt").textContent = yaGuardado ? "Cálculo guardado" : "Guarda este cálculo";
  }
  function avisoGuardado(texto, error) {
    const m = $("guardar-calculo-msg");
    m.innerHTML = texto; m.className = "mensaje guardar-calculo-msg" + (error ? " error" : " ok");
  }
  async function insertarCalculo(fila) {
    const { data, error } = await sb.from("calculos").insert(fila).select("id, titulo, ejercicio, territorio, hogar, cuota_liquida, resultado, creado_en").single();
    if (error) {
      avisoGuardado(error.code === "54000" ? "Tienes 50 cálculos guardados, el máximo. Borra alguno en tu <a href=\"#perfil\">perfil</a>." : "No se pudo guardar. " + esc(MC.textoError(error).texto), true);
      return false;
    }
    sesion.calculos.unshift(data);
    guardadoHogar = JSON.stringify(fila.hogar);
    avisoGuardado(`Guardado en tu <a href="#perfil">perfil</a>.`);
    pintarBotonesGuardar();
    return true;
  }
  function guardarCalculo(desde) {
    if (!ultima) return;
    const fila = filaActual();
    if (!sesion.usuario) {
      recordar(CALCULO_PENDIENTE, MC.pendienteGuardar(fila, Date.now()));
      abrirAcceso("Crea tu cuenta gratis y guardamos este cálculo en ella. Si ya tienes cuenta, entra y lo guardamos igual.",
        { destino: desde || "calculadora" }, "crear");
      return;
    }
    if (guardadoHogar === JSON.stringify(fila.hogar)) { irA("perfil"); return; }
    const b = $("btn-guardar-calculo");
    ocupado(b, true);
    insertarCalculo(fila).finally(() => ocupado(b, false));
  }
  // al volver de crear la cuenta: el formulario de la otra pestaña no está aquí, se rellena
  async function guardarPendiente(fila, destino) {
    const ej = +fila.ejercicio;
    if (ej && ej !== P.ejercicio && EJERCICIOS.includes(ej)) await cambiarEjercicio(ej);
    cerrarCliente();
    rellenarFormulario(fila.hogar);
    irA(destino && destino !== "cuenta" ? destino : "calculadora");
    if (await insertarCalculo(fila)) calculoRecienGuardado = true;
    if (vistaActual() === "comparar") pintarAvisosCuenta();
    mostrarBienvenida();
  }
  $("btn-guardar-calculo").addEventListener("click", () => guardarCalculo("calculadora"));

  // ---- avisos discretos en el comparador y en las herramientas ------------------------------
  // Solo sin sesión, solo si hay algo que guardar de verdad, y con un «No mostrar más» que se
  // recuerda en este navegador.
  const AVISO_CERRADO = "mapafiscal.avisoCuentaCerrado";
  const ICONO_GUARDAR = '<svg class="aviso-cuenta-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2h7l2 2v10h-9z"/><path d="M5.5 2v3.5h4V2M5.5 14v-4.5h5V14"/></svg>';
  function pintarAviso(cont, texto, boton, accion) {
    if (!cont) return;
    const ver = !!(sb && sesionCargada && !sesion.usuario && sesion.calculosOk && !recordado(AVISO_CERRADO));
    cont.hidden = !ver;
    if (!ver) return;
    cont.innerHTML = `${ICONO_GUARDAR}<p>${texto}</p><div class="aviso-cuenta-acc"><button class="btn btn-sec btn-sm" type="button" data-aviso-crear>${boton}</button>
      <button class="aviso-cuenta-cerrar" type="button" data-aviso-cerrar aria-label="No mostrar más este aviso"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>`;
    cont.onclick = e => {
      if (e.target.closest("[data-aviso-cerrar]")) { recordar(AVISO_CERRADO, "1"); pintarAvisosCuenta(); }
      else if (e.target.closest("[data-aviso-crear]")) accion();
    };
  }
  const HERRAMIENTAS_AVISO = ["sueldo-neto", "plan-pensiones"];
  function pintarAvisosCuenta() {
    pintarAviso($("comp-cuenta"), "¿Vas a volver a mirarlo? Con una cuenta gratis guardas esta situación y la retomas en cualquier dispositivo.",
      "Guardar esta situación", () => guardarCalculo("comparar"));
    for (const v of HERRAMIENTAS_AVISO) {
      const sec = $("v-" + v);
      if (!sec) continue;
      let cont = sec.querySelector(":scope > .aviso-cuenta");
      if (!cont && sb && !sesion.usuario) { cont = document.createElement("div"); cont.className = "aviso-cuenta aviso-cuenta-herr"; cont.hidden = true; sec.appendChild(cont); }
      pintarAviso(cont, "Con una cuenta gratis guardas tus cálculos de la renta y los retomas en cualquier dispositivo.",
        "Crear cuenta gratis", () => abrirAcceso(null, { destino: v }, "crear"));
    }
  }
  document.addEventListener("mapafiscal:vista", e => { if (e.detail && HERRAMIENTAS_AVISO.includes(e.detail.vista)) pintarAvisosCuenta(); });

  // «Mis clientes» solo con un plan de pago activo (la base de datos lo exige por RLS).
  function tienePlan() { return !!(sb && sesion.usuario && sesion.perfil && sesion.perfil.plan && sesion.perfil.plan !== "gratis"); }
  const CANDADO = '<svg class="icono-candado" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';
  function marcarPestanaClientes() {
    const a = document.querySelector('.nav a[data-vista="clientes"]');
    const bloqueada = !tienePlan();
    a.classList.toggle("bloqueada", bloqueada);
    a.innerHTML = bloqueada ? `<span>Mis clientes</span>${CANDADO}` : "Mis clientes";
    if (bloqueada) a.title = "Se desbloquea con el plan Gestor"; else a.removeAttribute("title");
  }

  // Vista bloqueada: una cartera de ejemplo difuminada detrás de la explicación.
  function pintarBloqueo(cont) {
    const EJEMPLO = [["Familia G. — Getafe", "Madrid", 4812.37, "A devolver 612 €"], ["Autónomo diseño", "Cataluña", 9120.5, "A ingresar 1.240 €"],
      ["Pensionista Vitoria", "Araba/Álava", 2310.08, "A devolver 95 €"], ["Pareja Sevilla", "Andalucía", 6405.12, "A ingresar 318 €"]];
    const fondo = `<div class="bloqueo-fondo" aria-hidden="true"><div class="tarjeta tarjeta-tabla"><table class="tabla-clientes">
      <thead><tr><th>Cliente</th><th>Territorio</th><th class="num">Cuota líquida</th><th class="num">Resultado</th></tr></thead>
      <tbody>${EJEMPLO.map(([a, t, c, r]) => `<tr><td><div class="alias">${a}</div></td><td>${t}</td><td class="num">${eur(c)}</td><td class="num">${r}</td></tr>`).join("")}</tbody></table></div></div>`;
    let pie = "";
    if (!sb) pie = `<p class="ayuda">Disponible en la web de Mapafiscal, con tu cuenta.</p>`;
    else if (!sesion.usuario) pie = `<p class="ayuda">¿Ya tienes el plan? <button class="btn btn-txt btn-sm" type="button" id="cli-acceder">Accede con tu correo</button></p>`;
    else {
      pie = `<p class="ayuda">Has accedido como ${esc(sesion.usuario.email)}. <button class="btn btn-txt btn-sm" type="button" id="cli-salir">Cerrar sesión</button></p>`;
      if (sesion.ocultos) pie += `<p class="ayuda">Tienes ${sesion.ocultos} ${sesion.ocultos === 1 ? "cliente guardado" : "clientes guardados"}: volverán a aparecer al reactivar el plan.
        <button class="btn btn-txt btn-sm btn-peligro" type="button" id="cli-borrar-todo">Eliminarlos definitivamente</button></p>`;
    }
    cont.innerHTML = `<div class="bloqueo">${fondo}<div class="tarjeta bloqueo-tarjeta">
      <div class="bloqueo-icono">${CANDADO}</div>
      <h2>Mis clientes se desbloquea con el plan Gestor</h2>
      <p>Guarda la situación fiscal de cada cliente, recalcúlala cuando cambie la normativa, compárala entre territorios e imprime su informe.</p>
      <a class="btn btn-pri" href="#planes">Ver planes</a>${pie}</div></div>`;
    const acceder = $("cli-acceder"), salir = $("cli-salir"), borrar = $("cli-borrar-todo");
    if (acceder) acceder.addEventListener("click", () => abrirAcceso(null, null, "entrar"));
    if (salir) salir.addEventListener("click", async () => { await sb.auth.signOut(); cerrarCliente(); });
    if (borrar) borrar.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar definitivamente ${sesion.ocultos === 1 ? "tu cliente guardado" : `tus ${sesion.ocultos} clientes guardados`}? Esta acción no se puede deshacer.`)) return;
      const { error } = await sb.rpc("borrar_mis_clientes");
      if (error) { alert("No se pudieron eliminar: " + error.message); return; }
      await cargarSesion();
    });
  }

  function pintarClientes() {
    const cont = $("cli-contenido");
    $("cli-acciones").hidden = true;
    if (!tienePlan()) { pintarBloqueo(cont); return; }
    $("cli-acciones").hidden = false;
    const plan = sesion.perfil.plan;
    const q = $("cli-buscar").value.trim().toLowerCase();
    const lista = sesion.clientes.filter(c => !q || c.alias.toLowerCase().includes(q) || (c.notas || "").toLowerCase().includes(q));
    const barra = `<div class="cuenta-barra"><span>${esc(sesion.usuario.email)} <span class="plan-chip">Plan ${plan === "despacho" ? "Despacho" : "Gestor"}</span>
        · ${sesion.clientes.length} ${sesion.clientes.length === 1 ? "cliente" : "clientes"}</span>
      <span>${CFG.pagosActivos ? '<button class="btn btn-txt btn-sm" type="button" id="cli-portal">Gestionar suscripción</button>' : ""}
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

  async function abrirCliente(c) {
    // un cliente guardado con otro ejercicio se abre con ese ejercicio, si se ofrece
    const ej = c.hogar && +c.hogar.ejercicio;
    if (ej && ej !== P.ejercicio && EJERCICIOS.includes(ej)) await cambiarEjercicio(ej);
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
    if (!tienePlan()) { irA("clientes"); return; }     // vista bloqueada: explica el plan Gestor
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
      // 42501: la RLS rechaza la fila (sin plan activo); PGRST116: la actualización no ve el cliente.
      const sinPlan = r.error.code === "42501" || r.error.code === "PGRST116";
      msg.innerHTML = sinPlan ? `Guardar clientes requiere el plan Gestor activo. <a href="#planes">Ver planes</a>.` : "No se pudo guardar: " + esc(r.error.message);
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
  // Al volver de Stripe o de Google con «Atrás» la página puede salir de la caché con botones desactivados.
  window.addEventListener("pageshow", e => {
    if (!e.persisted) return;
    $("btn-google").disabled = false;
    if (vistaActual() === "planes") pintarPlanes();
    if (vistaActual() === "perfil") pintarPerfil();
  });

  let periodo = "mensual";
  document.querySelectorAll('input[name="periodo"]').forEach(r => r.addEventListener("change", () => { periodo = r.value; pintarPlanes(); }));
  function elegirPeriodo(p) {
    const r = document.querySelector(`input[name="periodo"][value="${p}"]`);
    if (r) { r.checked = true; periodo = p; }
  }

  // Abre Stripe (checkout o portal) a través de una Edge Function; devuelve false si no se pudo.
  const ERRORES_PAGO = {
    ya_suscrito: "Ya tienes una suscripción activa. Puedes cambiarla desde «Gestionar suscripción» en tu perfil.",
    sin_suscripcion: "No encontramos ninguna suscripción asociada a tu cuenta.",
    pagos_no_configurados: "El pago no está disponible en este momento. Inténtalo de nuevo más tarde.",
    precio_no_configurado: "El pago no está disponible en este momento. Inténtalo de nuevo más tarde."
  };
  async function irAFuncion(nombre, cuerpo) {
    const { data, error } = await sb.functions.invoke(nombre, { body: { ...cuerpo, volver: paginaActual() } });
    if (!error && data && data.url) { location.href = data.url; return true; }
    let codigo = null;
    try { codigo = (await error.context.json()).error; } catch (e) { /* sin cuerpo JSON */ }
    if (codigo === "sin_sesion") {
      abrirAcceso("Tu sesión ha caducado. Vuelve a iniciar sesión para continuar.",
        nombre === "crear-checkout" ? { destino: "planes", pago: { plan: cuerpo.plan, periodo: cuerpo.periodo } } : undefined, "entrar");
      return false;
    }
    alert(ERRORES_PAGO[codigo] || "No se ha podido abrir el pago. Inténtalo de nuevo en unos minutos.");
    if (codigo === "ya_suscrito") cargarSesion();
    return false;
  }

  const importe = n => Number.isInteger(n) ? eur0(n) : eur(n);
  function precioPeriodo(p) {
    const pr = CFG.precios || {};
    const PERIODO = { semanal: [pr.gestorSemanal, "semana"], mensual: [pr.gestorMensual, "mes"], anual: [pr.gestorAnual, "año"] };
    return PERIODO[p] || PERIODO.mensual;
  }

  // «Suscribirme» lleva directo a Stripe Checkout. Sin sesión, primero se inicia sesión (enlace o
  // Google) y, al volver, se sigue al pago con el mismo plan y periodo (continuarTrasAcceso).
  async function iniciarPago() {
    const pago = { plan: "gestor", periodo };
    if (!sesion.usuario) {
      const [cifra, unidad] = precioPeriodo(periodo);
      abrirAcceso(`Inicia sesión o crea tu cuenta para continuar al pago del plan Gestor ${periodo} (${importe(cifra)} / ${unidad}, IVA incluido).`,
        { destino: "planes", pago });
      return;
    }
    const cta = $("cta-gestor");
    if (cta) { cta.disabled = true; cta.textContent = "Abriendo el pago…"; }
    if (!await irAFuncion("crear-checkout", pago) && vistaActual() === "planes") pintarPlanes();
  }

  function pintarPlanes() {
    const pr = CFG.precios || {};
    const plan = sesion.perfil ? sesion.perfil.plan : "gratis";
    const [cifra, unidad] = precioPeriodo(periodo);
    const precioGestor = `${importe(cifra)}<small> / ${unidad}</small>`;
    const notaGestor = periodo === "anual" && pr.gestorAnual ? `Equivale a ${eur(pr.gestorAnual / 12)} al mes. IVA incluido.`
      : periodo === "semanal" ? "Pensado para la campaña de la renta. IVA incluido." : "IVA incluido.";
    const ctaGestor = plan !== "gratis"
      ? `<a class="btn btn-sec" href="#perfil">Tu plan actual · ver suscripción</a>`
      : `<button class="btn btn-pri" type="button" id="cta-gestor">Suscribirme</button>`;
    $("planes").innerHTML = `
      <div class="plan">
        <h2>Gratis</h2><p class="plan-para">Para calcular tu propia declaración.</p>
        <div class="plan-precio">0 €</div><p class="plan-precio-nota">Sin cuenta.</p>
        <ul><li>IRPF ${textoEjercicios()} con tu situación real</li><li>Comparación en los 19 territorios</li><li>Desglose con casillas y deducciones aplicadas</li><li>Palancas de ahorro para tu caso</li></ul>
        <a class="btn btn-sec" href="#calculadora">Usar la calculadora</a>
      </div>
      <div class="plan destacado">
        <span class="plan-cinta">Para asesores y gestorías</span>
        <h2>Gestor</h2><p class="plan-para">Tu cartera de clientes, siempre calculada.</p>
        <div class="plan-precio">${precioGestor}</div><p class="plan-precio-nota">${notaGestor}</p>
        <ul><li>Todo lo del plan Gratis</li><li>Mis clientes: tu cartera, sin límite y guardada en la nube (UE)</li><li>Optimización por cliente: pensiones, conjunta, deducciones</li><li>Informe de cada cliente listo para imprimir</li><li>Recalcular la cartera cuando cambia la normativa</li><li>Sin anuncios</li></ul>
        ${ctaGestor}
      </div>`;
    $("nota-precios").textContent = "Pago seguro con Stripe. Puedes cambiar de periodo o darte de baja cuando quieras desde tu perfil.";
    const cta = $("cta-gestor");
    if (cta) cta.addEventListener("click", iniciarPago);
  }

  // ---- perfil: cuenta, plan y suscripción --------------------------------------------------
  const fechaLarga = f => new Date(f).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const ESTADOS = {
    active: ["Activa", "ok"], trialing: ["En periodo de prueba", "ok"], past_due: ["Pago pendiente", "aviso"],
    unpaid: ["Impagada", "aviso"], incomplete: ["Pago sin completar", "aviso"], incomplete_expired: ["Pago no completado", ""],
    canceled: ["Cancelada", ""], paused: ["En pausa", ""]
  };
  const VIGENTES = new Set(["active", "trialing", "past_due"]);                     // dan el plan
  const COBRABLES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);
  const PLAN_TXT = { gratis: "Gratis", gestor: "Gestor", despacho: "Despacho" };
  const PERIODO_TXT = { semanal: "Semanal", mensual: "Mensual", anual: "Anual" };

  function pintarPerfil() {
    const cont = $("perfil-contenido"), u = sesion.usuario;
    if (sb && !sesionCargada) { cont.innerHTML = `<p class="vacio">Cargando tu perfil…</p>`; return; }
    if (!sb || !u) {
      cont.innerHTML = `<div class="tarjeta estado-vacio"><h2>Entra para ver tu perfil</h2>
        <p>Aquí están tu cuenta, tu plan${sesion.calculosOk ? " y tus cálculos guardados" : ""}.</p>
        ${sb ? `<div class="perfil-acciones perfil-acciones-centro"><button class="btn btn-pri" type="button" id="perfil-acceder">Entrar</button>
          <button class="btn btn-sec" type="button" id="perfil-crear">Crear cuenta gratis</button></div>` : ""}</div>`;
      const b = $("perfil-acceder"), c = $("perfil-crear");
      if (b) b.addEventListener("click", () => abrirAcceso(null, { destino: "perfil" }, "entrar"));
      if (c) c.addEventListener("click", () => abrirAcceso(null, { destino: "perfil" }, "crear"));
      return;
    }
    const p = sesion.perfil || { plan: "gratis" }, s = sesion.suscripcion, conPlan = tienePlan();
    const prov = (u.app_metadata && (u.app_metadata.providers || [u.app_metadata.provider])) || [];
    const acceso = [prov.includes("google") ? "Google" : "", prov.includes("email") ? "enlace por correo" : ""].filter(Boolean).join(" y ") || "enlace por correo";

    // suscripción
    const [estTxt, estCls] = s ? (ESTADOS[s.estado] || [s.estado, ""]) : ["", ""];
    const datos = [];
    if (s && s.periodo) datos.push(["Facturación", PERIODO_TXT[s.periodo]]);
    if (s && VIGENTES.has(s.estado)) {
      if (s.termina_en) datos.push(["Termina el", fechaLarga(s.termina_en)]);
      else if (s.periodo_fin) datos.push(["Próxima renovación", fechaLarga(s.periodo_fin)]);
    } else if (s && s.termina_en) datos.push(["Terminó el", fechaLarga(s.termina_en)]);
    const nota = s && s.estado === "past_due" ? "No se ha podido cobrar la última cuota y Stripe lo está reintentando. Revisa tu tarjeta en «Gestionar suscripción»."
      : s && VIGENTES.has(s.estado) && s.termina_en ? "Has cancelado la renovación: mantienes el plan hasta esa fecha. Puedes reactivarla en «Gestionar suscripción»."
      : conPlan ? "Cambia de periodo o de tarjeta, descarga tus facturas o date de baja en «Gestionar suscripción»."
      : "Con el plan Gestor desbloqueas «Mis clientes»: tu cartera guardada, la optimización por cliente y los informes.";
    const tSus = `<div class="tarjeta"><h2>Plan ${esc(PLAN_TXT[p.plan] || p.plan)}${s ? ` <span class="chip-estado ${estCls}">${esc(estTxt)}</span>` : ""}</h2>
      ${datos.length ? `<dl class="datos">${datos.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join("")}</dl>` : ""}
      <p>${nota}</p>
      <div class="perfil-acciones">${conPlan ? "" : '<a class="btn btn-pri" href="#planes">Ver planes</a>'}
        ${s && CFG.pagosActivos ? `<button class="btn btn-sec" type="button" id="perfil-portal">${conPlan ? "Gestionar suscripción" : "Ver facturas"}</button>` : ""}</div></div>`;

    // clientes: solo si tiene plan o clientes guardados (si no, ya lo explica la tarjeta del plan)
    const n = conPlan ? sesion.clientes.length : sesion.ocultos, nTxt = `${n} ${n === 1 ? "cliente guardado" : "clientes guardados"}`;
    const tCli = !conPlan && !n ? "" : `<div class="tarjeta"><h2>Mis clientes</h2><p>${conPlan ? (n ? `Tienes ${nTxt}.` : "Todavía no has guardado ningún cliente.")
        : `Tienes ${nTxt}, ocultos hasta que reactives el plan Gestor.`}</p>
      <div class="perfil-acciones"><a class="btn btn-sec" href="#clientes">Ir a Mis clientes</a></div></div>`;

    // cálculos guardados
    const k = sesion.calculos || [];
    const resCalc = c => {
      const r = c.resultado || {};
      if (r.retenciones) return r.cuotaDiferencial < 0 ? `<span class="gana">A devolver ${eur0(-r.cuotaDiferencial)}</span>` : `A ingresar ${eur0(r.cuotaDiferencial)}`;
      return c.cuota_liquida != null ? `Cuota ${eur0(+c.cuota_liquida)}` : "";
    };
    const tCalc = !sesion.calculosOk ? "" : `<div class="tarjeta" id="perfil-calculos"><h2>Mis cálculos <span class="chip-estado">${k.length}</span></h2>
      ${k.length ? `<ul class="lista-calculos">${k.map(c => `<li>
          <div class="lc-txt"><b>${esc(c.titulo)}</b><span>${esc(corto(c.territorio))} · ${c.ejercicio} · ${new Date(c.creado_en).toLocaleDateString("es-ES")}</span></div>
          <div class="lc-res">${resCalc(c)}</div>
          <div class="lc-acc"><button class="btn btn-txt btn-sm" type="button" data-calc-abrir="${c.id}">Abrir</button>
            <button class="btn btn-peligro btn-sm" type="button" data-calc-borrar="${c.id}" aria-label="Borrar «${esc(c.titulo)}»">Borrar</button></div></li>`).join("")}</ul>`
        : `<p>Aún no has guardado ningún cálculo. En la calculadora, pulsa «Guarda este cálculo» y lo tendrás aquí, en cualquier dispositivo.</p>
          <div class="perfil-acciones"><a class="btn btn-sec" href="#calculadora">Ir a la calculadora</a></div>`}</div>`;

    // cuenta
    const tCuenta = `<div class="tarjeta"><h2>Cuenta</h2>
      <dl class="datos"><dt>Correo</dt><dd>${esc(u.email)}</dd><dt>Acceso</dt><dd>Con ${esc(acceso)}</dd>
        ${u.created_at ? `<dt>Alta</dt><dd>${fechaLarga(u.created_at)}</dd>` : ""}</dl>
      <form id="perfil-form" novalidate>
      <div class="campo"><label for="perfil-nombre">Nombre <span class="ayuda">(opcional)</span></label><input type="text" id="perfil-nombre" maxlength="120" autocomplete="name" value="${esc(nombreDe(u))}"></div>
      <div class="campo"><label for="perfil-despacho">Despacho o gestoría <span class="ayuda">(opcional)</span></label><input type="text" id="perfil-despacho" maxlength="160" autocomplete="organization" value="${esc(p.despacho || "")}"></div>
      <div class="perfil-acciones"><button class="btn btn-sec" type="submit" id="perfil-guardar">Guardar</button><span class="mensaje" id="perfil-msg" role="status"></span></div></form></div>`;
    const tBorrar = `<div class="tarjeta zona-peligro"><h2>Borrar la cuenta</h2>
      <p>Borra tu cuenta y tus datos: el perfil${sesion.calculosOk ? ", los cálculos" : ""} y los clientes guardados${s && COBRABLES.has(s.estado) ? ". Tu suscripción se cancela en el acto" : ""}. No se puede deshacer.</p>
      <div class="perfil-acciones"><button class="btn btn-peligro" type="button" id="perfil-borrar">Borrar mi cuenta</button></div></div>`;

    const nombre = nombreDe(u);
    const cab = `<div class="perfil-cab tarjeta"><span class="perfil-avatar" aria-hidden="true">${esc(MC.iniciales(nombre, u.email))}</span>
      <div class="perfil-quien"><b>${esc(nombre || u.email)}</b>${nombre ? `<span>${esc(u.email)}</span>` : ""}${p.despacho ? `<span>${esc(p.despacho)}</span>` : ""}</div>
      <span class="plan-chip">Plan ${esc(PLAN_TXT[p.plan] || p.plan)}</span>
      <button class="btn btn-sec btn-sm" type="button" id="perfil-salir">Cerrar sesión</button></div>`;
    cont.innerHTML = `${cab}<div class="perfil"><div class="perfil-col">${tCalc}${tSus}${tCli}</div><div class="perfil-col">${tCuenta}${tBorrar}</div></div>`;

    const lista = $("perfil-calculos");
    if (lista) lista.addEventListener("click", async e => {
      const b = e.target.closest("[data-calc-abrir], [data-calc-borrar]");
      if (!b) return;
      const c = k.find(x => x.id === (b.dataset.calcAbrir || b.dataset.calcBorrar));
      if (!c) return;
      if (b.dataset.calcAbrir) {
        const ej = +c.ejercicio;
        if (ej && ej !== P.ejercicio && EJERCICIOS.includes(ej)) await cambiarEjercicio(ej);
        cerrarCliente(); rellenarFormulario(c.hogar);
        guardadoHogar = JSON.stringify(c.hogar); pintarBotonesGuardar();
        irA("calculadora");
        return;
      }
      if (!confirm(`¿Borrar el cálculo «${c.titulo}»? No se puede deshacer.`)) return;
      b.disabled = true;
      const { error } = await sb.from("calculos").delete().eq("id", c.id);
      if (error) { b.disabled = false; alert("No se pudo borrar. " + MC.textoError(error).texto); return; }
      sesion.calculos = sesion.calculos.filter(x => x.id !== c.id);
      if (guardadoHogar === JSON.stringify(c.hogar)) guardadoHogar = null;
      pintarPerfil();
    });

    const portal = $("perfil-portal");
    if (portal) portal.addEventListener("click", async () => {
      portal.disabled = true;
      if (!await irAFuncion("portal-facturacion", { vista: "perfil" })) portal.disabled = false;
    });
    $("perfil-form").addEventListener("submit", async e => {
      e.preventDefault();
      const msg = $("perfil-msg"), b = $("perfil-guardar");
      const fila = { nombre: $("perfil-nombre").value.trim() || null, despacho: $("perfil-despacho").value.trim() || null };
      ocupado(b, true);
      const { error } = await sb.from("perfiles").update(fila).eq("id", u.id);
      ocupado(b, false);
      if (error) { msg.textContent = "No se pudo guardar. " + MC.textoError(error).texto; msg.className = "mensaje error"; return; }
      Object.assign(sesion.perfil, fila); pintarCuenta();
      pintarPerfil();
      $("perfil-msg").textContent = "Guardado."; $("perfil-msg").className = "mensaje ok";
    });
    $("perfil-salir").addEventListener("click", async () => { await sb.auth.signOut(); cerrarCliente(); irA("inicio"); });
    $("perfil-borrar").addEventListener("click", () => {
      $("borrar-suscripcion").hidden = !(s && COBRABLES.has(s.estado));
      $("borrar-email").value = ""; $("borrar-msg").textContent = ""; $("borrar-msg").className = "mensaje";
      $("btn-confirmar-borrar").hidden = false; $("btn-confirmar-borrar").disabled = false;
      $("btn-cancelar-borrar").textContent = "Cancelar";
      dlgBorrar.showModal(); $("borrar-email").focus();
    });
  }

  // Borrar la cuenta (derecho de supresión): la Edge Function cancela la suscripción y borra
  // la cuenta con su perfil y sus clientes. Se confirma escribiendo el correo de la cuenta.
  const ERRORES_BORRAR = {
    confirmacion_no_valida: "El correo no coincide con el de tu cuenta.",
    sin_sesion: "Tu sesión ha caducado. Vuelve a iniciar sesión y repite la operación.",
    error_stripe: "No se ha podido cancelar tu suscripción en Stripe, así que no se ha borrado nada. Inténtalo de nuevo en unos minutos.",
    pagos_no_configurados: "Ahora mismo no se puede cancelar tu suscripción, así que no se ha borrado nada. Inténtalo de nuevo más tarde."
  };
  $("btn-confirmar-borrar").addEventListener("click", async () => {
    const msg = $("borrar-msg"), b = $("btn-confirmar-borrar"), u = sesion.usuario;
    const correo = $("borrar-email").value.trim();
    if (!u || correo.toLowerCase() !== (u.email || "").toLowerCase()) { msg.textContent = "Escribe el correo de tu cuenta tal cual."; msg.className = "mensaje error"; return; }
    b.disabled = true; msg.textContent = "Borrando tu cuenta…"; msg.className = "mensaje";
    const { data, error } = await sb.functions.invoke("borrar-cuenta", { body: { confirmar: correo } });
    if (error || !data || !data.borrada) {
      let codigo = null;
      try { codigo = (await error.context.json()).error; } catch (e) { /* sin cuerpo JSON */ }
      b.disabled = false;
      msg.textContent = ERRORES_BORRAR[codigo] || "No se ha podido borrar la cuenta. Inténtalo de nuevo en unos minutos.";
      msg.className = "mensaje error";
      return;
    }
    await sb.auth.signOut({ scope: "local" });       // el usuario ya no existe en el servidor
    cerrarCliente();
    b.hidden = true; $("btn-cancelar-borrar").textContent = "Cerrar";
    msg.textContent = "Tu cuenta y tus datos se han borrado."; msg.className = "mensaje ok";
    irA("inicio");
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

  // ---- inicio: portada con cálculo rápido, mapa y acceso a las herramientas ---------------
  // Iconos de línea propios (24×24, trazo con currentColor). Las herramientas nuevas pueden
  // usar cualquiera con `icono: "<clave>"`.
  const ICONOS = {
    calculadora: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15v3M8.5 18h.01M12 18h.01"/>',
    mapa: '<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    cartera: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18"/>',
    nomina: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5h1M16.5 14.5h1"/>',
    hucha: '<path d="M4 12a7 6 0 0 1 13.4-2.4L20 9v4l-2 1a7 6 0 0 1-2 3v2h-2.5v-1.2a8 8 0 0 1-3 0V19H8v-2a6 6 0 0 1-4-5z"/><path d="M10 7.5h3M15 11h.01"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>',
    grafico: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>'
  };
  const icono = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[k] || ICONOS.grafico}</svg>`;
  // Solo herramientas que ya existen (nada de «próximamente»). La que destaca cambia según el
  // mes (CFG.destacados: mes 0-11 -> clave; lo rellena Lanzamiento en web/config.js); sin esa
  // tabla, se destaca el comparador. Otras secciones añaden las suyas con
  // window.MAPAFISCAL_HERRAMIENTAS = { clave: { titulo, texto, href, icono } }.
  function herramientas() {
    return Object.assign({
      calculadora: { titulo: "Calculadora de la renta", texto: `¿A pagar o a devolver? Tu IRPF ${P.ejercicio} con tu situación real, al detalle y con las casillas de Renta Web.`, href: "#calculadora", icono: "calculadora" },
      comparar: { titulo: "Comparador de territorios", texto: "¿Cuánto ahorrarías en otra comunidad? Tu misma situación en los 19 territorios fiscales, en mapa y en ranking.", href: "#comparar", icono: "mapa" },
      clientes: { titulo: "Mis clientes", texto: "Para asesores y gestorías: tu cartera de clientes guardada y siempre recalculada.", href: "#clientes", icono: "cartera", plan: true }
    }, window.MAPAFISCAL_HERRAMIENTAS || {});
  }

  const mc = { salario: $("mc-salario"), terr: $("mc-territorio") };
  mc.terr.innerHTML = selTerr.innerHTML;
  mc.terr.value = selTerr.value;
  let mcCache = {};
  const hogarRapido = (territorio, salario) => ({
    territorio, ejercicio: P.ejercicio, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no",
    miembros: [{ id: "d1", rol: "declarante", edad: 40, discapacidad: "no",
      trabajo: salario > 0 ? { dinerarias: salario, cotizacionesSs: Math.round(salario * TASA_SS) } : null }]
  });
  function pintarMiniCalc() {
    const salario = Math.max(0, Math.min(1e7, parseFloat(mc.salario.value) || 0)), terr = mc.terr.value;
    let cmp;
    try { cmp = irpfsim.compararTerritorios(hogarRapido(terr, salario), P); } catch (e) { $("mc-res").innerHTML = '<p class="vacio">Revisa el sueldo.</p>'; return; }
    const val = c => c.cuotaResultanteAutoliquidacion;
    const porT = Object.fromEntries(cmp.map(c => [c.territorio, c]));
    mcCache = porT;
    const yo = porT[terr], orden = cmp.slice().sort((a, b) => val(a) - val(b));
    const barato = orden[0], caro = orden[orden.length - 1], pos = puesto(cmp, val, yo, 0.5);
    const empatados = c => orden.filter(x => Math.abs(val(x) - val(c)) < 0.5).map(x => corto(x.territorio));
    const clase = rampa(cmp.map(c => val(c) - val(yo)), 0.5);
    const sinIrpf = val(caro) < 0.5;

    // regla con los 19 territorios, de más barato a más caro
    const alto = c => sinIrpf ? 20 : Math.round(25 + 75 * (val(c) - val(barato)) / ((val(caro) - val(barato)) || 1));
    const regla = sinIrpf ? "" : `<div class="regla" aria-hidden="true"><div class="regla-pista">${orden.map(c => {
      const d = val(c) - val(yo), k = c.territorio === terr ? "tu" : d < -0.5 ? "g" : d > 0.5 ? "r" : "";
      return `<i class="${k}" style="height:${alto(c)}%" title="${esc(corto(c.territorio))}: ${eur0(val(c))}"></i>`;
    }).join("")}</div><div class="regla-extremos"><span>Más barato: <b>${esc(nombres(empatados(barato)))}</b></span><span>Más caro: <b>${esc(nombres(empatados(caro)))}</b></span></div></div>`;
    let frase;
    if (sinIrpf) frase = "Con este sueldo no pagarías IRPF en ningún territorio.";
    else if (pos === 1) frase = `<b>${esc(corto(terr))}</b> es el territorio más barato para este sueldo: en ${esc(corto(caro.territorio))} pagarías <b>${eur0(val(caro) - val(yo))} más</b>.`;
    else frase = `${esc(corto(terr))} es el <b>${ordinal(pos)}</b> más barato de 19. En ${esc(corto(barato.territorio))} pagarías <b>${eur0(val(yo) - val(barato))} menos</b>${val(caro) - val(yo) >= 0.5 ? `; en ${esc(corto(caro.territorio))}, ${eur0(val(caro) - val(yo))} más` : ""}.`;
    $("mc-res").innerHTML = `<div class="minicalc-cifra"><span class="cifra-xl">${eur0(val(yo))}</span><span class="etq-cifra">de IRPF al año · tipo medio ${pct(yo.tipoMedioEfectivo)}</span></div>
      ${regla}<p class="minicalc-frase">${frase}</p>
      <div class="minicalc-acciones"><a class="btn btn-pri" href="#calculadora" data-mc-ir>Calcular mi declaración <span class="flecha" aria-hidden="true">→</span></a>
        <a class="btn btn-txt" href="#comparar" data-mc-ir>Ver los 19 territorios</a></div>
      <p class="minicalc-supuesto">Estimación del ejercicio ${P.ejercicio} para una persona de 40 años sin hijos, con cotizaciones del ${pct(TASA_SS).replace(",00", "")}. En la calculadora puedes añadir tu familia, tus gastos y tus retenciones.</p>`;

    dibujarMapa($("mapa-portada"), porT, terr, c => clase(val(c) - val(yo)), (t, c) => `${T[t].nombre}: ${eur0(val(c))}`, "Mapa del IRPF por territorio fiscal");
    $("leyenda-portada").innerHTML = leyendaMapa();
    $("dato-portada").innerHTML = sinIrpf ? "" : `Con <b>${eur0(salario)}</b> brutos al año, entre ${esc(corto(barato.territorio))} y ${esc(corto(caro.territorio))} hay
      <span class="cifra-dato">${eur0(val(caro) - val(barato))}</span> de IRPF de diferencia cada año. Misma persona y misma nómina: solo cambia dónde vive.`;
    $("dato-portada").hidden = sinIrpf;
  }
  mc.salario.addEventListener("input", pintarMiniCalc);
  mc.terr.addEventListener("change", pintarMiniCalc);
  $("minicalc").addEventListener("submit", e => e.preventDefault());
  const elegirEnPortada = t => { if (t && T[t]) { mc.terr.value = t; pintarMiniCalc(); } };
  $("mapa-portada").addEventListener("click", e => { const p = e.target.closest(".terr"); if (p) elegirEnPortada(p.dataset.t); });
  $("mapa-portada").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.dataset.t) { e.preventDefault(); elegirEnPortada(e.target.dataset.t); const p = $("mapa-portada").querySelector(`[data-t="${e.target.dataset.t}"]`); if (p) p.focus(); } });
  tooltipMapa($("mapa-portada"), $("mapa-portada-tip"), t => mcCache[t] ? textoTip(t, mcCache[t], mcCache[mc.terr.value].cuotaResultanteAutoliquidacion, mc.terr.value) : null);
  // «Calcular mi declaración»: la calculadora empieza con el sueldo y el territorio de la portada
  $("mc-res").addEventListener("click", e => {
    if (!e.target.closest("[data-mc-ir]")) return;
    $("f-salario").value = Math.max(0, parseFloat(mc.salario.value) || 0);
    if (!ssManual) $("f-ss").value = $("f-pension").checked ? 0 : Math.round(num("f-salario") * TASA_SS);
    selTerr.value = mc.terr.value;
    pintarHijos(); pintarGastosTerritorio(); recalcular();
  });

  function pintarInicio() {
    const H = herramientas();
    const dest = (CFG.destacados && CFG.destacados[new Date().getMonth()]) || "comparar";
    const claves = Object.keys(H).sort((a, b) => (b === dest) - (a === dest));
    $("herramientas").innerHTML = claves.map(k => { const h = H[k]; return `
      <a class="herramienta" href="${esc(h.href)}"><span class="herramienta-ico">${icono(h.icono)}</span>
        <h3>${esc(h.titulo)}${h.plan ? '<span class="plan-chip">Gestor</span>' : ""}${k === dest ? '<span class="chip tu">Te puede interesar</span>' : ""}</h3><p>${esc(h.texto)}</p></a>`; }).join("");
    // franja de rigor: cifras sacadas de los propios parámetros, nada inventado
    const terrs = Object.values(T), comun = terrs.filter(t => t.regimen === "comun").length;
    const nDed = terrs.reduce((s, t) => s + (((t.deducciones_autonomicas && t.deducciones_autonomicas.lista) || []).length), 0);
    $("rigor").innerHTML = `
      <div><span class="cifra-xl">${terrs.length}</span><span>territorios fiscales: ${comun} comunidades de régimen común, las tres diputaciones vascas y Navarra</span></div>
      <div><span class="cifra-xl">${nDed}</span><span>deducciones autonómicas y forales modeladas, cada una con la norma de la que sale</span></div>
      <div><span class="cifra-xl">0,00 €</span><span>de diferencia entre el motor de la web y su versión de referencia en todos los casos de validación</span></div>
      <div><span class="cifra-xl">0</span><span>datos enviados: el cálculo se hace en tu navegador, sin registro</span></div>`;
    pintarMiniCalc();
  }

  // ---- cambio de ejercicio: todo lo que depende de los parámetros -------------------------
  function aplicarEjercicio() {
    document.querySelectorAll("[data-ejercicio]").forEach(el => { el.textContent = P.ejercicio; });
    document.querySelectorAll("[data-ejercicios]").forEach(el => { el.textContent = textoEjercicios(); });
    pideFnReciente = algunaDeduccion(d => d.requiere_familia_numerosa_reciente);
    pideTituloMonoparental = algunaDeduccion(d => d.requiere_titulo_monoparental != null);
    pintarFnReciente(); pintarHijos(); pintarGastosTerritorio(); recalcular();
    const v = vistaActual();
    if (v === "inicio") pintarInicio();
    if (v === "metodologia") pintarCobertura();
    if (v === "planes") pintarPlanes();
    document.title = tituloVista(v);
    document.dispatchEvent(new CustomEvent("mapafiscal:ejercicio", { detail: { ejercicio: P.ejercicio, P } }));
  }

  // ---- navegación -------------------------------------------------------------------------
  // Las vistas son las <section class="vista" id="v-…"> de index.html: una sección nueva
  // (p. ej. de herramientas.js) navega sola por #<nombre>. Al mostrar una vista se dispara
  // «mapafiscal:vista» con { vista } para que su código la pinte.
  const VISTAS = [...document.querySelectorAll("main section.vista[id^='v-']")].map(s => s.id.slice(2));
  const TITULOS_VISTA = {
    inicio: () => "Mapafiscal: tu IRPF en los 19 territorios fiscales",
    calculadora: () => `Calculadora del IRPF ${P.ejercicio} | Mapafiscal`,
    comparar: () => "Comparar territorios | Mapafiscal",
    clientes: () => "Mis clientes | Mapafiscal",
    planes: () => "Planes | Mapafiscal",
    perfil: () => "Perfil | Mapafiscal",
    metodologia: () => "Metodología y cobertura | Mapafiscal"
  };
  function tituloVista(v) {
    if (TITULOS_VISTA[v]) return TITULOS_VISTA[v]();
    const h = $("v-" + v) && $("v-" + v).querySelector("h1");
    return h ? h.textContent.trim() + " | Mapafiscal" : "Mapafiscal";
  }
  let vistaSel = null;           // vista elegida en esta sesión (no depende de poder tocar el hash)
  function vistaDeHash() {
    const h = location.hash.slice(1).split("?")[0];
    if (h === "gestor") return "clientes";
    return VISTAS.includes(h) ? h : null;
  }
  function vistaActual() { return vistaSel || vistaDeHash() || "inicio"; }
  function irA(v) {
    vistaSel = v;
    try { history.replaceState(null, "", "#" + v); } catch (e) { /* entorno sin historial (vista previa) */ }
    mostrarVista({ moverFoco: true });
  }
  // enlaces internos (#vista): cambian de vista sin navegar
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const v = a.getAttribute("href").slice(1).split("?")[0];
    if (VISTAS.includes(v)) { e.preventDefault(); irA(v); }
  });
  function mostrarVista({ moverFoco = false } = {}) {
    const v = vistaActual();
    document.title = tituloVista(v);
    for (const x of VISTAS) $("v-" + x).hidden = x !== v;
    $("barra-movil").hidden = v !== "calculadora";
    document.body.classList.toggle("en-calculadora", v === "calculadora");
    document.querySelectorAll(".nav a").forEach(a => a.toggleAttribute("aria-current", a.dataset.vista === v));
    document.querySelectorAll(".nav a[aria-current]").forEach(a => a.setAttribute("aria-current", "page"));
    if (v === "inicio") pintarInicio();
    if (v === "comparar") pintarComparacion();
    if (v === "clientes") pintarClientes();
    if (v === "planes") pintarPlanes();
    if (v === "perfil") pintarPerfil();
    if (v === "metodologia") pintarCobertura();
    document.dispatchEvent(new CustomEvent("mapafiscal:vista", { detail: { vista: v } }));   // herramientas.js
    window.scrollTo(0, 0);
    // el foco va al título de la vista, para que el lector de pantalla anuncie el cambio
    if (moverFoco) {
      const titulo = $("v-" + v).querySelector("h1");
      if (titulo) { titulo.setAttribute("tabindex", "-1"); titulo.focus({ preventScroll: true }); }
    }
    document.dispatchEvent(new CustomEvent("mapafiscal:vista", { detail: { vista: v } }));
  }
  window.addEventListener("hashchange", () => { const v = vistaDeHash(); if (v) { vistaSel = v; mostrarVista({ moverFoco: true }); } });
  $("bm-ver").addEventListener("click", e => { e.preventDefault(); $("t-res").scrollIntoView({ behavior: movimientoReducido() ? "auto" : "smooth", block: "start" }); });

  // ---- arranque --------------------------------------------------------------------------
  // cotizaciones estimadas con la orden de cotización del ejercicio (no con un tipo fijo)
  $("f-ss").value = Math.round(irpfsim.cotizacionesTrabajador(num("f-salario"), P));
  $("ayuda-ss").textContent = `Estimadas con los tipos del trabajador de ${P.ejercicio} (contrato indefinido). Cámbialas si las conoces: vienen en tu certificado de retenciones.`;
  document.addEventListener("mapafiscal:herramientas", () => { if (vistaActual() === "inicio") pintarInicio(); });
  document.querySelectorAll("[data-ejercicio]").forEach(el => { el.textContent = P.ejercicio; });
  document.querySelectorAll("[data-ejercicios]").forEach(el => { el.textContent = textoEjercicios(); });
  pintarSelectoresEjercicio(false);
  pintarHijos(); pintarGastosTerritorio(); recalcular(); marcarPestanaClientes(); mostrarVista({ moverFoco: Boolean(vistaDeHash()) });
  if (ejercicioUrl && ejercicioUrl !== P.ejercicio) cambiarEjercicio(ejercicioUrl);
  if (avisoPago) esperarPlan(15); else cargarSesion();
  if (errorVuelta) abrirAcceso(null, null, "entrar", errorVuelta.texto);
})();
