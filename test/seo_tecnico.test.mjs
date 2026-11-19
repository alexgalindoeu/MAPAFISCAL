// SEO técnico y rendimiento: metadatos para redes, datos estructurados, manifest, 404 y fuentes locales.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { generar } from "../tools/generar_paginas_seo.mjs";
import { hashContenido, fecharContenido, MARCA_FECHA, MARCA_FECHA_LARGA } from "../tools/seo_comun.mjs";

const WEB = new URL("../web/", import.meta.url);
const leer = r => readFileSync(new URL(r, WEB), "utf8");
const tamanoPng = r => { const b = readFileSync(new URL(r, WEB)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test("la portada lleva canonical, Open Graph, Twitter, manifest y JSON-LD sin datos personales", () => {
  const h = leer("index.html");
  for (const re of [/<link rel="canonical" href="https:\/\/mapafiscal\.es\/">/, /property="og:image" content="https:\/\/mapafiscal\.es\/og\.png"/,
    /name="twitter:card" content="summary_large_image"/, /<link rel="manifest" href="manifest\.webmanifest">/]) assert.match(h, re);
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  const tipos = ld["@graph"].map(o => o["@type"]);
  assert.ok(tipos.includes("WebApplication") && tipos.includes("Organization"));
  const correos = JSON.stringify(ld).match(/[\w.+-]+@[\w.-]+/g);
  assert.deepEqual([...new Set(correos)], ["contacto@mapafiscal.es"]);
});

test("las páginas generadas llevan imagen para redes y tarjeta grande", () => {
  for (const [r, html] of generar().ficheros) if (r.endsWith(".html")) {
    assert.match(html, /property="og:image" content="https:\/\/mapafiscal\.es\/og\.png"/, r);
    assert.match(html, /name="twitter:card" content="summary_large_image"/, r);
  }
});

test("imagen OG, iconos y manifest existen con sus medidas", () => {
  assert.deepEqual(tamanoPng("og.png"), [1200, 630]);
  const m = JSON.parse(leer("manifest.webmanifest"));
  assert.equal(m.short_name, "Mapafiscal");
  for (const i of m.icons) {
    assert.ok(existsSync(new URL(i.src.slice(1), WEB)), i.src);
    if (i.type === "image/png") assert.deepEqual(tamanoPng(i.src.slice(1)), i.sizes.split("x").map(Number));
  }
});

test("404.html usa rutas absolutas y no se indexa", () => {
  const h = leer("404.html");
  assert.match(h, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(h, /(href|src)="(?!\/|https?:|#)/, "rutas relativas: fallan en /a/b/inexistente");
});

test("sin Google Fonts ni supabase-js bloqueando la carga; fuentes locales con font-display", () => {
  const paginas = ["index.html", "404.html", "legal/aviso-legal.html", "legal/privacidad.html", "legal/condiciones.html", "legal/cookies.html"]
    .map(leer).concat([...generar().ficheros].filter(([r]) => r.endsWith(".html")).map(([, h]) => h));
  for (const h of paginas) {
    assert.doesNotMatch(h, /fonts\.(googleapis|gstatic)\.com/);
    assert.doesNotMatch(h, /<script[^>]+supabase-js/);
  }
  const css = leer("css/mapafiscal.css");
  for (const [, f] of css.matchAll(/url\("\.\.\/(fonts\/[^"]+)"\)/g)) assert.ok(existsSync(new URL(f, WEB)), f);
  assert.equal((css.match(/@font-face/g) || []).length, (css.match(/font-display: swap/g) || []).length);
});

// ---- fechas reales por página, pie y datos estructurados ----------------------------
test("sitemap: cada URL lleva la fecha de su registro, sin marcas sin sustituir", () => {
  const { ficheros } = generar();
  const reg = JSON.parse(ficheros.get("datos/seo_fechas.json"));
  const sm = ficheros.get("sitemap.xml");
  const pares = [...sm.matchAll(/<loc>https:\/\/mapafiscal\.es([^<]*)<\/loc><lastmod>([^<]+)<\/lastmod>/g)];
  assert.ok(pares.length > 700);
  for (const [, u, f] of pares) assert.equal(f, reg[u.slice(1) + "index.html"].fecha, u);
  assert.ok(new Set(pares.map(p => p[2])).size > 1, "todas las URLs con la misma fecha");
  for (const [r, h] of ficheros) assert.doesNotMatch(h, /@@FECHA_CONTENIDO/, r);
});

test("el registro de fechas versionado está al día (lo que exige --comprobar)", () => {
  const { ficheros } = generar();
  assert.equal(ficheros.get("datos/seo_fechas.json"), leer("datos/seo_fechas.json").replace(/\r/g, ""));
});

test("la fecha solo cambia si cambia el contenido de <main>, el título o la descripción", () => {
  const pag = (main, pie = "") => `<title>T</title><meta name="description" content="D"><main>${main} ${MARCA_FECHA} ${MARCA_FECHA_LARGA} 2026-11-14</main><footer>${pie}</footer>`;
  const g = ["2026-11-14"];
  assert.equal(hashContenido(pag("A"), g), hashContenido(pag("A", "otro pie"), g));
  assert.equal(hashContenido(pag("A"), g), hashContenido(pag("A").replace("2026-11-14", "2027-01-02"), ["2027-01-02"]));
  assert.notEqual(hashContenido(pag("A"), g), hashContenido(pag("B"), g));
  const f = new Map([["a/index.html", pag("A")], ["b/index.html", pag("B")]]);
  const reg = fecharContenido(f, { "a/index.html": { hash: hashContenido(pag("A"), g), fecha: "2026-01-01" }, "b/index.html": { hash: "viejo", fecha: "2026-01-01" } }, { generados: g, hoy: "2026-12-31" });
  assert.equal(reg["a/index.html"].fecha, "2026-01-01");
  assert.equal(reg["b/index.html"].fecha, "2026-12-31");
  assert.match(f.get("a/index.html"), /2026-01-01 1 de enero de 2026/);
});

test("pie de las páginas SEO: normativa revisada, contenido actualizado y ejercicio", () => {
  for (const [r, h] of generar().ficheros) if (r.endsWith(".html")) {
    assert.match(h, /Normativa revisada el <time datetime="\d{4}-\d{2}-\d{2}">/, r);
    assert.match(h, /Contenido actualizado el <time datetime="\d{4}-\d{2}-\d{2}">/, r);
    assert.match(h, /· Ejercicio 20\d\d \(renta que se declara en 20\d\d\)/, r);
  }
});

test("Organization en todas las páginas SEO; canonical único y coherente con la ruta", () => {
  const vistos = new Set();
  for (const [r, h] of generar().ficheros) if (r.endsWith(".html")) {
    const lds = [...h.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(m => JSON.parse(m[1]));
    assert.ok(lds.some(o => o["@type"] === "Organization" && o["@id"] === "https://mapafiscal.es/#organizacion"), r);
    const c = [...h.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map(m => m[1]);
    assert.equal(c.length, 1, r);
    assert.equal(c[0], "https://mapafiscal.es/" + r.replace(/index\.html$/, ""), r);
    assert.ok(!vistos.has(c[0]), `canonical repetido: ${c[0]}`);
    vistos.add(c[0]);
  }
});

test("la portada tiene un solo <h1> y declara la calculadora como WebApplication", () => {
  const h = leer("index.html");
  assert.equal((h.match(/<h1\b/g) || []).length, 1);
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  const app = ld["@graph"].find(o => o["@type"] === "WebApplication");
  assert.equal(app.applicationCategory, "FinanceApplication");
  assert.equal(app.publisher["@id"], "https://mapafiscal.es/#organizacion");
});
