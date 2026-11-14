// =============================================================================
// Páginas SEO del rescate del plan de pensiones: /rescate-plan-pensiones/ y una por
// territorio de régimen común. Las cifras salen del motor JS (irpfsim.rescatePlan, con
// paridad al céntimo con R/16_rescate_plan.R en tools/validar_js.R) y de los parámetros
// exportados (web/datos/params_<año>.json): aquí no se escribe ninguna cifra a mano.
// El País Vasco y Navarra regulan el rescate en su normativa foral, que el motor aún no
// recoge: no tienen página. Lo usa tools/generar_paginas_seo.mjs.
// =============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SLUG, ORDEN_TERRITORIOS, esc, euros, pct, layout, jsonLdMigas, jsonLdFaq, bloqueFaq, migasHtml, LIRPF_BOE } from "./seo_comun.mjs";

const require = createRequire(import.meta.url);
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const motor = require(join(WEB, "js", "irpfsim.js"));
const HUB = "/rescate-plan-pensiones/";
const APP = t => `/index.html#rescate-plan${t ? "?t=" + t : ""}`;
const FORMA = { capital: "de una vez", mixto: "mixto", renta: "como renta" };
// supuestos de las tablas: pensión pública de 15.000 €, 65 años, jubilación este año, 5 años
const BASE = { antes2007: 30000, despues2007: 30000, otrosIngresos: 15000, tipoOtros: "pension", edad: 65, anios: 5 };
const PLANES = [[20000, 20000], [30000, 30000], [50000, 50000], [0, 60000]];

// el ejercicio más reciente exportado
function paramsRecientes() {
  const f = readdirSync(join(WEB, "datos")).filter(n => /^params(_\d{4})?\.json$/.test(n))
    .map(n => JSON.parse(readFileSync(join(WEB, "datos", n), "utf8"))).sort((a, b) => b.ejercicio - a.ejercicio);
  return f[0];
}
const cta = (txt, href, sec) => `<p><a class="btn btn-pri" href="${href}">${esc(txt)}</a>${sec ? ` <a class="btn btn-sec" href="${sec[1]}">${esc(sec[0])}</a>` : ""}</p>`;

function reglas(P) {
  const d = P.estatal.prestaciones_prevision_dt12;
  return { d, texto: `Lo que cobras de un plan de pensiones es rendimiento del trabajo (art. 17.2.a.3.º de la Ley del IRPF) y se suma a tus demás ingresos del año, como una pensión o un sueldo. ` +
    `Si lo cobras en forma de capital, la parte que corresponde a lo aportado hasta el 31 de diciembre de 2006 tributa solo al ${100 - 100 * d.porcentaje} % (reducción del ${100 * d.porcentaje} % de la disposición transitoria 12.ª), en un único año. ` +
    `Plazo: si te jubilaste desde ${d.anio_regimen_2015}, el año de la jubilación o los ${d.plazo_desde_2015_anios} siguientes; entre ${d.anio_regimen_2011} y ${d.anio_regimen_2015 - 1}, hasta el ${d.plazo_2011_2014_anios}.º año siguiente; antes de ${d.anio_regimen_2011}, el plazo terminó en ${d.ultimo_anio_anterior_2011}.` };
}

function preguntas(P, nombre) {
  const { d } = reglas(P);
  const en = nombre ? ` en ${nombre}` : "";
  return [
    [`¿Cómo tributa el rescate de un plan de pensiones${en}?`, `Como rendimiento del trabajo: se suma a tus demás ingresos del año y paga IRPF según la escala general${nombre ? ` estatal y la de ${nombre}` : " estatal y la de tu comunidad"}. No hay retención fija: depende de tu base total.`],
    ["¿Qué es la reducción del 40 % del plan de pensiones?", `La parte del plan que corresponde a lo aportado hasta el 31-12-2006 tributa solo al ${100 - 100 * d.porcentaje} % si la cobras en forma de capital y en plazo (disposición transitoria 12.ª de la Ley del IRPF). Se aplica en un único año; lo aportado desde 2007 no tiene reducción.`],
    ["¿Hasta cuándo puedo aplicar la reducción del 40 %?", `Si te jubilaste desde ${d.anio_regimen_2015}, en el año de la jubilación o en los ${d.plazo_desde_2015_anios} siguientes. Si fue entre ${d.anio_regimen_2011} y ${d.anio_regimen_2015 - 1}, hasta el final del ${d.plazo_2011_2014_anios}.º año siguiente. Si fue antes de ${d.anio_regimen_2011}, solo hasta ${d.ultimo_anio_anterior_2011}.`],
    ["¿Qué conviene más: de una vez, como renta o mixto?", "Depende de cuánto tengas antes y después de 2007 y de tus otros ingresos. Rescatar de una vez concentra la renta en un año y sube el tipo, pero aprovecha la reducción; repartirlo baja el tipo de cada año. La forma mixta (lo anterior a 2007 en capital y el resto como renta) suele salir mejor cuando hay mucho aportado antes de 2007."]
  ];
}

function tablaFormas(P, terr) {
  return PLANES.map(([a, b]) => {
    const r = motor.rescatePlan(Object.assign({}, BASE, { territorio: terr, antes2007: a, despues2007: b, anioContingencia: P.ejercicio }), P);
    return `<tr><td>${esc(euros(a + b))}<br><span class="ayuda">${esc(euros(a))} hasta 2006</span></td><td class="num">${esc(euros(r.capital.extra))}</td><td class="num">${esc(euros(r.mixto.extra))}</td><td class="num">${esc(euros(r.renta.extra))}</td><td>${esc(FORMA[r.mejor])}</td></tr>`;
  }).join("");
}
const cabFormas = `<thead><tr><th>Plan</th><th class="num">De una vez</th><th class="num">Mixto (5 años)</th><th class="num">Renta (5 años)</th><th>Menos IRPF</th></tr></thead>`;
const supuesto = P => `Supuesto: pensión pública de ${euros(BASE.otrosIngresos)} al año, 65 años, jubilación en ${P.ejercicio}, tributación individual y normativa de ${P.ejercicio} en todos los años. IRPF extra = lo que sube el impuesto por el rescate, sumando todos los años.`;
const terrComun = P => ORDEN_TERRITORIOS.filter(t => P.territorios[t] && P.territorios[t].regimen === "comun");

function paginaTerritorio(P, terr, generado) {
  const nombre = P.territorios[terr].nombre, ruta = `${HUB}${SLUG[terr]}/`;
  const r = motor.rescatePlan(Object.assign({}, BASE, { territorio: terr, anioContingencia: P.ejercicio }), P);
  const lista = terrComun(P).map(t => ({ t, v: motor.rescatePlan(Object.assign({}, BASE, { territorio: t, anioContingencia: P.ejercicio }), P) }))
    .sort((a, b) => a.v[a.v.mejor].extra - b.v[b.v.mejor].extra);
  const puesto = lista.findIndex(x => x.t === terr) + 1;
  const qs = preguntas(P, nombre), migas = [["Inicio", "/"], ["Rescate del plan de pensiones", HUB], [nombre, null]];
  const total = BASE.antes2007 + BASE.despues2007;
  const main = `
  <h1>Rescate del plan de pensiones en ${esc(nombre)} (${P.ejercicio}): cuánto tributa</h1>
  <p class="entradilla">Con ${esc(euros(total))} en el plan (${esc(euros(BASE.antes2007))} aportados hasta 2006) y una pensión de ${esc(euros(BASE.otrosIngresos))}, rescatarlo en ${esc(nombre)} sube tu IRPF en <b>${esc(euros(r[r.mejor].extra))}</b> si eliges la opción que menos tributa: <b>${esc(FORMA[r.mejor])}</b>. Es el puesto ${puesto} de ${lista.length} territorios de régimen común.</p>
  <div class="prosa">
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">IRPF extra según la forma de rescate en ${esc(nombre)}</h2>
    <p class="ayuda">${esc(supuesto(P))}</p>
    <div class="envoltorio"><table class="cobertura">${cabFormas}<tbody>${tablaFormas(P, terr)}</tbody></table></div>
  </div>
  <div class="tarjeta"><h2 class="rotulo">Cómo tributa el rescate</h2><p>${esc(reglas(P).texto)}</p>
    <p class="cita">Norma: <a href="${LIRPF_BOE}">Ley 35/2006 del IRPF</a>, art. 17.2.a.3.º y disposición transitoria 12.ª.</p></div>
  ${cta("Calcula tu rescate", APP(terr), ["Ver todos los territorios", HUB])}
  ${bloqueFaq(qs)}
  </div>`;
  const title = `Rescate del plan de pensiones en ${nombre} ${P.ejercicio}: cuánto tributa | Mapafiscal`;
  const description = `Cuánto IRPF pagas en ${nombre} por rescatar tu plan de pensiones de una vez, como renta o mixto, con la reducción del 40 % de lo aportado antes de 2007. Calculadora gratuita.`;
  return { ruta, html: layout({ title, description, canonical: ruta, breadcrumb: migasHtml(migas), main, generado,
    jsonld: [jsonLdMigas(migas), jsonLdFaq(qs)] }) };
}

function paginaHub(P, generado) {
  const lista = terrComun(P).map(t => ({ t, v: motor.rescatePlan(Object.assign({}, BASE, { territorio: t, anioContingencia: P.ejercicio }), P) }))
    .sort((a, b) => a.v[a.v.mejor].extra - b.v[b.v.mejor].extra);
  const filas = lista.map((x, i) => `<tr><td class="num">${i + 1}</td><td><a href="${HUB}${SLUG[x.t]}/">${esc(P.territorios[x.t].nombre)}</a></td><td class="num">${esc(euros(x.v.capital.extra))}</td><td class="num">${esc(euros(x.v.mixto.extra))}</td><td class="num">${esc(euros(x.v.renta.extra))}</td><td>${esc(FORMA[x.v.mejor])}</td></tr>`).join("");
  const total = BASE.antes2007 + BASE.despues2007, mejor = lista[0], peor = lista[lista.length - 1];
  const qs = preguntas(P), migas = [["Inicio", "/"], ["Rescate del plan de pensiones", null]];
  const main = `
  <h1>Rescate del plan de pensiones ${P.ejercicio}: cuánto tributa en cada comunidad</h1>
  <p class="entradilla">El IRPF de cobrar tu plan de pensiones de una vez, como renta o de forma mixta. Con ${esc(euros(total))} (la mitad aportada hasta 2006) y una pensión de ${esc(euros(BASE.otrosIngresos))}, va de ${esc(euros(mejor.v[mejor.v.mejor].extra))} en ${esc(P.territorios[mejor.t].nombre)} a ${esc(euros(peor.v[peor.v.mejor].extra))} en ${esc(P.territorios[peor.t].nombre)}, eligiendo la mejor forma.</p>
  <div class="prosa">
  <div class="tarjeta"><h2 class="rotulo">Cómo tributa el rescate</h2><p>${esc(reglas(P).texto)}</p>
    <p class="cita">Norma: <a href="${LIRPF_BOE}">Ley 35/2006 del IRPF</a>, art. 17.2.a.3.º y disposición transitoria 12.ª.</p></div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">IRPF extra por rescatar ${esc(euros(total))}, por territorio</h2>
    <p class="ayuda">${esc(supuesto(P))} Mixto: los ${esc(euros(BASE.antes2007))} anteriores a 2007 de una vez y el resto en 5 años.</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th class="num">#</th><th>Territorio</th><th class="num">De una vez</th><th class="num">Mixto</th><th class="num">Renta</th><th>Menos IRPF</th></tr></thead><tbody>${filas}</tbody></table></div>
    <p class="ayuda">El País Vasco y Navarra tienen reglas forales propias: <a href="/irpf/bizkaia/planes-pensiones/">Bizkaia</a> · <a href="/irpf/gipuzkoa/planes-pensiones/">Gipuzkoa</a> · <a href="/irpf/araba-alava/planes-pensiones/">Araba/Álava</a> · <a href="/irpf/navarra/planes-pensiones/">Navarra</a>.</p>
  </div>
  ${cta("Calcula tu rescate", APP(), ["Ahorro por aportar antes del 31-12", "/index.html#plan-pensiones"])}
  ${bloqueFaq(qs)}
  </div>`;
  const title = `Rescate del plan de pensiones ${P.ejercicio}: cuánto tributa y cómo rescatarlo | Mapafiscal`;
  const description = "Calcula cuánto IRPF pagas por rescatar tu plan de pensiones de una vez, como renta o mixto, con la reducción del 40 % de lo aportado antes de 2007, en cada comunidad autónoma.";
  return { ruta: HUB, html: layout({ title, description, canonical: HUB, breadcrumb: migasHtml(migas), main, generado,
    jsonld: [jsonLdMigas(migas), jsonLdFaq(qs)] }) };
}

// [{ ruta, html }]: el índice y una página por territorio de régimen común
export function paginasRescate(generado) {
  const P = paramsRecientes();
  return [paginaHub(P, generado), ...terrComun(P).map(t => paginaTerritorio(P, t, generado))];
}
export const RUTA_RESCATE = HUB;
