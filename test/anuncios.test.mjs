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
  "anuncio-col-pagadores": ["dos-pagadores", "adsenseHuecoColPagadores"], "anuncio-col-bruto": ["bruto-necesario", "adsenseHuecoColBruto"] };
const HUECOS = ["anuncio-rail-izq", "anuncio-rail-der", "anuncio-calc-medio", "anuncio-calc", "anuncio-comparar", ...Object.keys(LATERALES)];
const SLOTS = { adsenseHuecoRailIzq: "111", adsenseHuecoRailDer: "222", adsenseHuecoMovil: "333", adsenseHuecoCalc: "444", adsenseHuecoComparar: "555" };

function configReal() {
  const window = {};
  new Function("window", leer("config.js"))(window);
  return window.MAPAFISCAL_CONFIG;
}

function clases() {
  const s = new Set();
  return { has: c => s.has(c), add: c => s.add(c), remove: c => s.delete(c), toggle: (c, si) => (si ? s.add(c) : s.delete(c), si) };
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
    dispatch: (t, detail) => (oyentes[t] || []).forEach(f => f({ detail }))
  };
  const ctx = {
    document, location: { hash: "#calculadora", reload() {} },
    localStorage: { getItem: k => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = String(v); }, removeItem: k => { delete almacen[k]; } },
    requestIdleCallback: f => f(), setTimeout: f => f(),
    IntersectionObserver: class { constructor(cb) { this.cb = cb; } observe(el) { observados.push({ el, io: this }); } unobserve() {} },
    MAPAFISCAL_CONFIG: cfg, MAPAFISCAL_CUENTA: cuenta, JSON, Date, Set,
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
  assert.equal(r.scripts().length, 0, "nada de Google antes de que un hueco vaya a verse");
  r.verTodo();
  assert.equal(r.scripts().length, 1);
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
  assert.equal(r.scripts().length, 0, "sin cuenta conocida no se pide ningún anuncio");
  r.document.dispatch("mapafiscal:cuenta", { cargada: true, conPlan: true });
  r.verTodo();
  assert.equal(r.scripts().length, 0);
  for (const id of HUECOS) assert.equal(r.els[id].hidden, true, id);
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
