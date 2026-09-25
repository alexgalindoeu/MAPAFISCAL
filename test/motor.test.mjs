// Casos del motor calculados a mano con la normativa 2025 (LIRPF y escalas de params.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { motor, P, hogarAsalariado } from "./ayuda.mjs";

const casi = (real, esperado, msg) => assert.ok(Math.abs(real - esperado) < 0.015, `${msg}: ${real} ≠ ${esperado}`);

test("escala progresiva estatal", () => {
  const e = P.estatal.escala_general_estatal;
  assert.equal(motor.aplicarEscala(0, e), 0);
  casi(motor.aplicarEscala(12450, e), 1182.75, "primer tramo");
  // 12.450 × 9,5 % + 7.750 × 12 % + 9.800 × 15 %
  casi(motor.aplicarEscala(30000, e), 3582.75, "30.000 €");
  assert.equal(motor.tipoMarginal(30000, e), 0.15);
  assert.equal(motor.tipoMarginal(400000, e), 0.245);
});

test("asalariado de 30.000 € en Castilla-La Mancha (escala autonómica = estatal)", () => {
  // RN = 30.000 − 1.905 SS − 2.000 otros gastos = 26.095 (sin reducción art. 20)
  // cuota por tramo = escala(26.095) − escala(5.550) = 2.997,00 − 527,25 = 2.469,75
  const l = motor.liquidar(hogarAsalariado("ES-CM", 30000, 1905), P);
  casi(l.baseLiquidableGeneral, 26095, "base liquidable general");
  assert.equal(l.minimoPersonalFamiliar.total, 5550);
  casi(l.cuotaIntegraEstatal, 2469.75, "cuota íntegra estatal");
  casi(l.cuotaIntegraAutonomica, 2469.75, "cuota íntegra autonómica");
  casi(l.cuotaLiquidaTotal, 4939.50, "cuota líquida");
});

test("asalariado de 30.000 € en Madrid (escala autonómica propia)", () => {
  // autonómica: 13.362,22 × 8,5 % + 5.642,41 × 10,7 % + 7.090,37 × 12,8 % − 5.550 × 8,5 % = 2.175,34
  const l = motor.liquidar(hogarAsalariado("ES-MD", 30000, 1905), P);
  casi(l.cuotaIntegraEstatal, 2469.75, "cuota íntegra estatal");
  casi(l.cuotaIntegraAutonomica, 2175.34, "cuota íntegra autonómica");
  casi(l.cuotaLiquidaTotal, 4645.09, "cuota líquida");
});

test("rentas bajas: la reducción del art. 20 deja la cuota a cero", () => {
  // RN previo ≤ 14.852 → reducción de 7.302 €; la base queda por debajo del mínimo
  const l = motor.liquidar(hogarAsalariado("ES-CM", 15000, 952.5), P);
  assert.equal(l.componentesRenta.reduccionTrabajo, 7302);
  assert.equal(l.cuotaLiquidaTotal, 0);
});

test("base del ahorro con el mínimo absorbido en la base general", () => {
  // 5.000 € de intereses: 5.000 × 9,5 % = 475 € en cada tramo (estatal y autonómico)
  const l = motor.liquidar(hogarAsalariado("ES-CM", 30000, 1905, { capitalMobiliario: { intereses: 5000 } }), P);
  casi(l.baseLiquidableAhorro, 5000, "base liquidable del ahorro");
  casi(l.cuotaIntegraEstatal, 2469.75 + 475, "cuota íntegra estatal");
  casi(l.cuotaIntegraAutonomica, 2469.75 + 475, "cuota íntegra autonómica");
});

test("mínimo del contribuyente mayor de 65 y de 75 años", () => {
  const minimo = edad => motor.liquidar(hogarAsalariado("ES-CM", 40000, 0, { edad }), P).minimoPersonalFamiliar.total;
  assert.equal(minimo(40), 5550);
  assert.equal(minimo(70), 5550 + 1150);
  assert.equal(minimo(80), 5550 + 1150 + 1400);
});

test("mínimo por descendientes (con incremento por menor de 3 años)", () => {
  const h = hogarAsalariado("ES-CM", 40000, 2540);
  h.tipoUnidadFamiliar = "monoparental";
  h.miembros.push({ id: "h1", rol: "descendiente", edad: 1, rentasPropias: 0 }, { id: "h2", rol: "descendiente", edad: 8, rentasPropias: 0 });
  const l = motor.liquidar(h, P, "individual");
  assert.equal(l.minimoPersonalFamiliar.descendientes, 2400 + 2800 + 2700);
});

test("tributación conjunta: el modo automático elige la cuota menor", () => {
  const h = hogarAsalariado("ES-MD", 45000, 2857.5);
  h.tipoUnidadFamiliar = "biparental";
  h.miembros.push({ id: "d2", rol: "conyuge", edad: 40, trabajo: null });
  const l = motor.liquidar(h, P);
  assert.ok(l.comparativa.individual != null && l.comparativa.conjunta != null);
  assert.equal(l.cuotaLiquidaTotal, Math.min(l.comparativa.individual, l.comparativa.conjunta));
  assert.equal(l.modoTributacionElegido, l.comparativa.conjunta < l.comparativa.individual ? "conjunta" : "individual");
});

test("comparar territorios devuelve los 19, ordenados de menor a mayor cuota", () => {
  const cmp = motor.compararTerritorios(hogarAsalariado("ES-MD", 30000, 1905), P);
  assert.equal(cmp.length, 19);
  assert.deepEqual(new Set(cmp.map(c => c.territorio)), new Set(Object.keys(P.territorios)));
  for (let i = 1; i < cmp.length; i++) assert.ok(cmp[i - 1].cuotaLiquidaTotal <= cmp[i].cuotaLiquidaTotal);
});

test("en todos los territorios la cuota es ≥ 0 y no baja al subir el salario", () => {
  const perfiles = {
    soltero: s => hogarAsalariado(null, s, Math.round(s * 0.0635)),
    jubilado: s => hogarAsalariado(null, s, 0, { edad: 72 }),
    pareja_dos_hijos: s => {
      const h = hogarAsalariado(null, s, Math.round(s * 0.0635));
      h.tipoUnidadFamiliar = "biparental";
      h.miembros.push({ id: "d2", rol: "conyuge", edad: 38, trabajo: null },
        { id: "h1", rol: "descendiente", edad: 2, rentasPropias: 0 }, { id: "h2", rol: "descendiente", edad: 6, rentasPropias: 0 });
      return h;
    }
  };
  for (const [nombre, perfil] of Object.entries(perfiles)) {
    for (const t of Object.keys(P.territorios)) {
      let anterior = 0;
      for (let s = 0; s <= 250000; s += 1000) {
        const h = perfil(s); h.territorio = t;
        const c = motor.liquidar(h, P).cuotaLiquidaTotal;
        assert.ok(c >= 0, `${nombre} ${t} ${s}: cuota negativa ${c}`);
        assert.ok(c >= anterior - 0.01, `${nombre} ${t}: la cuota baja de ${anterior} a ${c} en ${s} €`);
        anterior = c;
      }
    }
  }
});

test("territorio desconocido lanza error", () => {
  assert.throws(() => motor.liquidar(hogarAsalariado("ES-XX", 30000, 1905), P), /territorio desconocido/);
});
