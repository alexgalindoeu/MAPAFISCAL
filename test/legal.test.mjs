import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CONTACTO_FALSO, OBLIGATORIOS, OPCIONALES, contactoDeConfig, escapar, faltan, paginas, rellenar } from "../tools/rellenar_titular.mjs";
import { WEB_PUBLICA, empaquetar } from "../tools/empaquetar.mjs";

const WEB = new URL("../web/", import.meta.url);
const leer = ruta => readFileSync(new URL(ruta, WEB), "utf8");
const LEGALES = ["aviso-legal.html", "privacidad.html", "condiciones.html", "cookies.html"];
const CONOCIDOS = new Set([...OBLIGATORIOS, ...OPCIONALES]);

test("las cuatro páginas legales existen, con el diseño de la web y enlazadas entre sí", () => {
  const hay = readdirSync(new URL("legal/", WEB)).filter(f => f.endsWith(".html")).sort();
  assert.deepEqual(hay, [...LEGALES].sort());
  for (const p of LEGALES) {
    const html = leer("legal/" + p);
    assert.match(html, /<html lang="es">/, p);
    assert.match(html, /<title>[^<]+· Mapafiscal<\/title>/, p);
    assert.match(html, /href="\.\.\/css\/mapafiscal\.css"/, p);
    assert.match(html, /href="\.\.\/css\/legal\.css"/, p);
    assert.match(html, new RegExp(`<a href="${p}" aria-current="page">`), `${p}: falta la pestaña activa`);
    for (const q of LEGALES) assert.ok(html.includes(`href="${q}"`), `${p} no enlaza con ${q}`);
  }
  assert.ok(existsSync(new URL("css/legal.css", WEB)));
});

test("los textos publicables no llevan borradores ni huecos entre corchetes", () => {
  for (const p of LEGALES) {
    const html = leer("legal/" + p);
    assert.doesNotMatch(html, /BORRADOR|\[(NOMBRE|RAZÓN|NIF|DOMICILIO|CORREO|FECHA|PLAZO|VERIFICAR|DECIDIR|CIUDAD|VARIANTE)/, p);
    for (const [, k] of html.matchAll(/\{\{([A-Z_]+)\}\}/g)) assert.ok(CONOCIDOS.has(k), `${p}: hueco desconocido {{${k}}}`);
  }
});

test("el aviso legal dice que no es una liquidación oficial ni asesoramiento", () => {
  assert.match(leer("legal/aviso-legal.html"), /no es una liquidación oficial ni asesoramiento/);
});

test("el pie de la web enlaza con las cuatro páginas legales", () => {
  const pie = leer("index.html").match(/<footer class="pie">[\s\S]*?<\/footer>/);
  assert.ok(pie, "falta el pie");
  for (const p of LEGALES) assert.ok(pie[0].includes(`href="legal/${p}"`), `el pie no enlaza con legal/${p}`);
});

test("el HTML empaquetado enlaza los textos legales de la web publicada", () => {
  const html = empaquetar();
  assert.doesNotMatch(html, /href="legal\//, "quedan enlaces relativos a legal/");
  for (const p of LEGALES) assert.ok(html.includes(`href="${WEB_PUBLICA}legal/${p}"`), `falta el enlace a ${p}`);
});

test("rellenar pone los datos escapados, quita la línea opcional vacía y avisa de lo que falta", () => {
  const html = "<dd>{{TITULAR_NOMBRE}}</dd>\n<dd>{{TITULAR_REGISTRO}}</dd>\n<a href=\"mailto:{{CONTACTO}}\">{{CONTACTO}}</a>\n{{TITULAR_NIF}}";
  const datos = { TITULAR_NOMBRE: "Ejemplo & Cía <SL>", TITULAR_NIF: "", CONTACTO: "buzon@example.com" };
  const r = rellenar(html, datos);
  assert.match(r.html, /<dd>Ejemplo &amp; Cía &lt;SL&gt;<\/dd>/);
  assert.doesNotMatch(r.html, /TITULAR_REGISTRO/);
  assert.match(r.html, /mailto:buzon@example\.com">buzon@example\.com</);
  assert.deepEqual(r.quedan, ["{{TITULAR_NIF}}"]);
  const lleno = rellenar(html, { ...datos, TITULAR_NIF: "X", TITULAR_REGISTRO: "Registro Mercantil de Ejemplo, hoja 1" });
  assert.deepEqual(lleno.quedan, []);
  assert.match(lleno.html, /<dd>Registro Mercantil de Ejemplo, hoja 1<\/dd>/);
  assert.equal(escapar("`${x}`\\"), "&#96;&#36;&#123;x&#125;&#96;&#92;");
});

test("sin datos del titular o con el correo de marcador no se puede publicar", () => {
  assert.deepEqual(faltan({ TITULAR_NOMBRE: "A", TITULAR_NIF: "B", TITULAR_DOMICILIO: "C", CONTACTO: "d@example.com" }), []);
  assert.deepEqual(faltan({ TITULAR_NOMBRE: "A", TITULAR_NIF: "", TITULAR_DOMICILIO: "C", CONTACTO: "d@example.com" }), ["TITULAR_NIF"]);
  assert.equal(faltan({ TITULAR_NOMBRE: "A", TITULAR_NIF: "B", TITULAR_DOMICILIO: "C", CONTACTO: CONTACTO_FALSO }).length, 1);
  assert.equal(contactoDeConfig('window.X = {\n  contacto: "buzon@example.com"\n};'), "buzon@example.com");
  assert.ok(contactoDeConfig(leer("config.js")), "web/config.js no tiene `contacto`");
});

test("con todos los datos, ninguna página publicable queda con huecos", () => {
  const datos = { TITULAR_NOMBRE: "Nombre", TITULAR_NIF: "00000000T", TITULAR_DOMICILIO: "Calle, 1", CONTACTO: "buzon@example.com" };
  const lista = paginas(fileURLToPath(WEB));
  assert.ok(lista.includes("index.html"));
  for (const p of lista) assert.deepEqual(rellenar(leer(p.replace(/\\/g, "/")), datos).quedan, [], p);
});
