// POST /functions/v1/crear-checkout  { plan: "gestor", periodo: "semanal" | "mensual" | "anual", volver?: url }
// Requiere sesión iniciada. Devuelve { url } de Stripe Checkout para suscribirse.
// Mientras no existan los secretos de Stripe responde 503 { error: "pagos_no_configurados" }.
import { ACTIVOS, admin, cors, json, precio, stripe, urlVuelta, usuario } from "../_shared/comun.ts";

const PLANES = new Set(["gestor"]);          // "despacho" se contrata a medida
const PERIODOS = new Set(["semanal", "mensual", "anual"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "metodo_no_permitido" }, 405);

  const s = stripe();
  if (!s) return json(req, { error: "pagos_no_configurados" }, 503);

  const user = await usuario(req);
  if (!user) return json(req, { error: "sin_sesion" }, 401);

  let body: { plan?: string; periodo?: string; volver?: string } = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  const plan = body.plan ?? "gestor";
  const periodo = body.periodo ?? "mensual";
  if (!PLANES.has(plan) || !PERIODOS.has(periodo)) return json(req, { error: "plan_no_valido" }, 400);

  const db = admin();
  const { data: sus } = await db.from("suscripciones")
    .select("cliente_proveedor_id, estado").eq("gestor_id", user.id).maybeSingle();
  // Ya suscrito: los cambios de periodo y la baja se hacen en el portal de facturación.
  if (sus && ACTIVOS.has(sus.estado)) return json(req, { error: "ya_suscrito" }, 409);

  try {
    const price = await precio(s, plan, periodo);
    if (!price) return json(req, { error: "precio_no_configurado", plan, periodo }, 503);

    // Un solo cliente de Stripe por gestor, aunque abandone el checkout y lo repita.
    let customer = sus?.cliente_proveedor_id ?? undefined;
    if (!customer) {
      const previos = await s.customers.search({ query: `metadata['gestor_id']:'${user.id}'`, limit: 1 });
      customer = previos.data[0]?.id ??
        (await s.customers.create({ email: user.email, metadata: { gestor_id: user.id } })).id;
    }

    const vuelta = urlVuelta(req, body.volver);
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { gestor_id: user.id, plan } },
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },                 // NIF de la gestoría en la factura
      customer_update: { name: "auto", address: "auto" },
      locale: "es",
      success_url: `${vuelta}#gestor?pago=ok`,
      cancel_url: `${vuelta}#planes`,
    });
    return json(req, { url: session.url });
  } catch (e) {
    console.error("crear-checkout", e);
    return json(req, { error: "error_stripe" }, 502);
  }
});
