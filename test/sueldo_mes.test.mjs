// «Sueldo al mes» (web/js/sueldo_mes.js, vista #sueldo-mes) y su página /sueldo-mensual/:
// reparto del bruto y del neto anuales (irpfsim.sueldoNeto) entre 12, 14 o 15 pagas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { generar } from "../tools/generar_paginas_seo.mjs";
import { filasSueldoMensual, BRUTOS_MENSUAL } from "../tools/seo_sueldo_mensual.mjs";

const require = createRequire(import.meta.url);
const motor = require("../web/js/irpfsim.js");
const SM = require("../web/js/sueldo_mes.js");
const D = require("../web/datos/seo_sueldo_neto.json");
const P0 = require("../web/datos/params.json");
const P = P0.ejercicio === D.ejercicio ? P0 : require(`../web/datos/params_${D.ejercicio}.json`);
const casi = (a, b, msg, tol = 0.006) => assert.ok(Math.abs(a - b) < tol, `${msg || ""} ${a} ≠ ${b}`);

test("reparto: división simple del bruto y del neto entre las pagas", () => {
  const a = { bruto: 31000, neto: 24000 };
  const r12 = SM.reparto(a, 12), r14 = SM.reparto(a, 14), r15 = SM.reparto(a, 15);
  casi(r12.brutoMes, 31000 / 12); casi(r14.brutoMes, 31000 / 14); casi(r15.brutoMes, 31000 / 15);
  assert.equal(r14.brutoPaga, 2214.29);
  assert.equal(r12.extras, 0); assert.equal(r14.extras, 2); assert.equal(r15.extras, 3);
  assert.equal(r12.netoMesExtra, null);
  casi(r14.netoMesExtra, 2 * 24000 / 14, "mes con extra = mensualidad + extra");
  casi(r15.brutoMesExtra, 2 * 31000 / 15);
  // el neto anual es el mismo; cambia cómo se reparte
  for (const r of [r12, r14, r15]) { assert.equal(r.netoAnual, 24000); casi(r.netoPaga * r.pagas, 24000, "pagas redondeadas al céntimo", 0.01 * r.pagas); }
  casi(12 * r14.netoMes + r14.extras * r14.netoPaga, 24000, "", 0.15);
});

test("reparto con las extras prorrateadas: 12 nóminas iguales", () => {
  const a = { bruto: 28000, neto: 22000 };
  for (const p of [14, 15]) {
    const r = SM.reparto(a, p, true);
    assert.equal(r.prorrateadas, true);
    casi(r.brutoMes, 28000 / 12); casi(r.netoMes, 22000 / 12);
    assert.equal(r.netoMesExtra, null); assert.equal(r.brutoMesExtra, null);
    casi(r.brutoPaga, 28000 / p, "la paga sigue siendo el año entre las pagas");
  }
  // en 12 pagas no hay nada que prorratear
  assert.equal(SM.reparto(a, 12, true).prorrateadas, false);
  // pagas no admitidas: 12
  assert.equal(SM.reparto(a, 13).pagas, 12);
});

test("el neto sale de irpfsim.sueldoNeto, sin lógica fiscal propia", () => {
  for (const [bruto, territorio, edad] of [[31000, "ES-MD", 40], [17000, "ES-AN", 25], [48000, "ES-PV-BI", 40], [60000, "ES-NC", 67]]) {
    const s = motor.sueldoNeto({ bruto, territorio, edad, hijos: [], tipoContrato: "indefinido" }, P);
    const c = SM.calcular(P, { territorio, edad }, bruto, 14);
    assert.equal(c.anual.neto, s.neto); assert.equal(c.anual.irpf, s.irpf); assert.equal(c.anual.cotizaciones, s.cotizaciones);
    casi(c.netoMes, s.neto / 14);
    const cmp = SM.comparativa(P, { territorio, edad }, bruto);
    assert.deepEqual(cmp.filas.map(f => f.pagas), [12, 14, 15]);
    for (const f of cmp.filas) assert.equal(f.netoAnual, s.neto);
  }
  // misma referencia que /sueldo-neto/ (motor R): 30.000 € en Madrid
  assert.equal(SM.anual(P, { territorio: "ES-MD" }, 30000).neto, D.sueldos["30000"].territorios["ES-MD"].neto);
});

test("enlace directo #sueldo-mes?b=31000&p=14&t=ES-MD", () => {
  assert.deepEqual(SM.leerEnlace("#sueldo-mes?b=31000&p=14&t=ES-MD"), { bruto: 31000, pagas: 14, territorio: "ES-MD" });
  assert.deepEqual(SM.leerEnlace("#sueldo-mes?b=48000&p=12&t=ES-PV-BI&e=30&pr=1"), { bruto: 48000, pagas: 12, territorio: "ES-PV-BI", edad: 30, prorrateadas: true });
  assert.deepEqual(SM.leerEnlace("#sueldo-mes?b=abc&p=13&t=madrid&e=5"), {});
  assert.deepEqual(SM.leerEnlace("#sueldo-mes"), {});
  assert.equal(SM.enlace({ bruto: 31000, pagas: 14, territorio: "ES-MD" }), "#sueldo-mes?b=31000&p=14&t=ES-MD");
  const ida = { bruto: 25000, pagas: 15, territorio: "ES-CT", edad: 30, prorrateadas: true };
  assert.deepEqual(SM.leerEnlace(SM.enlace(ida)), ida);
});

test("precio por hora ↔ mensual ↔ anual y jornada parcial (aritmética)", () => {
  assert.equal(SM.brutoAnualDe(31000, "anio"), 31000);
  assert.equal(SM.brutoAnualDe(2000, "mes", { pagas: 14 }), 28000);
  assert.equal(SM.brutoAnualDe(2000, "mes", { pagas: 12 }), 24000);
  assert.equal(SM.brutoAnualDe(15, "hora"), 15 * 40 * 52);
  assert.equal(SM.brutoAnualDe(15, "hora", { horas: 37.5 }), 29250);
  assert.equal(SM.jornadaParcial(30000, 60), 18000);
  assert.equal(SM.jornadaParcial(30000), 30000);
  const e = SM.equivalencias(31200, { pagas: 12 });
  assert.equal(e.mensual, 2600); assert.equal(e.hora, 15); assert.equal(e.horasSemana, 40);
  // con jornada parcial el precio por hora no cambia: menos bruto, menos horas
  const p = SM.equivalencias(SM.jornadaParcial(31200, 60), { pagas: 12, jornada: 60 });
  assert.equal(p.hora, 15); assert.equal(p.horasSemana, 24); assert.equal(p.mensual, 1560);
  // «neto con una jornada del 60 %»: el bruto prorrateado va tal cual al motor
  const s = motor.sueldoNeto({ bruto: 18000, territorio: "ES-MD", edad: 40, hijos: [], tipoContrato: "indefinido" }, P);
  assert.equal(SM.anual(P, { territorio: "ES-MD" }, SM.jornadaParcial(30000, 60)).neto, s.neto);
  assert.deepEqual(SM.leerEnlace("#sueldo-mes?b=15.5&u=hora&h=37.5&j=60&p=14"), { bruto: 15.5, unidad: "hora", horas: 37.5, jornada: 60, pagas: 14 });
  assert.equal(SM.enlace({ bruto: 15.5, pagas: 12, unidad: "hora", horas: 37.5, jornada: 60 }), "#sueldo-mes?b=15.5&p=12&u=hora&h=37.5&j=60");
});

test("/sueldo-mensual/: una sola página nueva con la tabla, FAQ y enlaces a la herramienta", () => {
  const { ficheros, urls } = generar();
  const h = ficheros.get("sueldo-mensual/index.html");
  assert.ok(h);
  assert.equal(urls.filter(u => u.startsWith("/sueldo-mensual")).length, 1, "ninguna página por importe");
  assert.ok(ficheros.get("sitemap.xml").includes("<loc>https://mapafiscal.es/sueldo-mensual/</loc>"));
  const t = h.match(/<title>([^<]*)<\/title>/)[1];
  assert.ok(t.length <= 65, t);
  assert.match(h, /"@type":"FAQPage"/);
  assert.match(h, /¿Cuánto es 30\.000 € brutos entre 12\?/);
  assert.match(h, /El neto anual es el mismo; cambia cómo se reparte/);
  // 46 filas de 15.000 a 60.000 €, cada una enlazada a la herramienta prellenada
  assert.equal(BRUTOS_MENSUAL.length, 46);
  assert.equal(BRUTOS_MENSUAL[0], 15000); assert.equal(BRUTOS_MENSUAL.at(-1), 60000);
  for (const b of BRUTOS_MENSUAL) assert.ok(h.includes(`href="/index.html#sueldo-mes?b=${b}&p=14&t=ES-MD"`), String(b));
  assert.match(h, /<td class="num"><a href="\/index.html#sueldo-mes\?b=30000&p=12&t=ES-MD">2\.500 €<\/a><\/td>/);
  assert.match(h, /2\.142,86 €/);
  // cifras del motor: Madrid y la media de los 19
  const f = filasSueldoMensual(P, [30000])[0];
  const media = Object.keys(D.sueldos["30000"].territorios).reduce((s, c) => s + D.sueldos["30000"].territorios[c].neto, 0) / 19;
  casi(f.md12, D.sueldos["30000"].territorios["ES-MD"].neto / 12);
  casi(f.media14, media / 14, "media de los 19");
  assert.match(ficheros.get("sueldo-neto/index.html"), /href="\/sueldo-mensual\/"/, "enlace desde /sueldo-neto/");
});

test("la vista #sueldo-mes se pinta, está registrada y lee el enlace", async () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  assert.match(html, /<script src="js\/sueldo_mes\.js"><\/script>/);
  assert.ok(html.indexOf('id="v-sueldo-mes"') > html.indexOf("<!--CUERPO-->") && html.indexOf('id="v-sueldo-mes"') < html.indexOf("<!--/CUERPO-->"));
  assert.match(readFileSync(new URL("../web/js/ui.js", import.meta.url), "utf8"), /href: "#sueldo-mes"/);
  assert.match(readFileSync(new URL("../tools/empaquetar.mjs", import.meta.url), "utf8"), /js\/sueldo_mes\.js/);
  const els = {};
  const valor = id => { const m = html.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`)) || html.match(new RegExp(`<select id="${id}"><option value="([^"]*)"`)); return m ? m[1] : ""; };
  const el = id => els[id] || (els[id] = { id, value: valor(id), textContent: "", hidden: false, checked: false, disabled: false, dataset: {}, _h: "",
    get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; }, addEventListener() {} });
  el("v-sueldo-mes").hidden = false;
  const radios = [12, 14, 15].map(v => ({ value: String(v), checked: v === 14 }));
  const document = { getElementById: id => html.includes(`id="${id}"`) ? el(id) : null,
    querySelectorAll: s => s.includes("sm-pagas") ? radios : [], querySelector: s => s.includes("sm-pagas") && s.includes(":checked") ? radios.find(r => r.checked) || null : null,
    addEventListener() {}, dispatchEvent() {} };
  const location = { hash: "#sueldo-mes?b=31000&p=12&t=ES-AN&j=60" };
  const ctx = { document, location, console, setTimeout, clearTimeout, Date, history: { replaceState: (a, b, h) => { location.hash = h; } },
    CustomEvent: class { constructor(t) { this.type = t; } }, addEventListener() {},
    fetch: async url => ({ ok: true, text: async () => readFileSync(new URL("../web/" + url, import.meta.url), "utf8") }) };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../web/js/irpfsim.js", import.meta.url), "utf8"), ctx);
  vm.runInContext(readFileSync(new URL("../web/js/sueldo_mes.js", import.meta.url), "utf8"), ctx);
  await new Promise(r => setTimeout(r, 100));
  assert.ok(ctx.MAPAFISCAL_HERRAMIENTAS["sueldo-mes"], "tarjeta de portada");
  assert.equal(ctx.MAPAFISCAL_HERRAMIENTAS["sueldo-mes"].icono, "nomina");
  assert.equal(els["sm-territorio"].value, "ES-AN");
  assert.equal(els["sm-bruto"].value, "31000");
  assert.equal(radios.find(r => r.checked).value, "12");
  // jornada del 60 %: 18.600 € brutos al año, que son los que van al motor
  assert.match(els["sm-principal"].innerHTML, /18\.600,00 € brutos al año en 12 pagas/);
  assert.match(els["sm-principal"].innerHTML, /1\.550,00 € brutos al mes/);
  assert.match(els["sm-principal"].innerHTML, /jornada del 60 %/);
  const neto = motor.sueldoNeto({ bruto: 18600, territorio: "ES-AN", edad: 40, hijos: [], tipoContrato: "indefinido" }, P);
  assert.ok(els["sm-principal"].innerHTML.includes("Neto al año</dt><dd>" + neto.neto.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €"), "neto del motor");
  assert.match(els["sm-principal"].innerHTML, /El neto anual es el mismo; cambia cómo se reparte/);
  assert.equal((els["sm-tabla"].innerHTML.match(/<th scope="col"/g) || []).length, 3);
  assert.equal(location.hash, "#sueldo-mes?b=31000&p=12&t=ES-AN&j=60");
});
