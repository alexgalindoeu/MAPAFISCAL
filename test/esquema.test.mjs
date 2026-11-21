// web/js/esquema.js: versión del formato (`schema_version`) de los hogares guardados y de
// los enlaces compartidos, y migración de los datos anteriores (sin versión = versión 0).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ESQ = require("../web/js/esquema.js");
const S = require("../web/js/escenarios.js");
const F = require("../web/js/formulario.js");
const I = require("../web/js/irpfsim.js");
const P = require("../web/datos/params.json");

// Enlace real generado con el código anterior a `schema_version` (payload { v: 1, e, h, a }):
// pareja en Andalucía, 34 000 € y 21 000 €, un hijo de 7 años; cuota líquida 8006,07 €.
const ENLACE_ANTIGUO = "#calculadora?s=1dc0xC8IwEMXx7_LmE5IoCtkcXF0cS4dr79BIbeAaBSn57tJBqIPz4_f-M16InqCIwYU94YY4o6hZKtlSRsTpsjmeQXgkfXSWJ8RmhuUBEaL9wMZjURBUWBC3O0Ix7vielydJoxpb4mmZnHO10lf3eXw_ryvq_9Lgf6no1OsoSdfpQ20rgREbiAdBAtr6AQ";
const CUOTA_ANTIGUA = 8006.07;

const hogar = s => ({ territorio: "ES-MD", ejercicio: P.ejercicio, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no",
  miembros: [{ id: "d1", rol: "declarante", edad: 40, trabajo: { dinerarias: s, cotizacionesSs: 0 } }] });

test("la versión del formato es un entero que empieza en 1, distinto del ejercicio", () => {
  assert.equal(ESQ.VERSION, 1);
  assert.notEqual(ESQ.VERSION, P.ejercicio);
});

test("v0 -> v1: un hogar sin versión se migra sin cambiar el cálculo", () => {
  const h0 = hogar(30000);
  const m = ESQ.migrarHogar(h0);
  assert.equal(m.ok, true);
  assert.equal(m.version, 0);
  assert.equal(m.hogar.schema_version, 1);
  assert.deepEqual(m.avisos, []);
  assert.deepEqual(ESQ.sinVersion(m.hogar), h0);
  assert.equal("schema_version" in h0, false, "no modifica el objeto de entrada");
  assert.deepEqual(I.liquidar(ESQ.sinVersion(m.hogar), P, "auto"), I.liquidar(h0, P, "auto"));
  // y una v1 vuelve igual
  const m1 = ESQ.migrarHogar(m.hogar);
  assert.equal(m1.ok, true); assert.equal(m1.version, 1); assert.deepEqual(m1.hogar, m.hogar);
});

test("enlace antiguo real (sin versión) se abre igual", async () => {
  const codigo = ENLACE_ANTIGUO.match(/s=([A-Za-z0-9_-]+)/)[1];
  const crudo = await S.decodificar(codigo);
  assert.equal(crudo.schema_version, undefined);
  const r = S.leerCompartido(crudo);
  assert.equal(r.ok, true);
  assert.deepEqual(r.avisos, []);
  assert.equal(r.payload.schema_version, 1);
  assert.deepEqual(r.payload.h, crudo.h);
  const h = S.hogarDesdeCompartido(r.payload.h, r.payload.a, P);
  assert.equal(h.territorio, "ES-AN");
  assert.equal(I.liquidar(h, P, "auto").cuotaLiquidaTotal, CUOTA_ANTIGUA);
});

test("los enlaces nuevos llevan schema_version y hacen ida y vuelta", async () => {
  const e = F.estadoInicial(); e.personas.d1.salario = 42000;
  const { h, a } = S.podarHogar(F.hogarDesdeEstado(e, { ejercicio: P.ejercicio, cotizar: s => I.cotizacionesTrabajador(s, P) }), P);
  const p = { v: 1, schema_version: ESQ.VERSION, e: P.ejercicio, h, a };
  const r = S.leerCompartido(await S.decodificar(await S.codificar(p)));
  assert.equal(r.ok, true);
  assert.deepEqual(r.payload, p);
});

test("importe en texto: con forma de número se convierte de forma explícita (con aviso); si no, se rechaza", () => {
  const m = ESQ.migrarHogar(hogar("30000"));
  assert.equal(m.ok, true);
  assert.equal(m.hogar.miembros[0].trabajo.dinerarias, 30000);
  assert.equal(m.avisos.length, 1);
  assert.match(m.avisos[0], /miembros\[0\]\.trabajo\.dinerarias.*texto/);
  assert.equal(ESQ.migrarHogar(hogar("1.234,56")).hogar.miembros[0].trabajo.dinerarias, 1234.56);
  // el motor sigue rechazando el texto: la conversión solo la hace migrarHogar
  assert.throws(() => I.liquidar(hogar("30000"), P, "auto"), /se esperaba un número/);
  assert.deepEqual(I.liquidar(ESQ.sinVersion(m.hogar), P, "auto"), I.liquidar(hogar(30000), P, "auto"));

  const mal = ESQ.migrarHogar(hogar("treinta mil"));
  assert.equal(mal.ok, false);
  assert.match(mal.error, /«miembros\[0\]\.trabajo\.dinerarias» debería ser un importe/);
  // en un enlace, el mismo rechazo llega como error claro, sin lanzar
  const r = S.leerCompartido({ v: 1, e: P.ejercicio, h: hogar("treinta mil"), a: [] });
  assert.equal(r.ok, false);
  assert.match(r.error, /debería ser un importe/);
});

test("los campos de texto del contrato no se tocan", () => {
  const h = hogar(1000);
  h.miembros[0].discapacidad = "33_64";
  h.miembros[0].ganancias = [{ tipoElemento: "accion_cotizada", fechaAdquisicion: "2019-03-01", fechaTransmision: "2025-06-30" }];
  const m = ESQ.migrarHogar(h);
  assert.equal(m.ok, true); assert.deepEqual(m.avisos, []);
  assert.deepEqual(ESQ.sinVersion(m.hogar), h);
});

test("versión futura desconocida: aviso, sin romper", () => {
  const m = ESQ.migrarHogar(Object.assign(hogar(30000), { schema_version: 99 }));
  assert.equal(m.ok, true);
  assert.equal(m.version, 99);
  assert.match(m.avisos[0], /formato más nuevo \(versión 99\)/);
  assert.equal(m.hogar.miembros[0].trabajo.dinerarias, 30000);

  const r = S.leerCompartido({ v: 1, schema_version: 99, e: P.ejercicio, h: hogar(30000), a: [] });
  assert.equal(r.ok, true);
  assert.ok(r.avisos.some(a => /versión 99/.test(a)));
});

test("datos que no se pueden migrar: error claro, nunca una excepción", () => {
  for (const x of [null, "texto", [], { miembros: "no" }, { schema_version: "uno" }, { schema_version: -1 }]) {
    let m;
    assert.doesNotThrow(() => { m = ESQ.migrarHogar(x); });
    assert.equal(m.ok, false);
    assert.equal(typeof m.error, "string");
  }
  assert.equal(S.leerCompartido(null).ok, false);
  assert.equal(S.leerCompartido({ schema_version: 1.5 }).ok, false);
});
