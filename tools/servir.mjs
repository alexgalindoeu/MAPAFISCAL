// Servidor estático mínimo para probar web/ en local: node tools/servir.mjs [puerto]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..", "web");
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const puerto = Number(process.argv[2] || 8080);

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const esDirectorio = pathname.endsWith("/");
  const ruta = normalize(pathname).replace(/^([/\\])+/, "");
  const fichero = join(WEB, ruta);
  if (!fichero.startsWith(WEB)) { res.writeHead(403).end(); return; }
  try {
    const servido = esDirectorio || !ruta ? join(fichero, "index.html") : fichero;
    const cuerpo = await readFile(servido);
    res.writeHead(200, { "content-type": TIPOS[extname(servido)] || "application/octet-stream" }).end(cuerpo);
  } catch {
    // como GitHub Pages: la página 404.html con estado 404
    const p404 = await readFile(join(WEB, "404.html")).catch(() => "No encontrado");
    res.writeHead(404, { "content-type": TIPOS[".html"] }).end(p404);
  }
}).listen(puerto, () => console.log(`Mapafiscal en http://localhost:${puerto}`));
