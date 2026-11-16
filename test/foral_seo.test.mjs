// Suite foral (tools/seo_foral.mjs): 6 páginas por territorio foral y la comparativa del
// País Vasco, enlazadas desde /irpf/<territorio>/ y en el sitemap, con cifras del motor.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { generar } from "../tools/generar_paginas_seo.mjs";
import { FORALES, SECCIONES } from "../tools/seo_foral.mjs";
import { SLUG } from "../tools/seo_comun.mjs";

const require = createRequire(import.meta.url);
const motor = require("../web/js/irpfsim.js");
const { ficheros, urls } = generar();

test("25 páginas forales, en el sitemap y enlazadas desde la página del territorio", () => {
  let n = 0;
  for (const t of FORALES) {
    const hub = ficheros.get(`irpf/${SLUG[t]}/index.html`);
    for (const [s] of SECCIONES) {
      const r = `/irpf/${SLUG[t]}/${s}/`;
      assert.ok(ficheros.has(r.slice(1) + "index.html"), r);
      assert.ok(urls.includes(r), r + " en el sitemap");
      assert.ok(hub.includes(`href="${r}"`), r + " enlazada");
      n++;
    }
  }
  assert.ok(ficheros.has("irpf/pais-vasco/index.html") && urls.includes("/irpf/pais-vasco/"));
  assert.equal(n + 1, 25);
  assert.ok(!ficheros.get("irpf/madrid/index.html").includes("a fondo"), "solo en los forales");
});

test("las cifras salen del motor y no hay avisos de obra", () => {
  const P = JSON.parse(readFileSync(new URL("../web/datos/params_2026.json", import.meta.url), "utf8"));
  const s = motor.sueldoNeto({ bruto: 30000, territorio: "ES-PV-BI", edad: 40, hijos: [], tipoContrato: "indefinido" }, P);
  const miles = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
  assert.ok(ficheros.get("irpf/bizkaia/sueldo-neto/index.html").includes(miles(s.neto)));
  assert.ok(ficheros.get("irpf/pais-vasco/index.html").includes(miles(s.neto)));
  for (const [r, html] of ficheros) if (/^irpf\/(bizkaia|gipuzkoa|araba-alava|navarra|pais-vasco)\/(?!deducciones)/.test(r) && r.split("/").length > 3 || r === "irpf/pais-vasco/index.html")
    assert.ok(!/provisional|incompleto|undefined|NaN/i.test(html), r);
});
