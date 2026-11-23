// «Encuentra tus deducciones» (web/js/deducciones.js): reglas fijas sobre params.json y el motor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { P } from "./ayuda.mjs";

const require = createRequire(import.meta.url);
const D = require("../web/js/deducciones.js");
const SEO = require("../web/datos/seo_deducciones.json");
const base = { edad: 30, bruto: 30000, hijos: [], familiaNumerosa: "no", ascendiente: "no" };
const buscar = (r, seo = SEO) => D.encontrar(P, Object.assign({}, base, r), seo);
const ids = l => l.map(a => a.id);

test("nacimiento en Andalucía: 200 € por hijo nacido en el año (art. 11 Ley 5/2021)", () => {
  const r = buscar({ territorio: "ES-AN", hijos: [{ edad: 0 }] });
  const n = r.aplicadas.find(a => a.id === "nacimiento_adopcion");
  assert.ok(n, "aplica la deducción por nacimiento");
  assert.equal(n.importe, 200);
  assert.equal(n.firme, true);
  assert.match(n.norma, /Ley 5\/2021/);
  assert.ok(n.url && n.url.startsWith("https://sede.agenciatributaria.gob.es/"));
  // en zona despoblada sería la variante de 400 €: se ofrece como posible
  const z = r.posibles.find(a => a.id === "nacimiento_adopcion_despoblacion");
  assert.equal(z, undefined, "misma familia (grupo) que una ya aplicada: no se repite");
  const r2 = buscar({ territorio: "ES-AN", hijos: [{ edad: 0 }], zonaDespoblada: true });
  assert.equal(r2.aplicadas.find(a => a.id === "nacimiento_adopcion_despoblacion").importe, 400);
  assert.ok(!ids(r2.aplicadas).includes("nacimiento_adopcion"), "variantes excluyentes: solo la mayor");
});

test("solo son firmes las autonómicas de las páginas de deducciones; el resto se cuenta", () => {
  for (const t of D.COMUNES) {
    const r = buscar({ territorio: t, hijos: [{ edad: 0 }, { edad: 7 }], alquiler: 8000, guarderia: 2000, educacion: 600, edad: 28, bruto: 18000 });
    const seoIds = new Set(((SEO.territorios[t] || {}).fichas || []).flatMap(f => f.supuestos.map(s => s.id)));
    for (const a of r.aplicadas.concat(r.posibles).filter(a => a.ambito === "autonomica")) {
      assert.ok(seoIds.has(a.id), `${t}: ${a.id} no está verificada`);
      const d = P.territorios[t].deducciones_autonomicas.lista.find(x => x.id === a.id);
      assert.equal(d.estado, "confirmado");
    }
    const lista = P.territorios[t].deducciones_autonomicas.lista;
    assert.equal(r.noFirmes, lista.filter(d => !seoIds.has(d.id)).length);
  }
});

test("sin el fichero SEO, el criterio es estado «confirmado» con fuente", () => {
  const F = D.firmes(P, null, "ES-MD");
  assert.ok(F.firmes.length > 0);
  assert.ok(F.firmes.every(d => d.estado === "confirmado" && d.fuente));
  assert.equal(F.firmes.length + F.noFirmes, P.territorios["ES-MD"].deducciones_autonomicas.lista.length);
});

test("alquiler en Cataluña: lo calcula el motor; sin alquiler, se ofrece con su máximo", () => {
  const d = P.territorios["ES-CT"].deducciones_autonomicas.lista.find(x => x.id === "arrendamiento_vivienda_habitual");
  const con = buscar({ territorio: "ES-CT", edad: 30, bruto: 18000, alquiler: 6000 });
  const a = con.aplicadas.find(x => x.id === "arrendamiento_vivienda_habitual");
  assert.ok(a, "aplica el alquiler");
  assert.equal(a.importe, Math.min(6000 * d.porcentaje, d.limite));
  const sin = buscar({ territorio: "ES-CT", edad: 30, bruto: 18000 });
  const p = sin.posibles.find(x => x.id === "arrendamiento_vivienda_habitual");
  assert.ok(p, "posible si pagas alquiler");
  assert.equal(p.maximo, d.limite);
  assert.match(p.falta, /alquiler/);
  // por encima del límite de renta ya no se ofrece
  const rico = buscar({ territorio: "ES-CT", edad: 30, bruto: 90000 });
  assert.ok(!ids(rico.posibles).includes("arrendamiento_vivienda_habitual"));
});

test("estatales: maternidad, familia numerosa y donativos, con su estado", () => {
  const r = buscar({ territorio: "ES-CM", hijos: [{ edad: 1 }, { edad: 5 }, { edad: 8 }], familiaNumerosa: "general", donativos: 250 });
  const m = r.aplicadas.find(a => a.id === "maternidad");
  assert.equal(m.importe, P.estatal.deduccion_maternidad.importe_anual);
  assert.equal(m.firme, P.estatal.deduccion_maternidad.estado === "confirmado");
  assert.equal(r.aplicadas.find(a => a.id === "familiaNumerosa").importe, P.estatal.deduccion_familia_numerosa_y_discapacidad_cargo.familia_numerosa_general);
  // donativos: 80 % de los primeros 250 €
  const dn = r.aplicadas.find(a => a.id === "donativos");
  assert.equal(dn.importe, 200);
  assert.equal(dn.firme, true);
  assert.ok(r.ahorroTotal > 0 && r.ahorroTotal <= r.nominalTotal + 0.01);
});

test("territorios forales: se remite a sus páginas y a la calculadora", () => {
  const r = buscar({ territorio: "ES-NC" });
  assert.equal(r.foral, true);
  assert.equal(r.enlace, "irpf/navarra/deducciones/");
});

test("la vista existe en index.html, se empaqueta y se registra como herramienta", async () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  assert.match(html, /<section class="vista" id="v-encuentra-deducciones"/);
  assert.match(html, /<script src="js\/deducciones.js" defer><\/script>/);
  assert.match(html, /id="anuncio-col-deducciones"/);
  const { empaquetar } = await import("../tools/empaquetar.mjs");
  const dist = empaquetar();
  assert.ok(!dist.includes('src="js/deducciones.js"'));
  assert.match(dist, /id="datos-seo-deducciones"/);
  assert.match(dist, /"encuentra-deducciones": \{ titulo: "Encuentra tus deducciones"/);
});
