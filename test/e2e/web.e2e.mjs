// Pruebas E2E de la web en un navegador real (Playwright + Chromium).
//   npm run test:e2e
// Arranca tools/servir.mjs en un puerto libre y comprueba: carga sin errores de JS,
// formato del importe del sueldo, paridad de un caso de tools/casos.json y vista móvil.
// Playwright se carga del proyecto si está instalado y si no, de la instalación global.
import { spawn, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(execSync("npm root -g").toString().trim() + "/playwright"); }

const puertoLibre = () => new Promise((ok, mal) => {
  const s = net.createServer().once("error", mal).listen(0, () => { const p = s.address().port; s.close(() => ok(p)); });
});
const puerto = await puertoLibre();
const base = `http://localhost:${puerto}`;
const servidor = spawn(process.execPath, [path.join(raiz, "tools/servir.mjs"), String(puerto)], { cwd: raiz, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((ok, mal) => {
  servidor.stdout.on("data", d => { if (String(d).includes("http://localhost")) ok(); });
  servidor.once("exit", c => mal(new Error(`el servidor terminó (${c})`)));
});

const navegador = await playwright.chromium.launch();
let fallos = 0;
async function prueba(nombre, fn) {
  try { await fn(); console.log(`ok    ${nombre}`); }
  catch (e) { fallos++; console.log(`FALLO ${nombre}\n      ${e.message.split("\n").join("\n      ")}`); }
}
// página nueva que acumula errores de JS (excepciones y console.error)
async function abrir(ruta, opciones = {}) {
  const ctx = await navegador.newContext(opciones);
  const pagina = await ctx.newPage();
  pagina.errores = [];
  // terceros (analítica, anuncios, Supabase, CDN) fuera: la prueba no depende de la red
  await ctx.route(u => !u.href.startsWith(base), r => r.abort());
  pagina.on("pageerror", e => pagina.errores.push(`pageerror: ${e.message}`));
  // los fallos de carga se informan con su URL (abajo); el mensaje genérico no la trae
  pagina.on("console", m => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) pagina.errores.push(`console.error: ${m.text()}`);
  });
  // la web pide params_<año siguiente>.json por si existe y, si no, sigue con el por defecto
  const tolerado = r => r.status() === 404 && /\/datos\/params_\d{4}\.json$/.test(r.url());
  pagina.on("response", r => { if (r.status() >= 400 && !tolerado(r)) pagina.errores.push(`HTTP ${r.status()}: ${r.url()}`); });
  await pagina.goto(base + ruta, { waitUntil: "load" });
  return pagina;
}

try {
  for (const ruta of ["/", "/irpf/", "/guias/calendario-renta/", "/vivienda/", "/vivienda/venta-vivienda/", "/glosario/", "/glosario/base-liquidable/", "/validacion/", "/autonomos/", "/autonomos/canarias/"]) {
    await prueba(`carga sin errores de JS: ${ruta}`, async () => {
      const p = await abrir(ruta);
      await p.waitForTimeout(500);
      assert.deepEqual(p.errores, []);
      await p.context().close();
    });
  }

  // Simulador rápido de la portada (#mc-salario, campo data-importe).
  await prueba("sueldo: «30.000,50» y «30000,50» dan lo mismo; «30,000,50» da error", async () => {
    const p = await abrir("/");
    await p.waitForFunction(() => document.querySelector("#mc-res .minicalc-cifra"));
    const sueldo = p.locator("#mc-salario");
    const resultado = async texto => {
      await sueldo.fill(texto);
      await sueldo.dispatchEvent("change");
      await p.waitForTimeout(300);
      return p.locator("#mc-res").innerText();
    };
    const a = await resultado("30.000,50"), b = await resultado("30000,50");
    assert.equal(a, b);
    assert.notEqual(a, await resultado("12000"), "el resultado no reacciona al sueldo");
    await resultado("30,000,50");
    await sueldo.blur();
    await p.waitForTimeout(200);
    assert.ok(await p.locator(".error-importe").first().isVisible(), "no aparece .error-importe");
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  // El formulario completo se genera dinámicamente: se liquida el caso con el motor
  // cargado en la página (window.irpfsim) y los parámetros que sirve la web.
  await prueba("caso soltero30_ES-MD de tools/casos.json al céntimo (motor en la página)", async () => {
    const caso = JSON.parse(readFileSync(path.join(raiz, "tools/casos.json"), "utf8"))["soltero30_ES-MD"];
    const p = await abrir("/");
    await p.waitForFunction(() => window.irpfsim);
    const liq = await p.evaluate(async hogar => {
      const P = await (await fetch("datos/params.json")).json();
      const ps = P.ejercicio === hogar.ejercicio ? P : await (await fetch(`datos/params_${hogar.ejercicio}.json`)).json();
      const l = window.irpfsim.liquidar(hogar, ps, "auto");
      return { cl: l.cuotaLiquidaTotal, cr: l.cuotaResultanteAutoliquidacion, cd: l.cuotaDiferencial };
    }, caso.js);
    for (const k of ["cl", "cr", "cd"]) assert.ok(Math.abs(liq[k] - caso.ref[k]) < 0.005, `${k}: ${liq[k]} ≠ ${caso.ref[k]}`);
    await p.context().close();
  });

  for (const ruta of ["/", "/irpf/", "/validacion/"]) {
    await prueba(`móvil 390 px sin desbordamiento horizontal: ${ruta}`, async () => {
      const p = await abrir(ruta, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await p.waitForTimeout(500);
      const { sw, cw } = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert.ok(sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}`);
      assert.deepEqual(p.errores, []);
      await p.context().close();
    });
  }

  // Accesibilidad con axe-core (devDependency): fallan las infracciones «serious» y
  // «critical» de las páginas revisadas, en modo claro y oscuro.
  const axe = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  const rutasAxe = ["/#calculadora", "/#comparar", "/#planes", "/irpf/madrid/", "/irpf/bizkaia/", "/guias/calendario-renta/", "/vivienda/", "/vivienda/segunda-vivienda/", "/glosario/", "/glosario/base-liquidable/", "/validacion/", "/autonomos/", "/autonomos/canarias/"];
  for (const colorScheme of ["light", "dark"]) {
    for (const ruta of rutasAxe) {
      await prueba(`axe sin infracciones serious/critical (${colorScheme}): ${ruta}`, async () => {
        const p = await abrir(ruta, { colorScheme });
        await p.waitForTimeout(500);
        await p.addScriptTag({ content: axe });
        const graves = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations
          .filter(v => v.impact === "serious" || v.impact === "critical")
          .map(v => `${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")}`));
        assert.deepEqual(graves, []);
        await p.context().close();
      });
    }
  }
} finally {
  await navegador.close();
  servidor.kill();
}
console.log(fallos ? `\n${fallos} prueba(s) E2E fallidas` : "\nE2E OK");
process.exit(fallos ? 1 : 0);
