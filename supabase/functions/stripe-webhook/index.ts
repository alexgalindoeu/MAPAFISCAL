// POST /functions/v1/stripe-webhook  (lo llama Stripe; sin JWT, verificado por firma)
// Mantiene `suscripciones` y `perfiles.plan` sincronizados con Stripe.
import Stripe from "npm:stripe@17.7.0";
import { ACTIVOS, admin, stripe } from "../_shared/comun.ts";

const respuesta = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

// El fin de periodo está en la suscripción (API ≤ 2025-02) o en sus items (API posterior).
function finPeriodo(sub: Stripe.Subscription): string | null {
  // deno-lint-ignore no-explicit-any
  const s = sub as any;
  const t = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return t ? new Date(t * 1000).toISOString() : null;
}

// Stripe no garantiza el orden de los eventos: en lugar de fiarse del objeto del evento,
// se lee el estado actual de la suscripción, así un evento atrasado no deshace otro posterior.
async function sincronizar(s: Stripe, id: string) {
  const sub = await s.subscriptions.retrieve(id);
  const gestorId = sub.metadata?.gestor_id;
  if (!gestorId) return;                                        // suscripción ajena a Mapafiscal
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
    actualizado_en: new Date().toISOString(),
  };
  // Al pagar, Stripe envía varios eventos a la vez: si dos crean la fila a la vez, el
  // segundo choca con la clave única del cliente (23505); al repetirlo ya es una actualización.
  let { error: e1 } = await db.from("suscripciones").upsert(fila);
  if (e1?.code === "23505") ({ error: e1 } = await db.from("suscripciones").upsert(fila));
  if (e1) throw e1;
  const { error: e2 } = await db.from("perfiles")
    .update({ plan: ACTIVOS.has(sub.status) ? plan : "gratis" }).eq("id", gestorId);
  if (e2) throw e2;
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
        break;
      }
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
