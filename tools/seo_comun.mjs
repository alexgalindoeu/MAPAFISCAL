// =============================================================================
// Piezas comunes de las páginas estáticas SEO (territorios, sueldos, deducciones y
// guías): formato de cifras, citas de fuentes, datos estructurados y la maqueta.
// Las usan tools/generar_paginas_seo.mjs, tools/seo_deducciones.mjs y tools/seo_guias.mjs.
// =============================================================================

export const SITIO = "https://mapafiscal.es";

// ---- slugs (solo para la URL; el nombre mostrado sale siempre de los datos) ----
export const SLUG = {
  "ES-AN": "andalucia", "ES-AR": "aragon", "ES-AS": "asturias", "ES-IB": "islas-baleares",
  "ES-CN": "canarias", "ES-CB": "cantabria", "ES-CM": "castilla-la-mancha", "ES-CL": "castilla-y-leon",
  "ES-CT": "cataluna", "ES-EX": "extremadura", "ES-GA": "galicia", "ES-MD": "madrid",
  "ES-MC": "murcia", "ES-RI": "la-rioja", "ES-VC": "comunidad-valenciana",
  "ES-PV-BI": "bizkaia", "ES-PV-SS": "gipuzkoa", "ES-PV-VI": "araba-alava", "ES-NC": "navarra"
};
export const ORDEN_TERRITORIOS = Object.keys(SLUG); // orden estable, el de params.json

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
export const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const euros = n => miles(String(Math.round(n))) + " €";
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
export function jsonLdArticulo({ titulo, descripcion, ruta, generado }) {
  return {
    "@context": "https://schema.org", "@type": "Article", headline: titulo, description: descripcion,
    inLanguage: "es", mainEntityOfPage: SITIO + ruta, dateModified: generado,
    author: { "@type": "Organization", name: "Mapafiscal", url: SITIO + "/" },
    publisher: { "@type": "Organization", name: "Mapafiscal", url: SITIO + "/" }
  };
}
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

// ---- maqueta compartida ---------------------------------------------------------
export function layout({ title, description, canonical, breadcrumb, main, generado, jsonld = [], css = [] }) {
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
<link rel="preload" href="/fonts/public-sans-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/archivo-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/iconos/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/css/mapafiscal.css">
<link rel="stylesheet" href="/css/seo.css">
${css.map(c => `<link rel="stylesheet" href="${c}">\n`).join("")}${ld ? ld + "\n" : ""}</head>
<body class="pagina-seo">
<header class="appbar">
  <div class="appbar-in">
    <a class="marca" href="/index.html" aria-label="Mapafiscal, inicio">
      <svg class="marca-ico" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" class="marca-fondo"/><path class="marca-panel" d="M7 10.5 13 8v15.5L7 26z"/><path class="marca-panel-tu" d="M13 8l6 2.5V26l-6-2.5z"/><path class="marca-panel-2" d="M19 10.5 25 8v15.5L19 26z"/></svg>
      <span class="marca-txt">Mapafiscal</span>
    </a>
    <nav class="nav" aria-label="Secciones">
      <a href="/index.html#calculadora">Calculadora</a>
      <a href="/index.html#comparar">Comparar territorios</a>
      <a href="/irpf/">IRPF por territorio</a>
      <a href="/guias/">Guías</a>
    </nav>
    <div class="appbar-der">
      <a class="btn btn-pri btn-sm" href="/index.html#calculadora">Calcula tu caso</a>
    </div>
  </div>
</header>
<main class="contenedor pagina-seo-main">
  <p class="migas">${breadcrumb}</p>
  ${main}
</main>
<footer class="pie">
  <div class="contenedor pie-in">
    <p><b>Mapafiscal</b> ofrece estimaciones con fines informativos. No es una liquidación oficial ni asesoramiento fiscal.</p>
    <p class="pie-sec"><a href="/irpf/">IRPF por territorio</a> · <a href="/guias/">Guías del IRPF</a> · <a href="/comparar-sueldo/">Dónde se paga menos IRPF</a> · <a href="/index.html#metodologia">Cómo calculamos</a> · Datos generados el ${esc(generado)}</p>
    <p class="pie-sec"><a href="/legal/aviso-legal.html">Aviso legal</a> · <a href="/legal/privacidad.html">Privacidad</a> · <a href="/legal/condiciones.html">Condiciones</a> · <a href="/legal/cookies.html">Cookies</a> · <a href="/legal/aviso-legal.html#contacto">Contacto</a></p>
  </div>
</footer>
</body>
</html>`;
}
