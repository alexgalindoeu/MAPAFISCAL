// Añade ?v=<versión> a las referencias locales a .css y .js de todos los HTML de una carpeta.
//
// GitHub Pages sirve cada fichero con Cache-Control: max-age=600. Sin versión, tras una
// publicación el navegador puede juntar el index.html nuevo con un app.js viejo de su caché
// (28-09-2026: la portada de #50 se quedaba encima y no se podía cambiar de pestaña). Con
// ?v=<commit>, cada index.html pide exactamente los CSS y JS de su misma publicación.
//
// Lo ejecuta «Publicar web» sobre la copia que se publica: el código fuente no cambia, así que
// tools/empaquetar.mjs sigue encontrando las etiquetas tal cual. Los datos (datos/*.json) no
// hacen falta: app.js ya los pide con cache: "no-cache".
//
//   node tools/versionar_recursos.mjs <carpeta> <sha del commit>
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// href="…" o src="…" a un .css o .js propio: ni http(s), ni //, ni data:, ni ya versionado.
const REF = /\b(href|src)="((?!https?:|\/\/|data:)[^"?#]+\.(?:css|js))"/g;

export function versionar(html, version) {
  return html.replace(REF, (m, attr, url) => `${attr}="${url}?v=${version}"`);
}

export function paginasHtml(dir) {
  return readdirSync(dir).sort().flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? paginasHtml(p) : f.endsWith(".html") ? [p] : [];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir, sha] = process.argv.slice(2);
  if (!dir || !/^[0-9a-f]{7,40}$/.test(sha || "")) {
    console.error("Uso: node tools/versionar_recursos.mjs <carpeta> <sha del commit>");
    process.exit(1);
  }
  const version = sha.slice(0, 7);
  for (const p of paginasHtml(resolve(dir))) {
    const antes = readFileSync(p, "utf8");
    const despues = versionar(antes, version);
    if (despues !== antes) { writeFileSync(p, despues); console.log(`${p}: CSS y JS con ?v=${version}`); }
  }
}
