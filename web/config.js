// Configuración pública de la web: se sirve al navegador, así que aquí NO van secretos.
// La clave publicable de Supabase es pública por diseño; los datos están protegidos por RLS.
// La versión autónoma (npm run empaquetar, el artifact) fuerza `demo: true` y no usa Supabase.
window.MAPAFISCAL_CONFIG = {
  demo: false,
  supabaseUrl: "https://pqiqrcvuztxrwrwizppj.supabase.co",
  supabaseKey: "sb_publishable_H5plGsoIk0bKwlu2Kdf1kQ_1pTPoaFl",

  // Cobro con Stripe (Edge Functions crear-checkout / portal-facturacion). Activado el
  // 2026-09-26, con el backend configurado y probado en modo test: ver
  // supabase/README.md. Solo cambia si «Gestionar suscripción» debe verse en Mis clientes
  // y Perfil; «Suscribirme» siempre lleva a Stripe Checkout (si no está configurado, la
  // Edge Function responde con un aviso).
  pagosActivos: true,

  // Precios mostrados en Planes. Tienen que coincidir con los de Stripe (lookup_key
  // gestor_semanal, gestor_mensual, gestor_anual). Orientativos hasta que se cierren.
  precios: { gestorSemanal: 19.99, gestorMensual: 39.99, gestorAnual: 290 },
  preciosOrientativos: true,

  // Buzón de contacto: sale en los textos legales (web/legal/) y en los enlaces mailto.
  contacto: "contacto@mapafiscal.es",

  // Versión vigente de las condiciones (fecha de legal/condiciones.html). Al cambiarla, la web
  // vuelve a pedir la aceptación a quien aceptó una versión anterior.
  condicionesVersion: "2026-09-27",

  // Anuncios (Google AdSense): carriles laterales en escritorio y huecos en el flujo. En
  // false no se carga nada de Google ni la CMP, y no hay aviso de cookies porque no hace
  // falta. Nunca para quien tiene plan de pago. La versión autónoma (empaquetar.mjs) lo fuerza
  // a false. PARA ENCENDER: poner los data-ad-slot de abajo y `anuncios: true` en la misma PR
  // (la política de cookies se adapta sola: legal/cookies.html lee este fichero).
  anuncios: false,
  adsenseCliente: "ca-pub-3028486034839853",

  // Consentimiento en el EEE: "google" = CMP certificada de Google («Privacidad y mensajes»
  // de AdSense, mensaje RGPD publicado): sale sola con los anuncios, sin aviso propio.
  // "propio" = aviso de Mapafiscal (Aceptar/Rechazar) y nada de Google hasta aceptar; solo
  // como plan B, porque sin CMP certificada Google solo sirve anuncios limitados.
  consentimiento: "google",

  // data-ad-slot de cada bloque (AdSense → Anuncios → Por bloque de anuncios → Anuncios de
  // display, «Adaptable»). Vacío, ese hueco no se muestra ni pide nada.
  adsenseHuecoRailIzq: "",   // «mf-carril-izq»: carril izquierdo, escritorio ≥1280 px
  adsenseHuecoRailDer: "",   // «mf-carril-der»: carril derecho, escritorio ≥1280 px
  adsenseHuecoMovil: "",     // «mf-resultado-medio»: entre tarjetas del resultado, por debajo de 1280 px
  adsenseHuecoCalc: "",      // «mf-resultado-final»: al final de la columna de resultados
  adsenseHuecoComparar: "",  // «mf-comparar»: bajo el mapa y la tabla de Comparar

  // Informe completo en PDF (js/informe.js). Vías de desbloqueo (negocio/otros-ingresos.md §1):
  // plan de pago (siempre), pago único y anuncio bonificado. Aceptar cookies NO desbloquea.
  // Con los dos interruptores en false, el informe es gratis para quien tenga sesión iniciada
  // (decisión provisional, pendiente de que Alex la confirme).
  informePago: false,      // true cuando exista en Stripe el precio con lookup_key informe_unico (supabase/README.md)
  informePrecio: 1.99,     // IVA incluido; tiene que coincidir con el precio de Stripe
  informeAnuncio: false,   // true cuando la red apruebe el formato bonificado (ver negocio/otros-ingresos.md)
  informeAnuncios: 1,      // anuncios seguidos que hay que ver (1 a 3)
  informeAnuncioUnidad: "", // bloque «rewarded» de Google Ad Manager (GPT), p. ej. "/1234567/informe_bonificado"
  informeAfiliado: null    // banner estático de afiliado en el PDF: { texto, enlace, imagen }; null = banner propio
};
