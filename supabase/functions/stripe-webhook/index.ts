// POST /functions/v1/stripe-webhook  (lo llama Stripe; sin JWT, verificado por firma)
// Mantiene `suscripciones` y `perfiles.plan` sincronizados con Stripe, y apunta en
// `informes_comprados` los pagos únicos del informe completo (crear-checkout, producto "informe"):
// solo si cuadran con el precio (importe, moneda, modo) y los revoca si se reembolsan.
import Stripe from "npm:stripe@17.7.0";
import { ACTIVOS, admin, precio, stripe } from "../_shared/comun.ts";
import { esSesionInforme, registrarInforme, revocarInforme } from "./informe.mjs";

const respuesta = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

const fecha = (t?: number | null) => t ? new Date(t * 1000).toISOString() : null;

// El fin de periodo está en la suscripción (API ≤ 2025-02) o en sus items (API posterior).
function finPeriodo(sub: Stripe.Subscription): string | null {
  // deno-lint-ignore no-explicit-any
  const s = sub as any;
  return fecha(s.current_period_end ?? s.items?.data?.[0]?.current_period_end);
}

// Periodo de facturación según el precio (no según la lookup_key, que puede pasar a otro precio).
const PERIODOS: Record<string, string> = { week: "semanal", month: "mensual", year: "anual" };
function periodo(sub: Stripe.Subscription): string | null {
  const r = sub.items?.data?.[0]?.price?.recurring;
  return r && r.interval_count === 1 ? PERIODOS[r.interval] ?? null : null;
}

// Cuándo termina el acceso si la suscripción no se renueva: ya terminada (ended_at), baja
// programada en una fecha (cancel_at) o al final del periodo (cancel_at_period_end).
function terminaEn(sub: Stripe.Subscription): string | null {
  return fecha(sub.ended_at ?? sub.cancel_at) ?? (sub.cancel_at_period_end ? finPeriodo(sub) : null);
}

// Stripe no garantiza el orden de los eventos: en lugar de fiarse del objeto del evento,
// se lee el estado actual de la suscripción, así un evento atrasado no deshace otro posterior.
async function sincronizar(s: Stripe, id: string) {
  const sub = await s.subscriptions.retrieve(id);
  const gestorId = sub.metadata?.gestor_id;
  if (!gestorId) return;               // ajena a Mapafiscal, o de una cuenta borrada (borrar-cuenta)
  const plan = sub.metadata?.plan ?? "gestor";
  const db = admin();

  // Si el gestor tiene otra suscripción activa, una antigua que termina no le quita el plan.
  const { data: actual } = await db.from("suscripciones")
    .select("suscripcion_proveedor_id, estado").eq("gestor_id", gestorId).maybeSingle();
  if (actual?.suscripcion_proveedor_id && actual.suscripcion_proveedor_id !== sub.id &&
      ACTIVOS.has(actual.estado) && !ACTIVOS.has(sub.status)) return;

  const fila = {
    gestor_id: gestorId,
    plan,
    estado: sub.status,
    proveedor: "stripe",
    cliente_proveedor_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    suscripcion_proveedor_id: sub.id,
    periodo_fin: finPeriodo(sub),
    periodo: periodo(sub),
    termina_en: terminaEn(sub),
    actualizado_en: new Date().toISOString(),
  };
  // Al pagar, Stripe envía varios eventos a la vez: si dos crean la fila a la vez, el
  // segundo choca con la clave única del cliente (23505); al repetirlo ya es una actualización.
  let { error: e1 } = await db.from("suscripciones").upsert(fila);
  if (e1?.code === "23505") ({ error: e1 } = await db.from("suscripciones").upsert(fila));
  // 23503: la cuenta ya no existe (se borró); no hay nada que sincronizar.
  if (e1?.code === "23503") { console.warn("webhook: cuenta inexistente", gestorId); return; }
  if (e1) throw e1;
  const { error: e2 } = await db.from("perfiles")
    .update({ plan: ACTIVOS.has(sub.status) ? plan : "gratis" }).eq("id", gestorId);
  if (e2) throw e2;
}

// Pago único del informe completo (lógica en informe.mjs, probada en test/stripe_webhook.test.mjs).
// Como con las suscripciones, no se fía del objeto del evento: relee la sesión y el cargo de
// Stripe, y escribe de forma idempotente (repetir un evento no duplica ni cambia nada).
function depsInforme(s: Stripe) {
  const db = admin();
  return {
    leerSesion: (id: string) =>
      s.checkout.sessions.retrieve(id, { expand: ["line_items", "payment_intent.latest_charge"] }),
    // El mismo precio que cobra crear-checkout: STRIPE_PRICE_INFORME_UNICO o lookup_key informe_unico.
    precioEsperado: async () => {
      const id = await precio(s, "informe", "unico");
      if (!id) return null;
      const p = await s.prices.retrieve(id);
      return { precio: p.id, importe: p.unit_amount, moneda: p.currency };
    },
    guardarInforme: async (fila: Record<string, unknown>) => {
      const { error } = await db.from("informes_comprados")
        .upsert(fila, { onConflict: "sesion_proveedor_id", ignoreDuplicates: true });
      if (error?.code === "23503") { console.warn("webhook: cuenta inexistente", fila.usuario_id); return; }
      if (error) throw error;
    },
    leerCargo: (id: string) => s.charges.retrieve(id, { expand: ["refunds"] }),
    sesionDePago: async (pi: string) =>
      (await s.checkout.sessions.list({ payment_intent: pi, limit: 1 })).data[0]?.id ?? null,
    // Por payment_intent y, para las filas apuntadas antes de guardarlo, por la sesión.
    marcarReembolsado: async ({ pago, sesion, fecha }: { pago: string; sesion: string | null; fecha: string }) => {
      let n = 0;
      for (const [col, val] of [["pago_proveedor_id", pago], ["sesion_proveedor_id", sesion]] as const) {
        if (!val) continue;
        const { error, count } = await db.from("informes_comprados")
          .update({ reembolsado_en: fecha, pago_proveedor_id: pago }, { count: "exact" })
          .eq(col, val).is("reembolsado_en", null);
        if (error) throw error;
        n += count ?? 0;
      }
      return n;
    },
    log: (nivel: "info" | "warn" | "error", mensaje: string, datos: unknown) =>
      console[nivel](mensaje, JSON.stringify(datos)),
  };
}

Deno.serve(async (req) => {
  const s = stripe();
  const secreto = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!s || !secreto) return respuesta({ error: "pagos_no_configurados" }, 503);

  const firma = req.headers.get("stripe-signature");
  if (!firma) return respuesta({ error: "sin_firma" }, 400);

  let evento: Stripe.Event;
  try {
    evento = await s.webhooks.constructEventAsync(
      await req.text(), firma, secreto, undefined, Stripe.createSubtleCryptoProvider());
  } catch (_e) {
    return respuesta({ error: "firma_no_valida" }, 400);
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed": {
        const ses = evento.data.object as Stripe.Checkout.Session;
        if (ses.subscription) {
          await sincronizar(s, typeof ses.subscription === "string" ? ses.subscription : ses.subscription.id);
        }
        if (esSesionInforme(ses)) await registrarInforme(ses.id, depsInforme(s));
        break;
      }
      case "checkout.session.async_payment_succeeded": {  // métodos de pago diferido
        const ses = evento.data.object as Stripe.Checkout.Session;
        if (esSesionInforme(ses)) await registrarInforme(ses.id, depsInforme(s));
        break;
      }
      case "charge.refunded":                              // reembolso: revoca el informe
        await revocarInforme((evento.data.object as Stripe.Charge).id, depsInforme(s));
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await sincronizar(s, (evento.data.object as Stripe.Subscription).id);
        break;
    }
  } catch (e) {
    console.error("webhook", evento.type, e);
    return respuesta({ error: "error_interno" }, 500);        // Stripe reintentará
  }
  return respuesta({ recibido: true });
});
