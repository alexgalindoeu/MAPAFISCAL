// POST /functions/v1/crear-checkout  { plan: "gestor", periodo: "semanal" | "mensual" | "anual", volver?: url }
//      o, pago único del informe completo: { producto: "informe", ejercicio: 2025, volver?: url }
// Requiere sesión iniciada. Devuelve { url } de Stripe Checkout para suscribirse o pagar el
// informe (precio con lookup_key "informe_unico"; el webhook lo apunta en informes_comprados).
// Mientras no existan los secretos de Stripe responde 503 { error: "pagos_no_configurados" }.
import type Stripe from "npm:stripe@17.7.0";
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

  let body: { plan?: string; periodo?: string; volver?: string; producto?: string; ejercicio?: number } = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  if (body.producto === "informe") return await checkoutInforme(req, s, user, body);
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

    const customer = await clienteStripe(s, user, sus?.cliente_proveedor_id ?? undefined);

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

// Un solo cliente de Stripe por usuario, aunque abandone el checkout y lo repita.
async function clienteStripe(s: Stripe, user: { id: string; email?: string }, guardado?: string): Promise<string> {
  let customer = guardado;
  if (customer) {
    // Puede no existir en este modo de Stripe (un cliente de prueba tras pasar a live) o estar borrado.
    try {
      if ((await s.customers.retrieve(customer)).deleted) customer = undefined;
    } catch (e) {
      if ((e as { code?: string })?.code !== "resource_missing") throw e;
      customer = undefined;
    }
  }
  if (customer) return customer;
  const previos = await s.customers.search({ query: `metadata['gestor_id']:'${user.id}'`, limit: 1 });
  return previos.data[0]?.id ??
    (await s.customers.create({ email: user.email, metadata: { gestor_id: user.id } })).id;
}

// Pago único (1,99 €, IVA incluido) del informe completo de un ejercicio, sin suscripción y
// sin guardar la tarjeta. Con plan de pago ya está incluido: 409 ya_incluido. En la web está
// tras el interruptor `informePago` de web/config.js.
async function checkoutInforme(req: Request, s: Stripe, user: { id: string; email?: string },
  body: { ejercicio?: number; volver?: string }): Promise<Response> {
  const ejercicio = Number(body.ejercicio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2020 || ejercicio > 2100) return json(req, { error: "ejercicio_no_valido" }, 400);
  const db = admin();
  const [{ data: perfil }, { data: sus }] = await Promise.all([
    db.from("perfiles").select("plan").eq("id", user.id).maybeSingle(),
    db.from("suscripciones").select("cliente_proveedor_id").eq("gestor_id", user.id).maybeSingle(),
  ]);
  if (perfil?.plan && perfil.plan !== "gratis") return json(req, { error: "ya_incluido" }, 409);
  try {
    const price = await precio(s, "informe", "unico");     // lookup_key informe_unico
    if (!price) return json(req, { error: "precio_no_configurado", producto: "informe" }, 503);
    const customer = await clienteStripe(s, user, sus?.cliente_proveedor_id ?? undefined);
    const vuelta = urlVuelta(req, body.volver);
    const metadata = { gestor_id: user.id, producto: "informe", ejercicio: String(ejercicio) };
    const session = await s.checkout.sessions.create({
      mode: "payment",
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      metadata,
      payment_intent_data: { metadata },
      invoice_creation: { enabled: true },                 // factura del pago
      customer_update: { name: "auto", address: "auto" },
      locale: "es",
      success_url: `${vuelta}#calculadora?informe=pagado`,
      cancel_url: `${vuelta}#calculadora`,
    });
    return json(req, { url: session.url });
  } catch (e) {
    console.error("crear-checkout informe", e);
    return json(req, { error: "error_stripe" }, 502);
  }
}
