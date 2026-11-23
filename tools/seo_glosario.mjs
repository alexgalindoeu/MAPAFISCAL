// =============================================================================
// Glosario del IRPF: /glosario/ (índice de la A a la Z) y una página por término en
// /glosario/<termino>/. Las definiciones son texto propio; cada término cita el artículo de
// la Ley 35/2006 (o la norma foral que ya recogen los parámetros) que lo regula. Los ejemplos
// numéricos salen del motor JS (web/js/irpfsim.js) y de los JSON SEO exportados por el motor
// R (seo_comparativas.json, seo_guias.json): aquí no se escribe ninguna cifra a mano. Si el
// motor y la comparativa no cuadran al céntimo, la página sale sin ejemplo.
// Lo usa tools/generar_paginas_seo.mjs, que también llama a enlazarGlosario() para enlazar
// la primera aparición de los términos clave en las guías y en /irpf/.
// =============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITIO, HERRAMIENTA, esc, euros, eurosExactos, pct, pctCorto, layout, jsonLdMigas, migasHtml, tituloQueQuepa, combinarEscalas, LIRPF_BOE, urlBoe } from "./seo_comun.mjs";
import { ejemploPasoAPaso } from "./seo_foral.mjs";

const require = createRequire(import.meta.url);
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const motor = require(join(WEB, "js", "irpfsim.js"));
export const HUB_GLOSARIO = "/glosario/";
const rutaTermino = slug => `${HUB_GLOSARIO}${slug}/`;

function paramsDe(ej) {
  for (const n of readdirSync(join(WEB, "datos")).filter(n => /^params(_\d{4})?\.json$/.test(n))) {
    const P = JSON.parse(readFileSync(join(WEB, "datos", n), "utf8"));
    if (P.ejercicio === ej) return P;
  }
  return null;
}

// ---- datos del ejemplo de referencia: 30.000 € brutos en Madrid -------------------------
// El mismo caso que la comparativa de seo_comparativas.json, liquidado con el motor JS para
// tener los pasos intermedios. Solo se usa si la cuota cuadra con la de la comparativa.
function datosEjemplo(comparativas, guias) {
  const ej = comparativas.ejercicio, P = paramsDe(ej);
  const fila = (comparativas.comparativas["30000"] || []).find(f => f.territorio === "ES-MD");
  if (!P || !fila) return null;
  const asal = b => ({ territorio: "ES-MD", ejercicio: ej, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no",
    miembros: [{ id: "d1", rol: "declarante", edad: 40, trabajo: { dinerarias: b, cotizacionesSs: motor.cotizacionesTrabajador(b, P) } }] });
  const liq = motor.liquidar(asal(30000), P, "auto");
  if (Math.abs(liq.cuotaLiquidaTotal - fila.cuota_liquida_total) > 0.005) return null;
  const c = liq.componentesRenta, cot = motor.cotizacionesTrabajador(30000, P);
  const E = P.estatal, A = P.territorios["ES-MD"];
  const otros = E.trabajo_otros_gastos;
  if (Math.abs(30000 - cot - otros.generico - c.trabajoNeto) > 0.005) return null;
  const marg = { estatal: motor.tipoMarginal(liq.baseLiquidableGeneral, E.escala_general_estatal),
    autonomico: motor.tipoMarginal(liq.baseLiquidableGeneral, A.escala_general_autonomica) };
  // reducción por rendimientos del trabajo: un sueldo bajo del mismo caso
  const bajo = 16000, liqBajo = motor.liquidar(asal(bajo), P, "auto").componentesRenta;
  // minoración foral: Bizkaia con el mismo sueldo (paso a paso del motor, ver seo_foral.mjs)
  const biz = ejemploPasoAPaso("ES-PV-BI", ej, 30000);
  const filaBiz = (comparativas.comparativas["30000"] || []).find(f => f.territorio === "ES-PV-BI");
  const bizOk = biz && filaBiz && Math.abs(biz.cuotaLiquida - filaBiz.cuota_liquida_total) < 0.005 ? biz : null;
  return { ej, P, liq, c, cot, fila, otros, marg, bajo, liqBajo, cotBajo: motor.cotizacionesTrabajador(bajo, P),
    biz: bizOk, mpf: guias.minimos.contribuyente, supuesto: comparativas.supuesto };
}

const ex = eurosExactos;
const art = (txt, url = LIRPF_BOE, norma = "Ley 35/2006, del IRPF") => ({ txt, url, norma });
const pie = d => `<p class="ayuda">Caso: 30.000 € brutos al año en la Comunidad de Madrid, ejercicio ${esc(d.ej)}. ${esc(d.supuesto)} Cálculo del mismo motor que la calculadora.</p>`;

// ---- términos -------------------------------------------------------------------------
// nombre: como se escribe en la página; titulo: <title> (≤ 65); patron: primera aparición
// que se enlaza desde las guías y /irpf/ (solo los términos clave lo llevan).
export const TERMINOS = [
  { slug: "base-imponible", nombre: "Base imponible", titulo: "Base imponible del IRPF: qué es y cómo se calcula",
    patron: "bases? imponibles?",
    def: ["La base imponible es la suma de todo lo que has ganado en el año a efectos del IRPF, después de restar a cada tipo de renta sus gastos deducibles y sus reducciones propias. Es la primera foto completa de tu renta: sueldos, alquileres, intereses, ganancias por vender bienes o el beneficio de una actividad.",
      "La ley la divide en dos partes que no se mezclan: la base imponible general (trabajo, alquileres, actividades y ganancias que no vienen de vender bienes) y la base imponible del ahorro (intereses, dividendos y ganancias por transmisiones). Cada una sigue luego su propio camino hasta la cuota."],
    norma: art("Arts. 15, 48 y 49 de la Ley 35/2006"),
    rel: ["base-liquidable", "base-ahorro", "rendimiento-neto", "ganancia-patrimonial", "rentas-exentas"],
    usa: [["Calculadora del IRPF", HERRAMIENTA.calculadora], ["Cómo calculamos", "/index.html#metodologia"]],
    ejemplo: d => `<p>Con un único sueldo, la base imponible general es el rendimiento neto del trabajo: <b>${esc(ex(d.liq.baseImponibleGeneral))}</b>. La del ahorro es ${esc(ex(d.liq.baseImponibleAhorro))}, porque no hay intereses ni ganancias.</p>${pie(d)}` },
  { slug: "base-liquidable", nombre: "Base liquidable", titulo: "Base liquidable del IRPF: qué es y cómo se calcula",
    patron: "bases? liquidables?",
    def: ["La base liquidable es la base imponible menos las reducciones que la ley permite restar por circunstancias personales: sobre todo las aportaciones a planes de pensiones y otros sistemas de previsión social, la reducción por tributación conjunta y las pensiones compensatorias al excónyuge.",
      "Es la cifra a la que se aplican los tramos de la escala. También se divide en general y del ahorro; las reducciones se restan primero de la general y, si sobra, de la del ahorro. Si no tienes ninguna reducción, base imponible y base liquidable coinciden."],
    norma: art("Art. 50 de la Ley 35/2006 (reducciones: arts. 51 a 55 y 84.2)"),
    rel: ["base-imponible", "reduccion-prevision-social", "tributacion-conjunta", "escala-gravamen", "cuota-integra"],
    usa: [["Calculadora del IRPF", HERRAMIENTA.calculadora], ["Calculadora del plan de pensiones", HERRAMIENTA.planPensiones]],
    ejemplo: d => `<p>Sin aportaciones a planes de pensiones ni otras reducciones, la base liquidable general coincide con la imponible: <b>${esc(ex(d.liq.baseLiquidableGeneral))}</b>. A esa cifra se le aplican los tramos estatales y los de Madrid.</p>${pie(d)}` },
  { slug: "cuota-integra", nombre: "Cuota íntegra", titulo: "Cuota íntegra del IRPF: qué es y cómo se calcula",
    patron: "cuotas? íntegras?",
    def: ["La cuota íntegra es el impuesto que resulta de aplicar la escala de gravamen a la base liquidable, antes de restar ninguna deducción. En régimen común se calcula dos veces: una con la escala estatal y otra con la escala de tu comunidad autónoma, y la suma de las dos es la cuota íntegra total.",
      "El mínimo personal y familiar se tiene en cuenta en este paso: la ley aplica la escala a la base y le resta lo que saldría de aplicarla al mínimo, de modo que esa parte de tu renta no paga impuesto."],
    norma: art("Arts. 62, 63, 73 y 74 de la Ley 35/2006"),
    rel: ["base-liquidable", "escala-gravamen", "minimo-personal-familiar", "cuota-liquida", "tipo-marginal"],
    usa: [["Calculadora del IRPF", HERRAMIENTA.calculadora], ["Tramos del IRPF 2025 y 2026", "/guias/tramos-irpf-2025-2026/"]],
    ejemplo: d => `<p>Cuota íntegra estatal: <b>${esc(ex(d.liq.cuotaIntegraEstatal))}</b>. Cuota íntegra autonómica de Madrid: <b>${esc(ex(d.liq.cuotaIntegraAutonomica))}</b>. Total: <b>${esc(ex(d.liq.cuotaIntegraTotal))}</b>.</p>${pie(d)}` },
  { slug: "cuota-liquida", nombre: "Cuota líquida", titulo: "Cuota líquida del IRPF: qué es y cómo se calcula",
    patron: "cuotas? líquidas?",
    def: ["La cuota líquida es la cuota íntegra menos las deducciones: las estatales (por ejemplo, donativos o la deducción transitoria por vivienda habitual) se restan de la parte estatal, y las autonómicas, de la parte autonómica. Es lo que de verdad cuesta el IRPF del año.",
      "No hay que confundirla con lo que pagas o te devuelven al presentar la declaración: para eso falta restar lo que ya te retuvieron durante el año, que da la cuota diferencial."],
    norma: art("Arts. 67, 68, 77 y 78 de la Ley 35/2006"),
    rel: ["cuota-integra", "deduccion-autonomica", "cuota-diferencial", "tipo-medio"],
    usa: [["Calculadora del IRPF", HERRAMIENTA.calculadora], ["¿Cuánto me devuelve Hacienda?", "/cuanto-me-devuelve/"], ["Dónde se paga menos IRPF con 30.000 €", "/comparar-sueldo/30000/"]],
    ejemplo: d => `<p>Sin deducciones, la cuota líquida es igual a la íntegra: <b>${esc(ex(d.liq.cuotaLiquidaTotal))}</b> (${esc(ex(d.liq.cuotaLiquidaEstatal))} estatal y ${esc(ex(d.liq.cuotaLiquidaAutonomica))} autonómica). Con este sueldo Madrid ocupa el puesto ${esc(d.fila.puesto)} de 19 territorios.</p>${pie(d)}` },
  { slug: "cuota-diferencial", nombre: "Cuota diferencial", titulo: "Cuota diferencial del IRPF: qué es y cómo se calcula",
    patron: "cuotas? diferencial(?:es)?",
    def: ["La cuota diferencial es el resultado final de la declaración: la cuota líquida menos las retenciones e ingresos a cuenta que ya se pagaron durante el año, los pagos fraccionados y algunas deducciones que se restan al final, como la de maternidad o la de familia numerosa.",
      "Si sale positiva, tienes que pagar esa cantidad; si sale negativa, Hacienda te la devuelve. Por eso dos personas con el mismo IRPF pueden tener resultados opuestos: depende de cuánto les retuvieron."],
    norma: art("Art. 79 de la Ley 35/2006 (deducciones de los arts. 81 y 81 bis)"),
    rel: ["cuota-liquida", "retencion", "obligacion-declarar", "borrador"],
    usa: [["¿Cuánto me devuelve Hacienda?", "/cuanto-me-devuelve/"], ["Calculadora del IRPF", HERRAMIENTA.calculadora]] },
  { slug: "minimo-personal-familiar", nombre: "Mínimo personal y familiar", titulo: "Mínimo personal y familiar del IRPF: qué es",
    patron: "mínimos? personal(?:es)?(?: y familiar(?:es)?)?",
    def: ["El mínimo personal y familiar es la parte de tu renta que la ley considera necesaria para cubrir tus necesidades básicas y las de tu familia, y que por eso no paga IRPF. Se compone del mínimo del contribuyente y, según el caso, de los mínimos por descendientes, por ascendientes y por discapacidad.",
      "No se resta de la base, sino que se grava al principio de la escala y esa cuota se descuenta de la cuota íntegra. Las comunidades autónomas pueden fijar importes propios para su parte del impuesto."],
    norma: art("Arts. 56 a 61 de la Ley 35/2006"),
    rel: ["cuota-integra", "base-liquidable", "escala-gravamen", "tributacion-conjunta"],
    usa: [["Guía del mínimo personal y familiar", "/guias/minimo-personal-familiar/"], ["Calculadora del IRPF", HERRAMIENTA.calculadora]],
    ejemplo: d => `<p>Mínimo del contribuyente menor de 65 años: <b>${esc(euros(d.mpf.general))}</b> en la parte estatal (${esc(d.mpf.norma)}). Madrid aplica en su parte un importe propio: <b>${esc(ex(d.liq.minimoPersonalFamiliarAutonomico.contribuyente))}</b>.</p>${pie(d)}` },
  { slug: "reduccion-rendimientos-trabajo", nombre: "Reducción por rendimientos del trabajo", titulo: "Reducción por rendimientos del trabajo: qué es",
    patron: "reducción por (?:obtención de )?rendimientos del trabajo",
    def: ["La reducción por rendimientos del trabajo es una rebaja del rendimiento neto del trabajo pensada para los sueldos bajos. Se aplica completa por debajo de un umbral de rendimiento, va bajando a medida que el rendimiento sube y desaparece a partir de cierto importe.",
      "Solo tienen derecho quienes no tienen otras rentas, distintas del trabajo, por encima de un límite. En los territorios forales el mecanismo es distinto (una bonificación o una deducción en cuota)."],
    norma: art("Art. 20 de la Ley 35/2006"),
    rel: ["rendimientos-trabajo", "rendimiento-neto", "gastos-deducibles-trabajo", "base-imponible"],
    usa: [["Calculadora del sueldo neto", HERRAMIENTA.sueldoNeto], ["Calculadora del IRPF", HERRAMIENTA.calculadora]],
    ejemplo: d => d.liqBajo.reduccionTrabajo > 0 ? `<p>Con ${esc(euros(d.bajo))} brutos en Madrid (${esc(d.ej)}), el rendimiento antes de la reducción es de ${esc(ex(d.liqBajo.trabajoPrevio))} y la reducción, de <b>${esc(ex(d.liqBajo.reduccionTrabajo))}</b>: el rendimiento neto queda en ${esc(ex(d.liqBajo.trabajoNeto))}.${d.c.reduccionTrabajo === 0 ? " Con 30.000 € brutos ya no hay reducción." : ""}</p><p class="ayuda">Importe máximo de la reducción: ${esc(euros(d.P.estatal.trabajo_reduccion_art20.importe_maximo))} (${esc(d.P.estatal.trabajo_reduccion_art20.norma)}). Mismo supuesto que la comparativa: ${esc(d.supuesto)}</p>` : "" },
  { slug: "tipo-marginal", nombre: "Tipo marginal", titulo: "Tipo marginal del IRPF: qué es y cómo se calcula",
    patron: "tipos? marginal(?:es)?",
    def: ["El tipo marginal es el porcentaje que se aplica al último euro de tu base liquidable, es decir, el del tramo de la escala en el que cae. Indica cuánto de cada euro adicional que ganes se irá en IRPF.",
      "Que pases a un tramo con un tipo más alto no encarece todo tu sueldo: solo la parte que queda dentro de ese tramo. En régimen común el tipo marginal es la suma del tipo estatal y el autonómico del tramo."],
    norma: art("Arts. 63.1 y 74.1 de la Ley 35/2006 (escalas)"),
    rel: ["tipo-medio", "escala-gravamen", "base-liquidable", "cuota-integra"],
    usa: [["Tramos del IRPF 2025 y 2026", "/guias/tramos-irpf-2025-2026/"], ["IRPF en Madrid", "/irpf/madrid/"],
      ["Tipo marginal en Bizkaia por sueldo", "/irpf/bizkaia/#tipos-por-sueldo"], ["Tipo marginal en Navarra por sueldo", "/irpf/navarra/#tipos-por-sueldo"]],
    ejemplo: d => `<p>Con una base liquidable de ${esc(ex(d.liq.baseLiquidableGeneral))}, el tipo marginal estatal es del ${esc(pctCorto(d.marg.estatal))} y el autonómico de Madrid, del ${esc(pctCorto(d.marg.autonomico))}: en total, <b>${esc(pctCorto(Math.round((d.marg.estatal + d.marg.autonomico) * 10000) / 10000))}</b> sobre el siguiente euro de base.</p>${pie(d)}` },
  { slug: "tipo-medio", nombre: "Tipo medio", titulo: "Tipo medio del IRPF: qué es y cómo se calcula",
    patron: "tipos? medios?(?: efectivos?)?",
    def: ["El tipo medio es el porcentaje que representa el IRPF sobre tu renta. La ley define el tipo medio de gravamen como la cuota que sale de la escala dividida entre la base liquidable; en Mapafiscal mostramos el tipo medio efectivo, que divide la cuota líquida entre el sueldo bruto, para comparar territorios con una cifra fácil de entender.",
      "Siempre es más bajo que el tipo marginal, porque los primeros euros tributan a tipos menores y el mínimo personal no paga impuesto."],
    norma: art("Arts. 63.2 y 74.2 de la Ley 35/2006"),
    rel: ["tipo-marginal", "cuota-liquida", "escala-gravamen", "base-liquidable"],
    usa: [["Comparar territorios", HERRAMIENTA.comparar], ["Dónde se paga menos IRPF", "/comparar-sueldo/"]],
    ejemplo: d => `<p>${esc(ex(d.fila.cuota_liquida_total))} de cuota líquida sobre 30.000 € brutos: tipo medio efectivo del <b>${esc(pct(d.fila.tipo_medio_efectivo))}</b>, frente a un tipo marginal del ${esc(pctCorto(Math.round((d.marg.estatal + d.marg.autonomico) * 10000) / 10000))}.</p>${pie(d)}` },
  { slug: "escala-gravamen", nombre: "Escala de gravamen (tramos)", titulo: "Tramos del IRPF (escala de gravamen): qué son",
    def: ["La escala de gravamen es la tabla de tramos y tipos que convierte la base liquidable en cuota. Es progresiva: cada tramo de base paga su propio porcentaje, que sube a medida que sube la renta.",
      "En régimen común hay una escala estatal y otra autonómica, que se suman; la base del ahorro tiene escalas propias. Las haciendas forales del País Vasco y Navarra aplican una tarifa única y completa."],
    norma: art("Arts. 63, 66, 74 y 76 de la Ley 35/2006"),
    rel: ["tipo-marginal", "tipo-medio", "cuota-integra", "base-ahorro", "regimen-foral"],
    usa: [["Tramos del IRPF 2025 y 2026", "/guias/tramos-irpf-2025-2026/"], ["IRPF por territorio", "/irpf/"]],
    ejemplo: d => { const e = d.P.estatal.escala_general_estatal; return `<p>La escala estatal de ${esc(d.ej)} tiene ${e.length} tramos, del ${esc(pctCorto(e[0].tipo))} al ${esc(pctCorto(e[e.length - 1].tipo))}. Con 30.000 € en Madrid, la base cae en el tramo estatal del ${esc(pctCorto(d.marg.estatal))}.</p>${pie(d)}`; } },
  { slug: "retencion", nombre: "Retención", titulo: "Retención del IRPF: qué es y cómo funciona",
    patron: "retenci(?:ón|ones)",
    def: ["La retención es la parte del sueldo, la pensión u otras rentas que el pagador (tu empresa, el banco, el inquilino que es empresa) se queda y entrega a Hacienda a cuenta de tu IRPF. Es un adelanto: no es el impuesto definitivo.",
      "Al hacer la declaración se comparan las retenciones del año con la cuota líquida. Si te retuvieron de más, te devuelven la diferencia; si te retuvieron de menos (por ejemplo, con dos pagadores), toca pagar."],
    norma: art("Arts. 99 y 101 de la Ley 35/2006"),
    rel: ["cuota-diferencial", "obligacion-declarar", "rendimientos-trabajo", "cuota-liquida"],
    usa: [["Dos pagadores", "/dos-pagadores/"], ["Calculadora del sueldo neto", HERRAMIENTA.sueldoNeto], ["Sueldo neto por importe", "/sueldo-neto/"]] },
  { slug: "rendimiento-neto", nombre: "Rendimiento neto", titulo: "Rendimiento neto del IRPF: qué es y cómo se calcula",
    patron: "rendimientos? netos?",
    def: ["El rendimiento neto es lo que queda de una renta después de restar los gastos que la ley permite deducir. El rendimiento íntegro es el importe bruto; el neto es el que entra en la base imponible.",
      "Cada tipo de renta tiene sus gastos: en el trabajo, las cotizaciones a la Seguridad Social y una cantidad fija por otros gastos; en un alquiler, el IBI, los intereses de la hipoteca o la amortización; en una actividad, los gastos del negocio."],
    norma: art("Arts. 19, 23, 26 y 28 de la Ley 35/2006"),
    rel: ["gastos-deducibles-trabajo", "rendimientos-trabajo", "reduccion-rendimientos-trabajo", "base-imponible"],
    usa: [["Calculadora del sueldo neto", HERRAMIENTA.sueldoNeto], ["Calculadora del IRPF", HERRAMIENTA.calculadora]],
    ejemplo: d => `<p>Sueldo bruto de 30.000 € menos ${esc(ex(d.cot))} de cotizaciones y ${esc(euros(d.otros.generico))} de otros gastos (${esc(d.otros.norma)}): rendimiento neto del trabajo de <b>${esc(ex(d.c.trabajoNeto))}</b>.</p>${pie(d)}` },
  { slug: "rendimientos-trabajo", nombre: "Rendimientos del trabajo", titulo: "Rendimientos del trabajo en el IRPF: qué son",
    def: ["Son las rentas que vienen, directa o indirectamente, de un trabajo personal por cuenta ajena: el sueldo, las pagas extra, la retribución en especie, las pensiones públicas, las prestaciones por desempleo y el rescate de planes de pensiones, entre otras.",
      "Se integran en la base imponible general y tributan con la escala general. Tienen sus propios gastos deducibles y, para los sueldos bajos, una reducción específica."],
    norma: art("Arts. 17 y 18 de la Ley 35/2006"),
    rel: ["rendimiento-neto", "gastos-deducibles-trabajo", "reduccion-rendimientos-trabajo", "retencion"],
    usa: [["Calculadora del sueldo neto", HERRAMIENTA.sueldoNeto], ["Rescate del plan de pensiones", "/rescate-plan-pensiones/"]] },
  { slug: "gastos-deducibles-trabajo", nombre: "Gastos deducibles del trabajo", titulo: "Gastos deducibles del trabajo en el IRPF: cuáles son",
    def: ["Son las cantidades que se restan del sueldo bruto para llegar al rendimiento neto del trabajo: las cotizaciones a la Seguridad Social, las cuotas sindicales y de colegios profesionales obligatorios, los gastos de defensa jurídica frente al pagador (con límite) y una cantidad fija por otros gastos.",
      "Esa cantidad fija sube si aceptas un puesto que te obliga a cambiar de municipio o si tienes una discapacidad, y nunca puede dejar el rendimiento en negativo."],
    norma: art("Art. 19.2 de la Ley 35/2006"),
    rel: ["rendimiento-neto", "rendimientos-trabajo", "reduccion-rendimientos-trabajo"],
    usa: [["Calculadora del sueldo neto", HERRAMIENTA.sueldoNeto]],
    ejemplo: d => `<p>Con 30.000 € brutos se restan ${esc(ex(d.cot))} de cotizaciones del trabajador y ${esc(euros(d.otros.generico))} de otros gastos (${esc(d.otros.norma)}).</p>${pie(d)}` },
  { slug: "rendimientos-capital-mobiliario", nombre: "Rendimientos del capital mobiliario", titulo: "Rendimientos del capital mobiliario: qué son",
    def: ["Son lo que obtienes por ceder a otros tu dinero o participar en sus fondos propios: intereses de cuentas y depósitos, dividendos, cupones de bonos, rendimientos de seguros de vida o de capitalización y algunas rentas vitalicias.",
      "La mayoría forma parte de la base del ahorro; otros, como los obtenidos por ceder derechos de imagen o por prestar asistencia técnica, van a la base general. Solo se pueden restar algunos gastos, como los de administración y depósito de valores."],
    norma: art("Arts. 25 y 26 de la Ley 35/2006"),
    rel: ["base-ahorro", "rendimiento-neto", "ganancia-patrimonial", "retencion"],
    usa: [["Calculadora del IRPF", HERRAMIENTA.calculadora]] },
  { slug: "rendimientos-capital-inmobiliario", nombre: "Rendimientos del capital inmobiliario", titulo: "Rendimientos del capital inmobiliario: qué son",
    def: ["Son las rentas que obtienes por alquilar o ceder el uso de inmuebles de tu propiedad, o de los que tienes un derecho real como el usufructo. Lo que se declara es el rendimiento neto: ingresos menos gastos como el IBI, la comunidad, los intereses de la financiación, las reparaciones o la amortización.",
      "Si el inmueble se alquila como vivienda, la ley permite reducir el rendimiento neto positivo en un porcentaje. Tributan en la base general. Las viviendas vacías que no son la habitual generan, en cambio, una imputación de rentas."],
    norma: art("Arts. 22, 23 y 24 de la Ley 35/2006"),
    rel: ["imputacion-rentas-inmobiliarias", "rendimiento-neto", "base-imponible"],
    usa: [["Calculadora del IRPF", HERRAMIENTA.calculadora]] },
  { slug: "rendimientos-actividades-economicas", nombre: "Rendimientos de actividades económicas", titulo: "Rendimientos de actividades económicas en el IRPF",
    def: ["Son los beneficios de trabajar por cuenta propia: autónomos, profesionales, comerciantes, agricultores o artistas que organizan medios propios para producir bienes o servicios. Se calculan con estimación directa (ingresos menos gastos reales, con una versión simplificada) o, en algunas actividades, con estimación objetiva por módulos.",
      "El rendimiento neto se integra en la base general. Los autónomos también soportan retenciones o hacen pagos fraccionados a lo largo del año."],
    norma: art("Arts. 27 a 32 de la Ley 35/2006"),
    rel: ["rendimiento-neto", "base-imponible", "retencion", "obligacion-declarar"],
    usa: [["Calculadora del IRPF", HERRAMIENTA.calculadora]] },
  { slug: "ganancia-patrimonial", nombre: "Ganancia patrimonial", titulo: "Ganancia patrimonial en el IRPF: qué es y cómo tributa",
    patron: "ganancias? patrimonial(?:es)?",
    def: ["Una ganancia (o pérdida) patrimonial es la variación del valor de tu patrimonio cuando cambia su composición: vender un piso, acciones o fondos por más (o menos) de lo que costaron, recibir un premio o una subvención. La ganancia es, en general, la diferencia entre el valor de transmisión y el de adquisición, gastos incluidos.",
      "Las que vienen de vender bienes van a la base del ahorro; las demás, como los premios no exentos o las subvenciones, a la base general. Hay supuestos exentos, como la reinversión en vivienda habitual."],
    norma: art("Arts. 33 a 39 de la Ley 35/2006"),
    rel: ["base-ahorro", "base-imponible", "rentas-exentas", "obligacion-declarar"],
    usa: [["Calculadora del IRPF", HERRAMIENTA.calculadora]] },
  { slug: "base-ahorro", nombre: "Base del ahorro", titulo: "Base del ahorro del IRPF: qué es y cómo tributa",
    patron: "bases? (?:imponibles? |liquidables? )?del ahorro",
    def: ["La base del ahorro reúne los rendimientos del capital mobiliario (intereses, dividendos, seguros) y las ganancias y pérdidas patrimoniales que vienen de vender bienes. Tributa con una escala propia, más baja y con menos tramos que la general, y sin mezclarse con los sueldos.",
      "Dentro de ella se pueden compensar rendimientos negativos con ganancias, y al revés, con límites. El mínimo personal que no se agota en la base general se aplica a la del ahorro."],
    norma: art("Arts. 46, 49, 66 y 76 de la Ley 35/2006"),
    rel: ["base-imponible", "rendimientos-capital-mobiliario", "ganancia-patrimonial", "escala-gravamen"],
    usa: [["Tramos del IRPF 2025 y 2026", "/guias/tramos-irpf-2025-2026/"], ["Calculadora del IRPF", HERRAMIENTA.calculadora]],
    ejemplo: d => { const E = d.P.estatal, s = combinarEscalas(E.escala_ahorro_estatal, E.escala_ahorro_autonomica);
      return `<p>En ${esc(d.ej)}, en régimen común, la escala del ahorro (estatal más autonómica) va del ${esc(pctCorto(s[0].tipo))} hasta ${esc(euros(s[0].hasta))} al ${esc(pctCorto(s[s.length - 1].tipo))} a partir de ${esc(euros(s[s.length - 2].hasta))}, en ${s.length} tramos. Es la que aplica la calculadora.</p>`; } },
  { slug: "tributacion-conjunta", nombre: "Tributación conjunta", titulo: "Tributación conjunta en el IRPF: qué es y cuándo conviene",
    patron: "(?:tributación|declaración|declaraciones) conjuntas?",
    def: ["La tributación conjunta es la opción de presentar una sola declaración para toda la unidad familiar: el matrimonio con sus hijos menores, o el padre o la madre con los hijos que conviven con él o ella. Las rentas de todos se suman y, a cambio, se aplica una reducción en la base.",
      "Suele convenir cuando uno de los miembros gana mucho menos que el otro o no tiene ingresos. Si los dos tienen sueldos parecidos, casi siempre sale mejor la individual, porque la escala progresiva grava más la renta sumada."],
    norma: art("Arts. 82 a 84 de la Ley 35/2006"),
    rel: ["base-liquidable", "minimo-personal-familiar", "obligacion-declarar", "cuota-liquida"],
    usa: [["Declaración conjunta o individual", "/declaracion-conjunta/"], ["Calculadora del IRPF", HERRAMIENTA.calculadora]],
    ejemplo: d => { const r = d.P.estatal.reduccion_tributacion_conjunta; return `<p>Reducción de la base en ${esc(d.ej)}: <b>${esc(euros(r.biparental))}</b> por unidad familiar con matrimonio y <b>${esc(euros(r.monoparental))}</b> en la monoparental (${esc(r.norma)}). Es la que aplica la calculadora en régimen común.</p>`; } },
  { slug: "deduccion-autonomica", nombre: "Deducción autonómica", titulo: "Deducciones autonómicas del IRPF: qué son",
    patron: "deducci(?:ón|ones) autonómicas?",
    def: ["Las deducciones autonómicas son rebajas que aprueba cada comunidad autónoma de régimen común y que se restan de la parte autonómica de la cuota. Premian situaciones como tener hijos, alquilar la vivienda habitual, vivir en zonas despobladas o pagar guardería.",
      "Cada comunidad tiene su propio catálogo, con requisitos y límites de renta distintos, y lo cambia casi cada año en su ley de presupuestos o de tributos cedidos."],
    norma: art("Art. 77 de la Ley 35/2006 (y la ley de tributos cedidos de cada comunidad)"),
    rel: ["cuota-liquida", "cuota-integra", "regimen-foral", "residencia-fiscal"],
    usa: [["Deducciones por territorio", "/irpf/"], ["¿Cuánto me devuelve Hacienda?", "/cuanto-me-devuelve/"], ["Calculadora del IRPF", HERRAMIENTA.calculadora]] },
  { slug: "regimen-foral", nombre: "Régimen foral", titulo: "Régimen foral del IRPF: País Vasco y Navarra",
    patron: "régimen(?:es)? foral(?:es)?",
    def: ["El régimen foral es el sistema por el que los tres territorios históricos del País Vasco (Álava, Bizkaia y Gipuzkoa) y la Comunidad Foral de Navarra regulan y recaudan su propio IRPF, en virtud del Concierto y del Convenio Económico. Sus residentes no aplican la Ley 35/2006, sino la norma foral de su territorio.",
      "Cada hacienda foral fija su tarifa completa (no hay mitad estatal y mitad autonómica), sus deducciones y su sistema de mínimos, que se aplican como deducciones en la cuota."],
    norma: art("Art. 4.2 de la Ley 35/2006 (ámbito de aplicación)"),
    rel: ["minoracion-cuota", "escala-gravamen", "deduccion-autonomica", "residencia-fiscal"],
    usa: [["IRPF en Gipuzkoa", "/irpf/gipuzkoa/"], ["Tablas IRPF Bizkaia", "/irpf/bizkaia/"], ["La renta en Álava: quién la gestiona y cómo se presenta", "/irpf/araba-alava/#renta"],
      ["IRPF en Navarra", "/irpf/navarra/"], ["Los territorios vascos, comparados", "/irpf/pais-vasco/"]] },
  { slug: "minoracion-cuota", nombre: "Minoración de cuota (forales)", titulo: "Minoración de cuota en el IRPF foral: qué es",
    patron: "minoraci(?:ón|ones) (?:general )?de (?:la )?cuota",
    def: ["La minoración de cuota es una cantidad fija que las haciendas forales del País Vasco restan de la cuota íntegra de cada contribuyente. Cumple el papel que en régimen común tiene el mínimo del contribuyente: en lugar de dejar sin gravar una parte de la base, rebaja directamente el impuesto.",
      "Si la cuota íntegra es menor que la minoración, el resultado es cero, sin devolución. Las deducciones por hijos, ascendientes o discapacidad se suman después."],
    normaParams: d => d.P.foral_pv.minoracion_cuota.norma,
    rel: ["regimen-foral", "minimo-personal-familiar", "cuota-integra", "cuota-liquida"],
    usa: [["Renta en Gipuzkoa: minoración y deducciones forales", "/irpf/gipuzkoa/#renta"], ["IRPF en Bizkaia: ejemplo con la minoración", "/irpf/bizkaia/#ejemplo-30000"],
      ["Tipo marginal y medio en Álava", "/irpf/araba-alava/#tipos-por-sueldo"], ["Simulador de la renta foral de Gipuzkoa", "/irpf/gipuzkoa/simulador-renta/"]],
    ejemplo: d => { const m = d.biz && d.biz.restas.find(([n]) => /^Minoración/.test(n)); if (!m) return "";
      return `<p>En Bizkaia (${esc(d.ej)}), con 30.000 € brutos, la cuota íntegra foral es de ${esc(ex(d.biz.cuotaIntegra))}; se restan <b>${esc(ex(m[1]))}</b> de minoración general y queda una cuota líquida de ${esc(ex(d.biz.cuotaLiquida))}.</p><p class="ayuda">Mismo supuesto que la comparativa: ${esc(d.supuesto)} <a href="/irpf/bizkaia/#ejemplo-30000">Ver el ejemplo paso a paso</a>.</p>`; } },
  { slug: "obligacion-declarar", nombre: "Obligación de declarar", titulo: "Obligación de declarar la renta: qué es y quién",
    patron: "obligaci(?:ón|ones) de declarar|obligados? a declarar",
    def: ["La obligación de declarar fija quién tiene que presentar la declaración de la renta. Como regla general, están obligados todos los contribuyentes, salvo los que solo tienen rentas por debajo de ciertos límites: sueldos de un único pagador, sueldos de varios pagadores con poco cobrado del segundo, pequeñas cantidades de intereses o ganancias con retención, etc.",
      "Que no estés obligado no impide declarar, y a menudo conviene: si te retuvieron más de la cuota líquida, solo recuperas la diferencia presentando la declaración."],
    norma: art("Art. 96 de la Ley 35/2006"),
    rel: ["cuota-diferencial", "retencion", "borrador", "renta-web"],
    usa: [["¿Estoy obligado a declarar?", "/guias/obligacion-declarar-renta/"], ["Dos pagadores", "/dos-pagadores/"]],
    ejemploG: g => { const o = g.obligacion_declarar.estatal; return `<p>Para la renta de ${esc(g.ejercicio)}, con un solo pagador no hay obligación por debajo de <b>${esc(euros(o.trabajo_un_pagador))}</b> de rendimientos del trabajo; con varios pagadores, si el segundo y siguientes suman más de ${esc(euros(o.segundo_pagador_umbral))}, el límite baja a <b>${esc(euros(o.trabajo_varios_pagadores))}</b> (${esc(o.norma)}).</p>`; } },
  { slug: "borrador", nombre: "Borrador de la renta", titulo: "Borrador de la renta: qué es y cómo revisarlo",
    patron: "borrador(?:es)?",
    def: ["El borrador es la propuesta de declaración que prepara la Agencia Tributaria con los datos que tiene de ti: sueldos y retenciones que declaran los pagadores, intereses, catastro, hijos de años anteriores… Puedes confirmarlo tal cual o modificarlo antes de presentarlo.",
      "Hacienda no conoce todo lo que te afecta, sobre todo muchas deducciones autonómicas, aportaciones o gastos. Si lo confirmas sin revisar, puedes pagar de más o dejar de declarar algo."],
    norma: art("Art. 98 de la Ley 35/2006"),
    rel: ["renta-web", "obligacion-declarar", "cuota-diferencial", "deduccion-autonomica"],
    usa: [["Calendario de la renta", "/guias/calendario-renta/"], ["Calculadora del IRPF", HERRAMIENTA.calculadora]] },
  { slug: "renta-web", nombre: "Renta Web", titulo: "Renta Web: qué es y cómo se presenta la renta",
    patron: "Renta Web",
    def: ["Renta Web es el servicio en línea de la Agencia Tributaria para consultar el borrador, completarlo o hacer la declaración desde cero y presentarla, en régimen común. Se accede con Cl@ve, certificado electrónico o número de referencia, y calcula el resultado a medida que se rellenan las casillas.",
      "Los territorios forales tienen sus propios programas (los de las haciendas forales de Álava, Bizkaia, Gipuzkoa y Navarra)."],
    normaCal: true,
    rel: ["borrador", "obligacion-declarar", "cuota-diferencial", "regimen-foral"],
    usa: [["Calendario de la renta", "/guias/calendario-renta/"], ["¿Estoy obligado a declarar?", "/guias/obligacion-declarar-renta/"]] },
  { slug: "reduccion-prevision-social", nombre: "Reducción por planes de pensiones", titulo: "Reducción por planes de pensiones en el IRPF",
    def: ["Las aportaciones a planes de pensiones y a otros sistemas de previsión social (planes de empleo, mutualidades, PPA) se restan de la base imponible general, con límites. Por eso desgravan: reducen la base a la que se aplica el tipo marginal.",
      "No es una exención para siempre: lo que se reduce ahora tributa como rendimiento del trabajo cuando se rescata el plan."],
    norma: art("Arts. 51 y 52 de la Ley 35/2006"),
    rel: ["base-liquidable", "tipo-marginal", "rendimientos-trabajo"],
    usa: [["Plan de pensiones: cuánto desgrava", "/guias/plan-pensiones-desgravar/"], ["Calculadora del plan de pensiones", HERRAMIENTA.planPensiones], ["Rescate del plan de pensiones", "/rescate-plan-pensiones/"]],
    ejemploG: g => { const r = g.prevision_social.reduccion; return `<p>Límite general de aportación propia en ${esc(g.ejercicio)}: <b>${esc(euros(r.limite_general_abs))}</b> al año y no más del ${esc(pctCorto(r.limite_general_pct_rend))} de los rendimientos netos del trabajo y de actividades (${esc(r.norma)}).</p>`; } },
  { slug: "deduccion-donativos", nombre: "Deducción por donativos", titulo: "Deducción por donativos en el IRPF: qué es",
    def: ["La deducción por donativos permite restar de la cuota un porcentaje de lo donado a ONG, fundaciones y otras entidades acogidas a la Ley 49/2002, y a otras entidades con un porcentaje menor. Los primeros euros donados deducen más que el resto, y la donación recurrente a la misma entidad eleva el porcentaje.",
      "La base de la deducción tiene un límite en proporción a la base liquidable. Muchas comunidades autónomas añaden deducciones propias por donativos."],
    norma: art("Art. 68.3 de la Ley 35/2006 y art. 19 de la Ley 49/2002"),
    rel: ["cuota-liquida", "deduccion-autonomica", "base-liquidable"],
    usa: [["Guía de la deducción por donativos", "/guias/deduccion-donativos/"], ["¿Cuánto me devuelve un donativo?", "/cuanto-me-devuelve/donativo/"]],
    ejemploG: g => { const l = g.donativos.estatal.ley49_2002; return `<p>En ${esc(g.ejercicio)}: el ${esc(pctCorto(l.tramo1_porcentaje))} de los primeros ${esc(euros(l.tramo1_limite))} y el ${esc(pctCorto(l.resto_porcentaje))} del resto (${esc(pctCorto(l.resto_porcentaje_recurrente))} si es recurrente), con una base máxima del ${esc(pctCorto(l.limite_base_liquidable_pct))} de la base liquidable (${esc(g.donativos.estatal.norma)}).</p>`; } },
  { slug: "rentas-exentas", nombre: "Rentas exentas", titulo: "Rentas exentas del IRPF: qué son",
    def: ["Las rentas exentas son ingresos que la ley deja fuera del IRPF aunque se cobren: entre otros, algunas indemnizaciones por despido dentro de límites, las prestaciones por incapacidad permanente absoluta o gran invalidez, ciertas becas, determinados premios y las ayudas públicas por nacimiento o adopción.",
      "No se declaran ni cuentan para la base imponible. Ojo: que una renta esté exenta no significa que no cuente para otras cosas, como los límites de renta de algunas deducciones autonómicas."],
    norma: art("Art. 7 de la Ley 35/2006"),
    rel: ["base-imponible", "ganancia-patrimonial", "obligacion-declarar"],
    usa: [["Calculadora del IRPF", HERRAMIENTA.calculadora]] },
  { slug: "residencia-fiscal", nombre: "Residencia fiscal", titulo: "Residencia fiscal en el IRPF: qué es y por qué importa",
    def: ["La residencia fiscal decide dos cosas: si pagas IRPF en España (por regla general, si pasas aquí más de 183 días al año o tienes aquí el centro de tus intereses) y en qué comunidad autónoma o territorio foral tributas, que es aquel en el que hayas vivido más días del año.",
      "Por eso mudarte cambia la escala autonómica, el mínimo y las deducciones que aplicas, y por eso la calculadora te pregunta el territorio."],
    norma: art("Arts. 9 y 72 de la Ley 35/2006"),
    rel: ["deduccion-autonomica", "regimen-foral", "escala-gravamen"],
    usa: [["Comparar territorios", HERRAMIENTA.comparar], ["IRPF por territorio", "/irpf/"]] },
  { slug: "imputacion-rentas-inmobiliarias", nombre: "Imputación de rentas inmobiliarias", titulo: "Imputación de rentas inmobiliarias: qué es",
    def: ["La imputación de rentas inmobiliarias es una renta que la ley atribuye por tener inmuebles urbanos que no son tu vivienda habitual ni están alquilados ni afectos a una actividad, como una segunda residencia o un piso vacío. Aunque no cobres nada, se suma a la base general un porcentaje de su valor catastral.",
      "No se aplica a la vivienda habitual, a los solares sin edificar ni a los inmuebles alquilados, que declaran rendimientos del capital inmobiliario."],
    norma: art("Art. 85 de la Ley 35/2006"),
    rel: ["rendimientos-capital-inmobiliario", "base-imponible", "obligacion-declarar"],
    usa: [["Calculadora del IRPF", HERRAMIENTA.calculadora]] }
];

const PORSLUG = new Map(TERMINOS.map(t => [t.slug, t]));

// ---- enlaces al glosario en otras páginas -------------------------------------------------
// Enlaza la primera aparición de los términos clave en el texto de <p> y <li> dentro de <main>,
// sin tocar encabezados, enlaces, tablas, resúmenes de FAQ ni la línea de fecha. Como mucho
// `max` enlaces por página y uno por término.
const BLOQUEO = new Set(["a", "h1", "h2", "h3", "h4", "h5", "h6", "summary", "table", "script", "nav", "button", "time", "label", "select", "option"]);
const CON_PATRON = TERMINOS.filter(t => t.patron).map(t => ({ t, re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${t.patron})(?![\\p{L}\\p{N}])`, "iu") }));
export function enlazarGlosario(html, max = 3) {
  const ini = html.indexOf("<main"), fin = html.indexOf("</main>");
  if (ini < 0 || fin < 0) return html;
  const usados = new Set();
  let n = 0;
  const pila = [];
  const cuerpo = html.slice(ini, fin).replace(/<[^>]+>|[^<]+/g, tok => {
    if (tok[0] === "<") {
      const m = tok.match(/^<(\/?)([a-zA-Z0-9]+)([^>]*)>$/);
      if (!m) return tok;
      const nom = m[2].toLowerCase();
      if (/^(br|img|meta|link|input|hr|source|wbr)$/.test(nom) || m[3].endsWith("/")) return tok;
      if (m[1]) { const i = pila.findLastIndex(x => x === nom || x === nom + "!"); if (i >= 0) pila.length = i; }
      else pila.push(nom + (/class="(migas|actualizado|ayuda|cita|calc-rapido)"/.test(m[3]) ? "!" : ""));
      return tok;
    }
    if (n >= max || !pila.length || pila.some(x => BLOQUEO.has(x) || x.endsWith("!"))) return tok;
    const tope = pila[pila.length - 1];
    if (!["p", "li", "b", "strong", "span"].includes(tope) || !pila.some(x => x === "p" || x === "li")) return tok;
    let mejor = null;
    for (const { t, re } of CON_PATRON) {
      if (usados.has(t.slug)) continue;
      const m = tok.match(re);
      if (m && (!mejor || m.index < mejor.m.index || (m.index === mejor.m.index && m[0].length > mejor.m[0].length))) mejor = { t, m };
    }
    if (!mejor) return tok;
    usados.add(mejor.t.slug); n++;
    const { m, t } = mejor;
    return tok.slice(0, m.index) + `<a href="${rutaTermino(t.slug)}">${m[0]}</a>` + tok.slice(m.index + m[0].length);
  });
  return html.slice(0, ini) + cuerpo + html.slice(fin);
}

// ---- páginas ------------------------------------------------------------------------------
function normaHtml(t, d, g) {
  if (t.normaCal) {
    const c = (g.calendario || [])[0];
    if (!c) return "";
    return `<p>La campaña de la renta de ${esc(c.ejercicio)}, con la presentación por internet, la regula la ${esc(c.norma)}: <a href="${urlBoe(c.boe)}" rel="noopener">${esc(c.boe)}</a>.</p>`;
  }
  if (t.normaParams) {
    if (!d) return "";
    return `<p>Lo regula cada hacienda foral en su norma del IRPF. Norma que aplica Mapafiscal: ${esc(t.normaParams(d))}.</p><p class="ayuda">En régimen común no existe: su papel lo cumple el mínimo personal (art. 57 de la <a href="${LIRPF_BOE}" rel="noopener">Ley 35/2006</a>).</p>`;
  }
  return `<p>${esc(t.norma.txt)}, del Impuesto sobre la Renta de las Personas Físicas: <a href="${t.norma.url}" rel="noopener">texto consolidado en el BOE (BOE-A-2006-20764)</a>.${t.slug === "regimen-foral" ? " Cada territorio foral regula el impuesto en su propia norma foral." : ""}</p>`;
}

function paginaTermino(t, d, g, generado) {
  const ruta = rutaTermino(t.slug);
  const migas = [["Inicio", "/"], ["Glosario del IRPF", HUB_GLOSARIO], [t.nombre, ruta]];
  let ejemplo = "";
  if (t.ejemplo && d) ejemplo = t.ejemplo(d);
  else if (t.ejemploG) ejemplo = t.ejemploG(g);
  const rel = t.rel.map(s => PORSLUG.get(s)).filter(Boolean);
  const def = t.def;
  const main = `
  <h1>${esc(t.nombre)}</h1>
  <p class="entradilla">${esc(def[0])}</p>
  <div class="prosa">
  <div class="tarjeta">${def.slice(1).map(p => `<p>${esc(p)}</p>`).join("")}</div>
  <div class="tarjeta"><h2 class="rotulo">Dónde se regula</h2>${normaHtml(t, d, g)}</div>
  ${ejemplo ? `<div class="tarjeta"><h2 class="rotulo">Ejemplo con cifras</h2>${ejemplo}</div>` : ""}
  <div class="tarjeta"><h2 class="rotulo">Términos relacionados</h2><ul class="lista-enlaces">${rel.map(r => `<li><a href="${rutaTermino(r.slug)}">${esc(r.nombre)}</a></li>`).join("")}</ul></div>
  <div class="tarjeta"><h2 class="rotulo">Dónde lo usa Mapafiscal</h2><ul class="lista-enlaces">${t.usa.map(([txt, href]) => `<li><a href="${href}">${esc(txt)}</a></li>`).join("")}</ul></div>
  <p><a href="${HUB_GLOSARIO}">Volver al glosario del IRPF</a></p>
  </div>`;
  const description = recortar(`${t.nombre} en el IRPF: ${def[0]}`, 155);
  const termLd = { "@context": "https://schema.org", "@type": "DefinedTerm", "@id": SITIO + ruta + "#termino", name: t.nombre,
    description: def[0], url: SITIO + ruta, inLanguage: "es",
    inDefinedTermSet: { "@type": "DefinedTermSet", "@id": SITIO + HUB_GLOSARIO + "#glosario", name: "Glosario del IRPF", url: SITIO + HUB_GLOSARIO } };
  return { ruta, html: layout({
    title: tituloQueQuepa(t.titulo, `${t.nombre}: qué es en el IRPF`, t.nombre),
    description, canonical: ruta, breadcrumb: migasHtml(migas), main, generado, css: ["/css/guias.css"],
    jsonld: [jsonLdMigas(migas), termLd] }) };
}

function recortar(s, n) {
  if (s.length <= n) return s;
  const c = s.slice(0, n - 1);
  return c.slice(0, c.lastIndexOf(" ")).replace(/[,;:]$/, "") + "…";
}

const clave = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function paginaIndice(generado) {
  const orden = [...TERMINOS].sort((a, b) => clave(a.nombre).localeCompare(clave(b.nombre), "es"));
  const grupos = new Map();
  for (const t of orden) { const l = clave(t.nombre)[0].toUpperCase(); if (!grupos.has(l)) grupos.set(l, []); grupos.get(l).push(t); }
  const migas = [["Inicio", "/"], ["Glosario del IRPF", HUB_GLOSARIO]];
  const main = `
  <h1>Glosario del IRPF</h1>
  <p class="entradilla">${TERMINOS.length} términos de la declaración de la renta explicados con palabras sencillas, con el artículo de la ley que los regula y, cuando se puede, un ejemplo calculado con el mismo motor que la calculadora.</p>
  <div class="prosa">
  <nav class="tarjeta indice" aria-label="Letras"><p>${[...grupos.keys()].map(l => `<a href="#letra-${l.toLowerCase()}">${l}</a>`).join(" · ")}</p></nav>
  ${[...grupos].map(([l, ts]) => `<div class="tarjeta" id="letra-${l.toLowerCase()}"><h2 class="rotulo">${l}</h2><ul class="lista-guias">${ts.map(t => `<li><a href="${rutaTermino(t.slug)}">${esc(t.nombre)}</a><span>${esc(recortar(t.def[0], 120))}</span></li>`).join("")}</ul></div>`).join("\n  ")}
  <div class="tarjeta"><h2 class="rotulo">Para seguir</h2><p><a href="/guias/">Guías del IRPF</a> · <a href="/irpf/">IRPF por territorio</a> · <a href="${HERRAMIENTA.calculadora}">Calculadora del IRPF</a></p></div>
  </div>`;
  const setLd = { "@context": "https://schema.org", "@type": "DefinedTermSet", "@id": SITIO + HUB_GLOSARIO + "#glosario", name: "Glosario del IRPF",
    url: SITIO + HUB_GLOSARIO, inLanguage: "es",
    hasDefinedTerm: orden.map(t => ({ "@type": "DefinedTerm", "@id": SITIO + rutaTermino(t.slug) + "#termino", name: t.nombre, url: SITIO + rutaTermino(t.slug) })) };
  return { ruta: HUB_GLOSARIO, html: layout({
    title: "Glosario del IRPF: términos de la renta de la A a la Z",
    description: `Glosario del IRPF de la A a la Z: base liquidable, cuota íntegra, mínimo personal, tipo marginal y ${TERMINOS.length - 4} términos más, con su artículo de la ley.`,
    canonical: HUB_GLOSARIO, breadcrumb: migasHtml(migas), main, generado, css: ["/css/guias.css"],
    jsonld: [jsonLdMigas(migas), setLd] }) };
}

export function paginasGlosario({ comparativas, guias, generado }) {
  const d = datosEjemplo(comparativas, guias);
  return [paginaIndice(generado), ...TERMINOS.map(t => paginaTermino(t, d, guias, generado))];
}
