// Páginas /sueldo-neto/: los datos de web/datos/seo_sueldo_neto.json (motor R) coinciden
// al céntimo con irpfsim.sueldoNeto, y las páginas tienen lo que piden (neto, FAQ, enlaces).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { generar } from "../tools/generar_paginas_seo.mjs";

const require = createRequire(import.meta.url);
const motor = require("../web/js/irpfsim.js");
const D = require("../web/datos/seo_sueldo_neto.json");
const P = require(`../web/datos/params_${D.ejercicio}.json`);
const { ficheros, urls } = generar();

test("seo_sueldo_neto.json coincide con irpfsim.sueldoNeto (R ↔ JS)", () => {
  const muestras = [[15000, "ES-AN"], [30000, "ES-MD"], [45000, "ES-PV-BI"], [100000, "ES-NC"], [25200, "ES-CT"]];
  for (const [bruto, territorio] of muestras) {
    const js = motor.sueldoNeto({ bruto, territorio, edad: D.supuesto.edad, hijos: [], tipoContrato: "indefinido" }, P);
    const r = D.sueldos[String(bruto)];
    assert.ok(Math.abs(js.neto - r.territorios[territorio].neto) < 0.01, `${bruto} ${territorio}: ${js.neto} ≠ ${r.territorios[territorio].neto}`);
    assert.ok(Math.abs(js.irpf - r.territorios[territorio].irpf) < 0.01, `${bruto} ${territorio}: IRPF`);
    assert.ok(Math.abs(js.cotizaciones - r.ss.total) < 0.01, `${bruto}: Seguridad Social`);
  }
  // referencia de test/herramientas.test.mjs
  assert.equal(D.sueldos["30000"].territorios["ES-MD"].neto, 23451.98);
});

test("páginas nacionales, mensuales y por territorio, en el sitemap", () => {
  const sn = urls.filter(u => u.startsWith("/sueldo-neto/"));
  assert.equal(sn.length, 1 + D.mensuales.length + Object.keys(D.sueldos).length + 19 * D.importes_territorio.length);
  assert.ok(sn.length <= 560);
  const mapa = ficheros.get("sitemap.xml");
  for (const u of ["/sueldo-neto/", "/sueldo-neto/30000/", "/sueldo-neto/30000/bizkaia/", "/sueldo-neto/mensual/1800/"])
    assert.ok(mapa.includes(`https://mapafiscal.es${u}</loc>`), u);
  assert.match(ficheros.get("comparar-sueldo/index.html"), /href="\/sueldo-neto\/"/);
  assert.match(ficheros.get("irpf/index.html"), /href="\/sueldo-neto\/">Sueldo neto/, "enlace en el pie");
});

test("la página de un territorio trae neto, desglose, comparación, vecinos y FAQ", () => {
  const h = ficheros.get("sueldo-neto/30000/madrid/index.html");
  assert.match(h, /23\.452 €/);
  assert.match(h, /1\.954 €/, "neto al mes en 12 pagas");
  assert.match(h, /1\.675 €/, "neto al mes en 14 pagas");
  assert.match(h, /Seguridad Social[\s\S]*1\.950 €/);
  assert.match(h, /"@type":"FAQPage"/);
  assert.match(h, /href="\/sueldo-neto\/28000\/madrid\/"/);
  assert.match(h, /href="\/sueldo-neto\/30000\/navarra\/"/);
  assert.match(h, /href="\/index\.html#sueldo-neto"/);
  assert.match(h, /contrato indefinido/);
  assert.match(h, /2026/);
  const m = ficheros.get("sueldo-neto/mensual/1800/index.html");
  assert.match(m, /12 pagas/); assert.match(m, /14 pagas/);
  assert.match(m, /href="\/sueldo-neto\/25200\/"/);
});
