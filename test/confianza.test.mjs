// Rótulo del ejercicio y «Comunicar un error» (web/js/confianza.js), y sus piezas en la web.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const C = require("../web/js/confianza.js");
const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("rótulo del ejercicio según la fecha", () => {
  const nov26 = new Date(2026, 10, 17);
  assert.equal(C.rotuloEjercicio(2025, nov26).completo, "Renta 2025 (la declaración que se presentó en 2026)");
  assert.equal(C.rotuloEjercicio(2026, nov26).completo, "Simulación 2026 (la que presentarás en 2027)");
  assert.equal(C.rotuloEjercicio(2026, new Date(2027, 4, 10)).completo, "Renta 2026 (la declaración que se presenta en 2027)");
  assert.equal(C.rotuloEjercicio(2026, new Date(2027, 6, 1)).corto, "Renta 2026");
  assert.equal(C.rotuloEjercicio("2025", nov26).corto, "Renta 2025");
});

test("ejercicio que se abre por defecto: el del año en curso si se ofrece", () => {
  assert.equal(C.ejercicioEnCurso([2025, 2026], new Date(2026, 10, 17)), 2026);
  assert.equal(C.ejercicioEnCurso([2025], new Date(2026, 10, 17)), 2025);
  assert.equal(C.ejercicioEnCurso([2025, 2026], new Date(2025, 2, 1)), 2025);
  assert.equal(C.ejercicioEnCurso([2026, 2027], new Date(2025, 2, 1)), 2026);
});

test("compactar quita nulos, ceros, falsos y vacíos", () => {
  assert.deepEqual(C.compactar({ a: 0, b: null, c: "", d: false, e: { f: 0 }, g: [1, 0, { h: null }], i: 1234.5678, j: "x" }),
    { g: [1], i: 1234.57, j: "x" });
});

test("mailto: destinatario, asunto, cuerpo con territorio, ejercicio, entrada, cuota y hueco para lo esperado", () => {
  const hogar = { territorio: "ES-MD", ejercicio: 2025, tipoUnidadFamiliar: "ninguna", miembros: [{ id: "d1", rol: "declarante", edad: 40, trabajo: { dinerarias: 30000, cotizacionesSs: 1950 }, donativos: 0 }] };
  const r = C.correoError({ herramienta: "Calculadora de la renta", territorio: "Madrid (ES-MD)", ejercicio: 2025, hoy: new Date(2026, 10, 17),
    resultado: "cuota resultante 3.456,78 €", entrada: hogar, pagina: "https://mapafiscal.es/#calculadora" });
  assert.match(r.enlace, /^mailto:contacto@mapafiscal\.es\?subject=/);
  assert.equal(r.asunto, "Posible error en Mapafiscal · Calculadora de la renta · Madrid (ES-MD) · Renta 2025");
  assert.match(r.cuerpo, /Qué esperabas/);
  assert.match(r.cuerpo, /Territorio: Madrid \(ES-MD\)/);
  assert.match(r.cuerpo, /Ejercicio: Renta 2025 \(la declaración que se presentó en 2026\)/);
  assert.match(r.cuerpo, /Resultado de la web: cuota resultante 3\.456,78 €/);
  const json = r.cuerpo.match(/^Entrada: (.*)$/m)[1];
  assert.deepEqual(JSON.parse(json), C.compactar(hogar));
  assert.doesNotMatch(json, /\n|  /, "JSON compacto");
  assert.equal(decodeURIComponent(r.enlace.split("&body=")[1]), r.cuerpo);
});

test("mailto: una entrada enorme se recorta para que el enlace funcione", () => {
  const grande = { miembros: Array.from({ length: 200 }, (_, i) => ({ id: "m" + i, edad: 30 + i, trabajo: { dinerarias: 1000 + i } })) };
  const r = C.correoError({ herramienta: "Calculadora", territorio: "Madrid", ejercicio: 2025, entrada: grande });
  assert.ok(r.enlace.length <= 2000, `mailto de ${r.enlace.length} caracteres`);
  assert.match(r.cuerpo, /recortado/);
  assert.match(r.cuerpo, /Qué esperabas/);
});

test("la web carga confianza.js antes que app.js y lo empaqueta; el único correo es contacto@", () => {
  const html = leer("web/index.html");
  const i = html.indexOf('<script src="js/confianza.js"></script>');
  assert.ok(i > 0 && i < html.indexOf('<script src="js/app.js"></script>'));
  assert.match(leer("tools/empaquetar.mjs"), /js\/confianza\.js/);
  const js = leer("web/js/confianza.js");
  assert.deepEqual([...new Set(js.match(/[a-z0-9.]+@[a-z0-9.]+/gi))], ["contacto@mapafiscal.es"]);
  assert.match(html, /data-ejercicio-rotulo/);
  assert.match(leer("web/js/app.js"), /MCF\.registrar\("tarjeta-resultado"/);
});

test("sin «provisional» ni «incompleto» en los textos nuevos", () => {
  for (const f of ["web/js/confianza.js"]) assert.doesNotMatch(leer(f), /provisional|incomplet/i, f);
});
