// =============================================================================
// Piezas comunes de las páginas estáticas SEO (territorios, sueldos, deducciones y
// guías): formato de cifras, citas de fuentes, datos estructurados y la maqueta.
// Las usan tools/generar_paginas_seo.mjs, tools/seo_deducciones.mjs y tools/seo_guias.mjs.
// =============================================================================

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SITIO = "https://mapafiscal.es";

// Piezas de interfaz comunes con la aplicación (web/js/ui.js): script del tema en el <head>,
// botones de la barra y redes del pie. Las redes salen de `redes` en web/config.js.
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
export const UI = createRequire(import.meta.url)("../web/js/ui.js");
export function configWeb() {
  const window = {};
  new Function("window", readFileSync(join(WEB, "config.js"), "utf8"))(window);
  return window.MAPAFISCAL_CONFIG || {};
}
const REDES_HTML = UI.htmlRedes(configWeb().redes);

// ---- slugs (solo para la URL; el nombre mostrado sale siempre de los datos) ----
export const SLUG = {
  "ES-AN": "andalucia", "ES-AR": "aragon", "ES-AS": "asturias", "ES-IB": "islas-baleares",
  "ES-CN": "canarias", "ES-CB": "cantabria", "ES-CM": "castilla-la-mancha", "ES-CL": "castilla-y-leon",
  "ES-CT": "cataluna", "ES-EX": "extremadura", "ES-GA": "galicia", "ES-MD": "madrid",
  "ES-MC": "murcia", "ES-RI": "la-rioja", "ES-VC": "comunidad-valenciana",
  "ES-PV-BI": "bizkaia", "ES-PV-SS": "gipuzkoa", "ES-PV-VI": "araba-alava", "ES-NC": "navarra"
};
export const ORDEN_TERRITORIOS = Object.keys(SLUG); // orden estable, el de params.json

// Nombre como lo busca la gente, para <title> y descripciones (donde cada carácter cuenta).
// En el cuerpo de la página se usa el nombre oficial, que sale de los datos.
export const NOMBRE_CORTO = {
  "ES-AN": "Andalucía", "ES-AR": "Aragón", "ES-AS": "Asturias", "ES-IB": "Baleares",
  "ES-CN": "Canarias", "ES-CB": "Cantabria", "ES-CM": "Castilla-La Mancha", "ES-CL": "Castilla y León",
  "ES-CT": "Cataluña", "ES-EX": "Extremadura", "ES-GA": "Galicia", "ES-MD": "Madrid",
  "ES-MC": "Murcia", "ES-RI": "La Rioja", "ES-VC": "Comunidad Valenciana",
  "ES-PV-BI": "Bizkaia", "ES-PV-SS": "Gipuzkoa", "ES-PV-VI": "Álava", "ES-NC": "Navarra"
};
// Límites orientativos de lo que Google muestra sin cortar.
export const MAX_TITULO = 60, MAX_DESCRIPCION = 155;
// El sufijo « | Mapafiscal» solo se añade si cabe: Google ya muestra el nombre del sitio.
export function tituloFinal(t) {
  const base = String(t).replace(/ \| Mapafiscal$/, "");
  return base.length + 13 <= MAX_TITULO ? base + " | Mapafiscal" : base;
}

// Límite que comprueba test/seo_paginas.test.mjs. Devuelve la primera variante que cabe.
export const MAX_TITULO_DURO = 65;
export function tituloQueQuepa(...variantes) {
  return variantes.find(v => v.length <= MAX_TITULO_DURO) ?? variantes[variantes.length - 1];
}

// Herramientas de la web principal (aplicación de una sola página).
export const HERRAMIENTA = {
  calculadora: "/index.html#calculadora",
  comparar: "/index.html#comparar",
  sueldoNeto: "/index.html#sueldo-neto",
  planPensiones: "/index.html#plan-pensiones"
};

// ---- formato --------------------------------------------------------------------
// Mismo formato que web/js/app.js (miles/eur/pct): así las cifras se ven igual en toda
// la web, en vez de depender del redondeo de agrupación de Intl.NumberFormat con es-ES
// (que en Node no agrupa los millares de 4 cifras, p. ej. "5550" en vez de "5.550").
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// De HTML a texto plano (para el JSON-LD de las preguntas): sin etiquetas y con las entidades de
// esc() deshechas, de modo que el texto del FAQPage es el mismo que se lee en la página.
export const textoPlano = s => String(s).replace(/<[^>]+>/g, "")
  .replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
export const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const euros = n => miles(String(Math.round(n))) + " €";
// Diferencia entre dos cifras que se muestran redondeadas: se restan las cifras que se ven,
// para que la cuenta cuadre al leerla (553 € y no 552 € por los céntimos de cada una).
export const difEuros = (a, b) => euros(Math.round(a) - Math.round(b));
// Con céntimos solo si los hay: 463,95 € / 1.500 €.
export function eurosExactos(n) {
  const c = Math.round(n * 100);
  if (c % 100 === 0) return miles(String(c / 100)) + " €";
  const [e, d] = (c / 100).toFixed(2).split(".");
  return miles(e) + "," + d + " €";
}
export const pct = n => (100 * n).toFixed(1).replace(".", ",") + " %";
// Porcentaje sin decimales sobrantes: 15 %, 9,5 %, 25,5 %.
export const pctCorto = n => String(Math.round(n * 10000) / 100).replace(".", ",") + " %";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function fecha(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

// ---- fuentes ----------------------------------------------------------------------
export const urlBoe = id => `https://www.boe.es/buscar/doc.php?id=${id}`;
export const LIRPF_BOE = "https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764";

export function citaFuente(f) {
  if (!f) return "";
  return `<p class="ayuda">Norma: ${esc(f.norma)}.${f.fuente ? ` Fuente: ${esc(f.fuente)}.` : ""}</p>`;
}

// Enlaces BOE-A-… que aparezcan en un texto de fuente.
export function enlacesBoe(texto) {
  const ids = [...new Set(String(texto || "").match(/BOE-A-\d{4}-\d+/g) || [])];
  return ids.map(id => `<a href="${urlBoe(id)}" rel="noopener">${id}</a>`);
}

export function tablaEscala(tramos, cab = "Tramo de la base liquidable general") {
  const filas = tramos.map((t, i) => {
    let tramo;
    if (i === 0) tramo = "Hasta " + euros(t.hasta);
    else if (t.hasta == null) tramo = "Desde " + euros(tramos[i - 1].hasta);
    else tramo = "De " + euros(tramos[i - 1].hasta) + " a " + euros(t.hasta);
    return `<tr><td>${esc(tramo)}</td><td class="num">${esc(pct(t.tipo))}</td></tr>`;
  });
  return `<table class="cobertura"><thead><tr><th>${esc(cab)}</th><th class="num">Tipo marginal</th></tr></thead><tbody>${filas.join("")}</tbody></table>`;
}

// Suma dos escalas marginales tramo a tramo (p. ej. estatal + autonómica del ahorro).
export function combinarEscalas(a, b) {
  const tipoEn = (tr, x) => { for (const t of tr) if (t.hasta == null || x <= t.hasta) return t.tipo; return tr[tr.length - 1].tipo; };
  const cotas = [...new Set([...a, ...b].map(t => t.hasta == null ? Infinity : t.hasta))].sort((x, y) => x - y);
  return cotas.map(c => ({ hasta: c === Infinity ? null : c, tipo: Math.round((tipoEn(a, c) + tipoEn(b, c)) * 10000) / 10000 }));
}

// ---- datos estructurados -------------------------------------------------------------
export function jsonLdMigas(migas) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: migas.map(([nombre, ruta], i) => Object.assign(
      { "@type": "ListItem", position: i + 1, name: nombre }, ruta ? { item: SITIO + ruta } : {}))
  };
}
// ---- fecha de cambio del contenido -------------------------------------------------
// Cada página dice cuándo cambió de verdad su contenido (no cuándo se regeneraron los datos).
// La maqueta escribe estas marcas y tools/generar_paginas_seo.mjs las sustituye por la fecha
// guardada en web/datos/seo_fechas.json para el hash del contenido (ver fecharContenido).
export const MARCA_FECHA = "@@FECHA_CONTENIDO@@", MARCA_FECHA_LARGA = "@@FECHA_CONTENIDO_LARGA@@";
// Hash del contenido sin las fechas que no son contenido: las marcas de arriba y las fechas de
// generación de los datos (`generados`, ISO), que cambian cada vez que se exportan aunque no
// cambie ninguna cifra.
// Solo cuenta lo que lee la persona: <title>, descripción y <main> (si los hay). Cambiar la
// cabecera, el pie o los metadatos comunes no cambia la fecha de ninguna página.
export function hashContenido(html, generados = []) {
  const main = html.match(/<main[\s\S]*<\/main>/);
  let s = main ? [html.match(/<title>[\s\S]*?<\/title>/)?.[0], html.match(/<meta name="description"[^>]*>/)?.[0], main[0]].join("\n") : html;
  for (const g of new Set(generados)) s = s.split(g).join("@@GENERADO@@").split(fecha(g)).join("@@GENERADO@@");
  // Ni el cálculo rápido (es una herramienta, igual en todas las páginas).
  s = s.replace(CALCULO_RAPIDO, "");
  // Los huecos de anuncios no son contenido: no mueven la fecha.
  s = s.replace(/<div class="tarjeta anuncio anuncio-seo"[^>]*><span class="anuncio-etiqueta">Anuncios<\/span><\/div>\s*/g, "");
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}
// Sustituye las marcas de cada HTML por la fecha guardada si su hash no ha cambiado, o por `hoy`
// si es nuevo o cambió (`previa(ruta)` puede dar una fecha mejor para páginas nuevas). Devuelve
// el registro nuevo, ordenado por ruta, para que el JSON sea estable.
export function fecharContenido(ficheros, registro, { generados, hoy, previa = () => null }) {
  const nuevo = {};
  for (const r of [...ficheros.keys()].filter(k => k.endsWith(".html")).sort()) {
    const html = ficheros.get(r), hash = hashContenido(html, generados);
    const antes = registro[r];
    const f = antes && antes.hash === hash ? antes.fecha : (!antes && previa(r)) || hoy;
    nuevo[r] = { hash, fecha: f };
    ficheros.set(r, html.split(MARCA_FECHA_LARGA).join(fecha(f)).split(MARCA_FECHA).join(f));
  }
  return nuevo;
}

// Organización editora: va en todas las páginas (mismo @id que en la portada).
export const ORGANIZACION = {
  "@context": "https://schema.org", "@type": "Organization", "@id": SITIO + "/#organizacion",
  name: "Mapafiscal", url: SITIO + "/", logo: SITIO + "/iconos/icono-512.png"
};

export function jsonLdArticulo({ titulo, descripcion, ruta, generado }) {
  return {
    "@context": "https://schema.org", "@type": "Article", headline: titulo, description: descripcion,
    inLanguage: "es", mainEntityOfPage: SITIO + ruta, dateModified: MARCA_FECHA,
    author: { "@id": SITIO + "/#organizacion" },
    publisher: { "@id": SITIO + "/#organizacion" }
  };
}
// Tabla de datos con su fuente oficial (escalas, importes): ayuda a que buscadores y
// asistentes la citen como fuente. `fuentes`: textos de norma/fuente; se enlazan los BOE.
// `conLirpf: false` en las tarifas forales, que no salen de la Ley 35/2006 sino de la norma foral
// del territorio; `periodo`: ejercicios que cubre la tabla (p. ej. «2025/2026»).
export function jsonLdDataset({ nombre, descripcion, ruta, generado, fuentes = [], ambito = "España", conLirpf = true, periodo = null }) {
  const ids = [...new Set(fuentes.join(" ").match(/BOE-A-\d{4}-\d+/g) || [])];
  return Object.assign({
    "@context": "https://schema.org", "@type": "Dataset", name: nombre, description: descripcion,
    url: SITIO + ruta, inLanguage: "es", dateModified: generado, isAccessibleForFree: true,
    license: SITIO + "/legal/condiciones.html", spatialCoverage: { "@type": "Place", name: ambito }
  }, periodo ? { temporalCoverage: periodo } : {}, {
    creator: { "@type": "Organization", name: "Mapafiscal", url: SITIO + "/" },
    citation: [...new Set(fuentes.filter(Boolean))].concat(ids.map(urlBoe), conLirpf ? [LIRPF_BOE] : []).filter((x, i, a) => a.indexOf(x) === i)
  });
}
// Respuesta directa al principio de la página (una frase con la cifra) y fecha visible.
export function respuestaDirecta(html) {
  return `<p class="respuesta-directa"><b>En resumen:</b> ${html}</p>`;
}
// ---- cálculo rápido ------------------------------------------------------------------
// Bloque con el sueldo bruto, el territorio y las pagas que web/js/calculo-rapido.js convierte en
// una calculadora real (irpfsim.sueldoNeto) al acercarse a la pantalla. Va justo tras la
// respuesta directa; la maqueta añade el script (defer) a las páginas que lo llevan. No es
// contenido de la página: hashContenido() lo ignora y no mueve la fecha de «Actualizado».
export function bloqueCalculoRapido({ territorio = "ES-MD", ejercicio = EJERCICIO.valor, bruto = 30000,
  titulo = "Calcula tu sueldo neto y tu IRPF", nota = "" } = {}) {
  const opciones = ORDEN_TERRITORIOS.map(t => `<option value="${t}"${t === territorio ? " selected" : ""}>${esc(NOMBRE_CORTO[t])}</option>`).join("");
  const href = `/index.html#calculadora?t=${territorio}&bruto=${bruto}${ejercicio ? `&ejercicio=${ejercicio}` : ""}`;
  return `<section class="calc-rapido" id="calculo-rapido" aria-labelledby="cr-titulo" data-calculo-rapido data-territorio="${esc(territorio)}"${ejercicio ? ` data-ejercicio="${esc(ejercicio)}"` : ""}>
    <h2 class="rotulo" id="cr-titulo">${esc(titulo)}</h2>
    <form class="cr-form" autocomplete="off" novalidate aria-label="Cálculo rápido del sueldo neto">
      <div class="campo cr-bruto"><label for="cr-bruto">Sueldo bruto anual</label><div class="con-sufijo"><input type="text" id="cr-bruto" data-importe data-max="10000000" inputmode="decimal" value="${esc(bruto)}"><span>€</span></div></div>
      <div class="campo cr-terr"><label for="cr-territorio">Dónde vives</label><select id="cr-territorio">${opciones}</select></div>
      <fieldset class="cr-pagas"><legend>Pagas al año</legend><label><input type="radio" name="cr-pagas" value="12"> 12</label><label><input type="radio" name="cr-pagas" value="14" checked> 14</label></fieldset>
    </form>
    <div class="cr-res" id="cr-res" aria-live="polite"><p class="cr-espera">Escribe tu sueldo bruto: el neto, la Seguridad Social y el IRPF salen al momento.</p></div>
    <p class="cr-afinar"><a id="cr-afinar" href="${esc(href)}">Afinar con tu familia y deducciones <span aria-hidden="true">→</span></a></p>
    <p class="ayuda cr-supuesto">Estimación${ejercicio ? ` del ejercicio ${esc(ejercicio)}` : ""} para una persona de 40 años, sin hijos y con contrato indefinido: sueldo neto tras la declaración de la renta, con las cotizaciones del ejercicio. Tipo medio: IRPF entre la base imponible; tipo marginal: el del último euro.${nota ? " " + esc(nota) : ""} El cálculo se hace en tu navegador.</p>
  </section>`;
}
const CALCULO_RAPIDO = /<section class="calc-rapido"[\s\S]*?<\/section>\s*/g;

// preguntas: [[pregunta, respuesta en texto plano]]
export function jsonLdFaq(preguntas) {
  return {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: preguntas.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }))
  };
}
export function bloqueFaq(preguntas) {
  return `<div class="tarjeta faq"><h2 class="rotulo">Preguntas frecuentes</h2>${preguntas.map(([q, a]) =>
    `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`;
}
// Migas visibles a partir de la misma lista que el JSON-LD.
export function migasHtml(migas) {
  return migas.map(([n, r], i) => i < migas.length - 1 && r ? `<a href="${r}">${esc(n)}</a>` : esc(n)).join(" › ");
}

// Ejercicio por defecto del pie (el de los datos SEO); las páginas de otro ejercicio lo pasan.
export const EJERCICIO = { valor: null };

// ---- anuncios ---------------------------------------------------------------------
// Las páginas informativas llevan anuncios con el mismo sistema que la aplicación
// (web/js/anuncios.js + web/config.js: consentimiento, carga diferida, nada para quien tiene
// plan, espacio reservado). Aquí solo se colocan los huecos; el script decide si se llenan.
export const RUTAS_CON_ANUNCIOS = [/^\/guias\//, /^\/vivienda\//, /^\/irpf\//, /^\/sueldo-neto\//, /^\/comparar-sueldo\//,
  /^\/cuanto-me-devuelve\//, /^\/declaracion-conjunta\//, /^\/dos-pagadores\//, /^\/rescate-plan-pensiones\//, /^\/autonomos\//];
export const conAnuncios = ruta => RUTAS_CON_ANUNCIOS.some(r => r.test(ruta));

const huecoSeo = pos => `<div class="tarjeta anuncio anuncio-seo" id="anuncio-seo-${pos}" data-anuncio-seo="${pos}" hidden>` +
  `<span class="anuncio-etiqueta">Anuncios</span></div>`;
export const CARRILES_HTML = `<aside class="anuncio-carril anuncio-carril-izq" id="anuncio-rail-izq" aria-label="Anuncios (izquierda)" hidden>
  <span class="anuncio-etiqueta">Anuncios</span>
</aside>
<aside class="anuncio-carril anuncio-carril-der" id="anuncio-rail-der" aria-label="Anuncios (derecha)" hidden>
  <span class="anuncio-etiqueta">Anuncios</span>
</aside>`;

// Posiciones de los bloques hijos directos del primer <div class="prosa"> (las tarjetas).
function bloquesProsa(main) {
  const ini = main.indexOf('<div class="prosa"');
  if (ini < 0) return [];
  const re = /<(\/?)div\b[^>]*>/g;
  re.lastIndex = main.indexOf(">", ini) + 1;
  const bloques = [];
  let d = 1, m;
  while (d > 0 && (m = re.exec(main))) {
    if (m[1]) { d--; continue; }
    if (d === 1) bloques.push({ i: m.index, faq: /class="[^"]*\bfaq\b/.test(m[0]) });
    d++;
  }
  return bloques;
}

// Huecos en el flujo, siempre entre tarjetas (nunca dentro de una tabla ni antes del <h1>):
// - «intro»: tras el primer bloque y antes del primer bloque secundario;
// - «medio»: entre bloques de las páginas largas (6 bloques o más);
// - «faq»: tras las tablas principales y justo antes de las preguntas frecuentes.
// Entre dos anuncios queda siempre al menos un bloque de contenido.
export function ponerHuecos(main) {
  const b = bloquesProsa(main);
  if (b.length < 2) return main;
  const sitios = [];
  const poner = (k, pos) => {
    if (k < 1 || k >= b.length || sitios.some(s => Math.abs(s.k - k) < 2)) return;
    sitios.push({ k, pos });
  };
  const kFaq = b.findIndex(x => x.faq);
  if (!b[1].faq) poner(1, "intro");
  // En páginas cortas con FAQ, dos huecos bastan: el contenido debe pesar más que los anuncios.
  if (b.length >= (kFaq > 0 ? 8 : 6)) poner(Math.floor(b.length / 2), "medio");
  if (kFaq > 0) poner(kFaq, "faq");
  sitios.sort((x, y) => y.k - x.k).forEach(({ k, pos }) => {
    main = main.slice(0, b[k].i) + huecoSeo(pos) + "\n  " + main.slice(b[k].i);
  });
  return main;
}

// ---- maqueta compartida ---------------------------------------------------------
// Número de casos del validador R ↔ JS (tools/casos.json, los mismos que usa
// tools/generar_validacion.mjs): la cifra del bloque de confianza no se escribe a mano.
let casosValidador = null;
export function numeroCasos() {
  if (casosValidador == null) casosValidador = Object.keys(JSON.parse(readFileSync(join(WEB, "..", "tools", "casos.json"), "utf8"))).length;
  return casosValidador;
}
// Bloque de confianza al pie del contenido: ejercicio, revisión, verificación y fuentes.
// Sin nombres de personas (no se publican datos personales del titular).
export function bloqueConfianza(generado) {
  return `<ul class="confianza">
    <li>Ejercicio 2025/2026</li>
    <li>Revisado el <time datetime="${esc(generado)}">${esc(fecha(generado))}</time></li>
    <li><a href="/validacion/">Cálculos verificados con ${numeroCasos()} casos del motor de referencia</a></li>
    <li>Fuentes: BOE y boletines oficiales · <a href="/metodologia/">Metodología</a></li>
  </ul>`;
}
export function layout({ title, description, canonical, breadcrumb, main, generado, ejercicio = EJERCICIO.valor, jsonld = [], css = [], scripts = [] }) {
  title = tituloFinal(title);
  const anuncios = conAnuncios(canonical);
  if (anuncios) main = ponerHuecos(main);
  // Fecha visible justo después del <h1>.
  main = main.replace(/(<\/h1>)/, `$1\n  <p class="actualizado">Actualizado el <time datetime="${MARCA_FECHA}">${MARCA_FECHA_LARGA}</time></p>`);
  jsonld = [ORGANIZACION, ...jsonld];
  const ld = jsonld.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITIO}${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Mapafiscal">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITIO}${canonical}">
<meta property="og:locale" content="es_ES">
<meta property="og:image" content="${SITIO}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Mapafiscal: el mismo sueldo, 19 IRPF distintos">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITIO}/og.png">
<meta name="theme-color" content="#1f3fc4">
<meta name="color-scheme" content="light dark">
${UI.SCRIPT_TEMA}
<link rel="preload" href="/fonts/public-sans-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/archivo-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/iconos/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/css/mapafiscal.css">
<link rel="stylesheet" href="/css/seo.css">
${css.map(c => `<link rel="stylesheet" href="${c}">\n`).join("")}${ld ? ld + "\n" : ""}</head>
<body class="pagina-seo">
${anuncios ? CARRILES_HTML + "\n" : ""}<header class="appbar">
  <div class="appbar-in">
    ${UI.HTML_BTN_PANEL}
    <a class="marca" href="/index.html">
      <svg class="marca-ico" viewBox="0 0 101 82" aria-hidden="true"><polygon class="marca-m" points="2,80 16,4 28,4 54,30 46,41 24,20 17,80"/><polygon class="marca-m" points="72,2 83,2 99,80 85,80 75,30"/><polygon class="marca-m-tu" points="31,80 46,80 87,24 79,10"/></svg>
      <span class="marca-txt"><span class="sr-only">M</span>apafiscal</span>
    </a>
    <nav class="nav" aria-label="Secciones">
      <a href="/index.html#calculadora">Calculadora</a>
      <a href="/index.html#comparar">Comparar territorios</a>
      <a href="/irpf/">IRPF por territorio</a>
      <a href="/guias/">Guías</a>
      <a href="/vivienda/">Vivienda</a>
      <a href="/autonomos/">Autónomos</a>
    </nav>
    <div class="appbar-der">
      ${UI.HTML_BTN_TEMA}
      <a class="btn btn-pri btn-sm" href="/index.html#calculadora">Calcula tu caso</a>
    </div>
  </div>
</header>
<main class="contenedor pagina-seo-main">
  <p class="migas">${breadcrumb}</p>
  ${main}
</main>
<aside class="contenedor pagina-seo-confianza" aria-label="Sobre estos cálculos">
  ${bloqueConfianza(generado)}
</aside>
<footer class="pie">
  <div class="contenedor pie-in">
    <p><b>Mapafiscal</b> ofrece estimaciones con fines informativos. No es una liquidación oficial ni asesoramiento fiscal.</p>
    ${REDES_HTML}
    <p class="pie-sec"><a href="/irpf/">IRPF por territorio</a> · <a href="/guias/">Guías del IRPF</a> · <a href="/vivienda/">Vivienda</a> · <a href="/autonomos/">IRPF de autónomos</a> · <a href="/glosario/">Glosario</a> · <a href="/comparar-sueldo/">Dónde se paga menos IRPF</a> · <a href="/sueldo-neto/">Sueldo neto</a> · <a href="/metodologia/">Metodología</a> · <a href="/validacion/">Cómo comprobamos los cálculos</a> · <a href="/widget/">Widget para tu web</a></p>
    <p class="pie-sec pie-fechas">Normativa revisada el <time datetime="${esc(generado)}">${esc(fecha(generado))}</time> · Contenido actualizado el <time datetime="${MARCA_FECHA}">${MARCA_FECHA_LARGA}</time>${ejercicio ? ` · Ejercicio ${esc(ejercicio)} (renta que se declara en ${esc(+ejercicio + 1)})` : ""}</p>
    <p class="pie-sec"><a href="/legal/aviso-legal.html">Aviso legal</a> · <a href="/legal/privacidad.html">Privacidad</a> · <a href="/legal/condiciones.html">Condiciones</a> · <a href="/legal/cookies.html">Cookies</a> · <a href="/legal/aviso-legal.html#contacto">Contacto</a></p>
  </div>
</footer>
<script src="/js/ui.js" defer></script>
<script src="/config.js" defer></script>
<script src="/js/analitica.js" defer></script>
${anuncios ? '<script src="/js/anuncios.js" defer></script>\n' : ""}${main.includes("data-calculo-rapido") ? '<script src="/js/calculo-rapido.js" defer></script>\n' : ""}${scripts.map(j => `<script src="${j}" defer></script>\n`).join("")}</body>
</html>`;
}
