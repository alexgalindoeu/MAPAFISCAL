// Formulario de la calculadora (web/js/formulario.js): que el estado de la persona llegue
// entero al motor (construirHogar) y que un hogar guardado vuelva al formulario
// (rellenarFormulario / «Mis clientes»).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { motor, P } from "./ayuda.mjs";

const require = createRequire(import.meta.url);
const F = require("../web/js/formulario.js");
const ctx = { ejercicio: 2025, cotizar: s => motor.cotizacionesTrabajador(s, P) };
const casi = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: ${a} ≠ ${b}`);

// estado con todos los bloques rellenos
function estadoCompleto() {
  const e = F.estadoInicial();
  e.territorio = "ES-MD"; e.municipio = "4200"; e.pareja = "si";
  Object.assign(e.personas.d1, {
    edad: 52, discapacidad: "33_64", salario: 38000, especie: 1200, ss: 2400, ssManual: true, otrosGastos: 300,
    movilidad: true, activoDiscapacidad: true, irregularImporte: 6000, irregularAnios: 3, retenciones: 9000,
    intereses: 400, dividendos: 900, seguros: 250,
    inmuebles: [{ ingresos: 9600, financieros: 1500, gastos: 1500, amortizacion: 600, tipo: "general" },
                { ingresos: 3000, financieros: 4200, gastos: 600, amortizacion: 0, tipo: "no_vivienda" }],
    catastralRevisado: 80000, catastralOtro: 30000,
    actMetodo: "directa_simplificada", actIngresos: 20000, actGastos: 8000, actInicio: true,
    ventas: [{ tipo: "inmueble", adquisicion: 60000, transmision: 180000, fechaAdq: "1992-04-10", fechaTrans: "2025-09-15", exenta: false },
             { tipo: "fondo", adquisicion: 11000, transmision: 8000, fechaAdq: "2021-02-01", fechaTrans: "2025-05-20", exenta: false }],
    premios: 1500, planIndividual: 1500, planEmpresa: 1000, compensatoria: 2400, alimentos: 3600, donativos: 150
  });
  Object.assign(e.personas.d2, { edad: 49, salario: 21000, ss: 1330, ssManual: true, intereses: 120, planIndividual: 800, retenciones: 2300, alquiler: 0 });
  e.hijos = [{ edad: 12, discapacidad: "33_64", compartida: true, rentas: 0, gastos: { gastos_escolaridad: 500 } }, { edad: 2, discapacidad: "no", compartida: false, rentas: 0, gastos: {} }];
  e.ascendientes = [{ edad: 81, discapacidad: "65_mas", rentas: 6000 }];
  e.familiaNumerosa = "general";
  e.gastos = { gastos_guarderia: 900 };
  return e;
}

test("construirHogar: todos los datos del formulario llegan al hogar del motor", () => {
  const h = F.hogarDesdeEstado(estadoCompleto(), ctx);
  const d1 = h.miembros.find(m => m.id === "d1"), d2 = h.miembros.find(m => m.id === "d2");
  assert.equal(h.tipoUnidadFamiliar, "biparental");
  assert.equal(h.municipioHabitantes, 4200);
  assert.deepEqual(d1.trabajo.rendimientoIrregular, { importe: 6000, anios: 3 });
  assert.equal(d1.trabajo.especie, 1200);
  assert.equal(d1.trabajo.trabajadorActivoDiscapacidad, true);
  assert.equal(d1.capitalMobiliario.seguros, 250);
  assert.equal(d1.capitalInmobiliario.length, 2);
  assert.equal(d1.capitalInmobiliario[0].gastosDeducibles, 2100);            // IBI y otros + amortización
  assert.equal(d1.capitalInmobiliario[0].tipoArrendamiento, "general");
  assert.equal(d1.capitalInmobiliario[1].arrendamientoVivienda, false);
  assert.equal(d1.imputacionInmobiliaria.length, 2);
  assert.equal(d1.actividades.rendimientoNetoPrevio, 12000);
  assert.equal(d1.ganancias[0].tipoElemento, "inmueble");
  assert.equal(d1.gananciasPerdidasNoTransmision, 1500);
  assert.deepEqual(d1.previsionSocial, { aportacionIndividual: 1500, contribucionEmpresarial: 1000 });
  assert.deepEqual(d1.reducciones, { pensionesCompensatorias: 2400, anualidadesAlimentosHijos: 3600 });
  assert.equal(d1.gastosGuarderia, 900);
  assert.equal(d2.retenciones, 2300);
  assert.equal(d2.previsionSocial.aportacionIndividual, 800);
  const h1 = h.miembros.find(m => m.id === "h1"), a1 = h.miembros.find(m => m.id === "a1");
  assert.equal(h1.convivenciaMeses, 0);
  assert.equal(h1.discapacidad, "33_64");
  assert.equal(h1.gastosEscolaridad, 500);
  assert.equal(a1.discapacidad, "65_mas");
  assert.equal(a1.rentasPropias, 6000);
  assert.equal(F.retencionesHogar(h), 11300);
});

test("el hogar del formulario da el mismo resultado que el caso formulario_completo del validador", () => {
  // mismos datos que tools/validar_js.R («formulario_completo_*»), sin municipio ni gastos
  const e = estadoCompleto();
  e.municipio = ""; e.gastos = {}; e.hijos[0].gastos = {};
  const h = F.hogarDesdeEstado(e, ctx);
  const casos = require("../tools/casos.json");
  for (const t of ["ES-MD", "ES-AN", "ES-CT", "ES-PV-BI", "ES-NC"]) {
    const ref = casos["formulario_completo_" + t].ref;
    const liq = motor.liquidar(Object.assign({}, h, { territorio: t }), P, "auto");
    casi(liq.baseLiquidableGeneral, ref.blg, t + " base liquidable general");
    casi(liq.cuotaDiferencial, ref.cd, t + " cuota diferencial");
  }
});

test("cada bloque cambia el resultado (nada se pierde por el camino)", () => {
  const base = motor.liquidar(F.hogarDesdeEstado(estadoCompleto(), ctx), P, "auto").cuotaLiquidaTotal;
  const quitar = [
    e => { e.personas.d1.inmuebles = []; }, e => { e.personas.d1.catastralRevisado = 0; },
    e => { e.personas.d1.actMetodo = "no"; }, e => { e.personas.d1.ventas = []; },
    e => { e.personas.d1.premios = 0; }, e => { e.personas.d1.compensatoria = 0; },
    e => { e.personas.d1.seguros = 0; }, e => { e.personas.d2.salario = 0; },
    e => { e.ascendientes = []; }, e => { e.hijos[0].discapacidad = "no"; }
  ];
  quitar.forEach((f, i) => {
    const e = estadoCompleto(); f(e);
    const c = motor.liquidar(F.hogarDesdeEstado(e, ctx), P, "auto").cuotaLiquidaTotal;
    assert.notEqual(c, base, "el cambio " + i + " no altera la cuota");
  });
});

test("rellenarFormulario: hogar -> estado -> hogar es idéntico", () => {
  const h = F.hogarDesdeEstado(estadoCompleto(), ctx);
  const h2 = F.hogarDesdeEstado(F.estadoDesdeHogar(h), ctx);
  assert.deepEqual(h2, h);
});

test("hogares guardados con el formulario anterior se abren y dan lo mismo", () => {
  const viejo = { territorio: "ES-CT", ejercicio: 2025, tipoUnidadFamiliar: "monoparental", familiaNumerosa: "no",
    municipioHabitantes: null, zonaDespoblada: false, tituloMonoparental: "no",
    miembros: [{ id: "d1", rol: "declarante", edad: 40, discapacidad: "no", desempleado: false,
      trabajo: { dinerarias: 30000, cotizacionesSs: 1905, pensionJubilacion: false, otrosPagadores: 0 },
      capitalMobiliario: { intereses: 300, dividendos: 0 }, capitalInmobiliario: [{ ingresos: 5000, gastosDeducibles: 0 }],
      actividades: { metodo: "directa_simplificada", rendimientoNetoPrevio: 4000 },
      ganancias: [{ valorTransmision: 2000, valorAdquisicion: 0, fechaAdquisicion: "2020-01-15", fechaTransmision: "2025-06-30", tipoElemento: "accion_cotizada", esTransmision: true }],
      previsionSocial: { aportacionIndividual: 1000 }, alquilerViviendaPagos: 6000, adquisicionViviendaPagos: 0,
      viviendaTransitoriaPagos: 0, donativos: 0, donativosRecurrentes: false, retenciones: 4000 },
      { id: "h1", rol: "descendiente", edad: 3, rentasPropias: 0, nacidoEnEjercicio: false, gastosLibrosTexto: 200 },
      { id: "a1", rol: "ascendiente", edad: 80, rentasPropias: 0 }] };
  const e = F.estadoDesdeHogar(viejo);
  assert.equal(e.personas.d1.inmuebles[0].tipo, "no_vivienda");
  assert.equal(e.hijos[0].gastos.gastos_libros_texto, 200);
  const nuevo = F.hogarDesdeEstado(e, ctx);
  casi(motor.liquidar(nuevo, P, "auto").cuotaDiferencial, motor.liquidar(viejo, P, "auto").cuotaDiferencial, "cuota diferencial");
});

test("cotizaciones: estimadas mientras no se escriban, 0 en pensiones", () => {
  const p = F.personaInicial(30000);
  casi(F.cotizaciones(p, ctx), Math.round(motor.cotizacionesTrabajador(30000, P)), "estimadas");
  p.pension = true; assert.equal(F.cotizaciones(p, ctx), 0);
  p.ssManual = true; p.ss = 1234; assert.equal(F.cotizaciones(p, ctx), 1234);
});

test("avisos amables: negativos, fechas y límites", () => {
  const e = F.estadoInicial();
  e.personas.d1.intereses = -50;
  e.personas.d1.ventas = [{ tipo: "fondo", adquisicion: 1000, transmision: 900, fechaAdq: "2026-01-01", fechaTrans: "2024-01-01" }];
  e.hijos = [{ edad: 27, discapacidad: "no", rentas: 9000, gastos: {} }];
  const textos = F.avisos(e, ctx).map(a => a.k);
  for (const k of ["personas.d1.intereses", "personas.d1.ventas.0.fechaTrans", "personas.d1.ventas.0.fechaAdq", "hijos.0.edad", "hijos.0.rentas"])
    assert.ok(textos.includes(k), "falta aviso de " + k);
  assert.ok(F.avisos(e, ctx).every(a => /^[A-ZÁÉÍÓÚ]/.test(a.texto)), "los avisos empiezan con mayúscula");
  // los negativos se toman como 0 en el hogar
  assert.equal(F.hogarDesdeEstado(e, ctx).miembros[0].capitalMobiliario, null);
  assert.equal(F.avisos(F.estadoInicial(), ctx).length, 0, "el estado inicial no da avisos");
});

test("campos por territorio: guardería para la maternidad en régimen común con hijos de menos de 3 años", () => {
  const T = P.territorios;
  const sin = F.camposTerritorio(T["ES-AR"], { menor3: false }), con = F.camposTerritorio(T["ES-AR"], { menor3: true });
  assert.ok(con.hogar.includes("gastos_guarderia") || con.hijo.some(([c]) => c === "gastos_guarderia"));
  assert.ok(!F.camposTerritorio(T["ES-PV-BI"], { menor3: true }).hogar.includes("gastos_guarderia"));
  assert.ok(sin.hogar.length <= con.hogar.length);
});

test("plantillas: el formulario pide cada dato según el régimen", () => {
  const e = F.estadoInicial();
  const html = reg => F.plantillas.htmlIngresos(e, "d1", { ejercicio: 2025, regimen: reg, cotizar: ctx.cotizar }, new Set());
  for (const k of ["salario", "ss", "retenciones", "especie", "otrosPagadores", "intereses", "seguros", "catastralRevisado",
    "actMetodo", "premios", "planIndividual", "planEmpresa", "compensatoria", "alimentos", "alquiler"])
    assert.match(html("comun"), new RegExp(`data-k="personas\\.d1\\.${k}"`), "falta " + k);
  assert.match(html("comun"), /data-k="personas\.d1\.hipoteca"/);
  assert.doesNotMatch(html("foral_pais_vasco"), /data-k="personas\.d1\.hipoteca"/);
  assert.match(html("foral_pais_vasco"), /data-k="personas\.d1\.compra"/);
  assert.match(html("comun"), /id="f-salario"/, "el declarante conserva los ids de antes");
});
