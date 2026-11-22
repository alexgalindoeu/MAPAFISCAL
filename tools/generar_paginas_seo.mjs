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
import { SITIO, SLUG, ORDEN_TERRITORIOS, HERRAMIENTA, NOMBRE_CORTO, esc, euros, eurosExactos, difEuros, pct, pctCorto, tablaEscala, citaFuente, layout, jsonLdMigas, jsonLdFaq, jsonLdDataset, bloqueFaq, respuestaDirecta, migasHtml, fecharContenido, hashContenido, EJERCICIO } from "./seo_comun.mjs";
import { robotsTxt, llmsTxt } from "./seo_ia.mjs";
import { paginaDeducciones, CAMPO } from "./seo_deducciones.mjs";
import { paginasFichasDeduccion } from "./seo_deduccion_ficha.mjs";
import { paginasGuias, GUIAS } from "./seo_guias.mjs";
import { paginasSueldoNeto } from "./seo_sueldo_neto.mjs";
import { graficoBrutoNeto, serieSueldoNeto } from "./seo_grafico.mjs";
import { paginasRescate } from "./seo_rescate.mjs";
import { paginasConjuntaPagadores, CARPETAS_CONJUNTA } from "./seo_conjunta.mjs";
import { paginasDevuelve } from "./seo_devuelve.mjs";
import { paginasAutonomos, HUB_AUTONOMOS } from "./seo_autonomos.mjs";
import { paginaMetodologia } from "./seo_metodologia.mjs";
import { paginasGlosario, enlazarGlosario, HUB_GLOSARIO } from "./seo_glosario.mjs";
import { paginasVivienda, PAGINAS_VIVIENDA, HUB_VIVIENDA } from "./seo_vivienda.mjs";
import { paginasForal, enlacesSuiteForal, enlacesVascos, escalasAhorro, ejemploPasoAPaso, normaDelTerritorio, rasgoForalDe, paramsForal, BOLETIN } from "./seo_foral.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(RAIZ, "web");
const sinCR = s => s.replace(/\r/g, "");
const leerJson = f => JSON.parse(readFileSync(join(WEB, "datos", f), "utf8"));

let territorios, comparativas, deducciones, guias, sueldoNeto;
const eurosSalario = euros;
const REGIMEN_ETIQUETA = { comun: "régimen común", foral_pais_vasco: "concierto económico del País Vasco", foral_navarra: "convenio económico de Navarra" };
// Territorios con página de deducciones (se rellena al generar).
const conDeducciones = new Set();
const HACIENDA_FAQ = { "ES-PV-BI": "La Hacienda Foral de Bizkaia", "ES-PV-SS": "La Hacienda Foral de Gipuzkoa", "ES-PV-VI": "La Hacienda Foral de Álava", "ES-NC": "La Hacienda Foral de Navarra" };

// Curva del bruto al neto del territorio (cifras de seo_sueldo_neto.json, motor R).
function graficoTerritorio(codigo, nombre) {
  const serie = serieSueldoNeto(sueldoNeto, codigo);
  return graficoBrutoNeto({ serie, titulo: `Sueldo neto e IRPF en ${nombre} según el bruto (${sueldoNeto.ejercicio})`,
    pie: `Neto mensual en 12 pagas y tipo medio del IRPF en ${nombre} para sueldos brutos de ${euros(serie[0].bruto)} a ${euros(serie.at(-1).bruto)} al año, ejercicio ${sueldoNeto.ejercicio}: persona soltera, sin hijos, de ${sueldoNeto.supuesto.edad} años y con contrato indefinido.` });
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
  let cartaEscala = `<div class="tarjeta">
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

  // Páginas forales: las dos tarifas completas con ancla, la escala del ahorro, un ejemplo
  // paso a paso con el motor y un índice de contenidos arriba.
  let indiceForal = "", cartasForal = "", faqForal = [];
  if (!esComun) {
    const anioTabla = (anio, tramos, fuente, nota) => `<div class="tarjeta" id="tabla-${anio}">
    <h2 class="rotulo">Tabla de tramos del IRPF en ${esc(nombre)} ${anio}</h2>
    ${nota ? `<p>${nota}</p>` : ""}
    ${tablaEscala(tramos)}
    ${citaFuente({ norma: normaDelTerritorio(codigo, fuente.norma), fuente: fuente.fuente })}
  </div>`;
    const f25 = t.escala_combinada.fuente_autonomica;
    cartaEscala = anioTabla(2025, tr, f25, "") + (con26 ? anioTabla(2026, esc26.tramos, esc26, igual26
      ? `En 2026 la tarifa de ${esc(nombre)} no cambia: los tramos y los tipos son los mismos que en 2025.`
      : "Para 2026 la norma foral actualiza los límites de los tramos; los tipos no cambian.") : "");
    const ahorro = escalasAhorro(codigo, con26 ? [2025, 2026] : [2025]);
    const ahorroIgual = ahorro.length === 2 && JSON.stringify(ahorro[0].tramos) === JSON.stringify(ahorro[1].tramos);
    const cartaAhorro = !ahorro.length ? "" : `<div class="tarjeta" id="tabla-ahorro">
    <h2 class="rotulo">Escala del ahorro en ${esc(nombre)} ${ahorro.map(a => a.ejercicio).join(" y ")}</h2>
    <p>Los intereses, los dividendos y las ganancias por venta de bienes forman la base liquidable del ahorro, que tributa con una escala propia, aparte de la tarifa general.${ahorroIgual ? ` En ${ahorro[1].ejercicio} la escala no cambia.` : ""}</p>
    ${(ahorroIgual ? [ahorro[0]] : ahorro).map(a => `${ahorro.length > 1 && !ahorroIgual ? `<h3>${a.ejercicio}</h3>` : ""}${tablaEscala(a.tramos, "Tramo de la base liquidable del ahorro")}`).join("")}
    <p class="ayuda">Norma: ${esc(normaDelTerritorio(codigo, f25.norma).replace(/^Art\. \d+(\.\d+)? /, ""))} (escala del ahorro). Es la que aplica la calculadora.</p>
  </div>`;
    const ej = ejemploPasoAPaso(codigo, 2025, 30000);
    let cartaEjemplo = "";
    if (ej && Math.abs(ej.cuotaLiquida - fila30.cuota_liquida_total) < 0.005) {
      const ex = eurosExactos;
      const filasTr = ej.tramos.map(x => `<tr><td>${esc(ex(x.desde))} a ${esc(ex(x.hasta))}</td><td class="num">${esc(ex(x.parte))}</td><td class="num">${esc(pct(x.tipo))}</td><td class="num">${esc(ex(x.cuota))}</td></tr>`).join("");
      cartaEjemplo = `<div class="tarjeta tarjeta-tabla" id="ejemplo-30000">
    <h2 class="rotulo">Ejemplo paso a paso: 30.000 € brutos en ${esc(nombre)} (2025)</h2>
    <p class="ayuda">${esc(comparativas.supuesto)}</p>
    <ol>
      <li>Sueldo bruto: <b>${esc(ex(ej.bruto))}</b>. Menos ${esc(ex(ej.cotizaciones))} de cotizaciones a la Seguridad Social: rendimiento de ${esc(ex(ej.trabajoPrevio))}.</li>
      ${ej.reduccionTrabajo ? `<li>Menos ${esc(ex(ej.reduccionTrabajo))} de bonificación del trabajo: rendimiento neto de ${esc(ex(ej.trabajoPrevio - ej.reduccionTrabajo))}.</li>` : ""}
      <li>Base liquidable general: <b>${esc(ex(ej.base))}</b>.</li>
      <li>Cuota íntegra con la tarifa, tramo a tramo (tabla siguiente): <b>${esc(ex(ej.cuotaIntegra))}</b>.</li>
      ${ej.restas.map(([n, v]) => `<li>${esc(n)}: −${esc(ex(v))}.</li>`).join("")}
      <li>Cuota líquida (IRPF del año): <b>${esc(ex(ej.cuotaLiquida))}</b>.</li>
    </ol>
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Tramo de la base</th><th class="num">Base en el tramo</th><th class="num">Tipo</th><th class="num">Cuota</th></tr></thead><tbody>${filasTr}<tr><td><b>Cuota íntegra</b></td><td class="num">${esc(ex(ej.base))}</td><td></td><td class="num"><b>${esc(ex(ej.cuotaIntegra))}</b></td></tr></tbody></table></div>
    <p class="ayuda">Cálculo del mismo motor que la calculadora. <a href="/irpf/${slug}/simulador-renta/">Simula tu caso</a>.</p>
  </div>`;
    }
    cartasForal = cartaAhorro + cartaEjemplo;
    const ind = [["tabla-2025", `Tabla IRPF ${nombre} 2025`], con26 && ["tabla-2026", `Tabla IRPF ${nombre} 2026`],
      cartaAhorro && ["tabla-ahorro", "Escala del ahorro"], cartaEjemplo && ["ejemplo-30000", "Ejemplo con 30.000 €"], ["preguntas", "Preguntas frecuentes"]].filter(Boolean);
    indiceForal = `<nav class="tarjeta indice" aria-label="Contenido"><h2 class="rotulo">En esta página</h2><ul class="lista-enlaces">${ind.map(([id, txt]) => `<li><a href="#${id}">${esc(txt)}</a></li>`).join("")}</ul></nav>`;
    const art = n => n.replace(/^Art\./, "art.");
    const e = guias.escalas.estatal_2025.tramos;
    const P25 = paramsForal(2025);
    const rasgo = P25 ? rasgoForalDe(P25, codigo).replace(/&[a-z#0-9]+;/g, " ") : "";
    faqForal = [
      [`¿Qué diferencia hay entre las tablas de ${nombre} y las del régimen común?`, `En régimen común la escala tiene dos mitades, la estatal (del ${pctCorto(e[0].tipo)} al ${pctCorto(e[e.length - 1].tipo)}, ${art(guias.escalas.estatal_2025.norma)}) y la autonómica, que se suman. ${nombre} aplica una tarifa foral única de ${tr.length} tramos, del ${pctCorto(tMin)} al ${pctCorto(tMax)}. ${rasgo}`.trim()],
      [`¿Dónde se publica la tabla oficial del IRPF de ${nombre}?`, `En el ${BOLETIN[codigo]}. La tarifa de 2025 está en el ${art(normaDelTerritorio(codigo, f25.norma))}${con26 && !igual26 ? `; la de 2026, en el ${art(normaDelTerritorio(codigo, esc26.norma))}` : ""}. ${HACIENDA_FAQ[codigo]} la recoge también en su información de la campaña de la renta.`]
    ];
  }

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
    <div class="envoltorio"><table class="cobertura"><thead><tr><th>Sueldo bruto</th><th class="num">Puesto (de más barato a más caro)</th><th class="num">Cuota líquida</th><th class="num">Tipo medio</th><th><span class="sr-only">Acción</span></th></tr></thead><tbody>${filasComparativa}</tbody></table></div>
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
  faq.push(...faqForal);
  const main = `
  <h1>${esComun ? `IRPF en ${esc(nombre)} ${anios}: tramos y tabla` : `Tablas IRPF ${esc(nombre)} ${anios}: escala de la tarifa foral`}</h1>
  ${esComun ? "" : `<div class="prosa">${indiceForal}${cartaEscala}</div>`}
  ${respuestaDirecta(resumen)}
  ${intro}
  <div class="prosa">
  ${esComun ? cartaEscala : ""}
  ${cartaMinimo}
  ${cartasForal}${cartaDeducciones}${enlacesSuiteForal(codigo, nombre)}${enlacesVascos(codigo)}
  ${cartaComparativa}
  ${graficoTerritorio(codigo, nombre)}
  ${esComun ? bloqueFaq(faq) : bloqueFaq(faq).replace('class="tarjeta faq"', 'class="tarjeta faq" id="preguntas"')}
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
  const ded = [], fichasDed = [];
  for (const codigo of ORDEN_TERRITORIOS) {
    const t = deducciones.territorios[codigo];
    if (!t) continue;
    const p = paginaDeducciones(codigo, t, deducciones.generado, avisos);
    if (p) { conDeducciones.add(codigo); ded.push(p); fichasDed.push({ codigo, t, p }); }
  }
  // Una página por deducción, colgando de la de su territorio.
  const porDeduccion = paginasFichasDeduccion(fichasDed, deducciones.generado, deducciones.ejercicio, CAMPO);
  for (const codigo of ORDEN_TERRITORIOS) {
    pagina(`/irpf/${SLUG[codigo]}/`, enlazarGlosario(paginaTerritorio(codigo)));
    const p = ded.find(x => x.ruta === `/irpf/${SLUG[codigo]}/deducciones/`);
    if (p) pagina(p.ruta, p.html);
    for (const f of porDeduccion.filter(x => x.codigo === codigo)) pagina(f.ruta, f.html);
  }
  pagina("/irpf/", enlazarGlosario(paginaIndiceTerritorios()));
  for (const s of comparativas.salarios) pagina(`/comparar-sueldo/${s}/`, paginaSalario(s));
  pagina("/comparar-sueldo/", paginaIndiceSalarios());
  const gs = paginasGuias(guias, territorios);
  // primera aparición de los términos clave → glosario (como mucho 3 por página)
  for (const g of gs) pagina(g.ruta, g.ruta === "/guias/" ? g.html : enlazarGlosario(g.html));
  // Sección «Vivienda» (/vivienda/): ejemplos con el motor JS sobre params.json
  const viv = paginasVivienda(guias);
  for (const v of viv) pagina(v.ruta, enlazarGlosario(v.html));
  const glo = paginasGlosario({ comparativas, guias, generado: territorios.generado });
  for (const g of glo) pagina(g.ruta, g.html);
  const sn = paginasSueldoNeto(sueldoNeto);
  for (const p of sn) pagina(p.ruta, p.html);
  for (const g of paginasRescate(territorios.generado)) pagina(g.ruta, g.html);
  for (const g of paginasConjuntaPagadores(territorios.generado)) pagina(g.ruta, g.html);
  // «¿Cuánto me devuelve?»: las páginas sin cifra van con noindex y fuera del sitemap.
  for (const p of paginasDevuelve(devuelve, conDeducciones)) p.indexable ? pagina(p.ruta, p.html) : ficheros.set(p.ruta.slice(1) + "index.html", p.html);
  for (const g of paginasForal(territorios.generado, sueldoNeto.importes_territorio)) pagina(g.ruta, g.html);
  // Sección «Autónomos» (/autonomos/): IRPF de actividades económicas con el motor JS
  const aut = paginasAutonomos(territorios.ejercicio, territorios.generado);
  for (const a of aut) pagina(a.ruta, a.html);

  pagina("/metodologia/", paginaMetodologia(territorios.generado));
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
${urls.map(u => `<url><loc>${SITIO}${u}</loc><lastmod>${lastmod(u)}</lastmod><changefreq>monthly</changefreq><priority>${u.startsWith("/guias/") || u.startsWith(HUB_VIVIENDA) || u === "/irpf/" || u === HUB_GLOSARIO || u === HUB_AUTONOMOS ? "0.8" : "0.7"}</priority></url>`).join("\n")}
</urlset>
`);
  ficheros.set("robots.txt", robotsTxt());
  ficheros.set("llms.txt", llmsTxt({ territorios, comparativas, guias, GUIAS, conDeducciones, VIVIENDA: PAGINAS_VIVIENDA, AUTONOMOS: aut }));
  return {
    ficheros, avisos, urls,
    recuento: { territorios: ORDEN_TERRITORIOS.length, sueldos: comparativas.salarios.length, deducciones: ded.length, porDeduccion: porDeduccion.length, guias: gs.length - 1, sueldoNeto: sn.length - 1, glosario: glo.length - 1, vivienda: viv.length - 1, autonomos: aut.length - 1, indices: 7 }
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
    const dd = join(irpf, d, "deducciones");
    if (existsSync(dd)) for (const s of readdirSync(dd, { withFileTypes: true })) {
      const rs = `irpf/${d}/deducciones/${s.name}/index.html`;
      if (s.isDirectory() && existsSync(join(WEB, rs)) && !ficheros.has(rs)) fuera.push(rs);
    }
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
  recorrer("glosario");
  recorrer("vivienda");
  recorrer("autonomos");
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
    console.log(`Páginas SEO: ${recuento.territorios} territorios + ${recuento.deducciones} de deducciones (${recuento.porDeduccion} fichas) + ${recuento.sueldos} sueldos + ${recuento.guias} guías + ${recuento.sueldoNeto} de sueldo neto + ${recuento.glosario} términos del glosario + ${recuento.vivienda} de vivienda + ${recuento.autonomos} de autónomos + ${recuento.indices} índices.`);
    console.log(`sitemap.xml: ${urls.length + 1} URLs.`);
  }
}
