// Contrato de entrada del motor JS: números o vacío. Un texto es un error, igual que en R
// (tests/testthat/test-contrato-entrada.R), en vez de concatenarse y dar cuotas absurdas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const I = createRequire(import.meta.url)("../web/js/irpfsim.js");
const P = JSON.parse(readFileSync(new URL("../web/datos/params.json", import.meta.url), "utf8"));
const hogar = s => ({ territorio: "ES-MD", ejercicio: P.ejercicio, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no",
  miembros: [{ id: "d1", rol: "declarante", edad: 40, trabajo: { dinerarias: s, cotizacionesSs: 0 } }] });

test("un importe como texto es un error, no un cálculo", () => {
  assert.throws(() => I.liquidar(hogar("30000"), P, "auto"), /se esperaba un número/);
  assert.throws(() => I.liquidar(hogar({}), P, "auto"), /se esperaba un número/);
});

test("vacío (null, undefined, NaN) sigue valiendo 0, y un número calcula igual que antes", () => {
  const cero = I.liquidar(hogar(null), P, "auto");
  assert.deepEqual(I.liquidar(hogar(undefined), P, "auto"), cero);
  assert.deepEqual(I.liquidar(hogar(NaN), P, "auto"), cero);
  assert.ok(JSON.stringify(I.liquidar(hogar(30000), P, "auto")).length > 100);
});
