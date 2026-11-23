// =============================================================================
// Sección «Autónomos»: /autonomos/ (cómo tributa un autónomo en estimación directa, paso a
// paso) y /autonomos/<territorio>/ para los 19 territorios (IRPF con 20.000, 30.000 y
// 45.000 € de rendimiento neto y puesto entre los 19).
//
// Todas las cifras salen del motor JS (web/js/irpfsim.js, rnActividades y liquidar, con
// paridad al céntimo con R/03_rentas.R) sobre los parámetros exportados del ejercicio de las
// páginas SEO (web/datos/params*.json). Aquí no se escribe ningún importe a mano.
//
// Lo que no está en params no lleva cifra: la cuota de autónomos (RETA) y sus tramos, el
// porcentaje de los pagos fraccionados (modelo 130, art. 110 RIRPF) y de las retenciones de
// las facturas se explican en texto con su norma. Tampoco hay páginas por municipio: la
// escala y el mínimo del IRPF son los mismos en toda una comunidad o territorio foral.
// Lo usa tools/generar_paginas_seo.mjs.
// =============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SLUG, ORDEN_TERRITORIOS, NOMBRE_CORTO, LIRPF_BOE, esc, euros, eurosExactos as eur, pct, pctCorto, urlBoe,
  layout, jsonLdMigas, jsonLdArticulo, jsonLdFaq, bloqueFaq, migasHtml, respuestaDirecta, tituloQueQuepa, bloqueCalculoRapido
} from "./seo_comun.mjs";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const MOTOR = createRequire(import.meta.url)(join(WEB, "js", "irpfsim.js"));
const RIRPF_BOE = urlBoe("BOE-A-2007-6820");
export const HUB_AUTONOMOS = "/autonomos/";

// Supuestos: persona sola de 40 años, sin hijos ni otras rentas, tributación individual.
const EDAD = 40;
const RENDIMIENTOS = [20000, 30000, 45000];
const REFERENCIA = 30000;                     // la columna que ordena el índice
const EJEMPLO = { territorio: "ES-MD", ingresos: 30000, gastos: 6000 };

// Los parámetros del ejercicio pedido (el de las páginas SEO).
function paramsDe(ej) {
  for (const n of readdirSync(join(WEB, "datos")).filter(n => /^params(_\d{4})?\.json$/.test(n))) {
    const P = JSON.parse(readFileSync(join(WEB, "datos", n), "utf8"));
    if (P.ejercicio === ej) return P;
  }
  throw new Error(`seo_autonomos: no hay web/datos/params*.json del ejercicio ${ej}`);
}

const lirpf = art => `<a href="${LIRPF_BOE}" rel="noopener">${esc(art)} de la Ley 35/2006 del IRPF</a>`;
const rirpf = art => `<a href="${RIRPF_BOE}" rel="noopener">${esc(art)} del Reglamento del IRPF</a>`;
const FUENTES = `<p class="cita">Fuentes primarias: <a href="${LIRPF_BOE}" rel="noopener">Ley 35/2006, del IRPF (texto consolidado, BOE-A-2006-20764)</a> y <a href="${RIRPF_BOE}" rel="noopener">Real Decreto 439/2007, Reglamento del IRPF (texto consolidado, BOE-A-2007-6820)</a>.</p>`;
const cta = (txt, href, sec) => `<p><a class="btn btn-pri" href="${href}">${esc(txt)}</a>${sec ? ` <a class="btn btn-sec" href="${sec[1]}">${esc(sec[0])}</a>` : ""}</p>`;
const tabla = (cab, filas) => `<div class="envoltorio"><table class="cobertura"><thead><tr>${cab.map((c, i) => `<th${i ? ' class="num"' : ""}>${esc(c)}</th>`).join("")}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((c, i) => `<td${i ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

// Nombre oficial con su artículo en la frase: «en la Comunidad de Madrid», «del Principado de Asturias».
const art = n => /^(Comunidad|Comunitat|Región)\b/.test(n) ? "la " + n : /^Principado\b/.test(n) ? "el " + n : n;
const en = n => "en " + art(n);
const de = n => /^el /.test(art(n)) ? "del " + n : "de " + art(n);
const Art = n => art(n).charAt(0).toUpperCase() + art(n).slice(1);

// ---- motor ------------------------------------------------------------------------
function liquidar(P, territorio, actividades) {
  const d1 = { id: "d1", rol: "declarante", edad: EDAD, actividades };
  return MOTOR.liquidar({ territorio, ejercicio: P.ejercicio, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no", miembros: [d1] }, P, "auto");
}
// Territorios: se parte del rendimiento neto ya calculado (ingresos menos gastos), porque
// las normas forales fijan sus propias reglas para calcularlo; así la cifra solo depende de
// la escala, los mínimos y las deducciones de cada territorio.
const irpfConRendimiento = (P, t, r) => MOTOR.irpfAnual(liquidar(P, t, { metodo: "directa_normal", rendimientoNetoPrevio: r }));

// { porRendimiento: { r: [{ t, irpf, puesto }] ordenada } }: puesto = 1 + territorios que pagan menos
function ranking(P) {
  const out = {};
  for (const r of RENDIMIENTOS) {
    const lista = ORDEN_TERRITORIOS.map(t => ({ t, irpf: irpfConRendimiento(P, t, r) })).sort((a, b) => a.irpf - b.irpf);
    for (const x of lista) x.puesto = 1 + lista.filter(y => y.irpf < x.irpf).length;
    out[r] = lista;
  }
  return out;
}
const empatados = (lista, x) => lista.filter(y => y.irpf === x.irpf).length;

// ---- textos comunes ------------------------------------------------------------------
const SUPUESTO = P => `Persona sola de ${EDAD} años, sin hijos ni otras rentas, tributación individual, sin deducciones ni reducciones especiales; IRPF del ejercicio ${P.ejercicio} (renta que se declara en ${P.ejercicio + 1}) calculado con el motor de Mapafiscal. No es una liquidación oficial.`;
const RENDIMIENTO_EXPLICADO = "El rendimiento neto es lo que facturas sin IVA menos los gastos deducibles de la actividad, entre ellos tu cuota de autónomo.";

function tarjetaReta() {
  return `<div class="tarjeta"><h2 class="rotulo">La cuota de autónomos: un gasto, no un impuesto</h2>
    <p>La cuota mensual a la Seguridad Social de los trabajadores autónomos (RETA) no es IRPF: es una cotización. En el IRPF cuenta como <b>gasto deducible</b> de la actividad, así que la restas de tus ingresos antes de calcular el impuesto. El rendimiento neto de una actividad se calcula con las normas del Impuesto sobre Sociedades (${lirpf("art. 28.1")}), y el Manual práctico de Renta de la Agencia Tributaria incluye las cotizaciones del titular de la actividad a la Seguridad Social entre los gastos deducibles.</p>
    <p><b>Esta página no calcula la cuota de autónomos</b> ni sus tramos por rendimientos: no están entre los parámetros del motor con su fuente oficial. Si la pagas, súmala a tus gastos antes de mirar las tablas.</p>
  </div>`;
}

function tarjetaPagos(enlaceHub) {
  return `<div class="tarjeta"><h2 class="rotulo">Pagos a cuenta: modelo 130 y retenciones de las facturas</h2>
    <p>El IRPF de un autónomo no se paga de golpe en la renta. A lo largo del año se adelanta de una de estas dos formas, y en la declaración se resta lo ya adelantado:</p>
    <ul>
      <li><b>Pagos fraccionados (modelo 130).</b> Cada trimestre ingresas un porcentaje del rendimiento neto acumulado desde el 1 de enero, menos lo ya pagado en los trimestres anteriores y las retenciones que te hayan hecho. El porcentaje y la forma de cálculo están en el ${rirpf("art. 110")}, y la obligación de hacerlos, en el ${lirpf("art. 99")}.</li>
      <li><b>Retenciones en la factura.</b> Los profesionales que facturan a empresas o a otros autónomos sufren una retención en cada factura (${lirpf("art. 101.5")} y ${rirpf("art. 95")}). Si la mayor parte de tus ingresos del año anterior llevaron retención, no tienes que presentar el modelo 130 (${rirpf("art. 109")}).</li>
    </ul>
    <p>Mapafiscal no calcula todavía los pagos fraccionados: el porcentaje no está entre los parámetros del motor. Los pagos a cuenta no cambian lo que pagas en total, solo cuándo lo pagas: el IRPF del año es la cifra de las tablas${enlaceHub ? `; el detalle está en la <a href="${HUB_AUTONOMOS}">guía del IRPF de autónomos</a>` : ""}.</p>
  </div>`;
}

const NO_CALCULA = `<div class="tarjeta"><h2 class="rotulo">Lo que estas cifras no incluyen</h2>
    <ul>
      <li>La cuota de autónomos (RETA) y sus tramos: réstala como gasto.</li>
      <li>La estimación objetiva (módulos): su rendimiento se calcula con la orden anual de módulos, que el motor aún no recoge.</li>
      <li>Las reducciones del ${lirpf("art. 32.2")} para autónomos económicamente dependientes o con rendimientos bajos, que dependen de requisitos que la página no conoce.</li>
      <li>Las deducciones autonómicas y forales, que dependen de tu situación (hijos, alquiler, municipio…). La <a href="/index.html#calculadora">calculadora</a> sí las aplica.</li>
      <li>El IVA (o el IGIC en Canarias), que es otro impuesto.</li>
    </ul>
  </div>`;

// ---- página por territorio -------------------------------------------------------------
function textoMunicipio(P, t) {
  const nombre = P.territorios[t].nombre, comun = P.territorios[t].regimen === "comun";
  const ejemplo = t === "ES-MD" ? " Da igual que vivas en la capital, en Griñón o en Humanes de Madrid: con el mismo rendimiento, el IRPF sale igual." : "";
  return `<div class="tarjeta"><h2 class="rotulo">¿Cambia el IRPF de un autónomo según el municipio?</h2>
    <p>No. El IRPF se paga según la ${comun ? "comunidad autónoma" : "hacienda foral"} donde tienes tu residencia habitual, no según el municipio: ${comun ? `la escala estatal y la autonómica ${esc(de(nombre))}` : `la escala ${esc(de(nombre))}`} y el mínimo personal son los mismos en todos sus pueblos y ciudades.${esc(ejemplo)} Por eso esta página no tiene una versión por municipio.</p>
    <p>Lo que sí puede depender del municipio son algunas deducciones (por ejemplo, por vivir en zonas rurales o con poca población, si ${esc(art(nombre))} las tiene) y los impuestos locales, como el IAE o el IBI, que no son IRPF. Las cifras de esta página no incluyen deducciones.</p>
  </div>`;
}

function preguntasTerritorio(P, t, rk) {
  const nombre = P.territorios[t].nombre, comun = P.territorios[t].regimen === "comun";
  const x = rk[REFERENCIA].find(y => y.t === t);
  return [
    [`¿Cuánto IRPF paga un autónomo ${en(nombre)}?`, `Con ${euros(REFERENCIA)} de rendimiento neto al año, una persona sola sin hijos paga ${euros(x.irpf)} de IRPF en ${P.ejercicio} ${en(nombre)}: un tipo medio del ${pct(x.irpf / REFERENCIA)}. Con ${euros(RENDIMIENTOS[0])} paga ${euros(rk[RENDIMIENTOS[0]].find(y => y.t === t).irpf)} y con ${euros(RENDIMIENTOS[2])}, ${euros(rk[RENDIMIENTOS[2]].find(y => y.t === t).irpf)}.`],
    [`¿El IRPF de un autónomo cambia según el municipio ${de(nombre)}?`, `No. La escala del IRPF y el mínimo personal son los mismos en toda ${comun ? "la comunidad" : "el territorio"}; solo algunas deducciones pueden depender del municipio.`],
    ["¿La cuota de autónomos se resta en el IRPF?", "Sí. La cuota a la Seguridad Social de los autónomos (RETA) es un gasto deducible de la actividad: se resta de los ingresos para llegar al rendimiento neto. Esta página no calcula esa cuota."],
    ["¿Qué es el modelo 130?", "Es la declaración trimestral de los pagos fraccionados del IRPF de los autónomos en estimación directa: un adelanto del impuesto sobre el rendimiento acumulado del año (art. 110 del Reglamento del IRPF). No se presenta si la mayor parte de los ingresos llevan retención."],
    [`¿${Art(nombre)} es de los territorios donde un autónomo paga menos IRPF?`, `Con ${euros(REFERENCIA)} de rendimiento neto, ${art(nombre)} ocupa el puesto ${x.puesto} de 19 (1 = el que menos IRPF cobra). La diferencia con el más barato es de ${euros(Math.round(x.irpf) - Math.round(rk[REFERENCIA][0].irpf))} al año.`]
  ];
}

function paginaTerritorio(P, t, rk, generado) {
  const nombre = P.territorios[t].nombre, corto = NOMBRE_CORTO[t], comun = P.territorios[t].regimen === "comun";
  const ruta = `${HUB_AUTONOMOS}${SLUG[t]}/`;
  const fila = r => rk[r].find(y => y.t === t);
  const x = fila(REFERENCIA), primero = rk[REFERENCIA][0];
  const puestoTxt = y => `${y.puesto} de 19${empatados(rk[y.r], y) > 1 ? " (empate)" : ""}`;
  const filas = RENDIMIENTOS.map(r => {
    const y = Object.assign({ r }, fila(r)), min = rk[r][0];
    return [esc(euros(r)), `<b>${esc(eur(y.irpf))}</b>`, esc(pct(y.irpf / r)), esc(puestoTxt(y)), esc(difEurosTxt(y.irpf, min.irpf))];
  });
  const qs = preguntasTerritorio(P, t, rk);
  const migas = [["Inicio", "/"], ["Autónomos", HUB_AUTONOMOS], [nombre, null]];
  const foral = comun ? "" : `<p>${esc(Art(nombre))} tiene su propio IRPF (${t === "ES-NC" ? "convenio económico de Navarra" : "concierto económico del País Vasco"}): lo regula su norma foral y lo gestiona su hacienda foral, que también fija sus propias reglas para calcular el rendimiento de la actividad. Por eso las cifras parten del rendimiento neto ya calculado. Más detalles en <a href="/irpf/${SLUG[t]}/">el IRPF ${esc(de(nombre))}</a>.</p>`;
  const canarias = t === "ES-CN" ? `<p>En Canarias no hay IVA: los autónomos repercuten el IGIC. Es otro impuesto, que esta página no calcula; el IRPF canario sigue la escala estatal y la autonómica de Canarias como en el resto de comunidades de régimen común.</p>` : "";
  const main = `
  <h1>IRPF de un autónomo ${esc(en(nombre))} (${P.ejercicio}): cuánto pagas</h1>
  ${respuestaDirecta(`con ${esc(euros(REFERENCIA))} de rendimiento neto, un autónomo ${esc(en(nombre))} paga <b>${esc(eur(x.irpf))}</b> de IRPF en ${P.ejercicio}, un ${esc(pct(x.irpf / REFERENCIA))} de lo que gana. Es el puesto ${esc(x.puesto)} de los 19 territorios fiscales.`)}
  ${bloqueCalculoRapido({ territorio: t, ejercicio: P.ejercicio, titulo: `Si cobras una nómina: tu sueldo neto ${en(nombre)}`,
    nota: "Es el cálculo de un sueldo por cuenta ajena; el IRPF de tu actividad como autónomo, con tus ingresos y gastos, está en la calculadora completa." })}
  <div class="prosa">
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">IRPF de un autónomo ${esc(en(nombre))} según el rendimiento</h2>
    <p class="ayuda">${esc(RENDIMIENTO_EXPLICADO)} ${esc(SUPUESTO(P))} Puesto: 1 = el territorio donde menos IRPF se paga con ese rendimiento.</p>
    ${tabla(["Rendimiento neto", "IRPF del año", "Tipo medio", "Puesto", "Más que el más barato"], filas)}
    <p class="ayuda">Con ${esc(euros(REFERENCIA))}, donde menos se paga es en <a href="${HUB_AUTONOMOS}${SLUG[primero.t]}/">${esc(P.territorios[primero.t].nombre)}</a> (${esc(eur(primero.irpf))}). <a href="${HUB_AUTONOMOS}#ranking">Ver los 19 territorios</a>.</p>
  </div>
  <div class="tarjeta"><h2 class="rotulo">Cómo se llega a esa cifra</h2>
    <p>El rendimiento neto de la actividad va a la base imponible general, como un sueldo. Sobre ella se aplica ${comun ? `la escala estatal y la autonómica ${esc(de(nombre))}` : `la escala foral ${esc(de(nombre))}`}, menos el mínimo personal${comun ? "" : " (o la minoración de cuota que lo sustituye)"}. A diferencia de un asalariado, un autónomo no tiene la reducción por rendimientos del trabajo ni gastos fijos de trabajador: sus gastos son los de su actividad.</p>
    ${foral}${canarias}
    <p>El paso a paso con ingresos, gastos y gastos de difícil justificación está en la <a href="${HUB_AUTONOMOS}">guía del IRPF de autónomos en estimación directa</a>.</p>
  </div>
  ${textoMunicipio(P, t)}
  ${tarjetaReta()}
  ${tarjetaPagos(true)}
  ${NO_CALCULA}
  ${cta(`Calcula tu IRPF en ${corto}`, "/index.html#calculadora", ["IRPF de autónomos por territorio", HUB_AUTONOMOS])}
  ${bloqueFaq(qs)}
  <div class="tarjeta">${FUENTES}<p>Más: <a href="/irpf/${SLUG[t]}/">IRPF ${esc(en(nombre))}</a> · <a href="/glosario/rendimientos-actividades-economicas/">rendimientos de actividades económicas</a> · <a href="/guias/obligacion-declarar-renta/">¿estoy obligado a declarar?</a></p></div>
  </div>`;
  const title = tituloQueQuepa(`IRPF autónomos ${corto} ${P.ejercicio}: cuánto paga un autónomo`, `IRPF autónomos ${corto} ${P.ejercicio}: cuánto paga`, `IRPF autónomos ${corto} ${P.ejercicio}`);
  const description = `Un autónomo en ${corto} con ${euros(REFERENCIA)} de rendimiento neto paga ${euros(x.irpf)} de IRPF en ${P.ejercicio} (puesto ${x.puesto} de 19). Tablas con ${euros(RENDIMIENTOS[0])} y ${euros(RENDIMIENTOS[2])}.`;
  return { ruta, html: layout({ title, description, canonical: ruta, breadcrumb: migasHtml(migas), main, generado, ejercicio: P.ejercicio,
    jsonld: [jsonLdMigas(migas), jsonLdArticulo({ titulo: title, descripcion: description, ruta, generado }), jsonLdFaq(qs)] }) };
}
const difEurosTxt = (a, b) => Math.round(a) === Math.round(b) ? "—" : "+" + euros(Math.round(a) - Math.round(b));

// ---- portada de la sección --------------------------------------------------------------
function pasoAPaso(P) {
  const s = P.estatal.actividades_directa_simplificada;
  const { territorio, ingresos, gastos } = EJEMPLO;
  const previo = ingresos - gastos;
  const liq = liquidar(P, territorio, { metodo: "directa_simplificada", rendimientoNetoPrevio: previo });
  const rn = liq.componentesRenta.actividades, irpf = MOTOR.irpfAnual(liq);
  const ini = MOTOR.irpfAnual(liquidar(P, territorio, { metodo: "directa_simplificada", rendimientoNetoPrevio: previo, inicioActividad: true }));
  return { s, liq, rn, irpf, ini, previo, ingresos, gastos, territorio, dificil: previo - rn };
}

function preguntasHub(P, ej, rk) {
  const { s } = ej, c = rk[REFERENCIA];
  return [
    ["¿Cuánto IRPF paga un autónomo?", `Depende del rendimiento neto (ingresos menos gastos) y del territorio. Con ${euros(ej.ingresos)} de ingresos y ${euros(ej.gastos)} de gastos ${en(P.territorios[ej.territorio].nombre)}, una persona sola sin hijos paga ${euros(ej.irpf)} de IRPF en ${P.ejercicio}. Con ${euros(REFERENCIA)} de rendimiento neto, va de ${euros(c[0].irpf)} ${en(P.territorios[c[0].t].nombre)} a ${euros(c[c.length - 1].irpf)} ${en(P.territorios[c[c.length - 1].t].nombre)}.`],
    ["¿Qué son los gastos de difícil justificación?", `En estimación directa simplificada puedes restar, sin justificarlos, un ${pctCorto(s.gastos_dificil_justificacion_pct)} del rendimiento neto previo, con un máximo de ${euros(s.gastos_dificil_justificacion_max)} al año (${s.norma}).`],
    ["¿La cuota de autónomos desgrava en la renta?", "Sí: la cuota del RETA es un gasto deducible de la actividad y se resta de los ingresos. No es una deducción de la cuota del IRPF, sino un gasto que baja el rendimiento neto."],
    ["¿Qué es el modelo 130 y cuánto se paga?", "Es el pago fraccionado trimestral del IRPF de los autónomos en estimación directa: un adelanto calculado sobre el rendimiento neto acumulado del año, según el art. 110 del Reglamento del IRPF. Mapafiscal no calcula su importe. En la renta se resta todo lo adelantado."],
    ["¿Paga menos IRPF un autónomo que un asalariado?", `No hay una respuesta única. El asalariado resta sus cotizaciones, ${euros(P.estatal.trabajo_otros_gastos.generico)} de otros gastos (${P.estatal.trabajo_otros_gastos.norma}) y, con sueldos bajos, la reducción por rendimientos del trabajo; el autónomo resta su cuota de autónomo y los gastos reales de su actividad y, en estimación directa simplificada, los gastos de difícil justificación. Compara tu caso en la calculadora.`]
  ];
}

function paginaHub(P, rk, generado) {
  const ej = pasoAPaso(P), { s, liq } = ej;
  const nombreEj = P.territorios[ej.territorio].nombre;
  const mpf = liq.minimoPersonalFamiliar.total;
  const filasPaso = [
    ["Ingresos de la actividad (sin IVA)", esc(eur(ej.ingresos))],
    ["− Gastos deducibles (incluida, si la pagas, la cuota de autónomo)", esc("−" + eur(ej.gastos))],
    ["= Rendimiento neto previo", esc(eur(ej.previo))],
    [`− Gastos de difícil justificación (${esc(pctCorto(s.gastos_dificil_justificacion_pct))}, máximo ${esc(euros(s.gastos_dificil_justificacion_max))})`, esc("−" + eur(ej.dificil))],
    ["= Rendimiento neto de la actividad", `<b>${esc(eur(ej.rn))}</b>`],
    ["Base liquidable general", esc(eur(liq.baseLiquidableGeneral))],
    ["Mínimo personal (no tributa)", esc(eur(mpf))],
    ["Cuota estatal (escala estatal)", esc(eur(liq.cuotaIntegraEstatal))],
    [`Cuota autonómica (escala ${esc(de(nombreEj))})`, esc(eur(liq.cuotaIntegraAutonomica))],
    ["= IRPF del año", `<b>${esc(eur(ej.irpf))}</b>`],
    ["Tipo medio sobre el rendimiento neto", esc(pct(ej.irpf / ej.rn))]
  ];
  const c = rk[REFERENCIA];
  const fila = (r, t) => rk[r].find(y => y.t === t);
  const filasRk = c.map(x => [`<a href="${HUB_AUTONOMOS}${SLUG[x.t]}/">${esc(P.territorios[x.t].nombre)}</a>`,
    ...RENDIMIENTOS.map(r => esc(eur(fila(r, x.t).irpf))), esc(String(x.puesto))]);
  const qs = preguntasHub(P, ej, rk);
  const migas = [["Inicio", "/"], ["Autónomos", null]];
  const main = `
  <h1>IRPF de autónomos en estimación directa (${P.ejercicio}): cómo se calcula</h1>
  ${respuestaDirecta(`un autónomo ${esc(en(nombreEj))} que factura ${esc(euros(ej.ingresos))} y tiene ${esc(euros(ej.gastos))} de gastos paga <b>${esc(eur(ej.irpf))}</b> de IRPF en ${P.ejercicio}. Con ${esc(euros(REFERENCIA))} de rendimiento neto, el IRPF va de ${esc(eur(c[0].irpf))} ${esc(en(P.territorios[c[0].t].nombre))} a ${esc(eur(c[c.length - 1].irpf))} ${esc(en(P.territorios[c[c.length - 1].t].nombre))}.`)}
  <div class="prosa">
  <div class="tarjeta"><h2 class="rotulo">Cómo tributa un autónomo en el IRPF</h2>
    <p>Lo que gana un autónomo con su negocio es un <a href="/glosario/rendimientos-actividades-economicas/">rendimiento de actividades económicas</a> (${lirpf("art. 27")}). No tributa por lo que factura, sino por el <b>rendimiento neto</b>: los ingresos menos los gastos necesarios para la actividad. Ese rendimiento se suma a la base general, con el sueldo o la pensión que tengas, y paga según la escala estatal más la de tu comunidad (o la foral, en el País Vasco y Navarra).</p>
    <p>La mayoría de los autónomos calcula el rendimiento en <b>estimación directa simplificada</b>, que se aplica si el importe neto de la cifra de negocios del año anterior no pasó de ${esc(euros(s.umbral_cifra_negocio))} (${rirpf("art. 28")}) y no se renuncia a ella. Funciona como la normal, con una diferencia: además de los gastos que justificas, restas un porcentaje fijo de <b>gastos de difícil justificación</b> (${esc(s.norma)}).</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Paso a paso: ${esc(euros(ej.ingresos))} de ingresos y ${esc(euros(ej.gastos))} de gastos ${esc(en(nombreEj))}</h2>
    <p class="ayuda">${esc(SUPUESTO(P))} Estimación directa simplificada.</p>
    ${tabla(["Concepto", "Importe"], filasPaso)}
    <p class="ayuda">Si es tu primer año con beneficio, o el siguiente, tras empezar la actividad, la reducción por inicio de actividad (${lirpf("art. 32.3")}) baja el IRPF de este ejemplo a ${esc(eur(ej.ini))}.</p>
  </div>
  ${tarjetaReta()}
  ${tarjetaPagos(false)}
  <div class="tarjeta tarjeta-tabla" id="ranking">
    <h2 class="rotulo">Cuánto paga un autónomo en cada territorio</h2>
    <p class="ayuda">IRPF del año con ese rendimiento neto. ${esc(SUPUESTO(P))} Ordenado de menos a más IRPF con ${esc(euros(REFERENCIA))}; en el País Vasco y Navarra se parte del rendimiento neto ya calculado según su norma foral.</p>
    ${tabla(["Territorio", ...RENDIMIENTOS.map(r => euros(r)), `Puesto (${euros(REFERENCIA)})`], filasRk)}
    <p class="ayuda">No hay tablas por municipio: el IRPF no cambia de un municipio a otro de la misma comunidad.</p>
  </div>
  ${NO_CALCULA}
  ${cta("Calcula tu caso", "/index.html#calculadora", ["Comparar territorios", "/index.html#comparar"])}
  ${bloqueFaq(qs)}
  <div class="tarjeta">${FUENTES}<p>Más sobre la renta: <a href="/guias/">guías del IRPF</a> · <a href="/guias/obligacion-declarar-renta/">¿estoy obligado a declarar?</a> · <a href="/irpf/">IRPF por territorio</a>.</p></div>
  </div>`;
  const title = `IRPF de autónomos ${P.ejercicio}: cálculo paso a paso`;
  const description = `Cómo tributa un autónomo en estimación directa: rendimiento neto, gastos de difícil justificación, cuota de autónomo y modelo 130. Con ${euros(REFERENCIA)}, de ${euros(c[0].irpf)} a ${euros(c[c.length - 1].irpf)}.`;
  return { ruta: HUB_AUTONOMOS, html: layout({ title, description, canonical: HUB_AUTONOMOS, breadcrumb: migasHtml(migas), main, generado, ejercicio: P.ejercicio,
    jsonld: [jsonLdMigas(migas), jsonLdArticulo({ titulo: title, descripcion: description, ruta: HUB_AUTONOMOS, generado }), jsonLdFaq(qs)] }) };
}

// [{ ruta, html }]: la portada de la sección y una página por territorio.
// `cifras`: { [territorio]: { [rendimiento]: irpf } } para llms.txt y los tests.
export function paginasAutonomos(ejercicio, generado) {
  const P = paramsDe(ejercicio), rk = ranking(P);
  const paginas = [paginaHub(P, rk, generado), ...ORDEN_TERRITORIOS.map(t => paginaTerritorio(P, t, rk, generado))];
  const cifras = {};
  for (const t of ORDEN_TERRITORIOS) cifras[t] = Object.fromEntries(RENDIMIENTOS.map(r => [r, rk[r].find(y => y.t === t).irpf]));
  return Object.assign(paginas, { cifras, referencia: REFERENCIA, ejercicio: P.ejercicio });
}
