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
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SITIO, SLUG, ORDEN_TERRITORIOS, HERRAMIENTA, NOMBRE_CORTO, esc, euros, difEuros, pct, pctCorto, tablaEscala, citaFuente, layout, jsonLdMigas, jsonLdFaq, jsonLdDataset, bloqueFaq, respuestaDirecta, migasHtml, fecharContenido, hashContenido, EJERCICIO } from "./seo_comun.mjs";
import { robotsTxt, llmsTxt } from "./seo_ia.mjs";
import { paginaDeducciones } from "./seo_deducciones.mjs";
import { paginasGuias, GUIAS } from "./seo_guias.mjs";
import { paginasSueldoNeto } from "./seo_sueldo_neto.mjs";
import { paginasRescate } from "./seo_rescate.mjs";
import { paginasConjuntaPagadores, CARPETAS_CONJUNTA } from "./seo_conjunta.mjs";
import { paginasDevuelve } from "./seo_devuelve.mjs";
import { paginasForal, enlacesSuiteForal } from "./seo_foral.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(RAIZ, "web");
const sinCR = s => s.replace(/\r/g, "");
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

  const corto = NOMBRE_CORTO[codigo];
  const tr = t.escala_combinada.tramos, tMin = tr[0].tipo, tMax = tr[tr.length - 1].tipo, desdeMax = tr[tr.length - 2]?.hasta;
  // Tarifa 2026: solo la foral, que está en los parámetros con su norma (régimen común: 2025).
  const e = guias.escalas;
  const esc26 = t.regimen === "foral_pais_vasco" ? e.pais_vasco_2026 : t.regimen === "foral_navarra" ? e.navarra_2026 : null;
  const esc25f = t.regimen === "foral_pais_vasco" ? e.pais_vasco_2025 : t.regimen === "foral_navarra" ? e.navarra_2025 : null;
  const con26 = Boolean(esc26 && esc25f && JSON.stringify(esc25f.tramos) === JSON.stringify(tr));
  const igual26 = con26 && JSON.stringify(esc26.tramos) === JSON.stringify(tr);
  const fila30 = comparativas.comparativas["30000"].find(f => f.territorio === codigo);
  const fuentesEscala = [t.escala_combinada.fuente_estatal, t.escala_combinada.fuente_autonomica, con26 && !igual26 ? esc26 : null].filter(Boolean);
  const cartaEscala = `<div class="tarjeta">
    <h2 class="rotulo">Tabla de tramos del IRPF en ${esc(nombre)} ${igual26 ? "2025 y 2026" : "2025"}${esComun ? " (estatal + autonómico)" : ""}</h2>
    ${tablaEscala(tr)}
    ${esComun ? citaFuente(t.escala_combinada.fuente_estatal) + citaFuente(t.escala_combinada.fuente_autonomica) : citaFuente(t.escala_combinada.fuente_autonomica)}
    ${igual26 ? `<p>En 2026 la tarifa de ${esc(nombre)} no cambia: los tramos y los tipos son los mismos que en 2025.</p>` : ""}
  </div>${con26 && !igual26 ? `
  <div class="tarjeta">
    <h2 class="rotulo">Tabla de tramos del IRPF en ${esc(nombre)} 2026</h2>
    <p>Para 2026 la norma foral actualiza los límites de los tramos; los tipos no cambian.</p>
    ${tablaEscala(esc26.tramos)}
    ${citaFuente(esc26)}
  </div>` : ""}`;

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

  const anios = con26 ? "2025 y 2026" : "2025";
  const resumen = `en ${esc(nombre)} el IRPF de 2025 va del <b>${esc(pctCorto(tMin))}</b> al <b>${esc(pctCorto(tMax))}</b>${esComun ? " (escala estatal y autonómica sumadas)" : ", con su tarifa foral"}; el tipo máximo se aplica desde ${esc(euros(desdeMax))} de base liquidable. Con 30.000 € brutos al año, una persona sin hijos paga <b>${esc(euros(fila30.cuota_liquida_total))}</b> de IRPF (tipo medio del ${esc(pct(fila30.tipo_medio_efectivo))}), el puesto ${fila30.puesto} de 19.`;
  const faq = [
    [`¿Cuáles son los tramos del IRPF en ${nombre} en 2025?`, `${tr.length} tramos, del ${pctCorto(tMin)} al ${pctCorto(tMax)}${esComun ? ", ya sumadas la escala estatal y la autonómica" : ""}. El tipo máximo se aplica a la base liquidable general que pasa de ${euros(desdeMax)}.`],
    [`¿Cuánto IRPF se paga con 30.000 € en ${nombre}?`, `${euros(fila30.cuota_liquida_total)} al año (tipo medio del ${pct(fila30.tipo_medio_efectivo)}) para una persona de 40 años, sin hijos y con un solo pagador, en 2025. Es el puesto ${fila30.puesto} de 19 territorios, de más barato a más caro.`],
    esComun
      ? [`¿Quién fija el IRPF en ${nombre}?`, `El Estado fija la escala estatal y ${nombre} su escala autonómica, que se suma a la estatal. ${nombre} también aprueba sus propias deducciones autonómicas.`]
      : [`¿Se aplica la escala estatal en ${nombre}?`, `No. ${nombre} tiene su propio IRPF foral: aplica su tarifa completa y sus deducciones, no la escala estatal ni las autonómicas.`]
  ];
  if (con26) faq.push([`¿Cambia la tabla del IRPF de ${nombre} en 2026?`, igual26
    ? `No: en 2026 la tarifa de ${nombre} mantiene los mismos tramos y tipos que en 2025.`
    : `Sí: para 2026 se actualizan los límites de los tramos (el primero pasa de ${euros(tr[0].hasta)} a ${euros(esc26.tramos[0].hasta)}); los tipos, del ${pctCorto(tMin)} al ${pctCorto(tMax)}, no cambian.`]);
  const main = `
  <h1>${esComun ? `IRPF en ${esc(nombre)} ${anios}: tramos y tabla` : `Tablas IRPF ${esc(nombre)} ${anios}: escala de la tarifa foral`}</h1>
  ${esComun ? "" : `<div class="prosa">${cartaEscala}</div>`}
  ${respuestaDirecta(resumen)}
  ${intro}
  <div class="prosa">
  ${esComun ? cartaEscala : ""}
  ${cartaMinimo}
  ${cartaDeducciones}${enlacesSuiteForal(codigo, nombre)}
  ${cartaComparativa}
  ${bloqueFaq(faq)}
  <p><a class="btn btn-pri" href="/index.html#calculadora">Calcula tu caso real en ${esc(nombre)}</a> <a class="btn btn-sec" href="/index.html#comparar">Compáralo con los otros 18 territorios</a></p>
  <p class="ayuda">Guías: <a href="/guias/tramos-irpf-2025-2026/">tramos del IRPF 2025 y 2026</a> · <a href="/guias/minimo-personal-familiar/">mínimo personal y familiar</a> · <a href="/guias/obligacion-declarar-renta/">¿estoy obligado a declarar?</a> · <a href="/guias/plan-pensiones-desgravar/">plan de pensiones</a> · <a href="/guias/deduccion-donativos/">donativos</a> · <a href="/guias/calendario-renta/">calendario de la renta</a></p>
  </div>`;

  return layout({
    jsonld: [jsonLdMigas([["Inicio", "/"], ["IRPF por territorio", "/irpf/"], [nombre, `/irpf/${slug}/`]]), jsonLdFaq(faq),
      jsonLdDataset({ nombre: `Escala del IRPF en ${nombre} ${anios}`, descripcion: `Tramos de la base liquidable general y tipo marginal del IRPF en ${nombre}${esComun ? " (escala estatal más autonómica)" : " (tarifa foral)"}, del ${pctCorto(tMin)} al ${pctCorto(tMax)}.`, ruta: `/irpf/${slug}/`, generado: territorios.generado, ambito: nombre, fuentes: fuentesEscala.flatMap(f => [f.norma, f.fuente]) })],
    title: !esComun
      ? `Tablas IRPF ${corto} ${anios}: escala del ${pctCorto(tMin)} al ${pctCorto(tMax)}`
      : con26 ? `IRPF ${corto} 2025 y 2026: tabla de tramos hasta el ${pctCorto(tMax)}` : `Tramos IRPF ${corto} 2025: tabla del ${pctCorto(tMin)} al ${pctCorto(tMax)}`,
    description: !esComun
      ? `Tablas IRPF ${anios} de ${corto}: escala foral con ${tr.length} tramos, del ${pctCorto(tMin)} al ${pctCorto(tMax)}. Con 30.000 € brutos pagas ${euros(fila30.cuota_liquida_total)}. Calculadora gratis.`
      : `Tabla del IRPF en ${corto} ${anios}: tramos del ${pctCorto(tMin)} al ${pctCorto(tMax)}. Con 30.000 € brutos pagas ${euros(fila30.cuota_liquida_total)} (puesto ${fila30.puesto} de 19). Calculadora gratis.`,
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
  ${respuestaDirecta(`con ${esc(eurosSalario(salario))} brutos al año, el IRPF de 2025 va de <b>${esc(euros(masBarato.cuota_liquida_total))}</b> en ${esc(masBarato.nombre)} a <b>${esc(euros(masCaro.cuota_liquida_total))}</b> en ${esc(masCaro.nombre)}.`)}
  <p class="entradilla">Comparativa de los 19 territorios fiscales de España con el mismo sueldo bruto. ${esc(comparativas.supuesto)}</p>
  <div class="prosa">
  <div class="tarjeta">
    <p>Con ${esc(eurosSalario(salario))} brutos, la cuota líquida va de <b>${esc(euros(masBarato.cuota_liquida_total))}</b> en ${esc(masBarato.nombre)} a <b>${esc(euros(masCaro.cuota_liquida_total))}</b> en ${esc(masCaro.nombre)}: una diferencia de ${esc(difEuros(masCaro.cuota_liquida_total, masBarato.cuota_liquida_total))} al año entre el territorio más barato y el más caro, para el mismo caso.</p>
  </div>
  <div class="tarjeta tarjeta-tabla">
    <h2 class="rotulo">Los 19 territorios, de menos a más IRPF</h2>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th class="num">Puesto</th><th>Territorio</th><th class="num">Cuota líquida</th><th class="num">Tipo medio efectivo</th></tr></thead><tbody>${filasHtml}</tbody></table></div>
  </div>
  <p><a class="btn btn-pri" href="/index.html#calculadora">Calcula tu caso real, con tu sueldo y tu situación</a> <a class="btn btn-sec" href="/sueldo-neto/${salario}/">Sueldo neto de ${esc(eurosSalario(salario))} en 12 y 14 pagas</a></p>
  </div>`;

  return layout({
    title: `IRPF con ${eurosSalario(salario)} brutos 2025: de ${euros(masBarato.cuota_liquida_total)} a ${euros(masCaro.cuota_liquida_total)}`,
    description: `Con ${eurosSalario(salario)} brutos pagas ${euros(masBarato.cuota_liquida_total)} de IRPF en ${NOMBRE_CORTO[masBarato.territorio]} y ${euros(masCaro.cuota_liquida_total)} en ${NOMBRE_CORTO[masCaro.territorio]} (2025). Ranking de los 19 y calculadora gratis.`,
    canonical: `/comparar-sueldo/${salario}/`,
    breadcrumb: `<a href="/index.html">Inicio</a> › <a href="/comparar-sueldo/">Dónde se paga menos IRPF</a> › ${esc(eurosSalario(salario))}`,
    main, generado: territorios.generado
  });
}

// ---- índices ------------------------------------------------------------------------
function paginaIndiceTerritorios() {
  const filas = ORDEN_TERRITORIOS.map(c => `<li><a href="/irpf/${SLUG[c]}/">IRPF en ${esc(territorios.territorios[c].nombre)}</a></li>`).join("");
  const main = `
  <h1>IRPF por comunidad autónoma y territorio foral (2025)</h1>
  <p class="entradilla">Tramos, mínimo personal y comparativa de cada uno de los 19 territorios fiscales de España: las 15 comunidades autónomas de régimen común, las tres diputaciones forales del País Vasco y Navarra.</p>
  <div class="prosa"><ul class="lista-enlaces">${filas}</ul>
  <div class="tarjeta"><h2 class="rotulo">Deducciones por territorio</h2><ul class="lista-enlaces">${ORDEN_TERRITORIOS.filter(c => conDeducciones.has(c)).map(c => `<li><a href="/irpf/${SLUG[c]}/deducciones/">Deducciones en ${esc(territorios.territorios[c].nombre)}</a></li>`).join("")}</ul></div>
  <div class="tarjeta"><h2 class="rotulo">Guías del IRPF</h2><ul class="lista-enlaces">${GUIAS.map(g => `<li><a href="/guias/${g.slug}/">${esc(g.enlace)}</a></li>`).join("")}</ul><p><a href="/guias/">Todas las guías</a></p></div>
  </div>`;
  return layout({
    jsonld: [jsonLdMigas([["Inicio", "/"], ["IRPF por territorio", "/irpf/"]])],
    title: "IRPF por comunidad autónoma 2025: tramos de los 19 territorios",
    description: "Tablas de tramos del IRPF 2025 en las 15 comunidades autónomas, Bizkaia, Gipuzkoa, Álava y Navarra: tipos, mínimo personal y deducciones. Calculadora gratis.",
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
    title: "Dónde se paga menos IRPF en España 2025: ranking de 19",
    description: "Ranking del IRPF 2025 en los 19 territorios fiscales con sueldos de 20.000 a 100.000 €: de menos a más impuesto y tipo medio. Calculadora gratis.",
    canonical: "/comparar-sueldo/", breadcrumb: `<a href="/index.html">Inicio</a> › Dónde se paga menos IRPF`, main, generado: territorios.generado
  });
}

// ---- generar --------------------------------------------------------------------------
// Devuelve { ficheros: Map<ruta relativa a web/, contenido>, avisos, recuento } sin escribir
// nada: lo usan la escritura, `--comprobar` y test/contenidos.test.mjs.
// ---- fechas de cambio por página ------------------------------------------------------
// web/datos/seo_fechas.json guarda, por fichero, el hash del contenido y la fecha en que cambió
// por última vez. Es versionado y determinista: con el registro al día, --comprobar no necesita
// el historial de git (la CI clona con poca profundidad) ni la fecha de hoy. Si una página cambia
// y no se regenera, su hash ya no coincide, la fecha pasaría a hoy y --comprobar falla.
// La portada (web/index.html) no se genera aquí, pero entra en el registro por su hash.
export const REGISTRO_FECHAS = "datos/seo_fechas.json";
const hoyIso = () => process.env.MAPAFISCAL_HOY || new Date().toISOString().slice(0, 10);
// Solo para páginas que aún no están en el registro (el primer arranque, o al recuperar una
// rama): recorre los commits disponibles y toma la fecha del más antiguo desde el que el texto
// de la página ya era el de hoy, ignorando todas las fechas (las de generación cambiaban en cada
// exportación). No se usa al comprobar: allí cualquier página nueva sin registro ya es un fallo.
const MESES_RE = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre";
// También la línea «Actualizado el …» y el sufijo « | Mapafiscal» del título, que la maqueta
// añadió o quitó en todas las páginas a la vez sin cambiar el texto.
const sinFechas = s => s.replace(/\n\s*<p class="actualizado">.*<\/p>/, "").replace(/ \| Mapafiscal<\/title>/, "</title>").replace(/@@FECHA_CONTENIDO(_LARGA)?@@/g, "").replace(/\d{4}-\d{2}-\d{2}/g, "")
  .replace(new RegExp(`\\d{1,2} de (${MESES_RE}) de \\d{4}`, "g"), "");
function previaGit(ficheros) {
  const git = (args, input) => execFileSync("git", args, { cwd: RAIZ, input, maxBuffer: 1 << 30, stdio: ["pipe", "pipe", "ignore"] });
  let commits;
  try { commits = git(["log", "--format=%H %cs", "--", "web"]).toString().trim().split("\n").filter(Boolean).map(l => l.split(" ")); }
  catch { return () => null; }
  const rutas = [...ficheros.keys()].filter(r => r.endsWith(".html"));
  const actual = new Map(rutas.map(r => [r, hashContenido(sinFechas(ficheros.get(r)))]));
  const fecha = new Map(), cerrada = new Set();
  for (const [sha, dia] of commits) {
    const vivos = rutas.filter(r => !cerrada.has(r));
    if (!vivos.length) break;
    const sal = git(["cat-file", "--batch"], vivos.map(r => `${sha}:web/${r}`).join("\n") + "\n");
    let i = 0;
    for (const r of vivos) {
      const fin = sal.indexOf(10, i), cab = sal.subarray(i, fin).toString().split(" ");
      if (cab[1] !== "blob") { cerrada.add(r); i = fin + 1; continue; }
      const n = +cab[2], txt = sal.subarray(fin + 1, fin + 1 + n).toString("utf8");
      i = fin + 2 + n;
      if (hashContenido(sinFechas(sinCR(txt))) === actual.get(r)) fecha.set(r, dia);
      else cerrada.add(r);
    }
  }
  return r => fecha.get(r) || null;
}
function leerRegistro() {
  const p = join(WEB, REGISTRO_FECHAS);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
}

export function generar({ conGit = false } = {}) {
  territorios = leerJson("seo_territorios.json");
  comparativas = leerJson("seo_comparativas.json");
  deducciones = leerJson("seo_deducciones.json");
  guias = leerJson("seo_guias.json");
  sueldoNeto = leerJson("seo_sueldo_neto.json");
  const devuelve = leerJson("seo_devuelve.json");
  EJERCICIO.valor = territorios.ejercicio;
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
  // «¿Cuánto me devuelve?»: las páginas sin cifra van con noindex y fuera del sitemap.
  for (const p of paginasDevuelve(devuelve, conDeducciones)) p.indexable ? pagina(p.ruta, p.html) : ficheros.set(p.ruta.slice(1) + "index.html", p.html);
  for (const g of paginasForal(territorios.generado, sueldoNeto.importes_territorio)) pagina(g.ruta, g.html);

  // «Cómo comprobamos los cálculos»: la escribe tools/generar_validacion.mjs; aquí solo va al sitemap
  urls.push("/validacion/");
  // Fecha real de cambio de cada página (y de la portada, que se escribe a mano).
  const generados = [territorios, comparativas, deducciones, guias, sueldoNeto, devuelve].map(d => d.generado).filter(Boolean);
  const anterior = leerRegistro();
  const conPortada = new Map(ficheros);
  conPortada.set("index.html", sinCR(readFileSync(join(WEB, "index.html"), "utf8")));
  // «Cómo comprobamos los cálculos» la escribe tools/generar_validacion.mjs, pero su fecha va aquí.
  const VALIDACION = "validacion/index.html";
  if (existsSync(join(WEB, VALIDACION))) conPortada.set(VALIDACION, sinCR(readFileSync(join(WEB, VALIDACION), "utf8")));
  const registro = fecharContenido(conPortada, anterior, { generados, hoy: hoyIso(), previa: conGit ? previaGit(conPortada) : undefined });
  for (const [r, html] of conPortada) if (r !== "index.html" && r !== VALIDACION) ficheros.set(r, html);
  ficheros.set(REGISTRO_FECHAS, "{\n" + Object.entries(registro).map(([r, v]) => ` ${JSON.stringify(r)}: ${JSON.stringify(v)}`).join(",\n") + "\n}\n");
  const lastmod = u => registro[u.replace(/^\//, "") + "index.html"].fecha;
  ficheros.set("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITIO}/</loc><lastmod>${registro["index.html"].fecha}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
${urls.map(u => `<url><loc>${SITIO}${u}</loc><lastmod>${lastmod(u)}</lastmod><changefreq>monthly</changefreq><priority>${u.startsWith("/guias/") || u === "/irpf/" ? "0.8" : "0.7"}</priority></url>`).join("\n")}
</urlset>
`);
  ficheros.set("robots.txt", robotsTxt());
  ficheros.set("llms.txt", llmsTxt({ territorios, comparativas, guias, GUIAS, conDeducciones }));
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
  recorrer("cuanto-me-devuelve");
  return fuera;
}


if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const comprobar = process.argv.includes("--comprobar");
  const { ficheros, avisos, recuento, urls } = generar({ conGit: !comprobar });
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
