// Informe completo (web/js/informe.js): lógica de desbloqueo y contenido, que sale del motor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { motor, P, hogarAsalariado } from "./ayuda.mjs";
import { empaquetar, informeDemo } from "../tools/empaquetar.mjs";

const require = createRequire(import.meta.url);
const I = require("../web/js/informe.js");
const APAGADO = { informePago: false, informeAnuncio: false };
const TODO = { informePago: true, informeAnuncio: true };

test("desbloqueo con los interruptores apagados: basta la sesión (provisional)", () => {
  const sin = I.desbloqueo({ cfg: APAGADO });
  assert.equal(sin.desbloqueado, false);
  assert.deepEqual(sin.opciones, ["acceso", "plan"]);
  const reg = I.desbloqueo({ cfg: APAGADO, usuario: true, plan: "gratis" });
  assert.deepEqual([reg.desbloqueado, reg.via, reg.banner], [true, "registro", true]);
  // la recompensa o la compra no cuentan si su vía está apagada
  assert.equal(I.desbloqueo({ cfg: APAGADO, recompensa: true }).desbloqueado, false);
  assert.equal(I.desbloqueo({ cfg: APAGADO, usuario: true, comprado: true }).via, "registro");
});

test("desbloqueo: plan de pago directo y sin banner; pago único sin banner; anuncio con banner", () => {
  for (const cfg of [APAGADO, TODO]) {
    const p = I.desbloqueo({ cfg, usuario: true, plan: "gestor" });
    assert.deepEqual([p.desbloqueado, p.via, p.banner], [true, "plan", false]);
    assert.equal(I.desbloqueo({ cfg, usuario: true, plan: "despacho" }).via, "plan");
  }
  const pago = I.desbloqueo({ cfg: TODO, usuario: true, plan: "gratis", comprado: true });
  assert.deepEqual([pago.via, pago.banner], ["pago", false]);
  const an = I.desbloqueo({ cfg: TODO, recompensa: true });
  assert.deepEqual([an.via, an.banner], ["anuncio", true]);
});

test("desbloqueo con los interruptores encendidos: la sesión ya no basta", () => {
  const e = I.desbloqueo({ cfg: TODO, usuario: true, plan: "gratis" });
  assert.equal(e.desbloqueado, false);
  assert.deepEqual(e.opciones, ["anuncio", "pago", "plan"]);
  assert.deepEqual(I.desbloqueo({ cfg: { informePago: true } }).opciones, ["pago", "plan"]);
  assert.deepEqual(I.desbloqueo({ cfg: { informeAnuncio: true }, usuario: true }).opciones, ["anuncio", "plan"]);
  // pagado pero sin sesión no se puede comprobar: no desbloquea
  assert.equal(I.desbloqueo({ cfg: TODO, comprado: true }).desbloqueado, false);
});

test("aceptar cookies no desbloquea nunca", () => {
  for (const cfg of [APAGADO, TODO]) {
    const e = I.desbloqueo({ cfg, cookies: true, consentimiento: true, aceptaCookies: true });
    assert.equal(e.desbloqueado, false);
  }
});

test("la demo autónoma (sin cuentas) se desbloquea con banner", () => {
  const e = I.desbloqueo({ cfg: TODO, demo: true });
  assert.deepEqual([e.desbloqueado, e.via, e.banner], [true, "demo", true]);
});

test("contenido: cuadra con la liquidación del motor", () => {
  const h = hogarAsalariado("ES-MD", 40000, 2540, { retenciones: 6000 });
  const liq = motor.liquidar(h, P, "auto");
  const c = I.contenido(h, P);
  assert.equal(c.ejercicio, P.ejercicio);
  assert.equal(c.territorio.id, "ES-MD");
  assert.equal(c.resumen.cuota, liq.cuotaResultanteAutoliquidacion);
  assert.equal(c.resumen.rotulo, "A ingresar");
  assert.ok(Math.abs(c.resumen.cifra - liq.cuotaDiferencial) < 0.006);
  const fila = n => c.desglose.find(d => d.concepto === n);
  assert.equal(fila("Base imponible general").importe, liq.baseImponibleGeneral);
  assert.equal(fila("Base liquidable general").importe, liq.baseLiquidableGeneral);
  assert.equal(fila("Cuota íntegra autonómica").casilla, "0546");
  assert.equal(fila("Retenciones e ingresos a cuenta").importe, -6000);
  assert.equal(c.desglose[c.desglose.length - 1].tipo, "total");
  // comparación: los 19 territorios, ordenados, con el tuyo marcado y su diferencia en 0
  assert.equal(c.comparacion.total, 19);
  const cuotas = c.comparacion.filas.map(f => f.cuota);
  assert.deepEqual(cuotas, cuotas.slice().sort((a, b) => a - b));
  const tu = c.comparacion.filas.find(f => f.tuyo);
  assert.equal(tu.territorio, "ES-MD");
  assert.equal(tu.dif, 0);
  const cmp = motor.compararTerritorios(h, P);
  assert.equal(c.comparacion.barato.cuota, Math.min(...cmp.map(x => x.cuotaResultanteAutoliquidacion)));
});

test("cómo pagar menos: la aportación óptima al plan sale del motor y ahorra lo que dice", () => {
  const h = hogarAsalariado("ES-MD", 40000, 2540, { retenciones: 6000 });
  const plan = I.planOptimo(h, P);
  assert.ok(plan.extra > 0 && plan.extra <= plan.limite);
  // límite general de 1.500 € (art. 52 LIRPF), sin contribución empresarial
  assert.equal(plan.limite, P.estatal.reduccion_prevision_social.limite_general_abs);
  const con = a => { const h2 = structuredClone(h); h2.miembros[0].previsionSocial = { aportacionIndividual: a }; return motor.irpfAnual(motor.liquidar(h2, P, "auto")); };
  const sin = motor.irpfAnual(motor.liquidar(h, P, "auto"));
  assert.ok(Math.abs((sin - con(plan.extra)) - plan.ahorro) < 0.01, "el ahorro cuadra con el motor");
  assert.ok(sin - con(plan.limite) - plan.ahorro < 0.51, "por encima no se ahorra más");
  const c = I.contenido(h, P);
  const k = c.consejos.find(x => x.id === "plan_pensiones");
  assert.ok(k, "el consejo del plan de pensiones está");
  assert.equal(k.ahorro, plan.ahorro);
  assert.equal(c.consejos.filter(x => x.id === "plan_pensiones").length, 1, "sin duplicar el del optimizador");
  // el resto de consejos son los del optimizador del motor, sin inventar ninguno
  const ids = new Set(motor.optimizar(h, P).recomendaciones.map(r => r.id));
  for (const x of c.consejos) assert.ok(ids.has(x.id), "consejo que no viene del motor: " + x.id);
});

test("plan de pensiones: al máximo ya aportado no hay consejo; Navarra no se ofrece", () => {
  const h = hogarAsalariado("ES-MD", 40000, 2540, { previsionSocial: { aportacionIndividual: 1500 } });
  assert.equal(I.planOptimo(h, P).extra, 0);
  assert.ok(!I.contenido(h, P).consejos.some(x => x.id === "plan_pensiones"));
  assert.equal(I.planOptimo(hogarAsalariado("ES-NC", 40000, 2540), P), null);
});

test("contenido en territorios forales y con deducciones", () => {
  for (const t of ["ES-PV-BI", "ES-NC", "ES-CN"]) {
    const h = hogarAsalariado(t, 25000, 1600, { retenciones: 3000 });
    const c = I.contenido(h, P);
    assert.equal(c.resumen.cuota, motor.liquidar(h, P, "auto").cuotaResultanteAutoliquidacion, t);
    const tot = c.deducciones.reduce((s, d) => s + d.importe, 0);
    assert.ok(tot >= 0);
  }
});

test("HTML del informe: secciones, sin banner si está pagado y con banner propio si no", () => {
  const c = I.contenido(hogarAsalariado("ES-MD", 40000, 2540, { retenciones: 6000 }), P);
  const pagado = I.html(c, { banner: false });
  for (const s of ["Desglose de la liquidación", "Deducciones aplicadas", "Cómo pagar menos", "territorios fiscales", "No sustituye"])
    assert.match(pagado, new RegExp(s));
  assert.doesNotMatch(pagado, /inf-banner/);
  const gratis = I.html(c, { banner: true });
  assert.match(gratis, /class="inf-banner"/);
  assert.match(gratis, /#planes/);
  const afi = I.html(c, { banner: true, afiliado: { texto: "X", enlace: "https://ejemplo.test/?a=1" } });
  assert.match(afi, /Enlace patrocinado/);
  assert.match(afi, /rel="sponsored noopener"/);
  // sin scripts ni anuncios dentro del documento (el PDF es estático)
  assert.doesNotMatch(gratis, /<script|adsbygoogle|googletag/);
  assert.doesNotMatch(gratis, /@/, "ningún correo ni dato personal en el informe");
});

test("config.js: los interruptores del informe empiezan apagados", () => {
  const window = {};
  new Function("window", readFileSync(new URL("../web/config.js", import.meta.url), "utf8"))(window);
  assert.equal(window.MAPAFISCAL_CONFIG.informePago, false);
  assert.equal(window.MAPAFISCAL_CONFIG.informeAnuncio, false);
  assert.equal(window.MAPAFISCAL_CONFIG.informePrecio, 1.99);
});

test("empaquetado: informe.js va dentro, sin el anuncio bonificado", () => {
  const html = empaquetar();
  assert.match(html, /window\.MapafiscalInforme = API/);
  assert.doesNotMatch(html, /securepubads|doubleclick|ANUNCIO-BONIFICADO/);
  assert.doesNotMatch(informeDemo(), /googletag/);
  assert.match(html, /id="btn-informe"/);
});
