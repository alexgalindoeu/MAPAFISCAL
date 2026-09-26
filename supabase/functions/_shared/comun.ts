// Utilidades compartidas por las Edge Functions de Mapafiscal.
import Stripe from "npm:stripe@17.7.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

/** Estados de Stripe que dan acceso al plan (past_due lo conserva mientras Stripe reintenta el cobro). */
export const ACTIVOS = new Set(["active", "trialing", "past_due"]);

// Orígenes de la web admitidos: SITE_ORIGIN, uno o varios separados por comas
// (p. ej. "https://alexgalindoeu.github.io,http://localhost:8080"). Vacío = cualquiera.
const ORIGENES = (Deno.env.get("SITE_ORIGIN") ?? "")
  .split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);

/** Cabeceras CORS: devuelve el origen de la petición si está admitido. */
export function cors(req: Request): Record<string, string> {
  const origen = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENES.length === 0 ? "*" : ORIGENES.includes(origen) ? origen : ORIGENES[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

// URL de una página sin hash, acabada en "/" salvo que sea un fichero (index.html).
function normalizar(u: URL): string {
  const ruta = /\/$|\.html?$/.test(u.pathname) ? u.pathname : u.pathname + "/";
  return u.origin + ruta;
}

/**
 * Página a la que vuelve el usuario desde Stripe: la que indique la web (`volver`) si su
 * origen está admitido en SITE_ORIGIN; si no, SITE_URL. Se le añade después "#vista".
 */
export function urlVuelta(req: Request, volver?: unknown): string {
  if (typeof volver === "string" && ORIGENES.length) {
    try {
      const u = new URL(volver);
      if (ORIGENES.includes(u.origin)) return normalizar(u);
    } catch { /* URL no válida: se usa SITE_URL */ }
  }
  const site = Deno.env.get("SITE_URL") ?? req.headers.get("origin") ?? "";
  try { return normalizar(new URL(site)); } catch { return site; }
}

/** Stripe configurado con la clave secreta del entorno, o null si aún no hay claves. */
export function stripe(): Stripe | null {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", httpClient: Stripe.createFetchHttpClient() });
}

// Clave secreta de Supabase: la nueva (`sb_secret_…`, en SUPABASE_SECRET_KEYS) si existe,
// o la antigua `service_role` (Supabase retira las claves antiguas a finales de 2026).
function claveServicio(): string {
  try {
    const nuevas = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (typeof nuevas.default === "string" && nuevas.default) return nuevas.default;
  } catch { /* formato inesperado: se usa la antigua */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

/** Cliente con privilegios de servicio (solo en servidor: escribe suscripciones y planes). */
export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, claveServicio(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Usuario autenticado a partir del JWT de la petición (o null). */
export async function usuario(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await admin().auth.getUser(jwt);
  return error ? null : data.user;
}

/**
 * Precio de Stripe de un plan y periodo. Se busca por su `lookup_key` (`gestor_mensual`…);
 * el secreto STRIPE_PRICE_<PLAN>_<PERIODO> con un `price_…`, si existe, tiene prioridad.
 */
export async function precio(s: Stripe, plan: string, periodo: string): Promise<string | undefined> {
  const fijo = Deno.env.get(`STRIPE_PRICE_${plan.toUpperCase()}_${periodo.toUpperCase()}`);
  if (fijo) return fijo;
  const { data } = await s.prices.list({ lookup_keys: [`${plan}_${periodo}`], active: true, limit: 1 });
  return data[0]?.id;
}
