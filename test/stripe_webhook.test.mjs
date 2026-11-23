// Webhook de Stripe: pago único del informe (supabase/functions/stripe-webhook/informe.mjs).
// La lógica es pura: aquí se prueba con una "Stripe" y una tabla informes_comprados falsas.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validarPagoInforme, reembolsoDeCargo, registrarInforme, revocarInforme,
} from "../supabase/functions/stripe-webhook/informe.mjs";

// Precio que daría Stripe para informe_unico (en producción sale de prices.retrieve).
const ESPERADO = { precio: "price_informe", importe: 199, moneda: "eur" };

function sesion(cambios = {}) {
  return {
    id: "cs_1", mode: "payment", payment_status: "paid", currency: "eur", amount_total: 199,
    client_reference_id: "u1",
    metadata: { gestor_id: "u1", producto: "informe", ejercicio: "2025" },
    line_items: { data: [{ price: { id: "price_informe" }, quantity: 1 }] },
    payment_intent: { id: "pi_1", latest_charge: { id: "ch_1", payment_intent: "pi_1", refunded: false, amount_refunded: 0 } },
    ...cambios,
  };
}

// Tabla informes_comprados en memoria, con la misma semántica que index.ts.
function entorno({ ses = sesion(), cargo = null, esperado = ESPERADO } = {}) {
  const filas = [];
  const logs = [];
  const deps = {
    leerSesion: async () => structuredClone(ses),
    precioEsperado: async () => esperado,
    guardarInforme: async (fila) => {      // upsert ignoreDuplicates por sesion_proveedor_id
      if (!filas.some((f) => f.sesion_proveedor_id === fila.sesion_proveedor_id)) filas.push({ ...fila });
    },
    leerCargo: async () => structuredClone(cargo),
    sesionDePago: async (pi) => (pi === "pi_1" ? "cs_1" : null),
    marcarReembolsado: async ({ pago, sesion: sid, fecha }) => {
      let n = 0;
      for (const f of filas) {
        if ((f.pago_proveedor_id === pago || f.sesion_proveedor_id === sid) && f.reembolsado_en == null) {
          f.reembolsado_en = fecha; f.pago_proveedor_id = pago; n++;
        }
      }
      return n;
    },
    log: (nivel, mensaje, datos) => logs.push({ nivel, mensaje, datos }),
  };
  return { deps, filas, logs };
}

const reembolsado = { id: "ch_1", payment_intent: "pi_1", refunded: true, amount_refunded: 199,
  refunds: { data: [{ created: 1763900000 }] } };

test("importe, moneda, modo y precio correctos: se registra", () => {
  const v = validarPagoInforme(sesion(), ESPERADO);
  assert.equal(v.ok, true);
  assert.deepEqual(v.fila, { usuario_id: "u1", ejercicio: 2025, sesion_proveedor_id: "cs_1",
    pago_proveedor_id: "pi_1", importe_centimos: 199, moneda: "eur" });
});

test("importe incorrecto: no se registra y queda un log claro", async () => {
  assert.equal(validarPagoInforme(sesion({ amount_total: 1 }), ESPERADO).motivo, "importe_no_valido");
  assert.equal(validarPagoInforme(sesion({ amount_total: null }), ESPERADO).motivo, "importe_no_valido");
  const { deps, filas, logs } = entorno({ ses: sesion({ amount_total: 100 }) });
  const r = await registrarInforme("cs_1", deps);
  assert.equal(r.registrado, false);
  assert.equal(filas.length, 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].nivel, "error");
  assert.match(logs[0].mensaje, /NO registrado \(importe_no_valido\)/);
  assert.deepEqual(logs[0].datos, { sesion: "cs_1", importe: 100, esperado: 199 });
});

test("el importe esperado sale del precio, no de una cifra fija", () => {
  const otro = { ...ESPERADO, importe: 299 };
  assert.equal(validarPagoInforme(sesion({ amount_total: 299 }), otro).ok, true);
  assert.equal(validarPagoInforme(sesion(), otro).motivo, "importe_no_valido");
  assert.equal(validarPagoInforme(sesion(), null).motivo, "precio_no_configurado");
});

test("moneda incorrecta: no se registra", async () => {
  assert.equal(validarPagoInforme(sesion({ currency: "usd" }), ESPERADO).motivo, "moneda_no_valida");
  assert.equal(validarPagoInforme(sesion({ currency: "usd" }), { ...ESPERADO, moneda: "usd" }).motivo, "moneda_no_valida");
  const { deps, filas, logs } = entorno({ ses: sesion({ currency: "gbp" }) });
  await registrarInforme("cs_1", deps);
  assert.equal(filas.length, 0);
  assert.match(logs[0].mensaje, /moneda_no_valida/);
});

test("modo, línea de precio y datos: otros rechazos", () => {
  assert.equal(validarPagoInforme(sesion({ mode: "subscription" }), ESPERADO).motivo, "modo_no_valido");
  assert.equal(validarPagoInforme(sesion({ line_items: { data: [{ price: "price_otro", quantity: 1 }] } }), ESPERADO).motivo, "precio_no_valido");
  assert.equal(validarPagoInforme(sesion({ line_items: { data: [{ price: "price_informe", quantity: 2 }] } }), ESPERADO).motivo, "precio_no_valido");
  assert.equal(validarPagoInforme(sesion({ line_items: undefined }), ESPERADO).motivo, "sin_lineas");
  assert.equal(validarPagoInforme(sesion({ metadata: { producto: "informe", ejercicio: "x" }, client_reference_id: "u1" }), ESPERADO).motivo, "ejercicio_no_valido");
  assert.equal(validarPagoInforme(sesion({ metadata: { producto: "otro" } }), ESPERADO).motivo, "no_es_informe");
});

test("pago diferido aún pendiente: no se registra ni se avisa como error", async () => {
  const { deps, filas, logs } = entorno({ ses: sesion({ payment_status: "unpaid" }) });
  const r = await registrarInforme("cs_1", deps);
  assert.equal(r.motivo, "no_pagado");
  assert.equal(filas.length, 0);
  assert.equal(logs.length, 0);
});

test("sin precio configurado: error para que Stripe reintente", async () => {
  const { deps } = entorno({ esperado: null });
  await assert.rejects(registrarInforme("cs_1", deps), /precio del informe no configurado/);
});

test("evento duplicado: una sola fila", async () => {
  const { deps, filas } = entorno();
  assert.equal((await registrarInforme("cs_1", deps)).registrado, true);
  assert.equal((await registrarInforme("cs_1", deps)).registrado, true);   // completed + reintento
  assert.equal(filas.length, 1);
  assert.equal(filas[0].reembolsado_en, null);
});

test("reembolso total: el informe queda revocado; repetirlo no cambia la fecha", async () => {
  const { deps, filas, logs } = entorno({ cargo: reembolsado });
  await registrarInforme("cs_1", deps);
  const r = await revocarInforme("ch_1", deps);
  assert.equal(r.revocado, true);
  assert.equal(filas[0].reembolsado_en, new Date(1763900000 * 1000).toISOString());
  assert.equal(logs.at(-1).nivel, "info");
  const fecha = filas[0].reembolsado_en;
  assert.equal((await revocarInforme("ch_1", deps)).revocado, false);    // evento duplicado
  assert.equal(filas[0].reembolsado_en, fecha);
  // Un checkout.session.completed repetido después no lo vuelve a desbloquear.
  await registrarInforme("cs_1", deps);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].reembolsado_en, fecha);
});

test("reembolso de una compra apuntada sin payment_intent: se enlaza por la sesión", async () => {
  const { deps, filas } = entorno({ cargo: reembolsado });
  filas.push({ usuario_id: "u1", ejercicio: 2025, sesion_proveedor_id: "cs_1", pago_proveedor_id: null, reembolsado_en: null });
  assert.equal((await revocarInforme("ch_1", deps)).revocado, true);
  assert.equal(filas[0].pago_proveedor_id, "pi_1");
  assert.notEqual(filas[0].reembolsado_en, null);
});

test("reembolso antes que el pago (eventos desordenados): la fila nace revocada", async () => {
  const ses = sesion({ payment_intent: { id: "pi_1", latest_charge: reembolsado } });
  const { deps, filas } = entorno({ ses, cargo: reembolsado });
  assert.equal((await revocarInforme("ch_1", deps)).revocado, false);    // aún no hay fila
  await registrarInforme("cs_1", deps);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].reembolsado_en, new Date(1763900000 * 1000).toISOString());
});

test("reembolso parcial: no revoca y lo avisa", async () => {
  const parcial = { id: "ch_1", payment_intent: "pi_1", refunded: false, amount_refunded: 50 };
  assert.deepEqual(reembolsoDeCargo(parcial), { pago: "pi_1", total: false, parcial: true, fecha: null });
  const { deps, filas, logs } = entorno({ cargo: parcial });
  await registrarInforme("cs_1", deps);
  assert.equal((await revocarInforme("ch_1", deps)).motivo, "parcial");
  assert.equal(filas[0].reembolsado_en, null);
  assert.equal(logs.at(-1).nivel, "warn");
});

test("reembolso de otro pago (p. ej. una suscripción): no toca los informes", async () => {
  const { deps, filas } = entorno({ cargo: { ...reembolsado, id: "ch_9", payment_intent: "pi_9" } });
  await registrarInforme("cs_1", deps);
  assert.equal((await revocarInforme("ch_9", deps)).revocado, false);
  assert.equal(filas[0].reembolsado_en, null);
});

test("index.ts usa la misma fuente de precio que crear-checkout y atiende charge.refunded", () => {
  const webhook = readFileSync(new URL("../supabase/functions/stripe-webhook/index.ts", import.meta.url), "utf8");
  const checkout = readFileSync(new URL("../supabase/functions/crear-checkout/index.ts", import.meta.url), "utf8");
  assert.match(checkout, /precio\(s, "informe", "unico"\)/);
  assert.match(webhook, /precio\(s, "informe", "unico"\)/);
  assert.match(webhook, /case "charge\.refunded"/);
  assert.doesNotMatch(webhook, /amount_total\s*[!=]==?\s*\d/);       // ninguna cifra fija
});

test("la web no cuenta como comprado un informe reembolsado", () => {
  const js = readFileSync(new URL("../web/js/informe.js", import.meta.url), "utf8");
  assert.match(js, /from\("informes_comprados"\)[\s\S]{0,120}\.is\("reembolsado_en", null\)/);
});
