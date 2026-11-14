// =============================================================================
// Páginas «¿Cuánto me devuelve Hacienda por…?»: /cuanto-me-devuelve/, un hub por situación
// con los 19 territorios y una página por situación y territorio. Las cifras salen de
// web/datos/seo_devuelve.json (Rscript tools/generar_datos_devuelve.R): el motor liquida el
// mismo hogar con y sin la situación y solo cuenta piezas confirmadas. Un territorio sin
// cifra tiene página con `noindex` y no va al sitemap. Lo usa tools/generar_paginas_seo.mjs.
// =============================================================================
import { SLUG, ORDEN_TERRITORIOS, esc, euros, eurosExactos, layout, jsonLdMigas, jsonLdFaq, bloqueFaq, migasHtml } from "./seo_comun.mjs";

const HUB = "/cuanto-me-devuelve/";
const CALC = "/index.html#calculadora";

// Textos de cada situación. `que`: «por …»; `hogar(d, s)`: el caso de referencia.
export const SITUACIONES = {
  "hijo": {
    nombre: "Tener un hijo", que: "tener un hijo",
    hogar: s => `Pareja con dos sueldos de ${s} cada uno y un hijo nacido en 2025, frente a la misma pareja sin hijos.`,
    comun: n => `el mínimo por descendientes (${n.minimo_descendientes}), que es mayor durante los tres primeros años del niño y se reparte entre los dos progenitores`,
    foral: "la deducción foral por descendientes, que se resta directamente de la cuota",
    extra: "La deducción por maternidad del art. 81 LIRPF va aparte, en la cuota diferencial, y no está sumada en esta cifra."
  },
  "familia-numerosa": {
    nombre: "Familia numerosa", que: "ser familia numerosa",
    hogar: s => `Pareja con dos sueldos de ${s} cada uno y tres hijos de 2, 6 y 10 años, con título de familia numerosa general frente a la misma familia sin título.`,
    comun: () => "las deducciones autonómicas por familia numerosa",
    foral: "",
    extra: "La deducción estatal por familia numerosa del art. 81 bis LIRPF se pide aparte, en la cuota diferencial, y no está sumada en esta cifra."
  },
  "ascendiente-a-cargo": {
    nombre: "Ascendiente a cargo", que: "tener a un padre o una madre a cargo",
    hogar: (s, d) => `Una persona de 50 años con ${s} que convive todo el año con su madre de ${d.importes.edad_ascendiente} años, con ${euros(d.importes.rentas_ascendiente)} de rentas propias, frente a la misma persona sola.`,
    comun: n => `el mínimo por ascendientes (${n.minimo_ascendientes}), mayor a partir de los 75 años`,
    foral: "la deducción foral por ascendientes que conviven con el contribuyente"
  },
  "mayor-65": {
    nombre: "Cumplir 65 años", que: "tener más de 65 años",
    hogar: s => `Una persona de 67 años con ${s} de rendimientos del trabajo (sueldo o pensión), frente a la misma persona con 60 años.`,
    comun: n => `el incremento del mínimo del contribuyente a partir de los 65 años (${n.minimo_contribuyente})`,
    foral: "la deducción foral por edad del contribuyente"
  },
  "discapacidad-33": {
    nombre: "Discapacidad del 33 %", que: "tener una discapacidad del 33 %",
    hogar: s => `Una persona de 40 años con ${s} y un grado de discapacidad entre el 33 % y el 65 %, frente a la misma persona sin discapacidad.`,
    comun: n => `el mínimo por discapacidad del contribuyente (${n.minimo_discapacidad})`,
    foral: "la deducción foral por discapacidad del contribuyente"
  },
  "discapacidad-65": {
    nombre: "Discapacidad del 65 %", que: "tener una discapacidad del 65 % o más",
    hogar: s => `Una persona de 40 años con ${s} y un grado de discapacidad igual o superior al 65 %, frente a la misma persona sin discapacidad.`,
    comun: n => `el mínimo por discapacidad del contribuyente (${n.minimo_discapacidad}), con el incremento por gastos de asistencia`,
    foral: "la deducción foral por discapacidad del contribuyente"
  },
  "alquiler": {
    nombre: "Vivir de alquiler", que: "vivir de alquiler",
    hogar: (s, d) => `Una persona de 30 años con ${s} que paga ${euros(d.importes.alquiler)} al año de alquiler de su vivienda habitual, frente a la misma persona sin alquiler.`,
    comun: () => "las deducciones autonómicas por alquiler de la vivienda habitual",
    foral: "la deducción foral por alquiler de la vivienda habitual",
    extra: "En el tramo estatal, la deducción por alquiler solo se mantiene para contratos firmados antes de 2015 (régimen transitorio) y no está sumada en esta cifra."
  },
  "hipoteca-antes-2013": {
    nombre: "Hipoteca anterior a 2013", que: "pagar una hipoteca firmada antes de 2013",
    hogar: (s, d) => `Una persona de 45 años con ${s} que paga ${euros(d.importes.hipoteca)} al año (capital e intereses) por la hipoteca de una vivienda habitual comprada antes de 2013, frente a la misma persona sin hipoteca.`,
    comun: n => `la deducción estatal transitoria por inversión en vivienda habitual (${n.deduccion_vivienda_transitoria})`,
    foral: "la deducción foral por adquisición de vivienda habitual, que en el País Vasco no depende de la fecha de compra"
  },
  "donativo": {
    nombre: "Hacer un donativo", que: "hacer un donativo",
    hogar: (s, d) => `Una persona de 40 años con ${s} que dona ${euros(d.importes.donativo)} en el año a una ONG acogida a la Ley 49/2002, frente a la misma persona sin donativo.`,
    comun: n => `la deducción por donativos (${n.deduccion_donativos})`,
    foral: ""
  }
};

const ruta = (sit, codigo) => `${HUB}${sit}/${codigo ? SLUG[codigo] + "/" : ""}`;
const noindex = html => html.replace('<meta name="viewport"', '<meta name="robots" content="noindex, follow">\n<meta name="viewport"');

function enlaceDeducciones(codigo, nombre, conDeducciones) {
  return conDeducciones.has(codigo)
    ? `<a href="/irpf/${SLUG[codigo]}/deducciones/">deducciones de ${esc(nombre)}</a>`
    : `<a href="/irpf/${SLUG[codigo]}/">IRPF en ${esc(nombre)}</a>`;
}

// Por qué sale esa cifra, en texto plano.
function explicacion(sit, t, d) {
  const S = SITUACIONES[sit];
  const auto = t.deducciones_autonomicas.map(x => `«${x.titulo}»`);
  if (t.regimen !== "comun") return `En ${t.nombre} la cifra sale de ${S.foral}.`;
  const piezas = [];
  if (t.piezas.length) piezas.push(S.comun(d.normas) + (t.minimo_autonomico_propio ? `, con los importes propios que fija ${t.nombre} para su tramo autonómico` : ""));
  if (auto.length) piezas.push(`la deducción autonómica ${auto.join(" y ")}`);
  if (!piezas.length) return `En ${t.nombre} no hay ninguna deducción autonómica confirmada que se aplique a este caso, así que la cuota no cambia por ${S.que}.`;
  return `En ${t.nombre} la cifra sale de ${piezas.join(" y de ")}.` +
    (!auto.length && sit !== "hipoteca-antes-2013" && sit !== "donativo" ? ` ${t.nombre} no tiene una deducción autonómica confirmada para este caso: lo que ahorras es lo que fija la ley estatal.` : "");
}

function paginaTerritorio(sit, t, d, conDeducciones, generado) {
  const S = SITUACIONES[sit], codigo = t.territorio, nombre = t.nombre;
  const sal = d.salarios.map(String), med = sal[1];
  const migas = [["Inicio", "/"], ["Cuánto me devuelve Hacienda", HUB], [S.nombre, ruta(sit)], [nombre, ruta(sit, codigo)]];
  const h1 = `¿Cuánto me devuelve Hacienda por ${S.que} en ${nombre}? (Renta 2025)`;
  let cuerpo, faq, description;
  if (t.publicable) {
    const a = t.ahorro[med];
    const filas = sal.map(s => `<tr><td>${esc(euros(+s))}</td><td class="num"><b>${esc(eurosExactos(t.ahorro[s]))}</b></td></tr>`).join("");
    const exp = explicacion(sit, t, d);
    cuerpo = `<div class="tarjeta">
    <p class="cifra-destacada">Con ${esc(euros(+med))} brutos, ${S.que} en ${esc(nombre)} rebaja la cuota del IRPF en <b>${esc(eurosExactos(a))}</b> al año.</p>
    <p>${esc(exp)}</p>
    ${S.extra && t.regimen === "comun" ? `<p>${esc(S.extra)}</p>` : ""}
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Rebaja de la cuota según el sueldo</h2>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Sueldo bruto anual</th><th class="num">Pagas de menos</th></tr></thead><tbody>${filas}</tbody></table></div>
    <p class="ayuda">${esc("Hogar tipo (solo cambia el sueldo): " + S.hogar(euros(+med) + " brutos", d))}</p>
  </div>`;
    faq = [
      [`¿Cuánto me devuelve Hacienda por ${S.que} en ${nombre}?`, `En el caso de referencia, con ${euros(+med)} brutos, la cuota del IRPF de 2025 baja ${eurosExactos(a)}. Si ya te retienen en la nómina como si no tuvieras esta situación, esa rebaja es lo que te devuelven de más o lo que pagas de menos en la declaración.`],
      [`¿De dónde sale la cifra?`, exp],
      [`¿Es mi caso exacto?`, `No: es un hogar tipo. ${S.hogar(euros(+med) + " brutos", d)} Para tu caso, usa la calculadora gratuita de Mapafiscal.`]
    ];
    description = `En ${nombre}, ${S.que} rebaja el IRPF de 2025 en ${eurosExactos(a)} con ${euros(+med)} brutos. Cálculo con el motor de Mapafiscal, a tres sueldos, y comparativa de los 19 territorios.`;
  } else {
    const txt = `Para ${nombre} todavía no damos una cifra de este caso: solo publicamos importes cuando todas las piezas del cálculo están cotejadas con el boletín oficial. La calculadora te da tu caso con la normativa de ${nombre}.`;
    cuerpo = `<div class="tarjeta"><p>${esc(txt)}</p></div>`;
    faq = [[`¿Cuánto me devuelve Hacienda por ${S.que} en ${nombre}?`, txt]];
    description = `${S.nombre} en el IRPF de ${nombre} (Renta 2025): qué se deduce y cómo calcularlo. Comparativa de lo que ahorras en los 19 territorios fiscales.`;
  }
  const main = `
  <h1>${esc(h1)}</h1>
  <p class="entradilla">${esc(S.hogar(euros(+med) + " brutos", d))}</p>
  <div class="prosa">
  ${cuerpo}
  ${bloqueFaq(faq)}
  <p><a class="btn btn-pri" href="${CALC}">Calcula tu caso real en ${esc(nombre)}</a></p>
  <p class="ayuda">Más: ${enlaceDeducciones(codigo, nombre, conDeducciones)} · <a href="${ruta(sit)}">${esc(S.nombre)} en los 19 territorios</a> · <a href="${HUB}">otras situaciones</a></p>
  </div>`;
  const html = layout({
    jsonld: [jsonLdMigas(migas), jsonLdFaq(faq)],
    title: `¿Cuánto me devuelve Hacienda por ${S.que} en ${nombre}? (2025) | Mapafiscal`,
    description, canonical: ruta(sit, codigo), breadcrumb: migasHtml(migas), main, generado
  });
  return { ruta: ruta(sit, codigo), html: t.publicable ? html : noindex(html), indexable: t.publicable };
}

function paginaHub(sit, ts, d, generado) {
  const S = SITUACIONES[sit], sal = d.salarios.map(String), med = sal[1];
  const migas = [["Inicio", "/"], ["Cuánto me devuelve Hacienda", HUB], [S.nombre, ruta(sit)]];
  const filas = ORDEN_TERRITORIOS.map(c => ts[c]).map(t => `<tr><td><a href="${ruta(sit, t.territorio)}">${esc(t.nombre)}</a></td>${sal.map(s =>
    `<td class="num">${t.publicable ? esc(eurosExactos(t.ahorro[s])) : "—"}</td>`).join("")}</tr>`).join("");
  const con = ORDEN_TERRITORIOS.map(c => ts[c]).filter(t => t.publicable).sort((a, b) => b.ahorro[med] - a.ahorro[med]);
  const max = con[0], min = con[con.length - 1];
  const resumen = `Con ${euros(+med)} brutos, ${S.que} rebaja la cuota del IRPF de 2025 entre ${eurosExactos(min.ahorro[med])} (${min.nombre}) y ${eurosExactos(max.ahorro[med])} (${max.nombre}), según el territorio.`;
  const faq = [
    [`¿Cuánto me devuelve Hacienda por ${S.que}?`, resumen],
    ["¿Qué significa «—» en la tabla?", "Que en ese territorio todavía no damos una cifra: solo publicamos importes cuando todas las piezas del cálculo están cotejadas con el boletín oficial."],
    ["¿Cómo se calcula?", `Con el motor de Mapafiscal se liquida el IRPF de 2025 del mismo hogar con y sin la situación, y se resta. ${"Hogar tipo (solo cambia el sueldo): " + S.hogar(euros(+med) + " brutos", d)}`]
  ];
  const main = `
  <h1>¿Cuánto me devuelve Hacienda por ${esc(S.que)}? Los 19 territorios (Renta 2025)</h1>
  <p class="entradilla">${esc(resumen)}</p>
  <div class="prosa">
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Rebaja de la cuota del IRPF por territorio y sueldo bruto</h2>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Territorio</th>${sal.map(s => `<th class="num">${esc(euros(+s))}</th>`).join("")}</tr></thead><tbody>${filas}</tbody></table></div>
    <p class="ayuda">${esc("Hogar tipo (solo cambia el sueldo): " + S.hogar(euros(+med) + " brutos", d))}${S.extra ? " " + esc(S.extra) : ""}</p>
  </div>
  ${bloqueFaq(faq)}
  <p><a class="btn btn-pri" href="${CALC}">Calcula tu caso real</a> <a class="btn btn-sec" href="${HUB}">Otras situaciones</a></p>
  </div>`;
  return { ruta: ruta(sit), indexable: true, html: layout({
    jsonld: [jsonLdMigas(migas), jsonLdFaq(faq)],
    title: `¿Cuánto me devuelve Hacienda por ${S.que}? (2025) | Mapafiscal`,
    description: `${resumen} Tabla de los 19 territorios fiscales a tres sueldos.`,
    canonical: ruta(sit), breadcrumb: migasHtml(migas), main, generado
  }) };
}

function paginaIndice(d, generado) {
  const migas = [["Inicio", "/"], ["Cuánto me devuelve Hacienda", HUB]];
  const lista = Object.entries(SITUACIONES).map(([k, S]) => `<li><a href="${ruta(k)}">¿Cuánto me devuelve Hacienda por ${esc(S.que)}?</a></li>`).join("");
  const main = `
  <h1>¿Cuánto me devuelve Hacienda por…? (Renta 2025)</h1>
  <p class="entradilla">Lo que rebaja la cuota del IRPF cada situación personal o familiar, en los 19 territorios fiscales de España, calculado con el motor de Mapafiscal sobre un hogar tipo.</p>
  <div class="prosa"><ul class="lista-enlaces">${lista}</ul>
  <p><a class="btn btn-pri" href="${CALC}">Calcula tu caso real</a></p></div>`;
  return { ruta: HUB, indexable: true, html: layout({
    jsonld: [jsonLdMigas(migas)],
    title: "¿Cuánto me devuelve Hacienda por…? Situaciones del IRPF 2025 | Mapafiscal",
    description: "Cuánto rebaja el IRPF de 2025 tener un hijo, ser familia numerosa, vivir de alquiler, una hipoteca anterior a 2013, una discapacidad o un donativo, en los 19 territorios.",
    canonical: HUB, breadcrumb: migasHtml(migas), main, generado
  }) };
}

// Devuelve [{ ruta, html, indexable }].
export function paginasDevuelve(d, conDeducciones) {
  const out = [paginaIndice(d, d.generado)];
  for (const sit of Object.keys(SITUACIONES)) {
    const ts = d.situaciones[sit];
    out.push(paginaHub(sit, ts, d, d.generado));
    for (const c of ORDEN_TERRITORIOS) out.push(paginaTerritorio(sit, ts[c], d, conDeducciones, d.generado));
  }
  return out;
}
