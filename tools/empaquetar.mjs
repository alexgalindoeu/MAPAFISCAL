// Empaqueta web/ en un único HTML autónomo (CSS, motor, app y datos embebidos),
// el mismo formato que se publica como artifact en Claude.
//
//   node tools/empaquetar.mjs [salida]      (por defecto: dist/mapafiscal.html)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(RAIZ, "web");
const leer = ruta => readFileSync(join(WEB, ruta), "utf8");

// JSON compacto y seguro dentro de <script>: "</" nunca puede cerrar la etiqueta.
const jsonEmbebido = ruta => JSON.stringify(JSON.parse(leer(ruta))).replace(/<\//g, "<\\/");

// La versión autónoma es siempre la demo: sin Supabase (ni supabase-js) y sin pagos,
// aunque web/config.js esté configurado para producción.
const FORZAR_DEMO = "window.MAPAFISCAL_CONFIG = Object.assign(window.MAPAFISCAL_CONFIG || {}, { demo: true, pagosActivos: false });\n";
const SUPABASE_JS = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+"[^>]*><\/script>\n?/;

export function empaquetar() {
  let html = leer("index.html");
  const sustituir = (buscado, nuevo) => {
    if (!html.includes(buscado)) throw new Error("No se encuentra en index.html: " + buscado);
    html = html.replace(buscado, () => nuevo);
  };
  if (!SUPABASE_JS.test(html)) throw new Error("No se encuentra en index.html el <script> de supabase-js");
  html = html.replace(SUPABASE_JS, "");
  sustituir('<link rel="stylesheet" href="css/mapafiscal.css">', "<style>\n" + leer("css/mapafiscal.css") + "</style>");
  sustituir('<script src="config.js"></script>', "<script>\n" + leer("config.js") + FORZAR_DEMO + "</script>\n" +
    '<script type="application/json" id="datos-params">' + jsonEmbebido("datos/params.json") + "</script>\n" +
    '<script type="application/json" id="datos-mapa">' + jsonEmbebido("datos/mapa_es.json") + "</script>");
  sustituir('<script src="js/irpfsim.js"></script>', "<script>\n" + leer("js/irpfsim.js") + "</script>");
  sustituir('<script src="js/app.js"></script>', "<script>\n" + leer("js/app.js") + "</script>");
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const salida = resolve(process.argv[2] || join(RAIZ, "dist", "mapafiscal.html"));
  mkdirSync(dirname(salida), { recursive: true });
  const html = empaquetar();
  writeFileSync(salida, html);
  console.log(`${salida} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
}
