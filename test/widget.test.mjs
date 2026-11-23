// Widget incrustable de sueldo neto: código para copiar (web/js/widget.js), página del
// widget (web/widget/sueldo-neto.html) y página /widget/ (tools/seo_widget.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const W = require("../web/js/widget.js");
const leer = r => readFileSync(new URL("../web/" + r, import.meta.url), "utf8");
const WIDGET = leer("widget/sueldo-neto.html");
const PAGINA = leer("widget/index.html");
const decodificar = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

test("el código para copiar lleva la atribución fuera del iframe, con enlace de marca", () => {
  for (const o of [{}, { territorio: "ES-PV-BI", tema: "oscuro", ancho: "compacto" }, { territorio: "ES-CT", tema: "claro" }]) {
    const c = W.codigoWidget(o);
    const fin = c.indexOf("</iframe>");
    assert.ok(fin > 0, "sin iframe");
    const fuera = c.slice(fin + "</iframe>".length);
    assert.match(fuera, /Calculado con <a href="https:\/\/mapafiscal\.es\/">Mapafiscal<\/a>/);
    assert.doesNotMatch(fuera, /rel="[^"]*nofollow/);
    assert.match(c, /<iframe [^>]*loading="lazy"/);
    assert.match(c, /<iframe [^>]*title="[^"]+"/);
    assert.match(c, /src="https:\/\/mapafiscal\.es\/widget\/sueldo-neto\.html\?t=ES-/);
  }
});

test("los parámetros del código son los del configurador y los desconocidos se ignoran", () => {
  assert.equal(W.urlWidget({ territorio: "ES-PV-BI", tema: "oscuro", ancho: "compacto" }),
    "https://mapafiscal.es/widget/sueldo-neto.html?t=ES-PV-BI&tema=oscuro&ancho=compacto");
  assert.equal(W.urlWidget({ territorio: '"><script>', tema: "rosa", ancho: "enorme" }, ""), "/widget/sueldo-neto.html?t=ES-MD");
});

test("/widget/ muestra el código por defecto tal cual y enlaza la metodología y las condiciones", () => {
  const area = PAGINA.match(/<textarea id="widget-codigo"[^>]*>([\s\S]*?)<\/textarea>/);
  assert.ok(area, "sin textarea del código");
  assert.equal(decodificar(area[1]), W.codigoWidget({}));
  assert.match(PAGINA, /<script src="\/js\/widget\.js" defer>/);
  assert.match(PAGINA, /páginas puerta/);
  assert.match(PAGINA, /"@type":"FAQPage"/);
  assert.match(PAGINA, /<link rel="canonical" href="https:\/\/mapafiscal\.es\/widget\/">/);
});

test("enlaces a /widget/ desde el pie común y desde /metodologia/", () => {
  for (const r of ["metodologia/index.html", "irpf/madrid/index.html", "guias/index.html"])
    assert.match(leer(r), /<a href="\/widget\/">/, r);
  assert.match(leer("metodologia/index.html").match(/<main[\s\S]*<\/main>/)[0], /<a href="\/widget\/">/);
});

test("indexación: /widget/ en el sitemap; el widget, con noindex y fuera", () => {
  const sitemap = leer("sitemap.xml");
  assert.match(sitemap, /<loc>https:\/\/mapafiscal\.es\/widget\/<\/loc>/);
  assert.doesNotMatch(sitemap, /sueldo-neto\.html/);
  assert.match(WIDGET, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(PAGINA, /noindex/);
});

test("el widget es mínimo: motor e importes de la web, sin anuncios, analítica, cookies ni datos de la anfitriona", () => {
  const scripts = [...WIDGET.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(scripts, ["/js/importe.js", "/js/irpfsim.js"]);
  assert.doesNotMatch(WIDGET, /<link[^>]+stylesheet/);
  for (const prohibido of [/adsbygoogle|gtag|googletagmanager|plausible|MapafiscalAnaliti|config\.js/, /document\.cookie|localStorage|sessionStorage|indexedDB/, /document\.referrer|parent\.document|top\.document|ancestorOrigins/])
    assert.doesNotMatch(WIDGET, prohibido);
  assert.match(WIDGET, /irpfsim\.sueldoNeto\(/);
  assert.match(WIDGET, /fetch\("\/datos\/params\.json"\)/);
  // postMessage solo con la altura
  const mensajes = [...WIDGET.matchAll(/postMessage\(([^)]*)\)/g)].map(m => m[1]);
  assert.deepEqual(mensajes, ['{ tipo: "mapafiscal:altura", altura }, "*"']);
  // pie fijo con la atribución
  assert.match(WIDGET, /<footer class="pie" id="pie">Calculado con <a href="https:\/\/mapafiscal\.es\/" target="_blank" rel="noopener">Mapafiscal<\/a><\/footer>/);
  assert.doesNotMatch(WIDGET, /X-Frame-Options|frame-ancestors/i);
});
