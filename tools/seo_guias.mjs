// =============================================================================
// Guías evergreen: /guias/<slug>/ y su índice /guias/.
//
// Todas las cifras salen de web/datos/seo_guias.json y seo_territorios.json (que genera
// Rscript tools/generar_datos_seo.R desde params/): aquí solo va la redacción. Cada guía
// cita su norma con enlace a la fuente primaria (BOE o Manual práctico de la AEAT).
// =============================================================================
import {
  SLUG, ORDEN_TERRITORIOS, NOMBRE_CORTO, HERRAMIENTA, LIRPF_BOE, esc, euros, eurosExactos as eur, pct, pctCorto,
  fecha, urlBoe, tablaEscala, combinarEscalas, citaFuente, layout, jsonLdMigas, jsonLdArticulo,
  jsonLdFaq, jsonLdDataset, bloqueFaq, migasHtml, respuestaDirecta, difEuros, tituloQueQuepa
} from "./seo_comun.mjs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lirpf = art => `<a href="${LIRPF_BOE}" rel="noopener">${esc(art)} de la Ley 35/2006 del IRPF</a>`;
const RIRPF_BOE = "https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820";
// Última modificación del art. 63.1 LIRPF según el texto consolidado del BOE (nota de
// versiones del artículo): con efectos desde el 1-1-2021, por el art. 58 de la Ley 11/2020.
const ULTIMA_REFORMA_ART63 = `art. 58 de la Ley 11/2020, de 30 de diciembre, de Presupuestos Generales del Estado para 2021, <a href="${urlBoe("BOE-A-2020-17339")}" rel="noopener">BOE-A-2020-17339</a>`;
const enlaceTerritorio = c => `/irpf/${SLUG[c]}/`;
const fechaSinAnio = iso => fecha(iso).replace(/ de \d{4}$/, "");
const r2 = x => Math.round(x * 100) / 100;
// «a, b y c»
const listaY = xs => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1];

// ---- Motor JS (web/js/irpfsim.js) y parámetros que exporta tools/exportar_params.R ------
const requireM = createRequire(import.meta.url);
const WEB_G = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const MOTOR = requireM(join(WEB_G, "js", "irpfsim.js"));
const leerDatos = f => JSON.parse(readFileSync(join(WEB_G, "datos", f), "utf8"));
// Ejercicio por defecto (params.json) o uno concreto (params_<año>.json, si no es el de por defecto).
const PARAMS = ejercicio => {
  const P = leerDatos("params.json");
  return ejercicio == null || P.ejercicio === ejercicio ? P : leerDatos(`params_${ejercicio}.json`);
};
const COMPARATIVAS = () => leerDatos("seo_comparativas.json");
const neto = (P, terr, bruto, extra = {}) => MOTOR.sueldoNeto(Object.assign({ territorio: terr, bruto, edad: 40 }, extra), P);
// Cuota de una escala marginal para una base dada (la misma función que usa el motor).
const cuota = (tramos, base) => MOTOR.aplicarEscala(base, tramos);
// «hasta 12.450 € al 9,5 %, de 12.450 a 20.200 € al 12 %… y desde 300.000 € al 24,5 %»
function textoTramos(tr) {
  const partes = tr.map((t, i) => i === 0 ? `hasta ${euros(t.hasta)} al ${pctCorto(t.tipo)}`
    : t.hasta == null ? `desde ${euros(tr[i - 1].hasta)} al ${pctCorto(t.tipo)}`
    : `de ${euros(tr[i - 1].hasta)} a ${euros(t.hasta)} al ${pctCorto(t.tipo)}`);
  return listaY(partes);
}

function pagina(g, { slug, titulo, h1, description, cuerpo, faq, generado, resumen, dataset, hub }) {
  const ruta = `/guias/${slug}/`;
  const migas = [["Inicio", "/"], ["Guías del IRPF", "/guias/"], [h1, ruta]];
  const relacionadas = GUIAS.filter(x => x.slug !== slug)
    .map(x => `<li><a href="/guias/${x.slug}/">${esc(x.enlace)}</a></li>`).join("");
  const main = `
  <h1>${esc(h1)}</h1>
  ${resumen ? respuestaDirecta(resumen) : ""}
  <div class="prosa">
  ${cuerpo}
  ${faq.length ? bloqueFaq(faq) : ""}
  <div class="tarjeta"><h2 class="rotulo">Otras guías</h2><ul class="lista-enlaces">${relacionadas}</ul></div>
  <div class="tarjeta"><h2 class="rotulo">Tablas del IRPF por territorio</h2><p>${ORDEN_TERRITORIOS.map(c => `<a href="${enlaceTerritorio(c)}">${esc(NOMBRE_CORTO[c])}</a>`).join(" · ")}</p><p><a href="/irpf/">IRPF por territorio</a></p></div>
  </div>`;
  return {
    ruta, slug, hub,
    html: layout({
      title: titulo, description, canonical: ruta, breadcrumb: migasHtml(migas), main, generado, css: ["/css/guias.css"],
      jsonld: [jsonLdMigas(migas), jsonLdArticulo({ titulo: h1, descripcion: description, ruta, generado }), ...(faq.length ? [jsonLdFaq(faq)] : []),
        ...(dataset ? [jsonLdDataset(Object.assign({ ruta, generado }, dataset))] : [])]
    })
  };
}

const cta = (txt, href, sec) => `<p><a class="btn btn-pri" href="${href}">${esc(txt)}</a>${sec ? ` <a class="btn btn-sec" href="${sec[1]}">${esc(sec[0])}</a>` : ""}</p>`;

// ---- 1. Tramos ----------------------------------------------------------------------
const BASES_TRAMOS = [15000, 20000, 30000, 45000, 60000, 100000];
const T_EJ = ["ES-MD", "ES-CT"];
function guiaTramos(g, T) {
  const e = g.escalas;
  const igual26 = iguales(e.estatal_2025.tramos, e.estatal_2026.tramos);
  const ahorro25 = combinarEscalas(e.ahorro_estatal_2025.tramos, e.ahorro_autonomica_2025.tramos);
  const ahorro26 = combinarEscalas(e.ahorro_estatal_2026.tramos, e.ahorro_autonomica_2026.tramos);
  const ej = 30000;
  const filas = ORDEN_TERRITORIOS.map(c => {
    const tr = T.territorios[c].escala_combinada.tramos, ult = tr[tr.length - 1];
    return { c, nombre: T.territorios[c].nombre, min: tr[0].tipo, max: ult.tipo, desde: tr[tr.length - 2]?.hasta, n: tr.length, cuota: cuota(tr, ej) };
  });
  const comunes = filas.filter(f => T.territorios[f.c].regimen === "comun");
  const maxT = comunes.reduce((a, b) => b.max > a.max ? b : a), minT = comunes.reduce((a, b) => b.max < a.max ? b : a);
  const cuotaEj = cuota(e.estatal_2025.tramos, ej);
  const pv26 = !iguales(e.pais_vasco_2025.tramos, e.pais_vasco_2026.tramos);
  const nv26 = iguales(e.navarra_2025.tramos, e.navarra_2026.tramos);
  const est = e.estatal_2025.tramos, aho = ahorro25;
  const ejAhorro = 10000, cuotaAhorro = cuota(ahorro25, ejAhorro);
  const anios = igual26 ? "2025 y 2026" : "2025";
  // Tramo estatal en el que cae la base de ejemplo y su límite inferior.
  const iEj = est.findIndex(t => t.hasta == null || ej <= t.hasta), desdeEj = iEj ? est[iEj - 1].hasta : 0;
  // Escalas autonómicas de los dos territorios de ejemplo, del mismo ejercicio que seo_territorios.json.
  const P = PARAMS(T.ejercicio);
  const ejemplosT = T_EJ.map(c => ({ c, nombre: T.territorios[c].nombre, corto: NOMBRE_CORTO[c], aut: P.territorios[c].escala_general_autonomica, comb: T.territorios[c].escala_combinada.tramos }));
  // Reparto estatal/autonómico con la misma base de ejemplo en dos comunidades.
  const reparto = ejemplosT.map(x => {
    const total = cuota(x.comb, ej);
    return { nombre: x.nombre, total, auto: total - cuotaEj };
  });
  // Cuánto se paga en cada tramo de la escala estatal.
  let acum = 0;
  const porTramo = est.map((t, i) => {
    const desde = i ? est[i - 1].hasta : 0;
    const completo = t.hasta == null ? null : (t.hasta - desde) * t.tipo;
    if (completo != null) acum += completo;
    return [i === 0 ? `Hasta ${esc(euros(t.hasta))}` : t.hasta == null ? `Desde ${esc(euros(desde))}` : `De ${esc(euros(desde))} a ${esc(euros(t.hasta))}`,
      esc(pctCorto(t.tipo)), completo == null ? `${esc(pctCorto(t.tipo))} de lo que pase de ${esc(euros(desde))}` : esc(eur(r2(completo))), completo == null ? "—" : esc(eur(r2(acum)))];
  });
  const ejBases = BASES_TRAMOS.map(b => {
    const e0 = cuota(est, b);
    return [esc(euros(b)), esc(pctCorto(MOTOR.tipoMarginal(b, est))), esc(eur(r2(e0))),
      ...ejemplosT.flatMap(x => { const tot = cuota(x.comb, b); return [esc(eur(r2(tot))), esc(pct(tot / b))]; })];
  });

  const cuerpo = `
  <p class="entradilla">El IRPF se calcula aplicando a la base liquidable una escala por tramos (los «escalones» del impuesto): cada tramo de renta paga su propio tipo y solo el exceso sobre el tramo anterior tributa al tipo siguiente. En el régimen común la escala tiene dos mitades, la del Estado y la de tu comunidad autónoma; el País Vasco y Navarra aplican su propia tarifa foral completa.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Escala estatal del IRPF ${anios}</h2>
    ${tablaEscala(e.estatal_2025.tramos)}
    ${igual26 ? `<p>En 2026 la escala estatal no cambia: los tramos y los tipos son los mismos que en 2025.</p>` : `<h3>Escala estatal 2026</h3>${tablaEscala(e.estatal_2026.tramos)}`}
    ${igual26 ? `<p><b>¿Y la escala del IRPF de 2024?</b> La escala estatal general es la misma: el ${lirpf("art. 63.1.1.º")} se modificó por última vez con efectos desde el 1 de enero de 2021 (${ULTIMA_REFORMA_ART63}). Los tramos estatales de 2024, 2025 y 2026 coinciden; lo que puede cambiar de un año a otro es la parte autonómica de cada comunidad. Más detalle en la <a href="/guias/escala-irpf-2024/">escala del IRPF 2024</a>.</p>` : ""}
    ${citaFuente(e.estatal_2025)}
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Cuánto se paga en cada tramo de la escala estatal</h2>
    <p class="ayuda">Parte estatal de la cuota que corresponde a cada tramo cuando se llena entero, y lo que suma la cuota estatal al llegar al final del tramo. Antes de restar el mínimo personal y familiar y las deducciones.</p>
    ${tablaG(["Tramo de la base liquidable", "Tipo estatal", "Cuota del tramo completo", "Cuota estatal acumulada"], porTramo)}
    <p>Ejemplo: con una base liquidable general de ${euros(ej)}, la parte estatal de la cuota es de ${eur(r2(cuotaEj))} antes de restar el mínimo personal y las deducciones: los primeros ${euros(est[0].hasta)} al ${pctCorto(est[0].tipo)} y solo lo que pasa de ${euros(desdeEj)} al ${pctCorto(est[iEj].tipo)}. A esa cifra se le suma la parte autonómica, que depende de dónde vivas.</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Ejemplos: cuánto IRPF sale con cada base liquidable (${T.ejercicio})</h2>
    <p class="ayuda">Cuota íntegra con la escala general, antes de restar el mínimo personal y familiar y las deducciones. Total = parte estatal + parte autonómica de cada comunidad. Tipo medio: cuota entre la base liquidable.</p>
    ${tablaG(["Base liquidable", "Tipo marginal estatal", "Parte estatal", ...ejemplosT.flatMap(x => [`Total ${x.corto}`, `Tipo medio ${x.corto}`])], ejBases)}
    <p>La base liquidable no es el sueldo bruto: antes se restan las cotizaciones, la reducción por rendimientos del trabajo y otras reducciones. Para tu sueldo, usa la <a href="${HERRAMIENTA.calculadora}">calculadora</a>.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">IRPF estatal y autonómico: diferencias</h2>
    <p>En las 15 comunidades de régimen común la cuota del IRPF tiene dos partes que se calculan por separado sobre la misma base liquidable y se suman:</p>
    <ul>
      <li><b>Parte estatal:</b> la escala del ${lirpf("art. 63")}, igual en toda España salvo en el País Vasco y Navarra.</li>
      <li><b>Parte autonómica:</b> la escala que aprueba cada comunidad (${lirpf("art. 74")}), con sus propios tramos y tipos. Por eso el tipo máximo total va del ${pctCorto(minT.max)} de ${esc(minT.nombre)} al ${pctCorto(maxT.max)} de ${esc(maxT.nombre)}.</li>
      <li>El mínimo personal y familiar se resta en las dos partes, y las comunidades pueden fijar su propio importe para la autonómica.</li>
      <li>Las deducciones autonómicas solo rebajan la parte autonómica de la cuota; las estatales, la estatal.</li>
      <li>En la base del ahorro, la parte estatal (${lirpf("art. 66")}) y la autonómica (${lirpf("art. 76")}) son iguales.</li>
    </ul>
    <p>Así son las escalas autonómicas de dos comunidades en ${T.ejercicio}; cada una se suma a la estatal:</p>
    <div class="dos-col">${ejemplosT.map(x => `<div><h3>Escala autonómica: ${esc(x.nombre)}</h3>${tablaEscala(x.aut)}<p class="ayuda">Escala completa (estatal + autonómica): <a href="${enlaceTerritorio(x.c)}">tramos del IRPF en ${esc(x.corto)}</a>.</p></div>`).join("")}</div>
    <p>Ejemplo con una base liquidable general de ${euros(ej)}, antes del mínimo y de las deducciones: la parte estatal es de ${eur(r2(cuotaEj))} en todas las comunidades; la autonómica, de ${reparto.map(x => `${eur(r2(x.auto))} en ${esc(x.nombre)} (total ${eur(r2(x.total))})`).join(" y de ")}.</p>
    <p>El País Vasco y Navarra no tienen parte estatal: aplican una sola tarifa foral completa.</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Tablas del IRPF de los ${ORDEN_TERRITORIOS.length} territorios (${T.ejercicio})</h2>
    <p class="ayuda">Escala general combinada de cada territorio (estatal + autonómica, o la tarifa foral): el tipo del primer tramo, el tipo máximo, a partir de qué base se aplica y la cuota íntegra con ${euros(ej)} de base liquidable, antes del mínimo y de las deducciones. Cada territorio enlaza su tabla completa.</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Territorio</th><th class="num">Primer tramo</th><th class="num">Tipo máximo</th><th class="num">Desde</th><th class="num">Tramos</th><th class="num">Cuota con ${esc(euros(ej))}</th></tr></thead><tbody>
    ${filas.map(f => `<tr><td><a href="${enlaceTerritorio(f.c)}">${esc(f.nombre)}</a></td><td class="num">${pct(f.min)}</td><td class="num">${pct(f.max)}</td><td class="num">${f.desde ? euros(f.desde) : "—"}</td><td class="num">${f.n}</td><td class="num">${eur(r2(f.cuota))}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="ayuda">En el País Vasco y Navarra las circunstancias personales y familiares no reducen la base: se descuentan después, como deducciones de la cuota.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Tramos de las ganancias patrimoniales: escala del ahorro ${iguales(ahorro25, ahorro26) ? "2025 y 2026" : "2025"}</h2>
    <p>Los intereses, los dividendos y las ganancias patrimoniales por vender acciones, fondos o un inmueble tributan aparte, en la base del ahorro, con una escala igual en todas las comunidades de régimen común. Ya sumadas las partes estatal y autonómica:</p>
    ${tablaEscala(ahorro25, "Tramo de la base liquidable del ahorro")}
    ${iguales(ahorro25, ahorro26) ? "<p>En 2026 no cambia.</p>" : `<h3>2026</h3>${tablaEscala(ahorro26, "Tramo de la base liquidable del ahorro")}`}
    <p>Ejemplo: una ganancia patrimonial de ${euros(ejAhorro)} paga ${eur(r2(cuotaAhorro))} (los primeros ${euros(aho[0].hasta)} al ${pctCorto(aho[0].tipo)} y el resto al ${pctCorto(aho[1].tipo)}), sin sumarse al sueldo ni subir su tipo.</p>
    ${citaFuente(e.ahorro_estatal_2025)}${citaFuente(e.ahorro_autonomica_2025)}
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">País Vasco: tarifa foral ${pv26 ? "2025 y 2026" : "2025"}</h2>
    <p>Bizkaia, Gipuzkoa y Araba/Álava tienen una tarifa armonizada.${pv26 ? " Para 2026 sus normas forales actualizan los tramos:" : ""}</p>
    <div class="dos-col"><div><h3>2025</h3>${tablaEscala(e.pais_vasco_2025.tramos)}${citaFuente(e.pais_vasco_2025)}</div>
    ${pv26 ? `<div><h3>2026</h3>${tablaEscala(e.pais_vasco_2026.tramos)}${citaFuente(e.pais_vasco_2026)}</div>` : ""}</div>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Navarra: tarifa foral ${nv26 ? "2025 y 2026" : "2025"}</h2>
    ${tablaEscala(e.navarra_2025.tramos)}
    ${nv26 ? "<p>En 2026 Navarra mantiene la misma tarifa.</p>" : `<h3>2026</h3>${tablaEscala(e.navarra_2026.tramos)}`}
    ${citaFuente(e.navarra_2025)}
  </div>
  ${cta("Calcula tu IRPF con tu sueldo", HERRAMIENTA.calculadora, ["Calcula tu sueldo neto", HERRAMIENTA.sueldoNeto])}`;

  const faq = [
    ["¿Cuáles son los tramos del IRPF en 2025?", `En la escala estatal, ${est.length}: ${textoTramos(est)}.${igual26 ? " En 2026 son los mismos." : ""} A cada tramo se suma el tipo de la escala autonómica de tu comunidad.`],
    ["¿Cuál es la escala general del IRPF 2025?", `Es la que se aplica a la base liquidable general (sueldo, pensiones, alquileres, actividades). Su mitad estatal va del ${pctCorto(est[0].tipo)} al ${pctCorto(est[est.length - 1].tipo)}; sumada a la autonómica, el tipo máximo va del ${pct(minT.max)} de ${minT.nombre} al ${pct(maxT.max)} de ${maxT.nombre}.`],
    ["¿Qué diferencia hay entre el IRPF estatal y el autonómico?", `En régimen común la cuota se calcula dos veces sobre la misma base, con la escala estatal y con la de tu comunidad, y se suman. Con ${euros(ej)} de base liquidable, la parte estatal es de ${eur(r2(cuotaEj))} en toda España y la autonómica, de ${reparto.map(x => `${eur(r2(x.auto))} en ${x.nombre}`).join(" y de ")}, antes del mínimo y de las deducciones.`],
    ["¿Dónde están las tablas del IRPF de mi comunidad?", `En esta página tienes la tabla de los ${ORDEN_TERRITORIOS.length} territorios, y cada uno enlaza su escala completa (estatal + autonómica, o la tarifa foral) en la sección de IRPF por territorio.`],
    ["¿Cuántas escalas tiene el IRPF?", "Dos: la escala general, para la base liquidable general, y la del ahorro, para intereses, dividendos y ganancias patrimoniales. En régimen común cada una tiene una parte estatal y otra autonómica; el País Vasco y Navarra aplican tarifas forales propias."],
    ["¿Qué son los escalones del IRPF? ¿Se aplican a todo el sueldo?", `Son los tramos de la escala, y no se aplican a todo: cada tipo grava solo la parte de la base que cae dentro de su tramo. Con ${euros(ej)} de base, los primeros ${euros(est[0].hasta)} pagan el ${pctCorto(est[0].tipo)} estatal y solo lo que pasa de ${euros(desdeEj)} paga el ${pctCorto(est[iEj].tipo)}. Pasar a un tramo superior no encarece lo que ya tributaba en los anteriores.`],
    ["¿Cuál es el tipo máximo del IRPF en 2025?", `Depende del territorio. En el régimen común, sumando Estado y comunidad, el más alto es el de ${maxT.nombre} (${pct(maxT.max)}) y el más bajo, el de ${minT.nombre} (${pct(minT.max)}).`],
    ["¿Cambian los tramos del IRPF en 2026?", `${igual26 ? "La escala estatal es la misma en 2026." : "La escala estatal cambia en 2026."}${pv26 ? " En el País Vasco las normas forales de 2026 actualizan los tramos." : ""}${nv26 ? " Navarra mantiene su tarifa." : ""} Cada comunidad de régimen común puede modificar su parte autonómica en sus propias leyes.`],
    ["¿Qué es la base liquidable?", "Es lo que queda de tus ingresos después de restar los gastos deducibles (como la Seguridad Social), la reducción por rendimientos del trabajo y otras reducciones, como las aportaciones a planes de pensiones."],
    ...(igual26 ? [["¿Cuál era la escala estatal del IRPF en 2024?", `La misma que en 2025 y 2026: ${est.length} tramos, del ${pctCorto(est[0].tipo)} al ${pctCorto(est[est.length - 1].tipo)}. El art. 63.1.1.º de la Ley del IRPF no ha cambiado desde el 1 de enero de 2021 (art. 58 de la Ley 11/2020, BOE-A-2020-17339).`]] : []),
    ["¿Cómo tributan las ganancias patrimoniales en 2025?", `En la base del ahorro, con tramos del ${pctCorto(aho[0].tipo)} al ${pctCorto(aho[aho.length - 1].tipo)} (partes estatal y autonómica sumadas): ${aho.map((t, i) => i === 0 ? `${pctCorto(t.tipo)} hasta ${euros(t.hasta)}` : t.hasta == null ? `${pctCorto(t.tipo)} desde ${euros(aho[i - 1].hasta)}` : `${pctCorto(t.tipo)} hasta ${euros(t.hasta)}`).join(", ")}.`]
  ];
  return pagina(g, { slug: "tramos-irpf-2025-2026", h1: `Tramos del IRPF ${anios}: escala estatal y autonómica`,
    titulo: tituloQueQuepa(`Tramos IRPF ${anios}: tablas, escala estatal y autonómica`, `Tramos IRPF ${anios}: escala estatal y autonómica`),
    description: `Tramos del IRPF ${anios}: escala estatal del ${pctCorto(est[0].tipo)} al ${pctCorto(est[est.length - 1].tipo)}, cuánto se paga en cada tramo, escalas autonómicas y tablas de los ${ORDEN_TERRITORIOS.length} territorios.`,
    resumen: `la escala estatal del IRPF ${igual26 ? "2025 y 2026 (la misma que en 2024)" : "2025"} tiene ${est.length} tramos: <b>${esc(textoTramos(est))}</b>. A cada tramo se suma el de la escala autonómica: con ${euros(ej)} de base liquidable pagas ${eur(r2(cuotaEj))} de parte estatal y ${eur(r2(reparto[0].total))} en total en ${esc(NOMBRE_CORTO[T_EJ[0]])}, antes del mínimo. El tipo máximo va del ${pctCorto(minT.max)} de ${esc(NOMBRE_CORTO[minT.c])} al ${pctCorto(maxT.max)} de ${esc(NOMBRE_CORTO[maxT.c])}.`,
    hub: `La escala estatal tiene ${est.length} tramos, del ${pctCorto(est[0].tipo)} al ${pctCorto(est[est.length - 1].tipo)}; con la autonómica, el tipo máximo va del ${pctCorto(minT.max)} de ${NOMBRE_CORTO[minT.c]} al ${pctCorto(maxT.max)} de ${NOMBRE_CORTO[maxT.c]}. Con ${euros(ej)} de base, ${eur(r2(cuotaEj))} de parte estatal. Tablas de los ${ORDEN_TERRITORIOS.length} territorios.`,
    dataset: { nombre: "Escalas del IRPF 2025 y 2026: estatal, del ahorro, autonómicas y forales", descripcion: "Tramos y tipos marginales de la escala estatal general, la escala del ahorro y las escalas combinadas de los 19 territorios fiscales de España.",
      fuentes: [e.estatal_2025.norma, e.estatal_2025.fuente, e.ahorro_estatal_2025.norma, e.ahorro_estatal_2025.fuente, e.pais_vasco_2026.norma, e.pais_vasco_2026.fuente, e.navarra_2025.norma, "Ley 11/2020, art. 58 (BOE-A-2020-17339)"] },
    cuerpo, faq, generado: g.generado });
}

// ---- 1 bis. Escala 2024 -------------------------------------------------------------
// Solo la escala estatal general: el art. 63.1.1.º no cambia desde 2021. La del ahorro no
// se publica para 2024 porque los params la citan con el 5.º tramo «vigente desde 2025».
function guiaEscala2024(g) {
  const e = g.escalas, est = e.estatal_2025.tramos;
  const ahorroIgual2024 = !/desde 2025/.test(e.ahorro_estatal_2025.norma || "");
  const ult = est[est.length - 1];
  const cuerpo = `
  <p class="entradilla">La escala estatal general del IRPF de 2024 es la misma que la de 2025 y 2026. El ${lirpf("art. 63.1.1.º")} se modificó por última vez con efectos desde el 1 de enero de 2021 (${ULTIMA_REFORMA_ART63}), así que los tramos y los tipos estatales no han cambiado desde entonces.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Escala estatal general del IRPF 2024</h2>
    ${tablaEscala(est)}
    <p>Es la mitad estatal de la escala: en las comunidades de régimen común se suma a la escala autonómica de cada comunidad. El País Vasco y Navarra no la aplican, porque tienen su propia tarifa foral completa.</p>
    ${citaFuente(e.estatal_2025)}
    <p>Texto consolidado de la norma: <a href="${LIRPF_BOE}" rel="noopener">Ley 35/2006 del IRPF en el BOE</a>.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">La parte autonómica de 2024 depende de cada comunidad</h2>
    <p>La cuota total del IRPF de 2024 no sale solo de esta tabla: cada comunidad autónoma aprueba su propia escala para la parte autonómica (${lirpf("art. 74")}) y puede cambiarla de un año a otro. Por eso el tipo marginal total de 2024 no es el mismo en todas las comunidades.</p>
    <p>Mapafiscal calcula los ejercicios <b>2025 y 2026</b>; no reproduce las escalas autonómicas de 2024. Para la escala completa de tu territorio en 2025, con la parte autonómica, consulta su página:</p>
    <p>${ORDEN_TERRITORIOS.map(c => `<a href="${enlaceTerritorio(c)}">${esc(NOMBRE_CORTO[c])}</a>`).join(" · ")}</p>
    <p>Y en la guía de <a href="/guias/tramos-irpf-2025-2026/">tramos del IRPF 2025 y 2026</a> tienes la escala estatal, la del ahorro y la tabla de los 19 territorios.</p>
  </div>
  ${ahorroIgual2024 ? "" : `<div class="tarjeta"><h2 class="rotulo">¿Y la escala del ahorro de 2024?</h2><p>No la incluimos aquí: la escala del ahorro estatal (${lirpf("art. 66.1")}) que usa Mapafiscal es la redacción con un quinto tramo vigente desde 2025, así que no coincide necesariamente con la de 2024. La de 2025 y 2026 está en la <a href="/guias/tramos-irpf-2025-2026/">guía de tramos</a>.</p></div>`}
  ${cta("Calcula tu IRPF de 2025", HERRAMIENTA.calculadora, ["Tramos 2025 y 2026", "/guias/tramos-irpf-2025-2026/"])}`;
  const faq = [
    ["¿Cuál es la escala estatal del IRPF de 2024?", `Tiene ${est.length} tramos, del ${pctCorto(est[0].tipo)} al ${pctCorto(ult.tipo)}, y es la misma que en 2025 y 2026: el art. 63.1.1.º de la Ley del IRPF no ha cambiado desde el 1 de enero de 2021 (art. 58 de la Ley 11/2020, BOE-A-2020-17339).`],
    ["¿Cambió la escala estatal del IRPF entre 2024 y 2025?", "No. Los tramos y los tipos estatales de la base liquidable general son los mismos en 2024, 2025 y 2026."],
    ["¿Cuánto es el tipo máximo del IRPF en 2024?", `La parte estatal llega al ${pctCorto(ult.tipo)}. El tipo máximo total depende de la escala autonómica de cada comunidad, que Mapafiscal no reproduce para 2024.`],
    ["¿Mapafiscal calcula la renta de 2024?", "No. Mapafiscal calcula los ejercicios 2025 y 2026. Las escalas autonómicas de 2024 dependen de las leyes de cada comunidad para ese año."]
  ];
  return pagina(g, { slug: "escala-irpf-2024", h1: "Escala del IRPF 2024: tramos y tipos estatales",
    titulo: "Escala IRPF 2024: tramos y tipos estatales",
    hub: `La escala estatal de 2024 tiene ${est.length} tramos, del ${pctCorto(est[0].tipo)} al ${pctCorto(ult.tipo)}: la misma que en 2025 y 2026, sin cambios desde 2021.`,
    description: `Escala estatal del IRPF 2024: ${est.length} tramos del ${pctCorto(est[0].tipo)} al ${pctCorto(ult.tipo)}, igual que en 2025 y 2026 (art. 63.1.1.º LIRPF, sin cambios desde 2021). La parte autonómica depende de cada comunidad.`,
    resumen: `la escala estatal del IRPF de 2024 tiene ${est.length} tramos, del <b>${pctCorto(est[0].tipo)}</b> al <b>${pctCorto(ult.tipo)}</b>, y es la misma que en 2025 y 2026. La parte autonómica depende de cada comunidad.`,
    cuerpo, faq, generado: g.generado });
}

// ---- 2. Mínimo personal y familiar ---------------------------------------------------
function guiaMinimo(g) {
  const m = g.minimos, c = m.contribuyente, d = m.descendientes, a = m.ascendientes, di = m.discapacidad;
  const tipo1 = g.escalas.estatal_2025.tramos[0];
  const ahorro = c.general * tipo1.tipo;
  const igual26 = iguales(c, m.contribuyente_2026) && iguales(d, m.descendientes_2026);
  const v = (x, k, est) => x && x[k] != null ? eur(x[k]) : `<span class="ayuda">${eur(est)}</span>`;
  // Mínimo total por situación familiar y lo que rebaja de la cuota estatal (aplicarEscala del motor).
  const estEsc = g.escalas.estatal_2025.tramos;
  const familias = [["Sin hijos", 0], ["Con 1 hijo", d.importes["1"]], ["Con 2 hijos", d.importes["1"] + d.importes["2"]], ["Con 3 hijos", d.importes["1"] + d.importes["2"] + d.importes["3"]],
    ["Con 1 hijo menor de 3 años", d.importes["1"] + d.incremento_menor_3_anios]].map(([t, h]) => ({ t, min: c.general + h, rebaja: r2(cuota(estEsc, c.general + h)) }));
  const filasAuto = m.autonomicos.map(t => `<tr><td><a href="${enlaceTerritorio(t.territorio)}">${esc(t.nombre)}</a></td><td class="num">${v(t.contribuyente, "general", c.general)}</td><td class="num">${v(t.descendientes?.importes, "1", d.importes["1"])}</td><td class="num">${v(t.descendientes?.importes, "3", d.importes["3"])}</td><td class="num">${v(t.descendientes, "incremento_menor_3_anios", d.incremento_menor_3_anios)}</td><td class="num">${v(t.discapacidad, "grado_33_64", di.grado_33_64)}</td></tr>`).join("");
  const cuerpo = `
  <p class="entradilla">El mínimo personal y familiar es la parte de la renta que la ley considera necesaria para vivir y que, por eso, no paga IRPF. No reduce tus ingresos: se calcula la cuota de ese importe con la escala y se resta de la cuota de tu base.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Mínimo del contribuyente</h2>
    <ul>
      <li><b>${eur(c.general)}</b> con carácter general.</li>
      <li>${eur(c.incremento_mayor_65)} más si tienes más de 65 años.</li>
      <li>${eur(c.incremento_mayor_75)} más, adicionales, si tienes más de 75.</li>
    </ul>
    ${citaFuente(c)}
    <p>¿Cuánto supone en dinero? En la escala estatal, los primeros ${euros(tipo1.hasta)} tributan al ${pct(tipo1.tipo)}: los ${eur(c.general)} del mínimo general equivalen a ${eur(Math.round(ahorro * 100) / 100)} menos de cuota estatal, más lo que suponga en la escala de tu comunidad.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Mínimo por descendientes</h2>
    <p>Por cada hijo menor de ${d.edad_maxima} años (o con discapacidad, a cualquier edad) que conviva contigo y no tenga rentas anuales superiores a ${eur(d.limite_rentas_descendiente)}:</p>
    <table class="cobertura"><thead><tr><th>Hijo</th><th class="num">Importe</th></tr></thead><tbody>
      <tr><td>Primero</td><td class="num">${eur(d.importes["1"])}</td></tr><tr><td>Segundo</td><td class="num">${eur(d.importes["2"])}</td></tr>
      <tr><td>Tercero</td><td class="num">${eur(d.importes["3"])}</td></tr><tr><td>Cuarto y siguientes</td><td class="num">${eur(d.importes["4+"])}</td></tr>
    </tbody></table>
    <p>Por cada hijo menor de 3 años se suman ${eur(d.incremento_menor_3_anios)}. El hijo no puede presentar su propia declaración con rentas superiores a ${eur(d.limite_declaracion_descendiente)}. Si los dos progenitores tienen derecho, se reparte a partes iguales.</p>
    ${citaFuente(d)}
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Cuánto rebaja el mínimo personal y familiar (2025)</h2>
    <p class="ayuda">Contribuyente menor de 65 años que aplica entero el mínimo por sus hijos (si lo comparten dos progenitores, cada uno aplica la mitad). Rebaja de la cuota estatal: la escala estatal aplicada al mínimo, siempre que tu base liquidable sea al menos igual. A eso se suma lo que rebaje en la parte autonómica, con la escala y los mínimos de tu comunidad.</p>
    ${tablaG(["Situación", "Mínimo personal y familiar", "Rebaja de la cuota estatal"], familias.map(f => [esc(f.t), esc(eur(f.min)), esc(eur(f.rebaja))]))}
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Mínimo por ascendientes y por discapacidad</h2>
    <ul>
      <li>Por cada ascendiente mayor de ${a.edad_minima} años (o con discapacidad) que conviva contigo y no tenga rentas superiores a ${eur(a.limite_rentas_ascendiente)}: ${eur(a.importe)}, y ${eur(a.incremento_mayor_75)} más si tiene más de 75.</li>
      <li>Por discapacidad del contribuyente: ${eur(di.grado_33_64)} con un grado de entre el 33 % y el 64 %, y ${eur(di.grado_65_mas)} desde el 65 %. Se suman ${eur(di.gastos_asistencia)} por gastos de asistencia si se acredita necesitar ayuda de terceros o movilidad reducida, o con un grado igual o superior al 65 %.</li>
    </ul>
    ${citaFuente(a)}${citaFuente(di)}
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Comunidades con mínimos propios (2025)</h2>
    <p class="ayuda">Para calcular la parte autonómica de la cuota, estas comunidades fijan sus propios importes. En gris, los que coinciden con los estatales.</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Comunidad</th><th class="num">Contribuyente</th><th class="num">1.er hijo</th><th class="num">3.er hijo</th><th class="num">Hijo &lt; 3 años</th><th class="num">Discapacidad 33-64 %</th></tr></thead><tbody>${filasAuto}</tbody></table></div>
    <p class="ayuda">Normas: ${esc(m.autonomicos.map(t => `${t.nombre}: ${t.norma}`).join(". "))}.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">País Vasco y Navarra</h2>
    <p>En los territorios forales las circunstancias familiares no reducen la base: se aplican como deducciones de la cuota. Puedes verlas en las páginas de <a href="/irpf/gipuzkoa/deducciones/">Gipuzkoa</a>, <a href="/irpf/bizkaia/deducciones/">Bizkaia</a> y <a href="/irpf/navarra/deducciones/">Navarra</a>.</p>
  </div>
  ${igual26 ? "<p>En 2026 los importes estatales del mínimo personal y familiar no cambian.</p>" : ""}
  ${cta("Calcula tu IRPF con tu familia", HERRAMIENTA.calculadora)}`;
  const faq = [
    ["¿Qué es el mínimo personal y familiar?", `La parte de la renta que no paga IRPF porque se destina a cubrir las necesidades básicas del contribuyente y su familia (arts. 56 a 61 de la Ley del IRPF). Se calcula la cuota de ese importe con la escala y se resta: los ${eur(c.general)} del mínimo general rebajan ${eur(r2(cuota(estEsc, c.general)))} la cuota estatal.`],
    ["¿Cuáles son los mínimos personales y familiares en 2025?", `Del contribuyente, ${eur(c.general)} (más ${eur(c.incremento_mayor_65)} desde los 65 años y ${eur(c.incremento_mayor_75)} más desde los 75). Por descendientes, ${eur(d.importes["1"])} el primero, ${eur(d.importes["2"])} el segundo, ${eur(d.importes["3"])} el tercero y ${eur(d.importes["4+"])} el cuarto y siguientes, más ${eur(d.incremento_menor_3_anios)} por cada menor de 3 años. Por ascendientes, ${eur(a.importe)}. Por discapacidad, desde ${eur(di.grado_33_64)}.`],
    ["¿Cuánto es el mínimo personal en 2025?", `${eur(c.general)} con carácter general; ${eur(c.general + c.incremento_mayor_65)} desde los 65 años y ${eur(c.general + c.incremento_mayor_65 + c.incremento_mayor_75)} desde los 75, salvo en las comunidades con importes propios.`],
    ["¿El mínimo personal se resta del sueldo?", "No exactamente. Se calcula el impuesto que corresponde al importe del mínimo con la escala y se resta de la cuota. En la práctica, esa parte de la renta tributa al 0 %."],
    ["¿Quién aplica el mínimo por hijos si los padres declaran por separado?", "Se reparte a partes iguales entre los progenitores que convivan con el hijo y tengan derecho a aplicarlo."]
  ];
  return pagina(g, { slug: "minimo-personal-familiar", h1: "Mínimo personal y familiar del IRPF (2025)",
    titulo: tituloQueQuepa(`Mínimo personal y familiar ${igual26 ? "2025 y 2026" : "2025"}: ${euros(c.general)} y por hijo`, `Mínimo personal y familiar 2025: ${euros(c.general)} e importes por hijo`),
    hub: `${eur(c.general)} por contribuyente (${eur(c.general + c.incremento_mayor_65)} desde los 65) y ${eur(d.importes["1"])}, ${eur(d.importes["2"])} y ${eur(d.importes["3"])} por el primer, segundo y tercer hijo. Los ${eur(c.general)} rebajan ${eur(r2(cuota(estEsc, c.general)))} la cuota estatal.`,
    resumen: `el mínimo personal del IRPF de 2025 es de <b>${eur(c.general)}</b> (${eur(c.general + c.incremento_mayor_65)} desde los 65 años) y se suman ${eur(d.importes["1"])} por el primer hijo, ${eur(d.importes["2"])} por el segundo y ${eur(d.importes["3"])} por el tercero, tanto en el gravamen estatal como en el autonómico, salvo en las comunidades con importes propios.`,
    dataset: { nombre: "Mínimo personal y familiar del IRPF 2025", descripcion: "Importes del mínimo del contribuyente, por descendientes, ascendientes y discapacidad (estatal y autonómicos).", fuentes: [c.norma, c.fuente, d.norma, a.norma, di.norma] },
    description: `Mínimo personal y familiar del IRPF 2025 (gravamen estatal y autonómico): ${euros(c.general)} por contribuyente, ${euros(d.importes["1"])} por el primer hijo, mayores y discapacidad.`,
    cuerpo, faq, generado: g.generado });
}

// ---- 3. Plan de pensiones -------------------------------------------------------------
// Ahorro por sueldo con el motor JS, en el ejercicio por defecto de la web (params.json).
const SUELDOS_PP = [20000, 30000, 45000, 60000];
const T_PP = "ES-MD";
function guiaPensiones(g) {
  const p = g.prevision_social, r = p.reduccion;
  const total = r.limite_general_abs + r.incremento_contribucion_empresarial;
  const igual26 = iguales(r, p.reduccion_2026);
  const sal = Object.keys(p.ahorro);
  // Solo los territorios donde el motor aplica la reducción (con ahorro en algún sueldo).
  const conAhorro = ORDEN_TERRITORIOS.filter(c => sal.some(s => p.ahorro[s].find(x => x.territorio === c).ahorro > 0));
  const filas = conAhorro.map(c => `<tr><td><a href="${enlaceTerritorio(c)}">${esc(p.ahorro[sal[0]].find(x => x.territorio === c).nombre)}</a></td>${sal.map(s => `<td class="num">${eur(p.ahorro[s].find(x => x.territorio === c).ahorro)}</td>`).join("")}</tr>`).join("");
  const P = PARAMS(), A = p.aportacion_ejemplo, nom = NOMBRE_CORTO[T_PP], ps = P.estatal.reduccion_prevision_social;
  const porSueldo = SUELDOS_PP.map(b => {
    const sin = neto(P, T_PP, b), con = neto(P, T_PP, b, { aportacionPlan: A });
    const bl = sin.liquidacion.baseLiquidableGeneral;
    const marginal = MOTOR.tipoMarginal(bl, P.estatal.escala_general_estatal) + MOTOR.tipoMarginal(bl, P.territorios[T_PP].escala_general_autonomica);
    return { b, sin: sin.irpf, con: con.irpf, ahorro: r2(sin.irpf - con.irpf), marginal };
  });
  const x30 = porSueldo.find(x => x.b === 30000);
  const cuerpo = `
  <p class="entradilla">Lo que aportas a un plan de pensiones se resta de tu base imponible general. Por eso desgrava a tu tipo marginal: cuanto más ganas, más impuesto te ahorras por cada euro aportado. Y cuenta en el año en que lo aportas: para que reduzca el IRPF de este año, la aportación tiene que estar hecha antes del 31 de diciembre.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Límite de aportación con derecho a reducción</h2>
    <ul>
      <li>Aportaciones propias: hasta <b>${eur(r.limite_general_abs)}</b> al año, sin pasar del ${pctCorto(r.limite_general_pct_rend)} de tus rendimientos netos del trabajo y de actividades económicas.</li>
      <li>Ese límite sube hasta ${eur(r.incremento_contribucion_empresarial)} más con las contribuciones de tu empresa a un plan de empleo: en total, hasta ${eur(total)}.</li>
      <li>Al plan de tu cónyuge, hasta ${eur(r.limite_aportacion_conyuge)} al año si sus rendimientos netos del trabajo y de actividades son inferiores a ${eur(r.rentas_conyuge_maximas)}.</li>
    </ul>
    ${citaFuente(r)}
    <p>Lo que no puedas reducir por superar el límite del ${pctCorto(r.limite_general_pct_rend)} o por no tener base suficiente se puede aplicar en los cinco ejercicios siguientes (${lirpf("art. 52.2")}).${igual26 ? " En 2026 los límites son los mismos." : ""}</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Cuánto desgrava según tu sueldo: aportando ${euros(A)} en ${esc(nom)} (${P.ejercicio})</h2>
    <p class="ayuda">${esc(SUP_MOTOR(P))} Ahorro = IRPF del año sin la aportación menos IRPF con ella. Tipo marginal: estatal + autonómico del tramo en el que cae la base liquidable sin la aportación.</p>
    ${tablaG(["Sueldo bruto anual", "IRPF sin aportar", `IRPF aportando ${euros(A)}`, "Ahorro de IRPF", "Tipo marginal", "Te cuesta de verdad"],
      porSueldo.map(x => [esc(euros(x.b)), esc(eur(x.sin)), esc(eur(x.con)), `<b>${esc(eur(x.ahorro))}</b>`, esc(pctCorto(x.marginal)), esc(eur(r2(A - x.ahorro)))]))}
    <p>Con ${euros(x30.b)} brutos, aportar ${euros(A)} rebaja el IRPF en ${eur(x30.ahorro)}: la aportación te cuesta ${eur(r2(A - x30.ahorro))}. El ahorro se acerca a la aportación por tu tipo marginal; cuando la aportación hace que la base baje de tramo, una parte desgrava al tipo del tramo inferior.</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Cuánto te ahorras aportando ${euros(A)} en cada territorio (2025)</h2>
    <p class="ayuda">Diferencia de cuota calculada con el motor de Mapafiscal, con y sin la aportación. Caso de referencia: ${esc(p.supuesto)}</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Territorio</th>${sal.map(s => `<th class="num">Sueldo de ${euros(Number(s))}</th>`).join("")}</tr></thead><tbody>${filas}</tbody></table></div>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Antes de aportar, ten en cuenta</h2>
    <ul>
      <li>El ahorro es en parte un aplazamiento: cuando rescates el plan, lo que cobres tributará como rendimiento del trabajo en el año del cobro (${lirpf("art. 17.2.a)")}). Ver <a href="/rescate-plan-pensiones/">cómo tributa el rescate</a>.</li>
      <li>Para aplicar la reducción hay que presentar la declaración, aunque no estés obligado (ver <a href="/guias/obligacion-declarar-renta/">¿Estoy obligado a declarar?</a>).</li>
      <li>En el País Vasco y Navarra los límites son los de su normativa foral.</li>
    </ul>
  </div>
  ${cta("Simula tu aportación al plan de pensiones", HERRAMIENTA.planPensiones, ["Calcula tu renta completa", HERRAMIENTA.calculadora])}`;
  const faq = [
    ["¿Cuánto desgrava un plan de pensiones?", `Las aportaciones propias reducen la base hasta ${eur(r.limite_general_abs)} al año (con el límite del ${pctCorto(r.limite_general_pct_rend)} de los rendimientos del trabajo y de actividades). Lo que ahorras depende de tu tipo marginal: en ${nom}, aportar ${euros(A)} ahorra ${listaY(porSueldo.map(x => `${eur(x.ahorro)} con un sueldo de ${euros(x.b)}`))} (ejercicio ${P.ejercicio}).`],
    ["¿Cuál es el límite actual de las aportaciones al plan de pensiones?", `${eur(ps.limite_general_abs)} al año en aportaciones propias, sin pasar del ${pctCorto(ps.limite_general_pct_rend)} de los rendimientos netos del trabajo y de actividades. Con contribuciones de la empresa a un plan de empleo, el límite conjunto sube hasta ${eur(ps.limite_general_abs + ps.incremento_contribucion_empresarial)}. Al plan del cónyuge con pocos ingresos, ${eur(ps.limite_aportacion_conyuge)} más.`],
    ["¿Cómo se calcula la desgravación por aportación a un plan de pensiones?", `No es una deducción fija: la aportación se resta de la base imponible y el ahorro es lo que dejas de pagar en tus tramos más altos. Con ${euros(x30.b)} en ${nom} el tipo marginal es del ${pctCorto(x30.marginal)} y aportar ${euros(A)} rebaja el IRPF en ${eur(x30.ahorro)}.`],
    ["¿Hasta cuándo puedo aportar al plan de pensiones para desgravar este año?", "Hasta el 31 de diciembre: la reducción se aplica en el ejercicio en que se hace la aportación. Conviene no apurar, porque la gestora necesita unos días para tramitarla."],
    [`¿Puedo aportar más de ${euros(r.limite_general_abs)}?`, `Puedes aportar más, pero solo reduce la base lo que esté dentro del límite. Con un plan de empleo de la empresa, el límite conjunto llega a ${eur(total)}.`]
  ];
  return pagina(g, { slug: "plan-pensiones-desgravar", h1: "Cuánto desgrava un plan de pensiones: límite y ahorro por sueldo",
    titulo: `Cuánto desgrava un plan de pensiones: hasta ${euros(ps.limite_general_abs)} al año`,
    resumen: `un plan de pensiones desgrava hasta <b>${eur(ps.limite_general_abs)} al año</b> (límite de aportación propia, ${eur(ps.limite_general_abs + ps.incremento_contribucion_empresarial)} con plan de empleo); con un sueldo de ${euros(x30.b)} en ${esc(nom)}, aportar ${euros(A)} te ahorra <b>${eur(x30.ahorro)}</b> de IRPF en ${P.ejercicio}.`,
    hub: `Hasta ${eur(ps.limite_general_abs)} al año de aportación propia (${eur(ps.limite_general_abs + ps.incremento_contribucion_empresarial)} con plan de empleo). Con ${euros(x30.b)} en ${nom}, aportar ${euros(A)} ahorra ${eur(x30.ahorro)} de IRPF.`,
    description: `Un plan de pensiones desgrava hasta ${euros(ps.limite_general_abs)} al año (${euros(ps.limite_general_abs + ps.incremento_contribucion_empresarial)} con plan de empleo). Ahorro por sueldo: con ${euros(x30.b)} en ${nom}, ${eur(x30.ahorro)}.`,
    cuerpo, faq, generado: g.generado });
}

// ---- 4. Donativos ----------------------------------------------------------------------
// Ejemplos de 150 € y 500 € con el motor JS (deduccionesEstatales: Ley 49/2002, art. 69.1).
const DONATIVOS_EJ = [150, 500];
const T_DON = "ES-MD", SUELDO_DON = 30000;
function guiaDonativos(g) {
  const d = g.donativos.estatal, l = d.ley49_2002;
  const ded = (x, rec) => Math.min(x, l.tramo1_limite) * l.tramo1_porcentaje + Math.max(0, x - l.tramo1_limite) * (rec ? l.resto_porcentaje_recurrente : l.resto_porcentaje);
  const ejemplos = [100, l.tramo1_limite, 500, 1000];
  const igual26 = iguales(d, g.donativos.estatal_2026);
  const P = PARAMS(), nom = NOMBRE_CORTO[T_DON];
  const base = neto(P, T_DON, SUELDO_DON);
  const motor = [...DONATIVOS_EJ.map(x => ({ x, rec: false })), { x: DONATIVOS_EJ[DONATIVOS_EJ.length - 1], rec: true }].map(o => {
    const con = neto(P, T_DON, SUELDO_DON, { donativos: o.x, donativosRecurrentes: o.rec });
    return Object.assign(o, { irpf: con.irpf, deduccion: con.liquidacion.deduccionesEstatales?.detalle?.donativos ?? r2(base.irpf - con.irpf), rebaja: r2(base.irpf - con.irpf) });
  });
  const [m150, m500, m500r] = motor;
  const limite10 = r2(base.liquidacion.baseLiquidableGeneral * l.limite_base_liquidable_pct);
  const cuerpo = `
  <p class="entradilla">Los donativos y donaciones a ONG, fundaciones y demás entidades acogidas a la Ley 49/2002 de mecenazgo dan derecho a una deducción en la cuota del IRPF: no reducen la base, sino que se restan directamente del impuesto. Los primeros euros son los que más desgravan.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Porcentajes y límites de la deducción por donativos</h2>
    <ul>
      <li><b>${pctCorto(l.tramo1_porcentaje)}</b> de los primeros ${eur(l.tramo1_limite)} donados en el año.</li>
      <li><b>${pctCorto(l.resto_porcentaje)}</b> de lo que exceda de ${eur(l.tramo1_limite)}.</li>
      <li><b>${pctCorto(l.resto_porcentaje_recurrente)}</b> en lugar del ${pctCorto(l.resto_porcentaje)} si en los dos años anteriores donaste a la misma entidad un importe igual o mayor (donación recurrente).</li>
      <li>Límite: la base de la deducción (lo donado) no puede superar el ${pctCorto(l.limite_base_liquidable_pct)} de tu base liquidable.</li>
    </ul>
    ${citaFuente(d)}
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Ejemplos con el motor: donar ${DONATIVOS_EJ.map(x => euros(x)).join(" o ")} (${P.ejercicio})</h2>
    <p class="ayuda">${esc(SUP_MOTOR(P).replace("sin hijos ni deducciones", "sin hijos ni otras deducciones"))} Sueldo bruto de ${esc(euros(SUELDO_DON))} en ${esc(nom)}; IRPF del año sin donar: ${esc(eur(base.irpf))}.</p>
    ${tablaG(["Donativo en el año", "Deducción", "IRPF del año", "Rebaja de IRPF", "Te cuesta de verdad"],
      motor.map(o => [`${esc(eur(o.x))}${o.rec ? " (recurrente)" : ""}`, esc(eur(o.deduccion)), esc(eur(o.irpf)), `<b>${esc(eur(o.rebaja))}</b>`, esc(eur(r2(o.x - o.rebaja)))]))}
    <p>Donar ${eur(m150.x)} rebaja el IRPF en ${eur(m150.rebaja)}: todo cae en el tramo del ${pctCorto(l.tramo1_porcentaje)}. Con ${eur(m500.x)}, los primeros ${eur(l.tramo1_limite)} deducen ${eur(r2(l.tramo1_limite * l.tramo1_porcentaje))} y los ${eur(m500.x - l.tramo1_limite)} restantes, ${eur(r2((m500.x - l.tramo1_limite) * l.resto_porcentaje))}: ${eur(m500.rebaja)} en total (${eur(m500r.rebaja)} si es recurrente). Con este sueldo el límite del ${pctCorto(l.limite_base_liquidable_pct)} de la base liquidable está en ${eur(limite10)}${limite10 >= Math.max(...DONATIVOS_EJ) ? ", así que los dos donativos deducen enteros" : ""}.</p>
    <p class="ayuda">La deducción se reparte a partes iguales entre la cuota estatal y la autonómica, y solo puede rebajar la cuota hasta cero.</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Más ejemplos: cuánto te deduces según lo que dones</h2>
    <table class="cobertura"><thead><tr><th class="num">Donas al año</th><th class="num">Te deduces</th><th class="num">Si es recurrente</th><th class="num">Te cuesta de verdad</th></tr></thead><tbody>
    ${ejemplos.map(x => `<tr><td class="num">${eur(x)}</td><td class="num">${eur(ded(x, false))}</td><td class="num">${eur(ded(x, true))}</td><td class="num">${eur(x - ded(x, false))}</td></tr>`).join("")}
    </tbody></table>
    <p class="ayuda">Siempre que lo donado no pase del ${pctCorto(l.limite_base_liquidable_pct)} de tu base liquidable y tengas cuota suficiente.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Otras donaciones y aportaciones</h2>
    <ul>
      <li>Donativos a fundaciones y asociaciones de utilidad pública no incluidas en la Ley 49/2002: ${pctCorto(d.otras_fundaciones_porcentaje)}.</li>
      <li>Cuotas de afiliación y aportaciones a partidos políticos: ${pctCorto(d.cuotas_afiliacion_partidos.porcentaje)}, con una base máxima de ${eur(d.cuotas_afiliacion_partidos.base_maxima)} al año.</li>
      <li>Algunas comunidades añaden deducciones propias por donativos (por ejemplo, a entidades de su territorio): búscalas en las deducciones de tu comunidad, en <a href="/irpf/">IRPF por territorio</a>. En el País Vasco y Navarra rige su propia ley de mecenazgo.</li>
    </ul>
    <p class="ayuda">Norma: ${lirpf("art. 68.3")}. ${igual26 ? "En 2026 los porcentajes no cambian." : ""}</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Cómo se aplica en la declaración</h2>
    <p>Las entidades informan a Hacienda de los donativos que reciben, así que suelen aparecer ya en los datos fiscales del borrador. Comprueba que están todos, sobre todo si has donado a varias entidades, y guarda el certificado de cada una.</p>
  </div>
  ${cta("Calcula tu renta con tus donativos", HERRAMIENTA.calculadora)}`;
  const faq = [
    ["¿Cuál es la deducción por donativos en el IRPF?", `El ${pctCorto(l.tramo1_porcentaje)} de los primeros ${eur(l.tramo1_limite)} donados en el año a entidades de la Ley 49/2002 y el ${pctCorto(l.resto_porcentaje)} del resto (${pctCorto(l.resto_porcentaje_recurrente)} si la donación es recurrente), con el límite del ${pctCorto(l.limite_base_liquidable_pct)} de la base liquidable.`],
    ["¿Cuánto se puede desgravar por donaciones?", `Con ${eur(m150.x)} donados te deduces ${eur(m150.rebaja)} y con ${eur(m500.x)}, ${eur(m500.rebaja)} (${eur(m500r.rebaja)} si es recurrente). No hay un máximo en euros: el tope es que lo donado no supere el ${pctCorto(l.limite_base_liquidable_pct)} de tu base liquidable.`],
    ["¿Cómo se aplica la deducción por donaciones en la renta?", "Se resta de la cuota, a partes iguales en la estatal y en la autonómica. Las entidades comunican los donativos a Hacienda y suelen aparecer ya en el borrador: revisa que estén todos y guarda los certificados."],
    ["¿Cuánto me devuelve Hacienda si dono 250 euros?", `Te deduces el ${pctCorto(l.tramo1_porcentaje)}: ${eur(ded(250, false))}. El donativo te cuesta en realidad ${eur(250 - ded(250, false))}.`],
    ["¿Qué es una donación recurrente?", `La que haces a la misma entidad por tercer año seguido con un importe igual o mayor que en los dos años anteriores. Lo que pase de ${eur(l.tramo1_limite)} deduce el ${pctCorto(l.resto_porcentaje_recurrente)} en lugar del ${pctCorto(l.resto_porcentaje)}.`],
    ["¿Hay un límite para deducir donativos?", `Sí: la base de la deducción no puede pasar del ${pctCorto(l.limite_base_liquidable_pct)} de tu base liquidable. Y la deducción solo puede rebajar la cuota hasta cero: no se devuelve lo que no se pueda aplicar.`]
  ];
  return pagina(g, { slug: "deduccion-donativos", h1: "Deducción por donativos y donaciones en el IRPF",
    titulo: tituloQueQuepa(`Deducción por donativos y donaciones: ${pctCorto(l.tramo1_porcentaje)} de los primeros ${euros(l.tramo1_limite)}`, `Deducción por donativos: ${pctCorto(l.tramo1_porcentaje)} de los primeros ${euros(l.tramo1_limite)}`),
    resumen: `la deducción por donativos a ONG y fundaciones de la Ley 49/2002 es del <b>${pctCorto(l.tramo1_porcentaje)}</b> de los primeros ${eur(l.tramo1_limite)} donados al año y del <b>${pctCorto(l.resto_porcentaje)}</b> del resto (${pctCorto(l.resto_porcentaje_recurrente)} si es recurrente), con un límite del ${pctCorto(l.limite_base_liquidable_pct)} de la base liquidable. Donar ${eur(m150.x)} te rebaja el IRPF en <b>${eur(m150.rebaja)}</b> y donar ${eur(m500.x)}, en <b>${eur(m500.rebaja)}</b>.`,
    hub: `El ${pctCorto(l.tramo1_porcentaje)} de los primeros ${eur(l.tramo1_limite)} donados y el ${pctCorto(l.resto_porcentaje)} del resto (${pctCorto(l.resto_porcentaje_recurrente)} si es recurrente): ${eur(m150.x)} donados te deducen ${eur(m150.rebaja)} y ${eur(m500.x)}, ${eur(m500.rebaja)}.`,
    description: `Deducción por donativos y donaciones en el IRPF: ${pctCorto(l.tramo1_porcentaje)} de los primeros ${euros(l.tramo1_limite)}, ${pctCorto(l.resto_porcentaje)} del resto (${pctCorto(l.resto_porcentaje_recurrente)} si es recurrente) y límite del ${pctCorto(l.limite_base_liquidable_pct)}. Ejemplos de ${eur(m150.x)} y ${eur(m500.x)}.`,
    cuerpo, faq, generado: g.generado });
}

// ---- 5. Obligación de declarar ---------------------------------------------------------
function guiaObligacion(g) {
  const o = g.obligacion_declarar.estatal;
  const igual26 = iguales(o, g.obligacion_declarar.estatal_2026);
  const cuerpo = `
  <p class="entradilla">No todo el mundo tiene que presentar la declaración de la renta. La ley fija unos límites de ingresos por debajo de los cuales no es obligatorio, aunque a veces conviene presentarla igualmente para recuperar retenciones.</p>
  <div class="tarjeta">
    <h2 class="rotulo">No estás obligado si solo tienes estas rentas (2025)</h2>
    <ul>
      <li>Rendimientos del trabajo de hasta <b>${eur(o.trabajo_un_pagador)}</b> al año, si vienen de un solo pagador.</li>
      <li>Hasta <b>${eur(o.trabajo_varios_pagadores)}</b> si tienes más de un pagador y lo que cobras del segundo y siguientes suma más de ${eur(o.segundo_pagador_umbral)}. Este límite también se aplica, entre otros casos, si cobras una pensión compensatoria o anualidades por alimentos, o si tu pagador no está obligado a retener (${lirpf("art. 96.3")}).</li>
      <li>Rendimientos del capital mobiliario y ganancias patrimoniales sometidos a retención (intereses, dividendos, fondos) de hasta ${eur(o.capital_y_ganancias_con_retencion)}.</li>
      <li>Rentas inmobiliarias imputadas (segundas viviendas), rendimientos de Letras del Tesoro y ayudas públicas para vivienda protegida de hasta ${eur(o.rentas_inmobiliarias_imputadas)} en conjunto.</li>
      <li>Tampoco si la suma de rendimientos del trabajo, del capital, de actividades y de ganancias no pasa de ${eur(o.rentas_totales_minimas)} y las pérdidas patrimoniales son inferiores a ${eur(o.perdidas_patrimoniales_maximas)}.</li>
    </ul>
    ${citaFuente(o)}
    ${igual26 ? "<p>Para 2026 los límites son los mismos.</p>" : ""}
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Tienes que declarar en todo caso si…</h2>
    <ul>
      <li>Has estado de alta como autónomo en el RETA en algún momento del año.</li>
      <li>Quieres aplicar la deducción por vivienda habitual del régimen transitorio (compras anteriores a 2013) o reducir la base por aportaciones a planes de pensiones.</li>
    </ul>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Aunque no estés obligado, puede salirte a devolver</h2>
    <p>Si tu empresa te ha retenido más de lo que te corresponde pagar, solo recuperas la diferencia presentando la declaración. Pasa a menudo con sueldos bajos, contratos de pocos meses o cambios de empleo. Haz la prueba en la calculadora: te dice si estás obligado y cuánto te sale.</p>
    <p>En el País Vasco y Navarra los límites los fija su normativa foral.</p>
  </div>
  ${cta("Comprueba si te sale a devolver", HERRAMIENTA.calculadora)}`;
  const faq = [
    ["¿Con cuánto dinero estoy obligado a hacer la renta?", `Con un solo pagador, si tus rendimientos del trabajo superan ${eur(o.trabajo_un_pagador)} al año. Con dos o más pagadores, si superan ${eur(o.trabajo_varios_pagadores)} y el segundo y siguientes suman más de ${eur(o.segundo_pagador_umbral)}.`],
    ["Si tengo dos pagadores, ¿siempre tengo que declarar?", `No. Si el segundo y siguientes pagadores suman ${eur(o.segundo_pagador_umbral)} o menos, el límite sigue siendo ${eur(o.trabajo_un_pagador)}. Si suman más, baja a ${eur(o.trabajo_varios_pagadores)}.`],
    ["¿Me conviene presentar la declaración si no estoy obligado?", "Sí, si te han retenido más de lo que te corresponde: solo así te devuelven la diferencia. Si te sale a pagar y no estás obligado, no tienes que presentarla."]
  ];
  return pagina(g, { slug: "obligacion-declarar-renta", h1: "¿Estoy obligado a hacer la declaración de la renta?",
    titulo: `¿Obligado a hacer la renta 2025? Límite de ${euros(o.trabajo_un_pagador)}`,
    hub: `No estás obligado con un sueldo de hasta ${eur(o.trabajo_un_pagador)} de un solo pagador, o de hasta ${eur(o.trabajo_varios_pagadores)} si el segundo y siguientes pagadores suman más de ${eur(o.segundo_pagador_umbral)}.`,
    resumen: `en la renta de 2025 no tienes que declarar si solo cobras un sueldo de hasta <b>${eur(o.trabajo_un_pagador)}</b> de un pagador, o de hasta <b>${eur(o.trabajo_varios_pagadores)}</b> si el segundo pagador y siguientes suman más de ${eur(o.segundo_pagador_umbral)}.`,
    description: `Quién tiene que hacer la renta 2025: ${euros(o.trabajo_un_pagador)} con un pagador, ${euros(o.trabajo_varios_pagadores)} con dos si el segundo pasa de ${euros(o.segundo_pagador_umbral)}, y cuándo conviene declarar igualmente.`,
    cuerpo, faq, generado: g.generado });
}

// ---- 6. Calendario ----------------------------------------------------------------------
// Solo fechas de params/calendario_renta.yaml. La campaña siguiente no lleva fechas hasta que
// su orden se publique en el BOE y se añada al YAML.
function guiaCalendario(g) {
  const c = [...g.calendario].sort((a, b) => b.ejercicio - a.ejercicio)[0];
  const f = c.fraccionamiento;
  const o = g.obligacion_declarar.estatal;
  // ¿La última campaña publicada ya empezó cuando se generaron los datos? (fechas ISO)
  const empezada = g.generado >= c.inicio, terminada = g.generado > c.fin;
  const siguiente = terminada ? c.ejercicio + 1 : c.ejercicio;
  const fue = terminada ? "fue" : empezada ? "es" : "será";
  const proxima = terminada
    ? `<p>La próxima campaña es la de la <b>renta ${siguiente}</b>, que se presenta en ${siguiente + 1}. <b>Sus fechas todavía no se han publicado</b>: las fija la orden del Ministerio de Hacienda que aprueba el modelo de declaración, y no las daremos hasta que salga en el BOE.</p>
    <p>Como referencia, la orden de la renta ${c.ejercicio} se publicó el ${fecha(c.publicada)} y la campaña empezó el ${fecha(c.inicio)}. No es una fecha oficial de la próxima: cada orden fija las suyas.</p>`
    : `<p>La próxima campaña es la de la <b>renta ${c.ejercicio}</b>: ${empezada ? "empezó" : "empieza"} el <b>${fecha(c.inicio)}</b> y termina el <b>${fecha(c.fin)}</b>, según la ${esc(c.norma.replace(/, por la que.*$/, ""))}.</p>`;
  const cuerpo = `
  <p class="entradilla">La declaración de la renta de un año se presenta en la primavera del año siguiente. Cada campaña, una orden del Ministerio de Hacienda publicada en el BOE fija las fechas. Estas son las de la última campaña publicada, la de la renta ${c.ejercicio}.</p>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Fechas de la declaración de la renta ${c.ejercicio}</h2>
    <table class="cobertura"><thead><tr><th>Qué</th><th>Fecha</th></tr></thead><tbody>
      <tr><td>Empieza el plazo para presentar el borrador y la declaración, salga a pagar o a devolver</td><td>${fecha(c.inicio)}</td></tr>
      <tr><td>Último día para domiciliar el pago en tu banco</td><td>${fecha(c.fin_domiciliacion)}</td></tr>
      <tr><td>Último día para presentar la declaración</td><td>${fecha(c.fin)}</td></tr>
      <tr><td>Último día para domiciliar si solo domicilias el segundo plazo</td><td>${fecha(c.fin_domiciliacion_solo_segundo_plazo)}</td></tr>
      <tr><td>Cargo del segundo plazo domiciliado (${pctCorto(f.segundo_plazo_pct)})</td><td>${fecha(f.cargo_segundo_plazo_domiciliado)}</td></tr>
      <tr><td>Último día para pagar el segundo plazo sin domiciliar</td><td>${fecha(f.segundo_plazo_hasta)}</td></tr>
    </tbody></table>
    <p class="ayuda">Norma: ${esc(c.norma)}. Fuente: <a href="${urlBoe(c.boe)}" rel="noopener">${esc(c.fuente)}</a>.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">¿Cuándo empieza la próxima campaña?</h2>
    ${proxima}
    <p>Mientras tanto, puedes calcular tu renta con la <a href="${HERRAMIENTA.calculadora}">calculadora</a> y comprobar si estás obligado a declarar: con un solo pagador, si tus rendimientos del trabajo pasan de ${eur(o.trabajo_un_pagador)} al año (<a href="/guias/obligacion-declarar-renta/">quién tiene que hacer la renta</a>).</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Pagar en dos plazos</h2>
    <p>Si te sale a pagar, puedes fraccionar el pago sin intereses ni recargo: el ${pctCorto(f.primer_plazo_pct)} al presentar la declaración y el ${pctCorto(f.segundo_plazo_pct)} restante hasta el ${fecha(f.segundo_plazo_hasta)}. Para fraccionar, tienes que presentar la declaración dentro de plazo.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Fechas que importan durante el año</h2>
    <ul>
      <li><b>31 de diciembre:</b> el IRPF se calcula por años naturales (${lirpf("art. 12")}). Lo que quieras que cuente en la renta del año (aportaciones a planes de pensiones, donativos, gastos con derecho a deducción) tiene que estar pagado antes de que acabe. Ver <a href="/guias/plan-pensiones-desgravar/">cuánto desgrava un plan de pensiones</a> y la <a href="/guias/deduccion-donativos/">deducción por donativos</a>.</li>
      <li><b>Primavera:</b> campaña de la renta del año anterior. En la renta ${c.ejercicio}, del ${fechaSinAnio(c.inicio)} al ${fecha(c.fin)}.</li>
      <li><b>Noviembre:</b> segundo plazo para quien fraccionó el pago (en la renta ${c.ejercicio}, hasta el ${fecha(f.segundo_plazo_hasta)}).</li>
    </ul>
    <p>La orden de cada campaña sale en el BOE antes de que empiece; la de la renta ${c.ejercicio} se publicó el ${fecha(c.publicada)}. En cuanto se publique la de la campaña siguiente, actualizaremos esta página.</p>
  </div>
  ${cta("Calcula ya tu próxima renta", HERRAMIENTA.calculadora, ["¿Estoy obligado a declarar?", "/guias/obligacion-declarar-renta/"])}`;
  const rangoTxt = `del ${c.inicio.slice(0, 4) === c.fin.slice(0, 4) ? fechaSinAnio(c.inicio) : fecha(c.inicio)} al ${fecha(c.fin)}`;
  const faq = [
    ["¿Cuáles son las fechas de la declaración de la renta?", `En la renta ${c.ejercicio}, ${rangoTxt}. Para domiciliar el pago, hasta el ${fecha(c.fin_domiciliacion)}; el segundo plazo, hasta el ${fecha(f.segundo_plazo_hasta)}.`],
    ["¿Cuál es el plazo de la renta?", `El plazo para presentar la renta ${c.ejercicio} ${fue} ${rangoTxt}, ambos inclusive, salga a pagar o a devolver. Si domicilias el pago, el último día ${terminada ? "era" : "es"} el ${fecha(c.fin_domiciliacion)}.`],
    ["¿Cuál es el periodo de la renta?", `Es el plazo de la campaña de primavera: en la renta ${c.ejercicio}, ${rangoTxt}. Se declara lo cobrado en el año natural anterior (de enero a diciembre de ${c.ejercicio}).`],
    [`¿Cuándo es la renta ${c.ejercicio}?`, `La renta ${c.ejercicio} se presenta en ${c.ejercicio + 1}: ${rangoTxt}, según la orden publicada en el BOE el ${fecha(c.publicada)}.`],
    ["¿Cuándo es la próxima campaña de la renta?", terminada
      ? `La próxima es la de la renta ${siguiente}, que se presenta en ${siguiente + 1}. Sus fechas aún no se han publicado: las fija cada año una orden del Ministerio de Hacienda en el BOE. En cuanto salga, la recogemos aquí.`
      : `La de la renta ${c.ejercicio}: ${rangoTxt}.`],
    ["¿Cuál es el mínimo para hacer la renta?", `Con un solo pagador no estás obligado si tus rendimientos del trabajo no pasan de ${eur(o.trabajo_un_pagador)} al año; con dos o más, el límite baja a ${eur(o.trabajo_varios_pagadores)} si el segundo y siguientes suman más de ${eur(o.segundo_pagador_umbral)}. Aunque no estés obligado, te conviene declarar si te sale a devolver.`],
    ["¿Se puede pagar la renta en dos veces?", `Sí: el ${pctCorto(f.primer_plazo_pct)} al presentar y el ${pctCorto(f.segundo_plazo_pct)} hasta el ${fecha(f.segundo_plazo_hasta)}, sin intereses, si presentas la declaración dentro de plazo.`]
  ];
  return pagina(g, { slug: "calendario-renta", h1: "Campaña de la renta: cuándo empieza y fechas clave",
    titulo: `Campaña de la renta: cuándo empieza y fechas (${c.ejercicio})`,
    resumen: `la declaración de la renta ${c.ejercicio} ${fue} <b>${rangoTxt}</b>; para domiciliar el pago, hasta el ${fecha(c.fin_domiciliacion)}, y el segundo plazo, hasta el ${fecha(f.segundo_plazo_hasta)}.${terminada ? ` La próxima campaña, la de la renta ${siguiente}, se presenta en ${siguiente + 1}; sus fechas aún no se han publicado en el BOE.` : ""}`,
    hub: `La renta ${c.ejercicio} ${fue} ${rangoTxt} (domiciliación hasta el ${fechaSinAnio(c.fin_domiciliacion)}; segundo plazo, hasta el ${fecha(f.segundo_plazo_hasta)}).${terminada ? ` Las fechas de la renta ${siguiente} aún no se han publicado.` : ""}`,
    description: `Fechas de la declaración de la renta ${c.ejercicio}: del ${fechaSinAnio(c.inicio)} al ${fecha(c.fin)}; domiciliación hasta el ${fechaSinAnio(c.fin_domiciliacion)} y segundo plazo el ${fechaSinAnio(f.segundo_plazo_hasta)}. Próxima campaña y orden del BOE.`,
    cuerpo, faq, generado: g.generado });
}

// ---- Guías con el motor JS (web/js/irpfsim.js sobre web/datos/params.json) ------------
const SUP_MOTOR = P => `Persona sola de 40 años, un único sueldo, sin hijos ni deducciones; IRPF del ejercicio ${P.ejercicio} calculado con el motor de Mapafiscal y cotizaciones del trabajador según los parámetros del mismo año. No es una liquidación oficial.`;
const tablaG = (cab, filas) => `<div class="envoltorio"><table class="cobertura"><thead><tr>${cab.map((c, i) => `<th${i ? ' class="num"' : ""}>${esc(c)}</th>`).join("")}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((c, i) => `<td${i ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const ET_BOE = urlBoe("BOE-A-2015-11430");

// ---- 12 o 14 pagas ----------------------------------------------------------------------
const BRUTOS_PAGAS = [20000, 30000, 40000, 60000];
function guiaPagas(g) {
  const P = PARAMS(), T = "ES-MD", nom = NOMBRE_CORTO[T];
  const fil = BRUTOS_PAGAS.map(b => { const r = neto(P, T, b); return { b, r, m12: r.neto / 12, m14: r.neto / 14 }; });
  const x = fil[1];
  const cuerpo = `
  <p class="entradilla">El número de pagas no cambia lo que ganas en el año: cambia cómo te llega. Con el mismo sueldo bruto anual, en 14 pagas cada nómina ordinaria es más pequeña y en junio y diciembre cobras además dos pagas extra; en 12 pagas cobras lo mismo todos los meses. El IRPF y las cotizaciones del año son los mismos.</p>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Neto mensual con 12 y con 14 pagas en ${esc(nom)} (${P.ejercicio})</h2>
    <p class="ayuda">${esc(SUP_MOTOR(P))} Neto por paga = neto anual entre el número de pagas.</p>
    ${tablaG(["Bruto anual", "Cotizaciones", "IRPF del año", "Neto anual", "Neto con 12 pagas", "Neto por paga con 14"],
      fil.map(f => [esc(euros(f.b)), esc(eur(f.r.cotizaciones)), esc(eur(f.r.irpf)), esc(eur(f.r.neto)), esc(eur(f.m12)), esc(eur(f.m14))]))}
    <p>Con ${euros(x.b)} brutos, el neto del año es ${eur(x.r.neto)} en los dos casos: ${eur(x.m12)} al mes en 12 pagas, o ${eur(x.m14)} en cada una de las 14 (doce nóminas más dos extras).</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">La prorrata de las pagas extra</h2>
    <p>Las pagas extraordinarias las fija el convenio colectivo o el contrato. El <a href="${ET_BOE}" rel="noopener">art. 31 del Estatuto de los Trabajadores</a> reconoce al menos dos al año (una en Navidad y otra en el mes que fije el convenio) y permite que el convenio las prorratee en las doce mensualidades. Si están prorrateadas, cada nómina lleva una parte de las extras y cobras 12 pagas iguales; si no, se cobran aparte en los meses de la paga.</p>
    <p>Prorratear o no es solo una cuestión de calendario de cobro: el bruto anual, las cotizaciones del año y el IRPF final no cambian.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">¿Y la retención?</h2>
    <p>La empresa no calcula la retención de cada nómina por separado: calcula un tipo de retención con lo que prevé pagarte en todo el año y lo aplica a cada pago, también a las extras (<a href="${RIRPF_BOE}" rel="noopener">arts. 80 a 87 del Reglamento del IRPF</a>). Por eso el porcentaje de retención no depende de que cobres en 12 o en 14 pagas.</p>
    <p>La retención es un anticipo. El IRPF que pagas de verdad se ajusta en la declaración de la renta: si te han retenido de más, Hacienda te devuelve la diferencia; si te han retenido de menos, la pagas. Las cifras de esta página son el IRPF final del año, no la retención de tu nómina.</p>
  </div>
  ${cta("Calcula tu sueldo neto", HERRAMIENTA.sueldoNeto, ["Calcula tu IRPF", HERRAMIENTA.calculadora])}`;
  const faq = [
    ["¿Se cobra más con 14 pagas que con 12?", `No. Con el mismo bruto anual el neto del año es el mismo. Con ${euros(x.b)} brutos en ${nom} son ${eur(x.r.neto)} netos al año: ${eur(x.m12)} al mes en 12 pagas o ${eur(x.m14)} por paga en 14.`],
    ["¿Se paga más IRPF con 14 pagas?", "No. El IRPF se calcula sobre lo que cobras en el año, no por nómina. El número de pagas solo cambia cuándo cobras."],
    ["¿Qué es tener las pagas prorrateadas?", "Que las pagas extra se reparten entre las doce nóminas del año: cobras doce pagas iguales y en junio y diciembre no hay paga extra aparte."],
    ["¿Por qué la paga extra lleva retención?", "Porque la retención se calcula sobre todo lo que cobras en el año y se aplica a cada pago, también a las extras. No es un impuesto aparte."]
  ];
  return pagina(g, { slug: "12-o-14-pagas", h1: "12 o 14 pagas: cuánto cobras al mes con el mismo sueldo",
    titulo: "12 o 14 pagas: neto mensual con el mismo sueldo bruto",
    hub: `El neto del año no cambia: con ${euros(x.b)} brutos en ${nom}, ${eur(x.m12)} al mes en 12 pagas o ${eur(x.m14)} por paga en 14.`,
    resumen: `con el mismo bruto anual el neto del año no cambia: con ${euros(x.b)} en ${esc(nom)} son <b>${eur(x.m12)}</b> al mes en 12 pagas o <b>${eur(x.m14)}</b> por paga en 14.`,
    description: `12 o 14 pagas: con ${euros(x.b)} brutos en Madrid cobras ${euros(x.m12)} al mes en 12 pagas o ${euros(x.m14)} en 14. Prorrata de extras y retención.`,
    cuerpo, faq, generado: g.generado });
}

// ---- Tipo marginal y tipo medio ----------------------------------------------------------
const OTRO_T = "ES-CT";
function marginalDe(P, terr, bruto) {
  const r = neto(P, terr, bruto), l = r.liquidacion, t = P.territorios[terr];
  const escala = MOTOR.tipoMarginal(l.baseLiquidableGeneral, P.estatal.escala_general_estatal) + MOTOR.tipoMarginal(l.baseLiquidableGeneral, t.escala_general_autonomica);
  const mas = neto(P, terr, bruto + 1000);
  return { bruto, r, escala, medio: r.irpf / bruto, irpfMas: mas.irpf - r.irpf, netoMas: mas.neto - r.neto };
}
function guiaMarginal(g) {
  const P = PARAMS();
  const casos = [];
  for (const terr of ["ES-MD", OTRO_T]) for (const b of [30000, 60000]) casos.push(Object.assign({ terr, nombre: NOMBRE_CORTO[terr] }, marginalDe(P, terr, b)));
  const [m30, m60, o30, o60] = casos;
  const cuerpo = `
  <p class="entradilla">El tipo marginal es el porcentaje que pagas por el último euro que ganas: el del tramo de la escala en el que cae tu base. El tipo medio es el IRPF que pagas en total dividido entre lo que ganas. El marginal sirve para saber cuánto te queda de un euro más; el medio, cuánto pagas en conjunto. El medio siempre es bastante más bajo, porque los primeros euros tributan a tipos menores y una parte de la renta queda cubierta por el mínimo personal.</p>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Ejemplos con el motor (${P.ejercicio})</h2>
    <p class="ayuda">${esc(SUP_MOTOR(P))} Tipo marginal: suma de los tipos estatal y autonómico del tramo en el que cae la base liquidable general. Tipo medio: IRPF del año entre el sueldo bruto.</p>
    ${tablaG(["Territorio y sueldo", "Base liquidable", "Tipo marginal", "IRPF del año", "Tipo medio sobre el bruto", "IRPF por 1.000 € más"],
      casos.map(c => [`${esc(c.nombre)}, ${esc(euros(c.bruto))}`, esc(eur(c.r.liquidacion.baseLiquidableGeneral)), esc(pctCorto(c.escala)), esc(eur(c.r.irpf)), esc(pct(c.medio)), esc(eur(c.irpfMas))]))}
    <p>Con ${euros(m30.bruto)} en ${esc(m30.nombre)} el tipo marginal es del ${pctCorto(m30.escala)}, pero el IRPF del año es el ${pct(m30.medio)} del sueldo. Con ${euros(m60.bruto)}, el marginal sube al ${pctCorto(m60.escala)} y el medio al ${pct(m60.medio)}. En ${esc(o30.nombre)}, con los mismos sueldos, el marginal es del ${pctCorto(o30.escala)} y del ${pctCorto(o60.escala)}.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">El mito: «si me suben el sueldo y cambio de tramo, cobro menos»</h2>
    <p>No pasa. La escala del IRPF es progresiva por tramos (${lirpf("arts. 63 y 74")}): cada tipo se aplica solo a la parte de la base que cae dentro de su tramo. Si una subida te mete en el tramo siguiente, el tipo más alto lo pagan solo los euros que pasan del límite; los anteriores siguen tributando igual que antes.</p>
    <p>Con el motor: en ${esc(m30.nombre)}, pasar de ${euros(m30.bruto)} a ${euros(m30.bruto + 1000)} brutos sube el IRPF en ${eur(m30.irpfMas)} y el neto del año en ${eur(m30.netoMas)}. Con ${euros(m60.bruto)}, los 1.000 € más dejan ${eur(m60.netoMas)} netos. El neto crece siempre que crece el bruto.</p>
    <p>Lo que sí puede ocurrir es que suba la retención de tu nómina o que dejes de cumplir el límite de renta de alguna deducción o ayuda. Eso no es un efecto de los tramos.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Para qué sirve cada uno</h2>
    <ul>
      <li><b>Tipo marginal</b>: para decidir. Te dice cuánto IRPF ahorras con una reducción de la base (como una <a href="/guias/plan-pensiones-desgravar/">aportación a un plan de pensiones</a>) o cuánto pagas por unos ingresos extra.</li>
      <li><b>Tipo medio</b>: para comparar. Te dice qué parte de tu sueldo se va en IRPF y es la cifra que tiene sentido comparar entre territorios o entre años.</li>
    </ul>
    <p>La columna «IRPF por 1.000 € más» no tiene por qué coincidir con el tipo marginal de la escala: las cotizaciones se restan antes de aplicar la escala, y algunas reducciones (como la de rendimientos del trabajo para sueldos bajos) cambian con el sueldo. Los tramos de cada territorio están en <a href="/guias/tramos-irpf-2025-2026/">tramos del IRPF</a>.</p>
  </div>
  ${cta("Calcula tu IRPF", HERRAMIENTA.calculadora, ["Compara territorios", HERRAMIENTA.comparar])}`;
  const faq = [
    ["¿Qué diferencia hay entre tipo marginal y tipo medio?", `El marginal es el tipo del tramo en el que cae tu último euro; el medio es el IRPF total dividido entre lo que ganas. Con ${euros(m30.bruto)} en ${m30.nombre} el marginal es del ${pctCorto(m30.escala)} y el medio sobre el bruto, del ${pct(m30.medio)}.`],
    ["¿Puedo cobrar menos por cambiar de tramo?", `No. El tipo más alto solo se aplica a los euros que pasan del límite del tramo. En ${m30.nombre}, pasar de ${euros(m30.bruto)} a ${euros(m30.bruto + 1000)} brutos deja ${eur(m30.netoMas)} netos más al año.`],
    ["¿Qué tipo uso para saber cuánto desgrava un plan de pensiones?", "El marginal: la aportación reduce la base, y lo que te ahorras sale de los tramos más altos que dejas de pagar."],
    ["¿El tipo marginal es el mismo en toda España?", `No. En régimen común la mitad estatal es igual, pero cada comunidad fija su escala autonómica. Con ${euros(m60.bruto)} el marginal es del ${pctCorto(m60.escala)} en ${m60.nombre} y del ${pctCorto(o60.escala)} en ${o60.nombre}.`]
  ];
  return pagina(g, { slug: "tipo-marginal-y-tipo-medio", h1: "Tipo marginal y tipo medio del IRPF: en qué se diferencian",
    titulo: "Tipo marginal y tipo medio del IRPF, con ejemplos",
    hub: `Con ${euros(m30.bruto)} en ${m30.nombre}, el tipo marginal es del ${pctCorto(m30.escala)} y el medio sobre el bruto, del ${pct(m30.medio)}. Cambiar de tramo nunca reduce el neto.`,
    resumen: `el tipo marginal es lo que pagas por el último euro; el medio, el IRPF total entre lo que ganas. Con ${euros(m30.bruto)} en ${esc(m30.nombre)}: marginal del <b>${pctCorto(m30.escala)}</b> y medio del <b>${pct(m30.medio)}</b>. Cambiar de tramo nunca reduce el neto.`,
    description: `Tipo marginal y tipo medio del IRPF con ejemplos de 30.000 y 60.000 € en Madrid y Cataluña. Por qué cambiar de tramo no hace que cobres menos.`,
    cuerpo, faq, generado: g.generado });
}

// ---- Cambiar de comunidad ----------------------------------------------------------------
function guiaCambioComunidad(g) {
  const C = COMPARATIVAS(), S = "30000", lista = C.comparativas[S];
  const pri = lista[0], ult = lista[lista.length - 1], mad = lista.find(x => x.territorio === "ES-MD");
  const comun = lista.filter(x => !/^ES-(PV|NC)/.test(x.territorio));
  const cPri = comun[0], cUlt = comun[comun.length - 1];
  const filas = lista.map(x => [`<a href="${enlaceTerritorio(x.territorio)}">${esc(x.nombre)}</a>`, esc(eur(x.cuota_liquida_total)), esc(pct(x.tipo_medio_efectivo)), esc(difEuros(x.cuota_liquida_total, pri.cuota_liquida_total))]);
  const cuerpo = `
  <p class="entradilla">En el IRPF no eliges comunidad: te corresponde la de tu residencia habitual en el año. Y como cada comunidad tiene su propia escala autonómica y sus deducciones, mudarte puede cambiar lo que pagas.</p>
  <div class="tarjeta">
    <h2 class="rotulo">Qué comunidad te corresponde</h2>
    <p>Según el ${lirpf("art. 72")}, resides en la comunidad autónoma en la que pasas más días del período impositivo (el año natural). Las ausencias temporales cuentan como días en la comunidad de tu residencia. Si así no se puede saber, se mira dónde tienes el principal centro de tus intereses (donde obtienes la mayor parte de tu base imponible) y, en último término, tu última residencia declarada.</p>
    <p>No importa dónde esté tu empresa ni dónde figures empadronado si en realidad vives en otro sitio: cuenta dónde vives. El padrón es un indicio, pero Hacienda puede comprobar la residencia real.</p>
    <p class="cita">Norma: ${lirpf("art. 72")}. En el País Vasco y Navarra la residencia se determina con criterios equivalentes del Concierto y del Convenio Económico.</p>
  </div>
  <div class="tarjeta">
    <h2 class="rotulo">Cuándo cuenta el cambio</h2>
    <ul>
      <li>La comunidad es una sola para todo el año: la renta no se reparte por meses. Si te mudas a mitad de año, te corresponde aquella en la que hayas pasado más días.</li>
      <li>Por eso, quien se muda en la segunda mitad del año suele declarar ese ejercicio todavía en la comunidad de origen, y la nueva cuenta desde el año siguiente.</li>
      <li>Los cambios de residencia cuyo objetivo principal sea pagar menos no producen efecto (${lirpf("art. 72.3")}); en ese caso Hacienda puede exigir la diferencia con intereses.</li>
      <li>Cuando te mudes, actualiza tu domicilio fiscal en la Agencia Tributaria.</li>
    </ul>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Cuánto cambia el IRPF con ${euros(Number(S))} brutos (${C.ejercicio})</h2>
    <p class="ayuda">${esc(C.supuesto)}</p>
    ${tablaG(["Territorio", "Cuota líquida", "Tipo medio efectivo", "Diferencia con el más bajo"], filas)}
    <p>Con ${euros(Number(S))} brutos, la cuota va de ${eur(pri.cuota_liquida_total)} en ${esc(pri.nombre)} a ${eur(ult.cuota_liquida_total)} en ${esc(ult.nombre)}: ${difEuros(ult.cuota_liquida_total, pri.cuota_liquida_total)} al año. Solo entre comunidades de régimen común, de ${eur(cPri.cuota_liquida_total)} en ${esc(cPri.nombre)} a ${eur(cUlt.cuota_liquida_total)} en ${esc(cUlt.nombre)} (${difEuros(cUlt.cuota_liquida_total, cPri.cuota_liquida_total)}). En ${esc(mad.nombre)}, ${eur(mad.cuota_liquida_total)}.</p>
    <p>Estas cifras no incluyen deducciones autonómicas (alquiler, hijos, etc.), que pueden pesar más que la diferencia de escala. Compara con tus datos en la calculadora.</p>
  </div>
  <div class="tarjeta"><p>Otros sueldos: <a href="/comparar-sueldo/">dónde se paga menos IRPF con tu sueldo</a>. Tramos, mínimos y deducciones de cada comunidad: <a href="/irpf/">IRPF por territorio</a>.</p></div>
  ${cta("Compara tu IRPF entre territorios", HERRAMIENTA.comparar, ["Calcula tu IRPF", HERRAMIENTA.calculadora])}`;
  const faq = [
    ["¿En qué comunidad hago la renta si me he mudado?", "En la de tu residencia habitual en el año, que es donde hayas pasado más días del año natural (art. 72 de la Ley del IRPF). Toda la renta del año se declara en esa comunidad."],
    ["Si me mudo en diciembre, ¿declaro en la nueva comunidad?", "Normalmente no: si has pasado la mayor parte del año en la comunidad anterior, ese ejercicio se declara allí y la nueva cuenta desde el año siguiente."],
    ["¿Basta con empadronarme en otra comunidad?", "No. Cuenta dónde vives de verdad. El padrón es un indicio, y un cambio hecho para pagar menos no produce efecto."],
    [`¿Cuánto cambia el IRPF entre comunidades con ${euros(Number(S))}?`, `Con ${euros(Number(S))} brutos y el supuesto de la tabla, de ${eur(pri.cuota_liquida_total)} en ${pri.nombre} a ${eur(ult.cuota_liquida_total)} en ${ult.nombre} (ejercicio ${C.ejercicio}), sin contar deducciones autonómicas.`]
  ];
  return pagina(g, { slug: "cambiar-de-comunidad-irpf", h1: "Cambiar de comunidad: dónde haces la renta y cuánto cambia",
    titulo: "Cambiar de comunidad: en cuál haces la renta del IRPF",
    hub: `Declaras en la comunidad donde pasas más días del año. Con ${euros(Number(S))} brutos, la cuota va de ${eur(pri.cuota_liquida_total)} en ${pri.nombre} a ${eur(ult.cuota_liquida_total)} en ${ult.nombre}.`,
    resumen: `te corresponde la comunidad en la que pasas más días del año (art. 72 de la Ley del IRPF). Con ${euros(Number(S))} brutos, la cuota va de <b>${eur(pri.cuota_liquida_total)}</b> en ${esc(pri.nombre)} a <b>${eur(ult.cuota_liquida_total)}</b> en ${esc(ult.nombre)}.`,
    description: `Si te mudas, haces la renta en la comunidad donde pasas más días del año. Con 30.000 € el IRPF cambia hasta ${difEuros(ult.cuota_liquida_total, pri.cuota_liquida_total)} según el territorio.`,
    cuerpo, faq, generado: g.generado });
}

export const GUIAS = [
  { slug: "tramos-irpf-2025-2026", grupo: "tramos", enlace: "Tramos del IRPF 2025 y 2026", resumen: "Escala estatal, del ahorro y de cada territorio.", fn: guiaTramos },
  { slug: "escala-irpf-2024", grupo: "tramos", enlace: "Escala del IRPF 2024", resumen: "Tramos y tipos estatales de 2024, iguales que en 2025 y 2026.", fn: guiaEscala2024 },
  { slug: "minimo-personal-familiar", grupo: "rebajas", enlace: "Mínimo personal y familiar", resumen: "Cuánto de tu renta no paga IRPF por ti, tus hijos y tus mayores.", fn: guiaMinimo },
  { slug: "plan-pensiones-desgravar", grupo: "rebajas", enlace: "Plan de pensiones: cuánto desgrava", resumen: "Límites y ahorro real en cada territorio si aportas antes del 31 de diciembre.", fn: guiaPensiones },
  { slug: "deduccion-donativos", grupo: "rebajas", enlace: "Deducción por donativos", resumen: "Porcentajes, límites y ejemplos de lo que desgravan los donativos a ONG.", fn: guiaDonativos },
  { slug: "obligacion-declarar-renta", grupo: "declaracion", enlace: "¿Estoy obligado a declarar?", resumen: "Límites de ingresos y cuándo conviene declarar aunque no sea obligatorio.", fn: guiaObligacion },
  { slug: "calendario-renta", grupo: "declaracion", enlace: "Calendario de la renta", resumen: "Fechas de la campaña, domiciliación y pago en dos plazos.", fn: guiaCalendario },
  { slug: "12-o-14-pagas", grupo: "sueldo", enlace: "12 o 14 pagas", resumen: "Neto mensual con el mismo bruto, prorrata de las extras y retención.", fn: guiaPagas },
  { slug: "tipo-marginal-y-tipo-medio", grupo: "tramos", enlace: "Tipo marginal y tipo medio", resumen: "La diferencia, con ejemplos, y por qué cambiar de tramo no te hace cobrar menos.", fn: guiaMarginal },
  { slug: "cambiar-de-comunidad-irpf", grupo: "declaracion", enlace: "Cambiar de comunidad", resumen: "En qué comunidad haces la renta si te mudas y cuánto cambia el IRPF.", fn: guiaCambioComunidad }
];

// Grupos del índice /guias/, en este orden.
const GRUPOS_GUIAS = [["tramos", "Tramos y tipos del IRPF"], ["rebajas", "Mínimos, reducciones y deducciones"], ["declaracion", "La declaración de la renta"], ["sueldo", "Tu nómina"]];

export function paginasGuias(g, T) {
  const paginas = GUIAS.map(x => x.fn(g, T));
  const hub = Object.fromEntries(paginas.map(p => [p.slug, p.hub]));
  for (const x of GUIAS) if (!hub[x.slug]) throw new Error(`La guía ${x.slug} no tiene frase para el índice (hub)`);
  const migas = [["Inicio", "/"], ["Guías del IRPF", "/guias/"]];
  const grupos = GRUPOS_GUIAS.map(([id, titulo]) => {
    const lista = GUIAS.filter(x => x.grupo === id);
    return lista.length ? `<div class="tarjeta"><h2 class="rotulo">${esc(titulo)}</h2><ul class="lista-guias">${lista.map(x => `<li><a href="/guias/${x.slug}/">${esc(x.enlace)}</a><span>${esc(hub[x.slug])}</span></li>`).join("")}</ul></div>` : "";
  }).join("\n  ");
  const main = `
  <h1>Guías del IRPF</h1>
  <p class="entradilla">Lo esencial de la renta explicado con las cifras oficiales de cada año y su norma: tramos, mínimos, deducciones y fechas. Cada guía responde con la cifra exacta, sacada de los parámetros normativos y del motor de Mapafiscal, y enlaza con la calculadora para que lo apliques a tu caso.</p>
  <div class="prosa">
  ${grupos}
  <div class="tarjeta"><h2 class="rotulo">Vivienda</h2><p>Segunda vivienda, alquiler y venta en el IRPF, con ejemplos del motor: <a href="/vivienda/">cómo tributa la vivienda</a>.</p></div>
  <div class="tarjeta"><h2 class="rotulo">Por territorio</h2><p>Tramos, mínimo y deducciones de cada comunidad autónoma, del País Vasco y de Navarra: <a href="/irpf/">IRPF por territorio</a>. Y si quieres comparar: <a href="/comparar-sueldo/">dónde se paga menos IRPF con tu sueldo</a>.</p></div>
  ${cta("Calcula tu IRPF", HERRAMIENTA.calculadora, ["Calcula tu sueldo neto", HERRAMIENTA.sueldoNeto])}
  </div>`;
  const description = "Guías del IRPF con cifras oficiales: tramos 2025 y 2026, mínimo personal, cuánto desgrava un plan de pensiones, donativos, quién declara y fechas de la renta.";
  const salida = paginas.map(({ ruta, html }) => ({ ruta, html }));
  salida.push({ ruta: "/guias/", html: layout({
    title: "Guías del IRPF 2025 y 2026: tramos, pensiones, donativos y fechas", description,
    canonical: "/guias/", breadcrumb: migasHtml(migas), main, generado: g.generado, css: ["/css/guias.css"],
    jsonld: [jsonLdMigas(migas)] }) });
  return salida;
}
