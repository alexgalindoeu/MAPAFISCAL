// Regla de Alex (28-09 y 17-11-2026): ningún dato personal del titular en la web publicada.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("../web/", import.meta.url));
const ficheros = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? ficheros(p) : /\.(html|js|json|txt|xml|css|webmanifest)$/.test(f) ? [p] : []; });

test("la web no contiene el nombre del titular (ni su usuario de GitHub)", () => {
  const con = ficheros(WEB).filter(p => /alexgalindo|galindo/i.test(readFileSync(p, "utf8")));
  assert.deepEqual(con, []);
});
