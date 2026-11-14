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
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SITIO, SLUG, ORDEN_TERRITORIOS, HERRAMIENTA, esc, euros, pct, tablaEscala, citaFuente, layout, jsonLdMigas, migasHtml } from "./seo_comun.mjs";
import { paginaDeducciones } from "./seo_deducciones.mjs";
import { paginasGuias, GUIAS } from "./seo_guias.mjs";
import { paginasSueldoNeto } from "./seo_sueldo_neto.mjs";
import { paginasRescate } from "./seo_rescate.mjs";
import { paginasConjuntaPagadores, CARPETAS_CONJUNTA } from "./seo_conjunta.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(RAIZ, "web");
const leerJson = f => JSON.parse(readFileSync(join(WEB, "datos", f), "utf8"));

let territorios, comparativas, deducciones, guias, sueldoNeto;
const eurosSalario = euros;
const REGIMEN_ETIQUETA = { comun: "régimen común", foral_pais_vasco: "concierto económico del País Vasco", foral_navarra: "convenio económico de Navarra" };
// Territorios con página de deducciones (se rellena al generar).
const conDeducciones = new Set();

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

  const enlaceDed = conDeducciones.has(codigo) ? ` <a href="/irpf/${slug}/deducciones/">Ver las deducciones de ${esc(nombre)}</a>.` : "";
  const cartaDeducciones = esComun ? `<div class="tarjeta">
    <h2 class="rotulo">Deducciones autonómicas</h2>
    <p>Además de su escala, ${esc(nombre)} aprueba deducciones propias que se restan de la parte autonómica de la cuota. La calculadora las aplica cuando indicas tu situación familiar y tus gastos.${enlaceDed}</p>
  </div>` : `<div class="tarjeta"><h2 class="rotulo">Deducciones</h2><p>${esc(nombre)} tiene su propio catálogo de deducciones y minoraciones de la cuota, distinto del de régimen común.${enlaceDed}</p></div>`;

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
  <p class="ayuda">Guías: <a href="/guias/tramos-irpf-2025-2026/">tramos del IRPF 2025 y 2026</a> · <a href="/guias/minimo-personal-familiar/">mínimo personal y familiar</a> · <a href="/guias/obligacion-declarar-renta/">¿estoy obligado a declarar?</a> · <a href="/guias/plan-pensiones-desgravar/">plan de pensiones</a></p>
  </div>`;

  return layout({
    jsonld: [jsonLdMigas([["Inicio", "/"], ["IRPF por territorio", "/irpf/"], [nombre, `/irpf/${slug}/`]])],
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
  <p><a class="btn btn-pri" href="/index.html#calculadora">Calcula tu caso real, con tu sueldo y tu situación</a> <a class="btn btn-sec" href="/sueldo-neto/${salario}/">Sueldo neto de ${esc(eurosSalario(salario))} en 12 y 14 pagas</a></p>
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
  <div class="prosa"><ul class="lista-enlaces">${filas}</ul>
  <div class="tarjeta"><h2 class="rotulo">Deducciones por territorio</h2><ul class="lista-enlaces">${ORDEN_TERRITORIOS.filter(c => conDeducciones.has(c)).map(c => `<li><a href="/irpf/${SLUG[c]}/deducciones/">Deducciones en ${esc(territorios.territorios[c].nombre)}</a></li>`).join("")}</ul></div>
  <div class="tarjeta"><h2 class="rotulo">Guías del IRPF</h2><ul class="lista-enlaces">${GUIAS.map(g => `<li><a href="/guias/${g.slug}/">${esc(g.enlace)}</a></li>`).join("")}</ul><p><a href="/guias/">Todas las guías</a></p></div>
  </div>`;
  return layout({
    jsonld: [jsonLdMigas([["Inicio", "/"], ["IRPF por territorio", "/irpf/"]])],
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
  <div class="prosa"><ul class="lista-enlaces">${filas}</ul>
  <p><a href="/sueldo-neto/">Sueldo neto por importe y territorio, en 12 y 14 pagas</a></p></div>`;
  return layout({
    title: "¿Dónde se paga menos IRPF en España? (2025) | Mapafiscal",
    description: "Comparativas del IRPF 2025 en los 19 territorios fiscales de España para varios sueldos: de menos a más impuesto, con tipo medio efectivo. Calculadora gratuita.",
    canonical: "/comparar-sueldo/", breadcrumb: `<a href="/index.html">Inicio</a> › Dónde se paga menos IRPF`, main, generado: territorios.generado
  });
}

// ---- generar --------------------------------------------------------------------------
// Devuelve { ficheros: Map<ruta relativa a web/, contenido>, avisos, recuento } sin escribir
// nada: lo usan la escritura, `--comprobar` y test/contenidos.test.mjs.
export function generar() {
  territorios = leerJson("seo_territorios.json");
  comparativas = leerJson("seo_comparativas.json");
  deducciones = leerJson("seo_deducciones.json");
  guias = leerJson("seo_guias.json");
  sueldoNeto = leerJson("seo_sueldo_neto.json");
  conDeducciones.clear();
  const ficheros = new Map(), urls = [], avisos = [];
  const pagina = (ruta, html) => { ficheros.set(ruta.replace(/^\//, "") + "index.html", html); urls.push(ruta); };

  // Deducciones primero: las páginas de territorio y el índice enlazan las que existan.
  const ded = [];
  for (const codigo of ORDEN_TERRITORIOS) {
    const t = deducciones.territorios[codigo];
    if (!t) continue;
    const p = paginaDeducciones(codigo, t, deducciones.generado, avisos);
    if (p) { conDeducciones.add(codigo); ded.push(p); }
  }
  for (const codigo of ORDEN_TERRITORIOS) {
    pagina(`/irpf/${SLUG[codigo]}/`, paginaTerritorio(codigo));
    const p = ded.find(x => x.ruta === `/irpf/${SLUG[codigo]}/deducciones/`);
    if (p) pagina(p.ruta, p.html);
  }
  pagina("/irpf/", paginaIndiceTerritorios());
  for (const s of comparativas.salarios) pagina(`/comparar-sueldo/${s}/`, paginaSalario(s));
  pagina("/comparar-sueldo/", paginaIndiceSalarios());
  const gs = paginasGuias(guias, territorios);
  for (const g of gs) pagina(g.ruta, g.html);
  const sn = paginasSueldoNeto(sueldoNeto);
  for (const p of sn) pagina(p.ruta, p.html);
  for (const g of paginasRescate(territorios.generado)) pagina(g.ruta, g.html);
  for (const g of paginasConjuntaPagadores(territorios.generado)) pagina(g.ruta, g.html);

  const hoy = territorios.generado;
  ficheros.set("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITIO}/</loc><lastmod>${hoy}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
${urls.map(u => `<url><loc>${SITIO}${u}</loc><lastmod>${hoy}</lastmod><changefreq>monthly</changefreq><priority>${u.startsWith("/guias/") || u === "/irpf/" ? "0.8" : "0.7"}</priority></url>`).join("\n")}
</urlset>
`);
  ficheros.set("robots.txt", `Sitemap: ${SITIO}/sitemap.xml\n\nUser-agent: *\nAllow: /\n`);
  return {
    ficheros, avisos, urls,
    recuento: { territorios: ORDEN_TERRITORIOS.length, sueldos: comparativas.salarios.length, deducciones: ded.length, guias: gs.length - 1, sueldoNeto: sn.length - 1, indices: 4 }
  };
}

// Páginas generadas que ya no salen (p. ej. un territorio que se queda sin deducciones
// publicables): solo dentro de las carpetas que gestiona este generador.
export function huerfanas(ficheros) {
  const fuera = [];
  const irpf = join(WEB, "irpf");
  if (existsSync(irpf)) for (const d of readdirSync(irpf)) {
    const r = `irpf/${d}/deducciones/index.html`;
    if (existsSync(join(WEB, r)) && !ficheros.has(r)) fuera.push(r);
  }
  const recorrer = (rel) => {
    const abs = join(WEB, rel);
    if (!existsSync(abs)) return;
    for (const f of readdirSync(abs, { withFileTypes: true })) {
      const r = `${rel}/${f.name}`;
      if (f.isDirectory()) recorrer(r);
      else if (f.name.endsWith(".html") && !ficheros.has(r)) fuera.push(r);
    }
  };
  recorrer("guias");
  recorrer("sueldo-neto");
  recorrer("rescate-plan-pensiones");
  for (const c of CARPETAS_CONJUNTA) recorrer(c);
  return fuera;
}

const sinCR = s => s.replace(/\r/g, "");

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const comprobar = process.argv.includes("--comprobar");
  const { ficheros, avisos, recuento, urls } = generar();
  for (const a of avisos) console.warn("Aviso: " + a);
  const sobran = huerfanas(ficheros);
  if (comprobar) {
    const mal = [];
    for (const [r, html] of ficheros) {
      const p = join(WEB, r);
      if (!existsSync(p)) mal.push(`${r} (falta)`);
      else if (sinCR(readFileSync(p, "utf8")) !== html) mal.push(`${r} (desfasada)`);
    }
    for (const r of sobran) mal.push(`${r} (sobra)`);
    if (mal.length) {
      console.error(`Páginas SEO que no coinciden con web/datos/seo_*.json:\n  ${mal.join("\n  ")}\nRegenéralas con \`node tools/generar_paginas_seo.mjs\` y no las edites a mano.`);
      process.exit(1);
    }
    console.log(`Páginas SEO al día: ${ficheros.size} ficheros.`);
  } else {
    for (const [r, html] of ficheros) {
      const p = join(WEB, r);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, html, "utf8");
    }
    for (const r of sobran) { rmSync(join(WEB, r)); console.log(`Borrada (ya no se genera): ${r}`); }
    console.log(`Páginas SEO: ${recuento.territorios} territorios + ${recuento.deducciones} de deducciones + ${recuento.sueldos} sueldos + ${recuento.guias} guías + ${recuento.sueldoNeto} de sueldo neto + ${recuento.indices} índices.`);
    console.log(`sitemap.xml: ${urls.length + 1} URLs.`);
  }
}
