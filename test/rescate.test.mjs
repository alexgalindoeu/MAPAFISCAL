// Rescate del plan de pensiones: irpfsim.rescatePlan y web/js/rescate.js. Las mismas cifras
// las da el motor R (tools/validar_js.R, casos «rescate26_*»); cálculo a mano en docs/03.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const motor = require("../web/js/irpfsim.js");
const P = require("../web/datos/params_2026.json");
const C = require("../web/js/rescate.js");
const casi = (a, b, m) => assert.ok(Math.abs(a - b) < 0.015, `${m}: ${a} ≠ ${b}`);
const yo = (o = {}) => Object.assign({ territorio: "ES-MD", antes2007: 30000, despues2007: 30000, otrosIngresos: 15000,
  tipoOtros: "pension", edad: 65, anioContingencia: 2026, anios: 5 }, o);

test("plazos de la DT 12.ª.4", () => {
  assert.equal(motor.dt12EnPlazo(2024, 2026, P), true);
  assert.equal(motor.dt12EnPlazo(2023, 2026, P), false);
  assert.equal(motor.dt12EnPlazo(2014, 2022, P), true);
  assert.equal(motor.dt12EnPlazo(2012, 2026, P), false);
  assert.equal(motor.dt12EnPlazo(2008, 2018, P), true);
  assert.equal(motor.dt12EnPlazo(2008, 2019, P), false);
});

test("la reducción del 40 % baja la base en el 40 % de lo anterior a 2007", () => {
  const h = dt12 => ({ territorio: "ES-MD", ejercicio: 2026, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no",
    miembros: [{ id: "d1", rol: "declarante", edad: 66, trabajo: { dinerarias: 75000, cotizacionesSs: 0, prestacionDt12: dt12 } }] });
  const con = motor.liquidar(h(30000), P, "auto"), sin = motor.liquidar(h(0), P, "auto");
  casi(con.baseLiquidableGeneral, 61000, "75.000 − 12.000 − 2.000");
  casi(sin.baseLiquidableGeneral - con.baseLiquidableGeneral, 12000, "40 % de 30.000");
  casi(con.cuotaIntegraEstatal, 8539.25, "escala estatal sobre 61.000 − mínimo de 6.700");
  // en los forales no se aplica (sus reglas no están en el motor)
  const pv = motor.liquidar(Object.assign(h(30000), { territorio: "ES-PV-BI" }), P, "auto");
  casi(pv.baseLiquidableGeneral, motor.liquidar(Object.assign(h(0), { territorio: "ES-PV-BI" }), P, "auto").baseLiquidableGeneral, "Bizkaia");
});

test("rescate en Madrid: 60.000 € con 15.000 € de pensión", () => {
  const r = C.rescate(P, yo());
  assert.equal(r.enPlazo, true);
  casi(r.reduccion, 12000, "reducción");
  casi(r.capital.extra, 16547.61, "de una vez");
  casi(r.mixto.extra, 18474.42, "mixto en 5 años");
  casi(r.renta.extra, 21530.6, "renta en 5 años");
  assert.equal(r.mejor, "capital");
  assert.deepEqual(r.mixto.cobros, [36000, 6000, 6000, 6000, 6000]);
  // fuera de plazo, de una vez tributa más
  assert.ok(C.rescate(P, yo({ anioContingencia: 2020 })).capital.extra > r.capital.extra);
  assert.throws(() => C.rescate(P, yo({ territorio: "ES-NC" })), /régimen común/);
  const lista = C.porTerritorio(P, yo());
  assert.equal(lista.length, 15, "solo régimen común");
  for (let i = 1; i < lista.length; i++) assert.ok(lista[i - 1].minimo <= lista[i].minimo);
  assert.equal(C.porAnios(P, yo(), [2, 10]).length, 2);
});

test("la vista #rescate-plan se pinta con los datos de 2026", async () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const els = {}, oyentes = {};
  const valor = id => { const m = html.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`)) || html.match(new RegExp(`<select id="${id}">\\s*<option value="([^"]*)"`)); return m ? m[1] : ""; };
  const el = id => els[id] || (els[id] = { id, value: valor(id), textContent: "", hidden: false, className: "", _h: "",
    get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; }, addEventListener() {} });
  el("v-rescate-plan").hidden = false;
  el("rp-anios").value = "5";
  const document = { getElementById: id => html.includes(`id="${id}"`) ? el(id) : null, querySelectorAll: () => [],
    addEventListener: (t, f) => { (oyentes[t] = oyentes[t] || []).push(f); }, dispatchEvent() {} };
  const ctx = { document, location: { hash: "#rescate-plan?t=ES-AN" }, console, setTimeout, clearTimeout, Date,
    CustomEvent: class { constructor(t) { this.type = t; } }, addEventListener() {},
    fetch: async url => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL("../web/" + url, import.meta.url), "utf8")) }) };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../web/js/irpfsim.js", import.meta.url), "utf8"), ctx);
  vm.runInContext(readFileSync(new URL("../web/js/rescate.js", import.meta.url), "utf8"), ctx);
  await new Promise(r => setTimeout(r, 50));
  assert.ok(ctx.MAPAFISCAL_HERRAMIENTAS["rescate-plan"], "tarjeta de portada");
  assert.equal(els["rp-territorio"].value, "ES-AN", "el enlace ?t= elige el territorio");
  assert.match(els["rp-principal"].innerHTML, /IRPF extra por rescatar 60\.000 €/);
  assert.match(els["rp-ranking"].innerHTML, /Madrid/);
  assert.doesNotMatch(els["rp-ranking"].innerHTML, /Navarra|Bizkaia/);
  assert.doesNotMatch(els["rp-nota"].textContent + els["rp-principal"].innerHTML, /provisional|incomplet/i);
});

test("páginas SEO del rescate: índice y 15 territorios de régimen común, en el sitemap", async () => {
  const { generar } = await import("../tools/generar_paginas_seo.mjs");
  const { ficheros } = generar();
  const rutas = [...ficheros.keys()].filter(r => r.startsWith("rescate-plan-pensiones/"));
  assert.equal(rutas.length, 16);
  assert.ok(!rutas.some(r => /navarra|bizkaia|gipuzkoa|araba/.test(r)), "sin forales");
  const madrid = ficheros.get("rescate-plan-pensiones/madrid/index.html");
  assert.match(madrid, /"@type":"FAQPage"/);
  assert.match(madrid, /#rescate-plan\?t=ES-MD/);
  assert.match(madrid, /16\.548 €/, "de una vez: el mismo cálculo que la herramienta");
  assert.match(ficheros.get("sitemap.xml"), /\/rescate-plan-pensiones\/madrid\//);
  for (const r of rutas) assert.doesNotMatch(ficheros.get(r), /provisional|incomplet|@(?!type|context)[a-z]+\.[a-z]/i, r);
});
