#!/usr/bin/env node
// =============================================================================
// Genera las páginas SEO estáticas (por territorio y por sueldo) a partir de
// web/datos/seo_territorios.json y web/datos/seo_comparativas.json, que a su vez
// salen del motor (Rscript tools/generar_datos_seo.R). No se inventa ninguna cifra
// ni ninguna cita legal aquí: este script solo maqueta lo que ya calculó el motor.
//
//   node tools/generar_paginas_seo.mjs
//
// Escribe páginas HTML sueltas (no forman parte de la aplicación de una sola
// página): no cargan js/app.js ni js/irpfsim.js, solo enlazan a index.html para
// la calculadora interactiva. Así Google puede indexar cada territorio y cada
// sueldo como una página propia, con su propio título y su propia URL.
// =============================================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(RAIZ, "web");
const SITIO = "https://mapafiscal.es";

const territorios = JSON.parse(readFileSync(join(WEB, "datos", "seo_territorios.json"), "utf8"));
const comparativas = JSON.parse(readFileSync(join(WEB, "datos", "seo_comparativas.json"), "utf8"));

// ---- slugs (solo para la URL; el nombre mostrado sale siempre de los datos) ----
const SLUG = {
  "ES-AN": "andalucia", "ES-AR": "aragon", "ES-AS": "asturias", "ES-IB": "islas-baleares",
  "ES-CN": "canarias", "ES-CB": "cantabria", "ES-CM": "castilla-la-mancha", "ES-CL": "castilla-y-leon",
  "ES-CT": "cataluna", "ES-EX": "extremadura", "ES-GA": "galicia", "ES-MD": "madrid",
  "ES-MC": "murcia", "ES-RI": "la-rioja", "ES-VC": "comunidad-valenciana",
  "ES-PV-BI": "bizkaia", "ES-PV-SS": "gipuzkoa", "ES-PV-VI": "araba-alava", "ES-NC": "navarra"
};
const ORDEN_TERRITORIOS = Object.keys(SLUG); // orden estable, el de params.json

// ---- utilidades ----------------------------------------------------------------
// Mismo formato que web/js/app.js (miles/eur/pct): así las cifras se ven igual en toda
// la web, en vez de depender del redondeo de agrupación de Intl.NumberFormat con es-ES
// (que en Node no agrupa los millares de 4 cifras, p. ej. "5550" en vez de "5.550").
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const miles = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const euros = n => miles(String(Math.round(n))) + " €";
const eurosSalario = euros;
const pct = n => (100 * n).toFixed(1).replace(".", ",") + " %";
const REGIMEN_ETIQUETA = { comun: "régimen común", foral_pais_vasco: "concierto económico del País Vasco", foral_navarra: "convenio económico de Navarra" };

function tablaEscala(tramos) {
  const filas = tramos.map((t, i) => {
    let tramo;
    if (i === 0) tramo = "Hasta " + euros(t.hasta);
    else if (t.hasta == null) tramo = "Desde " + euros(tramos[i - 1].hasta);
    else tramo = "De " + euros(tramos[i - 1].hasta) + " a " + euros(t.hasta);
    return `<tr><td>${esc(tramo)}</td><td class="num">${esc(pct(t.tipo))}</td></tr>`;
  });
  return `<table class="cobertura"><thead><tr><th>Tramo de la base liquidable general</th><th class="num">Tipo marginal</th></tr></thead><tbody>${filas.join("")}</tbody></table>`;
}

function citaFuente(f) {
  if (!f) return "";
  return `<p class="ayuda">Norma: ${esc(f.norma)}. Fuente: ${esc(f.fuente)}.</p>`;
}

// ---- maqueta compartida ---------------------------------------------------------
function layout({ title, description, canonical, breadcrumb, main, generado }) {
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
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<link rel="stylesheet" href="/css/mapafiscal.css">
<link rel="stylesheet" href="/css/seo.css">
</head>
<body class="pagina-seo">
<header class="appbar">
  <div class="appbar-in">
    <a class="marca" href="/index.html" aria-label="Mapafiscal, inicio">
      <svg class="marca-ico" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" class="marca-fondo"/><path d="M8 22V10l5 6 5-6v12" class="marca-trazo"/><path d="M21 13h4M21 17h4M21 21h4" class="marca-trazo"/></svg>
      <span class="marca-txt">Mapafiscal</span>
    </a>
    <nav class="nav" aria-label="Secciones">
      <a href="/index.html#calculadora">Calculadora</a>
      <a href="/index.html#comparar">Comparar territorios</a>
      <a href="/index.html#planes">Planes</a>
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
    <p class="pie-sec"><a href="/index.html#metodologia">Cómo calculamos</a> · Normativa del ejercicio 2025 · Motor validado R ↔ JavaScript · Datos generados el ${esc(generado)}</p>
  </div>
</footer>
</body>
</html>`;
}

// ---- página por territorio -------------------------------------------------------
function paginaTerritorio(codigo) {
  const t = territorios.territorios[codigo];
  const slug = SLUG[codigo];
  const esComun = t.regimen === "comun";
  const nombre = t.nombre;

  let intro;
  if (esComun) {
    intro = `<p class="entradilla">${esc(nombre)} tributa en ${REGIMEN_ETIQUETA[t.regimen]}: el Estado fija la escala general y ${esc(nombre)} fija su propia escala autonómica, que se suma a la estatal. La tabla siguiente ya las combina.</p>`;
  } else {
    intro = `<p class="entradilla">${esc(nombre)} tributa por el ${REGIMEN_ETIQUETA[t.regimen]}: no aplica la escala estatal del IRPF, sino su propia tarifa foral completa.</p>`;
  }

  const cartaEscala = `<div class="tarjeta">
    <h2 class="rotulo">Escala del IRPF en ${esc(nombre)} (2025)</h2>
    ${tablaEscala(t.escala_combinada.tramos)}
    ${esComun ? citaFuente(t.escala_combinada.fuente_estatal) + citaFuente(t.escala_combinada.fuente_autonomica) : citaFuente(t.escala_combinada.fuente_autonomica)}
  </div>`;

  const cartaMinimo = esComun && t.minimo_contribuyente ? `<div class="tarjeta">
    <h2 class="rotulo">Mínimo personal</h2>
    <p>El mínimo del contribuyente (menor de 65 años, sin hijos ni ascendientes a cargo) es de <b>${esc(euros(t.minimo_contribuyente.general_territorio))}</b>${t.minimo_contribuyente.tiene_minimo_propio ? `, un importe propio de ${esc(nombre)}` : ", el mismo que fija el Estado (art. 57 LIRPF)"}. Sube si tienes hijos, ascendientes a cargo o discapacidad.</p>
    ${t.minimo_contribuyente.tiene_minimo_propio ? citaFuente(t.minimo_contribuyente.fuente_autonomica) : citaFuente(t.minimo_contribuyente.fuente_estatal)}
  </div>` : "";

  const cartaDeducciones = esComun && t.deducciones ? `<div class="tarjeta">
    <h2 class="rotulo">Deducciones autonómicas</h2>
    <p>El motor de Mapafiscal ya calcula <b>${t.deducciones.modeladas} deducciones</b> propias de ${esc(nombre)}${t.deducciones.provisionales ? ` (${t.deducciones.provisionales} con cifras provisionales, pendientes de cotejar)` : ""}. Quedan ${t.deducciones.pendientes} por incorporar. <a href="/index.html#metodologia">Ver el detalle en metodología</a>.</p>
  </div>` : (!esComun ? `<div class="tarjeta"><h2 class="rotulo">Deducciones</h2><p>${esc(nombre)} tiene su propio catálogo de deducciones y minoraciones, distinto del de régimen común: no se cuentan aquí.</p></div>` : "");

  const filasComparativa = comparativas.salarios.map(s => {
    const fila = comparativas.comparativas[String(s)].find(f => f.territorio === codigo);
    return `<tr><td>${esc(eurosSalario(s))}</td><td class="num">${fila.puesto} de 19</td><td class="num">${esc(euros(fila.cuota_liquida_total))}</td><td class="num">${esc(pct(fila.tipo_medio_efectivo))}</td><td><a href="/comparar-sueldo/${s}/">Ver los 19</a></td></tr>`;
  }).join("");

  const cartaComparativa = `<div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">¿Cómo queda ${esc(nombre)} frente a los otros 18 territorios?</h2>
    <p class="ayuda">Caso de referencia: ${esc(comparativas.supuesto)}</p>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Sueldo bruto</th><th class="num">Puesto (de más barato a más caro)</th><th class="num">Cuota líquida</th><th class="num">Tipo medio</th><th></th></tr></thead><tbody>${filasComparativa}</tbody></table></div>
  </div>`;

  const main = `
  <h1>IRPF en ${esc(nombre)} en 2025</h1>
  ${intro}
  <div class="prosa">
  ${cartaEscala}
  ${cartaMinimo}
  ${cartaDeducciones}
  ${cartaComparativa}
  <p><a class="btn btn-pri" href="/index.html#calculadora">Calcula tu caso real en ${esc(nombre)}</a> <a class="btn btn-sec" href="/index.html#comparar">Compáralo con los otros 18 territorios</a></p>
  </div>`;

  return layout({
    title: `IRPF en ${nombre} (2025): tramos, mínimo y comparativa | Mapafiscal`,
    description: `Tramos del IRPF en ${nombre} para 2025, mínimo personal y en qué puesto queda frente a los otros 18 territorios fiscales de España, con sueldos de ejemplo. Calculadora gratuita.`,
    canonical: `/irpf/${slug}/`,
    breadcrumb: `<a href="/index.html">Inicio</a> › <a href="/irpf/">IRPF por territorio</a> › ${esc(nombre)}`,
    main, generado: territorios.generado
  });
}

// ---- página por sueldo -------------------------------------------------------------
function paginaSalario(salario) {
  const filas = comparativas.comparativas[String(salario)];
  const masBarato = filas[0], masCaro = filas[filas.length - 1];
  const filasHtml = filas.map(f => `<tr><td class="num">${f.puesto}</td><td><a href="/irpf/${SLUG[f.territorio]}/">${esc(f.nombre)}</a></td><td class="num">${esc(euros(f.cuota_liquida_total))}</td><td class="num">${esc(pct(f.tipo_medio_efectivo))}</td></tr>`).join("");

  const main = `
  <h1>¿Dónde se paga menos IRPF con ${esc(eurosSalario(salario))} de sueldo? (2025)</h1>
  <p class="entradilla">Comparativa de los 19 territorios fiscales de España con el mismo sueldo bruto. ${esc(comparativas.supuesto)}</p>
  <div class="prosa">
  <div class="tarjeta">
    <p>Con ${esc(eurosSalario(salario))} brutos, la cuota líquida va de <b>${esc(euros(masBarato.cuota_liquida_total))}</b> en ${esc(masBarato.nombre)} a <b>${esc(euros(masCaro.cuota_liquida_total))}</b> en ${esc(masCaro.nombre)}: una diferencia de ${esc(euros(masCaro.cuota_liquida_total - masBarato.cuota_liquida_total))} al año entre el territorio más barato y el más caro, para el mismo caso.</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Los 19 territorios, de menos a más IRPF</h2>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th class="num">Puesto</th><th>Territorio</th><th class="num">Cuota líquida</th><th class="num">Tipo medio efectivo</th></tr></thead><tbody>${filasHtml}</tbody></table></div>
  </div>
  <p><a class="btn btn-pri" href="/index.html#calculadora">Calcula tu caso real, con tu sueldo y tu situación</a></p>
  </div>`;

  return layout({
    title: `¿Dónde se paga menos IRPF con ${eurosSalario(salario)}? (2025) | Mapafiscal`,
    description: `Con ${eurosSalario(salario)} de sueldo bruto al año, así queda la cuota del IRPF en los 19 territorios fiscales de España en 2025, de más barato a más caro. Calculadora gratuita.`,
    canonical: `/comparar-sueldo/${salario}/`,
    breadcrumb: `<a href="/index.html">Inicio</a> › <a href="/comparar-sueldo/">Dónde se paga menos IRPF</a> › ${esc(eurosSalario(salario))}`,
    main, generado: territorios.generado
  });
}

// ---- índices ------------------------------------------------------------------------
function paginaIndiceTerritorios() {
  const filas = ORDEN_TERRITORIOS.map(c => `<li><a href="/irpf/${SLUG[c]}/">IRPF en ${esc(territorios.territorios[c].nombre)}</a></li>`).join("");
  const main = `
  <h1>IRPF por territorio (2025)</h1>
  <p class="entradilla">Tramos, mínimo personal y comparativa de cada uno de los 19 territorios fiscales de España: las 15 comunidades autónomas de régimen común, las tres diputaciones forales del País Vasco y Navarra.</p>
  <div class="prosa"><ul class="lista-enlaces">${filas}</ul></div>`;
  return layout({
    title: "IRPF por territorio en España (2025) | Mapafiscal",
    description: "Tramos, mínimo personal y comparativa del IRPF 2025 en los 19 territorios fiscales de España: 15 comunidades autónomas, las 3 diputaciones forales vascas y Navarra.",
    canonical: "/irpf/", breadcrumb: `<a href="/index.html">Inicio</a> › IRPF por territorio`, main, generado: territorios.generado
  });
}

function paginaIndiceSalarios() {
  const filas = comparativas.salarios.map(s => `<li><a href="/comparar-sueldo/${s}/">¿Dónde se paga menos IRPF con ${esc(eurosSalario(s))}?</a></li>`).join("");
  const main = `
  <h1>¿Dónde se paga menos IRPF en España? (2025)</h1>
  <p class="entradilla">Comparativas del IRPF en los 19 territorios fiscales de España para varios sueldos de referencia. ${esc(comparativas.supuesto)}</p>
  <div class="prosa"><ul class="lista-enlaces">${filas}</ul></div>`;
  return layout({
    title: "¿Dónde se paga menos IRPF en España? (2025) | Mapafiscal",
    description: "Comparativas del IRPF 2025 en los 19 territorios fiscales de España para varios sueldos: de menos a más impuesto, con tipo medio efectivo. Calculadora gratuita.",
    canonical: "/comparar-sueldo/", breadcrumb: `<a href="/index.html">Inicio</a> › Dónde se paga menos IRPF`, main, generado: territorios.generado
  });
}

// ---- escribir ------------------------------------------------------------------------
function escribirPagina(rutaRelativa, html) {
  const destino = join(WEB, rutaRelativa, "index.html");
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, html, "utf8");
}

const urls = [];
for (const codigo of ORDEN_TERRITORIOS) {
  escribirPagina(`irpf/${SLUG[codigo]}`, paginaTerritorio(codigo));
  urls.push(`/irpf/${SLUG[codigo]}/`);
}
escribirPagina("irpf", paginaIndiceTerritorios()); urls.push("/irpf/");

for (const s of comparativas.salarios) {
  escribirPagina(`comparar-sueldo/${s}`, paginaSalario(s));
  urls.push(`/comparar-sueldo/${s}/`);
}
escribirPagina("comparar-sueldo", paginaIndiceSalarios()); urls.push("/comparar-sueldo/");

// ---- sitemap y robots ------------------------------------------------------------------
const hoy = territorios.generado;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITIO}/index.html</loc><lastmod>${hoy}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
${urls.map(u => `<url><loc>${SITIO}${u}</loc><lastmod>${hoy}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(WEB, "sitemap.xml"), sitemap, "utf8");

const robots = `Sitemap: ${SITIO}/sitemap.xml\n\nUser-agent: *\nAllow: /\n`;
writeFileSync(join(WEB, "robots.txt"), robots, "utf8");

console.log(`Páginas SEO: ${ORDEN_TERRITORIOS.length} territorios + ${comparativas.salarios.length} sueldos + 2 índices.`);
console.log(`sitemap.xml: ${urls.length + 1} URLs.`);
