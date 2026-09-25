// Servidor estático mínimo para probar web/ en local: node tools/servir.mjs [puerto]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..", "web");
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
const puerto = Number(process.argv[2] || 8080);

createServer(async (req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  const fichero = join(WEB, ruta || "index.html");
  if (!fichero.startsWith(WEB)) { res.writeHead(403).end(); return; }
  try {
    const cuerpo = await readFile(fichero.endsWith("/") ? join(fichero, "index.html") : fichero);
    res.writeHead(200, { "content-type": TIPOS[extname(fichero)] || "application/octet-stream" }).end(cuerpo);
  } catch {
    res.writeHead(404).end("No encontrado");
  }
}).listen(puerto, () => console.log(`Mapafiscal en http://localhost:${puerto}`));
