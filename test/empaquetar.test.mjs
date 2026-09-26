import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { empaquetar } from "../tools/empaquetar.mjs";

test("el HTML empaquetado es autónomo", () => {
  const html = empaquetar();
  assert.doesNotMatch(html, /<script src=|href="css\//, "quedan referencias a ficheros locales");
  for (const id of ["datos-params", "datos-mapa"]) {
    const m = html.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`));
    assert.ok(m, `falta ${id}`);
    assert.doesNotThrow(() => JSON.parse(m[1]), `${id} no es JSON válido`);
  }
  assert.match(html, /global\.irpfsim = api/);
  assert.match(html, /<!--CUERPO-->[\s\S]*<!--\/CUERPO-->/);
});

test("el HTML empaquetado queda en modo demo aunque la web esté en producción", () => {
  const html = empaquetar();
  assert.doesNotMatch(html, /<script[^>]+supabase-js/, "no debe cargar supabase-js");
  const cfg = html.match(/<script>\n([^<]*MAPAFISCAL_CONFIG[^<]*)<\/script>\n<script type="application\/json" id="datos-params">/);
  assert.ok(cfg, "falta la configuración embebida");
  const window = {};
  new Function("window", cfg[1])(window);
  assert.equal(window.MAPAFISCAL_CONFIG.demo, true);
  assert.equal(window.MAPAFISCAL_CONFIG.pagosActivos, false);
});

test("web/config.js solo lleva la clave publicable de Supabase", () => {
  const cfg = readFileSync(new URL("../web/config.js", import.meta.url), "utf8");
  assert.doesNotMatch(cfg, /sb_secret_|service_role|sk_(live|test)_|rk_(live|test)_|whsec_/);
  const window = {};
  new Function("window", cfg)(window);
  const { supabaseKey } = window.MAPAFISCAL_CONFIG;
  if (supabaseKey) assert.match(supabaseKey, /^sb_publishable_/);
});
