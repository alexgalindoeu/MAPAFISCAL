// Lógica del pago único del informe completo, sin Deno ni Stripe: la usa stripe-webhook
// (index.ts, que le pasa las dependencias reales) y la prueban los tests de Node
// (test/stripe_webhook.test.mjs, con dependencias falsas).
//
// Dependencias (`deps`), todas asíncronas salvo `log`:
//   leerSesion(id)        sesión de Checkout releída de Stripe, con `line_items` y
//                         `payment_intent.latest_charge` expandidos
//   precioEsperado()      { precio, importe, moneda } del precio del informe (el mismo que usa
//                         crear-checkout: lookup_key informe_unico o STRIPE_PRICE_INFORME_UNICO),
//                         o null si no está configurado
//   guardarInforme(fila)  upsert por sesion_proveedor_id que no pisa una fila existente
//   leerCargo(id)         cargo releído de Stripe, con `refunds` expandido
//   sesionDePago(pi)      id de la sesión de Checkout de un payment_intent, o null
//   marcarReembolsado({ pago, sesion, fecha })  pone reembolsado_en si aún está vacío y
//                         devuelve cuántas filas ha cambiado
//   log(nivel, mensaje, datos)

export const PRODUCTO = "informe";
export const MONEDA = "eur";            // el informe se vende solo en euros

const id = (x) => (typeof x === "string" ? x : x?.id ?? null);
const fecha = (t) => (t ? new Date(t * 1000).toISOString() : null);

/** ¿Es una sesión de Checkout del informe? (las demás, p. ej. suscripciones, se ignoran) */
export function esSesionInforme(ses) {
  return ses?.metadata?.producto === PRODUCTO;
}

/**
 * Comprueba una sesión de Checkout del informe contra el precio esperado.
 * Devuelve { ok: true, fila } o { ok: false, motivo, detalle }. `motivo` "no_pagado" es normal
 * (pago diferido aún pendiente); los demás indican un pago que no cuadra.
 */
export function validarPagoInforme(ses, esperado) {
  const no = (motivo, detalle = {}) => ({ ok: false, motivo, detalle: { sesion: ses?.id ?? null, ...detalle } });
  if (!esSesionInforme(ses)) return no("no_es_informe");
  if (ses.mode !== "payment") return no("modo_no_valido", { modo: ses.mode });
  if (ses.payment_status !== "paid") return no("no_pagado", { estado: ses.payment_status });
  const usuarioId = ses.metadata?.gestor_id ?? ses.client_reference_id;
  const ejercicio = Number(ses.metadata?.ejercicio);
  if (!usuarioId) return no("sin_usuario");
  if (!Number.isInteger(ejercicio) || ejercicio < 2020 || ejercicio > 2100) {
    return no("ejercicio_no_valido", { ejercicio: ses.metadata?.ejercicio });
  }
  if (!esperado || !esperado.precio || !Number.isInteger(esperado.importe) || !esperado.moneda) {
    return no("precio_no_configurado");
  }
  const moneda = String(ses.currency ?? "").toLowerCase();
  if (moneda !== MONEDA || moneda !== String(esperado.moneda).toLowerCase()) {
    return no("moneda_no_valida", { moneda: ses.currency ?? null, esperada: esperado.moneda });
  }
  if (ses.amount_total !== esperado.importe) {
    return no("importe_no_valido", { importe: ses.amount_total ?? null, esperado: esperado.importe });
  }
  // Una sola línea, del precio del informe y con cantidad 1.
  const lineas = ses.line_items?.data;
  if (!Array.isArray(lineas)) return no("sin_lineas");
  const precios = lineas.map((l) => id(l.price));
  if (lineas.length !== 1 || precios[0] !== esperado.precio || lineas[0].quantity !== 1) {
    return no("precio_no_valido", { precios, esperado: esperado.precio });
  }
  return {
    ok: true,
    fila: {
      usuario_id: usuarioId,
      ejercicio,
      sesion_proveedor_id: ses.id,
      pago_proveedor_id: id(ses.payment_intent),
      importe_centimos: ses.amount_total,
      moneda,
    },
  };
}

/** Estado de reembolso de un cargo: { pago, total, parcial, fecha }. */
export function reembolsoDeCargo(cargo) {
  const total = cargo?.refunded === true;
  const parcial = !total && (cargo?.amount_refunded ?? 0) > 0;
  const ultimo = (cargo?.refunds?.data ?? []).reduce((m, r) => Math.max(m, r.created ?? 0), 0);
  return { pago: id(cargo?.payment_intent), total, parcial, fecha: fecha(ultimo) };
}

/**
 * checkout.session.completed / async_payment_succeeded: relee la sesión y, si es un pago
 * del informe que cuadra con el precio, la apunta. Repetir el evento no duplica la fila.
 * Si el cargo ya está reembolsado (el reembolso llegó antes), la fila nace revocada.
 */
export async function registrarInforme(sesionId, deps) {
  const ses = await deps.leerSesion(sesionId);
  if (!esSesionInforme(ses)) return { registrado: false, motivo: "no_es_informe" };
  const esperado = await deps.precioEsperado();
  // Sin precio configurado no se puede validar: error para que Stripe reintente.
  if (!esperado) throw new Error("webhook informe: precio del informe no configurado (informe_unico)");
  const v = validarPagoInforme(ses, esperado);
  if (!v.ok) {
    if (v.motivo !== "no_pagado") {
      deps.log("error", `webhook informe: pago NO registrado (${v.motivo})`, v.detalle);
    }
    return { registrado: false, motivo: v.motivo };
  }
  const cargo = typeof ses.payment_intent === "object" ? ses.payment_intent?.latest_charge : null;
  const r = cargo && typeof cargo === "object" ? reembolsoDeCargo(cargo) : null;
  const fila = { ...v.fila, reembolsado_en: r?.total ? (r.fecha ?? new Date().toISOString()) : null };
  await deps.guardarInforme(fila);
  return { registrado: true, fila };
}

/**
 * charge.refunded: relee el cargo y, si está reembolsado del todo, revoca el informe de su
 * payment_intent (deja de estar desbloqueado). Un reembolso parcial no lo revoca.
 */
export async function revocarInforme(cargoId, deps) {
  const cargo = await deps.leerCargo(cargoId);
  const r = reembolsoDeCargo(cargo);
  if (!r.pago) return { revocado: false, motivo: "sin_pago" };
  // No se filtra por metadatos del cargo: solo cambia filas de informes_comprados de ese
  // payment_intent, así que el reembolso de una suscripción no toca nada.
  if (!r.total) {
    if (r.parcial) deps.log("warn", "webhook informe: reembolso parcial, el informe sigue desbloqueado", { cargo: cargoId, pago: r.pago });
    return { revocado: false, motivo: r.parcial ? "parcial" : "sin_reembolso" };
  }
  const sesion = await deps.sesionDePago(r.pago);
  // Devuelve cuántas filas ha revocado ahora: 0 si no es un informe, si ya estaba revocado
  // (evento repetido) o si la compra aún no está apuntada (registrarInforme la creará revocada).
  const n = await deps.marcarReembolsado({ pago: r.pago, sesion, fecha: r.fecha ?? new Date().toISOString() });
  if (n > 0) deps.log("info", "webhook informe: informe revocado por reembolso", { cargo: cargoId, pago: r.pago, sesion });
  return { revocado: n > 0, pago: r.pago, sesion };
}
