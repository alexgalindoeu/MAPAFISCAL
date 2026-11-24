// Sección /autonomos/: las cifras salen del motor JS (rnActividades + liquidar), hay una
// página por territorio, en el sitemap, con anuncios, FAQ, fuentes BOE y sin cuotas del RETA.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { generar } from "../tools/generar_paginas_seo.mjs";
import { SLUG, ORDEN_TERRITORIOS, conAnuncios } from "../tools/seo_comun.mjs";

const require = createRequire(import.meta.url);
const motor = require("../web/js/irpfsim.js");
const T = require("../web/datos/seo_territorios.json");
const P0 = require("../web/datos/params.json");
const P = P0.ejercicio === T.ejercicio ? P0 : require(`../web/datos/params_${T.ejercicio}.json`);
const { ficheros, urls } = generar();
const main = r => ficheros.get(r).match(/<main[\s\S]*<\/main>/)[0];
const eur = n => { const [e, d] = (Math.round(n * 100) / 100).toFixed(2).split("."); return e.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (d === "00" ? "" : "," + d) + " €"; };
const liq = (t, actividades) => motor.liquidar({ territorio: t, ejercicio: P.ejercicio, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no",
  miembros: [{ id: "d1", rol: "declarante", edad: 40, actividades }] }, P, "auto");

test("autónomos: índice y una página por territorio, en el sitemap y con anuncios", () => {
  assert.ok(urls.includes("/autonomos/"));
  for (const t of ORDEN_TERRITORIOS) {
    const r = `/autonomos/${SLUG[t]}/`;
    assert.ok(urls.includes(r), r);
    assert.ok(conAnuncios(r), r);
    assert.ok(ficheros.has(r.slice(1) + "index.html"), r);
  }
  assert.ok(![...ficheros.keys()].some(r => /^autonomos\/[^/]+\/[^/]+\//.test(r)), "no hay páginas por municipio");
  assert.match(ficheros.get("llms.txt"), /\/autonomos\/canarias\//);
});

test("autónomos: el paso a paso y las tablas coinciden con el motor", () => {
  const s = P.estatal.actividades_directa_simplificada;
  const l = liq("ES-MD", { metodo: "directa_simplificada", rendimientoNetoPrevio: 24000 });
  const m = main("autonomos/index.html");
  assert.equal(l.componentesRenta.actividades, 24000 - Math.min(24000 * s.gastos_dificil_justificacion_pct, s.gastos_dificil_justificacion_max));
  assert.ok(m.includes(eur(motor.irpfAnual(l))), "IRPF del ejemplo");
  for (const [t, r] of [["ES-CN", 30000], ["ES-PV-BI", 45000], ["ES-NC", 20000]]) {
    const irpf = motor.irpfAnual(liq(t, { metodo: "directa_normal", rendimientoNetoPrevio: r }));
    assert.ok(main(`autonomos/${SLUG[t]}/index.html`).includes(eur(irpf)), `${t} ${r}`);
  }
});

test("autónomos: FAQ, fuentes BOE, municipio explicado y sin cuotas del RETA", () => {
  for (const r of ["autonomos/index.html", ...ORDEN_TERRITORIOS.map(t => `autonomos/${SLUG[t]}/index.html`)]) {
    const h = ficheros.get(r), m = main(r);
    assert.match(h, /"@type":"FAQPage"/, r);
    assert.match(m, /BOE-A-2006-20764/, r);
    assert.match(m, /BOE-A-2007-6820/, r);
    assert.match(m, /modelo 130/, r);
    assert.match(m, /no calcula la cuota de autónomos/, r);
    assert.doesNotMatch(m.replace(/<[^>]+>/g, " "), /(cuota|cotización)[^.]{0,40}\d+(\.\d{3})*(,\d+)? €\s*(al mes|mensual)/i, r);
    if (r !== "autonomos/index.html") assert.match(m, /Cambia el IRPF de un autónomo según el municipio/, r);
  }
  assert.match(main("autonomos/madrid/index.html"), /Griñón/);
  assert.match(main("autonomos/madrid/index.html"), /Humanes/);
});

test("autónomos: en el menú común", () => {
  const g = ficheros.get("irpf/madrid/index.html");
  assert.match(g, /<nav class="nav"[\s\S]*?href="\/autonomos\/"[\s\S]*?<\/nav>/);
});
