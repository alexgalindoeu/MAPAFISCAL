// =============================================================================
// Suite foral: páginas SEO de Bizkaia, Gipuzkoa, Araba/Álava y Navarra.
//   /irpf/<foral>/simulador-renta/   /irpf/<foral>/sueldo-neto/   /irpf/<foral>/jubilados/
//   /irpf/<foral>/familia-numerosa/  /irpf/<foral>/discapacidad/  /irpf/<foral>/planes-pensiones/
//   /irpf/pais-vasco/  (comparativa de los tres territorios históricos)
// y, para la página /irpf/<foral>/ que maqueta tools/generar_paginas_seo.mjs, la sección «La renta
// en <territorio>» con la tabla de tipo marginal y medio por sueldo (rentaForal) y los enlaces.
// Todas las cifras salen del motor JS (web/js/irpfsim.js, con paridad al céntimo con el
// motor R en tools/validar_js.R) y de los parámetros exportados (web/datos/params_<año>.json):
// aquí no se escribe ningún importe a mano. Lo usa tools/generar_paginas_seo.mjs.
// =============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SLUG, NOMBRE_CORTO, esc, euros, pctMedio, pctTipo, textoPlano, tablaEscala, layout, jsonLdMigas, jsonLdFaq, bloqueFaq, migasHtml } from "./seo_comun.mjs";

const require = createRequire(import.meta.url);
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const motor = require(join(WEB, "js", "irpfsim.js"));

export const FORALES = ["ES-PV-BI", "ES-PV-SS", "ES-PV-VI", "ES-NC"];
const PV = ["ES-PV-BI", "ES-PV-SS", "ES-PV-VI"];
const HACIENDA = { "ES-PV-BI": "la Hacienda Foral de Bizkaia", "ES-PV-SS": "la Hacienda Foral de Gipuzkoa",
  "ES-PV-VI": "la Hacienda Foral de Álava", "ES-NC": "la Hacienda Foral de Navarra" };
const NORMA = { "ES-PV-BI": "Norma Foral 13/2013, del IRPF de Bizkaia", "ES-PV-SS": "Norma Foral 3/2014, del IRPF de Gipuzkoa",
  "ES-PV-VI": "Norma Foral 33/2013, del IRPF de Álava", "ES-NC": "Texto Refundido de la Ley Foral del IRPF de Navarra (DFL 4/2008)" };
// Institución de la que depende cada hacienda foral, y el acuerdo con el Estado que le da el IRPF.
const INSTITUCION = { "ES-PV-BI": "la Diputación Foral de Bizkaia", "ES-PV-SS": "la Diputación Foral de Gipuzkoa",
  "ES-PV-VI": "la Diputación Foral de Álava", "ES-NC": "el Gobierno de Navarra" };
const ACUERDO = t => t === "ES-NC" ? "el Convenio Económico con Navarra" : "el Concierto Económico con el País Vasco";
// Nombre como se busca (Gipuzkoa, Álava, Navarra), para títulos, encabezados y textos de enlace.
const corto = t => NOMBRE_CORTO[t];
const mayus = s => s.charAt(0).toUpperCase() + s.slice(1);
// «la Norma Foral 3/2014…» / «el Texto Refundido…»
const conNorma = t => (/^Norma/.test(NORMA[t]) ? "la " : "el ") + NORMA[t];
export const SECCIONES = [
  ["simulador-renta", "Simulador de la renta"], ["sueldo-neto", "Sueldo neto"], ["jubilados", "Jubilados y pensionistas"],
  ["familia-numerosa", "Familia numerosa"], ["discapacidad", "Discapacidad"], ["planes-pensiones", "Planes de pensiones y EPSV"]
];
const BRUTOS = [18000, 22000, 26000, 30000, 36000, 45000, 60000, 80000];

// Ejercicio por defecto de la web (params/ejercicios.yaml → web/datos/params.json).
function paramsDefecto() {
  return JSON.parse(readFileSync(join(WEB, "datos", "params.json"), "utf8"));
}
const esMapa = v => v && typeof v === "object" && !Array.isArray(v);
const fusionar = (a, b) => { const r = Object.assign({}, a); for (const k of Object.keys(b || {})) r[k] = esMapa(b[k]) && esMapa(a[k]) ? fusionar(a[k], b[k]) : b[k]; return r; };
// parámetros del territorio: bloque común del País Vasco con sus overrides, o Navarra
const juris = (P, t) => t === "ES-NC" ? P.navarra : fusionar(P.foral_pv, (P.foral_pv.overrides || {})[t] || {});
const esPv = t => t !== "ES-NC";
const nombreDe = (P, t) => t === "ES-NC" ? "Navarra" : P.territorios[t].nombre;
const minus = s => s.toLowerCase().replace("epsv", "EPSV");
// IRPF negativo: deducciones que se cobran aunque no haya cuota
const eIrpf = v => v < 0 ? `0 € (y te devuelven ${euros(-v)})` : euros(v);
const e2 = n => euros(n);
const cta = (txt, href, sec) => `<p><a class="btn btn-pri" href="${href}">${esc(txt)}</a>${sec ? ` <a class="btn btn-sec" href="${sec[1]}">${esc(sec[0])}</a>` : ""}</p>`;
// Con `etiqueta`, la envoltura se puede enfocar para desplazarla con el teclado (tablas anchas).
const tabla = (cab, filas, etiqueta) => `<div class="envoltorio"${etiqueta ? ` tabindex="0" role="region" aria-label="${esc(etiqueta)}"` : ""}><table class="cobertura"><thead><tr>${cab.map(([c, n]) => `<th${n ? ' class="num"' : ""}>${esc(c)}</th>`).join("")}</tr></thead><tbody>${filas.join("")}</tbody></table></div>`;
const fila = celdas => `<tr>${celdas.map(([v, n]) => `<td${n ? ' class="num"' : ""}>${v}</td>`).join("")}</tr>`;
const norma = x => x && x.norma ? `<p class="cita">Norma: ${esc(x.norma)}.</p>` : "";

// ---- cálculos con el motor -------------------------------------------------------------
function irpf(P, t, miembros, extra = {}) {
  const h = Object.assign({ territorio: t, ejercicio: P.ejercicio, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no", miembros }, extra);
  const liq = motor.liquidar(h, P, "auto");
  return { irpf: motor.irpfAnual(liq), liq };
}
const asalariado = (P, bruto, mas = {}) => Object.assign({ id: "d1", rol: "declarante", edad: 40,
  trabajo: { dinerarias: bruto, cotizacionesSs: motor.cotizacionesTrabajador(bruto, P) } }, mas);
const pensionista = (pension, edad, mas = {}) => Object.assign({ id: "d1", rol: "declarante", edad,
  trabajo: { dinerarias: pension, cotizacionesSs: 0, pensionJubilacion: true } }, mas);
const neto = (P, t, bruto) => motor.sueldoNeto({ bruto, territorio: t, edad: 40, hijos: [], tipoContrato: "indefinido" }, P);
const hijos = edades => edades.map((e, i) => ({ id: "h" + (i + 1), rol: "descendiente", edad: e }));

// ---- piezas comunes ----------------------------------------------------------------------
const ruta = (t, sec) => `/irpf/${SLUG[t]}/${sec ? sec + "/" : ""}`;
// Texto del enlace a la página principal del territorio: varía con la sección para no repetir
// siempre el mismo ancla («IRPF en Gipuzkoa», «tablas IRPF Gipuzkoa 2026», «renta Gipuzkoa 2025»…).
function anclaPrincipal(P, t, actual) {
  const c = corto(t), ej = P.ejercicio, i = SECCIONES.findIndex(([s]) => s === actual);
  return [[`IRPF en ${c}`, ruta(t)], [`tablas IRPF ${c} ${ej}`, ruta(t) + "#tabla-" + ej], [`renta ${c} ${ej - 1}`, ruta(t) + "#renta"],
    [`tipo marginal en ${c}`, ruta(t) + "#tipos-por-sueldo"]][Math.max(0, i) % 4];
}
function otrasSecciones(P, t, actual) {
  const n = nombreDe(P, t), [txt, href] = anclaPrincipal(P, t, actual);
  return `<p class="ayuda">Más sobre el IRPF en ${esc(n)}: <a href="${href}">${esc(txt)}</a> · ` + SECCIONES.filter(([s]) => s !== actual)
    .map(([s, tit]) => `<a href="${ruta(t, s)}">${esc(minus(tit))}</a>`).join(" · ") +
    (esPv(t) ? ` · <a href="/irpf/pais-vasco/">los tres territorios vascos, comparados</a>` : "") + `</p>`;
}
// Minoración general de la cuota del territorio vasco (importe por declaración).
function minoracion(J, t) {
  const m = J.minoracion_cuota;
  return t === "ES-PV-BI" ? m.importe_bizkaia : t === "ES-PV-VI" ? m.importe_araba : m.importe_gipuzkoa;
}
function rasgoForal(P, t) {
  const n = nombreDe(P, t), J = juris(P, t);
  if (esPv(t)) {
    const imp = minoracion(J, t);
    return `${esc(n)} no aplica la escala estatal ni el mínimo personal y familiar: tiene una tarifa foral única, una bonificación del trabajo de hasta ${esc(e2(J.bonificacion_trabajo.importe_pleno))} que reduce el rendimiento, una minoración de la cuota de ${esc(e2(imp))} por declaración y deducciones en cuota por hijos, ascendientes, edad y discapacidad.`;
  }
  return `${esc(n)} no aplica la escala estatal ni el mínimo personal y familiar en la base: tiene una tarifa foral única y convierte los mínimos en deducciones de la cuota (${esc(e2(J.minimo_personal_deduccion.importe_general))} por contribuyente, más incrementos por rentas, edad, discapacidad e hijos), junto con una deducción por rendimientos del trabajo.`;
}
function pagina(P, t, sec, { h1, entradilla, cuerpo, qs, title, description }, generado) {
  const n = nombreDe(P, t), r = ruta(t, sec), tit = SECCIONES.find(s => s[0] === sec)[1];
  const migas = [["Inicio", "/"], ["IRPF por territorio", "/irpf/"], [n, ruta(t)], [tit, null]];
  const main = `
  <h1>${esc(h1)}</h1>
  <p class="entradilla">${entradilla}</p>
  <div class="prosa">
  ${cuerpo}
  ${bloqueFaq(qs)}
  ${otrasSecciones(P, t, sec)}
  </div>`;
  return { ruta: r, html: layout({ title: `${title} | Mapafiscal`, description, canonical: r, breadcrumb: migasHtml(migas), main, generado, ejercicio: P.ejercicio,
    jsonld: [jsonLdMigas(migas), jsonLdFaq(qs)] }) };
}

// ---- 1. simulador de la renta -----------------------------------------------------------
// Enlace a la calculadora con el territorio ya elegido (#calculadora?t=…, lo lee web/js/app.js)
// y, si se pide, otro ejercicio publicado (&ejercicio=…).
export const enlaceCalculadora = (t, ej) => `/index.html#calculadora?t=${t}${ej ? `&ejercicio=${ej}` : ""}`;
const publicados = P => ((P.ejercicios && P.ejercicios.publicados) || [P.ejercicio]).map(Number);
const MODO = { individual: "individual", conjunta: "conjunta" };
function pSimulador(P, t, generado) {
  const n = nombreDe(P, t), c = corto(t), J = juris(P, t), ej = P.ejercicio;
  const ant = publicados(P).includes(ej - 1) ? ej - 1 : null;
  const filas = BRUTOS.map(b => { const x = irpf(P, t, [asalariado(P, b)]);
    return fila([[esc(e2(b))], [esc(e2(x.liq.baseLiquidableGeneral)), 1], [esc(e2(x.irpf)), 1], [esc(pctMedio(x.irpf / b)), 1],
      [esc(pctTipo(motor.tipoMarginal(x.liq.baseLiquidableGeneral, J.escala_general_foral))), 1]]); });
  const ej30 = irpf(P, t, [asalariado(P, 30000)]).irpf;
  // Ejemplos de hogares liquidados con el motor (la calculadora elige la tributación más barata).
  const pareja = { id: "d2", rol: "conyuge", edad: 38 };
  const casos = [
    ["Persona soltera con 30.000 € de sueldo", [asalariado(P, 30000)], {}, 30000],
    ["Persona soltera con 45.000 € de sueldo", [asalariado(P, 45000)], {}, 45000],
    ["Pareja con un sueldo de 40.000 € y dos hijos de 8 y 4 años", [asalariado(P, 40000), pareja, ...hijos([8, 4])], { tipoUnidadFamiliar: "biparental" }, 40000],
    ["Pareja con sueldos de 30.000 € y 25.000 € y un hijo de 5 años", [asalariado(P, 30000), asalariado(P, 25000, pareja), ...hijos([5])], { tipoUnidadFamiliar: "biparental" }, 55000],
    ["Pensionista de 67 años con 22.000 € de pensión", [pensionista(22000, 67)], {}, 22000]
  ].map(([txt, miembros, extra, ingresos]) => { const x = irpf(P, t, miembros, extra);
    return { txt, irpf: x.irpf, modo: MODO[x.liq.modoTributacionElegido] || "individual", medio: x.irpf / ingresos }; });
  const filasCasos = casos.map(k => fila([[esc(k.txt)], [esc(k.modo)], [esc(eIrpf(k.irpf)), 1], [esc(pctMedio(Math.max(0, k.medio))), 1]]));
  const fam = casos[2];
  const qs = [
    [`¿Hay un simulador de la renta ${ej} de ${c}?`, `Sí. La calculadora de Mapafiscal aplica la normativa foral de ${n} de ${ej}: la tarifa, ${esPv(t) ? "la bonificación del trabajo, la minoración de la cuota" : "las deducciones por mínimo personal y familiar, la deducción por trabajo"} y las deducciones familiares y personales. El enlace de esta página la abre con ${c} ya elegido.`],
    [`¿Puedo hacer la renta de ${n} con el programa de la Agencia Tributaria?`, `No. Si resides en ${n} declaras ante ${HACIENDA[t]}, con su propia normativa, su propio programa y su propio calendario de campaña. Renta Web y el borrador de la Agencia Tributaria solo sirven para el régimen común.`],
    ...(ant ? [[`¿Puedo simular también la renta ${ant} de ${c}?`, `Sí: la renta de ${ant} es la que se declara en ${ant + 1}. La calculadora tiene los dos ejercicios, ${ant} y ${ej}, y el segundo botón de esta página la abre en ${ant} con ${c} ya elegido.`]] : []),
    [`¿Cuánto paga una familia en la renta ${ej} de ${c}?`, `Una pareja con un sueldo de 40.000 € y dos hijos de 8 y 4 años paga ${eIrpf(fam.irpf)} de IRPF en ${ej}, con declaración ${fam.modo}. Con tus datos, el simulador prueba la declaración individual y la conjunta y elige la más barata.`],
    [`¿En qué se diferencia el IRPF de ${n} del resto de España?`, textoPlano(rasgoForal(P, t))],
    ["¿Puedo comparar mi resultado con otros territorios?", `Sí: el comparador calcula el mismo caso en los 19 territorios fiscales, los cuatro forales incluidos. Si asesoras a clientes, puedes comparar a cada uno con un clic.`]
  ];
  const botones = `<p><a class="btn btn-pri" href="${enlaceCalculadora(t)}">${esc(`Simula tu renta ${ej} en ${c}`)}</a>${ant ? ` <a class="btn btn-sec" href="${enlaceCalculadora(t, ant)}">${esc(`Simula la renta ${ant} de ${c}`)}</a>` : ""}</p>
  <p class="ayuda">La calculadora se abre con ${esc(n)} ya elegido. <a href="/index.html#comparar">Compara tu caso con los otros 18 territorios</a>.</p>`;
  const cuerpo = `
  ${botones}
  <div class="tarjeta"><h2 class="rotulo">Cómo se calcula la renta en ${esc(n)}</h2><p>${rasgoForal(P, t)}</p>
    <p>La declaración se presenta ante ${esc(HACIENDA[t])}, de ${esc(INSTITUCION[t])}, con calendario y programa propios. Aquí puedes simularla antes: el resultado sale de la misma normativa (${esc(NORMA[t])}). <a href="${ruta(t)}#renta">Más sobre la renta en ${esc(c)}</a>.</p></div>
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Ejemplos de la renta ${ej} en ${esc(c)}</h2>
    <p class="ayuda">IRPF del año tras la declaración, calculado con el mismo motor que el simulador. Sueldos con contrato indefinido; tipo medio sobre el bruto: IRPF entre los ingresos brutos del hogar.</p>
    ${tabla([["Caso"], ["Declaración"], ["IRPF", 1], ["Tipo medio sobre el bruto", 1]], filasCasos)}</div>
  <div class="tarjeta"><h2 class="rotulo">Tarifa general de ${esc(n)} (${ej})</h2>${tablaEscala(J.escala_general_foral, "Tramo de la base liquidable general")}</div>
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Cuánto IRPF sale con tu sueldo en ${esc(n)}</h2>
    <p class="ayuda">Supuesto: persona soltera de 40 años, sin hijos, solo con su sueldo, contrato indefinido. IRPF del año tras la declaración. Tipo medio sobre el sueldo bruto: IRPF entre sueldo bruto; tipo marginal: el de la tarifa en el último euro de la base.</p>
    ${tabla([["Sueldo bruto"], ["Base liquidable", 1], ["IRPF", 1], ["Tipo medio sobre el bruto", 1], ["Tipo marginal", 1]], filas)}</div>
  ${botones}`;
  return pagina(P, t, "simulador-renta", { h1: `Simulador renta ${ej} ${c}: tu IRPF con la normativa foral`,
    entradilla: `Calcula tu renta ${ej} de ${esc(n)} con su normativa foral: tarifa, reducciones y deducciones propias. Con 30.000 € de sueldo, una persona soltera paga <b>${esc(e2(ej30))}</b> al año.`,
    cuerpo, qs, title: `Simulador renta ${ej} ${c}: calcula tu IRPF foral`,
    description: `Simulador renta ${ej} de ${c} gratis, con la normativa foral${ant ? ` (y la renta ${ant})` : ""}: ejemplos por sueldo y familia, tipo marginal y comparador de los 19 territorios.` }, generado);
}

// ---- 2. sueldo neto -----------------------------------------------------------------------
function pSueldoNeto(P, t, generado, importesConPagina) {
  const n = nombreDe(P, t), ej = P.ejercicio;
  const filas = BRUTOS.map(b => { const s = neto(P, t, b);
    const enlace = importesConPagina.has(b) ? `<a href="/sueldo-neto/${b}/${SLUG[t]}/">${esc(e2(b))}</a>` : esc(e2(b));
    return fila([[enlace], [esc(e2(s.cotizaciones)), 1], [esc(e2(s.irpf)), 1], [`<b>${esc(e2(s.neto))}</b>`, 1], [esc(e2(s.neto / 12)), 1], [esc(e2(s.neto / 14)), 1]]); });
  const s30 = neto(P, t, 30000), md = neto(P, "ES-MD", 30000);
  const dif = s30.neto - md.neto;
  const qs = [
    [`¿Cuánto es el sueldo neto de 30.000 € brutos en ${n}?`, `${e2(s30.neto)} al año en ${ej}: ${e2(s30.cotizaciones)} de cotizaciones a la Seguridad Social y ${e2(s30.irpf)} de IRPF foral, para una persona soltera sin hijos. Son ${e2(s30.neto / 12)} al mes en 12 pagas o ${e2(s30.neto / 14)} en 14.`],
    [`¿Se cobra más neto en ${n} que en Madrid?`, `Con 30.000 € brutos, en ${n} quedan ${e2(s30.neto)} y en Madrid ${e2(md.neto)}: ${e2(Math.abs(dif))} ${dif >= 0 ? "más" : "menos"} al año. La diferencia cambia con el sueldo y con la familia; el comparador la calcula para tu caso.`],
    ["¿Las cotizaciones a la Seguridad Social son distintas en los territorios forales?", "No. La Seguridad Social es la misma en toda España; lo que cambia es el IRPF, que en los territorios forales tiene tarifa y deducciones propias."],
    ["¿El neto de la nómina coincide con estas cifras?", "La nómina lleva una retención a cuenta que la empresa calcula con las tablas forales; aquí se muestra el IRPF definitivo del año, tras la declaración. La diferencia entre ambos es lo que te sale a pagar o a devolver."]
  ];
  const cuerpo = `
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">De bruto a neto en ${esc(n)} (${ej})</h2>
    <p class="ayuda">Supuesto: persona soltera de 40 años, sin hijos, contrato indefinido en el Régimen General. IRPF definitivo del año, no la retención de la nómina.</p>
    ${tabla([["Bruto anual"], ["Seguridad Social", 1], ["IRPF", 1], ["Neto anual", 1], ["Al mes (12)", 1], ["Al mes (14)", 1]], filas)}</div>
  <div class="tarjeta"><h2 class="rotulo">Por qué el neto de ${esc(n)} es distinto</h2><p>${rasgoForal(P, t)}</p></div>
  ${cta(`Calcula tu sueldo neto en ${n}`, `/index.html#sueldo-neto`, ["Sueldo neto en los 19 territorios", "/sueldo-neto/"])}`;
  return pagina(P, t, "sueldo-neto", { h1: `Calculadora de sueldo neto en ${n} (${ej})`,
    entradilla: `Cuánto queda de tu sueldo bruto en ${esc(n)} después de la Seguridad Social y del IRPF foral. Con 30.000 € brutos: <b>${esc(e2(s30.neto))}</b> netos al año.`,
    cuerpo, qs, title: `Sueldo neto en ${n} ${ej}: calculadora de bruto a neto`,
    description: `Calculadora de sueldo neto en ${n} para ${ej}: de bruto a neto con el IRPF foral y la Seguridad Social, en 12 y 14 pagas, con tabla por sueldo.` }, generado);
}

// ---- 3. jubilados --------------------------------------------------------------------------
function pJubilados(P, t, generado) {
  const n = nombreDe(P, t), J = juris(P, t), ej = P.ejercicio;
  const PENS = [14000, 18000, 22000, 26000, 32000, 40000];
  const filas = PENS.map(p => fila([[esc(e2(p))], [esc(eIrpf(irpf(P, t, [pensionista(p, 67)]).irpf)), 1], [esc(eIrpf(irpf(P, t, [pensionista(p, 76)]).irpf)), 1],
    [esc(e2(irpf(P, "ES-MD", [pensionista(p, 67)]).irpf)), 1]]));
  let ventajas;
  if (esPv(t)) {
    const d = J.deduccion_edad.individual, pc = J.prestaciones_prevision_capital;
    ventajas = `<p>Deducción por edad: <b>${esc(e2(d.edad_65.importe))}</b> desde los 65 años y <b>${esc(e2(d.edad_75.importe))}</b> desde los 75, completa con una base de hasta ${esc(e2(d.edad_65.base_plena))} y decreciente hasta desaparecer en ${esc(e2(d.edad_65.base_cero))}.</p>${norma(J.deduccion_edad)}
    <p>Si cobras tu EPSV o tu plan de pensiones de una vez, el primer cobro en capital se integra solo al ${100 - 100 * pc.porcentaje_reduccion} %, hasta ${esc(e2(pc.limite))}.</p>${norma(pc)}`;
  } else {
    const mp = J.minimo_personal_deduccion, dp = J.deduccion_pension_jubilacion, pc = J.prestaciones_prevision_capital;
    ventajas = `<p>La deducción por mínimo personal (${esc(e2(mp.importe_general))}) sube <b>${esc(e2(mp.incremento_65))}</b> desde los 65 años y <b>${esc(e2(mp.incremento_75))}</b> desde los 75.</p>${norma(mp)}
    <p>Las pensiones de jubilación contributivas inferiores a ${esc(e2(dp.umbral))} tienen además una deducción por la diferencia hasta esa cifra, que se cobra aunque no haya cuota, con límites de renta.</p>${norma(dp)}
    <p>Si rescatas tu plan de pensiones de una vez, lo aportado hasta ${pc.anio_corte_aportaciones - 1} tiene una reducción del ${100 * pc.porcentaje_reduccion} % si lo cobras el año de la jubilación o en los ${pc.plazo_anios} siguientes.</p>${norma(pc)}`;
  }
  const p22 = irpf(P, t, [pensionista(22000, 67)]).irpf;
  const qs = [
    [`¿Cuánto IRPF paga un jubilado en ${n}?`, `Con una pensión de 22.000 € y 67 años, ${e2(p22)} al año en ${ej}. La pensión tributa como rendimiento del trabajo con la tarifa foral, sin cotizaciones a la Seguridad Social.`],
    [`¿Hay alguna ventaja por edad en el IRPF de ${n}?`, esPv(t) ? `Sí: una deducción en la cuota de ${e2(J.deduccion_edad.individual.edad_65.importe)} desde los 65 años y de ${e2(J.deduccion_edad.individual.edad_75.importe)} desde los 75, que se reduce a partir de ${e2(J.deduccion_edad.individual.edad_65.base_plena)} de base.` : `Sí: la deducción por mínimo personal aumenta ${e2(J.minimo_personal_deduccion.incremento_65)} desde los 65 años y ${e2(J.minimo_personal_deduccion.incremento_75)} desde los 75.`],
    ["¿La pensión de la Seguridad Social tributa igual que un sueldo?", "Es rendimiento del trabajo, como el sueldo, pero no paga cotizaciones. Las pensiones de incapacidad permanente absoluta y gran invalidez están exentas."],
    [esPv(t) ? "¿Cómo tributa cobrar la EPSV al jubilarme?" : "¿Cómo tributa rescatar el plan de pensiones al jubilarme?", `Es rendimiento del trabajo y se suma a la pensión. ${esPv(t) ? "El primer cobro en forma de capital se integra al 60 %, con un límite de 300.000 €; lo cobrado como renta, al 100 %." : "Cobrado en capital, lo aportado hasta 2017 tiene una reducción del 40 % dentro de plazo; lo demás, y lo cobrado como renta, tributa entero."} La calculadora de rescate compara las tres formas.`]
  ];
  const cuerpo = `
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">IRPF de una pensión en ${esc(n)} (${ej})</h2>
    <p class="ayuda">Supuesto: pensionista sin otras rentas, tributación individual. Última columna: la misma pensión en Madrid, como referencia del régimen común.</p>
    ${tabla([["Pensión anual"], [`${n}, 67 años`, 1], [`${n}, 76 años`, 1], ["Madrid, 67 años", 1]], filas)}</div>
  <div class="tarjeta"><h2 class="rotulo">Ventajas para mayores de 65 años en ${esc(n)}</h2>${ventajas}</div>
  ${cta("Calcula tu IRPF como pensionista", "/index.html#calculadora", [esPv(t) ? "¿Cuánto tributa cobrar mi EPSV?" : "¿Cuánto tributa rescatar mi plan?", `/index.html#rescate-plan?t=${t}`])}`;
  return pagina(P, t, "jubilados", { h1: `IRPF de los jubilados en ${n} (${ej})`,
    entradilla: `Cuánto IRPF paga una pensión en ${esc(n)} y qué ventajas tiene la normativa foral desde los 65 años. Con 22.000 € de pensión: <b>${esc(e2(p22))}</b> al año.`,
    cuerpo, qs, title: `IRPF jubilados ${n} ${ej}: cuánto paga tu pensión`,
    description: `IRPF de las pensiones en ${n} (${ej}): tabla por importe, deducciones por edad y cómo tributa el cobro ${esPv(t) ? "de la EPSV" : "del plan de pensiones"}. Calculadora gratuita.` }, generado);
}

// ---- 4. familia numerosa ------------------------------------------------------------------
function pFamiliaNumerosa(P, t, generado) {
  const n = nombreDe(P, t), J = juris(P, t), ej = P.ejercicio;
  const pareja = (b, hs, fn) => irpf(P, t, [asalariado(P, b), { id: "d2", rol: "conyuge", edad: 38 }, ...hijos(hs)],
    { tipoUnidadFamiliar: "biparental", familiaNumerosa: fn }).irpf;
  const filas = [30000, 40000, 50000, 65000, 80000].map(b => { const s = pareja(b, [], "no"), c3 = pareja(b, [10, 7, 3], "general"), c5 = pareja(b, [14, 11, 9, 6, 2], "especial");
    return fila([[esc(e2(b))], [esc(e2(s)), 1], [esc(e2(c3)), 1], [esc(e2(s - c3)), 1], [esc(e2(c5)), 1]]); });
  let importes;
  if (esPv(t)) {
    const d = J.deduccion_descendientes, a = J.deduccion_alquiler_vivienda, q = J.deduccion_adquisicion_vivienda;
    importes = `<p>Deducción por descendientes, por cada hijo: ${["1", "2", "3", "4", "5+"].map((k, i) => `${esc(e2(d.importes[k]))} el ${["primero", "segundo", "tercero", "cuarto", "quinto y siguientes"][i]}`).join(", ")}. Se suman ${esc(e2(d.incremento_menor_6_anios))} por cada hijo menor de 6 años${d.incremento_6_a_15_anios ? ` y ${esc(e2(d.incremento_6_a_15_anios))} por cada uno de 6 a 15` : ""}.</p>${norma(d)}
    <p>Las familias numerosas tienen además el porcentaje incrementado en vivienda: alquiler, ${esc(pctTipo(a.colectivo_especial.porcentaje))} con un máximo de ${esc(e2(a.colectivo_especial.limite))} (frente al ${esc(pctTipo(a.general.porcentaje))} y ${esc(e2(a.general.limite))}); compra, ${esc(pctTipo(q.colectivo_especial.porcentaje))} con ${esc(e2(q.colectivo_especial.limite_anual))} al año (frente al ${esc(pctTipo(q.general.porcentaje))} y ${esc(e2(q.general.limite_anual))}).</p>${norma(a)}`;
  } else {
    const d = J.minimo_familiar_deduccion.descendientes, r = J.minimo_familiar_deduccion.incremento_rentas_descendientes;
    importes = `<p>Deducción por mínimo familiar, por cada hijo: ${["1", "2", "3", "4", "5", "6+"].map((k, i) => `${esc(e2(d.importes[k]))} el ${["primero", "segundo", "tercero", "cuarto", "quinto", "sexto y siguientes"][i]}`).join(", ")}. Se suman ${esc(e2(d.incremento_menor_3_anios))} por cada hijo menor de 3 años.</p>
    <p>Esos importes aumentan un ${r.porcentaje_maximo} % si las rentas del contribuyente no superan ${esc(e2(r.umbral_pleno))}, y el aumento se reduce hasta desaparecer en ${esc(e2(r.umbral_final))}.</p>${norma(J.minimo_familiar_deduccion)}`;
  }
  const s40 = pareja(40000, [], "no"), c40 = pareja(40000, [10, 7, 3], "general");
  const qs = [
    [`¿Cuánto ahorra una familia numerosa en el IRPF de ${n}?`, `Con un sueldo de 40.000 € y tres hijos de 10, 7 y 3 años, la cuota baja de ${e2(s40)} a ${e2(c40)}: ${e2(s40 - c40)} menos al año que la misma pareja sin hijos.`],
    [`¿Cómo cuentan los hijos en el IRPF de ${n}?`, esPv(t) ? "Como deducción en la cuota, con un importe fijo por hijo que crece con el orden, no como mínimo que reduce la base. Vale lo mismo para cualquier nivel de renta." : "Como deducción en la cuota (mínimo familiar), con un importe por hijo que crece con el orden y que aumenta para las rentas más bajas."],
    ["¿Se reparte la deducción entre los dos progenitores?", "Sí. Si los dos declaran por separado, cada uno aplica la mitad de la deducción por los hijos comunes; en declaración conjunta se aplica entera."],
    ["¿Conviene la declaración conjunta?", `Depende de los ingresos de cada uno. La calculadora prueba las dos formas y te muestra la más barata en ${n}.`]
  ];
  const cuerpo = `
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">IRPF de una familia numerosa en ${esc(n)} (${ej})</h2>
    <p class="ayuda">Supuesto: pareja con un solo sueldo, en la forma de tributación más favorable. Tres hijos de 10, 7 y 3 años (categoría general) o cinco de 14, 11, 9, 6 y 2 (especial).</p>
    ${tabla([["Sueldo bruto"], ["Sin hijos", 1], ["Con 3 hijos", 1], ["Ahorro", 1], ["Con 5 hijos", 1]], filas)}</div>
  <div class="tarjeta"><h2 class="rotulo">Qué deduce cada hijo en ${esc(n)}</h2>${importes}</div>
  ${cta("Calcula el IRPF de tu familia", "/index.html#calculadora", ["Compara con otros territorios", "/index.html#comparar"])}`;
  return pagina(P, t, "familia-numerosa", { h1: `Familia numerosa en el IRPF de ${n} (${ej})`,
    entradilla: `Cuánto baja el IRPF con tres o más hijos en ${esc(n)}: deducciones por descendientes de la normativa foral y ejemplos por sueldo. Con 40.000 € y tres hijos, <b>${esc(e2(s40 - c40))}</b> menos al año.`,
    cuerpo, qs, title: `Familia numerosa IRPF ${n} ${ej}: deducciones por hijos`,
    description: `Deducciones del IRPF por hijos y familia numerosa en ${n} (${ej}), con importes por hijo y tabla de ahorro por sueldo. Calculadora gratuita.` }, generado);
}

// ---- 5. discapacidad ----------------------------------------------------------------------
function pDiscapacidad(P, t, generado) {
  const n = nombreDe(P, t), J = juris(P, t), ej = P.ejercicio;
  const caso = (b, disc, mas = {}) => irpf(P, t, [asalariado(P, b, Object.assign(disc ? { discapacidad: disc } : {}, mas))]).irpf;
  const filas = [20000, 26000, 32000, 40000, 55000].map(b => { const s = caso(b), a = caso(b, "33_64"), c = caso(b, "65_mas");
    return fila([[esc(e2(b))], [esc(e2(s)), 1], [esc(e2(a)), 1], [esc(e2(c)), 1], [esc(e2(s - c)), 1]]); });
  let importes;
  if (esPv(t)) {
    const d = J.deduccion_discapacidad, b = J.bonificacion_trabajo;
    importes = `<p>Deducción en la cuota por discapacidad o dependencia, propia o de un familiar a cargo: <b>${esc(e2(d.grado_33_64))}</b> con un grado del 33 % al 64 %; <b>${esc(e2(d.grado_65_mas_o_dependencia_moderada))}</b> desde el 65 % o con dependencia moderada; <b>${esc(e2(d.grado_75_15_39_puntos_o_dependencia_severa))}</b> desde el 75 % con 15 a 39 puntos de ayuda de tercera persona o dependencia severa; <b>${esc(e2(d.grado_75_40_puntos_o_gran_dependencia))}</b> desde el 75 % con 40 puntos o más o gran dependencia.</p>${norma(d)}
    <p>Los trabajadores en activo con discapacidad tienen además la bonificación del trabajo incrementada: un ${100 * b.incremento_discapacidad_33_64} % más con un grado del 33 % al 64 % y un ${100 * b.incremento_discapacidad_65_o_movilidad} % más desde el 65 % o con movilidad reducida.</p>${norma(b)}`;
  } else {
    const mp = J.minimo_personal_deduccion, f = J.minimo_familiar_deduccion.descendientes, dt = J.deduccion_trabajo_cuota;
    importes = `<p>La deducción por mínimo personal sube <b>${esc(e2(mp.incremento_discapacidad_33_64))}</b> con un grado del 33 % al 64 % y <b>${esc(e2(mp.incremento_discapacidad_65_mas))}</b> desde el 65 %.</p>${norma(mp)}
    <p>Por cada descendiente o ascendiente a cargo con discapacidad: ${esc(e2(f.incremento_discapacidad_33_64))} o ${esc(e2(f.incremento_discapacidad_65_mas))}, según el grado.</p>
    <p>La deducción por rendimientos del trabajo aumenta un ${100 * dt.incremento_discapacidad_33_64} % para los trabajadores en activo con un grado del 33 % al 64 % y un ${100 * dt.incremento_discapacidad_65_mas} % desde el 65 %.</p>`;
  }
  const s = caso(26000), a = caso(26000, "33_64");
  const qs = [
    [`¿Cuánto baja el IRPF por discapacidad en ${n}?`, `Con 26.000 € de sueldo, una persona con un grado del 33 % paga ${e2(a)} en lugar de ${e2(s)}: ${e2(s - a)} menos al año en ${ej}.`],
    ["¿Qué grado de discapacidad hace falta?", "Desde el 33 %, reconocido por el órgano competente. Los importes suben desde el 65 % y con la necesidad de ayuda de tercera persona o la dependencia reconocida."],
    ["¿Puedo deducir por un familiar con discapacidad?", `Sí, por los descendientes y ascendientes a tu cargo que convivan contigo y tengan rentas bajas. En ${n} es una deducción en la cuota${esPv(t) ? ", con los mismos importes que la propia" : " que se suma al mínimo familiar"}.`],
    ["¿Las pensiones por incapacidad tributan?", "Las de incapacidad permanente absoluta y gran invalidez están exentas. Las de incapacidad permanente total tributan como rendimiento del trabajo."]
  ];
  const cuerpo = `
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">IRPF con y sin discapacidad en ${esc(n)} (${ej})</h2>
    <p class="ayuda">Supuesto: persona soltera de 40 años, sin hijos, solo con su sueldo.</p>
    ${tabla([["Sueldo bruto"], ["Sin discapacidad", 1], ["Grado 33-64 %", 1], ["Grado 65 % o más", 1], ["Ahorro (65 %)", 1]], filas)}</div>
  <div class="tarjeta"><h2 class="rotulo">Qué reconoce la normativa de ${esc(n)}</h2>${importes}</div>
  ${cta("Calcula tu IRPF con discapacidad", "/index.html#calculadora", ["Compara con otros territorios", "/index.html#comparar"])}`;
  return pagina(P, t, "discapacidad", { h1: `Discapacidad en el IRPF de ${n} (${ej})`,
    entradilla: `Deducciones por discapacidad y dependencia en ${esc(n)}, propias y de familiares, con ejemplos por sueldo. Con 26.000 € y un grado del 33 %, <b>${esc(e2(s - a))}</b> menos de IRPF al año.`,
    cuerpo, qs, title: `IRPF y discapacidad en ${n} ${ej}: deducciones y ahorro`,
    description: `Deducciones del IRPF por discapacidad y dependencia en ${n} (${ej}): importes por grado, familiares a cargo y tabla de ahorro por sueldo. Calculadora gratuita.` }, generado);
}

// ---- 6. planes de pensiones y EPSV ------------------------------------------------------
function pPlanes(P, t, generado) {
  const n = nombreDe(P, t), J = juris(P, t), ej = P.ejercicio, rs = J.reduccion_prevision_social, pc = J.prestaciones_prevision_capital;
  const prod = esPv(t) ? "EPSV o plan de pensiones" : "plan de pensiones";
  const ahorro = (b, ap) => irpf(P, t, [asalariado(P, b)]).irpf - irpf(P, t, [asalariado(P, b, { previsionSocial: { aportacionIndividual: ap } })]).irpf;
  const APS = esPv(t) ? [1500, 3000, 5000] : [500, 1000, 1500];
  const filas = [25000, 35000, 50000, 70000].map(b => fila([[esc(e2(b))], ...APS.map(a => [esc(e2(ahorro(b, a))), 1])]));
  const PL = [[40000], [80000], [150000]];
  const resc = PL.map(([tot]) => { const r = motor.rescatePlan({ territorio: t, antes2007: tot / 2, despues2007: tot / 2, otrosIngresos: 18000, tipoOtros: "pension", edad: 65, anioContingencia: P.ejercicio, anios: 5 }, P);
    return fila([[esc(e2(tot))], [esc(e2(r.capital.extra)), 1], [esc(e2(r.mixto.extra)), 1], [esc(e2(r.renta.extra)), 1], [esc({ capital: "de una vez", mixto: "mixto", renta: "como renta" }[r.mejor])]]); });
  const limites = esPv(t)
    ? `<p>Puedes reducir de la base hasta <b>${esc(e2(rs.limite_individual_no_empleo))}</b> al año por tus aportaciones y hasta <b>${esc(e2(rs.limite_individual_empleo))}</b> por las contribuciones de tu empresa, con un máximo conjunto de <b>${esc(e2(rs.limite_conjunto))}</b>. No hay límite porcentual sobre tus rendimientos. Las aportaciones a favor del cónyuge con rentas inferiores a ${esc(e2(rs.rentas_conyuge_maximas))} reducen hasta ${esc(e2(rs.limite_aportacion_conyuge))} más.</p>${norma(rs)}`
    : `<p>Puedes reducir de la base el menor de dos límites: el ${100 * rs.limite_pct_rend} % de tus rendimientos netos del trabajo y de actividades (${100 * rs.limite_pct_rend_incrementado} % si tienes más de ${rs.edad_porcentaje_incrementado} años) y <b>${esc(e2(rs.limite_general_abs))}</b> al año, que se amplía hasta ${esc(e2(rs.incremento_contribucion_empresarial))} más por las contribuciones de tu empresa. Las aportaciones a favor del cónyuge con rendimientos inferiores a ${esc(e2(rs.rentas_conyuge_maximas))} reducen hasta ${esc(e2(rs.limite_aportacion_conyuge))} más.</p>${norma(rs)}`;
  const rescTxt = esPv(t)
    ? `<p>Lo que cobras es rendimiento del trabajo. El primer cobro en forma de capital por cada contingencia, si han pasado más de dos años desde la primera aportación, se integra al ${100 - 100 * pc.porcentaje_reduccion} %, hasta ${esc(e2(pc.limite))}; el exceso y lo cobrado como renta, al 100 %. Desde 2026 la norma separa aportaciones y rentabilidad, pero lo que procede de aportaciones anteriores a 2026 puede seguir este régimen, que es el de la tabla.</p>${norma(pc)}`
    : `<p>Lo que cobras es rendimiento del trabajo. Cobrado en forma de capital, la parte que corresponde a aportaciones hasta el 31-12-${pc.anio_corte_aportaciones - 1} tiene una reducción del ${100 * pc.porcentaje_reduccion} %, siempre que lo cobres el año de la contingencia o en los ${pc.plazo_anios} siguientes. Lo aportado después y lo cobrado como renta tributa entero.</p>${norma(pc)}`;
  const a1 = ahorro(35000, APS[2]);
  const qs = [
    [`¿Cuánto puedo desgravar por mi ${prod} en ${n}?`, esPv(t) ? `Hasta ${e2(rs.limite_individual_no_empleo)} al año por tus aportaciones y ${e2(rs.limite_individual_empleo)} por las de tu empresa, con un máximo conjunto de ${e2(rs.limite_conjunto)} en ${ej}.` : `Hasta ${e2(rs.limite_general_abs)} al año por tus aportaciones, más hasta ${e2(rs.incremento_contribucion_empresarial)} por las contribuciones de tu empresa, sin superar el ${100 * rs.limite_pct_rend} % de tus rendimientos del trabajo y de actividades (${100 * rs.limite_pct_rend_incrementado} % con más de ${rs.edad_porcentaje_incrementado} años).`],
    [`¿Cuánto IRPF ahorro aportando ${e2(APS[2])}?`, `Con un sueldo de 35.000 € en ${n}, ${e2(a1)} en ${ej}. El ahorro es la aportación por tu tipo marginal: cuanto mayor es el sueldo, más ahorra la misma aportación.`],
    [`¿Cómo tributa el rescate en ${n}?`, esPv(t) ? `Como rendimiento del trabajo. El primer cobro en capital se integra al ${100 - 100 * pc.porcentaje_reduccion} % hasta ${e2(pc.limite)}; lo cobrado como renta, entero.` : `Como rendimiento del trabajo. En capital, lo aportado hasta ${pc.anio_corte_aportaciones - 1} tiene una reducción del ${100 * pc.porcentaje_reduccion} % dentro de plazo; el resto tributa entero.`],
    ["¿Conviene cobrarlo de una vez o como renta?", "Depende del importe y de tus otros ingresos: de una vez aprovecha la reducción pero concentra la renta en un año; repartido baja el tipo de cada año. La calculadora compara las tres formas con tus datos."]
  ];
  const cuerpo = `
  <div class="tarjeta"><h2 class="rotulo">Límites de reducción en ${esc(n)} (${ej})</h2>${limites}</div>
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Cuánto IRPF ahorras con tu aportación</h2>
    <p class="ayuda">Supuesto: persona soltera de 40 años, sin hijos, que aporta por su cuenta. Ahorro de IRPF del año.</p>
    ${tabla([["Sueldo bruto"], ...APS.map(a => [`Aportando ${e2(a)}`, 1])], filas)}</div>
  <div class="tarjeta"><h2 class="rotulo">Cómo tributa el rescate</h2>${rescTxt}</div>
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">IRPF extra por rescatar, según la forma</h2>
    <p class="ayuda">Supuesto: pensión pública de 18.000 € al año, 65 años, jubilación en ${ej}${esPv(t) ? "" : `, la mitad del plan aportada hasta ${pc.anio_corte_aportaciones - 1}`}. Mixto y renta, en 5 años. Suma de lo que sube el IRPF en todos los años.</p>
    ${tabla([["Importe"], ["De una vez", 1], ["Mixto", 1], ["Como renta", 1], ["Menos IRPF"]], resc)}</div>
  ${cta("Calcula tu rescate", `/index.html#rescate-plan?t=${t}`, ["Ahorro por aportar antes del 31-12", "/index.html#plan-pensiones"])}`;
  return pagina(P, t, "planes-pensiones", { h1: esPv(t) ? `EPSV y planes de pensiones en el IRPF de ${n} (${ej})` : `Planes de pensiones en el IRPF de ${n} (${ej})`,
    entradilla: `Cuánto reduce tu ${esc(prod)} la base del IRPF en ${esc(n)} y cuánto tributa al cobrarlo. Aportando ${esc(e2(APS[2]))} con 35.000 € de sueldo ahorras <b>${esc(e2(a1))}</b>.`,
    cuerpo, qs, title: esPv(t) ? `EPSV y plan de pensiones en ${n} ${ej}: límites y rescate` : `Plan de pensiones en ${n} ${ej}: límites y rescate`,
    description: `Límites de reducción por aportaciones a ${esPv(t) ? "EPSV y planes de pensiones" : "planes de pensiones"} en ${n} (${ej}), ahorro por sueldo y tributación del rescate en capital o en renta.` }, generado);
}

// ---- comparativa de los tres territorios vascos -------------------------------------
function pPaisVasco(P, generado) {
  const ej = P.ejercicio, nom = t => nombreDe(P, t);
  const filasNeto = BRUTOS.map(b => fila([[esc(e2(b))], ...PV.map(t => [esc(e2(neto(P, t, b).neto)), 1]), [esc(e2(neto(P, "ES-NC", b).neto)), 1], [esc(e2(neto(P, "ES-MD", b).neto)), 1]]));
  const fam = t => irpf(P, t, [asalariado(P, 40000), { id: "d2", rol: "conyuge", edad: 38 }, ...hijos([8, 4])], { tipoUnidadFamiliar: "biparental" }).irpf;
  const difs = PV.map(t => { const J = juris(P, t); return fila([[`<a href="${ruta(t)}">${esc(nom(t))}</a>`], [esc(e2(J.deduccion_descendientes.importes["1"])), 1], [esc(e2(J.deduccion_descendientes.incremento_menor_6_anios)), 1],
    [esc(e2(J.deduccion_ascendientes.importe)), 1], [esc(e2(J.deduccion_discapacidad.grado_33_64)), 1], [esc(e2(fam(t))), 1]]); });
  const iguales = PV.every(t => neto(P, t, 30000).neto === neto(P, PV[0], 30000).neto);
  const s30 = neto(P, PV[0], 30000);
  const qs = [
    ["¿Es igual el IRPF en Bizkaia, Gipuzkoa y Álava?", "La tarifa, la bonificación del trabajo y la minoración de la cuota coinciden, porque las tres normas forales están armonizadas. Cambian algunas deducciones: Álava tiene importes propios por hijos, ascendientes y discapacidad."],
    ["¿Cuánto es el sueldo neto de 30.000 € en el País Vasco?", `${e2(s30.neto)} al año en ${ej} para una persona soltera sin hijos${iguales ? ", lo mismo en los tres territorios" : " en Bizkaia"}: ${e2(s30.cotizaciones)} de Seguridad Social y ${e2(s30.irpf)} de IRPF.`],
    ["¿Dónde declaro si vivo en el País Vasco?", "Ante la hacienda foral del territorio donde tienes tu residencia habitual: Bizkaia, Gipuzkoa o Álava. Cada una tiene su programa y su calendario de campaña; el de la Agencia Tributaria no sirve."],
    ["¿Y Navarra?", "Navarra tiene su propio IRPF por el convenio económico, con otra tarifa y los mínimos convertidos en deducciones. Está en la tabla como referencia."]
  ];
  const migas = [["Inicio", "/"], ["IRPF por territorio", "/irpf/"], ["País Vasco", null]];
  const main = `
  <h1>IRPF en el País Vasco (${ej}): Bizkaia, Gipuzkoa y Álava, comparados</h1>
  <p class="entradilla">Los tres territorios históricos tienen su propia norma foral del IRPF. Comparten tarifa y estructura, y se diferencian en algunas deducciones. Con 30.000 € brutos, el sueldo neto es de <b>${esc(e2(s30.neto))}</b>.</p>
  <div class="prosa">
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Sueldo neto en el País Vasco, Navarra y Madrid (${ej})</h2>
    <p class="ayuda">Supuesto: persona soltera de 40 años, sin hijos, contrato indefinido. Neto anual tras la Seguridad Social y el IRPF definitivo.</p>
    ${tabla([["Bruto anual"], ...PV.map(t => [nom(t), 1]), ["Navarra", 1], ["Madrid", 1]], filasNeto)}</div>
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">En qué se diferencian los tres territorios</h2>
    <p class="ayuda">Deducciones en la cuota de ${ej}. Última columna: IRPF de una pareja con un sueldo de 40.000 € y dos hijos de 8 y 4 años.</p>
    ${tabla([["Territorio"], ["Primer hijo", 1], ["Hijo menor de 6", 1], ["Ascendiente", 1], ["Discapacidad 33 %", 1], ["Pareja, 2 hijos", 1]], difs)}</div>
  <div class="tarjeta"><h2 class="rotulo">IRPF y renta en cada territorio</h2><ul class="lista-enlaces">${PV.map(t => `<li><b>${esc(nom(t))}</b>: ` +
    [[`IRPF en ${corto(t)}`, ruta(t)], [`renta ${corto(t)} ${ej - 1}`, ruta(t) + "#renta"], [`tablas IRPF ${corto(t)}`, ruta(t) + `#tabla-${ej - 1}`],
      [`simulador renta ${ej} ${corto(t)}`, ruta(t, "simulador-renta")], ...SECCIONES.slice(1).map(([s, tit]) => [minus(tit), ruta(t, s)])]
      .map(([txt, href]) => `<a href="${href}">${esc(txt)}</a>`).join(" · ") + `</li>`).join("")}
    <li><b>Navarra</b>: <a href="${ruta("ES-NC")}">IRPF en Navarra</a> · <a href="${ruta("ES-NC", "simulador-renta")}">simulador renta ${ej} Navarra</a></li></ul></div>
  ${cta("Calcula tu IRPF en el País Vasco", "/index.html#calculadora", ["Compara los 19 territorios", "/index.html#comparar"])}
  ${bloqueFaq(qs)}
  </div>`;
  return { ruta: "/irpf/pais-vasco/", html: layout({ title: `IRPF País Vasco ${ej}: Bizkaia, Gipuzkoa y Álava comparados | Mapafiscal`,
    description: `IRPF y sueldo neto en el País Vasco (${ej}): Bizkaia, Gipuzkoa y Álava comparados entre sí, con Navarra y con Madrid. Diferencias en deducciones y calculadora gratuita.`,
    canonical: "/irpf/pais-vasco/", breadcrumb: migasHtml(migas), main, generado, ejercicio: ej, jsonld: [jsonLdMigas(migas), jsonLdFaq(qs)] }) };
}

// Bloque de enlaces para la página /irpf/<territorio>/ (vacío si no es foral)
export function enlacesSuiteForal(codigo, nombre) {
  if (!FORALES.includes(codigo)) return "";
  const ej = paramsDefecto().ejercicio;
  return `<div class="tarjeta"><h2 class="rotulo">${esc(nombre)}, a fondo</h2><ul class="lista-enlaces">` +
    SECCIONES.map(([s, tit]) => `<li><a href="${ruta(codigo, s)}">${esc(s === "simulador-renta" ? `Simulador renta ${ej} ${corto(codigo)}` : `${tit} en ${nombre}`)}</a></li>`).join("") +
    (codigo !== "ES-NC" ? `<li><a href="/irpf/pais-vasco/">Bizkaia, Gipuzkoa y Álava, comparados</a></li>` : "") + `</ul></div>`;
}

// [{ ruta, html }]: seis páginas por territorio foral y la comparativa del País Vasco.
// `importesSueldoNeto`: importes con página /sueldo-neto/<importe>/<territorio>/ (para enlazarlas).
export function paginasForal(generado, importesSueldoNeto = []) {
  const P = paramsDefecto(), con = new Set(importesSueldoNeto.map(Number));
  const out = [];
  for (const t of FORALES) out.push(pSimulador(P, t, generado), pSueldoNeto(P, t, generado, con), pJubilados(P, t, generado),
    pFamiliaNumerosa(P, t, generado), pDiscapacidad(P, t, generado), pPlanes(P, t, generado));
  out.push(pPaisVasco(P, generado));
  return out;
}

// ---- piezas de la página /irpf/<foral>/ (tablas IRPF) -------------------------------------
const BOLETIN = { "ES-PV-BI": "Boletín Oficial de Bizkaia (BOB)", "ES-PV-SS": "Boletín Oficial de Gipuzkoa (BOG)",
  "ES-PV-VI": "Boletín Oficial del Territorio Histórico de Álava (BOTHA)", "ES-NC": "Boletín Oficial de Navarra (BON)" };
const CLAVE_NORMA = { "ES-PV-BI": /Bizkaia/, "ES-PV-SS": /Gipuzkoa/, "ES-PV-VI": /Araba/ };
// De una cita conjunta de los tres territorios, la parte del territorio (o la cita entera).
export function normaDelTerritorio(t, norma) {
  if (!CLAVE_NORMA[t]) return norma;
  const parte = String(norma).split(/ \/ |(?<=\)), (?=art)|(?<=\)) y (?=art)/i).find(p => CLAVE_NORMA[t].test(p));
  return parte ? parte.replace(/^a/, "A") : norma;
}
function paramsDe(ej) {
  for (const n of readdirSync(join(WEB, "datos")).filter(n => /^params(_\d{4})?\.json$/.test(n))) {
    const P = JSON.parse(readFileSync(join(WEB, "datos", n), "utf8"));
    if (P.ejercicio === ej) return P;
  }
  return null;
}
// Escala del ahorro de cada ejercicio publicado: [{ ejercicio, tramos }] (solo los que existan).
export function escalasAhorro(t, ejercicios) {
  return ejercicios.map(ej => { const P = paramsDe(ej); const tr = P && juris(P, t).escala_ahorro_foral;
    return tr && tr.length ? { ejercicio: ej, tramos: tr } : null; }).filter(Boolean);
}
// Ejemplo paso a paso con el motor: sueldo bruto, cotizaciones, base, cuota por tramos,
// minoración o deducciones y cuota líquida. null si no hay parámetros o la suma no cuadra.
export function ejemploPasoAPaso(t, ej, bruto) {
  const P = paramsDe(ej);
  if (!P) return null;
  const { liq } = irpf(P, t, [asalariado(P, bruto)]);
  const J = juris(P, t), base = liq.baseLiquidableGeneral;
  let previo = 0;
  const tramos = [];
  for (const tr of J.escala_general_foral) {
    const hasta = tr.hasta == null ? Infinity : tr.hasta;
    if (base <= previo) break;
    const parte = Math.min(base, hasta) - previo;
    tramos.push({ desde: previo, hasta: Math.min(base, hasta), parte, tipo: tr.tipo, cuota: parte * tr.tipo });
    previo = hasta;
  }
  const suma = tramos.reduce((a, x) => a + x.cuota, 0);
  if (Math.abs(suma - liq.cuotaIntegraTotal) > 0.01) return null;
  const c = liq.componentesRenta;
  const cot = motor.cotizacionesTrabajador(bruto, P);
  const restas = [];
  if (liq.minoracionCuota) restas.push(["Minoración general de la cuota", liq.minoracionCuota]);
  const det = (liq.deduccionesAutonomicas && liq.deduccionesAutonomicas.detalle) || {};
  const NOM = { minimoPersonal: "Deducción por mínimo personal", minimoFamiliar: "Deducción por mínimo familiar", trabajo: "Deducción por rendimientos del trabajo" };
  for (const [k, v] of Object.entries(det)) if (v) restas.push([NOM[k] || k, v]);
  const sumaRestas = restas.reduce((a, [, v]) => a + v, 0);
  if (Math.abs(liq.cuotaIntegraTotal - sumaRestas - liq.cuotaLiquidaTotal) > 0.01) return null;
  return { ejercicio: ej, bruto, cotizaciones: cot, trabajoPrevio: c.trabajoPrevio, reduccionTrabajo: c.reduccionTrabajo,
    base, tramos, cuotaIntegra: liq.cuotaIntegraTotal, restas, cuotaLiquida: liq.cuotaLiquidaTotal, esPv: esPv(t) };
}
export { rasgoForal as rasgoForalDe, paramsDe as paramsForal };
// Enlaces entre las páginas de tablas de los tres territorios vascos y la comparativa.
export function enlacesVascos(codigo) {
  if (!PV.includes(codigo)) return "";
  const ej = paramsDefecto().ejercicio;
  // ancla distinta según el par de territorios: «Tablas IRPF Bizkaia», «IRPF en Álava», «Renta Gipuzkoa 2025»
  const ancla = t => [`Tablas IRPF ${corto(t)}`, `IRPF en ${corto(t)}`, `Renta ${corto(t)} ${ej - 1}`][(PV.indexOf(codigo) + PV.indexOf(t)) % 3];
  return `<div class="tarjeta"><h2 class="rotulo">Tablas del IRPF en los otros territorios vascos</h2><ul class="lista-enlaces">` +
    PV.filter(t => t !== codigo).map(t => `<li><a href="${ruta(t)}">${esc(ancla(t))}</a></li>`).join("") +
    `<li><a href="/irpf/pais-vasco/">IRPF en el País Vasco: Bizkaia, Gipuzkoa y Álava, comparados</a></li></ul></div>`;
}
export { BOLETIN };

// Tarjeta del índice /irpf/: los cuatro territorios forales, con anclas distintas para la página
// principal (IRPF, renta, tablas), el simulador y las deducciones (si tienen página).
export function enlacesIndiceForal(conDeducciones = new Set()) {
  const ej = paramsDefecto().ejercicio;
  return `<div class="tarjeta"><h2 class="rotulo">IRPF y renta en los territorios forales</h2><ul class="lista-enlaces">` + FORALES.map(t => { const c = corto(t);
    return `<li><b>${esc(c)}</b>: ` + [[`IRPF en ${c}`, ruta(t)], [`renta ${c} ${ej - 1}`, ruta(t) + "#renta"], [`tablas IRPF ${c} ${ej - 1}`, ruta(t) + `#tabla-${ej - 1}`],
      [`simulador renta ${ej} ${c}`, ruta(t, "simulador-renta")], conDeducciones.has(t) && [`deducciones forales`, ruta(t) + "deducciones/"]].filter(Boolean)
      .map(([txt, href]) => `<a href="${href}">${esc(txt)}</a>`).join(" · ") + `</li>`; }).join("") +
    `</ul><p><a href="/irpf/pais-vasco/">Bizkaia, Gipuzkoa y Álava, comparados</a></p></div>`;
}

// ---- «La renta en <territorio>» y tipos por sueldo (página /irpf/<foral>/) ----------------
// Quién gestiona el impuesto, cómo se presenta y qué lo distingue, con los importes de params y
// la norma foral que ya citan; una tabla de tipo marginal y tipo medio por sueldo calculada con
// el motor JS para cada ejercicio publicado, y las preguntas frecuentes que responden a ambas.
// `referencias`: { <ejercicio>: { <bruto>: cuota líquida } } de seo_comparativas.json (motor R);
// el ejercicio cuyas cifras no cuadren al céntimo con el motor JS se deja fuera de la tabla.
const SUELDOS_TIPOS = [20000, 30000, 40000, 60000, 100000];
export function rentaForal(t, { referencias = {}, conDeducciones = false } = {}) {
  if (!FORALES.includes(t)) return null;
  const PD = paramsDefecto(), ejD = PD.ejercicio, n = nombreDe(PD, t), c = corto(t);
  const datos = publicados(PD).sort((a, b) => a - b).map(a => {
    const P = paramsDe(a);
    if (!P) return null;
    const J = juris(P, t);
    const filas = SUELDOS_TIPOS.map(b => { const x = irpf(P, t, [asalariado(P, b)]), base = x.liq.baseLiquidableGeneral;
      return { b, irpf: x.irpf, cuota: x.liq.cuotaLiquidaTotal, medio: x.irpf / b, marginal: motor.tipoMarginal(base, J.escala_general_foral) }; });
    const ref = referencias[a];
    if (ref && filas.some(f => ref[f.b] != null && Math.abs(ref[f.b] - f.cuota) > 0.005)) return null;
    return { ej: a, P, J, filas };
  }).filter(Boolean);
  const D = datos.find(d => d.ej === ejD) || datos[datos.length - 1];
  if (!D) return null;
  const A = datos.find(d => d.ej === D.ej - 1) || null;
  const tr = D.J.escala_general_foral, tMin = tr[0].tipo, tMax = tr[tr.length - 1].tipo;
  const f = b => D.filas.find(x => x.b === b);
  const ex = (b, d = D) => d.filas.find(x => x.b === b);

  // Qué distingue la renta del territorio: importes de params del ejercicio por defecto y del anterior.
  let distingue, normaDist, faqDist;
  if (esPv(t)) {
    const m = minoracion(D.J, t), mA = A && minoracion(A.J, t);
    const dd = D.J.deduccion_descendientes, al = D.J.deduccion_alquiler_vivienda.general;
    distingue = `${rasgoForal(D.P, t)} Son importes de ${D.ej}${A ? (mA === m ? `; la minoración es la misma que en ${A.ej}` : `; en ${A.ej} la minoración era de ${esc(e2(mA))}`) : ""}.`;
    normaDist = D.J.minoracion_cuota.norma;
    faqDist = [
      [`¿Qué es la minoración de cuota en el IRPF de ${c}?`, `Una cantidad fija que se resta de la cuota íntegra de cada declaración: ${e2(m)} en ${D.ej}${A ? (mA === m ? `, igual que en ${A.ej}` : ` y ${e2(mA)} en ${A.ej}`) : ""}. Hace el papel del mínimo personal del régimen común: en vez de dejar sin gravar una parte de la base, rebaja directamente el impuesto. Norma: ${normaDelTerritorio(t, normaDist)}.`],
      [`¿Qué deducciones forales tiene la renta de ${c}?`, `Entre otras, por descendientes (${e2(dd.importes["1"])} el primer hijo en ${D.ej}, más ${e2(dd.incremento_menor_6_anios)} si es menor de 6 años), por ascendientes a cargo (${e2(D.J.deduccion_ascendientes.importe)}), por edad desde los 65 años (${e2(D.J.deduccion_edad.individual.edad_65.importe)}), por discapacidad (desde ${e2(D.J.deduccion_discapacidad.grado_33_64)}) y por alquiler de la vivienda habitual (el ${pctTipo(al.porcentaje)} de lo pagado, hasta ${e2(al.limite)} al año).${conDeducciones ? ` Están todas en la página de deducciones de ${c}.` : ""}`]
    ];
  } else {
    const mp = D.J.minimo_personal_deduccion, mpA = A && A.J.minimo_personal_deduccion;
    const d1 = D.J.minimo_familiar_deduccion.descendientes.importes["1"], al = D.J.deduccion_alquiler_vivienda.general;
    distingue = `${rasgoForal(D.P, t)} Son importes de ${D.ej}${A ? (mpA.importe_general === mp.importe_general ? `; la deducción por mínimo personal es la misma que en ${A.ej}` : `; en ${A.ej} la deducción por mínimo personal era de ${esc(e2(mpA.importe_general))}`) : ""}.`;
    normaDist = mp.norma;
    faqDist = [
      [`¿Qué tiene de propio la renta de ${c}?`, `${c} no reduce la base con el mínimo personal y familiar: lo convierte en deducciones de la cuota. En ${D.ej} son ${e2(mp.importe_general)} por contribuyente y ${e2(d1)} por el primer hijo, con incrementos por rentas bajas, edad y discapacidad. Norma: ${normaDist}.`],
      [`¿Qué deducciones forales tiene la renta de ${c}?`, `Entre otras, por mínimo personal y familiar, por rendimientos del trabajo, por pensiones de jubilación bajas y por alquiler de la vivienda habitual (el ${pctTipo(al.porcentaje)} de lo pagado, hasta ${e2(al.limite)} al año, con límite de rentas).${conDeducciones ? ` Están todas en la página de deducciones de ${c}.` : ""}`]
    ];
  }
  const enlaceDed = conDeducciones ? ` <a href="${ruta(t)}deducciones/">Deducciones forales de ${esc(c)}</a>.` : "";
  const cartaRenta = `<div class="tarjeta" id="renta">
    <h2 class="rotulo">La renta en ${esc(c)}</h2>
    <p><b>Quién la gestiona.</b> ${esc(mayus(INSTITUCION[t]))}, a través de su Hacienda Foral. Por ${esc(ACUERDO(t))}, ${esc(n)} regula y recauda su propio IRPF con ${esc(conNorma(t))}: quien tiene aquí su residencia habitual declara ante ${esc(HACIENDA[t])} y no ante la Agencia Tributaria.</p>
    <p><b>Cómo se presenta.</b> Con el programa y en el calendario de campaña de ${esc(HACIENDA[t])}; el borrador y Renta Web de la Agencia Tributaria no sirven en ${esc(c)}.${A ? ` La renta de ${A.ej} es la que se declara en ${A.ej + 1};` : ""} la de ${D.ej}, en ${D.ej + 1}. Puedes calcularla antes con el <a href="${ruta(t, "simulador-renta")}">simulador de la renta ${D.ej} de ${esc(c)}</a>${A ? `, que también tiene la de ${A.ej}` : ""}.</p>
    <p><b>Qué la distingue.</b> ${distingue}${enlaceDed}</p>
    <p class="ayuda">Norma: ${esc(normaDelTerritorio(t, normaDist))}.</p>
  </div>`;

  const cab = [["Sueldo bruto"], ...datos.flatMap(d => [[`IRPF ${d.ej}`, 1], [`Tipo medio sobre el bruto ${d.ej}`, 1], [`Tipo marginal ${d.ej}`, 1]])];
  const filasT = SUELDOS_TIPOS.map(b => fila([[esc(e2(b))], ...datos.flatMap(d => { const x = ex(b, d);
    return [[esc(e2(x.irpf)), 1], [esc(pctMedio(x.medio)), 1], [esc(pctTipo(x.marginal)), 1]]; })]));
  const cartaTipos = `<div class="tarjeta tarjeta-tabla" id="tipos-por-sueldo">
    <h2 class="rotulo">Tipo marginal y tipo medio del IRPF en ${esc(c)} por sueldo</h2>
    <p class="ayuda">Persona soltera de 40 años, sin hijos, con un solo sueldo y contrato indefinido; IRPF del año tras la declaración, calculado con el mismo motor que la calculadora. Tipo medio sobre el sueldo bruto: IRPF entre el sueldo bruto, la misma medida que la comparativa con los otros territorios de más abajo. Tipo marginal: el de la tarifa foral en el último euro de la base liquidable.</p>
    ${tabla(cab, filasT, `Tipo marginal y tipo medio del IRPF en ${c} por sueldo`)}
  </div>`;

  const f30 = f(30000), f60 = f(60000);
  const faq = [
    [`¿Quién gestiona la renta y la fiscalidad de ${c}?`, `${mayus(INSTITUCION[t])}, a través de su Hacienda Foral. Por ${ACUERDO(t)}, ${n} regula y recauda su propio IRPF con ${conNorma(t)}. Quien reside en ${c} declara ante ${HACIENDA[t]}, no ante la Agencia Tributaria.`],
    [`¿Cómo se presenta la declaración de la renta ${A ? A.ej : D.ej} en ${c}?`, `Ante ${HACIENDA[t]}, con su programa y su calendario de campaña; el borrador y Renta Web de la Agencia Tributaria no sirven en ${c}. La renta de ${A ? A.ej : D.ej} se declara en ${(A ? A.ej : D.ej) + 1}. Antes de presentarla puedes simularla en Mapafiscal con la normativa foral de ese año.`],
    [`¿Cuál es el tipo marginal del IRPF en ${c}?`, `El de la tarifa foral, del ${pctTipo(tMin)} al ${pctTipo(tMax)} según la base liquidable. En ${D.ej}, con 30.000 € brutos el último euro tributa al ${pctTipo(f30.marginal)} y el tipo medio es del ${pctMedio(f30.medio)} del sueldo; con 60.000 €, al ${pctTipo(f60.marginal)} y del ${pctMedio(f60.medio)}.`],
    ...faqDist
  ];
  return {
    cartas: cartaRenta + cartaTipos, faq,
    indice: [["renta", `La renta en ${c}`], ["tipos-por-sueldo", "Tipo marginal y medio por sueldo"]]
  };
}
