import { test } from "node:test";
import assert from "node:assert/strict";
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
