// Herramientas de web/js/conjunta.js: «¿conjunta o individual?» y «dos pagadores».
// Se apoyan en irpfsim.liquidar (paridad con R): aquí se comprueban las reglas que añade
// la herramienta (reducción por conjunta, reparto entre declarantes, obligación de
// declarar con dos pagadores del art. 96 LIRPF y estimación de retenciones). Ejercicio 2026.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const P = require("../web/datos/params_2026.json");
const C = require("../web/js/conjunta.js");
const motor = require("../web/js/irpfsim.js");
const casi = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.015, `${msg}: ${a} ≠ ${b}`);
const pareja = (a, b, o = {}) => Object.assign({ territorio: "ES-MD", tipo: "matrimonio", a: { bruto: a, edad: 40 }, b: { bruto: b, edad: 40 }, hijos: [] }, o);

test("conjunta con un solo sueldo: resta 3.400 € de la base y sale mejor", () => {
  const r = C.conjunta(P, pareja(30000, 0, { hijos: [4, 7] }));
  assert.equal(r.mejor, "conjunta");
  assert.equal(r.conj.reduccionesBase.tributacionConjunta, P.estatal.reduccion_tributacion_conjunta.biparental);
  casi(r.ind.baseLiquidableGeneral - r.conj.baseLiquidableGeneral, 3400, "base liquidable");
  casi(r.ahorro, r.cuotaIndividual - r.cuotaConjunta, "ahorro");
  // coincide con la elección del motor
  const liq = motor.liquidar(r.hogar, P, "auto");
  assert.equal(liq.modoTributacionElegido, "conjunta");
  casi(liq.comparativa.conjunta, r.cuotaConjunta, "cuota conjunta");
  casi(r.porPersona[0] + r.porPersona[1], r.cuotaIndividual, "reparto de la individual");
});

test("con dos sueldos parecidos gana la individual, y el punto de corte está en medio", () => {
  const r = C.conjunta(P, pareja(30000, 25000));
  assert.equal(r.mejor, "individual");
  const um = C.umbralSegundoSueldo(P, pareja(30000, 0));
  assert.ok(um > 0 && um < 25000, `umbral ${um}`);
  assert.equal(C.conjunta(P, pareja(30000, um - 500)).mejor, "conjunta");
  assert.equal(C.conjunta(P, pareja(30000, um + 500)).mejor, "individual");
});

test("pareja de hecho: solo individual; monoparental: reducción de 2.150 €", () => {
  const ph = C.conjunta(P, pareja(30000, 0, { tipo: "pareja-hecho", hijos: [5] }));
  assert.equal(ph.conj, null);
  assert.equal(ph.mejor, "individual");
  const mp = C.conjunta(P, pareja(30000, 0, { tipo: "monoparental", hijos: [5] }));
  assert.equal(mp.conj.reduccionesBase.tributacionConjunta, P.estatal.reduccion_tributacion_conjunta.monoparental);
});

test("comparación de la conjunta en los 19 territorios, ordenada", () => {
  const l = C.conjuntaPorTerritorio(P, pareja(30000, 0));
  assert.equal(l.length, 19);
  for (let i = 1; i < l.length; i++) assert.ok(l[i - 1].pagais <= l[i].pagais);
  assert.ok(l.every(x => x.mejor === "conjunta"), "con un solo sueldo la conjunta gana en todos");
});

const dos = (b1, b2, o = {}) => Object.assign({ territorio: "ES-MD", edad: 35, hijos: [], p1: { bruto: b1 }, p2: { bruto: b2 } }, o);

test("obligación de declarar con dos pagadores (art. 96 LIRPF)", () => {
  const od = P.estatal.obligacion_declarar;
  // 14.000 + 5.000: segundo > 1.500 y total > 15.876 → obligado
  const a = C.dosPagadores(P, dos(14000, 5000));
  assert.equal(a.obligado, true); assert.equal(a.limite, od.trabajo_varios_pagadores);
  // 18.500 + 1.400: el segundo no llega a 1.500 → límite de 22.000, no obligado
  const b = C.dosPagadores(P, dos(18500, 1400));
  assert.equal(b.obligado, false); assert.equal(b.limite, od.trabajo_un_pagador);
  // 14.000 + 1.800 = 15.800 ≤ 15.876 → no obligado
  assert.equal(C.dosPagadores(P, dos(14000, 1800)).obligado, false);
  // foral: lo regula su norma
  assert.equal(C.dosPagadores(P, dos(14000, 5000, { territorio: "ES-NC" })).obligado, null);
});

test("dos pagadores: resultado = IRPF del año − retenciones", () => {
  const r = C.dosPagadores(P, dos(20000, 10000));
  casi(r.resultado, r.irpf - r.retenciones[0] - r.retenciones[1], "cuota diferencial");
  assert.ok(r.resultado > 0, "con retenciones estimadas sale a pagar");
  // con un único pagador la retención estimada es el IRPF del año: ni pagar ni devolver
  casi(C.dosPagadores(P, dos(30000, 0)).resultado, 0, "un pagador");
  // retenciones introducidas
  const m = C.dosPagadores(P, dos(20000, 10000, { p1: { bruto: 20000, retencion: 3000 }, p2: { bruto: 10000, retencion: 1000 } }));
  assert.deepEqual(m.estimada, [false, false]);
  casi(m.resultado, m.irpf - 4000, "con las retenciones del certificado");
  // contrato temporal: al menos el 2 % si hay retención
  const t = C.retencionEstimada(P, dos(0, 0), { bruto: 30000, contrato: "temporal" });
  assert.ok(t >= 600);
});

test("escenarios según lo que pague el segundo y comparación por territorio", () => {
  const e = C.escenariosSegundo(P, dos(15000, 4000), [0, 1500, 2000, 6000]);
  assert.equal(e.length, 4);
  assert.equal(e[0].obligado, false); assert.equal(e[1].obligado, false); assert.equal(e[2].obligado, true);
  assert.equal(C.dosPagadoresPorTerritorio(P, dos(15000, 4000)).length, 19);
});
