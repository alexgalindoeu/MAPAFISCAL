// =============================================================================
// Página /sueldo-mensual/: sueldos brutos frecuentes (de 15.000 a 60.000 €, de 1.000 en
// 1.000) divididos entre 12 y entre 14 pagas, con el neto en Madrid y la media de los 19
// territorios. Una sola página (no una por importe): cada fila enlaza a la herramienta
// «Sueldo al mes» (index.html#sueldo-mes) con el importe ya puesto.
//
// Aquí no se calcula ningún impuesto: el neto anual sale de irpfsim.sueldoNeto a través de
// web/js/sueldo_mes.js (las mismas funciones que la herramienta) con los parámetros del
// ejercicio de las páginas de sueldo neto, y solo se divide entre las pagas.
// =============================================================================
import { createRequire } from "node:module";
import { ORDEN_TERRITORIOS, esc, eurosExactos, layout, jsonLdMigas, jsonLdFaq, bloqueFaq, migasHtml, respuestaDirecta } from "./seo_comun.mjs";
import { paramsDe } from "./seo_deduccion_ficha.mjs";

const SM = createRequire(import.meta.url)("../web/js/sueldo_mes.js");
export const RUTA_SUELDO_MENSUAL = "/sueldo-mensual/";
export const BRUTOS_MENSUAL = Array.from({ length: 46 }, (_, i) => 15000 + 1000 * i);
const eur = eurosExactos;
// enlace a la herramienta con el importe, las pagas y el territorio
const herramienta = (bruto, pagas, territorio = "ES-MD") => "/index.html" + SM.enlace({ bruto, pagas, territorio });

// Cifras de la tabla: bruto ÷ 12 y ÷ 14; neto ÷ 12 y ÷ 14 en Madrid y en la media de los 19.
export function filasSueldoMensual(P, brutos = BRUTOS_MENSUAL) {
  return brutos.map(b => {
    const netos = ORDEN_TERRITORIOS.map(t => SM.anual(P, { territorio: t }, b).neto);
    const md = SM.anual(P, { territorio: "ES-MD" }, b), media = netos.reduce((s, x) => s + x, 0) / netos.length;
    const r = (a, p) => SM.reparto(a, p, false);
    return { bruto: b, b12: r(md, 12).brutoPaga, b14: r(md, 14).brutoPaga,
      md12: r(md, 12).netoPaga, md14: r(md, 14).netoPaga, netoMd: md.neto,
      media12: r({ bruto: b, neto: media }, 12).netoPaga, media14: r({ bruto: b, neto: media }, 14).netoPaga, netoMedia: media };
  });
}

export function paginaSueldoMensual({ ejercicio, generado }) {
  const P = paramsDe(ejercicio);
  if (!P) throw new Error(`seo_sueldo_mensual: no hay params del ejercicio ${ejercicio}`);
  const EJ = P.ejercicio, filas = filasSueldoMensual(P), de = b => filas.find(f => f.bruto === b);
  const f30 = de(30000), f48 = de(48000), f31 = de(31000), f17 = de(17000), f33 = de(33000);
  const b15 = 30000 / 15, n15 = SM.reparto({ bruto: 30000, neto: f30.netoMd }, 15, false);
  const supuesto = `Neto tras la Seguridad Social del trabajador y el IRPF del ejercicio ${EJ} (lo que queda después de la declaración, no la retención de la nómina), para una persona soltera, sin hijos, de ${SM.EDAD} años, con contrato indefinido y sin otras rentas. La media es la de los 19 territorios fiscales (15 comunidades de régimen común, las tres diputaciones vascas y Navarra). El neto se reparte entre las pagas igual que el bruto.`;
  const faq = [
    ["¿Cuánto es 30.000 € brutos entre 12?", `30.000 € entre 12 pagas son ${eur(f30.b12)} brutos al mes. En neto, unos ${eur(f30.md12)} al mes en Madrid y ${eur(f30.media12)} de media en los 19 territorios (${EJ}).`],
    ["¿Cuánto es 30.000 € brutos entre 14?", `30.000 € entre 14 pagas son ${eur(f30.b14)} brutos por paga: 12 mensualidades y 2 pagas extra. En neto, unos ${eur(f30.md14)} por paga en Madrid y ${eur(f30.media14)} de media; en los meses con paga extra se cobra el doble.`],
    ["¿Cuánto es 48.000 / 12?", `48.000 € brutos al año entre 12 son ${eur(f48.b12)} brutos al mes y unos ${eur(f48.md12)} netos en Madrid (${eur(f48.media12)} de media en los 19 territorios).`],
    ["¿Cuánto es 31.000 / 14?", `31.000 € brutos entre 14 pagas son ${eur(f31.b14)} brutos por paga y unos ${eur(f31.md14)} netos en Madrid (${eur(f31.media14)} de media).`],
    ["¿Cuánto es 17.000 € entre 12?", `17.000 € brutos entre 12 son ${eur(f17.b12)} brutos al mes y unos ${eur(f17.md12)} netos en Madrid (${eur(f17.media12)} de media).`],
    ["¿Cuánto es 33.000 € entre 12?", `33.000 € brutos entre 12 son ${eur(f33.b12)} brutos al mes y unos ${eur(f33.md12)} netos en Madrid (${eur(f33.media12)} de media).`],
    ["¿Es mejor cobrar en 12 o en 14 pagas?", "Con el mismo bruto anual, el neto anual es el mismo; cambia cómo se reparte. En 14 pagas cada nómina es más pequeña, pero en dos meses (normalmente junio y diciembre) se cobra el doble."],
    ["¿Qué significa que las pagas extra van prorrateadas?", "Que las extras no se cobran aparte: se reparten entre las 12 nóminas del año. Con 14 pagas prorrateadas cobras lo mismo que en 12 pagas, todos los meses."],
    ["¿Y si cobro 15 pagas?", `Se divide entre 15: 30.000 € son ${eur(b15)} brutos por paga y unos ${eur(n15.netoPaga)} netos en Madrid. Las tres extras se cobran en otros tantos meses, o prorrateadas en las 12 nóminas.`]
  ];
  const filasHtml = filas.map(f => `<tr><td><a href="${herramienta(f.bruto, 14)}">${esc(eur(f.bruto))}</a></td>
      <td class="num"><a href="${herramienta(f.bruto, 12)}">${esc(eur(f.b12))}</a></td><td class="num"><a href="${herramienta(f.bruto, 14)}">${esc(eur(f.b14))}</a></td>
      <td class="num">${esc(eur(f.md12))}</td><td class="num">${esc(eur(f.md14))}</td><td class="num">${esc(eur(f.media12))}</td><td class="num">${esc(eur(f.media14))}</td></tr>`).join("");
  const titulo = `Sueldo bruto entre 12 y 14 pagas: cuánto es al mes (${EJ})`;
  const migas = [["Inicio", "/"], ["Sueldo neto", "/sueldo-neto/"], ["Sueldo al mes", RUTA_SUELDO_MENSUAL]];
  const main = `
  <h1>${esc(titulo)}</h1>
  <p class="entradilla">Cuánto es al mes tu sueldo bruto anual en 12 o en 14 pagas, en bruto (una división) y en neto con el IRPF y la Seguridad Social de ${EJ}, en Madrid y de media en los 19 territorios fiscales.</p>
  ${respuestaDirecta(`30.000 € brutos entre 12 son ${esc(eur(f30.b12))} al mes y entre 14, ${esc(eur(f30.b14))} por paga. En neto, en Madrid, unos ${esc(eur(f30.md12))} al mes en 12 pagas o ${esc(eur(f30.md14))} en 14.`)}
  <div class="prosa">
  <div class="tarjeta"><h2 class="rotulo">12, 14 o 15 pagas</h2>
    <p>El sueldo bruto anual se divide entre el número de pagas: en 12 pagas, una nómina al mes; en 14, doce mensualidades y dos pagas extra (normalmente en junio y diciembre); en 15, una tercera extra que fija el convenio. Si las extras van <b>prorrateadas</b>, se reparten entre las 12 nóminas y cada mes se cobra lo mismo que en 12 pagas.</p>
    <p><b>El neto anual es el mismo; cambia cómo se reparte.</b> Con ${esc(eur(30000))} brutos, en Madrid quedan ${esc(eur(f30.netoMd))} netos al año tanto en 12 como en 14 o 15 pagas.</p>
    <p>La herramienta también pasa de precio por hora a sueldo mensual y anual (con tus horas semanales) y calcula el neto con jornada parcial.</p>
    <p><a class="btn btn-pri" href="${herramienta(31000, 14)}">Calcula tu sueldo al mes en 12, 14 o 15 pagas</a></p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Sueldos brutos frecuentes entre 12 y 14 pagas</h2>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th rowspan="2">Bruto anual</th><th class="num" colspan="2">Bruto al mes</th><th class="num" colspan="2">Neto al mes en Madrid</th><th class="num" colspan="2">Neto al mes, media de 19</th></tr>
      <tr><th class="num">÷ 12</th><th class="num">÷ 14</th><th class="num">12 pagas</th><th class="num">14 pagas</th><th class="num">12 pagas</th><th class="num">14 pagas</th></tr></thead>
      <tbody>${filasHtml}</tbody></table></div>
    <p class="ayuda">Cada importe abre la herramienta con ese sueldo, para verlo en tu territorio, con tu edad o en 15 pagas. ${esc(supuesto)}</p>
  </div>
  ${bloqueFaq(faq)}
  <p><a class="btn btn-pri" href="${herramienta(30000, 14)}">Sueldo al mes con tus datos</a> <a class="btn btn-sec" href="/sueldo-neto/">Sueldo neto por importe y territorio</a></p>
  <p class="ayuda">Más: <a href="/sueldo-neto/">sueldo neto en los 19 territorios</a> · <a href="/sueldo-neto/30000/">30.000 € brutos a netos</a> · <a href="/sueldo-neto/mensual/2000/">2.000 € brutos al mes a netos</a> · <a href="/comparar-sueldo/">dónde se paga menos IRPF</a></p>
  </div>`;
  return layout({
    jsonld: [jsonLdMigas(migas), jsonLdFaq(faq)],
    title: titulo,
    description: `Tu bruto anual entre 12 y 14 pagas: ${eur(30000)} son ${eur(f30.b12)} al mes en 12 pagas y ${eur(f30.b14)} en 14. Tabla de 15.000 a 60.000 € con el neto en Madrid y la media (${EJ}).`,
    canonical: RUTA_SUELDO_MENSUAL, breadcrumb: migasHtml(migas), main, generado, ejercicio: EJ
  });
}
