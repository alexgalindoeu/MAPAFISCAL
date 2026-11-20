// Validador SEO de todas las páginas HTML publicadas en web/: título, description, h1,
// canonical, enlaces internos, sitemap y títulos duplicados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("../web/", import.meta.url));
const DOMINIO = "https://mapafiscal.es/";
const MAX_TITULO = 65;

function recorrer(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...recorrer(p));
    else if (n.endsWith(".html")) out.push(p);
  }
  return out;
}

// Fragmentos: ficheros .html sin documento completo (se incrustan en otras páginas).
const PAGINAS = recorrer(WEB)
  .map(p => ({ ruta: relative(WEB, p).split(sep).join("/"), html: readFileSync(p, "utf8") }))
  .filter(({ html }) => /<html[\s>]/i.test(html))
  .map(pg => ({ ...pg, cuerpo: pg.html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "") }));

const urlDeRuta = r => DOMINIO + r.replace(/(^|\/)index\.html$/, "$1");
const noindex = h => /<meta name="robots" content="[^"]*noindex/i.test(h);
const texto = s => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const decodificar = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const tituloDe = cuerpo => decodificar(texto((cuerpo.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1]));

// Resuelve una ruta absoluta del sitio («/irpf/madrid/») a un fichero de web/.
function existeEnWeb(rutaSitio) {
  const p = decodeURIComponent(rutaSitio).replace(/^\//, "");
  const abs = join(WEB, p);
  if (p === "" || p.endsWith("/")) return existsSync(join(abs, "index.html"));
  return (existsSync(abs) && statSync(abs).isFile()) || existsSync(join(abs, "index.html"));
}

test("hay páginas que validar", () => assert.ok(PAGINAS.length > 100, String(PAGINAS.length)));

test("cada página tiene un único <title> no vacío de 65 caracteres como máximo", () => {
  const largos = [];
  for (const { ruta, cuerpo } of PAGINAS) {
    const n = (cuerpo.match(/<title>/gi) || []).length;
    assert.equal(n, 1, `${ruta}: ${n} <title>`);
    const t = tituloDe(cuerpo);
    assert.ok(t.length > 0, `${ruta}: <title> vacío`);
    if (t.length > MAX_TITULO) largos.push(`${ruta} (${t.length})`);
  }
  assert.equal(largos.length, 0, `${largos.length} títulos de más de ${MAX_TITULO} caracteres:\n  ` + largos.join("\n  "));
});

test("cada página tiene una meta description no vacía", () => {
  for (const { ruta, cuerpo } of PAGINAS)
    assert.match(cuerpo, /<meta name="description" content="[^"]+"/, ruta);
});

test("cada página tiene un único <h1>", () => {
  for (const { ruta, cuerpo } of PAGINAS)
    assert.equal((cuerpo.match(/<h1[\s>]/gi) || []).length, 1, ruta);
});

test("canonical absoluto a mapafiscal.es que coincide con la ruta del fichero", () => {
  for (const { ruta, cuerpo } of PAGINAS) {
    const c = [...cuerpo.matchAll(/<link rel="canonical" href="([^"]+)"/gi)];
    if (noindex(cuerpo) && c.length === 0) continue; // p. ej. 404.html
    assert.equal(c.length, 1, `${ruta}: ${c.length} canonical`);
    assert.equal(c[0][1], urlDeRuta(ruta), ruta);
  }
});

test("no hay enlaces internos rotos", () => {
  const rotos = [];
  for (const { ruta, cuerpo } of PAGINAS) {
    const dir = dirname(ruta) === "." ? "/" : "/" + dirname(ruta) + "/";
    for (const [, original] of cuerpo.matchAll(/<a\b[^>]*\shref="([^"]*)"/gi)) {
      let href = decodificar(original);
      if (href.startsWith(DOMINIO)) href = href.slice(DOMINIO.length - 1);
      if (href === "" || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) continue;
      const limpio = href.split(/[?#]/)[0];
      if (limpio === "") continue;
      if (!existeEnWeb(new URL(limpio, "http://x" + dir).pathname)) rotos.push(`${ruta} -> ${original}`);
    }
  }
  assert.deepEqual(rotos, []);
});

test("cada URL de sitemap.xml existe como fichero", () => {
  const xml = readFileSync(join(WEB, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.ok(locs.length > 0);
  const faltan = locs.filter(u => !u.startsWith(DOMINIO) || !existeEnWeb(u.slice(DOMINIO.length - 1)));
  assert.deepEqual(faltan, []);
});

test("no hay títulos duplicados entre páginas", () => {
  const vistos = new Map(), dup = [];
  for (const { ruta, cuerpo } of PAGINAS) {
    const t = tituloDe(cuerpo);
    if (vistos.has(t)) dup.push(`"${t}": ${vistos.get(t)} y ${ruta}`); else vistos.set(t, ruta);
  }
  assert.deepEqual(dup, []);
});
