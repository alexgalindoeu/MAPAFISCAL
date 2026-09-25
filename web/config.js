// Configuración de despliegue de la web. En modo demo no se conecta al backend (Supabase):
// no hay cuentas ni clientes guardados; la calculadora y el comparador funcionan igual.
window.MAPAFISCAL_CONFIG = { demo: true, pagosActivos: false, preciosOrientativos: true, precios: { gestorMensual: 29, gestorAnual: 290 }, contacto: "hola@mapafiscal.es" };
