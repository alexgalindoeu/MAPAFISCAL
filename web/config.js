// Configuración pública de la web: se sirve al navegador, así que aquí NO van secretos.
// La clave publicable de Supabase es pública por diseño; los datos están protegidos por RLS.
// La versión autónoma (npm run empaquetar, el artifact) fuerza `demo: true` y no usa Supabase.
window.MAPAFISCAL_CONFIG = {
  demo: false,
  supabaseUrl: "https://pqiqrcvuztxrwrwizppj.supabase.co",
  supabaseKey: "sb_publishable_H5plGsoIk0bKwlu2Kdf1kQ_1pTPoaFl",

  // Cobro con Stripe (Edge Functions crear-checkout / portal-facturacion). En false, los
  // botones de pago apuntan a la lista de espera. Ponlo en true solo cuando el webhook
  // responda 400 (y no 503) a un POST vacío: ver supabase/README.md.
  pagosActivos: false,

  // Precios mostrados en Planes. Tienen que coincidir con los de Stripe (lookup_key
  // gestor_semanal, gestor_mensual, gestor_anual). Orientativos hasta que se cierren.
  precios: { gestorSemanal: 19.99, gestorMensual: 39.99, gestorAnual: 290 },
  preciosOrientativos: true,

  // Buzón de contacto: sale en los textos legales (web/legal/) y en los enlaces mailto.
  contacto: "contacto@mapafiscal.es",

  // Versión vigente de las condiciones (fecha de legal/condiciones.html). Al cambiarla, la web
  // vuelve a pedir la aceptación a quien aceptó una versión anterior.
  condicionesVersion: "2026-09-27"
};
