/* =============================================================================
 * Mapafiscal — formulario de la calculadora (vista #calculadora).
 *
 * Todo lo que la persona rellena vive en un «estado» plano y serializable:
 *   estadoInicial()            estado por defecto
 *   hogarDesdeEstado(e, ctx)   estado -> hogar en la forma que consume irpfsim.js
 *   estadoDesdeHogar(h)        hogar guardado («Mis clientes») -> estado (admite hogares antiguos)
 *   avisos(e, ctx)             validaciones amables (negativos, importes raros, fechas)
 *   camposTerritorio(t, P)     gastos con deducción autonómica que pide cada territorio
 *   montar(opciones)           pinta el formulario en el navegador y lo mantiene al día
 * Las funciones puras se prueban en Node (test/formulario.test.mjs). app.js usa montar() y
 * hogarDesdeEstado() desde construirHogar() y rellenarFormulario().
 * ========================================================================== */
(function () {
  "use strict";

  // ---- utilidades -----------------------------------------------------------
  const n = v => { const x = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(x) ? x : 0; };
  const pos = v => Math.max(0, n(v));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const camel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const snake = s => s.replace(/[A-Z]/g, c => "_" + c.toLowerCase());
  const red2 = x => Math.round(x * 100) / 100;

  // ---- estado ---------------------------------------------------------------
  function personaInicial(salario) {
    return {
      edad: 34, discapacidad: "no", movilidadReducida: false, ayudaTerceros: false,
      desempleado: false, mesesDesempleo: 12,
      // trabajo o pensión
      salario: salario || 0, pension: false, ss: 0, ssManual: false, otrosPagadores: 0, especie: 0,
      otrosGastos: 0, movilidad: false, activoDiscapacidad: false, irregularImporte: 0, irregularAnios: 0,
      retenciones: 0,
      // capital mobiliario
      intereses: 0, dividendos: 0, seguros: 0,
      // capital inmobiliario e imputación
      inmuebles: [], catastralRevisado: 0, catastralOtro: 0,
      // actividad económica
      actMetodo: "no", actIngresos: 0, actGastos: 0, actModulos: 0, actInicio: false,
      // ganancias y pérdidas
      ventas: [], premios: 0,
      // reducciones
      planIndividual: 0, planEmpresa: 0, compensatoria: 0, alimentos: 0,
      // vivienda y donativos
      alquiler: 0, hipoteca: 0, compra: 0, colectivoEspecial: false, donativos: 0, donativosRec: false
    };
  }
  function estadoInicial() {
    return {
      territorio: "ES-MD", municipio: "", despoblada: false,
      pareja: "no", ver: "d1",
      personas: { d1: personaInicial(32000), d2: personaInicial(0) },
      hijos: [], ascendientes: [],
      familiaNumerosa: "no", fnReciente: false, tituloMonoparental: "no", partoMultiple: false,
      gastos: {}
    };
  }
  const inmuebleInicial = () => ({ ingresos: 0, financieros: 0, gastos: 0, amortizacion: 0, tipo: "general" });
  const ventaInicial = ej => ({ tipo: "accion_cotizada", adquisicion: 0, transmision: 0, fechaAdq: "", fechaTrans: (ej || 2025) + "-06-30", exenta: false });
  const hijoInicial = () => ({ edad: 5, discapacidad: "no", compartida: false, rentas: 0, gastos: {} });
  const ascendienteInicial = () => ({ edad: 78, discapacidad: "no", rentas: 0 });

  // cotizaciones del trabajador: las estimadas salvo que la persona escriba las suyas
  function cotizaciones(p, ctx) {
    if (p.ssManual) return pos(p.ss);
    if (p.pension) return 0;
    return ctx && ctx.cotizar ? Math.round(ctx.cotizar(pos(p.salario))) : 0;
  }

  // ---- estado -> hogar ------------------------------------------------------
  function miembroDeclarante(id, rol, p, ctx) {
    const ej = (ctx && ctx.ejercicio) || 2025;
    const disc = ["33_64", "65_mas"].includes(p.discapacidad) ? p.discapacidad : "no";
    const m = { id, rol, edad: pos(p.edad) || 40, discapacidad: disc };
    if (disc !== "no" && p.movilidadReducida) m.movilidadReducida = true;
    if (disc !== "no" && p.ayudaTerceros) m.ayudaTerceros = true;
    m.desempleado = !!p.desempleado;
    if (p.desempleado) m.mesesDesempleo = Math.max(1, Math.min(12, Math.round(n(p.mesesDesempleo)) || 12));

    const salario = pos(p.salario), especie = pos(p.especie);
    m.trabajo = null;
    if (salario > 0 || especie > 0) {
      const t = { dinerarias: salario, cotizacionesSs: cotizaciones(p, ctx), pensionJubilacion: !!p.pension,
        otrosPagadores: Math.min(pos(p.otrosPagadores), salario) };
      if (especie) t.especie = especie;
      if (pos(p.otrosGastos)) t.otrosGastos = pos(p.otrosGastos);
      if (p.movilidad) t.movilidadGeografica = true;
      if (disc !== "no" && p.activoDiscapacidad) t.trabajadorActivoDiscapacidad = true;
      if (pos(p.irregularImporte) > 0) t.rendimientoIrregular = { importe: pos(p.irregularImporte), anios: pos(p.irregularAnios) };
      m.trabajo = t;
    }
    const cm = { intereses: pos(p.intereses), dividendos: pos(p.dividendos), seguros: pos(p.seguros) };
    m.capitalMobiliario = cm.intereses || cm.dividendos || cm.seguros ? cm : null;

    const inms = (p.inmuebles || []).filter(i => pos(i.ingresos) || pos(i.financieros) || pos(i.gastos) || pos(i.amortizacion)).map(i => {
      const viv = i.tipo && i.tipo !== "no_vivienda";
      const x = { ingresos: pos(i.ingresos), gastosFinancieros: pos(i.financieros),
        gastosDeducibles: red2(pos(i.gastos) + pos(i.amortizacion)), arrendamientoVivienda: !!viv,
        otrosGastos: pos(i.gastos), amortizacion: pos(i.amortizacion) };   // desglose para volver a rellenar
      if (viv) x.tipoArrendamiento = i.tipo;
      return x;
    });
    m.capitalInmobiliario = inms.length ? inms : null;
    const imp = [];
    if (pos(p.catastralRevisado)) imp.push({ valorCatastral: pos(p.catastralRevisado), revisado10Anios: true });
    if (pos(p.catastralOtro)) imp.push({ valorCatastral: pos(p.catastralOtro), revisado10Anios: false });
    if (imp.length) m.imputacionInmobiliaria = imp;

    m.actividades = null;
    if (p.actMetodo === "objetiva") m.actividades = { metodo: "objetiva", rendimientoNetoModulos: n(p.actModulos) };
    else if (p.actMetodo === "directa_simplificada" || p.actMetodo === "directa_normal") {
      m.actividades = { metodo: p.actMetodo, rendimientoNetoPrevio: red2(pos(p.actIngresos) - pos(p.actGastos)),
        ingresos: pos(p.actIngresos), gastos: pos(p.actGastos) };
      if (p.actInicio) m.actividades.inicioActividad = true;
    }

    m.ganancias = (p.ventas || []).filter(v => pos(v.transmision) || pos(v.adquisicion)).map(v => {
      const g = { valorTransmision: pos(v.transmision), valorAdquisicion: pos(v.adquisicion),
        fechaAdquisicion: v.fechaAdq || "2020-01-15", fechaTransmision: v.fechaTrans || ej + "-06-30",
        tipoElemento: v.tipo || "accion_cotizada", esTransmision: true };
      if (v.exenta) g.exenta = true;
      return g;
    });
    if (pos(p.premios)) m.gananciasPerdidasNoTransmision = pos(p.premios);

    m.previsionSocial = pos(p.planIndividual) || pos(p.planEmpresa)
      ? Object.assign({ aportacionIndividual: pos(p.planIndividual) }, pos(p.planEmpresa) ? { contribucionEmpresarial: pos(p.planEmpresa) } : {}) : null;
    if (pos(p.compensatoria) || pos(p.alimentos))
      m.reducciones = { pensionesCompensatorias: pos(p.compensatoria), anualidadesAlimentosHijos: pos(p.alimentos) };

    m.alquilerViviendaPagos = pos(p.alquiler);
    m.adquisicionViviendaPagos = pos(p.compra);
    m.viviendaTransitoriaPagos = pos(p.hipoteca);
    if (p.colectivoEspecial) m.colectivoEspecialVivienda = true;
    m.donativos = pos(p.donativos);
    m.donativosRecurrentes = !!p.donativosRec;
    m.retenciones = pos(p.retenciones);
    return m;
  }

  function hogarDesdeEstado(e, ctx) {
    ctx = ctx || {};
    const ej = ctx.ejercicio || 2025;
    const pareja = e.pareja === "si";
    const d1 = miembroDeclarante("d1", "declarante", e.personas.d1, ctx);
    for (const [c, v] of Object.entries(e.gastos || {})) if (pos(v) > 0) d1[camel(c)] = pos(v);
    const miembros = [d1];
    if (pareja) miembros.push(miembroDeclarante("d2", "conyuge", e.personas.d2, ctx));
    const hijos = e.hijos || [];
    hijos.forEach((h, i) => {
      const edad = Math.max(0, Math.min(40, Math.round(n(h.edad))));
      const m = { id: "h" + (i + 1), rol: "descendiente", edad, rentasPropias: pos(h.rentas), nacidoEnEjercicio: edad === 0 };
      if (["33_64", "65_mas"].includes(h.discapacidad)) m.discapacidad = h.discapacidad;
      if (h.compartida) m.convivenciaMeses = 0;      // custodia compartida: el mínimo se reparte (factor 0,5)
      for (const [c, v] of Object.entries(h.gastos || {})) if (pos(v) > 0) m[camel(c)] = pos(v);
      miembros.push(m);
    });
    (e.ascendientes || []).forEach((a, i) => {
      const m = { id: "a" + (i + 1), rol: "ascendiente", edad: Math.round(pos(a.edad)), rentasPropias: pos(a.rentas) };
      if (["33_64", "65_mas"].includes(a.discapacidad)) m.discapacidad = a.discapacidad;
      miembros.push(m);
    });
    const hab = parseInt(e.municipio, 10);
    const fn = ["general", "especial"].includes(e.familiaNumerosa) ? e.familiaNumerosa : "no";
    const h = {
      territorio: e.territorio, ejercicio: ej,
      tipoUnidadFamiliar: pareja ? "biparental" : (hijos.length ? "monoparental" : "ninguna"),
      familiaNumerosa: fn,
      familiaNumerosaReciente: fn !== "no" && !!e.fnReciente,
      municipioHabitantes: Number.isFinite(hab) && hab > 0 ? hab : null,
      zonaDespoblada: !!e.despoblada,
      tituloMonoparental: hijos.length && ["general", "especial"].includes(e.tituloMonoparental) ? e.tituloMonoparental : "no",
      miembros
    };
    if (e.partoMultiple && hijos.filter(x => Math.round(n(x.edad)) === 0).length >= 2) h.partoMultiple = true;
    return h;
  }

  // ---- hogar -> estado (también hogares guardados con el formulario antiguo) -------------
  const CONOCIDOS = new Set(["id", "rol", "edad", "discapacidad", "movilidadReducida", "ayudaTerceros", "desempleado", "mesesDesempleo",
    "trabajo", "capitalMobiliario", "capitalInmobiliario", "imputacionInmobiliaria", "actividades", "ganancias",
    "gananciasPerdidasNoTransmision", "previsionSocial", "reducciones", "alquilerViviendaPagos", "adquisicionViviendaPagos",
    "viviendaTransitoriaPagos", "colectivoEspecialVivienda", "donativos", "donativosRecurrentes", "retenciones",
    "rentasPropias", "nacidoEnEjercicio", "convivenciaMeses"]);
  function personaDesdeMiembro(m) {
    const p = personaInicial(0);
    if (!m) return p;
    const t = m.trabajo || {}, cm = m.capitalMobiliario || {}, ac = m.actividades, ps = m.previsionSocial || {}, rd = m.reducciones || {};
    Object.assign(p, {
      edad: m.edad != null ? m.edad : 40, discapacidad: m.discapacidad || "no",
      movilidadReducida: !!m.movilidadReducida, ayudaTerceros: !!m.ayudaTerceros,
      desempleado: !!m.desempleado, mesesDesempleo: m.mesesDesempleo || 12,
      salario: n(t.dinerarias), pension: !!t.pensionJubilacion, ss: n(t.cotizacionesSs), ssManual: !!m.trabajo,
      otrosPagadores: n(t.otrosPagadores), especie: n(t.especie), otrosGastos: n(t.otrosGastos),
      movilidad: !!t.movilidadGeografica, activoDiscapacidad: !!t.trabajadorActivoDiscapacidad,
      irregularImporte: n(t.rendimientoIrregular && t.rendimientoIrregular.importe),
      irregularAnios: n(t.rendimientoIrregular && t.rendimientoIrregular.anios),
      retenciones: n(m.retenciones),
      intereses: n(cm.intereses), dividendos: n(cm.dividendos), seguros: n(cm.seguros),
      premios: n(m.gananciasPerdidasNoTransmision),
      planIndividual: n(ps.aportacionIndividual), planEmpresa: n(ps.contribucionEmpresarial),
      compensatoria: n(rd.pensionesCompensatorias), alimentos: n(rd.anualidadesAlimentosHijos),
      alquiler: n(m.alquilerViviendaPagos), hipoteca: n(m.viviendaTransitoriaPagos), compra: n(m.adquisicionViviendaPagos),
      colectivoEspecial: !!m.colectivoEspecialVivienda, donativos: n(m.donativos), donativosRec: !!m.donativosRecurrentes
    });
    p.inmuebles = (m.capitalInmobiliario || []).map(i => {
      const amort = n(i.amortizacion);
      return { ingresos: n(i.ingresos), financieros: n(i.gastosFinancieros),
        gastos: i.otrosGastos != null ? n(i.otrosGastos) : red2(n(i.gastosDeducibles) - amort), amortizacion: amort,
        tipo: i.arrendamientoVivienda ? (i.tipoArrendamiento || "general") : "no_vivienda" };
    });
    const imp = m.imputacionInmobiliaria ? [].concat(m.imputacionInmobiliaria) : [];
    for (const x of imp) {
      if (x.revisado10Anios) p.catastralRevisado += n(x.valorCatastral); else p.catastralOtro += n(x.valorCatastral);
    }
    if (ac) {
      p.actMetodo = ac.metodo === "objetiva" ? "objetiva" : ac.metodo === "directa_normal" ? "directa_normal" : "directa_simplificada";
      if (p.actMetodo === "objetiva") p.actModulos = n(ac.rendimientoNetoModulos);
      else if (ac.ingresos != null) { p.actIngresos = n(ac.ingresos); p.actGastos = n(ac.gastos); }
      else { p.actIngresos = n(ac.rendimientoNetoPrevio); p.actGastos = 0; }
      p.actInicio = !!ac.inicioActividad;
    }
    p.ventas = (m.ganancias || []).filter(g => g.esTransmision !== false).map(g => ({
      tipo: g.tipoElemento || "accion_cotizada", adquisicion: n(g.valorAdquisicion), transmision: n(g.valorTransmision),
      fechaAdq: g.fechaAdquisicion || "", fechaTrans: g.fechaTransmision || "", exenta: !!g.exenta }));
    return p;
  }
  function gastosLibres(m) {
    const g = {};
    for (const [k, v] of Object.entries(m || {})) if (!CONOCIDOS.has(k) && typeof v === "number") g[snake(k)] = v;
    return g;
  }
  function estadoDesdeHogar(h) {
    const e = estadoInicial();
    const ms = h.miembros || [];
    const d1 = ms.find(m => m.rol === "declarante"), d2 = ms.find(m => m.rol === "conyuge");
    e.territorio = h.territorio || e.territorio;
    e.municipio = h.municipioHabitantes != null ? String(h.municipioHabitantes) : "";
    e.despoblada = !!h.zonaDespoblada;
    e.pareja = d2 ? "si" : "no";
    e.personas.d1 = personaDesdeMiembro(d1);
    e.personas.d2 = d2 ? personaDesdeMiembro(d2) : personaInicial(0);
    e.gastos = gastosLibres(d1);
    e.hijos = ms.filter(m => m.rol === "descendiente").map(m => ({ edad: n(m.edad), discapacidad: m.discapacidad || "no",
      compartida: m.convivenciaMeses != null && n(m.convivenciaMeses) < 6, rentas: n(m.rentasPropias), gastos: gastosLibres(m) }));
    e.ascendientes = ms.filter(m => m.rol === "ascendiente").map(m => ({ edad: n(m.edad), discapacidad: m.discapacidad || "no", rentas: n(m.rentasPropias) }));
    e.familiaNumerosa = h.familiaNumerosa || "no";
    e.fnReciente = !!h.familiaNumerosaReciente;
    e.tituloMonoparental = h.tituloMonoparental || "no";
    e.partoMultiple = !!h.partoMultiple;
    return e;
  }

  // ---- lecturas del hogar para el resultado ------------------------------------------------
  const declarantes = h => h.miembros.filter(m => m.rol === "declarante" || m.rol === "conyuge");
  function retencionesHogar(h) { return red2(declarantes(h).reduce((s, m) => s + n(m.retenciones), 0)); }
  // ingresos del hogar para la barra de reparto: brutos del trabajo y del ahorro, netos de
  // alquileres y actividades (lo que queda tras sus gastos) y ganancias positivas
  function ingresosBrutos(h) {
    let s = 0;
    for (const m of declarantes(h)) {
      if (m.trabajo) s += n(m.trabajo.dinerarias) + n(m.trabajo.especie);
      if (m.capitalMobiliario) s += n(m.capitalMobiliario.intereses) + n(m.capitalMobiliario.dividendos) + n(m.capitalMobiliario.seguros);
      for (const i of m.capitalInmobiliario || []) s += Math.max(0, n(i.ingresos) - n(i.gastosFinancieros) - n(i.gastosDeducibles));
      if (m.actividades) s += Math.max(0, m.actividades.metodo === "objetiva" ? n(m.actividades.rendimientoNetoModulos) : n(m.actividades.rendimientoNetoPrevio));
      for (const g of m.ganancias || []) if (!g.exenta) s += Math.max(0, n(g.valorTransmision) - n(g.valorAdquisicion));
      s += Math.max(0, n(m.gananciasPerdidasNoTransmision));
    }
    return red2(s);
  }

  // ---- validaciones amables ----------------------------------------------------------------
  // devuelve [{ k: ruta del campo o null, texto }]; los negativos ya se toman como 0
  function avisos(e, ctx) {
    ctx = ctx || {};
    const ej = ctx.ejercicio || 2025, out = [];
    const quien = id => e.pareja === "si" ? (id === "d1" ? "Tú: " : "Tu pareja: ") : "";
    const ids = e.pareja === "si" ? ["d1", "d2"] : ["d1"];
    const negativo = (obj, ruta) => {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "number" && v < 0 && !["actModulos"].includes(k)) out.push({ k: ruta + k, texto: "No se admiten importes negativos: se toma 0." });
      }
    };
    for (const id of ids) {
      const p = e.personas[id], r = `personas.${id}.`, q = quien(id);
      negativo(p, r);
      const sal = pos(p.salario), ss = cotizaciones(p, ctx);
      if (pos(p.edad) && (p.edad < 16 || p.edad > 110)) out.push({ k: r + "edad", texto: q + "revisa la edad." });
      if (sal > 0 && ss > sal * 0.1 + 100) out.push({ k: r + "ss", texto: q + "las cotizaciones superan el 10 % del bruto; lo normal es en torno al 6,5 %." });
      if (sal > 0 && sal < 1000) out.push({ k: r + "salario", texto: q + "el salario es el bruto de todo el año, no el de un mes." });
      if (pos(p.otrosPagadores) > sal) out.push({ k: r + "otrosPagadores", texto: q + "lo cobrado de otros pagadores no puede superar el total del salario." });
      const ingresos = sal + pos(p.especie) + pos(p.intereses) + pos(p.dividendos) + pos(p.seguros) + pos(p.actIngresos) +
        (p.inmuebles || []).reduce((s, i) => s + pos(i.ingresos), 0);
      if (pos(p.retenciones) > 0 && pos(p.retenciones) > ingresos * 0.5) out.push({ k: r + "retenciones", texto: q + "las retenciones superan la mitad de los ingresos: revisa el importe." });
      if (pos(p.planIndividual) > 1500 && !pos(p.planEmpresa)) out.push({ k: r + "planIndividual", texto: q + "solo reducen la base 1.500 € de aportación propia (más si tu empresa aporta)." });
      if (pos(p.otrosGastos) > 2000) out.push({ k: r + "otrosGastos", texto: q + "estos gastos (cuotas sindicales, colegio profesional, defensa jurídica) suelen ser pequeños; los 2.000 € generales ya se aplican solos." });
      (p.inmuebles || []).forEach((i, j) => {
        negativo(i, `${r}inmuebles.${j}.`);
        if (pos(i.financieros) > pos(i.ingresos)) out.push({ k: `${r}inmuebles.${j}.financieros`, texto: `${q}inmueble ${j + 1}: los intereses y la reparación solo se deducen hasta los ingresos; el exceso, en los cuatro años siguientes.` });
      });
      (p.ventas || []).forEach((v, j) => {
        negativo(v, `${r}ventas.${j}.`);
        if (v.fechaTrans && !String(v.fechaTrans).startsWith(String(ej))) out.push({ k: `${r}ventas.${j}.fechaTrans`, texto: `${q}venta ${j + 1}: la fecha de venta debería ser de ${ej}.` });
        if (v.fechaAdq && v.fechaTrans && v.fechaAdq > v.fechaTrans) out.push({ k: `${r}ventas.${j}.fechaAdq`, texto: `${q}venta ${j + 1}: la compra es posterior a la venta.` });
        if ((pos(v.transmision) || pos(v.adquisicion)) && !v.fechaAdq) out.push({ k: `${r}ventas.${j}.fechaAdq`, texto: `${q}venta ${j + 1}: indica la fecha de compra (cuenta si es anterior a 1995).` });
      });
    }
    (e.hijos || []).forEach((h, j) => {
      negativo(h, `hijos.${j}.`);
      if (n(h.edad) >= 25 && (h.discapacidad || "no") === "no") out.push({ k: `hijos.${j}.edad`, texto: `Hijo ${j + 1}: con 25 años o más solo da derecho al mínimo si tiene discapacidad.` });
      if (pos(h.rentas) > 8000) out.push({ k: `hijos.${j}.rentas`, texto: `Hijo ${j + 1}: con más de 8.000 € de rentas propias no da derecho al mínimo por descendientes.` });
    });
    (e.ascendientes || []).forEach((a, j) => {
      negativo(a, `ascendientes.${j}.`);
      if (n(a.edad) < 65 && (a.discapacidad || "no") === "no") out.push({ k: `ascendientes.${j}.edad`, texto: `Ascendiente ${j + 1}: con menos de 65 años solo cuenta si tiene discapacidad.` });
      if (pos(a.rentas) > 8000) out.push({ k: `ascendientes.${j}.rentas`, texto: `Ascendiente ${j + 1}: con más de 8.000 € de rentas propias no da derecho al mínimo.` });
    });
    if (e.familiaNumerosa !== "no" && (e.hijos || []).length < 2) out.push({ k: "familiaNumerosa", texto: "La familia numerosa suele tener al menos dos o tres hijos: añádelos en la lista." });
    return out;
  }

  // ---- gastos con deducción autonómica que pide cada territorio ------------------------------
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

  // { hogar: [campo], hijo: [[campo, edadMax]] }. El alquiler de la vivienda habitual tiene
  // su propio campo. En régimen común, con hijos de menos de 3 años, la guardería cuenta
  // además para el incremento de la deducción por maternidad (art. 81.2 LIRPF).
  function camposTerritorio(terr, opciones) {
    const lista = (terr && terr.deducciones_autonomicas && terr.deducciones_autonomicas.lista) || [];
    const hogar = new Map(), hijo = new Map();
    for (const d of lista) {
      if (d.tipo === "porcentaje_campos_hijo") {
        const max = d.edad_hijo_max != null ? d.edad_hijo_max : 25;
        for (const c of Object.keys(d.campos || {})) { const prev = hijo.get(c); hijo.set(c, prev == null ? max : Math.max(prev, max)); }
        continue;
      }
      if (!d.campo || d.campo === "alquiler_vivienda_pagos") continue;
      if (d.tipo === "porcentaje_campo_hijo") {
        const prev = hijo.get(d.campo), max = d.edad_hijo_max != null ? d.edad_hijo_max : 25;
        hijo.set(d.campo, prev == null ? max : Math.max(prev, max));
      } else if (d.tipo === "porcentaje_campo") hogar.set(d.campo, true);
    }
    if (opciones && opciones.menor3 && terr && terr.regimen === "comun" && !hogar.has("gastos_guarderia") && !hijo.has("gastos_guarderia"))
      hogar.set("gastos_guarderia", true);
    return { hogar: [...hogar.keys()], hijo: [...hijo.entries()] };
  }

  // ---- plantillas -----------------------------------------------------------------------------
  const DISC = [["no", "Ninguna"], ["33_64", "33 % – 64 %"], ["65_mas", "65 % o más"]];
  const opciones = (lista, val) => lista.map(([v, t]) => `<option value="${esc(v)}"${String(val) === v ? " selected" : ""}>${esc(t)}</option>`).join("");
  const idDe = k => "f_" + k.replace(/\./g, "_");
  // ids históricos del declarante principal (los usan la portada y otras partes de app.js)
  const IDS = { "personas.d1.salario": "f-salario", "personas.d1.ss": "f-ss", "personas.d1.pension": "f-pension",
    "personas.d1.retenciones": "f-retenciones", "personas.d1.edad": "f-edad", "personas.d1.discapacidad": "f-discapacidad" };
  const idCampo = k => IDS[k] || idDe(k);

  function get(obj, ruta) { return ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function set(obj, ruta, v) {
    const ks = ruta.split("."); let o = obj;
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }

  function importe(e, k, etq, ayuda, extra) {
    const v = get(e, k), id = idCampo(k);
    return `<div class="campo"><label for="${id}">${etq}</label>
      <div class="con-sufijo"><input type="number" id="${id}" data-k="${k}" min="0" step="${(extra && extra.step) || 10}" inputmode="decimal" value="${n(v)}"${ayuda ? ` aria-describedby="${id}-ay"` : ""}><span>€</span></div>
      ${ayuda ? `<p class="ayuda" id="${id}-ay">${ayuda}</p>` : ""}</div>`;
  }
  function numero(e, k, etq, attrs, ayuda) {
    const id = idCampo(k);
    return `<div class="campo"><label for="${id}">${etq}</label><input type="number" id="${id}" data-k="${k}" ${attrs || ""} inputmode="numeric" value="${n(get(e, k))}">${ayuda ? `<p class="ayuda">${ayuda}</p>` : ""}</div>`;
  }
  function casilla(e, k, texto) {
    const id = idCampo(k);
    return `<label class="casilla"><input type="checkbox" id="${id}" data-k="${k}"${get(e, k) ? " checked" : ""}> <span>${texto}</span></label>`;
  }
  function selector(e, k, etq, lista, ayuda) {
    const id = idCampo(k);
    return `<div class="campo"><label for="${id}">${etq}</label><select id="${id}" data-k="${k}">${opciones(lista, get(e, k))}</select>${ayuda ? `<p class="ayuda">${ayuda}</p>` : ""}</div>`;
  }
  function fecha(e, k, etq) {
    const id = idCampo(k);
    return `<div class="campo"><label for="${id}">${etq}</label><input type="date" id="${id}" data-k="${k}" value="${esc(get(e, k) || "")}"></div>`;
  }
  // sección desplegable: abierta si la persona la abrió o si ya tiene datos
  function desplegable(id, titulo, conDatos, abiertos, cuerpo, resumen) {
    const abierto = abiertos.has(id) || (conDatos && !abiertos.has("!" + id));
    return `<details class="mas seccion-form" data-sec="${id}"${abierto ? " open" : ""}><summary>${titulo}${conDatos ? ' <span class="chip chip-datos">con datos</span>' : ""}</summary>
      ${resumen ? `<p class="ayuda seccion-ayuda">${resumen}</p>` : ""}${cuerpo}</details>`;
  }

  function htmlDatosPersonales(e, id, ctx) {
    const r = `personas.${id}.`, p = e.personas[id], tu = id === "d1";
    let h = `<div class="rejilla2">${numero(e, r + "edad", tu ? "Tu edad" : "Su edad", 'min="16" max="110" step="1"')}
      ${selector(e, r + "discapacidad", "Discapacidad reconocida", DISC)}</div>`;
    if (p.discapacidad !== "no") {
      h += casilla(e, r + "movilidadReducida", "Movilidad reducida o necesidad de ayuda para desplazarse") +
        casilla(e, r + "ayudaTerceros", "Necesita ayuda de terceras personas (o grado de dependencia)");
    }
    h += casilla(e, r + "desempleado", tu ? "Estoy en desempleo e inscrito como demandante de empleo" : "Está en desempleo e inscrito como demandante de empleo");
    if (p.desempleado) h += numero(e, r + "mesesDesempleo", `Meses de ${ctx.ejercicio} en desempleo`, 'min="1" max="12" step="1"');
    return h;
  }

  function tiposArrendamiento(regimen) {
    if (regimen === "foral_pais_vasco") return [["no_vivienda", "No es vivienda (local, garaje, temporada)"], ["vivienda_habitual", "Vivienda habitual del inquilino (bonificación 30 %)"],
      ["zona_tensionada", "Vivienda en zona tensionada (70 %)"], ["programas_publicos", "Vivienda en programas públicos de alquiler (70 %)"]];
    if (regimen === "foral_navarra") return [["no_vivienda", "No es vivienda (local, garaje, temporada)"], ["general", "Vivienda habitual del inquilino"]];
    return [["no_vivienda", "No es vivienda (local, garaje, temporada)"], ["general", "Vivienda: reducción general del 50 %"],
      ["zona_tensionada_bajada", "Zona tensionada con rebaja de la renta (90 %)"], ["joven_o_admon", "Primer alquiler a joven de 18 a 35 años o a la Administración (70 %)"],
      ["rehabilitacion", "Vivienda rehabilitada en los dos años anteriores (60 %)"]];
  }

  function htmlIngresos(e, id, ctx, abiertos) {
    const r = `personas.${id}.`, p = e.personas[id], tu = id === "d1", ej = ctx.ejercicio, reg = ctx.regimen;
    const ssAuto = !p.ssManual;
    const ssVal = cotizaciones(p, ctx);
    let h = `<h3 class="subtitulo-form">Trabajo o pensión</h3>
      ${importe(e, r + "salario", "Salario o pensión bruta anual", "Retribuciones dinerarias íntegras del certificado de retenciones de tu empresa o de la Seguridad Social.", { step: 100 })}
      ${casilla(e, r + "pension", "Es una pensión de jubilación de la Seguridad Social")}
      <div class="campo"><label for="${idCampo(r + "ss")}">Cotizaciones a la Seguridad Social</label>
        <div class="con-sufijo"><input type="number" id="${idCampo(r + "ss")}" data-k="${r}ss" min="0" step="10" inputmode="decimal" value="${ssVal}" aria-describedby="${idCampo(r + "ss")}-ay"><span>€</span></div>
        <p class="ayuda" id="${idCampo(r + "ss")}-ay">${ssAuto ? `Estimadas con los tipos del trabajador de ${ej} (contrato indefinido). Cámbialas si las conoces: vienen en tu certificado de retenciones.`
          : `Importe introducido. <button class="btn btn-txt btn-sm" type="button" data-accion="ss-auto" data-p="${id}">Volver a estimarlas</button>`}</p></div>
      ${importe(e, r + "retenciones", "Retenciones e ingresos a cuenta del año", "Suma las de todos tus certificados (trabajo, banco, alquileres) y los pagos fraccionados de los modelos 130 o 131.", { step: 50 })}`;
    const masTrabajo = pos(p.otrosPagadores) || pos(p.especie) || pos(p.otrosGastos) || p.movilidad || p.activoDiscapacidad || pos(p.irregularImporte);
    h += desplegable(id + "-trabajo", "Más datos del trabajo", masTrabajo, abiertos,
      importe(e, r + "otrosPagadores", "Del salario, lo cobrado del segundo pagador y siguientes", "Solo cambia si estás obligado a declarar.", { step: 100 }) +
      importe(e, r + "especie", "Retribución en especie (coche, seguro médico, vivienda…)", "Casilla «En especie» del certificado: valoración más ingreso a cuenta.", { step: 50 }) +
      importe(e, r + "otrosGastos", "Cuotas sindicales, colegio profesional obligatorio y defensa jurídica", reg === "comun" ? "Los 2.000 € de «otros gastos» generales ya se aplican solos." : null) +
      (reg === "comun" ? casilla(e, r + "movilidad", `Acepté un trabajo en otro municipio y cambié de residencia (movilidad geográfica, ${ej} o el año anterior)`) : "") +
      (p.discapacidad !== "no" ? casilla(e, r + "activoDiscapacidad", "Trabajador en activo con discapacidad (aumenta los gastos deducibles del trabajo)") : "") +
      `<div class="rejilla2">${importe(e, r + "irregularImporte", "Ingresos generados en más de dos años", "Indemnizaciones o bonus plurianuales: se reducen un 30 %.", { step: 100 })}
        ${numero(e, r + "irregularAnios", "Años en que se generaron", 'min="0" max="40" step="1"')}</div>`);

    const conMob = pos(p.intereses) || pos(p.dividendos) || pos(p.seguros);
    h += desplegable(id + "-mob", "¿Tienes cuentas, dividendos o seguros?", conMob, abiertos,
      `<div class="rejilla2">${importe(e, r + "intereses", "Intereses de cuentas y depósitos")}${importe(e, r + "dividendos", "Dividendos")}</div>` +
      importe(e, r + "seguros", "Rendimientos de seguros de vida o rentas", "La diferencia entre lo cobrado y lo aportado. Vienen en la información fiscal de tu banco o aseguradora."),
      "Ingresos íntegros, antes de retenciones: los da el banco en su información fiscal anual.");

    const tipos = tiposArrendamiento(reg);
    const inms = (p.inmuebles || []).map((i, j) => {
      const k = `${r}inmuebles.${j}.`;
      return `<li class="tarjeta-item"><div class="item-cab"><span class="item-n">Inmueble ${j + 1}</span>
          <button class="btn btn-txt btn-sm" type="button" data-quitar="${r}inmuebles" data-i="${j}" aria-label="Quitar inmueble ${j + 1}">Quitar</button></div>
        ${selector(e, k + "tipo", "Tipo de alquiler", tipos)}
        <div class="rejilla2">${importe(e, k + "ingresos", "Rentas cobradas en el año", null, { step: 100 })}
          ${importe(e, k + "financieros", "Intereses de la hipoteca y reparaciones", null, { step: 50 })}
          ${importe(e, k + "gastos", "IBI, comunidad, seguro y otros gastos", null, { step: 50 })}
          ${importe(e, k + "amortizacion", "Amortización", "3 % del valor de la construcción (sin el suelo).", { step: 50 })}</div></li>`;
    }).join("");
    const conInm = (p.inmuebles || []).length || pos(p.catastralRevisado) || pos(p.catastralOtro);
    h += desplegable(id + "-inm", "¿Tienes pisos o locales alquilados, o a tu disposición?", conInm, abiertos,
      `<ul class="lista-items">${inms}</ul><button class="btn btn-sec btn-sm" type="button" data-anadir="${r}inmuebles">+ Añadir inmueble alquilado</button>
      <p class="gastos-titulo">Inmuebles a tu disposición (segunda residencia o vacíos)</p>
      <div class="rejilla2">${importe(e, r + "catastralRevisado", "Valor catastral revisado en los últimos diez años", "Tributa el 1,1 %.", { step: 1000 })}
        ${importe(e, r + "catastralOtro", "Valor catastral del resto", "Tributa el 2 %.", { step: 1000 })}</div>
      <p class="ayuda">Viene en el recibo del IBI. Pon tu parte (según tu porcentaje de propiedad) y, si no estuvo vacío todo el año, la proporción de días.</p>`);

    const conAct = p.actMetodo !== "no";
    let act = selector(e, r + "actMetodo", "Método de estimación", [["no", "No tengo actividad económica"], ["directa_simplificada", "Estimación directa simplificada"],
      ["directa_normal", "Estimación directa normal"], ["objetiva", "Estimación objetiva (módulos)"]]);
    if (p.actMetodo === "directa_simplificada" || p.actMetodo === "directa_normal") {
      act += `<div class="rejilla2">${importe(e, r + "actIngresos", "Ingresos del año", null, { step: 100 })}
        ${importe(e, r + "actGastos", "Gastos deducibles (incluida tu cuota de autónomo)", null, { step: 100 })}</div>` +
        (p.actMetodo === "directa_simplificada" ? '<p class="ayuda">Restamos solos los gastos de difícil justificación (5 %, hasta 2.000 €).</p>' : "") +
        casilla(e, r + "actInicio", "Empecé la actividad hace menos de dos años (reducción del 20 %)");
    } else if (p.actMetodo === "objetiva") {
      act += importe(e, r + "actModulos", "Rendimiento neto de módulos", "El que resulta de los módulos de tu actividad (Orden de módulos del ejercicio).", { step: 100 });
    }
    h += desplegable(id + "-act", "¿Eres autónomo?", conAct, abiertos, act);

    const ventas = (p.ventas || []).map((v, j) => {
      const k = `${r}ventas.${j}.`;
      return `<li class="tarjeta-item"><div class="item-cab"><span class="item-n">Venta ${j + 1}</span>
          <button class="btn btn-txt btn-sm" type="button" data-quitar="${r}ventas" data-i="${j}" aria-label="Quitar venta ${j + 1}">Quitar</button></div>
        ${selector(e, k + "tipo", "Qué vendiste", [["accion_cotizada", "Acciones cotizadas"], ["fondo", "Fondos de inversión"], ["inmueble", "Un inmueble"], ["otro", "Otro bien o derecho"]])}
        <div class="rejilla2">${importe(e, k + "adquisicion", "Lo que te costó, con gastos", null, { step: 100 })}
          ${importe(e, k + "transmision", "Lo que obtuviste, menos gastos", null, { step: 100 })}
          ${fecha(e, k + "fechaAdq", "Fecha de compra")}${fecha(e, k + "fechaTrans", "Fecha de venta")}</div>
        ${v.tipo === "inmueble" ? casilla(e, k + "exenta", "Ganancia exenta (vivienda habitual vendida con 65 años o más, o reinvertida en otra vivienda habitual)") : ""}</li>`;
    }).join("");
    h += desplegable(id + "-gan", "¿Vendiste acciones, fondos o un inmueble? ¿Algún premio?", (p.ventas || []).length || pos(p.premios), abiertos,
      `<ul class="lista-items">${ventas}</ul><button class="btn btn-sec btn-sm" type="button" data-anadir="${r}ventas">+ Añadir venta</button>
      <p class="ayuda">Si compraste antes de 1995, la fecha sirve para aplicar los coeficientes de abatimiento (DT 9.ª LIRPF). Una pérdida también cuenta: pon lo que obtuviste aunque sea menos.</p>` +
      importe(e, r + "premios", "Premios, ayudas públicas y otras ganancias que no vienen de una venta", "Las loterías del Estado no van aquí: tienen su propio gravamen especial.", { step: 50 }));

    h += desplegable(id + "-red", "Planes de pensiones y pagos a tu ex o a tus hijos", pos(p.planIndividual) || pos(p.planEmpresa) || pos(p.compensatoria) || pos(p.alimentos), abiertos,
      `<div class="rejilla2">${importe(e, r + "planIndividual", reg === "foral_pais_vasco" ? "Tus aportaciones a planes de pensiones o EPSV" : "Tus aportaciones a planes de pensiones", null, { step: 100 })}
        ${importe(e, r + "planEmpresa", "Lo que aporta tu empresa a tu plan", "Viene en el certificado de retenciones; suma también como salario en especie.", { step: 100 })}</div>
      <div class="rejilla2">${importe(e, r + "compensatoria", "Pensión compensatoria a tu excónyuge", "Fijada por resolución judicial.", { step: 100 })}
        ${importe(e, r + "alimentos", "Anualidades por alimentos a tus hijos", "Fijadas por resolución judicial.", { step: 100 })}</div>`);

    let viv = importe(e, r + "alquiler", `Alquiler de tu vivienda habitual pagado en ${ej}`, null, { step: 50 });
    if (reg === "comun") viv += importe(e, r + "hipoteca", "Hipoteca de tu vivienda habitual comprada antes de 2013", `Capital, intereses y seguros vinculados pagados en ${ej} (régimen transitorio).`, { step: 100 });
    if (reg === "foral_pais_vasco") viv += importe(e, r + "compra", `Pagos por la compra de tu vivienda habitual en ${ej}`, "Deducción foral por adquisición de vivienda.", { step: 100 }) +
      casilla(e, r + "colectivoEspecial", "Pertenezco a un colectivo con deducción mayor (familia numerosa o discapacidad)");
    if (reg === "comun") viv += importe(e, r + "donativos", "Donativos a ONG y fundaciones de la Ley 49/2002", "Los que tu ONG comunica a Hacienda (certificado de donaciones).") +
      casilla(e, r + "donativosRec", `Doné a la misma entidad en ${ej - 2} y ${ej - 1} sin bajar el importe`);
    h += desplegable(id + "-viv", reg === "comun" ? "Tu vivienda y tus donativos" : "Tu vivienda", pos(p.alquiler) || pos(p.hipoteca) || pos(p.compra) || pos(p.donativos), abiertos, viv);
    return h;
  }

  function htmlFamilia(e, ctx) {
    const ej = ctx.ejercicio;
    const hijos = e.hijos.map((x, i) => {
      const k = `hijos.${i}.`;
      const extras = (ctx.campos.hijo || []).filter(([, max]) => n(x.edad) <= max).map(([c]) => importe(e, k + "gastos." + c, esc(etiqueta(c)))).join("");
      return `<li class="tarjeta-item"><div class="item-cab"><span class="item-n">Hijo ${i + 1}</span>
          <button class="btn btn-txt btn-sm" type="button" data-quitar="hijos" data-i="${i}" aria-label="Quitar hijo ${i + 1}">Quitar</button></div>
        <div class="rejilla2">${numero(e, k + "edad", "Edad a 31 de diciembre", 'min="0" max="40" step="1"', n(x.edad) === 0 ? `Nacido o adoptado en ${ej}` : "")}
          ${selector(e, k + "discapacidad", "Discapacidad", DISC)}</div>
        ${casilla(e, k + "compartida", "Custodia compartida con su otro progenitor (fuera de tu unidad familiar)")}
        ${importe(e, k + "rentas", "Sus rentas anuales, si tiene", "Con más de 8.000 € no da derecho al mínimo.", { step: 100 })}
        ${extras ? `<div class="item-gastos">${extras}</div>` : ""}</li>`;
    }).join("");
    const ascs = e.ascendientes.map((a, i) => {
      const k = `ascendientes.${i}.`;
      return `<li class="tarjeta-item"><div class="item-cab"><span class="item-n">Ascendiente ${i + 1}</span>
          <button class="btn btn-txt btn-sm" type="button" data-quitar="ascendientes" data-i="${i}" aria-label="Quitar ascendiente ${i + 1}">Quitar</button></div>
        <div class="rejilla2">${numero(e, k + "edad", "Edad", 'min="0" max="120" step="1"')}${selector(e, k + "discapacidad", "Discapacidad", DISC)}</div>
        ${importe(e, k + "rentas", "Sus rentas anuales (pensión incluida)", "Con más de 8.000 € no da derecho al mínimo.", { step: 100 })}</li>`;
    }).join("");
    const nacidos = e.hijos.filter(x => Math.round(n(x.edad)) === 0).length;
    let h = `<div class="campo"><span class="etiqueta">Hijos y descendientes que viven contigo</span>
        <ul class="lista-items" aria-live="polite">${hijos}</ul>
        <button class="btn btn-sec btn-sm" type="button" data-anadir="hijos" id="btn-hijo">+ Añadir hijo</button></div>
      <div class="campo"><span class="etiqueta">Padres o abuelos que conviven contigo al menos seis meses</span>
        <ul class="lista-items" aria-live="polite">${ascs}</ul>
        <button class="btn btn-sec btn-sm" type="button" data-anadir="ascendientes">+ Añadir ascendiente</button></div>
      ${selector(e, "familiaNumerosa", "Familia numerosa", [["no", "No"], ["general", "General"], ["especial", "Especial"]], "Según el título en vigor a 31 de diciembre.")}`;
    if (ctx.pideFnReciente && e.familiaNumerosa !== "no") h += casilla(e, "fnReciente", `Obtuvimos el título de familia numerosa con efectos de ${ej - 2} o posterior (lo exige la deducción de la Comunidad de Madrid)`);
    if (ctx.pideTituloMonoparental && e.hijos.length && e.pareja !== "si") h += selector(e, "tituloMonoparental", "Título autonómico de familia monoparental", [["no", "No tengo"], ["general", "Categoría general"], ["especial", "Categoría especial"]]);
    if (nacidos >= 2) h += casilla(e, "partoMultiple", `Los nacidos en ${ej} son de un parto o adopción múltiple`);
    return h;
  }

  function htmlGastosTerritorio(e, ctx) {
    const campos = ctx.campos.hogar || [];
    if (!campos.length && !(ctx.campos.hijo || []).length) return `<p class="ayuda">En ${esc(ctx.nombre)} no hay deducciones autonómicas por gastos que tengas que indicar aparte.</p>`;
    let h = campos.map(c => importe(e, "gastos." + c, esc(etiqueta(c)))).join("");
    if ((ctx.campos.hijo || []).length) h += `<p class="ayuda">Los gastos de cada hijo (${ctx.campos.hijo.map(([c]) => esc(etiqueta(c).toLowerCase())).join(", ")}) se indican en su ficha, en el paso 2.</p>`;
    return h;
  }

  // ---- montaje en el navegador ------------------------------------------------------------
  // opciones: { raiz: elemento del formulario, contexto: () => ctx, alCambiar: () => void }
  // ctx: { ejercicio, regimen, nombre, terr (objeto del territorio), cotizar, pideFnReciente, pideTituloMonoparental }
  function montar(op) {
    const raiz = op.raiz;
    let e = estadoInicial();
    const abiertos = new Set();
    const zona = nombre => raiz.querySelector(`[data-zona="${nombre}"]`);
    const ctxCompleto = () => {
      const c = op.contexto();
      c.campos = camposTerritorio(c.terr, { menor3: e.hijos.some(h => n(h.edad) < 3) });
      return c;
    };

    // los campos fijos de index.html (territorio, municipio, casado…) mandan sobre el estado,
    // salvo al rellenar un hogar guardado, en que el estado se escribe en ellos
    function pintar(escribirFijos) {
      for (const el of raiz.querySelectorAll("[data-k]")) if (el.closest("[data-zona]") == null) (escribirFijos ? escribir : leer)(el);
      const ctx = ctxCompleto();
      const foco = document.activeElement && raiz.contains(document.activeElement) ? document.activeElement.dataset.k || document.activeElement.dataset.foco : null;
      const pareja = e.pareja === "si";
      if (!pareja) e.ver = "d1";
      zona("personal").innerHTML = htmlDatosPersonales(e, "d1", ctx);
      zona("pareja").hidden = !pareja;
      zona("pareja").innerHTML = pareja ? `<p class="subtitulo-form">Tu cónyuge</p>${htmlDatosPersonales(e, "d2", ctx)}
        <p class="ayuda">Sus ingresos y gastos se rellenan en el paso 3, en «Tu cónyuge».</p>` : "";
      zona("familia").innerHTML = htmlFamilia(e, ctx);
      zona("quien").hidden = !pareja;
      zona("quien").innerHTML = pareja ? `<span class="etiqueta" id="lbl-quien">¿De quién son los datos que rellenas?</span>
        <div class="segmentado" role="radiogroup" aria-labelledby="lbl-quien">
          <label><input type="radio" name="ver" data-k="ver" value="d1"${e.ver === "d1" ? " checked" : ""} data-foco="ver-d1"><span>Tú</span></label>
          <label><input type="radio" name="ver" data-k="ver" value="d2"${e.ver === "d2" ? " checked" : ""} data-foco="ver-d2"><span>Tu cónyuge</span></label></div>` : "";
      zona("ingresos").innerHTML = htmlIngresos(e, e.ver, ctx, abiertos);
      zona("gastos").innerHTML = htmlGastosTerritorio(e, ctx);
      pintarAvisos(ctx);
      if (foco) {
        const el = raiz.querySelector(`[data-k="${foco}"]:not([type="radio"])`) || raiz.querySelector(`[data-foco="${foco}"]`);
        if (el) el.focus({ preventScroll: true });
      }
    }
    function pintarAvisos(ctx) {
      const lista = avisos(e, ctx || ctxCompleto());
      raiz.querySelectorAll("[aria-invalid]").forEach(el => el.removeAttribute("aria-invalid"));
      for (const a of lista) if (a.k) { const el = raiz.querySelector(`[data-k="${a.k}"]`); if (el) el.setAttribute("aria-invalid", "true"); }
      const z = zona("avisos");
      z.hidden = !lista.length;
      z.innerHTML = lista.length ? `<p class="avisos-form-tit">Revisa estos datos</p><ul>${lista.map(a => `<li>${esc(a.texto)}</li>`).join("")}</ul>` : "";
    }
    // estado -> elemento (campos estáticos de index.html: territorio, municipio…)
    function escribir(el) {
      const v = get(e, el.dataset.k);
      if (el.type === "checkbox") el.checked = !!v;
      else if (el.type === "radio") el.checked = el.value === String(v);
      else el.value = v == null ? "" : v;
    }
    // elemento -> estado
    function leer(el) {
      const k = el.dataset.k;
      if (!k) return;
      let v;
      if (el.type === "checkbox") v = el.checked;
      else if (el.type === "radio") { if (!el.checked) return; v = el.value; }
      else if (el.type === "number" && k !== "municipio") v = el.value === "" ? 0 : n(el.value);
      else v = el.value;
      if (/\.ss$/.test(k)) set(e, k.replace(/ss$/, "ssManual"), true);
      set(e, k, v);
    }
    // cambios que alteran qué campos se muestran: se vuelve a pintar al terminar de escribir
    const ESTRUCTURA = /(^ver$|^pareja$|^familiaNumerosa$|^territorio$|discapacidad$|desempleado$|actMetodo$|\.tipo$|hijos\.\d+\.edad$)/;
    raiz.addEventListener("input", ev => {
      const el = ev.target;
      if (!el.dataset || !el.dataset.k) return;
      leer(el);
      // las cotizaciones estimadas siguen al salario mientras no se escriban a mano
      const m = el.dataset.k.match(/^personas\.(d1|d2)\.(salario|pension)$/);
      if (m && !e.personas[m[1]].ssManual) {
        const ss = raiz.querySelector(`[data-k="personas.${m[1]}.ss"]`);
        if (ss) ss.value = cotizaciones(e.personas[m[1]], op.contexto());
      }
      if ((el.type === "checkbox" || el.type === "radio" || el.tagName === "SELECT") && ESTRUCTURA.test(el.dataset.k)) pintar();
      else pintarAvisos();
      op.alCambiar();
    });
    raiz.addEventListener("change", ev => {
      const el = ev.target;
      if (el.dataset && el.dataset.k && el.type === "number" && /hijos\.\d+\.edad$/.test(el.dataset.k)) pintar();
    });
    raiz.addEventListener("click", ev => {
      const b = ev.target.closest("button[data-anadir], button[data-quitar], button[data-accion]");
      if (!b) return;
      const ej = op.contexto().ejercicio;
      if (b.dataset.anadir) {
        const ruta = b.dataset.anadir, lista = get(e, ruta);
        const nuevo = /inmuebles$/.test(ruta) ? inmuebleInicial() : /ventas$/.test(ruta) ? ventaInicial(ej)
          : ruta === "hijos" ? hijoInicial() : ascendienteInicial();
        lista.push(nuevo);
        pintar();
        const primero = raiz.querySelector(`[data-k^="${ruta}.${lista.length - 1}."]`);
        if (primero) primero.focus();
      } else if (b.dataset.quitar) {
        get(e, b.dataset.quitar).splice(+b.dataset.i, 1);
        pintar();
        const btn = raiz.querySelector(`[data-anadir="${b.dataset.quitar}"]`);
        if (btn) btn.focus();
      } else if (b.dataset.accion === "ss-auto") {
        e.personas[b.dataset.p].ssManual = false;
        pintar();
      }
      op.alCambiar();
    });
    raiz.addEventListener("toggle", ev => {
      const d = ev.target;
      if (!d.dataset || !d.dataset.sec) return;
      if (d.open) { abiertos.add(d.dataset.sec); abiertos.delete("!" + d.dataset.sec); }
      else { abiertos.delete(d.dataset.sec); abiertos.add("!" + d.dataset.sec); }
    }, true);

    return {
      get estado() { return e; },
      pintar,
      hogar: () => hogarDesdeEstado(e, op.contexto()),
      rellenar(h) { e = estadoDesdeHogar(h); abiertos.clear(); pintar(true); },
      fijar(ruta, v) { set(e, ruta, v); pintar(); },
      leerTodo() { for (const el of raiz.querySelectorAll("[data-k]")) leer(el); }
    };
  }

  const api = { estadoInicial, personaInicial, hogarDesdeEstado, estadoDesdeHogar, avisos, camposTerritorio, etiqueta,
    ingresosBrutos, retencionesHogar, cotizaciones, montar,
    plantillas: { htmlIngresos, htmlFamilia, htmlDatosPersonales, htmlGastosTerritorio, tiposArrendamiento } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.formularioIrpf = api;
})();
