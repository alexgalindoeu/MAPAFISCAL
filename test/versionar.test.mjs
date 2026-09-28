import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { paginasHtml, versionar } from "../tools/versionar_recursos.mjs";

const WEB = fileURLToPath(new URL("../web/", import.meta.url));

test("versionar añade ?v= a los CSS y JS propios y deja los externos", () => {
  const html = [
    '<link rel="stylesheet" href="css/mapafiscal.css">',
    '<link rel="stylesheet" href="../css/legal.css">',
    '<link rel="stylesheet" href="/css/seo.css">',
    '<script src="js/app.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/x@1/dist/x.js" integrity="sha384-abc"></script>',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">',
    '<script src="js/ya.js?v=1234567"></script>',
    '<a href="legal/aviso-legal.html">Aviso</a>'
  ].join("\n");
  const r = versionar(html, "abc1234");
  assert.match(r, /href="css\/mapafiscal\.css\?v=abc1234"/);
  assert.match(r, /href="\.\.\/css\/legal\.css\?v=abc1234"/);
  assert.match(r, /href="\/css\/seo\.css\?v=abc1234"/);
  assert.match(r, /src="js\/app\.js\?v=abc1234"/);
  assert.match(r, /src="https:\/\/cdn\.jsdelivr\.net\/npm\/x@1\/dist\/x\.js" integrity/);
  assert.match(r, /href="https:\/\/fonts\.googleapis\.com\/css2\?family=X"/);
  assert.match(r, /src="js\/ya\.js\?v=1234567"/);
  assert.match(r, /href="legal\/aviso-legal\.html"/);
});

test("en la web publicada no queda ningún CSS o JS propio sin versión", () => {
  const paginas = paginasHtml(WEB);
  assert.ok(paginas.some(p => p.endsWith("index.html")));
  for (const p of paginas) {
    const r = versionar(readFileSync(p, "utf8"), "abc1234");
    const sinVersion = [...r.matchAll(/\b(?:href|src)="((?!https?:|\/\/|data:)[^"?#]+\.(?:css|js))"/g)].map(m => m[1]);
    assert.deepEqual(sinVersion, [], p);
  }
  const index = versionar(readFileSync(WEB + "index.html", "utf8"), "abc1234");
  for (const f of ["css/mapafiscal.css", "config.js", "js/irpfsim.js", "js/app.js"]) {
    assert.ok(index.includes(`"${f}?v=abc1234"`), `index.html: falta ${f}?v=`);
  }
});
