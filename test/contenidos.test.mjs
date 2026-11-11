// Páginas estáticas SEO: territorios, deducciones, sueldos y guías (tools/generar_paginas_seo.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generar, huerfanas } from "../tools/generar_paginas_seo.mjs";
import { redactarFicha } from "../tools/seo_deducciones.mjs";
import { GUIAS } from "../tools/seo_guias.mjs";

const WEB = fileURLToPath(new URL("../web/", import.meta.url));
const { ficheros, urls } = generar();
const paginas = [...ficheros].filter(([r]) => r.endsWith(".html"));
const texto = html => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");

test("las páginas del repo coinciden con lo que genera el generador (--comprobar)", () => {
  for (const [r, contenido] of ficheros) {
    const p = WEB + r;
    assert.ok(existsSync(p), `${r} no existe: ejecuta node tools/generar_paginas_seo.mjs`);
    assert.equal(readFileSync(p, "utf8").replace(/\r/g, ""), contenido, `${r} está desfasada: regenérala`);
  }
  assert.deepEqual(huerfanas(ficheros), [], "hay páginas generadas que ya no salen");
});

test("hay páginas de deducciones y las seis guías, con su índice", () => {
  const ded = paginas.filter(([r]) => /^irpf\/[^/]+\/deducciones\/index\.html$/.test(r));
  assert.ok(ded.length >= 5, `solo ${ded.length} páginas de deducciones`);
  for (const g of GUIAS) assert.ok(ficheros.has(`guias/${g.slug}/index.html`), g.slug);
  assert.ok(ficheros.has("guias/index.html") && ficheros.has("irpf/index.html"));
  const indice = ficheros.get("irpf/index.html");
  assert.match(indice, /href="\/guias\/"/);
  for (const [r] of ded) assert.ok(indice.includes(`href="/${r.replace("index.html", "")}"`), `el índice no enlaza ${r}`);
});

test("cada página tiene title, description y canonical únicos, y JSON-LD válido", () => {
  const vistos = { title: new Set(), description: new Set() };
  for (const [r, html] of paginas) {
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const desc = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
    assert.ok(title && desc, `${r}: falta title o description`);
    assert.ok(!vistos.title.has(title), `${r}: title repetido`); vistos.title.add(title);
    assert.ok(!vistos.description.has(desc), `${r}: description repetida`); vistos.description.add(desc);
    const ruta = "/" + r.replace(/index\.html$/, "");
    assert.ok(html.includes(`<link rel="canonical" href="https://mapafiscal.es${ruta}">`), `${r}: canonical`);
    for (const [, j] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const o = JSON.parse(j);
      assert.equal(o["@context"], "https://schema.org", r);
    }
  }
  for (const g of GUIAS) assert.match(ficheros.get(`guias/${g.slug}/index.html`), /"@type":"FAQPage"/, g.slug);
});

test("sin avisos de provisional o incompleto, sin huecos y sin más correo que contacto@", () => {
  for (const [r, html] of paginas) {
    const t = texto(html);
    assert.doesNotMatch(t, /provisional|incomplet|pendiente de|sin cotejar/i, r);
    assert.doesNotMatch(html, /\{\{|undefined|NaN/, r);
    for (const [m] of html.matchAll(/[\w.+-]+@[a-z][\w-]*\.[a-z][\w.]*/gi)) assert.equal(m, "contacto@mapafiscal.es", `${r}: ${m}`);
  }
});

test("los enlaces internos llevan a páginas que existen", () => {
  for (const [r, html] of paginas) {
    for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
      if (href === "/") continue;
      const destino = href.endsWith("/") ? href.slice(1) + "index.html" : href.slice(1);
      assert.ok(ficheros.has(destino) || existsSync(WEB + destino), `${r} enlaza ${href}, que no existe`);
    }
  }
});

test("cada deducción y cada guía cita su fuente primaria", () => {
  for (const [r, html] of paginas.filter(([r]) => r.includes("/deducciones/"))) {
    const fichas = html.split('class="tarjeta ficha-deduccion"').slice(1);
    assert.ok(fichas.length, r);
    for (const f of fichas) assert.match(f, /Norma: [^<]+\.|Norma: /, r);
    assert.match(html, /boe\.es|agenciatributaria\.gob\.es|gipuzkoa\.eus/, r);
  }
  for (const g of GUIAS) assert.match(ficheros.get(`guias/${g.slug}/index.html`), /Norma: |boe\.es/, g.slug);
});

test("sitemap.xml y robots.txt recogen todas las páginas", () => {
  const sitemap = ficheros.get("sitemap.xml");
  for (const u of urls) assert.ok(sitemap.includes(`<loc>https://mapafiscal.es${u}</loc>`), u);
  assert.doesNotMatch(sitemap, /index\.html/);
  assert.match(ficheros.get("robots.txt"), /^Sitemap: https:\/\/mapafiscal\.es\/sitemap\.xml/);
});

test("el redactor no publica supuestos con claves que no sabe explicar", () => {
  const base = { titulo: "Prueba", normas: ["Art. 1"], supuestos: [{ id: "x", tipo: "fija", importe: 100 }] };
  assert.ok(!redactarFicha(base).error);
  assert.equal(redactarFicha(base).supuestos[0].cuanto, "100 €");
  const rara = { ...base, supuestos: [{ id: "x", tipo: "fija", importe: 100, clave_nueva: true }] };
  assert.match(redactarFicha(rara).error, /clave_nueva/);
  const tipo = { ...base, supuestos: [{ id: "x", tipo: "otro_tipo", importe: 100 }] };
  assert.ok(redactarFicha(tipo).error);
});

test("el pie de la web principal enlaza el IRPF por territorio y las guías", () => {
  const pie = readFileSync(WEB + "index.html", "utf8").match(/<footer class="pie">[\s\S]*?<\/footer>/)[0];
  assert.ok(pie.includes('href="irpf/"') && pie.includes('href="guias/"'));
});
