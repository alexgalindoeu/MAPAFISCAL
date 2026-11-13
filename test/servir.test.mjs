import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SERVIR = fileURLToPath(new URL("../tools/servir.mjs", import.meta.url));

test("servir.mjs sirve la portada en / y el index.html de las carpetas con barra final", async t => {
  const puerto = 20000 + Math.floor(Math.random() * 20000);
  const proc = spawn(process.execPath, [SERVIR, String(puerto)], { stdio: ["ignore", "pipe", "inherit"] });
  t.after(() => proc.kill());
  await new Promise((ok, mal) => {
    proc.stdout.once("data", ok);
    proc.once("exit", c => mal(new Error(`servir.mjs terminó con código ${c}`)));
  });
  const pedir = ruta => fetch(`http://127.0.0.1:${puerto}${ruta}`);
  const raiz = await pedir("/");
  assert.equal(raiz.status, 200, "/ tiene que servir web/index.html");
  assert.match(await raiz.text(), /<!--CUERPO-->/);
  assert.equal((await pedir("/legal/aviso-legal.html")).status, 200);
  assert.equal((await pedir("/irpf/")).status, 200, "una carpeta con barra final sirve su index.html");
  assert.equal((await pedir("/no-existe.html")).status, 404);
});
