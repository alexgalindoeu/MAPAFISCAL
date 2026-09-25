// POST /functions/v1/stripe-webhook  (lo llama Stripe; sin JWT, verificado por firma)
// Mantiene `suscripciones` y `perfiles.plan` sincronizados con Stripe.
import Stripe from "npm:stripe@17.7.0";
import { admin, json, stripe } from "../_shared/comun.ts";

const ACTIVOS = new Set(["active", "trialing", "past_due"]);   // past_due conserva acceso durante el reintento

// El fin de periodo está en la suscripción (API ≤ 2025-02) o en sus items (API posterior).
function finPeriodo(sub: Stripe.Subscription): string | null {
  // deno-lint-ignore no-explicit-any
  const s = sub as any;
  const t = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return t ? new Date(t * 1000).toISOString() : null;
}

async function guardar(sub: Stripe.Subscription) {
  const gestorId = sub.metadata?.gestor_id;
  if (!gestorId) return;                                        // suscripción ajena a Mapafiscal
  const plan = sub.metadata?.plan ?? "gestor";
  const db = admin();
  const { error: e1 } = await db.from("suscripciones").upsert({
    gestor_id: gestorId,
    plan,
    estado: sub.status,
    proveedor: "stripe",
    cliente_proveedor_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    suscripcion_proveedor_id: sub.id,
    periodo_fin: finPeriodo(sub),
    actualizado_en: new Date().toISOString(),
  });
  if (e1) throw e1;
  const { error: e2 } = await db.from("perfiles")
    .update({ plan: ACTIVOS.has(sub.status) ? plan : "gratis" }).eq("id", gestorId);
  if (e2) throw e2;
}

Deno.serve(async (req) => {
  const s = stripe();
  const secreto = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!s || !secreto) return json({ error: "pagos_no_configurados" }, 503);

  const firma = req.headers.get("stripe-signature");
  if (!firma) return json({ error: "sin_firma" }, 400);

  let evento: Stripe.Event;
  try {
    evento = await s.webhooks.constructEventAsync(
      await req.text(), firma, secreto, undefined, Stripe.createSubtleCryptoProvider());
  } catch (_e) {
    return json({ error: "firma_no_valida" }, 400);
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed": {
        const ses = evento.data.object as Stripe.Checkout.Session;
        if (ses.subscription) {
          const id = typeof ses.subscription === "string" ? ses.subscription : ses.subscription.id;
          await guardar(await s.subscriptions.retrieve(id));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await guardar(evento.data.object as Stripe.Subscription);
        break;
    }
  } catch (e) {
    console.error("webhook", evento.type, e);
    return json({ error: "error_interno" }, 500);             // Stripe reintentará
  }
  return json({ recibido: true });
});
