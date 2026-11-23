import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CONTACTO_FALSO, OBLIGATORIOS, contactoDeConfig, escapar, faltan, paginas, rellenar } from "../tools/rellenar_titular.mjs";
import { WEB_PUBLICA, empaquetar } from "../tools/empaquetar.mjs";

const WEB = new URL("../web/", import.meta.url);
const leer = ruta => readFileSync(new URL(ruta, WEB), "utf8");
const LEGALES = ["aviso-legal.html", "privacidad.html", "condiciones.html", "cookies.html"];
const CONOCIDOS = new Set(OBLIGATORIOS);

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

// Regla absoluta desde el 28-09-2026: ningún dato personal identificativo del titular
// (nombre, NIF, domicilio…) se publica en la web. Guarda contra que alguien reintroduzca esos
// huecos sin querer: si aparecen, la aserción de arriba ya falla (no están en CONOCIDOS), y
// esta lo deja explícito y con el motivo.
test("no hay huecos de datos personales del titular en ninguna página legal", () => {
  for (const p of LEGALES) {
    assert.doesNotMatch(leer("legal/" + p), /\{\{TITULAR_/,
      `${p}: un hueco {{TITULAR_…}} publicaría un dato personal de Alex — ver tools/rellenar_titular.mjs`);
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

test("rellenar pone los datos escapados y avisa de los huecos que faltan", () => {
  const html = "<dd>{{EJEMPLO}}</dd>\n<a href=\"mailto:{{CONTACTO}}\">{{CONTACTO}}</a>\n{{OTRO}}";
  const datos = { EJEMPLO: "Ejemplo & Cía <SL>", OTRO: "", CONTACTO: "buzon@example.com" };
  const r = rellenar(html, datos);
  assert.match(r.html, /<dd>Ejemplo &amp; Cía &lt;SL&gt;<\/dd>/);
  assert.match(r.html, /mailto:buzon@example\.com">buzon@example\.com</);
  assert.deepEqual(r.quedan, ["{{OTRO}}"]);
  const lleno = rellenar(html, { ...datos, OTRO: "X" });
  assert.deepEqual(lleno.quedan, []);
  assert.equal(escapar("`${x}`\\"), "&#96;&#36;&#123;x&#125;&#96;&#92;");
});

test("sin correo o con el correo de marcador no se puede publicar", () => {
  assert.deepEqual(faltan({ CONTACTO: "d@example.com" }), []);
  assert.deepEqual(faltan({ CONTACTO: "" }), ["CONTACTO"]);
  assert.equal(faltan({ CONTACTO: CONTACTO_FALSO }).length, 1);
  assert.equal(contactoDeConfig('window.X = {\n  contacto: "buzon@example.com"\n};'), "buzon@example.com");
  assert.ok(contactoDeConfig(leer("config.js")), "web/config.js no tiene `contacto`");
});

test("con el correo puesto, ninguna página publicable queda con huecos", () => {
  const datos = { CONTACTO: "buzon@example.com" };
  const lista = paginas(fileURLToPath(WEB));
  assert.ok(lista.includes("index.html"));
  for (const p of lista) assert.deepEqual(rellenar(leer(p.replace(/\\/g, "/")), datos).quedan, [], p);
});

// Lo que la web guarda en el navegador (claves de localStorage/sessionStorage de web/js/) tiene
// que estar en la tabla de legal/cookies.html, y al revés: nada en la tabla que la web no use.
test("cookies.html lista exactamente lo que web/js guarda en el navegador", () => {
  const dir = new URL("js/", WEB);
  const codigo = readdirSync(dir).filter(f => f.endsWith(".js")).map(f => readFileSync(new URL(f, dir), "utf8")).join("\n");
  const claves = new Set([...codigo.matchAll(/\b[A-Z_]+\s*=\s*"((?:mapafiscal\.|mf-)[A-Za-z.-]+)"/g)].map(m => m[1].replace(/\.$/, ".<id>")));
  assert.ok(claves.size >= 10, "no se han encontrado las claves");
  const ref = new URL(/supabaseUrl:\s*"([^"]+)"/.exec(leer("config.js"))[1]).hostname.split(".")[0];
  claves.add(`sb-${ref}-auth-token`);
  const html = leer("legal/cookies.html");
  const tabla = new Set([...html.matchAll(/<tr[^>]*><td><code>([^<]+)<\/code>/g)].map(m => m[1].replace("&lt;id&gt;", "<id>")));
  for (const k of claves) assert.ok(tabla.has(k), `cookies.html no explica «${k}»`);
  const deGoogle = new Set(["FCCDCF", "__gads", "__eoi", "IDE"]);
  for (const k of tabla) assert.ok(claves.has(k) || deGoogle.has(k), `cookies.html explica «${k}», que la web ya no usa`);
});

test("política de privacidad y de cookies: lo que exige AdSense a los editores", () => {
  const priv = leer("legal/privacidad.html"), cook = leer("legal/cookies.html");
  for (const [p, html] of [["privacidad", priv], ["cookies", cook]]) {
    assert.match(html, /[Tt]erceros proveedores, incluido Google, usan cookies para mostrar anuncios basados en las visitas anteriores/, p);
    assert.match(html, /DoubleClick/, p);
    assert.match(html, /href="https:\/\/adssettings\.google\.com"/, p);
    assert.match(html, /href="https:\/\/www\.aboutads\.info\/choices\/"/, p);
    assert.match(html, /href="https:\/\/youronlinechoices\.eu"/, p);
    assert.match(html, /href="https:\/\/policies\.google\.com\/technologies\/partner-sites/, p);
    assert.match(html, /certificada por Google[\s\S]*TCF/, p);
  }
  // la sección de publicidad solo se ve con anuncios encendidos
  assert.match(priv, /<section data-con-anuncios hidden>\s*<h3 id="publicidad">/);
  // las tipografías ya no vienen de Google Fonts (web/css/mapafiscal.css las sirve desde /fonts/)
  assert.doesNotMatch(priv + cook, /Google Fonts/);
});
