// web/js/escenarios.js: enlaces para compartir (ida y vuelta del hogar por el hash),
// deslizador de sueldo y comparador de escenarios, todo con el motor (irpfsim.liquidar).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { motor, P } from "./ayuda.mjs";

const require = createRequire(import.meta.url);
const F = require("../web/js/formulario.js");
const S = require("../web/js/escenarios.js");
const P26 = require("../web/datos/params.json");
const ctx = p => ({ ejercicio: p.ejercicio, cotizar: s => motor.cotizacionesTrabajador(s, p) });

function estado(cambios) {
  const e = F.estadoInicial();
  cambios(e);
  return e;
}
const ESTADOS = {
  inicial: estado(() => {}),
  "pareja con hijos (recién nacido, custodia compartida)": estado(e => {
    e.territorio = "ES-AN"; e.pareja = "si"; e.personas.d2.salario = 21000; e.personas.d2.edad = 31;
    e.hijos = [{ edad: 0, discapacidad: "no", compartida: false, rentas: 0, gastos: {} },
      { edad: 7, discapacidad: "33_64", compartida: true, rentas: 0, gastos: {} }];
    e.familiaNumerosa = "general"; e.municipio = "4200";
  }),
  "foral con todo": estado(e => {
    e.territorio = "ES-PV-BI";
    Object.assign(e.personas.d1, { salario: 58000, ss: 3500, ssManual: true, retenciones: 11000, intereses: 300, dividendos: 1200,
      planIndividual: 2000, alquiler: 8400, cuentaVivienda: 2500, donativos: 150, donativosRec: true,
      inmuebles: [{ ingresos: 9000, financieros: 1200, gastos: 0, amortizacion: 900, tipo: "general" }],
      ventas: [{ tipo: "accion_cotizada", adquisicion: 4000, transmision: 6500, fechaAdq: "2019-03-01", fechaTrans: "2025-06-30", exenta: false }] });
    e.ascendientes = [{ edad: 81, discapacidad: "no", rentas: 6000 }];
  }),
  pensionista: estado(e => { e.territorio = "ES-NC"; Object.assign(e.personas.d1, { salario: 24000, pension: true, edad: 70 }); })
};

test("códec: ida y vuelta de un objeto cualquiera, con tildes", async () => {
  const obj = { v: 1, texto: "Situación, año, €", n: [1, 2.5, -3], o: { a: null, b: true } };
  const c = await S.codificar(obj);
  assert.match(c, /^[01][A-Za-z0-9_-]+$/, "solo caracteres seguros en una URL");
  assert.deepEqual(await S.decodificar(c), obj);
});

test("códec: un código roto o ajeno no rompe nada", async () => {
  for (const malo of ["", "x", "1@@@", "1AAAA", "0bm8", null, undefined]) assert.equal(await S.decodificar(malo), null, String(malo));
});

for (const [nombre, e] of Object.entries(ESTADOS)) {
  for (const p of [P, P26]) {
    test(`enlace de ida y vuelta: ${nombre} (${p.ejercicio})`, async () => {
      const hogar = F.hogarDesdeEstado(e, ctx(p));
      const { h, a } = S.podarHogar(hogar, p);
      const codigo = await S.codificar({ v: 1, e: p.ejercicio, h, a });
      assert.ok(codigo.length < 700, `enlace demasiado largo: ${codigo.length} caracteres`);
      const vuelta = await S.decodificar(codigo);
      assert.equal(vuelta.e, p.ejercicio);
      const hogar2 = S.hogarDesdeCompartido(vuelta.h, vuelta.a, p);
      assert.deepEqual(hogar2, hogar);
      assert.equal(motor.liquidar(hogar2, p, "auto").cuotaDiferencial, motor.liquidar(hogar, p, "auto").cuotaDiferencial);
    });
  }
}

test("las cotizaciones estimadas no viajan: siguen al sueldo; las escritas a mano, sí", () => {
  const e = ESTADOS.inicial, hogar = F.hogarDesdeEstado(e, ctx(P));
  const { h, a } = S.podarHogar(hogar, P);
  assert.deepEqual(a, ["d1"]);
  assert.equal(h.miembros[0].trabajo.cotizacionesSs, undefined);
  const est = S.estadoDesdeCompartido(h, a);
  assert.equal(est.personas.d1.ssManual, false);
  const manual = S.podarHogar(F.hogarDesdeEstado(ESTADOS["foral con todo"], ctx(P)), P);
  assert.deepEqual(manual.a, []);
  assert.equal(manual.h.miembros[0].trabajo.cotizacionesSs, 3500);
});

test("un enlace típico de la calculadora es corto", async () => {
  const { h, a } = S.podarHogar(F.hogarDesdeEstado(ESTADOS.inicial, ctx(P)), P);
  const c = await S.codificar({ v: 1, e: P.ejercicio, h, a });
  assert.ok(c.length < 200, `${c.length} caracteres`);
});

test("escenarios: cada fila es una liquidación del motor", () => {
  const e = ESTADOS.inicial;
  const lista = [{ t: "sueldo", v: 40000 }, { t: "hijo", v: 0 }, { t: "plan", v: 1500 }, { t: "territorio", v: "ES-PV-BI" },
    { t: "alquiler", v: 9000 }, { t: "compra", v: 7200 }, { t: "cuenta", v: 3000 }];
  const filas = S.calcularEscenarios(P, e, lista);
  assert.equal(filas.length, lista.length + 2, "actual + escenarios + todo a la vez");
  const [actual, sueldo, hijo, plan, terr] = filas;
  assert.equal(actual.dIrpf, 0);
  for (const f of filas) {
    const liq = motor.liquidar(f.r.hogar, P, "auto");
    assert.equal(f.r.irpf, motor.irpfAnual(liq));
    assert.ok(Math.abs(f.r.disponible - (f.r.bruto - f.r.cot - f.r.irpf)) < 0.011, "renta disponible = bruto − cotizaciones − IRPF");
  }
  assert.ok(sueldo.dIrpf > 0 && sueldo.dDisponible > 0, "más sueldo: más IRPF y más renta disponible");
  assert.equal(sueldo.r.bruto, 40000);
  assert.equal(sueldo.r.cot, Math.round(motor.cotizacionesTrabajador(40000, P)), "cotizaciones recalculadas con el sueldo nuevo");
  assert.ok(hijo.dIrpf < 0, "un hijo baja el IRPF");
  assert.equal(hijo.r.hogar.miembros.filter(m => m.rol === "descendiente").length, 1);
  assert.ok(plan.dIrpf < 0, "aportar al plan baja el IRPF");
  const cmp = motor.compararTerritorios(actual.r.hogar, P).find(c => c.territorio === "ES-PV-BI");
  assert.equal(terr.r.liq.cuotaResultanteAutoliquidacion, cmp.cuotaResultanteAutoliquidacion, "mudarse = la misma situación en otro territorio");
  assert.equal(filas[filas.length - 1].todos, true);
  assert.equal(filas[filas.length - 1].r.territorio, "ES-PV-BI");
});

test("escenarios: con uno solo no hay «todo a la vez» y se ignoran los no válidos", () => {
  const filas = S.calcularEscenarios(P, ESTADOS.inicial, [{ t: "plan", v: 1000 }, { t: "nada", v: 1 }, { t: "territorio", v: "XX" }]);
  assert.equal(filas.length, 2);
  assert.equal(S.aplicar(ESTADOS.inicial, { t: "plan", v: 1000 }).personas.d1.planIndividual, 1000);
  assert.equal(ESTADOS.inicial.personas.d1.planIndividual, 0, "el estado de partida no se toca");
});

test("deslizador: 19 territorios por punto y la situación propia con otro sueldo", () => {
  assert.equal(S.PUNTOS[0], 15000);
  assert.equal(S.PUNTOS[S.PUNTOS.length - 1], 150000);
  const d = S.porTerritorio(P, S.hogarTipo(P, "ES-MD", 45000));
  assert.equal(Object.keys(d).length, 19);
  const ref = motor.compararTerritorios(S.hogarTipo(P, "ES-MD", 45000), P).find(c => c.territorio === "ES-CT");
  assert.equal(d["ES-CT"].cuota, ref.cuotaResultanteAutoliquidacion);
  const e = ESTADOS["pareja con hijos (recién nacido, custodia compartida)"];
  const h = S.hogarConSueldo(P, e, 60000);
  const d1 = h.miembros.find(m => m.rol === "declarante"), d2 = h.miembros.find(m => m.rol === "conyuge");
  assert.equal(d1.trabajo.dinerarias, 60000);
  assert.equal(d2.trabajo.dinerarias, 21000, "el sueldo del cónyuge no cambia");
  assert.equal(h.miembros.filter(m => m.rol === "descendiente").length, 2);
  // la cuota crece con el sueldo en todos los territorios
  const a = S.porTerritorio(P, S.hogarTipo(P, "ES-MD", 30000)), b = S.porTerritorio(P, S.hogarTipo(P, "ES-MD", 90000));
  for (const t of Object.keys(a)) assert.ok(b[t].cuota > a[t].cuota, t);
});
