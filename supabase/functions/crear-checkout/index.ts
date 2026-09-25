// POST /functions/v1/crear-checkout  { plan: "gestor", periodo: "mensual" | "anual" }
// Requiere sesión iniciada. Devuelve { url } de Stripe Checkout para suscribirse.
// Mientras no existan los secretos de Stripe responde 503 { error: "pagos_no_configurados" }.
import { admin, CORS, json, precio, stripe, usuario } from "../_shared/comun.ts";

const PLANES = new Set(["gestor"]);          // "despacho" se contrata a medida
const PERIODOS = new Set(["mensual", "anual"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "metodo_no_permitido" }, 405);

  const s = stripe();
  if (!s) return json({ error: "pagos_no_configurados" }, 503);

  const user = await usuario(req);
  if (!user) return json({ error: "sin_sesion" }, 401);

  let body: { plan?: string; periodo?: string } = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  const plan = body.plan ?? "gestor";
  const periodo = body.periodo ?? "mensual";
  if (!PLANES.has(plan) || !PERIODOS.has(periodo)) return json({ error: "plan_no_valido" }, 400);

  const price = precio(plan, periodo);
  if (!price) return json({ error: "precio_no_configurado", plan, periodo }, 503);

  const db = admin();
  const { data: sus } = await db.from("suscripciones")
    .select("cliente_proveedor_id").eq("gestor_id", user.id).maybeSingle();

  let customer = sus?.cliente_proveedor_id ?? undefined;
  if (!customer) {
    const c = await s.customers.create({ email: user.email, metadata: { gestor_id: user.id } });
    customer = c.id;
  }

  const site = Deno.env.get("SITE_URL") ?? req.headers.get("origin") ?? "";
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { gestor_id: user.id, plan } },
    allow_promotion_codes: true,
    locale: "es",
    success_url: `${site}/#gestor?pago=ok`,
    cancel_url: `${site}/#planes`,
  });

  return json({ url: session.url });
});
