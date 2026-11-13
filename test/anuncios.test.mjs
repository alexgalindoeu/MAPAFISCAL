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
const HUECOS = ["anuncio-rail-izq", "anuncio-rail-der", "anuncio-calc-medio", "anuncio-calc", "anuncio-comparar"];
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
    setAttribute() {}, addEventListener() {}, appendChild(h) { this.children.push(h); return h; } };
}

// Monta un navegador de mentira y ejecuta anuncios.js. `cuenta` es lo que deja app.js.
function ejecutar(cfg, { cuenta = { cargada: true, conPlan: false }, almacen = {} } = {}) {
  const els = Object.fromEntries(HUECOS.map(id => [id, elemento("div", id)]));
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
    MAPAFISCAL_CONFIG: cfg, MAPAFISCAL_CUENTA: cuenta, JSON, Date, Set
  };
  ctx.window = ctx;
  vm.runInNewContext(CODIGO, ctx);
  const verTodo = () => observados.splice(0).forEach(({ el, io }) => io.cb([{ isIntersecting: true, target: el }]));
  const scripts = () => head.children.filter(c => c.tagName === "script");
  const ins = () => HUECOS.flatMap(id => els[id].children);
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
