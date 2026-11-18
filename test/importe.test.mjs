import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { parsearImporte: p } = createRequire(import.meta.url)("../web/js/importe.js");

const v = (t, o) => { const r = p(t, o); assert.ok(r.ok, `${JSON.stringify(t)}: ${r.error}`); return r.valor; };
const mal = (t, o) => assert.equal(p(t, o).ok, false, `${JSON.stringify(t)} debería rechazarse`);

test("formatos españoles habituales", () => {
  assert.equal(v("30000"), 30000);
  assert.equal(v("30.000"), 30000);
  assert.equal(v("30.000,50"), 30000.5);
  assert.equal(v("30000,50"), 30000.5);
  assert.equal(v("30 000,50"), 30000.5);
  assert.equal(v("30 000,50"), 30000.5);
  assert.equal(v("1.234.567,89"), 1234567.89);
  assert.equal(v("0,5"), 0.5);
  assert.equal(v(",5"), 0.5);
  assert.equal(v("30.000 €"), 30000);
});

test("formato con punto decimal (el que escribe la propia web) y anglosajón completo", () => {
  assert.equal(v("30000.5"), 30000.5);
  assert.equal(v("30000.25"), 30000.25);
  assert.equal(v("30,000.50"), 30000.5);
  assert.equal(v(30000.5), 30000.5);
});

test("ambiguos o mal escritos: error, nunca otro número", () => {
  for (const t of ["30,000,50", "1.2.3", "30.00,5", "3.0000,50", "1,2,3", "abc", "30k", "1e5", "--5", ",", ".", "30.000,5,0"]) mal(t);
});

test("vacío no es cero", () => {
  const r = p("  ");
  assert.equal(r.ok, true); assert.equal(r.vacio, true); assert.equal(r.valor, null);
});

test("rango por campo", () => {
  mal("-5000", { min: 0 });
  assert.equal(v("-5000"), -5000);
  mal("200000000", { max: 1e8 });
  mal(NaN); mal(Infinity);
});
