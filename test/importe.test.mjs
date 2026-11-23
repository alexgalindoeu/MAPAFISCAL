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

test("lo que la web escribe en un campo se relee con el mismo valor (ida y vuelta)", () => {
  const { formatearImporte: f } = createRequire(import.meta.url)("../web/js/importe.js");
  for (const x of [0, 5, 123.456, 30000.5, 1234.56, 2074, 99999999.99]) {
    const t = f(x);
    assert.ok(!t.includes("."), `${x} -> ${t} no debe llevar punto`);
    assert.equal(p(t).valor, Math.round(x * 100) / 100, `${x} -> ${t}`);
  }
  assert.equal(f(null), ""); assert.equal(f(""), "");
});

test("una coma con 3 cifras detrás («30,000»): error con sugerencia, nunca 30 €", () => {
  for (const [t, miles, sug] of [["30,000", "30.000", 30000], ["1,500", "1.500", 1500], ["100,000", "100.000", 100000], ["30,000 €", "30.000", 30000], ["-1,500", "−1.500", -1500]]) {
    const r = p(t);
    assert.equal(r.ok, false, `${t} debería rechazarse`);
    assert.equal(r.valor, null);
    assert.equal(r.error, `¿Querías decir ${miles} €? En España los miles van con punto.`);
    assert.equal(r.sugerencia, sug);
  }
});

test("coma decimal que no es ambigua: sigue siendo válida", () => {
  // «0,500»: un 0 no puede ser un grupo de miles, así que solo puede ser 0,5
  assert.equal(v("0,500"), 0.5);
  assert.equal(v(",500"), 0.5);
  assert.equal(v("30,5"), 30.5);
  assert.equal(v("30,50"), 30.5);
  assert.equal(v("30000,500"), 30000.5);  // la parte entera no es un grupo de miles
  assert.equal(v("1.500,000"), 1500);     // con punto de miles, la coma es el decimal
  assert.equal(v("30,0000"), 30);
});

test("porcentajes: tipos de tarifa con los decimales justos y tipos medios con uno", () => {
  const { pctTipo, pctMedio } = createRequire(import.meta.url)("../web/js/importe.js");
  assert.equal(pctTipo(0.095), "9,5 %");
  assert.equal(pctTipo(0.12), "12 %");
  assert.equal(pctTipo(0.245), "24,5 %");
  assert.equal(pctTipo(0.047), "4,7 %");
  assert.equal(pctTipo(0.0155), "1,55 %");
  assert.equal(pctTipo(0), "0 %");
  assert.equal(pctMedio(0.15197), "15,2 %");
  assert.equal(pctMedio(0.18), "18,0 %");
  assert.equal(pctMedio(0.181), "18,1 %");
  assert.equal(pctMedio(0), "0,0 %");
  assert.equal(pctMedio(-0.00001), "0,0 %");
  assert.equal(pctMedio(null), "0,0 %");
});
