// SEO técnico y rendimiento: metadatos para redes, datos estructurados, manifest, 404 y fuentes locales.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { generar } from "../tools/generar_paginas_seo.mjs";

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
