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

  // Perfiles en redes sociales: salen en el pie de la web y de las páginas generadas (js/ui.js
  // y tools/seo_comun.mjs). Solo se muestran los que tienen URL.
  redes: { x: "https://x.com/mapafiscal", reddit: "", facebook: "" },

  // Versión vigente de las condiciones (fecha de legal/condiciones.html). Al cambiarla, la web
  // vuelve a pedir la aceptación a quien aceptó una versión anterior.
  condicionesVersion: "2026-09-27",

  // Anuncios (Google AdSense): carriles laterales en escritorio y huecos en el flujo. En
  // false no se carga nada de Google ni la CMP, y no hay aviso de cookies porque no hace
  // falta. Nunca para quien tiene plan de pago. La versión autónoma (empaquetar.mjs) lo fuerza
  // a false. PARA ENCENDER: poner los data-ad-slot de abajo y `anuncios: true` en la misma PR
  // (la política de cookies se adapta sola: legal/cookies.html lee este fichero).
  anuncios: true,
  adsenseCliente: "ca-pub-3028486034839853",

  // Consentimiento en el EEE: "google" = CMP certificada de Google («Privacidad y mensajes»
  // de AdSense, mensaje RGPD publicado): sale sola con los anuncios, sin aviso propio.
  // "propio" = aviso de Mapafiscal (Aceptar/Rechazar) y nada de Google hasta aceptar; solo
  // como plan B, porque sin CMP certificada Google solo sirve anuncios limitados.
  consentimiento: "google",

  // data-ad-slot de cada bloque (AdSense → Anuncios → Por bloque de anuncios → Anuncios de
  // display, «Adaptable»). Vacío, ese hueco no se muestra ni pide nada.
  adsenseHuecoRailIzq: "7552034337", // «mf-carril-izq»: carril izquierdo, escritorio ≥1280 px
  adsenseHuecoRailDer: "6238952662", // «mf-carril-der»: carril derecho, escritorio ≥1280 px
  adsenseHuecoCalc: "2215947173", // «mf-resultado-final»: al final de la columna de resultados
  adsenseHuecoComparar: "9832702418", // «mf-comparar»: bajo el mapa y la tabla de Comparar
  // Columnas laterales dentro de las vistas («laterales de periódico», solo ≥1040 px): el
  // hueco vacío que queda junto a la columna más larga. Vacías = usan adsenseHuecoCalc; para
  // medir cada posición por separado, crear un bloque por posición con el nombre indicado y
  // pegar aquí su data-ad-slot.
  adsenseHuecoColComparar: "",   // «mf-col-comparar»: bajo el mapa de #comparar
  adsenseHuecoColEscenarios: "", // «mf-col-escenarios»: bajo «En cifras» de #escenarios
  adsenseHuecoColNeto: "",       // «mf-col-sueldo-neto»: bajo el formulario de #sueldo-neto
  adsenseHuecoColPensiones: "",  // «mf-col-plan-pensiones»: bajo el formulario de #plan-pensiones
  adsenseHuecoColRescate: "",    // «mf-col-rescate-plan»: bajo el formulario de #rescate-plan
  adsenseHuecoColConjunta: "",   // «mf-col-conjunta»: bajo el formulario de #conjunta
  adsenseHuecoColPagadores: "",  // «mf-col-dos-pagadores»: bajo el formulario de #dos-pagadores
  adsenseHuecoColBruto: "",      // «mf-col-bruto-necesario»: bajo el formulario de #bruto-necesario
  // En móvil y tableta (menos de 1040 px) esas columnas pasan al final de cada herramienta. Vacío =
  // el bloque de su posición; con un bloque propio, el tráfico móvil se mide aparte.
  adsenseHuecoColMovil: "",      // «mf-final-herramienta-movil»: final de la herramienta, menos de 1040 px
  // Páginas informativas (guías, /irpf/, /sueldo-neto/, /comparar-sueldo/): huecos entre
  // tarjetas, tras la introducción, en medio de las largas y antes de las preguntas
  // frecuentes. Vacío = el bloque de «mf-resultado-final»; con uno propio («mf-paginas-seo»)
  // se miden aparte.
  adsenseHuecoSeo: "",
  // Prueba de uno frente a dos carriles: fracción de visitantes (0 a 1) sin carril derecho.
  // 0 = sin prueba. Para probar a medias: 0.5 (anuncios.js reparte y GoatCounter mide).
  pruebaCarriles: 0,

  // Informe completo en PDF (js/informe.js). Vías de desbloqueo (negocio/otros-ingresos.md §1):
  // plan de pago (siempre), pago único y anuncio bonificado. Aceptar cookies NO desbloquea.
  // Con los dos interruptores en false, el informe es gratis para quien tenga sesión iniciada
  // (decisión provisional, pendiente de que Alex la confirme).
  informePago: false,      // true cuando exista en Stripe el precio con lookup_key informe_unico (supabase/README.md)
  informePrecio: 1.99,     // IVA incluido; tiene que coincidir con el precio de Stripe
  informeAnuncio: false,   // true cuando la red apruebe el formato bonificado (ver negocio/otros-ingresos.md)
  informeAnuncios: 1,      // anuncios seguidos que hay que ver (1 a 3)
  informeAnuncioUnidad: "", // bloque «rewarded» de Google Ad Manager (GPT), p. ej. "/1234567/informe_bonificado"
  informeAfiliado: null,   // banner estático de afiliado en el PDF: { texto, enlace, imagen }; null = banner propio

  // Segundos de espera antes de descargar el PDF para quien no tiene plan de pago (ni ha pagado
  // el informe): su resumen y el banner propio «Hazte Gestor». 0 = sin espera. Sin AdSense en
  // esa pantalla: su política no admite anuncios durante una espera fija antes de una descarga.
  pdfEspera: 5,

  // Analítica sin cookies (js/analitica.js): "goatcounter" o false. Solo páginas vistas y los
  // eventos del embudo, sin datos personales ni importes. La versión autónoma la apaga.
  analitica: "goatcounter",
  goatcounterCodigo: "mapafiscal"   // https://mapafiscal.goatcounter.com
};
