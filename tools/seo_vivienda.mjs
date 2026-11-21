// =============================================================================
// Sección «Vivienda»: /vivienda/ (portada) y /vivienda/<slug>/.
//
// Cómo tributa la vivienda de un particular en el IRPF. Las cifras normativas salen de
// web/datos/params.json (tipos de la imputación, DT 9.ª) y de web/datos/seo_guias.json
// (escala del ahorro, con su norma); los ejemplos, del motor JS (web/js/irpfsim.js), sin
// cambiar su lógica. Lo que el motor no calcula (prorrata de la imputación por días o por
// copropiedad, exenciones por reinversión y por edad, amortización acumulada del alquiler)
// se explica en texto con su norma y sin cifras propias.
// =============================================================================
import {
  NOMBRE_CORTO, HERRAMIENTA, LIRPF_BOE, esc, euros, eurosExactos as eur, pct, pctCorto, fecha, urlBoe,
  tablaEscala, combinarEscalas, citaFuente, layout, jsonLdMigas, jsonLdArticulo, jsonLdFaq, bloqueFaq,
  migasHtml, respuestaDirecta
} from "./seo_comun.mjs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_V = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const MOTOR = createRequire(import.meta.url)(join(WEB_V, "js", "irpfsim.js"));
const PARAMS = () => JSON.parse(readFileSync(join(WEB_V, "datos", "params.json"), "utf8"));
const RIRPF_BOE = urlBoe("BOE-A-2007-6820");
const lirpf = art => `<a href="${LIRPF_BOE}" rel="noopener">${esc(art)} de la Ley 35/2006 del IRPF</a>`;
const cta = (txt, href, sec) => `<p><a class="btn btn-pri" href="${href}">${esc(txt)}</a>${sec ? ` <a class="btn btn-sec" href="${sec[1]}">${esc(sec[0])}</a>` : ""}</p>`;
const tablaG = (cab, filas) => `<div class="envoltorio"><table class="cobertura"><thead><tr>${cab.map((c, i) => `<th${i ? ' class="num"' : ""}>${esc(c)}</th>`).join("")}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((c, i) => `<td${i ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
export const HUB_VIVIENDA = "/vivienda/";

// slug null: la portada de la sección.
function paginaViv(g, { slug, titulo, h1, description, cuerpo, faq, generado, resumen }) {
  const ruta = slug ? `${HUB_VIVIENDA}${slug}/` : HUB_VIVIENDA;
  const migas = slug ? [["Inicio", "/"], ["Vivienda", HUB_VIVIENDA], [h1, ruta]] : [["Inicio", "/"], ["Vivienda", HUB_VIVIENDA]];
  const otras = slug ? `<div class="tarjeta"><h2 class="rotulo">Más sobre la vivienda en el IRPF</h2><ul class="lista-enlaces"><li><a href="${HUB_VIVIENDA}">Cómo tributa la vivienda: portada de la sección</a></li>${VIV_GUIAS.filter(([s]) => s !== slug).map(([s, t]) => `<li><a href="${HUB_VIVIENDA}${s}/">${esc(t)}</a></li>`).join("")}</ul></div>` : "";
  const main = `
  <h1>${esc(h1)}</h1>
  ${resumen ? respuestaDirecta(resumen) : ""}
  <div class="prosa">
  ${cuerpo}
  ${faq.length ? bloqueFaq(faq) : ""}
  ${otras}
  <div class="tarjeta"><p>Más sobre la renta: <a href="/guias/">guías del IRPF</a> · <a href="/glosario/">glosario</a> · <a href="/irpf/">IRPF por territorio</a>.</p></div>
  </div>`;
  return {
    ruta,
    html: layout({
      title: titulo, description, canonical: ruta, breadcrumb: migasHtml(migas), main, generado, css: ["/css/guias.css"],
      jsonld: [jsonLdMigas(migas), jsonLdArticulo({ titulo: h1, descripcion: description, ruta, generado }), ...(faq.length ? [jsonLdFaq(faq)] : [])]
    })
  };
}

// Ejemplos con el motor (web/js/irpfsim.js) sobre params.json: un asalariado de 40 años en
// Madrid con 30.000 € brutos al que se le suma la renta de un inmueble. Lo que el motor no
// calcula (prorrata de la imputación, exenciones por reinversión o por edad, amortización
// acumulada del alquiler) se explica en texto con su norma, sin cifras propias.
const VIV_T = "ES-MD", VIV_BRUTO = 30000;
const VIV_HUB = "/vivienda/";
const VIV_GUIAS = [
  ["segunda-vivienda", "Segunda vivienda: imputación de rentas"],
  ["alquiler-por-temporadas", "Alquiler por temporadas y parte del año"],
  ["venta-vivienda", "Vender una vivienda: la ganancia patrimonial"],
  ["vender-piso-alquilado", "Vender un piso que has tenido alquilado"]
];
const SUP_VIV = P => `Persona sola de 40 años en ${NOMBRE_CORTO[VIV_T]} con un sueldo de ${euros(VIV_BRUTO)} brutos, sin hijos ni deducciones; IRPF del ejercicio ${P.ejercicio} calculado con el motor de Mapafiscal y cotizaciones del trabajador según los parámetros del mismo año. No es una liquidación oficial.`;
// IRPF del año con el sueldo de referencia y lo que se añada al declarante (rentas del inmueble).
function irpfVivienda(P, extra) {
  const cot = MOTOR.cotizacionesTrabajador(VIV_BRUTO, P);
  const d1 = Object.assign({ id: "d1", rol: "declarante", edad: 40, trabajo: { dinerarias: VIV_BRUTO, cotizacionesSs: cot } }, extra || {});
  const liq = MOTOR.liquidar({ territorio: VIV_T, ejercicio: P.ejercicio, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no", miembros: [d1] }, P, "auto");
  return { liq, irpf: MOTOR.irpfAnual(liq) };
}
const r2v = x => Math.round(x * 100) / 100;
const rirpf = art => `<a href="${RIRPF_BOE}" rel="noopener">${esc(art)} del Reglamento del IRPF</a>`;
const FUENTES_VIV = `<p class="cita">Fuentes primarias: <a href="${LIRPF_BOE}" rel="noopener">Ley 35/2006, del IRPF (texto consolidado, BOE-A-2006-20764)</a> y <a href="${RIRPF_BOE}" rel="noopener">Real Decreto 439/2007, Reglamento del IRPF (texto consolidado, BOE-A-2007-6820)</a>.</p>`;
const aviso = txt => `<div class="tarjeta"><h2 class="rotulo">Lo que la calculadora todavía no hace</h2><p>${txt}</p></div>`;

function datosVivienda() {
  const P = PARAMS(), imp = P.estatal.imputacion_renta_inmobiliaria;
  const base = irpfVivienda(P);
  const VC = 80000;
  const rev = irpfVivienda(P, { imputacionInmobiliaria: { valorCatastral: VC, revisado10Anios: true } });
  const norev = irpfVivienda(P, { imputacionInmobiliaria: { valorCatastral: VC, revisado10Anios: false } });
  // alquiler de un año entero: ingresos, gastos deducibles y gastos financieros
  const alq = { ingresos: 9600, gastosDeducibles: 2400, gastosFinancieros: 1200 };
  const alqViv = irpfVivienda(P, { capitalInmobiliario: [Object.assign({ arrendamientoVivienda: true }, alq)] });
  const alqOtro = irpfVivienda(P, { capitalInmobiliario: [Object.assign({ arrendamientoVivienda: false }, alq)] });
  // venta: compra a 150.000 € y venta a 220.000 €, adquirida después del corte de la DT 9.ª
  const venta = { compra: 150000, precio: 220000 };
  const elVenta = { tipoElemento: "inmueble", valorAdquisicion: venta.compra, valorTransmision: venta.precio, fechaAdquisicion: "2012-06-15", fechaTransmision: `${P.ejercicio}-06-15` };
  const vend = irpfVivienda(P, { ganancias: [elVenta] });
  return { P, imp, base, VC, rev, norev, alq, alqViv, alqOtro, venta, vend,
    dif: x => r2v(x.irpf - base.irpf) };
}

// ---- Hub ---------------------------------------------------------------------------------
function guiaViviendaHub(g) {
  const D = datosVivienda(), { P, imp } = D;
  const ah = g.escalas[`ahorro_estatal_${P.ejercicio}`], aha = g.escalas[`ahorro_autonomica_${P.ejercicio}`];
  const escAhorro = ah && aha ? combinarEscalas(ah.tramos, aha.tramos) : null;
  const filas = [
    ["Vivienda habitual (la tuya)", "No tributa por tenerla", "—", `Excluida de la imputación (${lirpf("art. 85")})`, `<a href="/vivienda/venta-vivienda/">Si la vendes</a>`],
    ["Segunda vivienda vacía o de uso propio", "Imputación de rentas inmobiliarias", "General", lirpf("art. 85"), `<a href="/vivienda/segunda-vivienda/">Segunda vivienda</a>`],
    ["Vivienda alquilada", "Rendimiento del capital inmobiliario", "General", lirpf("arts. 22 a 24"), `<a href="/vivienda/alquiler-por-temporadas/">Alquiler</a>`],
    ["Venta de cualquier vivienda", "Ganancia o pérdida patrimonial", "Ahorro", lirpf("arts. 33 a 35 y 46"), `<a href="/vivienda/venta-vivienda/">Venta</a>`],
    ["Venta de una vivienda que estuvo alquilada", "Ganancia patrimonial, con el valor de compra minorado por la amortización", "Ahorro", `${lirpf("art. 35.1")} y ${rirpf("art. 40")}`, `<a href="/vivienda/vender-piso-alquilado/">Piso alquilado</a>`]
  ];
  const cuerpo = `
  <p class="entradilla">Una vivienda puede aparecer en la declaración de la renta de cuatro maneras distintas según lo que hagas con ella: vivir en ella, tenerla a tu disposición sin alquilarla, alquilarla o venderla. Cada situación tiene su propia regla en la Ley del IRPF, va a una base distinta y se calcula de otra forma. Esta página reúne las cuatro y enlaza a una guía para cada una.</p>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Qué declara cada vivienda</h2>
    ${tablaG(["Situación", "Cómo tributa", "Base", "Norma", "Guía"], filas)}
    <p class="ayuda">La base general se suma al sueldo y paga la escala progresiva estatal y autonómica; la base del ahorro tiene su propia escala, igual en todas las comunidades de régimen común.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">1. La vivienda en la que vives</h2>
    <p>Tu vivienda habitual no genera renta por el hecho de ser tuya: el ${lirpf("art. 85")} la deja fuera de la imputación de rentas inmobiliarias. Aparece en la declaración en dos casos: si la compraste antes de 2013 y aplicas el régimen transitorio de deducción por inversión en vivienda habitual (${esc(P.estatal.deduccion_vivienda_transitoria.norma)}), y cuando la vendes, porque la diferencia entre lo que pagaste y lo que cobras es una ganancia patrimonial, que en ciertos casos puede quedar exenta.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">2. Una segunda vivienda que no alquilas</h2>
    <p>Un piso en la playa, una casa en el pueblo o una vivienda vacía a tu disposición tributan aunque no te den ni un euro: Hacienda te <a href="/glosario/imputacion-rentas-inmobiliarias/">imputa una renta presunta</a> del ${pctCorto(imp.tipo_general)} de su valor catastral, o del ${pctCorto(imp.tipo_revisado_10_anios)} si ese valor se ha revisado en los últimos años (${esc(imp.norma)}). Esa renta se suma al sueldo en la base general.</p>
    <p>Con el motor: un valor catastral de ${euros(D.VC)} sumado a ${euros(VIV_BRUTO)} brutos en ${esc(NOMBRE_CORTO[VIV_T])} sube el IRPF del año ${eur(D.dif(D.rev))} si el valor está revisado y ${eur(D.dif(D.norev))} si no lo está. <a href="/vivienda/segunda-vivienda/">Guía de la segunda vivienda</a>.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">3. Una vivienda alquilada</h2>
    <p>Lo que cobras de alquiler, menos los gastos deducibles, es un rendimiento del capital inmobiliario (${lirpf("arts. 22 a 24")}). Si se alquila como vivienda habitual del inquilino, el rendimiento neto positivo tiene una reducción (${lirpf("art. 23.2")}); si se alquila por temporadas o para uso turístico, no. Los días del año en que no está alquilada vuelven a la imputación de rentas.</p>
    <p>Con el motor: ${euros(D.alq.ingresos)} de alquiler en un año con ${euros(D.alq.gastosDeducibles + D.alq.gastosFinancieros)} de gastos suben el IRPF ${eur(D.dif(D.alqViv))} si es vivienda habitual del inquilino y ${eur(D.dif(D.alqOtro))} si no tiene la reducción. <a href="/vivienda/alquiler-por-temporadas/">Guía del alquiler por temporadas</a>.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">4. Cuando la vendes</h2>
    <p>Al vender, la diferencia entre el valor de transmisión y el de adquisición es una ganancia (o pérdida) patrimonial que va a la base del ahorro (${lirpf("arts. 33 a 35 y 46")}).${escAhorro ? ` Su escala va del ${pctCorto(escAhorro[0].tipo)} al ${pctCorto(escAhorro[escAhorro.length - 1].tipo)} sumando las partes estatal y autonómica.` : ""} Si la vivienda era la habitual, la ganancia puede quedar exenta si reinviertes en otra o si tienes más de 65 años; si estuvo alquilada, la amortización de esos años reduce el valor de compra y aumenta la ganancia.</p>
    <p>Con el motor: comprar a ${euros(D.venta.compra)} y vender a ${euros(D.venta.precio)} deja una ganancia de ${euros(D.venta.precio - D.venta.compra)} que sube el IRPF del año ${eur(D.dif(D.vend))}. <a href="/vivienda/venta-vivienda/">Guía de la venta</a> · <a href="/vivienda/vender-piso-alquilado/">Vender un piso alquilado</a>.</p>
  </div>
  <div class="tarjeta"><h2 class="rotulo">En esta sección</h2><ul class="lista-enlaces">${VIV_GUIAS.map(([s, t]) => `<li><a href="/vivienda/${s}/">${esc(t)}</a></li>`).join("")}</ul>
    <p class="ayuda">${esc(SUP_VIV(P))}</p>${FUENTES_VIV}</div>
  ${cta("Calcula tu IRPF con tus inmuebles", HERRAMIENTA.calculadora)}`;
  const faq = [
    ["¿Tengo que declarar mi vivienda habitual en la renta?", "Por tenerla, no: la vivienda habitual está excluida de la imputación de rentas inmobiliarias (art. 85 de la Ley del IRPF). Aparece en la declaración si aplicas la deducción transitoria por haberla comprado antes de 2013 o el año en que la vendes."],
    ["¿Una segunda vivienda vacía paga IRPF?", `Sí. Se imputa una renta del ${pctCorto(imp.tipo_general)} del valor catastral, o del ${pctCorto(imp.tipo_revisado_10_anios)} si está revisado, que se suma a la base general. Con ${euros(D.VC)} de valor catastral revisado y ${euros(VIV_BRUTO)} de sueldo en Madrid, el IRPF sube ${eur(D.dif(D.rev))} al año.`],
    ["¿Dónde tributa la venta de una vivienda?", `En la base del ahorro, como ganancia patrimonial, separada del sueldo. Con una compra de ${euros(D.venta.compra)} y una venta de ${euros(D.venta.precio)}, el IRPF del año sube ${eur(D.dif(D.vend))} según el motor de Mapafiscal, sin aplicar exenciones.`],
    ["¿El alquiler turístico tiene la misma reducción que el de vivienda?", "No. La reducción del art. 23.2 de la Ley del IRPF es solo para inmuebles arrendados como vivienda. El alquiler por temporadas o turístico declara el rendimiento sin esa reducción, y si se prestan servicios propios de la hostelería pasa a ser una actividad económica."]
  ];
  return paginaViv(g, { slug: null, h1: "Cómo tributa la vivienda en el IRPF: vivir, tener, alquilar y vender",
    titulo: "Fiscalidad de la vivienda en el IRPF: guía completa",
    resumen: `la vivienda habitual no tributa por tenerla; una segunda vivienda imputa el ${pctCorto(imp.tipo_revisado_10_anios)} o el ${pctCorto(imp.tipo_general)} del valor catastral; el alquiler es rendimiento del capital inmobiliario y la venta, ganancia patrimonial en la base del ahorro.`,
    description: `Cómo tributa la vivienda en el IRPF: vivienda habitual, segunda vivienda, alquiler y venta. Normas, bases y ejemplos calculados con el motor de Mapafiscal.`,
    cuerpo, faq, generado: g.generado });
}

// ---- Segunda vivienda: imputación de rentas ------------------------------------------------
function guiaSegundaVivienda(g) {
  const D = datosVivienda(), { P, imp } = D;
  const filas = [
    ["Solo el sueldo", "—", esc(eur(D.base.liq.baseImponibleGeneral)), esc(eur(D.base.irpf)), "—"],
    [`Valor catastral revisado (${pctCorto(imp.tipo_revisado_10_anios)})`, esc(eur(D.VC * imp.tipo_revisado_10_anios)), esc(eur(D.rev.liq.baseImponibleGeneral)), esc(eur(D.rev.irpf)), esc(eur(D.dif(D.rev)))],
    [`Valor catastral no revisado (${pctCorto(imp.tipo_general)})`, esc(eur(D.VC * imp.tipo_general)), esc(eur(D.norev.liq.baseImponibleGeneral)), esc(eur(D.norev.irpf)), esc(eur(D.dif(D.norev)))]
  ];
  const tipoEf = x => D.dif(x) / (D.VC * (x === D.rev ? imp.tipo_revisado_10_anios : imp.tipo_general));
  const cuerpo = `
  <p class="entradilla">Tener una vivienda que no es la tuya habitual y no está alquilada se declara aunque no te genere ingresos. La ley presume que te da una renta, la calcula a partir del valor catastral y la suma a tu base general, la misma en la que está tu sueldo. Esa renta presunta se llama <a href="/glosario/imputacion-rentas-inmobiliarias/">imputación de rentas inmobiliarias</a>.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Qué inmuebles imputan renta</h2>
    <p>Según el ${lirpf("art. 85")}, imputan renta los inmuebles urbanos (y los rústicos con construcciones que no sean indispensables para la explotación) que no estén afectos a una actividad económica ni generen rendimientos del capital. En la práctica: la segunda residencia, el piso vacío, la vivienda que prestas a un familiar sin cobrarle y el piso que pones en alquiler pero no consigues alquilar.</p>
    <p>No imputan renta la vivienda habitual, el suelo no edificado, los inmuebles en construcción ni los que por razones urbanísticas no se pueden usar.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Cuánto se imputa: ${pctCorto(imp.tipo_general)} o ${pctCorto(imp.tipo_revisado_10_anios)} del valor catastral</h2>
    <ul>
      <li><b>${pctCorto(imp.tipo_general)}</b> del valor catastral con carácter general.</li>
      <li><b>${pctCorto(imp.tipo_revisado_10_anios)}</b> si el valor catastral se ha revisado, modificado o determinado en un procedimiento de valoración colectiva de carácter general que haya entrado en vigor en el ejercicio o en los diez anteriores. El año de la última revisión de tu municipio lo indica el recibo del IBI o la sede electrónica del Catastro.</li>
      <li>Si el inmueble no tiene valor catastral o no se le ha notificado, el propio ${lirpf("art. 85")} fija una base alternativa a partir del valor por el que se computaría en el Impuesto sobre el Patrimonio, con el tipo reducido.</li>
    </ul>
    ${citaFuente(imp)}
    <p>La renta imputada no admite gastos: no se restan el IBI, la comunidad ni los intereses de la hipoteca. Y tributa como renta general (${lirpf("art. 85")}), así que paga a tu tipo marginal, no a la escala del ahorro.</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Ejemplo: ${euros(D.VC)} de valor catastral y ${euros(VIV_BRUTO)} de sueldo en ${esc(NOMBRE_CORTO[VIV_T])} (${P.ejercicio})</h2>
    <p class="ayuda">${esc(SUP_VIV(P))} Vivienda a disposición del titular todo el año y en propiedad al 100 %.</p>
    ${tablaG(["Caso", "Renta imputada", "Base imponible general", "IRPF del año", "Cuánto sube el IRPF"], filas)}
    <p>Con el valor catastral revisado se imputan ${eur(D.VC * imp.tipo_revisado_10_anios)} y el IRPF sube ${eur(D.dif(D.rev))} al año; sin revisar, se imputan ${eur(D.VC * imp.tipo_general)} y sube ${eur(D.dif(D.norev))}. En los dos casos el aumento es la renta imputada por el tipo marginal de ese contribuyente (un ${pct(tipoEf(D.rev))} en este ejemplo).</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Si la tienes solo una parte del año: prorrata por días</h2>
    <p>La imputación se hace por los días en que el inmueble ha estado a tu disposición. Si la compraste o la vendiste durante el año, o si estuvo alquilada unos meses, la renta anual se multiplica por los días a tu disposición y se divide entre los días del año (${lirpf("art. 85")}). Los días alquilados no imputan: declaran el rendimiento del alquiler.</p>
    <p>La calculadora y el ejemplo de esta página suponen el año entero; si tu caso es de parte del año, la imputación real es menor en esa proporción.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Si la vivienda es de varios: copropiedad</h2>
    <p>Las rentas de un inmueble se atribuyen a quien sea su titular jurídico (${lirpf("art. 11")}). Si la vivienda es de dos hermanos al 50 % o de un matrimonio en gananciales, cada uno declara la parte de la imputación que corresponde a su porcentaje de propiedad. Lo mismo vale para el usufructo: imputa el usufructuario, no el nudo propietario.</p>
    <p>El ejemplo supone un único titular al 100 %. Repartida entre varios, cada uno suma a su base solo su parte, y el aumento del IRPF de cada uno depende de su propio tipo marginal.</p>
  </div>
  ${aviso("El motor calcula la imputación de un año completo y de un titular al 100 %. No aplica la prorrata por días ni el reparto por porcentaje de propiedad: para esos casos, introduce en la calculadora el valor catastral que te corresponda o usa el borrador de la Agencia Tributaria, que ya trae los datos catastrales.")}
  ${FUENTES_VIV}
  ${cta("Calcula tu IRPF con tu segunda vivienda", HERRAMIENTA.calculadora)}`;
  const faq = [
    ["¿Cuánto paga de IRPF una segunda vivienda vacía?", `Se imputa el ${pctCorto(imp.tipo_general)} de su valor catastral, o el ${pctCorto(imp.tipo_revisado_10_anios)} si está revisado, y eso se suma a la base general. Con ${euros(D.VC)} de valor catastral y ${euros(VIV_BRUTO)} de sueldo en Madrid, el IRPF sube ${eur(D.dif(D.rev))} (revisado) o ${eur(D.dif(D.norev))} (no revisado) según el motor de Mapafiscal.`],
    ["¿Se pueden restar el IBI o la comunidad de la imputación?", "No. La imputación de rentas inmobiliarias es una renta presunta y no admite gastos. Los gastos solo se deducen de los días en que la vivienda está alquilada."],
    ["¿Y si la vivienda es de dos personas?", "Cada titular declara la parte de la renta imputada que corresponde a su porcentaje de propiedad (art. 11 de la Ley del IRPF)."],
    ["¿Si la compré en julio imputo todo el año?", "No. Se imputa en proporción a los días del año en que la vivienda ha estado a tu disposición (art. 85 de la Ley del IRPF)."]
  ];
  return paginaViv(g, { slug: "segunda-vivienda", h1: "Segunda vivienda en el IRPF: la imputación de rentas inmobiliarias",
    titulo: "Segunda vivienda en el IRPF: imputación de rentas",
    resumen: `se imputa el <b>${pctCorto(imp.tipo_general)}</b> del valor catastral, o el <b>${pctCorto(imp.tipo_revisado_10_anios)}</b> si está revisado, como renta general. Con ${euros(D.VC)} de valor catastral y ${euros(VIV_BRUTO)} de sueldo en Madrid, el IRPF sube ${eur(D.dif(D.rev))} o ${eur(D.dif(D.norev))} al año.`,
    description: `Segunda vivienda en el IRPF: imputación del ${pctCorto(imp.tipo_general)} o ${pctCorto(imp.tipo_revisado_10_anios)} del valor catastral (art. 85). Ejemplo con ${euros(D.VC)}, prorrata por días y copropiedad.`,
    cuerpo, faq, generado: g.generado });
}

// ---- Alquiler por temporadas y parte del año ----------------------------------------------
function guiaAlquilerTemporadas(g) {
  const D = datosVivienda(), { P, imp, alq } = D;
  const rnPrevio = alq.ingresos - alq.gastosDeducibles - alq.gastosFinancieros;
  const rnViv = D.alqViv.liq.baseImponibleGeneral - D.base.liq.baseImponibleGeneral;
  const rnOtro = D.alqOtro.liq.baseImponibleGeneral - D.base.liq.baseImponibleGeneral;
  const red = rnOtro > 0 ? 1 - rnViv / rnOtro : 0;   // reducción que aplica el motor
  const filas = [
    ["Ingresos íntegros del alquiler", esc(eur(alq.ingresos)), esc(eur(alq.ingresos))],
    ["Gastos deducibles (IBI, comunidad, seguro, suministros, amortización…)", esc(eur(-alq.gastosDeducibles)), esc(eur(-alq.gastosDeducibles))],
    ["Intereses y gastos de reparación y conservación", esc(eur(-alq.gastosFinancieros)), esc(eur(-alq.gastosFinancieros))],
    ["Rendimiento neto", esc(eur(rnPrevio)), esc(eur(rnPrevio))],
    ["Reducción por arrendamiento de vivienda", esc(eur(-(rnOtro - rnViv))), "—"],
    ["Rendimiento neto reducido (a la base general)", esc(eur(rnViv)), esc(eur(rnOtro))],
    ["IRPF del año (con el sueldo)", esc(eur(D.alqViv.irpf)), esc(eur(D.alqOtro.irpf))],
    ["Cuánto sube el IRPF por el alquiler", `<b>${esc(eur(D.dif(D.alqViv)))}</b>`, `<b>${esc(eur(D.dif(D.alqOtro)))}</b>`]
  ];
  const LAU = urlBoe("BOE-A-1994-26003");
  const cuerpo = `
  <p class="entradilla">Si alquilas una vivienda solo una parte del año, en la declaración conviven dos regímenes sobre el mismo inmueble: por los días alquilados declaras el <a href="/glosario/rendimientos-capital-inmobiliario/">rendimiento del alquiler</a>, con sus ingresos y sus gastos; por los días en que estuvo vacía o a tu disposición, una <a href="/glosario/imputacion-rentas-inmobiliarias/">imputación de rentas inmobiliarias</a>. Y el tipo de alquiler (vivienda del inquilino, temporada o turístico) decide si el rendimiento tiene reducción o no.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Los días alquilados: rendimiento del capital inmobiliario</h2>
    <p>Lo que cobras del inquilino es un rendimiento del capital inmobiliario (${lirpf("art. 22")}). De esos ingresos restas los gastos necesarios para obtenerlos (${lirpf("art. 23.1")} y ${rirpf("arts. 13 y 14")}): IBI, comunidad, seguros, suministros que pagues tú, gestión, y la amortización del inmueble y del mobiliario. Los intereses de la hipoteca y los gastos de reparación y conservación tienen un tope: juntos no pueden superar los ingresos íntegros de ese inmueble, y el exceso se arrastra a los años siguientes.</p>
    <p>Si el piso solo ha estado alquilado unos meses, los gastos del año se reparten: solo se deducen los que corresponden a los días alquilados.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Los días sin alquilar: imputación de rentas</h2>
    <p>Por el resto del año, si la vivienda no es tu residencia habitual, imputas renta como cualquier segunda vivienda: el ${pctCorto(imp.tipo_general)} o el ${pctCorto(imp.tipo_revisado_10_anios)} del valor catastral (${esc(imp.norma)}), en proporción a los días en que no estuvo alquilada. Esos días no admiten gastos. Más detalle en la <a href="/vivienda/segunda-vivienda/">guía de la segunda vivienda</a>.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Vivienda del inquilino, temporada o turístico</h2>
    <ul>
      <li><b>Alquiler de vivienda habitual del inquilino</b> (${`<a href="${LAU}" rel="noopener">art. 2 de la Ley 29/1994, de Arrendamientos Urbanos</a>`}): el rendimiento neto positivo tiene la reducción del ${lirpf("art. 23.2")}. El porcentaje depende del tipo de contrato y de cuándo se firmó; la redacción vigente procede de la Ley 12/2023, por el derecho a la vivienda.</li>
      <li><b>Alquiler por temporadas</b> (estudiantes, trabajo temporal, verano: arrendamiento para uso distinto del de vivienda del <a href="${LAU}" rel="noopener">art. 3 de la Ley de Arrendamientos Urbanos</a>): sigue siendo rendimiento del capital inmobiliario, pero sin la reducción, porque el inmueble no se destina a satisfacer la necesidad permanente de vivienda del inquilino.</li>
      <li><b>Alquiler turístico</b>: si solo cedes la vivienda, es rendimiento del capital inmobiliario sin reducción. Si además prestas servicios propios de la hostelería (limpieza diaria, cambio de ropa, restauración), pasa a ser una actividad económica (${lirpf("art. 27")}) y se declara en otro apartado.</li>
    </ul>
    <p>Los parámetros de Mapafiscal no distinguen entre temporada y turístico: el motor solo sabe si el alquiler es de vivienda (con reducción) o no lo es (sin reducción), que es lo que muestra el ejemplo.</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Ejemplo con el motor: un año entero de alquiler (${P.ejercicio})</h2>
    <p class="ayuda">${esc(SUP_VIV(P))} Un inmueble alquilado los 12 meses, sin imputación por días vacíos; contrato de vivienda sin requisitos especiales (reducción general que aplica el motor).</p>
    ${tablaG(["Concepto", "Vivienda habitual del inquilino", "Temporada o turístico"], filas)}
    <p>El mismo alquiler sube el IRPF ${eur(D.dif(D.alqViv))} si el inquilino vive en la vivienda y ${eur(D.dif(D.alqOtro))} si es de temporada o turístico: la reducción que aplica el motor en este contrato es del ${pctCorto(red)} del rendimiento neto.</p>
  </div>
  ${aviso("El motor calcula el rendimiento de cada inmueble alquilado con sus ingresos y gastos del año y la imputación de los inmuebles a tu disposición, pero no reparte un mismo inmueble entre días alquilados y días vacíos. Si tu vivienda estuvo alquilada solo una parte del año, introduce los ingresos y gastos del periodo alquilado y calcula aparte la imputación de los días restantes.")}
  ${FUENTES_VIV}
  ${cta("Calcula tu IRPF con tu alquiler", HERRAMIENTA.calculadora)}`;
  const faq = [
    ["¿Cómo se declara un piso alquilado solo unos meses?", "Por los días alquilados, como rendimiento del capital inmobiliario (ingresos menos los gastos de ese periodo); por los días en que estuvo a tu disposición, como imputación de rentas inmobiliarias sobre el valor catastral (arts. 23 y 85 de la Ley del IRPF)."],
    ["¿El alquiler de temporada tiene la reducción del 23.2?", "No. La reducción es para inmuebles arrendados como vivienda del inquilino. Un alquiler de temporada es un arrendamiento para uso distinto del de vivienda y declara el rendimiento entero."],
    ["¿El alquiler turístico es una actividad económica?", "Solo si, además de ceder la vivienda, prestas servicios propios de la hostelería. Si no, es rendimiento del capital inmobiliario, sin la reducción por alquiler de vivienda."],
    [`¿Cuánto sube el IRPF por alquilar un piso ${euros(alq.ingresos)} al año?`, `Con ${euros(alq.gastosDeducibles + alq.gastosFinancieros)} de gastos y un sueldo de ${euros(VIV_BRUTO)} en Madrid, ${eur(D.dif(D.alqViv))} si es vivienda habitual del inquilino y ${eur(D.dif(D.alqOtro))} si es de temporada o turístico, según el motor de Mapafiscal.`],
    ["¿Qué gastos se deducen del alquiler?", "Los necesarios para obtener el alquiler: IBI, comunidad, seguro, suministros a tu cargo, amortización, e intereses y reparaciones con el tope de los ingresos del inmueble (art. 23.1 de la Ley del IRPF y arts. 13 y 14 del Reglamento)."]
  ];
  return paginaViv(g, { slug: "alquiler-por-temporadas", h1: "Alquiler por temporadas en el IRPF: rendimiento e imputación",
    titulo: "Alquiler por temporadas en el IRPF: cómo se declara",
    resumen: `los días alquilados son rendimiento del capital inmobiliario y los días vacíos, imputación de rentas. Solo el alquiler de vivienda del inquilino tiene reducción: con ${euros(alq.ingresos)} de alquiler el IRPF sube ${eur(D.dif(D.alqViv))} como vivienda y ${eur(D.dif(D.alqOtro))} como temporada.`,
    description: `Alquiler por temporadas o parte del año en el IRPF: rendimiento por los días alquilados, imputación por el resto y reducción solo para vivienda. Ejemplo con el motor.`,
    cuerpo, faq, generado: g.generado });
}

// ---- Venta de una vivienda --------------------------------------------------------------------
function guiaVentaVivienda(g) {
  const D = datosVivienda(), { P, venta, vend } = D;
  const ah = g.escalas[`ahorro_estatal_${P.ejercicio}`], aha = g.escalas[`ahorro_autonomica_${P.ejercicio}`];
  const escAhorro = combinarEscalas(ah.tramos, aha.tramos);
  const dt9 = P.estatal.dt9_abatimiento;
  const gan = vend.liq.baseImponibleAhorro;
  const cuerpo = `
  <p class="entradilla">Cuando vendes una vivienda, Hacienda no grava el precio de venta sino la ganancia: la diferencia entre lo que cobras y lo que te costó. Esa ganancia patrimonial va a la base del ahorro, separada del sueldo, y tributa con una escala propia. Si era tu vivienda habitual, puede quedar exenta en dos casos: si reinviertes en otra vivienda habitual o si tienes más de 65 años.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Cómo se calcula la ganancia</h2>
    <ul>
      <li><b>Valor de adquisición</b> (${lirpf("art. 35.1")}): el precio de compra más las inversiones y mejoras, y los gastos y tributos de la compra que hayas pagado tú (notaría, registro, impuesto de transmisiones o IVA, gestoría). Se resta la amortización si la vivienda ha estado alquilada (<a href="/vivienda/vender-piso-alquilado/">ver vender un piso alquilado</a>).</li>
      <li><b>Valor de transmisión</b> (${lirpf("art. 35.2")}): el precio de venta menos los gastos y tributos de la venta a tu cargo, como la comisión de la inmobiliaria o el impuesto municipal sobre el incremento de valor de los terrenos (la «plusvalía municipal»).</li>
      <li><b>Ganancia o pérdida</b> (${lirpf("arts. 33 y 34")}): la diferencia entre los dos. Si la vivienda es de varios titulares, cada uno declara su parte.</li>
      <li>Si la compraste no más tarde del ${esc(fecha(dt9.fecha_corte_adquisicion))}, la parte de la ganancia generada hasta el ${esc(fecha(dt9.fecha_generacion_lineal))} puede reducirse con los coeficientes de abatimiento, hasta un valor de transmisión acumulado de ${euros(dt9.limite_valor_transmision_acumulado)}. Norma: ${esc(dt9.norma)}.</li>
    </ul>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Escala de la base del ahorro (${P.ejercicio})</h2>
    <p>La ganancia por vender un inmueble se integra en la base del ahorro (${lirpf("arts. 46 y 49")}) y paga esta escala, ya sumadas las partes estatal y autonómica:</p>
    ${tablaEscala(escAhorro, "Tramo de la base liquidable del ahorro")}
    ${citaFuente(ah)}${citaFuente(aha)}
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Ejemplo: comprar a ${euros(venta.compra)} y vender a ${euros(venta.precio)}</h2>
    <p class="ayuda">${esc(SUP_VIV(P))} Vivienda comprada en 2012 y vendida en ${P.ejercicio}, sin gastos de compraventa, sin amortizaciones y sin exenciones.</p>
    ${tablaG(["Concepto", "Importe"], [
      ["Valor de transmisión", esc(eur(venta.precio))],
      ["Valor de adquisición", esc(eur(-venta.compra))],
      ["Ganancia patrimonial (base del ahorro)", esc(eur(gan))],
      ["IRPF del año solo con el sueldo", esc(eur(D.base.irpf))],
      ["IRPF del año con el sueldo y la venta", esc(eur(vend.irpf))],
      ["IRPF que añade la venta", `<b>${esc(eur(D.dif(vend)))}</b>`]
    ])}
    <p>La ganancia de ${eur(gan)} sube el IRPF del año ${eur(D.dif(vend))}, un ${pct(D.dif(vend) / gan)} de la ganancia. Como va a la base del ahorro, no se suma al sueldo ni cambia su tipo marginal. Los gastos de la compra y de la venta reducirían esa ganancia.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Exención por reinversión en vivienda habitual</h2>
    <p>Si vendes tu vivienda habitual y reinviertes lo que obtienes en comprar otra vivienda habitual, la ganancia queda exenta (${lirpf("art. 38.1")}). Las condiciones las desarrolla el ${rirpf("art. 41")}:</p>
    <ul>
      <li>La reinversión tiene que hacerse dentro del plazo que fija el ${rirpf("art. 41")}, que cuenta tanto hacia atrás como hacia delante desde la venta.</li>
      <li>Si reinviertes solo una parte, la exención es proporcional a la parte reinvertida.</li>
      <li>Si la vivienda vendida tenía hipoteca, cuenta como importe obtenido el precio de venta menos el préstamo pendiente que se cancela.</li>
      <li>La vivienda vendida tiene que ser tu habitual según el concepto del ${rirpf("art. 41 bis")}, que exige un tiempo mínimo de residencia continuada salvo causas justificadas.</li>
      <li>La intención de reinvertir se comunica en la declaración del año de la venta.</li>
    </ul>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Exención para mayores de 65 años</h2>
    <p>Está exenta la ganancia por la venta de la vivienda habitual cuando la vende una persona mayor de 65 años o en situación de dependencia severa o de gran dependencia (${lirpf("art. 33.4.b")}). No hace falta reinvertir. Si la vivienda es de dos titulares y solo uno cumple la edad, solo su parte queda exenta.</p>
    <p>Para otros bienes, el ${lirpf("art. 38.3")} prevé además una exención para mayores de 65 años que reinviertan en una renta vitalicia asegurada, con los requisitos y el límite de ese artículo.</p>
  </div>
  ${aviso("La calculadora de Mapafiscal todavía no aplica la exención por reinversión en vivienda habitual ni la de mayores de 65 años: trata toda la ganancia como sujeta. Si te corresponde alguna de las dos, el resultado saldrá más alto que lo que pagarás de verdad.")}
  ${FUENTES_VIV}
  ${cta("Calcula tu IRPF con la venta", HERRAMIENTA.calculadora)}`;
  const faq = [
    ["¿Cuánto IRPF se paga por vender una vivienda?", `Depende de la ganancia, no del precio. Comprar a ${euros(venta.compra)} y vender a ${euros(venta.precio)} deja una ganancia de ${euros(gan)} que, con un sueldo de ${euros(VIV_BRUTO)} en Madrid, sube el IRPF del año ${eur(D.dif(vend))} según el motor de Mapafiscal, sin gastos ni exenciones.`],
    ["¿La venta de una vivienda se suma al sueldo?", "No. La ganancia va a la base del ahorro y tributa con su propia escala, sin subir el tipo marginal del sueldo."],
    ["¿Qué gastos reducen la ganancia?", "Los de la compra que pagaste (notaría, registro, impuesto de transmisiones o IVA) aumentan el valor de adquisición; los de la venta a tu cargo (inmobiliaria, plusvalía municipal) reducen el valor de transmisión (art. 35 de la Ley del IRPF)."],
    ["¿Si reinvierto en otra vivienda no pago nada?", "Si vendes tu vivienda habitual y reinviertes todo lo obtenido en otra vivienda habitual dentro del plazo del art. 41 del Reglamento, la ganancia queda exenta (art. 38.1 de la Ley). Si reinviertes una parte, la exención es proporcional."],
    ["¿Los mayores de 65 pagan IRPF al vender su casa?", "No por la venta de su vivienda habitual: esa ganancia está exenta (art. 33.4.b de la Ley del IRPF). Una segunda vivienda sí tributa."]
  ];
  return paginaViv(g, { slug: "venta-vivienda", h1: "Vender una vivienda: cuánto IRPF se paga por la ganancia",
    titulo: "Vender una vivienda: IRPF de la ganancia patrimonial",
    resumen: `tributa la ganancia, no el precio, en la base del ahorro. Comprar a ${euros(venta.compra)} y vender a ${euros(venta.precio)} sube el IRPF del año <b>${eur(D.dif(vend))}</b>, salvo exención por reinversión o por tener más de 65 años.`,
    description: `IRPF al vender una vivienda: ganancia patrimonial, base del ahorro y exenciones por reinversión y mayores de 65. Ejemplo de ${euros(venta.compra)} a ${euros(venta.precio)}.`,
    cuerpo, faq, generado: g.generado });
}

// ---- Vender un piso alquilado ----------------------------------------------------------------
function guiaVenderAlquilado(g) {
  const D = datosVivienda(), { P, venta, vend } = D;
  const gan = vend.liq.baseImponibleAhorro;
  const cuerpo = `
  <p class="entradilla">Si vendes un piso que has tenido alquilado, la ganancia patrimonial es mayor que la simple diferencia entre el precio de venta y el de compra. La razón es la amortización: durante los años de alquiler te has deducido cada año una parte del coste del inmueble, y al venderlo esa parte se descuenta del valor de adquisición.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Por qué la amortización aumenta la ganancia</h2>
    <p>Mientras la vivienda está alquilada, la amortización es un gasto deducible del <a href="/glosario/rendimientos-capital-inmobiliario/">rendimiento del capital inmobiliario</a> (${lirpf("art. 23.1.b")} y ${rirpf("art. 14")}): reconoce que el edificio se desgasta y te permite restar cada año una parte de su coste, sin incluir el valor del suelo.</p>
    <p>Al vender, el ${lirpf("art. 35.1")} manda minorar el valor de adquisición en el importe de esas amortizaciones. Así se evita restar dos veces el mismo coste: una vez en los alquileres de cada año y otra en la venta. Con un valor de adquisición más bajo, la diferencia con el precio de venta, y por tanto la ganancia, es más alta.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">La amortización mínima, aunque no la dedujeras</h2>
    <p>El ${rirpf("art. 40")} establece que se resta, en todo caso, una amortización mínima por los años en que el inmueble estuvo alquilado, calculada con el porcentaje y la base del ${rirpf("art. 14")}. Es decir: aunque no te dedujeras la amortización en tus declaraciones de alquiler, al vender se descuenta igualmente del valor de adquisición.</p>
    <p>Por eso conviene deducirla cada año mientras alquilas: si no lo haces, pierdes el ahorro en los alquileres y pagas igual la ganancia mayor al vender.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Qué datos necesitas</h2>
    <ul>
      <li>El precio de compra y los gastos y tributos de la compra, y qué parte corresponde a la construcción y cuál al suelo (la escritura y el recibo del IBI ayudan a repartirlo).</li>
      <li>Los años y días en que estuvo alquilada y las amortizaciones deducidas en cada declaración.</li>
      <li>Las mejoras hechas en la vivienda, que suman al valor de adquisición y también se amortizan mientras está alquilada.</li>
      <li>El precio de venta y los gastos de la venta a tu cargo.</li>
    </ul>
    <p>Si la vivienda alquilada era antes tu vivienda habitual, o lo fue después, la exención por reinversión solo puede aplicarse si cumple los requisitos de vivienda habitual en el momento de la venta (${lirpf("art. 38.1")} y ${rirpf("arts. 41 y 41 bis")}). Un piso que se vende estando alquilado no es tu vivienda habitual.</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Ejemplo con el motor: la ganancia sin amortización</h2>
    <p class="ayuda">${esc(SUP_VIV(P))} Compra a ${euros(venta.compra)} y venta a ${euros(venta.precio)} en ${P.ejercicio}, sin gastos ni amortización.</p>
    ${tablaG(["Concepto", "Importe"], [
      ["Valor de transmisión", esc(eur(venta.precio))],
      ["Valor de adquisición sin restar amortización", esc(eur(-venta.compra))],
      ["Ganancia patrimonial sin amortización", esc(eur(gan))],
      ["IRPF que añade la venta", `<b>${esc(eur(D.dif(vend)))}</b>`]
    ])}
    <p>Sin tener en cuenta la amortización, la venta añade ${eur(D.dif(vend))} al IRPF del año. Si el piso estuvo alquilado, la ganancia real es mayor: el valor de adquisición baja en la suma de las amortizaciones de los años de alquiler, la ganancia sube en esa misma cantidad y cada euro de más tributa al tipo de la base del ahorro que le corresponda. Cuantos más años haya estado alquilado, mayor es la diferencia.</p>
  </div>
  ${aviso("El motor de Mapafiscal no calcula la amortización acumulada de los años de alquiler ni la resta del valor de adquisición. Si introduces en la calculadora el valor de adquisición ya minorado por las amortizaciones, el resultado sí reflejará la ganancia real.")}
  ${FUENTES_VIV}
  ${cta("Calcula tu IRPF con la venta", HERRAMIENTA.calculadora)}`;
  const faq = [
    ["¿Por qué pago más IRPF al vender un piso que he tenido alquilado?", "Porque las amortizaciones de los años de alquiler se restan del valor de adquisición (art. 35.1 de la Ley del IRPF). Con un valor de compra más bajo, la ganancia patrimonial es mayor."],
    ["¿Se resta la amortización si no me la deduje?", "Sí. El art. 40 del Reglamento del IRPF obliga a restar al menos la amortización mínima de los años de alquiler, la dedujeras o no."],
    ["¿La amortización incluye el valor del suelo?", "No. El suelo no se amortiza: solo la construcción, el mobiliario y las mejoras (art. 14 del Reglamento del IRPF)."],
    [`¿Cuánto IRPF pago si compré a ${euros(venta.compra)} y vendo a ${euros(venta.precio)}?`, `Sin amortización, ${eur(D.dif(vend))} más en el IRPF del año con un sueldo de ${euros(VIV_BRUTO)} en Madrid, según el motor de Mapafiscal. Si estuvo alquilado, algo más, porque la amortización aumenta la ganancia.`],
    ["¿Puedo aplicar la exención por reinversión al vender un piso alquilado?", "No, si en la venta no es tu vivienda habitual: la exención del art. 38.1 de la Ley del IRPF es solo para la vivienda habitual."]
  ];
  return paginaViv(g, { slug: "vender-piso-alquilado", h1: "Vender un piso alquilado: la amortización y el IRPF",
    titulo: "Vender un piso alquilado: amortización e IRPF",
    resumen: `la amortización de los años de alquiler se resta del valor de adquisición (art. 35.1 de la Ley y art. 40 del Reglamento), así que la ganancia es mayor que la diferencia de precios. Sin ella, vender a ${euros(venta.precio)} lo comprado a ${euros(venta.compra)} añade ${eur(D.dif(vend))} al IRPF.`,
    description: `Vender un piso alquilado: la amortización reduce el valor de adquisición y aumenta la ganancia (art. 40 del Reglamento del IRPF). Ejemplo con el motor.`,
    cuerpo, faq, generado: g.generado });
}

export const PAGINAS_VIVIENDA = [
  { slug: null, fn: guiaViviendaHub },
  { slug: "segunda-vivienda", enlace: "Segunda vivienda: imputación de rentas", resumen: "Cuánto se imputa por el valor catastral, prorrata por días y copropiedad.", fn: guiaSegundaVivienda },
  { slug: "alquiler-por-temporadas", enlace: "Alquiler por temporadas", resumen: "Rendimiento por los días alquilados, imputación por el resto y la reducción de vivienda.", fn: guiaAlquilerTemporadas },
  { slug: "venta-vivienda", enlace: "Vender una vivienda", resumen: "La ganancia patrimonial, la base del ahorro y las exenciones por reinversión y por edad.", fn: guiaVentaVivienda },
  { slug: "vender-piso-alquilado", enlace: "Vender un piso alquilado", resumen: "Por qué la amortización de los años de alquiler aumenta la ganancia.", fn: guiaVenderAlquilado }
];

// g: web/datos/seo_guias.json (escala del ahorro con su norma).
export function paginasVivienda(g) {
  return PAGINAS_VIVIENDA.map(x => x.fn(g));
}
