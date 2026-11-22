// Suite foral (tools/seo_foral.mjs): 6 páginas por territorio foral y la comparativa del
// País Vasco, enlazadas desde /irpf/<territorio>/ y en el sitemap, con cifras del motor.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { generar } from "../tools/generar_paginas_seo.mjs";
import { FORALES, SECCIONES } from "../tools/seo_foral.mjs";
import { SLUG } from "../tools/seo_comun.mjs";

const require = createRequire(import.meta.url);
const motor = require("../web/js/irpfsim.js");
const { ficheros, urls } = generar();

test("25 páginas forales, en el sitemap y enlazadas desde la página del territorio", () => {
  let n = 0;
  for (const t of FORALES) {
    const hub = ficheros.get(`irpf/${SLUG[t]}/index.html`);
    for (const [s] of SECCIONES) {
      const r = `/irpf/${SLUG[t]}/${s}/`;
      assert.ok(ficheros.has(r.slice(1) + "index.html"), r);
      assert.ok(urls.includes(r), r + " en el sitemap");
      assert.ok(hub.includes(`href="${r}"`), r + " enlazada");
      n++;
    }
  }
  assert.ok(ficheros.has("irpf/pais-vasco/index.html") && urls.includes("/irpf/pais-vasco/"));
  assert.equal(n + 1, 25);
  assert.ok(!ficheros.get("irpf/madrid/index.html").includes("a fondo"), "solo en los forales");
});

test("las cifras salen del motor y no hay avisos de obra", () => {
  const P = JSON.parse(readFileSync(new URL("../web/datos/params.json", import.meta.url), "utf8"));
  const s = motor.sueldoNeto({ bruto: 30000, territorio: "ES-PV-BI", edad: 40, hijos: [], tipoContrato: "indefinido" }, P);
  const miles = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
  assert.ok(ficheros.get("irpf/bizkaia/sueldo-neto/index.html").includes(miles(s.neto)));
  assert.ok(ficheros.get("irpf/pais-vasco/index.html").includes(miles(s.neto)));
  for (const [r, html] of ficheros) if (/^irpf\/(bizkaia|gipuzkoa|araba-alava|navarra|pais-vasco)\/(?!deducciones)/.test(r) && r.split("/").length > 3 || r === "irpf/pais-vasco/index.html")
    assert.ok(!/provisional|incompleto|undefined|NaN/i.test(html), r);
});

// Página principal de cada foral: «La renta en <territorio>», tabla de tipos por sueldo con el
// motor JS y preguntas que responden a «renta / IRPF / fiscalidad / tipo marginal <territorio>».
const P_DEF = JSON.parse(readFileSync(new URL("../web/datos/params.json", import.meta.url), "utf8"));
const CORTO = { "ES-PV-BI": "Bizkaia", "ES-PV-SS": "Gipuzkoa", "ES-PV-VI": "Álava", "ES-NC": "Navarra" };
const eur = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
const pc = x => (100 * x).toFixed(1).replace(".", ",") + " %";
const titulo = h => h.match(/<title>([^<]*)<\/title>/)[1];
const ld = h => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const escHtml = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

test("página principal foral: renta, tipos por sueldo del motor y FAQ en el JSON-LD", () => {
  for (const t of FORALES) {
    const h = ficheros.get(`irpf/${SLUG[t]}/index.html`), c = CORTO[t];
    assert.match(h, /id="renta"/, t);
    assert.ok(h.includes(`La renta en ${c}`), t);
    assert.ok(h.includes(t === "ES-NC" ? "Gobierno de Navarra" : "Diputación Foral de"), t);
    assert.match(h, /id="tipos-por-sueldo"/, t);
    assert.ok(titulo(h).startsWith(`IRPF ${c} `) && titulo(h).length <= 65, titulo(h));
    // fila de 40.000 € del ejercicio por defecto, calculada aquí con el motor
    const as = { id: "d1", rol: "declarante", edad: 40, trabajo: { dinerarias: 40000, cotizacionesSs: motor.cotizacionesTrabajador(40000, P_DEF) } };
    const liq = motor.liquidar({ territorio: t, ejercicio: P_DEF.ejercicio, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no", miembros: [as] }, P_DEF, "auto");
    const escala = t === "ES-NC" ? P_DEF.navarra.escala_general_foral : P_DEF.foral_pv.escala_general_foral;
    const i = h.indexOf('id="tipos-por-sueldo"'), fila = h.slice(i, h.indexOf("</table>", i)).split("<tr>").find(f => f.includes(">40.000 €<"));
    const x = motor.irpfAnual(liq);
    for (const v of [eur(x), pc(x / 40000), pc(motor.tipoMarginal(liq.baseLiquidableGeneral, escala))]) assert.ok(fila.includes(v), `${t}: ${v}`);
    const faq = ld(h).find(o => o["@type"] === "FAQPage").mainEntity;
    assert.ok(faq.some(q => q.name.startsWith(`¿Quién gestiona la renta y la fiscalidad de ${c}`)), t);
    assert.ok(faq.some(q => q.name.startsWith(`¿Cuál es el tipo marginal del IRPF en ${c}`)), t);
    // cada respuesta del JSON-LD se lee igual en la página
    for (const q of faq) assert.ok(h.includes(escHtml(q.acceptedAnswer.text)), `${t}: ${q.name}`);
    // la tarifa foral no sale de la Ley 35/2006: el Dataset no la cita
    const ds = ld(h).find(o => o["@type"] === "Dataset");
    assert.ok(!ds.citation.some(u => u.includes("BOE-A-2006-20764")), t);
    assert.equal(ds.temporalCoverage, "2025/2026");
  }
});

test("simulador foral: «Simulador renta <año> <territorio>» y enlace a la calculadora con el territorio", () => {
  const ej = P_DEF.ejercicio;
  for (const t of FORALES) {
    const h = ficheros.get(`irpf/${SLUG[t]}/simulador-renta/index.html`), c = CORTO[t];
    assert.ok(titulo(h).startsWith(`Simulador renta ${ej} ${c}`) && titulo(h).length <= 65, titulo(h));
    assert.ok(h.includes(`<h1>Simulador renta ${ej} ${c}`), t);
    assert.ok(h.includes(`href="/index.html#calculadora?t=${t}"`), t);
    assert.ok(h.includes(`href="/index.html#calculadora?t=${t}&ejercicio=${ej - 1}"`), t);
    assert.ok(h.includes(`Ejemplos de la renta ${ej} en ${c}`), t);
  }
});

test("enlaces internos con anclas variadas hacia las páginas forales", () => {
  const indice = ficheros.get("irpf/index.html"), pv = ficheros.get("irpf/pais-vasco/index.html");
  for (const t of FORALES) {
    const c = CORTO[t], r = `/irpf/${SLUG[t]}/`;
    assert.ok(indice.includes(`<a href="${r}">IRPF en ${c}</a>`) && indice.includes(`<a href="${r}#renta">renta ${c} `), t);
    assert.ok(indice.includes(`<a href="${r}simulador-renta/">simulador renta ${P_DEF.ejercicio} ${c}</a>`), t);
    if (t !== "ES-NC") assert.ok(pv.includes(`<a href="${r}#renta">renta ${c} `) && pv.includes(`>tablas IRPF ${c}</a>`), t);
  }
  assert.ok(ficheros.get("glosario/regimen-foral/index.html").includes('<a href="/irpf/gipuzkoa/">IRPF en Gipuzkoa</a>'));
  assert.ok(ficheros.get("glosario/minoracion-cuota/index.html").includes('href="/irpf/gipuzkoa/#renta"'));
  const anclas = new Set();
  for (const [r, h] of ficheros) if (/^sueldo-neto\/\d+\/gipuzkoa\/index\.html$/.test(r))
    for (const m of h.matchAll(/<a href="\/irpf\/gipuzkoa\/[^"]*">([^<]+)<\/a>/g)) anclas.add(m[1]);
  assert.ok(anclas.size >= 3, [...anclas].join(" | "));
});
