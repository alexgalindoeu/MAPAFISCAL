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
import http from "node:http";
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
// `preparar(ctx)` (opcional) se ejecuta antes de cargar la página: scripts de arranque y rutas.
async function abrir(ruta, opciones = {}) {
  const { preparar, ...opcionesCtx } = opciones;
  const ctx = await navegador.newContext(opcionesCtx);
  const pagina = await ctx.newPage();
  pagina.errores = [];
  // terceros (analítica, anuncios, Supabase, CDN) fuera: la prueba no depende de la red
  await ctx.route(u => !u.href.startsWith(base), r => r.abort());
  if (preparar) await preparar(ctx);
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

  // Comparar dos ofertas (#ofertas): el enlace prellena las dos ofertas y la frase sale del motor.
  await prueba("#ofertas?a=40000,ES-CT,14&b=39000,ES-MD,12: lado a lado, frase del neto y enlace para compartir", async () => {
    const p = await abrir("/index.html#ofertas?a=40000,ES-CT,14&b=39000,ES-MD,12,1500");
    await p.waitForFunction(() => document.querySelector("#of-principal .res-cifra"), null, { timeout: 5000 });
    assert.ok(await p.locator("#v-ofertas").isVisible(), "no se ve la vista");
    assert.equal(await p.locator("#of-a-territorio").inputValue(), "ES-CT");
    assert.equal(await p.locator("#of-b-pagas").inputValue(), "12");
    assert.equal(await p.locator("#of-b-plan").inputValue(), "1500");
    const esperado = await p.evaluate(async () => {
      const P = await (await fetch("datos/params.json")).json(), O = window.MapafiscalOfertas;
      return O.frase(O.compararOfertas(P, { bruto: 40000, territorio: "ES-CT", pagas: 14, plan: 0 }, { bruto: 39000, territorio: "ES-MD", pagas: 12, plan: 1500 }));
    });
    assert.equal(await p.locator("#of-frase").innerText(), esperado);
    assert.equal(await p.locator("#of-tabla thead th[scope=col]").count(), 4);
    assert.ok((await p.locator("#of-tabla").innerText()).includes("Tipo medio sobre el sueldo bruto"));
    await p.locator("#of-a-pagas").selectOption("12");
    await p.waitForFunction(() => location.hash === "#ofertas?a=40000,ES-CT,12&b=39000,ES-MD,12,1500");
    assert.match(await p.locator("#of-enlace").inputValue(), /#ofertas\?a=40000,ES-CT,12&b=39000,ES-MD,12,1500$/);
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  // El mismo sueldo en dos ejercicios (#ejercicios): 2025 frente a 2026, con la deducción del SMI de cada año.
  await prueba("#ejercicios?b=18000&t=ES-MD: neto e IRPF de 2025 y 2026 y conceptos que cambian", async () => {
    const p = await abrir("/index.html#ejercicios?b=18000&t=ES-MD");
    await p.waitForFunction(() => document.querySelector("#ej-principal .res-cifra"), null, { timeout: 5000 });
    assert.equal(await p.locator("#ej-territorio").inputValue(), "ES-MD");
    const esperado = await p.evaluate(async () => {
      const Pb = await (await fetch("datos/params.json")).json(), Pa = await (await fetch("datos/params_2025.json")).json();
      return window.MapafiscalEjercicios.frase(window.MapafiscalEjercicios.compararEjercicios(Pa, Pb, { bruto: 18000, territorio: "ES-MD" }));
    });
    assert.equal(await p.locator("#ej-frase").innerText(), esperado);
    const conceptos = await p.locator("#ej-conceptos").innerText();
    assert.ok(conceptos.includes("340 €") && conceptos.includes("590,89 €"), "deducción del SMI de cada año");
    assert.ok(conceptos.includes("te afecta"));
    await p.locator("#ej-territorio").selectOption("ES-VC");
    await p.waitForFunction(() => location.hash === "#ejercicios?b=18000&t=ES-VC");
    assert.ok((await p.locator("#ej-conceptos").innerText()).includes("8,8 %"), "escala valenciana de 2026");
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  // «De cada 100 € más» (#marginal): gráfico SVG, saltos explicados y tabla alternativa.
  await prueba("#marginal?t=ES-MD: gráfico, saltos con su explicación y tabla accesible", async () => {
    const p = await abrir("/index.html#marginal?t=ES-MD");
    await p.waitForFunction(() => document.querySelector("#mg-grafico svg.mg-svg"), null, { timeout: 5000 });
    const n = await p.evaluate(async () => {
      const P = await (await fetch("datos/params.json")).json();
      return window.MapafiscalMarginal.saltos(P, "ES-MD").length;
    });
    assert.ok(n > 3);
    assert.equal(await p.locator("#mg-saltos li").count(), n);
    assert.ok((await p.locator("#mg-saltos").innerText()).includes("Se acaba la reducción por rendimientos del trabajo"));
    assert.equal(await p.locator("#mg-tabla tbody tr").count(), 55);
    assert.ok(await p.locator("#mg-grafico svg[role=img][aria-label]").count());
    await p.locator("#mg-territorio").selectOption("ES-NC");
    await p.waitForFunction(() => location.hash === "#marginal?t=ES-NC" && document.querySelector("#mg-chip").textContent.includes("Navarra"));
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  // Informe completo en PDF (issue #66): con el pago único y el anuncio bonificado apagados es
  // gratis con sesión iniciada. La sesión se simula con un supabase-js falso (window.supabase:
  // app.js no descarga el de la CDN si ya existe) y una sesión guardada en localStorage.
  const conSesion = ({ plan = "gratis", config = null } = {}) => async ctx => {
    await ctx.addInitScript(plan => {
      const id = "u-e2e";
      localStorage.setItem("sb-pqiqrcvuztxrwrwizppj-auth-token", "{}");
      localStorage.setItem("mapafiscal.bienvenida." + id, "1");
      window.print = () => { window.__impreso = (window.__impreso || 0) + 1; };
      const usuario = { id, email: "e2e@example.test", created_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] } };
      const respuesta = tabla => ({ data: tabla === "perfiles" ? { nombre: "", despacho: "", plan, creado_en: "2026-01-01T00:00:00Z",
        condiciones_version: (window.MAPAFISCAL_CONFIG || {}).condicionesVersion } : tabla === "suscripciones" ? null : [], error: null, status: 200 });
      const consulta = tabla => {
        const q = new Proxy({}, { get: (_, k) => k === "then" ? (ok, mal) => Promise.resolve(respuesta(tabla)).then(ok, mal) : () => q });
        return q;
      };
      const cliente = {
        auth: { getSession: async () => ({ data: { session: { user: usuario } }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null }) },
        from: consulta, rpc: async () => ({ data: 0, error: null }),
        functions: { invoke: async () => ({ data: null, error: new Error("sin red en el e2e") }) }
      };
      window.supabase = { createClient: () => cliente };
    }, plan);
    if (config) await ctx.route(base + "/config.js", async r => {
      const res = await r.fetch();
      await r.fulfill({ response: res, body: config(await res.text()) });
    });
  };
  const abrirInforme = async p => {
    await p.waitForFunction(() => window.MapafiscalApp && window.MapafiscalApp.sesionCargada() && window.MapafiscalApp.ultimo(), null, { timeout: 8000 });
    await p.locator("#btn-informe").click();
    await p.waitForFunction(() => { const c = document.querySelector("#inf-cuerpo"); return c && !c.querySelector(".inf-cargando") && c.children.length; }, null, { timeout: 5000 });
  };

  await prueba("informe con sesión iniciada y pagos apagados: se genera sin pedir pago", async () => {
    const p = await abrir("/index.html#calculadora", { preparar: conSesion() });
    await abrirInforme(p);
    assert.equal(await p.evaluate(() => window.MapafiscalApp.sesion().usuario), true, "la sesión simulada no ha cargado");
    assert.equal(await p.locator(".inf-candado").count(), 0, "no debería pedir nada");
    const texto = await p.locator("#inf-cuerpo").innerText();
    assert.ok(texto.includes("Desglose de la liquidación") && texto.includes("Cómo pagar menos"), texto.slice(0, 300));
    assert.ok(await p.locator("#inf-pdf").isVisible(), "falta «Descargar PDF»");
    await p.locator("#inf-pdf").click();
    await p.waitForSelector("#inf-espera", { timeout: 3000 });        // espera con el banner propio, sin pago
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  await prueba("informe sin sesión y pagos apagados: ofrece iniciar sesión para descargarlo", async () => {
    const p = await abrir("/index.html#calculadora");
    await abrirInforme(p);
    assert.ok((await p.locator(".inf-candado h2").innerText()).includes("Inicia sesión"));
    assert.equal(await p.locator('[data-inf="pago"], [data-inf="anuncio"]').count(), 0, "no se ofrece ningún pago");
    assert.equal(await p.locator("#inf-pdf").isVisible(), false);
    await p.locator('[data-inf="acceso"]').click();
    await p.waitForFunction(() => document.querySelector("#dlg-acceso").open, null, { timeout: 3000 });
    assert.match(await p.locator("#dlg-acceso").innerText(), /descargar el informe completo/);
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  await prueba("informe con sesión y el pago único encendido: vuelve a pedir el pago", async () => {
    const p = await abrir("/index.html#calculadora", { preparar: conSesion({ config: t => t.replace("informePago: false", "informePago: true") }) });
    await abrirInforme(p);
    assert.equal(await p.locator('.inf-candado [data-inf="pago"]').count(), 1);
    assert.ok((await p.locator(".inf-candado").innerText()).includes("1,99 €"));
    assert.equal(await p.locator("#inf-pdf").isVisible(), false);
    await p.locator("#inf-cerrar").click();
    await p.evaluate(() => { location.hash = "#planes"; });
    await p.waitForSelector("#planes .plan");
    assert.equal(await p.locator("#planes-informe-gratis").innerText(), "Con un pago único de 1,99 €");
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  await prueba("#planes con los pagos del informe apagados: el informe sale gratis con cuenta", async () => {
    const p = await abrir("/index.html#planes");
    await p.waitForSelector("#planes .plan");
    assert.ok((await p.locator("#planes .plan").first().innerText()).includes("Informe completo en PDF, con tu cuenta gratuita"));
    assert.equal(await p.locator("#planes-informe-gratis").innerText(), "Con cuenta gratuita");
    assert.match(await p.locator("#faq-informe").textContent(), /^Sí\. Con una cuenta gratuita/);
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  await prueba("portada y panel «Todo» enlazan #ofertas, #ejercicios y #marginal", async () => {
    const p = await abrir("/");
    for (const v of ["ofertas", "ejercicios", "marginal"])
      await p.waitForFunction(h => document.querySelector(`#herramientas a[href="${h}"] svg.ico`), "#" + v, { timeout: 5000 });
    await p.locator("#btn-todo").click();
    for (const v of ["ofertas", "ejercicios", "marginal"]) await p.waitForSelector(`a.panel-item[href="#${v}"]`, { timeout: 3000 });
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

  for (const ruta of ["/", "/irpf/", "/irpf/gipuzkoa/", "/irpf/navarra/simulador-renta/", "/guias/calendario-renta/", "/vivienda/", "/vivienda/venta-vivienda/", "/glosario/", "/glosario/base-liquidable/", "/validacion/", "/autonomos/", "/autonomos/canarias/", "/sueldo-mensual/", "/widget/", "/widget/sueldo-neto.html?t=ES-MD", "/comparar-ofertas/", "/irpf-2025-vs-2026/", "/tipo-marginal-real/", "/ranking-irpf-comunidades/", "/sobre-mapafiscal/", "/contacto/"]) {
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

  // Widget de sueldo neto incrustado en otra web (otro origen): calcula con el motor de la
  // portada, manda su altura al padre (solo eso) y muestra la atribución.
  await prueba("widget incrustado en una página de prueba de otro origen: calcula y manda su altura", async () => {
    const motor = require(path.join(raiz, "web/js/irpfsim.js"));
    const P = JSON.parse(readFileSync(path.join(raiz, "web/datos/params.json"), "utf8"));
    const W = require(path.join(raiz, "web/js/widget.js"));
    const esperado = motor.sueldoNeto({ bruto: 42000, territorio: "ES-PV-BI", edad: 35, hijos: [], tipoContrato: "indefinido" }, P);
    // el código para copiar, apuntando al servidor local en vez de a mapafiscal.es
    const codigo = W.codigoWidget({ territorio: "ES-AN", tema: "oscuro" }).replace(W.SITIO + W.RUTA, base + W.RUTA);
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Prueba</title></head><body>
      <h1>Blog de prueba</h1>${codigo}
      <script>window.mensajes = []; addEventListener("message", e => { window.mensajes.push({ origen: e.origin, datos: e.data });
        const f = document.querySelector("iframe"); if (e.source === f.contentWindow) f.style.height = e.data.altura + "px"; });</script></body></html>`;
    // La página anfitriona la sirve otro servidor local (127.0.0.1 y otro puerto: otro origen).
    // Tiene que ser un servidor de verdad: Chromium bloquea un iframe a localhost desde una
    // respuesta simulada con route() (comprobaciones de acceso a la red local).
    const anfitrionSrv = http.createServer((req, res) => res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html));
    await new Promise(ok => anfitrionSrv.listen(0, "127.0.0.1", ok));
    const anfitrion = `http://127.0.0.1:${anfitrionSrv.address().port}`;
    const ctx = await navegador.newContext();
    await ctx.route(u => !u.href.startsWith(base) && !u.href.startsWith(anfitrion), r => r.abort());
    const p = await ctx.newPage();
    const errores = [];
    p.on("pageerror", e => errores.push(e.message));
    await p.goto(anfitrion + "/blog.html");
    const marco = p.frameLocator("iframe");
    await marco.locator("#w-anual").filter({ hasNotText: "…" }).waitFor({ timeout: 5000 });
    assert.equal(await marco.locator("#w-territorio").inputValue(), "ES-AN");
    assert.equal(await marco.locator("html").getAttribute("data-tema"), "oscuro");
    await marco.locator("#w-bruto").fill("42.000");
    await marco.locator("#w-territorio").selectOption("ES-PV-BI");
    await marco.locator('input[name="pagas"][value="14"]').check();
    const eur0 = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
    assert.equal(await marco.locator("#w-anual").innerText(), eur0(esperado.neto));
    assert.equal(await marco.locator("#w-mes").innerText(), eur0(esperado.neto / 14));
    assert.equal(await marco.locator("#w-irpf").innerText(), eur0(esperado.irpf));
    assert.equal(await marco.locator("#w-tipo").innerText(), (100 * esperado.irpf / 42000).toFixed(1).replace(".", ",") + " %");
    assert.ok(await marco.locator("#pie a[href='https://mapafiscal.es/']").isVisible(), "no se ve la atribución del widget");
    assert.ok(await p.locator("iframe + p a[href='https://mapafiscal.es/']").isVisible(), "no se ve el enlace fuera del iframe");
    // solo mensajes de altura, desde el origen del widget, y el marco se ajusta a ella
    const mensajes = await p.evaluate(() => window.mensajes);
    assert.ok(mensajes.length > 0, "el widget no ha mandado su altura");
    for (const m of mensajes) {
      assert.equal(m.origen, base);
      assert.deepEqual(Object.keys(m.datos).sort(), ["altura", "tipo"]);
      assert.equal(m.datos.tipo, "mapafiscal:altura");
    }
    const alto = await p.locator("iframe").evaluate(f => f.getBoundingClientRect().height);
    assert.equal(Math.round(alto), mensajes.at(-1).datos.altura);
    assert.deepEqual(errores, []);
    await ctx.close();
    anfitrionSrv.close();
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

  // «Descargar CSV» del comparador (js/csv.js): ranking de los 19 y curvas del deslizador.
  const leerDescarga = async d => readFileSync(await d.path(), "utf8");
  await prueba("#comparar: «Descargar CSV» del ranking y de las curvas, con BOM, «;» y coma decimal", async () => {
    const p = await abrir("/#comparar", { acceptDownloads: true });
    await p.waitForFunction(() => document.querySelectorAll("#ranking tbody tr").length === 19, null, { timeout: 10000 });
    const [d1] = await Promise.all([p.waitForEvent("download"), p.click("#ranking-csv")]);
    assert.match(d1.suggestedFilename(), /^comparar-territorios-irpf-\d{4}-es-[a-z-]+\.csv$/);
    const t1 = await leerDescarga(d1);
    assert.ok(t1.startsWith("﻿Puesto;Código;Territorio;Régimen;Cuota IRPF (€);Tipo medio sobre la base imponible (%);Diferencia con "), t1.slice(0, 120));
    const filas = t1.slice(1).trim().split("\n");
    assert.equal(filas.length, 20);
    for (const f of filas.slice(1)) assert.match(f, /^\d+;ES-[A-Z-]+;[^;]+;(común|foral);\d+,\d\d;\d+,\d\d;-?\d+,\d\d$/, f);
    // las cifras son las del motor en la página, sin redondear al euro
    const motor = await p.evaluate(() => {
      const a = window.MapafiscalApp, u = a.ultimo();
      return window.irpfsim.compararTerritorios(u.hogar, a.P()).map(c => [c.territorio, c.cuotaResultanteAutoliquidacion.toFixed(2).replace(".", ",")]);
    });
    for (const [t, c] of motor) assert.ok(filas.some(f => f.split(";")[1] === t && f.split(";")[4] === c), `${t}: ${c}`);
    await p.waitForFunction(() => !document.getElementById("desl-csv").disabled, null, { timeout: 15000 });
    const [d2] = await Promise.all([p.waitForEvent("download"), p.click("#desl-csv")]);
    assert.match(d2.suggestedFilename(), /^curvas-irpf-\d{4}-(persona-sola|tu-situacion)\.csv$/);
    const t2 = await leerDescarga(d2);
    assert.ok(t2.startsWith("﻿Sueldo bruto anual (€);"));
    const l2 = t2.slice(1).trim().split("\n");
    assert.equal(l2.length, 1 + 28, "28 sueldos de 15.000 a 150.000 €");
    assert.equal(l2[0].split(";").length, 1 + 2 * 19);
    assert.match(l2[1], /^15000;/);
    assert.match(l2.at(-1), /^150000;(\d+,\d\d;?)+$/);
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  // Curva del ahorro del plan de pensiones (#plan-pensiones, curvaPlan de herramientas.js).
  await prueba("#plan-pensiones: curva del ahorro, euro marginal y tabla alternativa", async () => {
    const p = await abrir("/#plan-pensiones");
    await p.waitForSelector("#pp-curva svg.ppc-svg", { timeout: 10000 });
    const leer = () => p.evaluate(() => ({
      frase: document.getElementById("pp-curva-frase").textContent,
      puntos: document.querySelectorAll("#pp-curva .ppc-zona").length,
      punto: !!document.querySelector("#pp-curva .ppc-punto"),
      filas: document.querySelectorAll("#pp-curva-tabla tbody tr").length,
      linea: document.querySelector("#pp-curva .ppc-linea")?.getAttribute("d") || ""
    }));
    const r = await leer();
    assert.equal(r.puntos, 41);
    assert.ok(r.punto, "falta el punto de tu aportación");
    assert.ok(r.filas >= 10, `${r.filas} filas en la tabla`);
    assert.match(r.frase, /(Los primeros [\d.]+ € te ahorran un \d+(,\d+)? %|Cada euro que aportes hasta tu límite de [\d.]+ € te ahorra un \d+(,\d+)? %)/);
    // la frase sale de curvaPlan con el motor de la página
    const esperado = await p.evaluate(() => {
      const P = window.MapafiscalHerramientas.paramsPlan(), imp = id => window.MapafiscalImporte.valor(document.getElementById(id));
      const c = window.MapafiscalHerramientas.curvaPlan(P, { bruto: imp("pp-bruto"), territorio: document.getElementById("pp-territorio").value,
        edad: +document.getElementById("pp-edad").value, hijos: [], aportacion: imp("pp-aportacion"), contribucionEmpresa: imp("pp-empresa"),
        donativos: imp("pp-donativo"), donativosRecurrentes: document.getElementById("pp-recurrente").checked });
      return window.MapafiscalImporte.pctTipo(c.marginal.tipo);   // tipo de tarifa: decimales justos
    });
    assert.ok(r.frase.includes(esperado), `${r.frase} / ${esperado}`);
    // con otro sueldo cambia la curva: se busca uno en el que el ahorro se agote antes del límite
    // (la cuota llega a cero), con el ejercicio y el territorio que muestra la herramienta
    const bajo = await p.evaluate(() => {
      const H = window.MapafiscalHerramientas, P = H.paramsPlan(), t = document.getElementById("pp-territorio").value;
      const imp = id => window.MapafiscalImporte.valor(document.getElementById(id));
      for (let b = 14000; b <= 30000; b += 100) {
        // los mismos datos que lee la vista (datosPp), donativos incluidos
        const c = H.curvaPlan(P, { bruto: b, territorio: t, edad: +document.getElementById("pp-edad").value, hijos: [], aportacion: imp("pp-aportacion"),
          contribucionEmpresa: imp("pp-empresa"), donativos: imp("pp-donativo"), donativosRecurrentes: document.getElementById("pp-recurrente").checked });
        if (c.agota != null && c.ahorroMax > 20) return b;
      }
      return null;
    });
    assert.ok(bajo, "ningún sueldo agota el ahorro");
    await p.fill("#pp-bruto", String(bajo));
    await p.dispatchEvent("#pp-bruto", "change");
    await p.waitForTimeout(400);
    const r2 = await leer();
    assert.notEqual(r2.linea, r.linea, "la curva no reacciona al sueldo");
    assert.match(r2.frase, /aportar más ya no te ahorra IRPF/);
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  await prueba("/ranking-irpf-comunidades/: mapa, tabla y datos descargables servidos", async () => {
    const p = await abrir("/ranking-irpf-comunidades/");
    assert.equal(await p.locator("svg.ranking-mapa path.terr").count(), 19);
    assert.equal(await p.locator("table.ranking-tabla tbody tr").count(), 19);
    const hrefs = await p.locator("#datos a[download]").evaluateAll(as => as.map(a => a.getAttribute("href")));
    assert.equal(hrefs.length, 2);
    for (const href of hrefs) {
      const r = await p.request.get(base + href);
      assert.equal(r.status(), 200, href);
      if (href.endsWith(".csv")) { assert.match(r.headers()["content-type"], /text\/csv/); assert.ok((await r.text()).startsWith("﻿ejercicio;")); }
      else assert.ok(Array.isArray((await r.json()).datos));
    }
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });
  for (const ruta of ["/", "/irpf/", "/validacion/", "/sueldo-mensual/", "/#sueldo-mes", "/sueldo-neto/30000/madrid/", "/autonomos/madrid/", "/guias/12-o-14-pagas/", "/irpf/madrid/", "/irpf/bizkaia/", "/irpf/gipuzkoa/", "/#ofertas", "/#ejercicios", "/#marginal", "/tipo-marginal-real/", "/ranking-irpf-comunidades/"]) {
    await prueba(`móvil 390 px sin desbordamiento horizontal: ${ruta}`, async () => {
      const p = await abrir(ruta, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await p.waitForTimeout(500);
      // con isMobile, lo que desborda no da scroll: aleja la página entera (innerWidth > 390)
      const { sw, cw, iw } = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, iw: window.innerWidth }));
      assert.ok(sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}`);
      assert.equal(iw, 390, `la página se ve alejada: ${iw} px de ancho`);
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
      medio: (100 * (b > 0 ? (b - ss - neto) / b : 0)).toFixed(1).replace(".", ",") + " %" };   // tipo medio sobre el bruto
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
  // El botón (o el gesto) «atrás» del navegador respeta las vistas y cierra el panel «Todo».
  await prueba("atrás: vuelve a la vista anterior y cierra el panel «Todo» sin salir de la web", async () => {
    const p = await abrir("/", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await p.waitForFunction(() => window.MapafiscalApp);
    const vista = () => p.evaluate(() => [...document.querySelectorAll("main section.vista")].find(s => !s.hidden).id);
    await p.locator("#v-inicio a[href='#calculadora']").first().click();
    assert.equal(await vista(), "v-calculadora");
    await p.locator(".nav a[data-vista=comparar]").click();
    assert.equal(await vista(), "v-comparar");
    await p.goBack(); await p.waitForTimeout(200);
    assert.equal(await vista(), "v-calculadora");
    await p.goBack(); await p.waitForTimeout(200);
    assert.equal(await vista(), "v-inicio");
    assert.equal(new URL(p.url()).origin, base);
    await p.locator("#btn-todo").click();
    assert.ok(await p.evaluate(() => document.getElementById("panel-todo").open));
    await p.goBack(); await p.waitForTimeout(200);
    assert.ok(!(await p.evaluate(() => document.getElementById("panel-todo").open)), "el panel sigue abierto");
    assert.equal(new URL(p.url()).origin, base);
    assert.equal(await vista(), "v-inicio");
    assert.deepEqual(p.errores, []);
    await p.context().close();
  });

  // Accesibilidad con axe-core (devDependency): fallan las infracciones «serious» y
  // «critical» de las páginas revisadas, en modo claro y oscuro.
  const axe = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  const rutasAxe = ["/#calculadora", "/#comparar", "/#planes", "/#sueldo-mes", "/sueldo-mensual/", "/irpf/madrid/", "/irpf/bizkaia/", "/sueldo-neto/30000/madrid/", "/irpf/gipuzkoa/simulador-renta/", "/guias/calendario-renta/", "/vivienda/", "/vivienda/segunda-vivienda/", "/glosario/", "/glosario/base-liquidable/", "/validacion/", "/autonomos/", "/autonomos/canarias/", "/guias/12-o-14-pagas/", "/widget/", "/widget/sueldo-neto.html?t=ES-CT&ancho=compacto", "/#ofertas", "/#ejercicios", "/#marginal", "/comparar-ofertas/", "/irpf-2025-vs-2026/", "/tipo-marginal-real/", "/ranking-irpf-comunidades/", "/#plan-pensiones", "/sobre-mapafiscal/", "/contacto/"];
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
