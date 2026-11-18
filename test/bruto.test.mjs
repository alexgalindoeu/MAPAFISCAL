// Bruto necesario y comparador de ofertas: web/js/bruto.js sobre irpfsim.sueldoNeto (la
// inversa se busca por bisección; el motor no cambia).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const motor = require("../web/js/irpfsim.js");
const P = require("../web/datos/params_2026.json");
const B = require("../web/js/bruto.js");
const yo = (o = {}) => Object.assign({ territorio: "ES-MD", edad: 35, hijos: [], tipoContrato: "indefinido" }, o);

test("neto objetivo según el periodo", () => {
  assert.equal(B.netoAnualObjetivo(2000, "mes14"), 28000);
  assert.equal(B.netoAnualObjetivo(2000, "mes12"), 24000);
  assert.equal(B.netoAnualObjetivo(24000, "anio"), 24000);
  assert.equal(B.netoAnualObjetivo(-5, "anio"), 0);
});

test("el bruto necesario es el menor euro que llega al neto (inversa de sueldoNeto)", () => {
  for (const [o, n] of [[yo(), 28000], [yo({ territorio: "ES-CT", hijos: [4, 9] }), 24000], [yo({ territorio: "ES-PV-BI", tipoContrato: "temporal" }), 40000],
    [yo({ territorio: "ES-NC", edad: 66 }), 70000], [yo(), 9000]]) {
    const r = B.brutoNecesario(P, o, n);
    assert.ok(Number.isInteger(r.bruto));
    assert.ok(motor.sueldoNeto(Object.assign({}, o, { bruto: r.bruto }), P).neto >= n, "llega al neto");
    assert.ok(motor.sueldoNeto(Object.assign({}, o, { bruto: r.bruto - 1 }), P).neto < n, "un euro menos no llega");
    assert.ok(r.bruto > n);
  }
  // ida y vuelta: el neto de 30.000 € brutos pide de vuelta 30.000 €
  const s = motor.sueldoNeto(Object.assign(yo(), { bruto: 30000 }), P);
  assert.equal(B.brutoNecesario(P, yo(), s.neto).bruto, 30000);
  assert.equal(B.brutoNecesario(P, yo(), 0).bruto, 0);
});

test("ranking de los 19 territorios, de menos a más bruto", () => {
  const rk = B.porTerritorio(P, yo(), 28000);
  assert.equal(rk.length, 19);
  for (let i = 1; i < rk.length; i++) assert.ok(rk[i - 1].bruto <= rk[i].bruto);
  assert.equal(new Set(rk.map(x => x.territorio)).size, 19);
});

test("comparar dos ofertas: cifras redondeadas que cuadran", () => {
  const r = B.compararOfertas(P, yo(), { bruto: 32000, territorio: "ES-MD", pagas: 14 }, { bruto: 34000, territorio: "ES-CT", pagas: 12 });
  for (const k of ["a", "b"]) {
    const x = r[k];
    for (const v of Object.values(x)) assert.ok(Number.isInteger(v));
    assert.equal(x.bruto - x.cotizaciones - x.irpf, x.neto, "bruto − SS − IRPF = neto");
    assert.ok(Math.abs(x.neto - motor.sueldoNeto(yo({ territorio: k === "a" ? "ES-MD" : "ES-CT", bruto: x.bruto }), P).neto) <= 0.5);
  }
  assert.equal(r.a.netoPaga, Math.round(r.a.neto / 14));
  assert.equal(r.difAnual, r.a.neto - r.b.neto);
  assert.equal(r.difMes, r.a.netoMes - r.b.netoMes);
  assert.equal(r.mejor, r.difAnual > 0 ? "a" : "b");
  const igual = B.compararOfertas(P, yo(), { bruto: 30000, territorio: "ES-MD", pagas: 14 }, { bruto: 30000, territorio: "ES-MD", pagas: 12 });
  assert.equal(igual.difAnual, 0); assert.equal(igual.mejor, null);
});

test("la vista #bruto-necesario se pinta y está registrada", async () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  assert.match(html, /<script src="js\/bruto\.js"><\/script>/);
  assert.match(readFileSync(new URL("../web/js/ui.js", import.meta.url), "utf8"), /href: "#bruto-necesario"/);
  const els = {};
  const valor = id => { const m = html.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`)) || html.match(new RegExp(`<select id="${id}">\\s*<option value="([^"]*)"`)); return m ? m[1] : ""; };
  const el = id => els[id] || (els[id] = { id, value: valor(id), textContent: "", hidden: false, className: "", dataset: {}, _h: "",
    get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; }, addEventListener() {} });
  el("v-bruto-necesario").hidden = false;
  const document = { getElementById: id => html.includes(`id="${id}"`) ? el(id) : null, querySelectorAll: () => [],
    addEventListener() {}, dispatchEvent() {} };
  const ctx = { document, location: { hash: "#bruto-necesario?t=ES-AN" }, console, setTimeout, clearTimeout, Date,
    CustomEvent: class { constructor(t) { this.type = t; } }, addEventListener() {},
    fetch: async url => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL("../web/" + url, import.meta.url), "utf8")) }) };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../web/js/irpfsim.js", import.meta.url), "utf8"), ctx);
  vm.runInContext(readFileSync(new URL("../web/js/bruto.js", import.meta.url), "utf8"), ctx);
  await new Promise(r => setTimeout(r, 100));
  assert.ok(ctx.MAPAFISCAL_HERRAMIENTAS["bruto-necesario"], "tarjeta de portada");
  assert.equal(els["bn-territorio"].value, "ES-AN");
  assert.match(els["bn-principal"].innerHTML, /Para cobrar 2\.000 € netos al mes, en 14 pagas/);
  assert.match(els["bn-ranking"].innerHTML, /Bizkaia/);
  assert.equal((els["bn-ranking"].innerHTML.match(/data-t=/g) || []).length, 19);
});
