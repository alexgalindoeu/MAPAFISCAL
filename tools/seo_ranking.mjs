// =============================================================================
// Ranking anual del IRPF por comunidades para la prensa (/ranking-irpf-comunidades/), al
// estilo de los estudios anuales de SmartAsset o del Steuerbelastungsmonitor de Zúrich:
// tabla de los 19 territorios con varios sueldos, mapa coloreado, cinco conclusiones con
// cifras, metodología, datos descargables con licencia CC BY 4.0 y sección para periodistas.
//
// Todas las cifras salen de web/datos/seo_comparativas.json (motor R de referencia, sueldos
// de `salarios_ranking`); el mapa, de web/datos/mapa_es.json. Aquí no se calcula ningún
// impuesto: solo se ordena, se resta y se maqueta. Lo llama tools/generar_paginas_seo.mjs,
// que también escribe los ficheros de datos (web/datos/ranking-irpf-<año>.csv y .json).
// =============================================================================
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { conArticulo } from "./seo_deduccion_ficha.mjs";
import { SITIO, SLUG, ORDEN_TERRITORIOS, esc, euros, eurosExactos, pct, layout, jsonLdMigas, migasHtml, respuestaDirecta, numeroCasos } from "./seo_comun.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSV = createRequire(import.meta.url)(join(RAIZ, "web", "js", "csv.js"));

export const RUTA_RANKING = "/ranking-irpf-comunidades/";
export const LICENCIA = { nombre: "Creative Commons Atribución 4.0 Internacional (CC BY 4.0)", corto: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/deed.es" };
export const CONTACTO = "contacto@mapafiscal.es";
export const ficheroDatos = (ejercicio, ext) => `datos/ranking-irpf-${ejercicio}.${ext}`;
// Dos cifras son la misma cuota si no se distinguen al céntimo.
const MISMO = 0.005;
const cent = n => Math.round(n * 100) / 100;
const listaY = xs => xs.length > 1 ? xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1] : xs[0];
const eurosSueldo = s => euros(s);
const ordinal = n => n + ".º";

// ---- datos ------------------------------------------------------------------------------
// { ejercicio, salarios, supuesto, generado, filas: [{ territorio, nombre, regimen, por: { <s>: { cuota, tipo, puesto } } }] }
// El puesto es compartido en los empates (1 + territorios con una cuota menor), como en el
// comparador de la web: Bizkaia, Gipuzkoa y Álava, con la misma tarifa, son todos 1.º.
export function datosRanking(comparativas, territorios) {
  const salarios = comparativas.salarios_ranking;
  if (!Array.isArray(salarios) || !salarios.length) throw new Error("seo_comparativas.json no trae salarios_ranking: regenéralo con Rscript tools/generar_datos_seo.R");
  const por = {};
  for (const s of salarios) {
    const lista = comparativas.comparativas[String(s)];
    if (!lista || lista.length !== ORDEN_TERRITORIOS.length) throw new Error(`seo_comparativas.json no trae los ${ORDEN_TERRITORIOS.length} territorios con ${s} €`);
    for (const f of lista) {
      const puesto = 1 + lista.filter(x => x.cuota_liquida_total < f.cuota_liquida_total - MISMO).length;
      (por[f.territorio] = por[f.territorio] || { nombre: f.nombre, por: {} }).por[s] = { cuota: f.cuota_liquida_total, tipo: f.tipo_medio_efectivo, puesto };
    }
  }
  const ref = salarios.includes(30000) ? 30000 : salarios[0];
  const filas = ORDEN_TERRITORIOS.map(t => ({ territorio: t, nombre: por[t].nombre, regimen: territorios.territorios[t].regimen, por: por[t].por }))
    .sort((a, b) => a.por[ref].cuota - b.por[ref].cuota || ORDEN_TERRITORIOS.indexOf(a.territorio) - ORDEN_TERRITORIOS.indexOf(b.territorio));
  return { ejercicio: comparativas.ejercicio, generado: comparativas.generado, supuesto: comparativas.supuesto, salarios, referencia: ref, filas };
}

// Más baratos y más caros (con sus empates) con un sueldo.
function extremos(d, s) {
  const c = d.filas.map(f => f.por[s].cuota), min = Math.min(...c), max = Math.max(...c);
  const de = v => d.filas.filter(f => Math.abs(f.por[s].cuota - v) < MISMO);
  return { min, max, baratos: de(min), caros: de(max), dif: cent(max - min) };
}
// «la Comunidad de Madrid», «Extremadura», «Bizkaia»: con artículo donde lo lleva.
const conEl = f => f.regimen === "comun" ? conArticulo(f.nombre) : f.nombre;
const nombres = fs => listaY(fs.map(conEl));
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
const NUMEROS = ["cero", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
const enLetra = n => NUMEROS[n] || String(n);

// ---- las cinco conclusiones --------------------------------------------------------------
// Frases con cifras exactas (al céntimo) que se recalculan solas cada año.
export function conclusiones(d) {
  const S = d.salarios, ext = Object.fromEntries(S.map(s => [s, extremos(d, s)]));
  const out = [];

  // 1) Quién encabeza el ranking con todos los sueldos.
  const siempre = d.filas.filter(f => S.every(s => ext[s].baratos.includes(f)));
  if (siempre.length) {
    const igual = siempre.length > 1;
    out.push({ clave: "lider", texto: `${capital(nombres(siempre))} ${igual ? "son los territorios" : "es el territorio"} donde menos IRPF se paga con los ${enLetra(S.length)} sueldos${igual ? ", con la misma cuota" : ""}: de ${eurosExactos(ext[S[0]].min)} con ${eurosSueldo(S[0])} a ${eurosExactos(ext[S.at(-1)].min)} con ${eurosSueldo(S.at(-1))}.` });
  } else {
    out.push({ clave: "lider", texto: `El territorio más barato cambia con el sueldo: ${S.map(s => `${nombres(ext[s].baratos)} con ${eurosSueldo(s)} (${eurosExactos(ext[s].min)})`).join("; ")}.` });
  }

  // 2) La diferencia con el sueldo de referencia.
  const r = d.referencia, er = ext[r];
  out.push({ clave: "diferencia", texto: `Con ${eurosSueldo(r)} brutos hay ${eurosExactos(er.dif)} de diferencia al año entre ${nombres(er.baratos)} (${eurosExactos(er.min)}) y ${nombres(er.caros)} (${eurosExactos(er.max)}), ${er.caros.length > 1 ? "los territorios más caros" : "el territorio más caro"}.` });

  // 3) La distancia entre el más barato y el más caro, sueldo a sueldo.
  const sMax = S.reduce((a, s) => ext[s].dif > ext[a].dif ? s : a, S[0]);
  out.push({ clave: "brecha", texto: `La distancia entre el territorio más barato y el más caro es de ${listaY(S.map(s => `${eurosExactos(ext[s].dif)} con ${eurosSueldo(s)}`))}. La mayor, con ${eurosSueldo(sMax)}: en ${nombres(ext[sMax].caros)} se pagan ${eurosExactos(ext[sMax].dif)} más al año que en ${nombres(ext[sMax].baratos)}.` });

  // 4) La comunidad de régimen común más barata con cada sueldo.
  const comunes = d.filas.filter(f => f.regimen === "comun");
  const grupos = [];
  for (const s of S) {
    const min = Math.min(...comunes.map(f => f.por[s].cuota));
    const mejores = comunes.filter(f => Math.abs(f.por[s].cuota - min) < MISMO);
    const clave = mejores.map(f => f.territorio).join("+");
    const g = grupos.find(x => x.clave === clave);
    const item = `${eurosSueldo(s)} (${eurosExactos(min)})`;
    if (g) g.items.push(item); else grupos.push({ clave, nombre: nombres(mejores), items: [item] });
  }
  out.push({ clave: "comun", texto: `Entre las ${comunes.length} comunidades de régimen común, la más barata es ${listaY(grupos.map(g => `${g.nombre} con ${listaY(g.items)}`))}.` });

  // 5) El territorio que más puestos cambia según el sueldo.
  let mov = null;
  for (const f of d.filas) {
    const ps = S.map(s => f.por[s].puesto), salto = Math.max(...ps) - Math.min(...ps);
    if (!mov || salto > mov.salto) mov = { f, salto, min: Math.min(...ps), max: Math.max(...ps) };
  }
  const con = p => listaY(S.filter(s => mov.f.por[s].puesto === p).map(eurosSueldo));
  const n = d.filas.length;
  out.push({ clave: "movimiento", texto: `${capital(conEl(mov.f))} es el territorio que más puestos cambia con el sueldo: es el ${ordinal(mov.min)} más barato con ${con(mov.min)} y el ${ordinal(mov.max)} de ${n}${mov.max === n ? " (el más caro)" : ""} con ${con(mov.max)}, ${mov.salto} puestos de diferencia.` });
  return out;
}

// ---- ficheros de datos --------------------------------------------------------------------
const REGIMEN = { comun: "común", foral_pais_vasco: "foral (País Vasco)", foral_navarra: "foral (Navarra)" };
const filasLargas = d => d.salarios.flatMap(s => d.filas.slice().sort((a, b) => a.por[s].cuota - b.por[s].cuota || ORDEN_TERRITORIOS.indexOf(a.territorio) - ORDEN_TERRITORIOS.indexOf(b.territorio))
  .map(f => ({ s, f, x: f.por[s] })));
// CSV para Excel en español (web/js/csv.js): «;», coma decimal y UTF-8 con BOM.
export function csvRanking(d) {
  return CSV.aCsv([["ejercicio", "sueldo_bruto_anual", "puesto", "codigo", "territorio", "regimen", "cuota_irpf_euros", "tipo_medio_pct"]]
    .concat(filasLargas(d).map(({ s, f, x }) => [d.ejercicio, s, x.puesto, f.territorio, f.nombre, REGIMEN[f.regimen] || f.regimen, CSV.numero(x.cuota, 2), CSV.numero(100 * x.tipo, 2)])));
}
export function jsonRanking(d) {
  return JSON.stringify({
    titulo: `Ranking IRPF por comunidades ${d.ejercicio}`,
    ejercicio: d.ejercicio, generado: d.generado,
    fuente: `Mapafiscal (${SITIO}${RUTA_RANKING})`,
    licencia: { nombre: LICENCIA.nombre, url: LICENCIA.url },
    supuesto: d.supuesto,
    campos: { cuota_liquida_total: "cuota líquida del IRPF del año, en euros", tipo_medio_efectivo: "cuota líquida entre el sueldo bruto (0,109 = 10,9 %)", puesto: "de menos a más IRPF; los empates comparten puesto" },
    salarios: d.salarios,
    datos: filasLargas(d).map(({ s, f, x }) => ({ sueldo_bruto_anual: s, puesto: x.puesto, codigo: f.territorio, territorio: f.nombre, regimen: f.regimen, cuota_liquida_total: x.cuota, tipo_medio_efectivo: x.tipo }))
  }, null, 1) + "\n";
}

// ---- mapa coloreado (SVG en el servidor) ----------------------------------------------------
// Verde si se paga menos que la media de los 19 con ese sueldo, rojo si más; tres intensidades.
// Sin <title> dentro del SVG (la página solo lleva uno, el del documento): cada territorio es un
// enlace a su página con su cifra en aria-label, y la tabla de debajo da todas las cifras.
const PASOS = ["--m-g3", "--m-g2", "--m-g1", "--m-0", "--m-r1", "--m-r2", "--m-r3"];
function mapaSvg(d, mapa, s) {
  const media = d.filas.reduce((a, f) => a + f.por[s].cuota, 0) / d.filas.length;
  const maxAbs = Math.max(...d.filas.map(f => Math.abs(f.por[s].cuota - media))) || 1;
  const color = v => {
    const dd = v - media;
    if (Math.abs(dd) < 0.5) return "--m-0";
    const k = Math.min(3, Math.ceil(Math.abs(dd) / maxAbs * 3));
    return dd < 0 ? `--m-g${k}` : `--m-r${k}`;
  };
  const porT = Object.fromEntries(d.filas.map(f => [f.territorio, f]));
  let h = "";
  for (const t of Object.keys(mapa.territorios)) {
    const f = porT[t]; if (!f) continue;
    const x = f.por[s], et = `${f.nombre}: ${eurosExactos(x.cuota)} (${ordinal(x.puesto)} de ${d.filas.length})`;
    h += `<a href="/irpf/${SLUG[t]}/" aria-label="${esc(et)}"><path class="terr" data-t="${t}" d="${mapa.territorios[t]}" fill="var(${color(x.cuota)})"/></a>`;
  }
  h += `<path class="fronteras" d="${mapa.fronteras}"/><path class="recuadro" d="${mapa.recuadroCanarias}"/>`;
  const leyenda = `<div class="leyenda"><span class="leyenda-grupo">Menos IRPF que la media<span class="leyenda-rampa">${PASOS.map(p => `<span style="background:var(${p})"></span>`).join("")}</span>Más</span></div>`;
  return { media, html: `<svg class="mapa-svg ranking-mapa" viewBox="${mapa.viewBox.join(" ")}" role="group" aria-label="Mapa del IRPF con ${esc(eurosSueldo(s))} brutos por territorio fiscal, ${d.ejercicio}">${h}</svg>${leyenda}` };
}

// ---- página -----------------------------------------------------------------------------------
export function paginaRanking({ comparativas, territorios, generado }) {
  const d = datosRanking(comparativas, territorios);
  const mapa = JSON.parse(readFileSync(join(RAIZ, "web", "datos", "mapa_es.json"), "utf8"));
  const S = d.salarios, r = d.referencia, er = extremos(d, r), ej = d.ejercicio;
  const concl = conclusiones(d);
  const m = mapaSvg(d, mapa, r);
  const csv = "/" + ficheroDatos(ej, "csv"), json = "/" + ficheroDatos(ej, "json");
  const titulo = `Ranking IRPF por comunidades ${ej}: dónde se paga menos`;
  const descripcion = `Ranking del IRPF ${ej} en los 19 territorios con ${listaY(S.map(s => euros(s).replace(" €", "")))} €: cuota, tipo medio, mapa y datos en CSV y JSON (CC BY 4.0).`;
  const migas = [["Inicio", "/"], ["Dónde se paga menos IRPF", "/comparar-sueldo/"], [`Ranking ${ej}`, RUTA_RANKING]];
  const cab = S.map(s => `<th scope="colgroup" colspan="3" class="num">${esc(eurosSueldo(s))}</th>`).join("");
  const sub = S.map(() => `<th scope="col" class="num">Puesto</th><th scope="col" class="num">Cuota</th><th scope="col" class="num">Tipo medio</th>`).join("");
  const filas = d.filas.map(f => `<tr><th scope="row"><a href="/irpf/${SLUG[f.territorio]}/">${esc(f.nombre)}</a>${f.regimen !== "comun" ? ' <span class="regimen">foral</span>' : ""}</th>${S.map(s => { const x = f.por[s];
    return `<td class="num">${ordinal(x.puesto)}</td><td class="num">${esc(eurosExactos(x.cuota))}</td><td class="num">${esc(pct(x.tipo))}</td>`; }).join("")}</tr>`).join("");
  const cita = `Mapafiscal, «Ranking IRPF por comunidades ${ej}», ${SITIO}${RUTA_RANKING}`;
  const main = `
  <h1>Ranking del IRPF por comunidades ${ej}: dónde se paga menos</h1>
  ${respuestaDirecta(`con ${esc(eurosSueldo(r))} brutos al año, el IRPF de ${ej} va de <b>${esc(eurosExactos(er.min))}</b> en ${esc(nombres(er.baratos))} a <b>${esc(eurosExactos(er.max))}</b> en ${esc(nombres(er.caros))}: ${esc(eurosExactos(er.dif))} de diferencia por vivir en un territorio u otro.`)}
  <p class="entradilla">Estudio anual de Mapafiscal: el IRPF de los 19 territorios fiscales de España (15 comunidades de régimen común, los tres territorios forales del País Vasco y Navarra) con ${listaY(S.map(eurosSueldo))} brutos al año, para la misma persona. Datos abiertos, con licencia ${LICENCIA.corto}.</p>
  <div class="prosa">
  <div class="tarjeta" id="conclusiones">
    <h2 class="rotulo">Las cinco conclusiones</h2>
    <ol class="ranking-conclusiones">${concl.map(c => `<li data-clave="${c.clave}">${esc(c.texto)}</li>`).join("")}</ol>
  </div>
  <figure class="tarjeta ranking-figura" id="mapa">
    <h2 class="rotulo">Mapa: el IRPF con ${esc(eurosSueldo(r))} frente a la media</h2>
    ${m.html}
    <figcaption class="ayuda">Cuota del IRPF con ${esc(eurosSueldo(r))} brutos en ${ej}, frente a la media de los ${d.filas.length} territorios (${esc(eurosExactos(cent(m.media)))}). Canarias, en el recuadro. Las cifras de cada territorio están en la tabla.</figcaption>
  </figure>
  <div class="tarjeta tarjeta-tabla" id="tabla">
    <h2 class="rotulo">Los 19 territorios con ${esc(listaY(S.map(eurosSueldo)))}</h2>
    <div class="envoltorio" tabindex="0" role="region" aria-labelledby="ranking-tabla-tit"><table class="cobertura ranking-tabla"><caption id="ranking-tabla-tit">IRPF ${ej} por territorio y sueldo bruto anual: puesto (de menos a más IRPF), cuota líquida y tipo medio efectivo. Ordenado por la cuota con ${esc(eurosSueldo(r))}.</caption>
    <thead><tr><th scope="col" rowspan="2">Territorio</th>${cab}</tr><tr>${sub}</tr></thead><tbody>${filas}</tbody></table></div>
    <p class="ayuda">Los territorios con la misma cuota comparten puesto. Tipo medio efectivo: cuota líquida entre el sueldo bruto.</p>
  </div>
  <div class="tarjeta" id="metodologia">
    <h2 class="rotulo">Metodología</h2>
    <p>${esc(d.supuesto)}</p>
    <p>Cada cifra es una liquidación completa del IRPF ${ej} con el motor de referencia de Mapafiscal, con los parámetros de la Ley del IRPF, las leyes autonómicas y las normas forales, cada uno con su norma y su fuente oficial. La cuota es la cuota líquida total (estatal más autonómica, o foral). La calculadora de la web usa el mismo motor, comprobado al céntimo con ${numeroCasos()} casos.</p>
    <p><a href="/metodologia/">Cómo calculamos el IRPF</a> · <a href="/validacion/">Cómo comprobamos los cálculos</a> · <a href="/comparar-sueldo/">Comparativas con otros sueldos</a></p>
  </div>
  <div class="tarjeta" id="datos">
    <h2 class="rotulo">Datos descargables</h2>
    <p>El ranking completo (${d.filas.length} territorios × ${S.length} sueldos), con el puesto, la cuota y el tipo medio:</p>
    <p><a class="btn btn-pri" href="${csv}" download>Descargar CSV</a> <a class="btn btn-sec" href="${json}" download>Descargar JSON</a></p>
    <p class="ayuda">CSV para Excel en español: separador «;», coma decimal y UTF-8. El JSON lleva los mismos datos con punto decimal y la descripción de cada campo.</p>
    <p>Licencia: <a href="${LICENCIA.url}" rel="license noopener">${esc(LICENCIA.nombre)}</a>. Puedes copiar, redistribuir y adaptar los datos, también con fines comerciales, siempre que cites a Mapafiscal como fuente.</p>
  </div>
  <div class="tarjeta" id="periodistas">
    <h2 class="rotulo">Para periodistas</h2>
    <p>Puedes publicar las cifras, la tabla y el mapa citando la fuente. Cómo citarlo:</p>
    <blockquote class="ranking-cita"><p>${esc(cita)}</p></blockquote>
    <p>En prensa, basta con «según Mapafiscal» y un enlace a esta página. Si necesitas otro sueldo, otra situación familiar (hijos, declaración conjunta) o el detalle de un territorio, escríbenos a <a href="mailto:${CONTACTO}">${CONTACTO}</a>. Con tu propia situación, usa la <a href="/index.html#comparar">calculadora del comparador</a>.</p>
  </div>
  </div>`;
  const dataset = {
    "@context": "https://schema.org", "@type": "Dataset",
    name: `Ranking IRPF por comunidades ${ej}`, description: `IRPF ${ej} de los 19 territorios fiscales de España con ${listaY(S.map(eurosSueldo))} brutos al año: puesto, cuota líquida y tipo medio efectivo. ${d.supuesto}`,
    url: SITIO + RUTA_RANKING, inLanguage: "es", dateModified: d.generado, isAccessibleForFree: true,
    license: "https://creativecommons.org/licenses/by/4.0/",
    creator: { "@id": SITIO + "/#organizacion" }, publisher: { "@id": SITIO + "/#organizacion" },
    spatialCoverage: { "@type": "Place", name: "España" }, temporalCoverage: String(ej),
    keywords: ["IRPF", "comunidades autónomas", "impuestos", "ranking", String(ej)],
    variableMeasured: ["cuota líquida del IRPF (euros)", "tipo medio efectivo (%)", "puesto"],
    distribution: [
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: SITIO + csv },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: SITIO + json }
    ]
  };
  return {
    datos: d, conclusiones: concl,
    ficheros: { [ficheroDatos(ej, "csv")]: csvRanking(d), [ficheroDatos(ej, "json")]: jsonRanking(d) },
    html: layout({
      title: titulo, description: descripcion, canonical: RUTA_RANKING, breadcrumb: migasHtml(migas), main, generado,
      jsonld: [jsonLdMigas(migas), dataset]
    })
  };
}
