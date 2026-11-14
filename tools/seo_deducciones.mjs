// =============================================================================
// Páginas de deducciones por territorio: /irpf/<territorio>/deducciones/
//
// Los datos salen de web/datos/seo_deducciones.json (Rscript tools/generar_datos_seo.R),
// que ya solo trae lo `confirmado`, con fuente primaria y con todos sus supuestos
// confirmados. Aquí se redacta cada supuesto a partir de las claves del DSL de
// params/2025/autonomico.yaml (ver R/06_deducciones.R). Si un supuesto trae una clave que
// este fichero no sabe explicar, la deducción entera no se publica (y se avisa por consola):
// mejor no publicarla que explicarla a medias.
// =============================================================================
import {
  SLUG, HERRAMIENTA, esc, miles, eurosExactos, pctCorto, urlBoe, enlacesBoe,
  layout, jsonLdMigas, jsonLdArticulo, migasHtml
} from "./seo_comun.mjs";

const eur = eurosExactos;

const CAMPO = {
  alquiler_vivienda_pagos: "las cantidades pagadas por el alquiler de la vivienda habitual",
  cuotas_ss_empleada_hogar: "las cotizaciones a la Seguridad Social de la persona empleada del hogar que paga el contribuyente",
  gastos_deporte: "los gastos en ejercicio físico y práctica deportiva",
  gastos_cuidado_hijos: "las cantidades pagadas por el cuidado de los hijos (persona empleada del hogar o escuela infantil)",
  gastos_libros_texto: "la compra de libros de texto y material escolar",
  gastos_idiomas_informatica: "las clases extraescolares de idiomas e informática",
  gastos_escolaridad: "los gastos de escolaridad",
  gastos_idiomas: "la enseñanza de idiomas",
  gastos_vestuario_escolar: "el vestuario de uso exclusivo escolar",
  rehabilitacion_vivienda_pagos: "las cantidades pagadas por la rehabilitación de la vivienda habitual",
  donativos_lengua_catalana: "los donativos a entidades que fomentan el uso de la lengua catalana o de la occitana",
  donativos_investigacion: "los donativos a entidades que fomentan la investigación científica y la innovación tecnológica",
  inversion_cooperativas_cat: "las aportaciones de capital a cooperativas agrarias o de vivienda",
  gastos_guarderia: "los gastos de custodia en guarderías o centros de educación infantil autorizados",
  gastos_estudios_no_superiores: "los gastos de estudios no superiores (libros de texto, material didáctico, transporte, uniforme y comedor escolar)"
};
const DEDUCCION_POR_ID = { nacimiento_adopcion: "la deducción por nacimiento o adopción" };

// Claves que no hace falta explicar (internas) o que se explican junto con otra.
const INTERNAS = new Set(["id", "norma", "tipo", "grupo", "suma_bases", "base_gate", "prorratea_progenitores",
  "multiple_por_hijo", "campo", "campos", "anios_ventana", "anios_ventana_desde", "importe", "importe_multiple",
  "importes_por_orden", "importe_conjunta", "base_maxima", "limite_pct_cuota_autonomica", "porcentaje", "limite", "limite_conjunta", "limite_si_campo", "primer_ciclo",
  "sobre_cuota_integra", "hijos_desde_orden", "edad_hijo_min", "edad_hijo_max", "edad_ascendiente_min",
  "ascendiente_discapacidad", "edad_ascendiente_min_discapacidad", "requiere_minimo_ascendiente",
  "base_max_individual", "base_max_conjunta", "base_min_individual", "base_min_conjunta",
  "miembros_uf_hijos_edad_max", "descendientes_min", "descendientes_max", "descendientes_edad_max_cuenta",
  "prorratea_desempleo"]);
const EXPLICADAS = new Set(["requiere_familia_numerosa", "familia_numerosa_categoria", "requiere_familia_numerosa_reciente",
  "requiere_monoparental", "requiere_titulo_monoparental", "requiere_discapacidad_grado", "requiere_discapacidad_contribuyente", "requiere_discapacidad_65_de",
  "edad_max", "edad_min", "descendiente_edad_max", "requiere_zona_despoblada", "requiere_progenitores_trabajan",
  "requiere_desempleo", "base_max_por_miembro_uf", "taper_individual", "taper_conjunta", "incremento_municipio",
  "factor_discapacidad", "duplica_hijo_discapacidad", "descendientes_sin_deduccion"]);

const hijos = n => n === 1 ? "un hijo" : `${n} hijos`;
const edadHijos = e => e === 17 ? " menores de edad" : e === 2 ? " menores de 3 años" : ` de ${e} años o menos`;
const conQuien = de => ({ contribuyente: "el contribuyente", contribuyente_o_descendientes: "el contribuyente o alguno de los hijos",
  declarantes_o_descendientes: "alguno de los cónyuges o de los hijos" }[de]);

function etiquetaBase(d) {
  if (d.base_gate === "menos_minimo") return "la base imponible total menos el mínimo personal y familiar";
  if (d.suma_bases === "imponibles") return "la suma de las bases imponibles general y del ahorro";
  return "la suma de las bases liquidables general y del ahorro";
}
function rango(min, max) {
  const m = min != null ? eur(Math.floor(min)) : null;
  if (m && max != null) return `sea superior a ${m} y no supere ${eur(max)}`;
  if (m) return `sea superior a ${m}`;
  return `no supere ${eur(max)}`;
}

function cuanto(d) {
  const lim = d.limite != null ? `, con un máximo de ${eur(d.limite)}${d.limite_conjunta != null ? ` (${eur(d.limite_conjunta)} en tributación conjunta)` : ""}` : "";
  switch (d.tipo) {
    case "fija": return eur(d.importe);
    case "fija_por_hijo": {
      let s = `${eur(d.importe)} por cada hijo`;
      if (d.hijos_desde_orden) s += ` a partir del ${d.hijos_desde_orden}.º`;
      if (d.edad_hijo_min != null && d.edad_hijo_max != null) s += ` de entre ${d.edad_hijo_min} y ${d.edad_hijo_max} años`;
      else if (d.edad_hijo_max != null) s += ` de ${d.edad_hijo_max} años o menos`;
      else if (d.edad_hijo_min != null) s += ` de ${d.edad_hijo_min} años o más`;
      return s;
    }
    case "fija_por_hijo_nacido": {
      const o = d.importes_por_orden;
      let s = o ? `${eur(o["1"])} por el primer hijo, ${eur(o["2"])} por el segundo y ${eur(o["3+"])} por el tercero y siguientes`
                : `${eur(d.importe)} por cada hijo${d.importe_conjunta != null ? ` (${eur(d.importe_conjunta)} en tributación conjunta)` : ""}`;
      const desde = d.anios_ventana_desde || 1, hasta = d.anios_ventana || 1;
      if (desde > 1) s += `, en cada uno de los ${hasta - desde + 1} años siguientes al del nacimiento o la adopción`;
      else if (hasta === 1) s += " nacido o adoptado en el año";
      else return null;
      if (d.importe_multiple) s += d.multiple_por_hijo
        ? `; en partos o adopciones múltiples, ${eur(d.importe_multiple)} más por cada hijo`
        : `; en partos o adopciones múltiples, ${eur(d.importe_multiple)} más`;
      return s;
    }
    case "fija_por_ascendiente": {
      let s = `${eur(d.importe)} por cada ascendiente mayor de ${(d.edad_ascendiente_min ?? 65) - 1} años`;
      if (d.ascendiente_discapacidad === "65_mas") s += ` o mayor de ${(d.edad_ascendiente_min_discapacidad ?? 1) - 1} años con un grado de discapacidad igual o superior al 65 %`;
      else if (d.ascendiente_discapacidad !== false) return null;
      if (d.requiere_minimo_ascendiente) s += " que dé derecho al mínimo por ascendientes";
      return s;
    }
    case "porcentaje_campo":
      if (!CAMPO[d.campo]) return null;
      return `${pctCorto(d.porcentaje)} de ${CAMPO[d.campo]}${d.base_maxima != null ? ` (con una base máxima de ${eur(d.base_maxima)})` : ""}${lim}${d.limite_pct_cuota_autonomica != null ? `, sin superar el ${pctCorto(d.limite_pct_cuota_autonomica)} de la cuota íntegra autonómica` : ""}`;
    case "porcentaje_campo_hijo":
      if (!CAMPO[d.campo]) return null;
      return `${pctCorto(d.porcentaje)} de ${CAMPO[d.campo]} de cada hijo${d.edad_hijo_max != null ? ` de ${d.edad_hijo_max} años o menos` : ""}${d.limite != null ? `, con un máximo de ${eur(d.limite)} por hijo` : ""}`;
    case "porcentaje_campos_hijo": {
      const partes = Object.entries(d.campos).map(([k, p]) => CAMPO[k] ? `${pctCorto(p)} de ${CAMPO[k]}` : null);
      if (partes.includes(null)) return null;
      const lista = partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1];
      let s = `${lista} de cada hijo, con un máximo de ${eur(d.limite)} por hijo`;
      if (d.limite_si_campo) { if (!CAMPO[d.limite_si_campo.campo]) return null; s += `, que sube a ${eur(d.limite_si_campo.limite)} si hay gastos por ${CAMPO[d.limite_si_campo.campo].replace(/^los gastos de /, "")}`; }
      if (d.primer_ciclo) {
        const pc = d.primer_ciclo, cs = [].concat(pc.campos);
        if (cs.some(k => !CAMPO[k])) return null;
        s += `; por los hijos${edadHijos(pc.edad_hijo_max)} solo cuentan ${cs.map(k => CAMPO[k]).join(" y ")}, con un máximo de ${eur(pc.limite)} por hijo`;
      }
      return s;
    }
    case "porcentaje_cuota_autonomica":
      return `${pctCorto(d.porcentaje)} de la cuota ${d.sobre_cuota_integra ? "íntegra " : ""}autonómica${lim}`;
    default: return null;
  }
}

function requisitos(d) {
  const r = [];
  const fn = d.requiere_familia_numerosa;
  if (fn === true) r.push("Tener el título de familia numerosa");
  else if (fn === "especial") r.push("Tener el título de familia numerosa de categoría especial");
  else if (fn != null) return null;
  const fc = d.familia_numerosa_categoria;
  if (fc === "general") r.push("Ser familia numerosa de categoría general");
  else if (fc === "especial") r.push("Ser familia numerosa de categoría especial");
  else if (fc === "no") r.push("No ser familia numerosa");
  else if (fc != null) return null;
  if (d.requiere_familia_numerosa_reciente) r.push("Haber obtenido el título de familia numerosa con efectos desde el 1 de enero de 2023: se aplica el año en que se obtiene y los dos siguientes");
  if (d.requiere_monoparental) r.push("Ser familia monoparental");
  if (d.requiere_titulo_monoparental) r.push(`Tener el título de familia monoparental de categoría ${d.requiere_titulo_monoparental}`);
  if (d.requiere_discapacidad_grado != null) {
    if (d.requiere_discapacidad_grado !== "65_mas") return null;
    r.push("Que el contribuyente tenga un grado de discapacidad igual o superior al 65 %");
  }
  if (d.requiere_discapacidad_contribuyente) r.push("Que el contribuyente tenga un grado de discapacidad igual o superior al 33 %");
  if (d.requiere_discapacidad_65_de) {
    const q = conQuien(d.requiere_discapacidad_65_de); if (!q) return null;
    r.push(`Que ${q} tenga un grado de discapacidad igual o superior al 65 %`);
  }
  if (d.edad_max != null) r.push(`Que el contribuyente tenga menos de ${d.edad_max} años`);
  if (d.edad_min != null) r.push(`Que el contribuyente tenga ${d.edad_min} años o más`);
  if (d.descendientes_min != null || d.descendientes_max != null) {
    const a = d.descendientes_min, b = d.descendientes_max;
    const que = d.descendientes_edad_max_cuenta != null ? edadHijos(d.descendientes_edad_max_cuenta) : "";
    if (a != null && a === b) r.push(`Tener ${hijos(a)}${que}`);
    else if (a != null && b != null) r.push(`Tener entre ${a} y ${b} hijos${que}`);
    else if (a != null) r.push(`Tener al menos ${hijos(a)}${que}`);
    else r.push(`Tener ${b} hijos${que} como máximo`);
  }
  if (d.descendiente_edad_max != null) r.push(`Tener algún hijo${edadHijos(d.descendiente_edad_max)}`);
  if (d.requiere_zona_despoblada) r.push("Residir en uno de los municipios que la comunidad considera en riesgo de despoblación");
  if (d.requiere_progenitores_trabajan) r.push("Que los progenitores obtengan rendimientos del trabajo o de actividades económicas");
  if (d.requiere_desempleo) r.push(`Que algún progenitor esté en desempleo e inscrito como demandante de empleo${d.prorratea_desempleo ? " (el importe se prorratea por los meses en esa situación)" : ""}`);
  const base = etiquetaBase(d);
  const ind = [d.base_min_individual, d.base_max_individual], conj = [d.base_min_conjunta, d.base_max_conjunta];
  if (ind.some(v => v != null) || conj.some(v => v != null)) {
    const ri = ind.some(v => v != null) ? rango(...ind) : null, rc = conj.some(v => v != null) ? rango(...conj) : null;
    if (ri && rc && ri === rc) r.push(`Que ${base} ${ri}, en tributación individual o conjunta`);
    else if (ri && rc) r.push(`Que ${base} ${ri} en tributación individual (en conjunta, que ${rc.replace(/^sea /, "sea ")})`);
    else if (ri) r.push(`Que ${base} ${ri} en tributación individual`);
    else r.push(`Que ${base} ${rc} en tributación conjunta`);
  }
  if (d.base_max_por_miembro_uf != null) r.push(`Que ${base} de la unidad familiar no supere ${eur(d.base_max_por_miembro_uf)} por cada miembro de la unidad familiar`);
  return r;
}

function notas(d) {
  const n = [];
  const base = etiquetaBase(d);
  if (d.taper_individual) {
    const [a, b] = d.taper_individual;
    let s = `El importe se reduce de forma lineal cuando ${base} está entre ${eur(a)} y ${eur(b)} en tributación individual`;
    if (d.taper_conjunta) s += ` (entre ${eur(d.taper_conjunta[0])} y ${eur(d.taper_conjunta[1])} en conjunta)`;
    n.push(s + ".");
  }
  if (d.incremento_municipio) n.push(`Es un ${pctCorto(d.incremento_municipio.factor - 1)} mayor si se reside en un municipio de menos de ${miles(String(d.incremento_municipio.hab_max + 1))} habitantes.`);
  if (d.factor_discapacidad) {
    const f = d.factor_discapacidad, q = conQuien(f.de);
    if (!q) return null;
    n.push(`El importe se ${f.factor === 2 ? "duplica" : `multiplica por ${f.factor}`} si ${q} tiene un grado de discapacidad igual o superior al ${f.grado === "65_mas" ? "65" : "33"} %.`);
  }
  if (d.duplica_hijo_discapacidad) n.push("Cada hijo con un grado de discapacidad igual o superior al 33 % cuenta el doble.");
  if (d.descendientes_sin_deduccion) {
    const q = DEDUCCION_POR_ID[d.descendientes_sin_deduccion]; if (!q) return null;
    n.push(`No cuentan los hijos por los que se aplica ${q}.`);
  }
  return n;
}

// Mismo criterio que R/06_deducciones.R (es_familiar / prorratea): reparto entre progenitores.
function esFamiliar(d) {
  if (d.prorratea_progenitores != null) return !!d.prorratea_progenitores;
  return ["fija_por_hijo", "fija_por_hijo_nacido", "porcentaje_campo_hijo", "porcentaje_campos_hijo", "fija_por_ascendiente"].includes(d.tipo) ||
    (d.tipo === "fija" && (d.requiere_familia_numerosa != null || d.familia_numerosa_categoria != null || d.requiere_monoparental || d.descendientes_min != null));
}

// Redacta una deducción; null si alguna clave no se sabe explicar.
export function redactarFicha(f) {
  const supuestos = [];
  for (const d of f.supuestos) {
    const desconocidas = Object.keys(d).filter(k => !INTERNAS.has(k) && !EXPLICADAS.has(k));
    const c = cuanto(d), r = requisitos(d), n = notas(d);
    if (desconocidas.length || !c || !r || !n) return { error: `${d.id}: ${desconocidas.join(", ") || "tipo o valor sin texto"}` };
    supuestos.push({ id: d.id, cuanto: c.replace(/ de el /g, " del "), requisitos: r, notas: n, familiar: esFamiliar(d), grupo: d.grupo });
  }
  const grupos = supuestos.filter(s => s.grupo).map(s => s.grupo);
  return {
    titulo: f.titulo, normas: f.normas, boe: f.boe || [], url_aeat: f.url_aeat, supuestos,
    excluyentes: grupos.length > 1 && new Set(grupos).size < grupos.length,
    // Variantes que solo difieren en la categoría de familia numerosa son excluyentes de por sí.
    acumulables: supuestos.length > 1 && !grupos.length &&
      new Set(f.supuestos.map(d => d.familia_numerosa_categoria ?? "-")).size < f.supuestos.length,
    reparto: supuestos.some(s => s.familiar)
  };
}

function htmlFicha(r) {
  const cuerpo = r.supuestos.map(s => `<div class="supuesto">
      <p class="supuesto-importe">${esc(s.cuanto.charAt(0).toUpperCase() + s.cuanto.slice(1))}.</p>
      ${s.requisitos.length ? `<ul>${s.requisitos.map(q => `<li>${esc(q)}.</li>`).join("")}</ul>` : ""}
      ${s.notas.map(q => `<p class="ayuda">${esc(q)}</p>`).join("")}
    </div>`).join("");
  const extra = [];
  if (r.excluyentes) extra.push("Estos supuestos no se suman: se aplica el que dé más deducción.");
  if (r.acumulables) extra.push("Si se cumplen varios supuestos, sus importes se suman.");
  if (r.reparto) extra.push("Si dos contribuyentes tienen derecho y declaran por separado, se la reparten a partes iguales.");
  const fuentes = [
    ...r.boe.map(id => `<a href="${urlBoe(id)}" rel="noopener">${esc(id)}</a>`),
    r.url_aeat ? `<a href="${esc(r.url_aeat)}" rel="noopener">Manual práctico de la AEAT</a>` : null
  ].filter(Boolean);
  return `<div class="tarjeta ficha-deduccion">
    <h2 class="rotulo">${esc(r.titulo)}</h2>
    ${cuerpo}
    ${extra.map(q => `<p class="ayuda">${esc(q)}</p>`).join("")}
    <p class="fuente">Norma: ${esc(r.normas.join("; "))}.${fuentes.length ? ` Fuente: ${fuentes.join(" · ")}.` : ""}</p>
  </div>`;
}

// ---- forales ----------------------------------------------------------------------
// URL de la fuente principal de params/2025/foral_pais_vasco.yaml (cabecera del fichero).
const URL_FUENTE_FORAL = {
  "DF Gipuzkoa": "https://www.gipuzkoa.eus/es/web/ogasuna/impuestos/modelo/109/2025/bonificaciones-reducciones-deducciones-tabla-gravamen"
};
const IMPORTE_MINORACION = { "ES-PV-BI": "importe_bizkaia", "ES-PV-SS": "importe_gipuzkoa", "ES-PV-VI": "importe_araba" };
const ordenHijos = o => `${eur(o["1"])} por el primero, ${eur(o["2"])} por el segundo, ${eur(o["3"])} por el tercero, ${eur(o["4"])} por el cuarto y ${eur(o["5+"])} por el quinto y siguientes`;

const FORAL = {
  minoracion_cuota: (b, t) => b[IMPORTE_MINORACION[t]] == null ? null : ["Minoración general de la cuota",
    [`${eur(b[IMPORTE_MINORACION[t]])} por contribuyente, que se restan de la cuota íntegra.`]],
  deduccion_descendientes: b => ["Por descendientes",
    [`${ordenHijos(b.importes)}.`, `${eur(b.incremento_menor_6_anios)} más por cada descendiente menor de 6 años.`]],
  deduccion_anualidades_alimentos_hijos: b => ["Por anualidades por alimentos a los hijos",
    [`${pctCorto(b.porcentaje)} de las anualidades pagadas por decisión judicial, con un límite por hijo de ${ordenHijos(b.limites).replace(/ por el /g, " para el ")}.`]],
  deduccion_ascendientes: b => ["Por ascendientes", [`${eur(b.importe)} por cada ascendiente que conviva con el contribuyente y le dé derecho a la deducción.`]],
  deduccion_discapacidad: b => ["Por discapacidad o dependencia", [
    `${eur(b.grado_33_64)} con un grado de discapacidad de entre el 33 % y el 64 %.`,
    `${eur(b.grado_65_mas_o_dependencia_moderada)} con un grado igual o superior al 65 %, o con dependencia moderada.`,
    `${eur(b.grado_75_15_39_puntos_o_dependencia_severa)} con un grado igual o superior al 75 % y entre 15 y 39 puntos de ayuda de terceras personas, o con dependencia severa.`,
    `${eur(b.grado_75_40_puntos_o_gran_dependencia)} con un grado igual o superior al 75 % y 40 o más puntos de ayuda de terceras personas, o con gran dependencia.`]],
  deduccion_edad: b => ["Por edad", [
    `${eur(b.individual.edad_65.importe)} para los mayores de 65 años y ${eur(b.individual.edad_75.importe)} para los mayores de 75 (no se suman).`,
    `En tributación individual, entera si la base imponible no pasa de ${eur(b.individual.edad_65.base_plena)}; se reduce de forma lineal hasta desaparecer en ${eur(b.individual.edad_65.base_cero)}.`,
    `En conjunta, por cada contribuyente con esa edad, si la base imponible no pasa de ${eur(b.conjunta.edad_65.base_plena)}.`]],
  deduccion_viudedad: b => ["Por viudedad", [
    `${eur(b.importe)}, entera si la base imponible no pasa de ${eur(b.base_plena)}; se reduce de forma lineal hasta desaparecer en ${eur(b.base_cero)}.`,
    "No se puede sumar a la deducción por edad."]],
  deduccion_alquiler_vivienda: b => ["Por alquiler de la vivienda habitual", [
    `${pctCorto(b.general.porcentaje)} de lo pagado, con un máximo de ${eur(b.general.limite)} al año.`,
    `${pctCorto(b.colectivo_especial.porcentaje)}, con un máximo de ${eur(b.colectivo_especial.limite)}, para los menores de 36 años, las familias numerosas, las familias monoparentales y los demás colectivos que fija la norma foral.`]],
  deduccion_adquisicion_vivienda: b => ["Por adquisición de vivienda habitual", [
    `${pctCorto(b.general.porcentaje)} de lo invertido, con un máximo de ${eur(b.general.limite_anual)} al año.`,
    `${pctCorto(b.menor_36.porcentaje)}, con un máximo de ${eur(b.menor_36.limite_anual)} al año, para los menores de 36 años, las familias numerosas, las familias monoparentales y los demás colectivos que fija la norma foral.`,
    `En toda la vida del contribuyente se pueden deducir como máximo ${eur(b.credito_fiscal_vital)}.`]],
  deduccion_patrimonio_protegido: b => ["Por aportaciones a patrimonios protegidos de personas con discapacidad",
    [`${pctCorto(b.porcentaje)} de las aportaciones, con un máximo de ${eur(b.limite_anual)} al año.`]],
  // Navarra
  minimo_personal_deduccion: b => ["Por mínimo personal", [
    `${eur(b.importe_general)} por contribuyente, que se restan de la cuota: en Navarra el mínimo personal es una deducción, no una reducción de la base.`,
    `${eur(b.incremento_rentas_bajas)} más si las rentas del contribuyente no superan ${eur(b.umbral_rentas_bajas)}.`,
    `${eur(b.incremento_65)} más desde los 65 años, o ${eur(b.incremento_75)} desde los 75 (no se suman).`,
    `${eur(b.incremento_discapacidad_33_64)} más con un grado de discapacidad de entre el 33 % y el 64 %, o ${eur(b.incremento_discapacidad_65_mas)} con un grado igual o superior al 65 %.`]],
  deduccion_alquiler_navarra: b => ["Por alquiler de la vivienda habitual", [
    `${pctCorto(b.general.porcentaje)} de lo pagado, con un máximo de ${eur(b.general.limite)} al año.`,
    `${pctCorto(b.joven_o_monoparental.porcentaje)}, con un máximo de ${eur(b.joven_o_monoparental.limite)}, para los menores de ${b.joven_o_monoparental.edad_max} años y las familias monoparentales.`,
    `Requisitos: que las rentas del contribuyente no superen ${eur(b.rentas_max)} y que el alquiler supere el ${pctCorto(b.umbral_esfuerzo)} de esas rentas.`]]
};

function fichaForal(clave, b, t, regimen) {
  const k = regimen === "foral_navarra" && clave === "deduccion_alquiler_vivienda" ? "deduccion_alquiler_navarra" : clave;
  if (!FORAL[k]) return { error: `${t} ${clave}: bloque sin texto` };
  let r;
  try { r = FORAL[k](b, t); } catch (e) { return { error: `${t} ${clave}: ${e.message}` }; }
  if (!r || r.some(x => x == null) || r[1].some(x => /undefined|NaN/.test(x))) return { error: `${t} ${clave}: faltan datos` };
  const url = Object.entries(URL_FUENTE_FORAL).find(([p]) => (b.fuente || "").includes(p));
  const fuentes = [...enlacesBoe(b.fuente), url ? `<a href="${url[1]}" rel="noopener">${esc(url[0])}</a>` : null].filter(Boolean);
  return { html: `<div class="tarjeta ficha-deduccion">
    <h2 class="rotulo">${esc(r[0])}</h2>
    <div class="supuesto"><ul>${r[1].map(q => `<li>${esc(q)}</li>`).join("")}</ul></div>
    <p class="fuente">Norma: ${esc(b.norma)}. Fuente: ${esc(b.fuente)}${fuentes.length ? ` (${fuentes.join(" · ")})` : ""}.</p>
  </div>`, titulo: r[0] };
}

// ---- página ---------------------------------------------------------------------------
export function paginaDeducciones(codigo, t, generado, avisos) {
  const slug = SLUG[codigo], nombre = t.nombre;
  const fichas = [];
  if (t.regimen === "comun") {
    for (const f of t.fichas) {
      const r = redactarFicha(f);
      if (r.error) { avisos.push(`${codigo}: «${f.titulo}» no se publica (${r.error})`); continue; }
      fichas.push({ titulo: r.titulo, html: htmlFicha(r) });
    }
  } else {
    for (const [k, b] of Object.entries(t.bloques)) {
      const r = fichaForal(k, b, codigo, t.regimen);
      if (r.error) { avisos.push(r.error); continue; }
      fichas.push(r);
    }
  }
  if (!fichas.length) return null;

  const comun = t.regimen === "comun";
  const ruta = `/irpf/${slug}/deducciones/`;
  const title = `Deducciones del IRPF en ${nombre} (2025) | Mapafiscal`;
  const description = comun
    ? `Deducciones autonómicas de ${nombre} en la renta 2025: ${fichas.slice(0, 3).map(f => f.titulo.replace(/^(Por|Para) /, "").toLowerCase()).join(", ")}… Importes, límites, requisitos y la norma de cada una.`
    : `Deducciones de la cuota del IRPF en ${nombre} en 2025 (${fichas.slice(0, 3).map(f => f.titulo.replace(/^(Por|Para) /, "").toLowerCase()).join(", ")}…): importes, límites y la norma foral de cada una.`;
  const migas = [["Inicio", "/"], ["IRPF por territorio", "/irpf/"], [nombre, `/irpf/${slug}/`], ["Deducciones", ruta]];
  const intro = comun
    ? `<p class="entradilla">Las comunidades de régimen común pueden aprobar deducciones propias, que se restan de la parte autonómica de la cuota. Estas son deducciones de ${esc(nombre)} para la declaración de la renta de 2025 (la que se presenta en 2026), con su importe, sus requisitos principales y la norma que las regula.</p>`
    : `<p class="entradilla">${esc(nombre)} tiene su propio IRPF foral: en lugar del mínimo personal y familiar y de las deducciones autonómicas del régimen común, aplica sus propias deducciones en la cuota. Estas son algunas de las principales del ejercicio 2025, con su importe y su norma${t.norma_base ? ` (${esc(t.norma_base)})` : ""}.</p>`;
  const main = `
  <h1>Deducciones del IRPF en ${esc(nombre)} (2025)</h1>
  ${intro}
  <div class="prosa">
  <div class="tarjeta indice-fichas"><h2 class="rotulo">En esta página</h2><ul>${fichas.map(f => `<li>${esc(f.titulo)}</li>`).join("")}</ul>
  <p class="ayuda">${comun ? "Cuando hablamos de hijos nos referimos a los descendientes que dan derecho al mínimo por descendientes. " : ""}Cada deducción enlaza su norma y su fuente oficial, donde están los requisitos completos.</p></div>
  ${fichas.map(f => f.html).join("\n  ")}
  <p><a class="btn btn-pri" href="${HERRAMIENTA.calculadora}">Calcula tu renta en ${esc(nombre)} con tus deducciones</a> <a class="btn btn-sec" href="/irpf/${slug}/">Tramos y mínimo en ${esc(nombre)}</a></p>
  <p class="ayuda">Más guías: <a href="/guias/minimo-personal-familiar/">mínimo personal y familiar</a> · <a href="/guias/deduccion-donativos/">deducción por donativos</a> · <a href="/guias/plan-pensiones-desgravar/">cuánto desgrava un plan de pensiones</a>.</p>
  </div>`;
  return {
    ruta, titulos: fichas.map(f => f.titulo),
    html: layout({
      title, description, canonical: ruta, breadcrumb: migasHtml(migas), main, generado,
      css: ["/css/guias.css"],
      jsonld: [jsonLdMigas(migas), jsonLdArticulo({ titulo: `Deducciones del IRPF en ${nombre} (2025)`, descripcion: description, ruta, generado })]
    })
  };
}
