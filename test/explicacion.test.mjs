// «¿Cómo hemos calculado esta cifra?» (web/js/explicacion.js): todo sale de la liquidación del motor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { motor, P, hogarAsalariado } from "./ayuda.mjs";

const require = createRequire(import.meta.url);
const E = require("../web/js/explicacion.js");
const paso = (ps, id) => ps.find(p => p.id === id);
const suma = g => g.tramos.reduce((s, t) => s + t.cuota, 0) - g.cuotaMinimo;

test("régimen común: los tramos estatal y autonómico cuadran con la cuota íntegra del motor", () => {
  for (const t of ["ES-MD", "ES-CT", "ES-AN", "ES-VC"]) {
    const liq = motor.liquidar(hogarAsalariado(t, 42000, 2700), P, "auto");
    const ps = E.pasos(liq, P), esc = paso(ps, "escala");
    assert.equal(esc.tramos.length, 2, t);
    assert.ok(Math.abs(suma(esc.tramos[0]) - liq.cuotaIntegraEstatal) < 0.011, t);
    assert.ok(Math.abs(suma(esc.tramos[1]) - liq.cuotaIntegraAutonomica) < 0.011, t);
    // tipos de la escala de los params, sin inventar
    assert.deepEqual(esc.tramos[0].tramos.map(x => x.tipo),
      P.estatal.escala_general_estatal.slice(0, esc.tramos[0].tramos.length).map(x => x.tipo));
    assert.equal(paso(ps, "minimo").norma.split(" · ")[0], P.estatal.minimo_contribuyente.norma);
    assert.equal(paso(ps, "resultado").filas.at(-1).importe, Math.abs(liq.cuotaDiferencial));
  }
});

test("forales: una escala foral que cuadra con la cuota íntegra", () => {
  for (const t of ["ES-PV-BI", "ES-PV-SS", "ES-PV-VI", "ES-NC"]) {
    const liq = motor.liquidar(hogarAsalariado(t, 42000, 2700), P, "auto");
    const esc = paso(E.pasos(liq, P), "escala");
    assert.equal(esc.tramos.length, 1, t);
    assert.ok(Math.abs(suma(esc.tramos[0]) - liq.cuotaIntegraAutonomica) < 0.011, t);
  }
  const nav = motor.liquidar(hogarAsalariado("ES-NC", 42000, 2700), P, "auto");
  const ded = paso(E.pasos(nav, P), "deducciones").filas.find(f => /mínimo personal/i.test(f.concepto));
  assert.equal(ded.norma, P.navarra.minimo_personal_deduccion.norma);
});

test("deducciones autonómicas con su norma de los params", () => {
  const h = hogarAsalariado("ES-MD", 25000, 1600, { edad: 30, alquilerViviendaPagos: 9000 });
  const liq = motor.liquidar(h, P, "auto");
  const det = liq.deduccionesAutonomicas.detalle;
  const ids = Object.keys(det).filter(k => det[k] > 0);
  assert.ok(ids.length > 0, "el caso debe tener alguna deducción");
  const filas = paso(E.pasos(liq, P), "deducciones").filas.filter(f => f.resta);
  assert.equal(filas.length, ids.length);
  const lista = P.territorios["ES-MD"].deducciones_autonomicas.lista;
  for (const f of filas) assert.ok(lista.some(d => d.norma === f.norma), f.concepto);
});

test("tramosAplicados reparte la base entera y el HTML lleva los pasos sin huecos", () => {
  const tr = E.tramosAplicados(50000, P.estatal.escala_general_estatal);
  assert.equal(tr.reduce((s, t) => s + t.base, 0), 50000);
  assert.deepEqual(E.tramosAplicados(0, P.estatal.escala_general_estatal), []);
  const liq = motor.liquidar(hogarAsalariado("ES-MD", 30000, 1900), P, "auto");
  const html = E.html(liq, P);
  assert.match(html, /Escala general estatal/);
  assert.match(html, /Cuota íntegra total/);
  assert.doesNotMatch(html, /undefined|NaN/);
});

test("dos declarantes en individual: sin tramos (componentes no sumables) y con aviso", () => {
  const h = hogarAsalariado("ES-MD", 30000, 1900);
  h.tipoUnidadFamiliar = "biparental";
  h.miembros.push({ id: "d2", rol: "conyuge", edad: 40, discapacidad: "no", trabajo: { dinerarias: 40000, cotizacionesSs: 2500 } });
  const liq = motor.liquidar(h, P, "individual");
  const ps = E.pasos(liq, P);
  assert.equal(paso(ps, "escala").tramos.length, 0);
  assert.match(paso(ps, "rendimientos").nota, /sumadas/);
});
