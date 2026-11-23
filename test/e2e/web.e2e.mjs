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
  // Enlace de las páginas forales: la calculadora se abre con el territorio (y el ejercicio) elegido.
  await prueba("#calculadora?t=ES-PV-SS&ejercicio=2025 abre la calculadora en Gipuzkoa, ejercicio 2025", async () => {
    const p = await abrir("/index.html#calculadora?t=ES-PV-SS&ejercicio=2025");
    await p.waitForFunction(() => window.MapafiscalApp && window.MapafiscalApp.P().ejercicio === 2025, null, { timeout: 5000 });
    assert.equal(await p.locator("#f-territorio").inputValue(), "ES-PV-SS");
    assert.ok(await p.locator("#v-calculadora").isVisible(), "no se ve la calculadora");
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  // «Sueldo al mes»: el enlace directo prellena la vista y el neto sale del motor de la página.
  await prueba("#sueldo-mes?b=31000&p=14&t=ES-MD: bruto y neto al mes, meses con extra, tabla 12/14/15", async () => {
    const p = await abrir("/index.html#sueldo-mes?b=31000&p=14&t=ES-MD");
    await p.waitForFunction(() => document.querySelector("#sm-principal .res-cifra"), null, { timeout: 5000 });
    assert.ok(await p.locator("#v-sueldo-mes").isVisible(), "no se ve la vista");
    assert.equal(await p.locator("#sm-territorio").inputValue(), "ES-MD");
    assert.ok(await p.locator('input[name="sm-pagas"][value="14"]').isChecked());
    const esperado = await p.evaluate(async () => {
      const P = await (await fetch("datos/params.json")).json();
      const y = new Date().getFullYear();
      const Py = P.ejercicio === y ? P : await fetch(`datos/params_${y}.json`).then(r => r.ok ? r.json() : P);
      return window.irpfsim.sueldoNeto({ bruto: 31000, territorio: "ES-MD", edad: 40, hijos: [], tipoContrato: "indefinido" }, Py).neto;
    });
    const fmt = n => (Math.round(n * 100) / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
    const texto = await p.locator("#sm-principal").innerText();
    assert.ok(texto.includes("2.214,29 € brutos al mes"), texto);
    assert.ok(texto.includes(fmt(esperado / 14)), `neto al mes ${fmt(esperado / 14)}`);
    assert.ok(texto.includes(fmt(2 * esperado / 14)), "neto del mes con paga extra");
    assert.ok(texto.includes("El neto anual es el mismo; cambia cómo se reparte"));
    assert.equal(await p.locator("#sm-tabla thead th[scope=col]").count(), 3);
    // 12 pagas: cambia el reparto, no el neto anual
    await p.locator('label:has(input[name="sm-pagas"][value="12"])').click();
    await p.waitForFunction(() => document.querySelector("#sm-principal").innerText.includes("2.583,33 € brutos al mes"));
    assert.ok((await p.locator("#sm-principal").innerText()).includes(fmt(esperado)), "mismo neto anual");
    // jornada del 60 %: el bruto prorrateado
    await p.locator("#sm-jornada").fill("60");
    await p.locator("#sm-jornada").dispatchEvent("change");
    await p.waitForFunction(() => document.querySelector("#sm-principal").innerText.includes("18.600,00 € brutos al año"));
    assert.match(await p.evaluate(() => location.hash), /^#sueldo-mes\?b=31000&p=12&t=ES-MD&j=60$/);
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  // La portada y el panel «Todo» enlazan la herramienta.
  await prueba("portada y panel «Todo» enlazan #sueldo-mes", async () => {
    const p = await abrir("/");
    await p.waitForFunction(() => document.querySelector('#herramientas a[href="#sueldo-mes"]'), null, { timeout: 5000 });
    assert.ok(await p.locator('#herramientas a[href="#sueldo-mes"] svg.ico').count());
    await p.locator("#btn-todo").click();
    await p.waitForSelector('a.panel-item[href="#sueldo-mes"]', { timeout: 3000 });
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  for (const ruta of ["/", "/irpf/", "/irpf/gipuzkoa/", "/irpf/navarra/simulador-renta/", "/guias/calendario-renta/", "/vivienda/", "/vivienda/venta-vivienda/", "/glosario/", "/glosario/base-liquidable/", "/validacion/", "/autonomos/", "/autonomos/canarias/", "/sueldo-mensual/"]) {
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

  for (const ruta of ["/", "/irpf/", "/validacion/", "/sueldo-mensual/", "/#sueldo-mes", "/sueldo-neto/30000/madrid/", "/autonomos/madrid/", "/guias/12-o-14-pagas/", "/irpf/madrid/", "/irpf/bizkaia/", "/irpf/gipuzkoa/"]) {
    await prueba(`móvil 390 px sin desbordamiento horizontal: ${ruta}`, async () => {
      const p = await abrir(ruta, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await p.waitForTimeout(500);
      const { sw, cw } = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert.ok(sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}`);
      assert.deepEqual(p.errores, []);
      await p.context().close();
    });
  }

  // Cálculo rápido de las páginas SEO (web/js/calculo-rapido.js): el resultado tiene que ser el
  // del motor (irpfsim.sueldoNeto) con los parámetros del ejercicio de la página.
  const cuentaMotor = (p, bruto, territorio) => p.evaluate(async ([bruto, territorio]) => {
    const ej = Number(document.querySelector("[data-calculo-rapido]").dataset.ejercicio);
    const P0 = await (await fetch("/datos/params.json")).json();
    const P = P0.ejercicio === ej ? P0 : await (await fetch(`/datos/params_${ej}.json`)).json();
    const s = window.irpfsim.sueldoNeto({ bruto, territorio, edad: 40, hijos: [], tipoContrato: "indefinido" }, P);
    const miles = n => String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
    const b = Math.round(bruto), ss = Math.round(s.cotizaciones), neto = Math.round(s.neto);
    return { neto: miles(neto), mes12: miles(neto / 12), mes14: miles(neto / 14), ss: miles(ss), irpf: miles(b - ss - neto),
      medio: (100 * s.liquidacion.tipoMedioEfectivo).toFixed(1).replace(".", ",") + " %" };
  }, [bruto, territorio]);
  const leerCalculo = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll("#cr-res [data-cr]")].map(e => [e.dataset.cr, e.textContent.trim()])));
  for (const [ruta, territorio, inicial, texto, bruto] of [
    ["/sueldo-neto/30000/madrid/", "ES-MD", "30000", "42.500", 42500],
    ["/irpf/bizkaia/", "ES-PV-BI", "30000", "55000", 55000]
  ]) {
    await prueba(`cálculo rápido de ${ruta}: ${texto} € coincide con irpfsim.sueldoNeto`, async () => {
      const p = await abrir(ruta, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      assert.equal(await p.locator("#cr-territorio").inputValue(), territorio);
      assert.equal(await p.locator("#cr-bruto").inputValue(), inicial);
      // el motor se carga al acercarse el bloque a la pantalla
      assert.equal(await p.evaluate(() => document.querySelector("#calculo-rapido").getBoundingClientRect().top > innerHeight + 200 ? !!window.irpfsim : false), false, "el motor se ha cargado antes de tiempo");
      await p.locator("#calculo-rapido").scrollIntoViewIfNeeded();
      await p.waitForFunction(() => document.querySelector("#cr-res [data-cr=neto]"), null, { timeout: 5000 });
      // el bruto prellenado ya da el resultado del motor
      assert.deepEqual(Object.fromEntries(Object.entries(await leerCalculo(p)).filter(([k]) => k !== "marginal" && k !== "neto-paga")), await cuentaMotor(p, Number(inicial), territorio));
      await p.locator("#cr-bruto").fill(texto);
      await p.waitForFunction(t => document.querySelector("#cr-afinar").href.includes("bruto=" + t), bruto);
      const r = await leerCalculo(p), m = await cuentaMotor(p, bruto, territorio);
      for (const k of Object.keys(m)) assert.equal(r[k], m[k], k);
      assert.equal(r["neto-paga"], r.mes14, "con 14 pagas la cifra grande es el neto de cada paga");
      await p.locator('label:has(input[name="cr-pagas"][value="12"])').click();
      await p.waitForFunction(() => document.querySelector("[data-cr=neto-paga]").textContent === document.querySelector("[data-cr=mes12]").textContent);
      assert.match(await p.locator("#cr-res .cr-frase").innerText(), /pagarías .*€ (menos|más)/);
      assert.match(await p.locator("#cr-res .cr-frase").innerText(), /Puesto \d+ de 19/);
      const href = await p.locator("#cr-afinar").getAttribute("href");
      assert.match(href, new RegExp(`^/index\\.html#calculadora\\?t=${territorio}&bruto=${bruto}&ejercicio=20\\d\\d$`));
      // a 390 px el bloque cabe entero (el resto de la página se comprueba aparte)
      const { der, cw } = await p.evaluate(() => ({ der: Math.max(...[...document.querySelectorAll("#calculo-rapido, #calculo-rapido *")].map(e => e.getBoundingClientRect().right)), cw: document.documentElement.clientWidth }));
      assert.ok(der <= cw, `el cálculo rápido llega a ${der} px (ancho ${cw})`);
      assert.deepEqual(p.errores, []);
      // «Afinar con tu familia y deducciones»: la calculadora se abre con el territorio y el bruto
      await p.locator("#cr-afinar").click();
      await p.waitForFunction(() => window.MapafiscalApp && document.querySelector("#v-calculadora") && !document.querySelector("#v-calculadora").hidden, null, { timeout: 5000 });
      await p.waitForTimeout(300);
      assert.equal(await p.locator("#f-territorio").inputValue(), territorio);
      assert.equal(await p.evaluate(() => window.MapafiscalApp.formulario().estado.personas.d1.salario), bruto);
      await p.context().close();
    });
  }

  // Accesibilidad con axe-core (devDependency): fallan las infracciones «serious» y
  // «critical» de las páginas revisadas, en modo claro y oscuro.
  const axe = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  const rutasAxe = ["/#calculadora", "/#comparar", "/#planes", "/#sueldo-mes", "/sueldo-mensual/", "/irpf/madrid/", "/irpf/bizkaia/", "/sueldo-neto/30000/madrid/", "/irpf/gipuzkoa/simulador-renta/", "/guias/calendario-renta/", "/vivienda/", "/vivienda/segunda-vivienda/", "/glosario/", "/glosario/base-liquidable/", "/validacion/", "/autonomos/", "/autonomos/canarias/", "/guias/12-o-14-pagas/"];
  for (const colorScheme of ["light", "dark"]) {
    for (const ruta of rutasAxe) {
      await prueba(`axe sin infracciones serious/critical (${colorScheme}): ${ruta}`, async () => {
        const p = await abrir(ruta, { colorScheme });
        await p.waitForTimeout(500);
        // con el cálculo rápido ya pintado (se carga al acercarse a la pantalla)
        if (await p.locator("#calculo-rapido").count()) {
          await p.locator("#calculo-rapido").scrollIntoViewIfNeeded();
          await p.waitForFunction(() => document.querySelector("#cr-res [data-cr=neto]"), null, { timeout: 5000 });
        }
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
