// Herramientas de web/js/herramientas.js: cotizaciones del trabajador, sueldo neto, subida,
// plan de pensiones y donativos. Cifras calculadas a mano en docs/03_casos_validacion.md,
// sección «Cotizaciones del trabajador y sueldo neto» y siguientes. Ejercicio 2026.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { motor, P as P25 } from "./ayuda.mjs";

const require = createRequire(import.meta.url);
const P = require("../web/datos/params_2026.json");
const C = require("../web/js/herramientas.js");
const casi = (real, esperado, msg) => assert.ok(Math.abs(real - esperado) < 0.015, `${msg}: ${real} ≠ ${esperado}`);
const yo = (o = {}) => Object.assign({ bruto: 30000, territorio: "ES-MD", edad: 35, hijos: [], tipoContrato: "indefinido" }, o);

test("cotizaciones del trabajador 2025 y 2026 (órdenes PJC/178/2025 y PJC/297/2026)", () => {
  casi(motor.cotizacionesTrabajador(30000, P), 1950, "2026, 30.000 € × 6,50 %");
  casi(motor.cotizacionesTrabajador(30000, P25), 1944, "2025, 30.000 € × 6,48 %");
  casi(motor.cotizacionesTrabajador(30000, P, "temporal"), 1965, "2026 temporal, 6,55 %");
  // base máxima de 5.101,20 €/mes y solidaridad en dos tramos
  const d = motor.cotizacionesTrabajadorDetalle(80000, P, "temporal");
  casi(d.ordinaria, 4009.54, "base máxima × 6,55 % × 12");
  casi(d.solidaridad, 38.23, "solidaridad");
  casi(d.total, 4047.77, "total");
  casi(motor.cotizacionesTrabajador(100000, P25), 3888.62, "2025, tres tramos de solidaridad");
  casi(motor.cotizacionesTrabajador(12000, P), 780, "por debajo de la base mínima: jornada parcial");
});

test("sueldo neto: Madrid, 30.000 €, 2026", () => {
  const s = motor.sueldoNeto(yo(), P);
  casi(s.cotizaciones, 1950, "cotizaciones");
  casi(s.irpf, 4598.02, "IRPF: 2.463,00 estatal + 2.135,02 autonómico");
  casi(s.neto, 23451.98, "neto anual");
  casi(s.neto / 14, 1675.14, "neto al mes en 14 pagas");
  const lista = C.netoPorTerritorio(P, yo());
  assert.equal(lista.length, 19);
  for (let i = 1; i < lista.length; i++) assert.ok(lista[i - 1].neto >= lista[i].neto, "ordenado de más a menos neto");
  casi(lista.find(x => x.territorio === "ES-MD").neto, 23451.98, "Madrid en la comparación");
  // Castilla-La Mancha: escala autonómica = estatal → IRPF 2 × 2.463,00
  casi(lista.find(x => x.territorio === "ES-CM").neto, 30000 - 1950 - 4926, "Castilla-La Mancha");
});

test("subida de 30.000 a 33.000 € en Madrid: neto ganado y tipo marginal efectivo", () => {
  const r = C.subida(P, yo(), 33000);
  casi(r.dCot, 195, "3.000 × 6,50 %");
  casi(r.dIrpf, 779.79, "2.805 × (15 % + 12,8 %)");
  casi(r.dNeto, 2025.21, "neto ganado");
  casi(r.tipoMarginal, 0.32493, "tipo marginal efectivo");
});

test("plan de pensiones: 1.500 € con 40.000 € en Madrid ahorran 424 €", () => {
  const o = yo({ bruto: 40000, edad: 45, aportacion: 1500, contribucionEmpresa: 0 });
  const r = C.plan(P, o);
  assert.equal(r.limite, 1500);
  casi(r.ahorro, 424, "1.300 × 15 % + 200 × 18,5 % + 1.500 × 12,8 %");
  assert.equal(r.optima, 1500);
  // aportar más que el límite no ahorra más
  casi(C.plan(P, Object.assign({}, o, { aportacion: 4000 })).ahorro, 424, "por encima del límite");
  // 12.000 € de sueldo y 3.000 de la empresa: manda el 30 % del rendimiento neto
  // (15.000 − 780 − 2.000 = 12.220 → 3.666), menos lo que pone la empresa
  casi(C.limitePlan(P, yo({ bruto: 12000, contribucionEmpresa: 3000 })), 666, "30 % de 12.220 − 3.000");
  // con 18.000 € y 8.000 de la empresa, la empresa ya agota el límite (6.849 €)
  assert.equal(C.limitePlan(P, yo({ bruto: 18000, contribucionEmpresa: 8000 })), 0);
  // País Vasco: aportaciones propias hasta 5.000 €
  assert.equal(C.limitePlan(P, yo({ bruto: 40000, territorio: "ES-PV-BI", contribucionEmpresa: 0 })), 5000);
  const lista = C.planPorTerritorio(P, o);
  assert.equal(lista.length, 18, "todos menos Navarra");
  assert.ok(!lista.some(x => x.territorio === "ES-NC"));
});

test("donativos: 400 € deducen 260 € (80 % de 250 + 40 % de 150)", () => {
  const o = yo({ bruto: 40000, edad: 45, donativos: 400 });
  const r = C.donativos(P, o);
  casi(r.ahorro, 260, "ahorro");
  casi(r.coste, 140, "coste real");
  casi(C.donativos(P, Object.assign({}, o, { donativosRecurrentes: true })).ahorro, 267.5, "45 % del resto si es recurrente");
  const lista = C.donativosPorTerritorio(P, o);
  assert.equal(lista.length, 15, "territorios de régimen común");
});

// ---- la interfaz: arranca y pinta sin errores con un DOM mínimo ---------------------------
function domMinimo() {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const els = {}, oyentes = {};
  const valorInicial = id => {
    const m = html.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`)) || html.match(new RegExp(`<select id="${id}">\\s*<option value="([^"]*)"`));
    return m ? m[1] : "";
  };
  const el = id => els[id] || (els[id] = {
    id, value: valorInicial(id), textContent: "", hidden: false, checked: false, dataset: {},
    _html: "", get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; const o = [...v.matchAll(/<option value="([^"]*)"/g)].map(m => ({ value: m[1] })); if (o.length) { this.options = o; if (!o.some(x => x.value === this.value)) this.value = o[0].value; } },
    options: [], addEventListener() {}
  });
  const document = {
    getElementById: id => html.includes(`id="${id}"`) ? el(id) : null,
    querySelectorAll: () => [], addEventListener: (t, f) => { (oyentes[t] = oyentes[t] || []).push(f); },
    dispatchEvent: e => { (oyentes[e.type] || []).forEach(f => f(e)); }
  };
  return { els, oyentes, document };
}

async function montar(hash) {
  const { els, oyentes, document } = domMinimo();
  const ctx = {
    document, location: { hash }, console, setTimeout, clearTimeout,
    CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o && o.detail; } },
    addEventListener() {}, fetch: async url => {
      const f = new URL("../web/" + url, import.meta.url);
      return { ok: true, json: async () => JSON.parse(readFileSync(f, "utf8")), text: async () => readFileSync(f, "utf8") };
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../web/js/irpfsim.js", import.meta.url), "utf8"), ctx);
  vm.runInContext(readFileSync(new URL("../web/js/herramientas.js", import.meta.url), "utf8"), ctx);
  await new Promise(r => setTimeout(r, 50));
  return { els, oyentes, ctx };
}

test("la interfaz de las herramientas se pinta con los datos de 2025 y 2026", async () => {
  const { els, oyentes, ctx } = await montar("#sueldo-neto");
  assert.ok(ctx.MAPAFISCAL_HERRAMIENTAS["sueldo-neto"] && ctx.MAPAFISCAL_HERRAMIENTAS["plan-pensiones"], "tarjetas de portada");
  assert.equal(els["neto-ejercicio"].value, "2026", "ejercicio en curso por defecto");
  assert.match(els["neto-ejercicio"].innerHTML, /2025[\s\S]*2026/);
  const vista = v => (oyentes["mapafiscal:vista"] || []).forEach(f => f({ detail: { vista: v } }));
  vista("sueldo-neto");
  assert.match(els["neto-principal"].innerHTML, /23\.452 €/, "neto anual de 30.000 € en Madrid");
  assert.match(els["neto-principal"].innerHTML, /no es la retención de la nómina/i);
  assert.match(els["neto-ranking"].innerHTML, /Navarra[\s\S]*Cataluña/);
  vista("plan-pensiones");
  assert.match(els["pp-principal"].innerHTML, /424 €/, "ahorro de 1.500 € con 40.000 € en Madrid");
  assert.doesNotMatch(els["pp-ranking"].innerHTML, /Navarra/);
  assert.doesNotMatch(els["pp-nota"].textContent + els["neto-nota"].textContent, /provisional|incomplet/i);
});

test("un enlace a #sueldo-neto?subida abre la pestaña de la subida", async () => {
  const { els, oyentes } = await montar("#sueldo-neto?subida");
  (oyentes["mapafiscal:vista"] || []).forEach(f => f({ detail: { vista: "sueldo-neto" } }));
  assert.match(els["neto-principal"].innerHTML, /\+2\.025 €/, "neto ganado de 30.000 a 33.000 € en Madrid");
  assert.match(els["neto-principal"].innerHTML, /32,5 %/, "tipo marginal efectivo");
  assert.equal(els["neto-campo-nuevo"].hidden, false);
});
