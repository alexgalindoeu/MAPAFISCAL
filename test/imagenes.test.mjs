// Imágenes de las páginas para buscadores y asistentes con IA (tools/seo_imagenes.mjs):
// los PNG versionados corresponden a los datos actuales, cada página de territorio los
// enseña, los declara en og:image y en JSON-LD con su licencia, y el aviso legal da permiso.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { imagenesTerritorios, imagenesDesfasadas, LICENCIA_IMAGENES } from "../tools/seo_imagenes.mjs";
import { BOTS_IA } from "../tools/seo_ia.mjs";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const leer = r => readFileSync(join(WEB, r), "utf8");
const datos = f => JSON.parse(leer("datos/" + f));
const imgs = imagenesTerritorios({ territorios: datos("seo_territorios.json"), comparativas: datos("seo_comparativas.json") });

test("hay un PNG por territorio y corresponde a los datos actuales", () => {
  assert.equal(imgs.length, 19);
  assert.deepEqual(imagenesDesfasadas(imgs), [], "regenera con node tools/generar_imagenes.mjs --seo");
  for (const i of imgs) {
    const png = readFileSync(join(WEB, i.ruta.slice(1)));
    assert.equal(png.subarray(1, 4).toString(), "PNG", i.ruta);
    assert.equal(png.readUInt32BE(16), 1200, i.ruta);
    assert.equal(png.readUInt32BE(20), 630, i.ruta);
  }
});

test("cada página de territorio enseña su imagen, con og:image y licencia en JSON-LD", () => {
  for (const i of imgs) {
    const slug = i.ruta.match(/\/img\/irpf\/(.+)-\d{4}\.png$/)[1];
    const html = leer(`irpf/${slug}/index.html`);
    assert.match(html, new RegExp(`<img src="${i.ruta}"`), slug);
    assert.match(html, new RegExp(`<meta property="og:image" content="https://mapafiscal.es${i.ruta}">`), slug);
    assert.match(html, /"@type":"ImageObject"/, slug);
    assert.ok(html.includes(`"license":"${LICENCIA_IMAGENES}"`), slug);
    assert.match(html, /max-image-preview:large/, slug);
  }
});

test("permisos: robots.txt, llms.txt y aviso legal", () => {
  const robots = leer("robots.txt");
  for (const b of ["ChatGPT-User", "Claude-User", "Perplexity-User", "Googlebot-Image"]) assert.ok(BOTS_IA.includes(b), b);
  for (const b of BOTS_IA) assert.match(robots, new RegExp(`User-agent: ${b}\\nAllow: /`), b);
  assert.doesNotMatch(robots, /Disallow: \/img/);
  assert.match(leer("llms.txt"), /## Imágenes[\s\S]*CC BY 4\.0/);
  assert.match(leer("legal/aviso-legal.html"), /id="imagenes"[\s\S]*CC BY 4\.0[\s\S]*inteligencia artificial/);
  assert.match(leer("index.html"), /max-image-preview:large/);
  assert.ok(existsSync(join(WEB, "img", "manifiesto.json")));
});
