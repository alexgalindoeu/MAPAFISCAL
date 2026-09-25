// Utilidades compartidas por las Edge Functions de Mapafiscal.
import Stripe from "npm:stripe@17.7.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

export const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Stripe configurado con la clave secreta del entorno, o null si aún no hay claves. */
export function stripe(): Stripe | null {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", httpClient: Stripe.createFetchHttpClient() });
}

/** Cliente con privilegios de servicio (solo en servidor: escribe suscripciones y planes). */
export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Usuario autenticado a partir del JWT de la petición (o null). */
export async function usuario(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const cli = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await cli.auth.getUser();
  return error ? null : data.user;
}

/** Precio de Stripe para cada plan y periodo (IDs `price_…` definidos como secretos). */
export function precio(plan: string, periodo: string): string | undefined {
  const clave = `STRIPE_PRICE_${plan.toUpperCase()}_${periodo.toUpperCase()}`;
  return Deno.env.get(clave);
}
