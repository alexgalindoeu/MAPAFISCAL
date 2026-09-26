// Configuración pública de la web: se sirve al navegador, así que aquí NO van secretos.
// La clave publicable de Supabase es pública por diseño; los datos están protegidos por RLS.
// La versión autónoma (npm run empaquetar, el artifact) fuerza `demo: true` y no usa Supabase.
window.MAPAFISCAL_CONFIG = {
  demo: false,
  supabaseUrl: "https://pqiqrcvuztxrwrwizppj.supabase.co",
  supabaseKey: "sb_publishable_H5plGsoIk0bKwlu2Kdf1kQ_1pTPoaFl",

  // Cobro con Stripe (Edge Functions crear-checkout / portal-facturacion). En false, los
  // botones de pago apuntan a la lista de espera. Activado el 2026-09-26 (Alex), con el
  // backend configurado y probado en modo test: ver supabase/README.md.
  pagosActivos: true,

  // Precios mostrados en Planes. Tienen que coincidir con los de Stripe (lookup_key
  // gestor_semanal, gestor_mensual, gestor_anual). Orientativos hasta que se cierren.
  precios: { gestorSemanal: 19.99, gestorMensual: 39.99, gestorAnual: 290 },
  preciosOrientativos: true,

  contacto: "hola@mapafiscal.es"
};
