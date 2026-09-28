// POST /functions/v1/borrar-cuenta  { confirmar: correo } — borra la cuenta del usuario (derecho de
// supresión, art. 17 RGPD). Requiere sesión, y el correo de la cuenta como confirmación.
//
// 1. Cancela al momento sus suscripciones de Stripe (sin reembolso), para que no se le vuelva a
//    cobrar. Antes les quita `gestor_id`, así el webhook ignora los eventos de la cancelación.
//    El cliente de Stripe se conserva si tiene facturas (obligación legal de conservarlas),
//    marcado con `cuenta_borrada`; si no tiene ninguna, se borra.
// 2. Borra sus solicitudes de la lista de espera.
// 3. Borra el usuario de Supabase Auth: en cascada, su perfil, sus clientes y su suscripción.
// Si Stripe falla, no se borra nada (y se puede repetir).
import Stripe from "npm:stripe@17.7.0";
import { admin, cors, json, stripe, usuario } from "../_shared/comun.ts";

// Estados en los que Stripe todavía podría cobrar o reactivar la suscripción.
const VIVAS = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);

const noExiste = (e: unknown) => (e as { code?: string })?.code === "resource_missing";

async function cerrarEnStripe(s: Stripe, customer: string) {
  const ahora = new Date().toISOString();
  try {
    const subs = await s.subscriptions.list({ customer, status: "all", limit: 100 });
    for (const sub of subs.data) {
      if (!VIVAS.has(sub.status)) continue;
      await s.subscriptions.update(sub.id, { metadata: { gestor_id: "", cuenta_borrada: ahora } });
      await s.subscriptions.cancel(sub.id);
    }
    const facturas = await s.invoices.list({ customer, limit: 1 });
    if (facturas.data.length) {
      await s.customers.update(customer, { metadata: { gestor_id: "", cuenta_borrada: ahora } });
    } else {
      await s.customers.del(customer);
    }
  } catch (e) {
    // Cliente que no existe en este modo de Stripe (p. ej. uno de prueba tras pasar a live).
    if (!noExiste(e)) throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "metodo_no_permitido" }, 405);

  const user = await usuario(req);
  if (!user) return json(req, { error: "sin_sesion" }, 401);

  let body: { confirmar?: string } = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  const correo = (user.email ?? "").trim().toLowerCase();
  if (!correo || (body.confirmar ?? "").trim().toLowerCase() !== correo) {
    return json(req, { error: "confirmacion_no_valida" }, 400);
  }

  const db = admin();
  const { data: sus } = await db.from("suscripciones")
    .select("cliente_proveedor_id").eq("gestor_id", user.id).maybeSingle();
  const s = stripe();
  if (s) {
    try {
      // El cliente guardado y cualquier otro creado para esta cuenta (p. ej. en un pago abandonado).
      const clientes = new Set<string>();
      if (sus?.cliente_proveedor_id) clientes.add(sus.cliente_proveedor_id);
      const previos = await s.customers.search({ query: `metadata['gestor_id']:'${user.id}'`, limit: 100 });
      for (const c of previos.data) clientes.add(c.id);
      for (const c of clientes) await cerrarEnStripe(s, c);
    } catch (e) {
      console.error("borrar-cuenta: stripe", e);
      return json(req, { error: "error_stripe" }, 502);
    }
  } else if (sus?.cliente_proveedor_id) {
    // Sin claves de Stripe no se puede cancelar la suscripción: mejor no borrar la cuenta.
    return json(req, { error: "pagos_no_configurados" }, 503);
  }

  const { error: e1 } = await db.from("lista_espera").delete().ilike("email", correo);
  if (e1) console.error("borrar-cuenta: lista_espera", e1);

  const { error: e2 } = await db.auth.admin.deleteUser(user.id);
  if (e2) {
    console.error("borrar-cuenta: auth", e2);
    return json(req, { error: "error_interno" }, 500);
  }
  return json(req, { borrada: true });
});
