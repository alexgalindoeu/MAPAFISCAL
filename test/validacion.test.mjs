// «Cómo comprobamos los cálculos» (tools/generar_validacion.mjs → web/validacion/index.html).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { construir, bloquesYaml, EJEMPLOS } from "../tools/generar_validacion.mjs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const CASOS = JSON.parse(leer("tools/casos.json"));

test("la página cuenta los casos reales de tools/casos.json y todos coinciden R ↔ JS", () => {
  const { html, res, ok } = construir({ conGit: false });
  const n = Object.keys(CASOS).length;
  assert.equal(res.length, n);
  assert.equal(ok.length, n, "algún caso R ↔ JS no coincide");
  assert.match(html, new RegExp(`<dt>Casos de prueba</dt><dd>${n}</dd>`));
  assert.match(html, new RegExp(`${n} de ${n}`));
  assert.doesNotMatch(html, /provisional|incomplet/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/mapafiscal\.es\/validacion\/">/);
});

test("los ejemplos oficiales están en docs/03 y el motor de la web da su cifra al céntimo", () => {
  const { ejemplos } = construir({ conGit: false });
  assert.equal(ejemplos.length, EJEMPLOS.length);
  for (const e of ejemplos) {
    assert.deepEqual(e.faltan, [], `${e.caso}: falta en docs/03`);
    assert.equal(e.error, null, e.caso);
    assert.ok(e.filas.length && e.filas.every(f => f.ok), e.caso);
  }
  assert.ok(ejemplos.some(e => e.fuente === "AEAT") && ejemplos.some(e => /Hacienda Foral/.test(e.fuente)));
});

test("bloques de un YAML por territorio", () => {
  const b = bloquesYaml("# cabecera\nmeta:\n  a: 1\nterritorios:\n  ES-AN:\n    x: 1\n  ES-AR:\n    y: 2\noverrides:\n  ES-PV-BI:\n    z: 3\n");
  assert.deepEqual(b._cabecera, [0]);
  assert.deepEqual(b.meta, [1, 2]);
  assert.deepEqual(b["ES-AN"], [4, 5]);
  assert.deepEqual(b["ES-AR"], [6, 7]);
  assert.deepEqual(b["ES-PV-BI"], [9, 10]);
});

test("la página publicada existe, va en el sitemap y se enlaza desde Metodología", () => {
  assert.ok(existsSync(new URL("../web/validacion/index.html", import.meta.url)));
  assert.match(leer("web/sitemap.xml"), /<loc>https:\/\/mapafiscal\.es\/validacion\/<\/loc>/);
  assert.match(leer("web/index.html"), /href="validacion\/"/);
  assert.match(leer(".github/workflows/pages.yml"), /fetch-depth: 0[\s\S]*node tools\/generar_validacion\.mjs/);
  assert.match(leer(".github/workflows/ci.yml"), /generar_validacion\.mjs --comprobar/);
});
