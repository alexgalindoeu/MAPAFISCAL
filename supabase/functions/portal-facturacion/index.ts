// POST /functions/v1/portal-facturacion  { volver?: url } — abre el portal de Stripe para
// gestionar la suscripción (cambiar tarjeta o periodo, descargar facturas, cancelar). Requiere sesión.
import { admin, cors, json, stripe, urlVuelta, usuario } from "../_shared/comun.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "metodo_no_permitido" }, 405);

  const s = stripe();
  if (!s) return json(req, { error: "pagos_no_configurados" }, 503);
  const user = await usuario(req);
  if (!user) return json(req, { error: "sin_sesion" }, 401);

  let body: { volver?: string } = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }

  const { data: sus } = await admin().from("suscripciones")
    .select("cliente_proveedor_id").eq("gestor_id", user.id).maybeSingle();
  if (!sus?.cliente_proveedor_id) return json(req, { error: "sin_suscripcion" }, 404);

  try {
    const portal = await s.billingPortal.sessions.create({
      customer: sus.cliente_proveedor_id,
      return_url: `${urlVuelta(req, body.volver)}#gestor`,
      locale: "es",
    });
    return json(req, { url: portal.url });
  } catch (e) {
    console.error("portal-facturacion", e);
    return json(req, { error: "error_stripe" }, 502);
  }
});
