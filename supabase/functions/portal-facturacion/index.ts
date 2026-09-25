// POST /functions/v1/portal-facturacion — abre el portal de Stripe para gestionar la
// suscripción (cambiar tarjeta, descargar facturas, cancelar). Requiere sesión.
import { admin, CORS, json, stripe, usuario } from "../_shared/comun.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "metodo_no_permitido" }, 405);

  const s = stripe();
  if (!s) return json({ error: "pagos_no_configurados" }, 503);
  const user = await usuario(req);
  if (!user) return json({ error: "sin_sesion" }, 401);

  const { data: sus } = await admin().from("suscripciones")
    .select("cliente_proveedor_id").eq("gestor_id", user.id).maybeSingle();
  if (!sus?.cliente_proveedor_id) return json({ error: "sin_suscripcion" }, 404);

  const site = Deno.env.get("SITE_URL") ?? req.headers.get("origin") ?? "";
  const portal = await s.billingPortal.sessions.create({
    customer: sus.cliente_proveedor_id,
    return_url: `${site}/#gestor`,
    locale: "es",
  });
  return json({ url: portal.url });
});
