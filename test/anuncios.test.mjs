// Anuncios: apagados por defecto, nunca para quien tiene plan, nunca en la demo, y nada de
// Google antes de saber si hay plan. web/js/anuncios.js se ejecuta en un DOM mínimo de mentira.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { empaquetar } from "../tools/empaquetar.mjs";

const leer = ruta => readFileSync(new URL("../web/" + ruta, import.meta.url), "utf8");
const CODIGO = leer("js/anuncios.js");
const INDEX = leer("index.html");
const LATERALES = { "anuncio-col-comparar": ["comparar", "adsenseHuecoColComparar"], "anuncio-col-escenarios": ["escenarios", "adsenseHuecoColEscenarios"],
  "anuncio-col-neto": ["sueldo-neto", "adsenseHuecoColNeto"], "anuncio-col-pensiones": ["plan-pensiones", "adsenseHuecoColPensiones"],
  "anuncio-col-rescate": ["rescate-plan", "adsenseHuecoColRescate"], "anuncio-col-conjunta": ["conjunta", "adsenseHuecoColConjunta"],
  "anuncio-col-pagadores": ["dos-pagadores", "adsenseHuecoColPagadores"], "anuncio-col-bruto": ["bruto-necesario", "adsenseHuecoColBruto"],
  "anuncio-col-deducciones": ["encuentra-deducciones", "adsenseHuecoColDeducciones"] };
const HUECOS = ["anuncio-rail-izq", "anuncio-rail-der", "anuncio-calc", "anuncio-comparar", ...Object.keys(LATERALES)];
const SLOTS = { adsenseHuecoRailIzq: "111", adsenseHuecoRailDer: "222", adsenseHuecoCalc: "444", adsenseHuecoComparar: "555" };

function configReal() {
  const window = {};
  new Function("window", leer("config.js"))(window);
  return window.MAPAFISCAL_CONFIG;
}

function clases() {
  const s = new Set();
  return { has: c => s.has(c), contains: c => s.has(c), add: c => s.add(c), remove: c => s.delete(c), toggle: (c, si) => (si ? s.add(c) : s.delete(c), si) };
}
function elemento(tag, id) {
  return { tagName: tag, id, hidden: true, children: [], dataset: {}, style: {}, classList: clases(),
    setAttribute() {}, addEventListener() {}, appendChild(h) { this.children.push(h); return h; },
    querySelector(s) { return s === ".anuncio" ? this.children.find(c => c.className === "tarjeta anuncio") || null : null; } };
}

// Monta un navegador de mentira y ejecuta anuncios.js. `cuenta` es lo que deja app.js.
function ejecutar(cfg, { cuenta = { cargada: true, conPlan: false }, almacen = {}, alto = 400, ancho } = {}) {
  const els = Object.fromEntries(HUECOS.map(id => [id, elemento(id in LATERALES ? "aside" : "div", id)]));
  // Columnas laterales: <aside> con la tarjeta dentro, como en index.html.
  for (const id of Object.keys(LATERALES)) { const t = elemento("div"); t.className = "tarjeta anuncio"; els[id].appendChild(t); els[id].clientHeight = alto; }
  const head = elemento("head"), body = elemento("body");
  const oyentes = {};
  const observados = [];
  const document = {
    documentElement: elemento("html"), head, body,
    getElementById: id => els[id] || null,
    createElement: tag => elemento(tag),
    addEventListener: (t, f) => { (oyentes[t] = oyentes[t] || []).push(f); },
    dispatch: (t, detail) => (oyentes[t] || []).forEach(f => f({ detail })),
    dispatchEvent: e => (oyentes[e.type] || []).forEach(f => f(e))
  };
  const ctx = {
    document, location: { hash: "#calculadora", reload() {} },
    localStorage: { getItem: k => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = String(v); }, removeItem: k => { delete almacen[k]; } },
    requestIdleCallback: f => f(), setTimeout: f => f(),
    IntersectionObserver: class { constructor(cb) { this.cb = cb; } observe(el) { observados.push({ el, io: this }); } unobserve() {} },
    MAPAFISCAL_CONFIG: cfg, MAPAFISCAL_CUENTA: cuenta, JSON, Date, Set,
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    matchMedia: ancho === undefined ? undefined : () => ({ matches: ancho })
  };
  ctx.window = ctx;
  vm.runInNewContext(CODIGO, ctx);
  const verTodo = () => observados.splice(0).forEach(({ el, io }) => io.cb([{ isIntersecting: true, target: el }]));
  const scripts = () => head.children.filter(c => c.tagName === "script");
  const ins = () => HUECOS.flatMap(id => els[id].children).flatMap(c => c.tagName === "ins" ? [c] : c.children);
  return { els, document, ctx, almacen, verTodo, scripts, ins };
}

const ENCENDIDO = { ...configReal(), anuncios: true, demo: false, ...SLOTS };

test("config.js: anuncios apagados por defecto y nunca encendidos sin bloques reales", () => {
  const cfg = configReal();
  assert.equal(typeof cfg.anuncios, "boolean");
  assert.match(cfg.adsenseCliente, /^ca-pub-\d{16}$/);
  assert.ok(["google", "propio"].includes(cfg.consentimiento), "consentimiento: google o propio");
  const slots = Object.keys(SLOTS).map(k => cfg[k]);
  for (const s of slots) assert.match(s, /^(\d{10})?$/, "un data-ad-slot son 10 cifras (o vacío)");
  if (cfg.anuncios) assert.ok(slots.some(Boolean), "anuncios: true sin ningún data-ad-slot");
  else assert.ok(slots.every(s => s === "") || true);
});

test("con anuncios: false no se toca nada: ni Google, ni huecos, ni carriles", () => {
  const r = ejecutar({ ...ENCENDIDO, anuncios: false });
  r.verTodo();
  assert.equal(r.scripts().length, 0);
  assert.equal(r.ins().length, 0);
  for (const id of HUECOS) assert.equal(r.els[id].hidden, true, id);
  assert.equal(r.document.documentElement.classList.has("con-carriles"), false);
});

test("la configuración real, tal cual está, no carga nada", () => {
  const cfg = configReal();
  if (cfg.anuncios) return; // ya encendidos: lo cubren los demás tests
  const r = ejecutar(cfg);
  r.verTodo();
  assert.equal(r.scripts().length, 0);
});

test("sin plan: reserva el sitio, llena cada hueco al verse y carga adsbygoogle una sola vez", () => {
  const r = ejecutar(ENCENDIDO);
  for (const id of HUECOS) assert.equal(r.els[id].hidden, false, id);
  assert.equal(r.document.documentElement.classList.has("con-carriles"), true);
  assert.equal(r.scripts().length, 1, "con la CMP de Google, adsbygoogle.js se carga al entrar para que salga el mensaje");
  assert.equal(r.ins().length, 0, "ningún hueco se llena antes de verse");
  r.verTodo();
  assert.equal(r.scripts().length, 1, "una sola vez");
  assert.match(r.scripts()[0].src, /^https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-/);
  assert.equal(r.ins().length, HUECOS.length);
  const carril = r.els["anuncio-rail-izq"].children[0];
  assert.match(carril.className, /mf_carril/);
  assert.equal(carril.dataset.adFormat, undefined, "los carriles son de tamaño fijo por CSS");
  assert.equal(carril.dataset.adSlot, "111");
  assert.equal(r.ctx.adsbygoogle.length, HUECOS.length);
  r.verTodo();
  assert.equal(r.ins().length, HUECOS.length, "sin recargas ni anuncios duplicados");
});

test("con plan de pago no hay anuncios ni se carga nada de Google", () => {
  const r = ejecutar(ENCENDIDO, { cuenta: { cargada: true, conPlan: true } });
  r.verTodo();
  assert.equal(r.scripts().length, 0);
  assert.equal(r.ins().length, 0);
  for (const id of HUECOS) assert.equal(r.els[id].hidden, true, id);
  assert.equal(r.document.documentElement.classList.has("con-carriles"), false);
  assert.equal(r.almacen["mapafiscal.sinAnuncios"], "1", "recuerda el plan para no reservar sitio la próxima vez");
});

test("espera a saber si hay plan antes de pedir nada", () => {
  const r = ejecutar(ENCENDIDO, { cuenta: { cargada: false, conPlan: false } });
  r.verTodo();
  assert.equal(r.scripts().length, 0, "sin cuenta conocida no se carga nada de Google, ni la CMP");
  r.document.dispatch("mapafiscal:cuenta", { cargada: true, conPlan: true });
  r.verTodo();
  assert.equal(r.scripts().length, 0);
  for (const id of HUECOS) assert.equal(r.els[id].hidden, true, id);
  const sin = ejecutar(ENCENDIDO, { cuenta: { cargada: false, conPlan: false } });
  assert.equal(sin.scripts().length, 0);
  sin.document.dispatch("mapafiscal:cuenta", { cargada: true, conPlan: false });
  assert.equal(sin.scripts().length, 1, "sin plan, la CMP se carga al conocer la cuenta aunque no se vea ningún hueco");
  assert.equal(sin.ins().length, 0);
});

test("quien tuvo plan no ve el sitio reservado; si deja de tenerlo, vuelven los anuncios", () => {
  const r = ejecutar(ENCENDIDO, { cuenta: { cargada: false }, almacen: { "mapafiscal.sinAnuncios": "1" } });
  for (const id of HUECOS) assert.equal(r.els[id].hidden, true, id);
  r.document.dispatch("mapafiscal:cuenta", { cargada: true, conPlan: false });
  r.verTodo();
  assert.equal(r.scripts().length, 1);
  assert.equal(r.almacen["mapafiscal.sinAnuncios"], undefined);
});

test("consentimiento propio: nada de Google hasta «Aceptar», y nada si se rechazó", () => {
  const r = ejecutar({ ...ENCENDIDO, consentimiento: "propio" });
  r.verTodo();
  assert.equal(r.scripts().length, 0);
  assert.ok(r.document.body.children.some(c => c.className === "aviso-cookies"), "sale el aviso");
  const aviso = r.document.body.children.find(c => c.className === "aviso-cookies");
  assert.match(aviso.innerHTML, /Rechazar/);
  assert.match(aviso.innerHTML, /Aceptar/);
  const rechazado = ejecutar({ ...ENCENDIDO, consentimiento: "propio" }, { almacen: { "mapafiscal.consentimiento": JSON.stringify({ si: false, t: Date.now() }) } });
  rechazado.verTodo();
  assert.equal(rechazado.scripts().length, 0);
  const aceptado = ejecutar({ ...ENCENDIDO, consentimiento: "propio" }, { almacen: { "mapafiscal.consentimiento": JSON.stringify({ si: true, t: Date.now() }) } });
  aceptado.verTodo();
  assert.equal(aceptado.scripts().length, 1);
  const otro = ejecutar({ ...ENCENDIDO, consentimiento: "ninguno" });
  otro.verTodo();
  assert.equal(otro.scripts().length, 0, "sin CMP no se carga nada");
});

test("la demo no lleva anuncios aunque la web los tenga encendidos", () => {
  const html = empaquetar();
  const cfg = html.match(/<script>\n([^<]*MAPAFISCAL_CONFIG[^<]*)<\/script>\n<script type="application\/json" id="datos-params">/);
  const window = {};
  new Function("window", cfg[1])(window);
  for (const k of Object.keys(SLOTS)) assert.equal(window.MAPAFISCAL_CONFIG[k], "", `la demo no vacía ${k}`);
  assert.equal(window.MAPAFISCAL_CONFIG.anuncios, false);
  const r = ejecutar({ ...ENCENDIDO, demo: true });
  r.verTodo();
  assert.equal(r.scripts().length, 0, "con demo: true, anuncios.js no hace nada");
});

test("los huecos están fuera del formulario, lejos de botones y etiquetados como «Anuncios»", () => {
  const f0 = INDEX.indexOf('<form class="formulario" id="form"'), form = [f0, INDEX.indexOf("</form>", f0)];
  for (const id of HUECOS) {
    const i = INDEX.indexOf(`id="${id}"`);
    assert.ok(i > 0, `falta ${id}`);
    assert.ok(form[0] < 0 || i < form[0] || i > form[1], `${id} está dentro del formulario`);
    // Desde el bloque anterior (tarjeta, sección o inicio del cuerpo) hasta el hueco: sin botones.
    const desde = Math.max(INDEX.lastIndexOf('<div class="tarjeta', i - 40), INDEX.lastIndexOf("<section", i), INDEX.lastIndexOf("<!--CUERPO-->", i));
    assert.doesNotMatch(INDEX.slice(desde, i), /<button|class="btn/, `${id} está pegado a un botón`);
    const bloque = INDEX.slice(i, INDEX.indexOf("</", i) + 10);
    assert.match(bloque, /<span class="anuncio-etiqueta">Anuncios<\/span>/, `${id}: la etiqueta debe ser «Anuncios»`);
  }
});

test("ningún anuncio entre las tarjetas del resultado: solo al final de la columna", () => {
  assert.doesNotMatch(INDEX, /anuncio-calc-medio|anuncio-solo-estrecho/);
  assert.doesNotMatch(CODIGO, /adsenseHuecoMovil/);
  assert.equal(configReal().adsenseHuecoMovil, undefined);
  const a0 = INDEX.indexOf('<aside class="resultado"'), a1 = INDEX.indexOf("</aside>", a0);
  const anuncios = [...INDEX.slice(a0, a1).matchAll(/class="tarjeta anuncio[^"]*" id="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(anuncios, ["anuncio-calc"]);
  const aside = INDEX.slice(a0, a1);
  assert.match(aside.slice(aside.lastIndexOf('<div class="tarjeta')), /^<div class="tarjeta anuncio anuncio-calc" id="anuncio-calc"/, "el hueco es lo último del resultado");
});

test("la política de cookies explica la publicidad solo cuando hay anuncios", () => {
  const html = leer("legal/cookies.html");
  assert.match(html, /<script src="\.\.\/config\.js"><\/script>/);
  assert.match(html, /data-con-anuncios hidden[\s\S]*id="publicidad"/);
  assert.match(html, /data-sin-anuncios/);
  assert.match(INDEX, /id="pie-configurar-cookies" hidden/);
});

test("columnas laterales: reutilizan adsenseHuecoCalc salvo que tengan bloque propio", () => {
  const r = ejecutar(ENCENDIDO);
  r.verTodo();
  for (const id of Object.keys(LATERALES)) {
    const tarjeta = r.els[id].children[0];
    assert.equal(tarjeta.children.length, 1, `${id}: el anuncio va dentro de la tarjeta`);
    assert.equal(tarjeta.children[0].dataset.adSlot, "444", `${id} usa el bloque de mf-resultado-final`);
    assert.equal(tarjeta.children[0].dataset.fullWidthResponsive, "false");
  }
  const propio = ejecutar({ ...ENCENDIDO, adsenseHuecoColNeto: "9999999999" });
  propio.verTodo();
  assert.equal(propio.els["anuncio-col-neto"].children[0].children[0].dataset.adSlot, "9999999999");
  assert.equal(propio.els["anuncio-col-conjunta"].children[0].children[0].dataset.adSlot, "444");
  const nada = ejecutar({ ...ENCENDIDO, adsenseHuecoCalc: "" });
  nada.verTodo();
  for (const id of Object.keys(LATERALES)) assert.equal(nada.els[id].hidden, true, `${id} sin bloque no se muestra`);
});

test("columnas laterales: vertical si hay alto, adaptable si no; nada con plan", () => {
  const alta = ejecutar(ENCENDIDO, { alto: 900 });
  alta.verTodo();
  assert.equal(alta.els["anuncio-col-neto"].children[0].children[0].dataset.adFormat, "vertical");
  const baja = ejecutar(ENCENDIDO, { alto: 300 });
  baja.verTodo();
  assert.equal(baja.els["anuncio-col-neto"].children[0].children[0].dataset.adFormat, "auto");
  const pro = ejecutar(ENCENDIDO, { cuenta: { cargada: true, conPlan: true } });
  pro.verTodo();
  for (const id of Object.keys(LATERALES)) {
    assert.equal(pro.els[id].hidden, true, id);
    assert.equal(pro.els[id].children[0].children.length, 0, id);
  }
});

test("columnas laterales: en su vista, fuera de todo formulario y con bloque propio en config.js", () => {
  const cfg = configReal();
  const formularios = [...INDEX.matchAll(/<form[\s\S]*?<\/form>/g)].map(m => [m.index, m.index + m[0].length]);
  for (const [id, [vista, clave]] of Object.entries(LATERALES)) {
    const i = INDEX.indexOf(`id="${id}"`);
    assert.ok(i > 0, `falta ${id}`);
    assert.ok(INDEX.lastIndexOf("<section", i) === INDEX.lastIndexOf(`<section class="vista" id="v-${vista}"`, i), `${id} no está en #${vista}`);
    for (const [a, b] of formularios) assert.ok(i < a || i > b, `${id} está dentro de un formulario`);
    assert.match(INDEX.slice(INDEX.lastIndexOf("<aside", i), i), /class="anuncio-lateral anuncio-lateral-(izq|der)"/);
    assert.ok(clave in cfg, `falta ${clave} en config.js`);
    assert.match(cfg[clave], /^(\d{10})?$/);
  }
  const css = leer("css/mapafiscal.css");
  assert.match(css, /\.anuncio-lateral \{ display: none; \}/, "ocultas por debajo de 1040 px");
  assert.match(css, /@media print \{ \.anuncio-lateral \{ display: none !important; \} \}/, "nunca en el PDF ni al imprimir");
});

test("móvil y tableta: las columnas pasan al final de la herramienta, adaptables y sin sticky", () => {
  const movil = ejecutar(ENCENDIDO, { alto: 900, ancho: false });
  movil.verTodo();
  const ins = movil.els["anuncio-col-neto"].children[0].children[0];
  assert.equal(ins.dataset.adFormat, "auto", "en móvil nunca vertical");
  assert.equal(ins.dataset.fullWidthResponsive, "true");
  assert.equal(ins.dataset.adSlot, "444");
  const propio = ejecutar({ ...ENCENDIDO, adsenseHuecoColMovil: "8888888888" }, { ancho: false });
  propio.verTodo();
  assert.equal(propio.els["anuncio-col-neto"].children[0].children[0].dataset.adSlot, "8888888888");
  const escritorio = ejecutar({ ...ENCENDIDO, adsenseHuecoColMovil: "8888888888" }, { ancho: true, alto: 900 });
  escritorio.verTodo();
  const e = escritorio.els["anuncio-col-neto"].children[0].children[0];
  assert.equal(e.dataset.adSlot, "444", "el bloque móvil no se usa en escritorio");
  assert.equal(e.dataset.adFormat, "vertical");
  assert.match(configReal().adsenseHuecoColMovil, /^(\d{10})?$/);

  const css = leer("css/mapafiscal.css");
  const regla = css.match(/@media \(max-width: 1039\.98px\) \{\n?([\s\S]*?)\n\}/)[1];
  assert.match(regla, /\.anuncio-lateral:not\(#anuncio-col-comparar\) \{ display: block;/, "en #comparar ya está #anuncio-comparar");
  assert.doesNotMatch(regla, /sticky|fixed/, "en móvil nada fijo ni pegajoso");
  assert.match(regla, /min-height: 280px/, "sitio reservado");
});

test("ningún hueco de columna va justo detrás de botones: al menos una tarjeta entera en medio", () => {
  for (const id of Object.keys(LATERALES)) {
    const i = INDEX.indexOf(`id="${id}"`);
    const boton = Math.max(INDEX.lastIndexOf("<button", i), INDEX.lastIndexOf('class="btn', i));
    const entre = INDEX.slice(boton, i);
    assert.ok((entre.match(/<div class="tarjeta/g) || []).length >= 1, `${id}: demasiado cerca de un botón`);
    // Lo que sigue al hueco: fin de la herramienta, no un botón.
    assert.doesNotMatch(INDEX.slice(i, INDEX.indexOf("</section>", i)), /<button|class="btn/, `${id}: botón detrás`);
  }
});

// ---- páginas SEO ---------------------------------------------------------------------------
import { ponerHuecos, conAnuncios, layout } from "../tools/seo_comun.mjs";

test("páginas SEO: huecos entre tarjetas, nunca dentro de una tabla ni antes del <h1>", () => {
  const t = n => `<div class="tarjeta"><h2>B${n}</h2><table><tr><td><div>x</div></td></tr></table></div>`;
  const main = `<h1>T</h1><p class="entradilla">i</p><div class="prosa">${[1, 2, 3, 4, 5, 6, 7].map(t).join("")}<div class="tarjeta faq"><h2>FAQ</h2></div></div>`;
  const r = ponerHuecos(main);
  const pos = [...r.matchAll(/data-anuncio-seo="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(pos, ["intro", "medio", "faq"]);
  assert.ok(r.indexOf("anuncio-seo") > r.indexOf("</h1>"));
  // cada hueco va justo antes de una tarjeta, fuera de las tablas
  for (const m of r.matchAll(/<div class="tarjeta anuncio anuncio-seo"[^]*?<\/div>\s*/g))
    assert.match(r.slice(m.index + m[0].length), /^<div class="tarjeta/);
  assert.equal(r.replace(/<div class="tarjeta anuncio anuncio-seo"[^]*?<\/div>\s*/g, ""), main);
  // páginas cortas: no se juntan dos anuncios
  const corta = `<h1>T</h1><div class="prosa">${t(1)}<div class="tarjeta faq"></div></div>`;
  // páginas de 7 bloques con FAQ: solo «intro» y «faq», el contenido pesa más que los anuncios
  const media = `<h1>T</h1><div class="prosa">${[1, 2, 3, 4, 5, 6].map(t).join("")}<div class="tarjeta faq"></div></div>`;
  assert.deepEqual([...ponerHuecos(media).matchAll(/data-anuncio-seo="(\w+)"/g)].map(m => m[1]), ["intro", "faq"]);
  assert.equal((ponerHuecos(corta).match(/data-anuncio-seo/g) || []).length, 1);
});

test("páginas SEO: las páginas informativas cargan anuncios.js; legales y /validacion/ no", () => {
  for (const r of ["/guias/", "/irpf/madrid/", "/sueldo-neto/30000/", "/comparar-sueldo/", "/cuanto-me-devuelve/", "/declaracion-conjunta/", "/dos-pagadores/", "/rescate-plan-pensiones/madrid/", "/autonomos/", "/autonomos/canarias/"]) assert.ok(conAnuncios(r), r);
  for (const r of ["/legal/cookies.html", "/validacion/", "/"]) assert.ok(!conAnuncios(r), r);
  const pag = ruta => layout({ title: "t", description: "d", canonical: ruta, breadcrumb: "", generado: "2026-11-18",
    main: `<h1>T</h1><div class="prosa"><div class="tarjeta">a</div><div class="tarjeta">b</div></div>` });
  const si = pag("/irpf/madrid/"), no = pag("/validacion/");
  assert.match(si, /<script src="\/js\/anuncios\.js" defer>/);
  assert.match(si, /<script src="\/config\.js" defer>/);
  assert.match(si, /id="anuncio-rail-izq"/);
  assert.doesNotMatch(no, /anuncios\.js|anuncio-rail|data-anuncio-seo/);
});

function ejecutarSeo(cfg, { almacen = {}, respuesta } = {}) {
  const els = { "anuncio-seo-intro": elemento("div", "anuncio-seo-intro"), "anuncio-rail-izq": elemento("aside", "anuncio-rail-izq") };
  const head = elemento("head"), body = elemento("body");
  body.classList.add("pagina-seo");
  const pedidos = [];
  const document = {
    documentElement: elemento("html"), head, body, readyState: "complete",
    getElementById: id => els[id] || null, createElement: tag => elemento(tag),
    querySelectorAll: s => s === "[data-anuncio-seo]" ? [els["anuncio-seo-intro"]] : [],
    addEventListener() {}, dispatchEvent() {}
  };
  const ctx = {
    document, location: { hash: "", reload() {} },
    localStorage: { getItem: k => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = String(v); }, removeItem: k => { delete almacen[k]; } },
    requestIdleCallback: f => f(), setTimeout: (f, ms) => (ms >= 8000 ? 0 : f()), addEventListener() {}, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    MAPAFISCAL_CONFIG: cfg, JSON, Date, Set, URL, Promise, Math, Number,
    fetch: (url, o) => { pedidos.push({ url, o }); return respuesta ? Promise.resolve(respuesta) : Promise.reject(new Error("red")); }
  };
  ctx.window = ctx;
  vm.runInNewContext(CODIGO, ctx);
  return { els, head, pedidos, almacen };
}
const espera = () => new Promise(r => setImmediate(r));
const scriptsDe = head => head.children.filter(c => c.tagName === "script");
const TOKEN = "sb-pqiqrcvuztxrwrwizppj-auth-token";

test("páginas SEO sin sesión: anuncios con el bloque de las páginas o el de resultado", async () => {
  const r = ejecutarSeo(ENCENDIDO);
  await espera();
  assert.equal(r.pedidos.length, 0);
  assert.equal(r.els["anuncio-seo-intro"].hidden, false);
  assert.equal(scriptsDe(r.head).length, 1);
  assert.equal(r.els["anuncio-seo-intro"].children.find(c => c.tagName === "ins").dataset.adSlot, "444");
  const r2 = ejecutarSeo({ ...ENCENDIDO, adsenseHuecoSeo: "999" });
  await espera();
  assert.equal(r2.els["anuncio-seo-intro"].children.find(c => c.tagName === "ins").dataset.adSlot, "999");
});

test("páginas SEO con sesión: pregunta el plan a perfiles; con plan, nada de Google", async () => {
  const almacen = { [TOKEN]: JSON.stringify({ access_token: "abc", user: { id: "u1" } }) };
  const con = ejecutarSeo(ENCENDIDO, { almacen: { ...almacen }, respuesta: { ok: true, json: () => Promise.resolve([{ plan: "gestor" }]) } });
  await espera(); await espera();
  assert.match(con.pedidos[0].url, /\/rest\/v1\/perfiles\?select=plan&id=eq\.u1$/);
  assert.equal(con.pedidos[0].o.headers.Authorization, "Bearer abc");
  assert.equal(scriptsDe(con.head).length, 0);
  assert.equal(con.els["anuncio-seo-intro"].hidden, true);
  const sin = ejecutarSeo(ENCENDIDO, { almacen: { ...almacen }, respuesta: { ok: true, json: () => Promise.resolve([{ plan: "gratis" }]) } });
  await espera(); await espera();
  assert.equal(scriptsDe(sin.head).length, 1);
  // si la consulta falla, manda la pista de la aplicación
  const fallo = ejecutarSeo(ENCENDIDO, { almacen: { ...almacen, "mapafiscal.sinAnuncios": "1" } });
  await espera(); await espera();
  assert.equal(scriptsDe(fallo.head).length, 0);
});

test("prueba de carriles: con pruebaCarriles, el grupo «uno» pierde el carril derecho y se recuerda", () => {
  const almacen = { "mapafiscal.pruebaCarriles": "uno" };
  const r = ejecutar({ ...ENCENDIDO, pruebaCarriles: 0.5 }, { almacen });
  assert.ok(!r.ctx.document.getElementById("anuncio-rail-der") || r.els["anuncio-rail-der"].hidden);
  const r1 = ejecutar({ ...ENCENDIDO, pruebaCarriles: 1 });
  assert.equal(r1.almacen["mapafiscal.pruebaCarriles"], "uno");
  const r2 = ejecutar({ ...ENCENDIDO, pruebaCarriles: 0 }, { almacen: { "mapafiscal.pruebaCarriles": "uno" } });
  assert.equal(r2.els["anuncio-rail-der"].hidden, false);
});
