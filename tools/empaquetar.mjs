// Empaqueta web/ en un único HTML autónomo (CSS, motor, app y datos embebidos),
// el mismo formato que se publica como artifact en Claude.
//
//   node tools/empaquetar.mjs [salida]      (por defecto: dist/mapafiscal.html)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(RAIZ, "web");
const leer = ruta => readFileSync(join(WEB, ruta), "utf8");

// JSON compacto y seguro dentro de <script>: "</" nunca puede cerrar la etiqueta.
const otrosEjercicios = () => readdirSync(join(WEB, "datos")).filter(n => /^params_\d{4}\.json$/.test(n)).sort();
const jsonEmbebido =ruta => JSON.stringify(JSON.parse(leer(ruta))).replace(/<\//g, "<\\/");

// La versión autónoma es siempre la demo: sin Supabase (ni supabase-js), sin pagos y sin
// anuncios, aunque web/config.js esté configurado para producción.
const FORZAR_DEMO = "window.MAPAFISCAL_CONFIG = Object.assign(window.MAPAFISCAL_CONFIG || {}, { demo: true, pagosActivos: false, anuncios: false, informePago: false, informeAnuncio: false, informeAnuncioUnidad: \"\", informeAfiliado: null, adsenseCliente: \"\", adsenseHuecoCalc: \"\", adsenseHuecoComparar: \"\", adsenseHuecoRailIzq: \"\", adsenseHuecoRailDer: \"\", adsenseHuecoMovil: \"\" });\n";
const SUPABASE_JS = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+"[^>]*><\/script>\n?/;
// La demo nunca lleva anuncios.js: se quita entero (no se incrusta como irpfsim.js/app.js)
// para que el HTML autónomo no contenga ni un rastro de "adsbygoogle" o "googlesyndication".
const ANUNCIOS_JS = /<script src="js\/anuncios\.js"><\/script>\n?/;
const ADSENSE_META = /<meta name="google-adsense-account"[^>]*>\n?/;
// El anuncio bonificado del informe (GPT) tampoco va en la demo: se quita el bloque marcado.
const ANUNCIO_BONIFICADO = /\/\*ANUNCIO-BONIFICADO\*\/[\s\S]*?\/\*\/ANUNCIO-BONIFICADO\*\/\n?/;
export function informeDemo() {
  const js = leer("js/informe.js");
  if (!ANUNCIO_BONIFICADO.test(js)) throw new Error("No se encuentra en informe.js el bloque ANUNCIO-BONIFICADO");
  return js.replace(ANUNCIO_BONIFICADO, () => "function anuncioGpt() { return Promise.resolve(false); }\n");
}
// El HTML autónomo no lleva las páginas legales: sus enlaces apuntan a las de la web publicada.
export const WEB_PUBLICA = "https://mapafiscal.es/";

export function empaquetar() {
  let html = leer("index.html");
  const sustituir = (buscado, nuevo) => {
    if (!html.includes(buscado)) throw new Error("No se encuentra en index.html: " + buscado);
    html = html.replace(buscado, () => nuevo);
  };
  // supabase-js ya no va en index.html (app.js lo carga solo si hace falta; en la demo, nunca);
  // si vuelve a aparecer como <script>, se quita igual. Las precargas de fuentes, el manifest y
  // el icono de iOS son rutas relativas que el HTML autónomo no tiene al lado.
  html = html.replace(SUPABASE_JS, "").replace(/<link rel="(?:preload|manifest|apple-touch-icon)"[^>]*>\r?\n?/g, "");
  if (!ANUNCIOS_JS.test(html)) throw new Error("No se encuentra en index.html el <script> de anuncios.js");
  html = html.replace(ANUNCIOS_JS, "");
  if (!ADSENSE_META.test(html)) throw new Error("No se encuentra en index.html la <meta> de AdSense");
  html = html.replace(ADSENSE_META, "");
  // el favicon va incrustado como data: URI (el HTML autónomo no tiene favicon.svg al lado)
  sustituir('<link rel="icon" href="favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(leer("favicon.svg").trim()) + '" type="image/svg+xml">');
  sustituir('<link rel="stylesheet" href="css/mapafiscal.css">', "<style>\n" +
    leer("css/mapafiscal.css").replace(/url\("\.\.\/fonts\//g, `url("${WEB_PUBLICA}fonts/`) + "</style>");
  sustituir('<link rel="stylesheet" href="css/cuentas.css">', "<style>\n" + leer("css/cuentas.css") + "</style>");
  // El ID de editor de AdSense no debe quedar ni como texto en la demo, aunque FORZAR_DEMO lo
  // sobrescriba en tiempo de ejecución: se redacta en el propio config.js incrustado.
  const configSinAdsense = leer("config.js").replace(/ca-pub-\d+/, "");
  sustituir('<script src="config.js"></script>', "<script>\n" + configSinAdsense + FORZAR_DEMO + "</script>\n" +
    '<script type="application/json" id="datos-params">' + jsonEmbebido("datos/params.json") + "</script>\n" +
    '<script type="application/json" id="datos-mapa">' + jsonEmbebido("datos/mapa_es.json") + "</script>" +
    // los demás ejercicios (params_<año>.json -> id="datos-params-<año>"), para las herramientas
    otrosEjercicios().map(f => `\n<script type="application/json" id="datos-${f.replace(".json", "").replace("_", "-")}">` +
      jsonEmbebido("datos/" + f) + "</script>").join(""));
  sustituir('<script src="js/irpfsim.js"></script>', "<script>\n" + leer("js/irpfsim.js") + "</script>");
  sustituir('<script src="js/formulario.js"></script>', "<script>\n" + leer("js/formulario.js") + "</script>");
  sustituir('<script src="js/cuentas.js"></script>', "<script>\n" + leer("js/cuentas.js") + "</script>");
  sustituir('<script src="js/app.js"></script>', "<script>\n" + leer("js/app.js") + "</script>");
  sustituir('<script src="js/herramientas.js"></script>', "<script>\n" + leer("js/herramientas.js") + "</script>");
  sustituir('<script src="js/informe.js"></script>', "<script>\n" + informeDemo() + "</script>");
  sustituir('<script src="js/rescate.js"></script>', "<script>\n" + leer("js/rescate.js") + "</script>");
  // Las páginas legales, las de territorio y sueldo y las guías no van dentro: apuntan a la web publicada.
  html = html.replace(/href="(legal|irpf|guias|comparar-sueldo)\//g, (m, dir) => `href="${WEB_PUBLICA}${dir}/`);
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const salida = resolve(process.argv[2] || join(RAIZ, "dist", "mapafiscal.html"));
  mkdirSync(dirname(salida), { recursive: true });
  const html = empaquetar();
  writeFileSync(salida, html);
  console.log(`${salida} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
}
