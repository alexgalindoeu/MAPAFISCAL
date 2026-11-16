// =============================================================================
// Suite foral: páginas SEO de Bizkaia, Gipuzkoa, Araba/Álava y Navarra.
//   /irpf/<foral>/simulador-renta/   /irpf/<foral>/sueldo-neto/   /irpf/<foral>/jubilados/
//   /irpf/<foral>/familia-numerosa/  /irpf/<foral>/discapacidad/  /irpf/<foral>/planes-pensiones/
//   /irpf/pais-vasco/  (comparativa de los tres territorios históricos)
// Todas las cifras salen del motor JS (web/js/irpfsim.js, con paridad al céntimo con el
// motor R en tools/validar_js.R) y de los parámetros exportados (web/datos/params_<año>.json):
// aquí no se escribe ningún importe a mano. Lo usa tools/generar_paginas_seo.mjs.
// =============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SLUG, esc, euros, pct, pctCorto, tablaEscala, layout, jsonLdMigas, jsonLdFaq, bloqueFaq, migasHtml } from "./seo_comun.mjs";

const require = createRequire(import.meta.url);
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const motor = require(join(WEB, "js", "irpfsim.js"));

export const FORALES = ["ES-PV-BI", "ES-PV-SS", "ES-PV-VI", "ES-NC"];
const PV = ["ES-PV-BI", "ES-PV-SS", "ES-PV-VI"];
const HACIENDA = { "ES-PV-BI": "la Hacienda Foral de Bizkaia", "ES-PV-SS": "la Hacienda Foral de Gipuzkoa",
  "ES-PV-VI": "la Hacienda Foral de Álava", "ES-NC": "la Hacienda Foral de Navarra" };
const NORMA = { "ES-PV-BI": "Norma Foral 13/2013, del IRPF de Bizkaia", "ES-PV-SS": "Norma Foral 3/2014, del IRPF de Gipuzkoa",
  "ES-PV-VI": "Norma Foral 33/2013, del IRPF de Álava", "ES-NC": "Texto Refundido de la Ley Foral del IRPF de Navarra (DFL 4/2008)" };
export const SECCIONES = [
  ["simulador-renta", "Simulador de la renta"], ["sueldo-neto", "Sueldo neto"], ["jubilados", "Jubilados y pensionistas"],
  ["familia-numerosa", "Familia numerosa"], ["discapacidad", "Discapacidad"], ["planes-pensiones", "Planes de pensiones y EPSV"]
];
const BRUTOS = [18000, 22000, 26000, 30000, 36000, 45000, 60000, 80000];

function paramsRecientes() {
  return readdirSync(join(WEB, "datos")).filter(n => /^params(_\d{4})?\.json$/.test(n))
    .map(n => JSON.parse(readFileSync(join(WEB, "datos", n), "utf8"))).sort((a, b) => b.ejercicio - a.ejercicio)[0];
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
const tabla = (cab, filas) => `<div class="envoltorio"><table class="cobertura"><thead><tr>${cab.map(([c, n]) => `<th${n ? ' class="num"' : ""}>${esc(c)}</th>`).join("")}</tr></thead><tbody>${filas.join("")}</tbody></table></div>`;
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
function otrasSecciones(P, t, actual) {
  const n = nombreDe(P, t);
  return `<p class="ayuda">Más sobre el IRPF en ${esc(n)}: ` + [[null, "tramos y resumen"], ...SECCIONES].filter(([s]) => s !== actual)
    .map(([s, tit]) => `<a href="${ruta(t, s)}">${esc(minus(tit))}</a>`).join(" · ") +
    (esPv(t) ? ` · <a href="/irpf/pais-vasco/">los tres territorios vascos, comparados</a>` : "") + `</p>`;
}
function rasgoForal(P, t) {
  const n = nombreDe(P, t), J = juris(P, t);
  if (esPv(t)) {
    const m = J.minoracion_cuota, imp = t === "ES-PV-BI" ? m.importe_bizkaia : t === "ES-PV-VI" ? m.importe_araba : m.importe_gipuzkoa;
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
  return { ruta: r, html: layout({ title: `${title} | Mapafiscal`, description, canonical: r, breadcrumb: migasHtml(migas), main, generado,
    jsonld: [jsonLdMigas(migas), jsonLdFaq(qs)] }) };
}

// ---- 1. simulador de la renta -----------------------------------------------------------
function pSimulador(P, t, generado) {
  const n = nombreDe(P, t), J = juris(P, t), ej = P.ejercicio;
  const filas = BRUTOS.map(b => { const x = irpf(P, t, [asalariado(P, b)]);
    return fila([[esc(e2(b))], [esc(e2(x.liq.baseLiquidableGeneral)), 1], [esc(e2(x.irpf)), 1], [esc(pct(x.irpf / b)), 1]]); });
  const ej30 = irpf(P, t, [asalariado(P, 30000)]).irpf;
  const qs = [
    [`¿Puedo hacer la renta de ${n} con el programa de la Agencia Tributaria?`, `No. Si resides en ${n} declaras ante ${HACIENDA[t]}, con su propia normativa, su propio programa y su propio calendario de campaña. Renta Web y el borrador de la Agencia Tributaria solo sirven para el régimen común.`],
    [`¿Qué calcula este simulador para ${n}?`, `La cuota del IRPF de ${ej} con la tarifa foral de ${n}, sus reducciones y sus deducciones familiares y personales. Introduces tus ingresos, tu familia y tus gastos, y ves el resultado con el desglose paso a paso.`],
    [`¿En qué se diferencia el IRPF de ${n} del resto de España?`, rasgoForal(P, t).replace(/&[a-z#0-9]+;/g, " ")],
    ["¿Puedo comparar mi resultado con otros territorios?", `Sí: el comparador calcula el mismo caso en los 19 territorios fiscales, los cuatro forales incluidos. Si asesoras a clientes, puedes comparar a cada uno con un clic.`]
  ];
  const cuerpo = `
  <div class="tarjeta"><h2 class="rotulo">Cómo se calcula la renta en ${esc(n)}</h2><p>${rasgoForal(P, t)}</p>
    <p>La declaración se presenta ante ${esc(HACIENDA[t])}, con calendario y programa propios. Aquí puedes simularla antes: el resultado sale de la misma normativa (${esc(NORMA[t])}).</p></div>
  <div class="tarjeta"><h2 class="rotulo">Tarifa general de ${esc(n)} (${ej})</h2>${tablaEscala(J.escala_general_foral, "Tramo de la base liquidable general")}</div>
  <div class="tarjeta tarjeta-tabla"><h2 class="rotulo">Cuánto IRPF sale con tu sueldo en ${esc(n)}</h2>
    <p class="ayuda">Supuesto: persona soltera de 40 años, sin hijos, solo con su sueldo, contrato indefinido. IRPF del año tras la declaración.</p>
    ${tabla([["Sueldo bruto"], ["Base liquidable", 1], ["IRPF", 1], ["Tipo medio", 1]], filas)}</div>
  ${cta(`Simula tu renta de ${n}`, "/index.html#calculadora", ["Compárala con los otros 18 territorios", "/index.html#comparar"])}`;
  return pagina(P, t, "simulador-renta", { h1: `Simulador de la renta en ${n} (${ej})`,
    entradilla: `Calcula tu IRPF de ${esc(n)} con su normativa foral: tarifa, reducciones y deducciones propias. Con 30.000 € de sueldo, una persona soltera paga <b>${esc(e2(ej30))}</b> al año.`,
    cuerpo, qs, title: `Simulador renta ${n} ${ej}: calcula tu IRPF foral`,
    description: `Simulador gratuito de la declaración de la renta en ${n} (${ej}) con la tarifa y las deducciones forales. Tabla de IRPF por sueldo y comparador con los otros 18 territorios.` }, generado);
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
    <p>Las familias numerosas tienen además el porcentaje incrementado en vivienda: alquiler, ${esc(pctCorto(a.colectivo_especial.porcentaje))} con un máximo de ${esc(e2(a.colectivo_especial.limite))} (frente al ${esc(pctCorto(a.general.porcentaje))} y ${esc(e2(a.general.limite))}); compra, ${esc(pctCorto(q.colectivo_especial.porcentaje))} con ${esc(e2(q.colectivo_especial.limite_anual))} al año (frente al ${esc(pctCorto(q.general.porcentaje))} y ${esc(e2(q.general.limite_anual))}).</p>${norma(a)}`;
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
  <div class="tarjeta"><h2 class="rotulo">Por territorio</h2><ul class="lista-enlaces">${PV.map(t => `<li><b>${esc(nom(t))}</b>: ` + SECCIONES.map(([s, tit]) => `<a href="${ruta(t, s)}">${esc(minus(tit))}</a>`).join(" · ") + `</li>`).join("")}</ul></div>
  ${cta("Calcula tu IRPF en el País Vasco", "/index.html#calculadora", ["Compara los 19 territorios", "/index.html#comparar"])}
  ${bloqueFaq(qs)}
  </div>`;
  return { ruta: "/irpf/pais-vasco/", html: layout({ title: `IRPF País Vasco ${ej}: Bizkaia, Gipuzkoa y Álava comparados | Mapafiscal`,
    description: `IRPF y sueldo neto en el País Vasco (${ej}): Bizkaia, Gipuzkoa y Álava comparados entre sí, con Navarra y con Madrid. Diferencias en deducciones y calculadora gratuita.`,
    canonical: "/irpf/pais-vasco/", breadcrumb: migasHtml(migas), main, generado, jsonld: [jsonLdMigas(migas), jsonLdFaq(qs)] }) };
}

// Bloque de enlaces para la página /irpf/<territorio>/ (vacío si no es foral)
export function enlacesSuiteForal(codigo, nombre) {
  if (!FORALES.includes(codigo)) return "";
  return `<div class="tarjeta"><h2 class="rotulo">${esc(nombre)}, a fondo</h2><ul class="lista-enlaces">` +
    SECCIONES.map(([s, tit]) => `<li><a href="${ruta(codigo, s)}">${esc(tit)} en ${esc(nombre)}</a></li>`).join("") +
    (codigo !== "ES-NC" ? `<li><a href="/irpf/pais-vasco/">Bizkaia, Gipuzkoa y Álava, comparados</a></li>` : "") + `</ul></div>`;
}

// [{ ruta, html }]: seis páginas por territorio foral y la comparativa del País Vasco.
// `importesSueldoNeto`: importes con página /sueldo-neto/<importe>/<territorio>/ (para enlazarlas).
export function paginasForal(generado, importesSueldoNeto = []) {
  const P = paramsRecientes(), con = new Set(importesSueldoNeto.map(Number));
  const out = [];
  for (const t of FORALES) out.push(pSimulador(P, t, generado), pSueldoNeto(P, t, generado, con), pJubilados(P, t, generado),
    pFamiliaNumerosa(P, t, generado), pDiscapacidad(P, t, generado), pPlanes(P, t, generado));
  out.push(pPaisVasco(P, generado));
  return out;
}
