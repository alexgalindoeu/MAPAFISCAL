// Comparar dos ofertas (web/js/ofertas.js), el mismo sueldo en dos ejercicios
// (web/js/ejercicios.js) y «de cada 100 € más» (web/js/marginal.js): cálculos derivados
// sobre irpfsim.sueldoNeto (el motor no cambia), registro en la aplicación y páginas SEO.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const motor = require("../web/js/irpfsim.js");
const P = require("../web/datos/params.json");
const P25 = require("../web/datos/params_2025.json");
const O = require("../web/js/ofertas.js");
const E = require("../web/js/ejercicios.js");
const M = require("../web/js/marginal.js");
const UI = require("../web/js/ui.js");
const leer = r => readFileSync(new URL("../web/" + r, import.meta.url), "utf8");
const neto = (o, p = P) => motor.sueldoNeto(Object.assign({ edad: 35, hijos: [], tipoContrato: "indefinido" }, o), p);

// ---- ofertas ------------------------------------------------------------------------------
test("ofertas: cifras enteras que cuadran (bruto − SS − IRPF − plan = neto) y coinciden con el motor", () => {
  const A = { bruto: 40000, territorio: "ES-CT", pagas: 14, plan: 0 }, B = { bruto: 39000, territorio: "ES-MD", pagas: 12, plan: 1500 };
  const r = O.compararOfertas(P, A, B);
  for (const [k, o] of [["a", A], ["b", B]]) {
    const x = r[k];
    for (const c of ["bruto", "cotizaciones", "irpf", "plan", "neto", "netoMes", "netoPaga"]) assert.ok(Number.isInteger(x[c]), c);
    assert.equal(x.bruto - x.cotizaciones - x.irpf - x.plan, x.neto);
    const s = neto({ bruto: o.bruto, territorio: o.territorio, aportacionPlan: o.plan });
    assert.ok(Math.abs(x.neto - (s.neto - o.plan)) <= 0.5);
    assert.ok(Math.abs(x.irpf - s.irpf) <= 1);
    assert.equal(x.netoPaga, Math.round(x.neto / o.pagas));
    assert.ok(Math.abs(x.tipoMedio - x.irpf / x.bruto) < 1e-9);
  }
  // el plan baja el IRPF: el ahorro es la misma liquidación sin él
  assert.equal(r.b.ahorroPlan, Math.round(neto({ bruto: 39000, territorio: "ES-MD" }).irpf - neto({ bruto: 39000, territorio: "ES-MD", aportacionPlan: 1500 }).irpf));
  assert.ok(r.b.ahorroPlan > 0);
  assert.equal(r.difAnual, r.a.neto - r.b.neto);
  assert.equal(r.difMes, Math.round(r.difAnual / 12));
});

test("ofertas: la frase dice la diferencia real en neto, aunque el bruto sea menor", () => {
  const r = O.compararOfertas(P, { bruto: 40000, territorio: "ES-CT", pagas: 14, plan: 0 }, { bruto: 39000, territorio: "ES-MD", pagas: 14, plan: 0 });
  assert.equal(r.mejor, r.difAnual > 0 ? "a" : "b");
  const f = O.frase(r);
  assert.match(f, new RegExp(`^La oferta ${r.mejor.toUpperCase()} te deja `));
  if (r.mejor === "b") assert.match(f, /aunque su bruto sea 1\.000 € menor/);
  const igual = O.compararOfertas(P, { bruto: 30000, territorio: "ES-MD", pagas: 14 }, { bruto: 30000, territorio: "ES-MD", pagas: 12 });
  assert.equal(igual.mejor, null);
  assert.equal(O.frase(igual), "Las dos ofertas te dejan el mismo neto.");
  assert.match(O.frase(O.compararOfertas(P, { bruto: 30000, territorio: "ES-MD", pagas: 14 }, { bruto: 30000, territorio: "ES-MD", pagas: 14, plan: 2000 })), /aparta además 2\.000 €/);
});

test("ofertas: el enlace para compartir va y vuelve; lo que no vale se limpia", () => {
  const A = { bruto: 32000, territorio: "ES-MD", pagas: 14, plan: 0 }, B = { bruto: 31000, territorio: "ES-PV-BI", pagas: 12, plan: 1200 };
  const h = O.enlace(A, B);
  assert.equal(h, "#ofertas?a=32000,ES-MD,14&b=31000,ES-PV-BI,12,1200");
  assert.deepEqual(O.leerEnlace(h), { a: A, b: B });
  const l = O.limpiar(P, { bruto: -5, territorio: "XX", pagas: 13, plan: 99999999 }, O.POR_DEFECTO.a);
  assert.equal(l.bruto, 0); assert.equal(l.territorio, O.POR_DEFECTO.a.territorio); assert.equal(l.pagas, 14); assert.equal(l.plan, 0);
});

// ---- ejercicios -------------------------------------------------------------------------
test("ejercicios: el mismo sueldo con params_2025 y params.json, al euro con el motor", () => {
  for (const [t, b] of [["ES-MD", 18000], ["ES-VC", 30000], ["ES-PV-BI", 30000], ["ES-NC", 16000]]) {
    const r = E.compararEjercicios(P25, P, { bruto: b, territorio: t });
    assert.equal(r.anterior, 2025); assert.equal(r.actual, 2026);
    assert.ok(Math.abs(r.a.neto - neto({ bruto: b, territorio: t }, P25).neto) <= 0.5);
    assert.ok(Math.abs(r.b.neto - neto({ bruto: b, territorio: t }, P).neto) <= 0.5);
    assert.equal(r.difNeto, r.b.neto - r.a.neto);
    assert.equal(r.a.bruto - r.a.cotizaciones - r.a.irpf, r.a.neto);
    assert.match(E.frase(r), /^(En 2026 te queda|Con este sueldo)/);
  }
});

test("ejercicios: los conceptos que cambian llevan la cifra de cada año sacada de params", () => {
  const r = E.compararEjercicios(P25, P, { bruto: 18000, territorio: "ES-MD" });
  const smi = r.conceptos.find(c => /SMI/.test(c.titulo));
  const d25 = P25.estatal.deduccion_obtencion_rendimientos_trabajo, d26 = P.estatal.deduccion_obtencion_rendimientos_trabajo;
  assert.ok(smi.cambia);
  assert.equal(smi.filas[0].a, "340 €"); assert.equal(smi.filas[0].b, "590,89 €");
  assert.equal(smi.norma, d26.norma);
  assert.match(smi.nota, /te afecta/);
  assert.ok(d25.importe_maximo !== d26.importe_maximo);
  assert.match(E.compararEjercicios(P25, P, { bruto: 50000, territorio: "ES-MD" }).conceptos.find(c => /SMI/.test(c.titulo)).nota, /no se te aplica/);
  const min = r.conceptos.find(c => /Mínimo del contribuyente \(estatal\)/.test(c.titulo));
  assert.equal(min.cambia, false);
  assert.ok(r.conceptos.some(c => /Escala general estatal/.test(c.titulo)));
  // la escala valenciana cambia en 2026: un tramo por fila
  const vc = E.compararEjercicios(P25, P, { bruto: 30000, territorio: "ES-VC" }).conceptos.find(c => /Escala autonómica/.test(c.titulo));
  assert.ok(vc.cambia);
  assert.equal(vc.filas[0].a, "hasta 12.000 €: 9 %"); assert.equal(vc.filas[0].b, "hasta 12.000 €: 8,8 %");
  const bi = E.compararEjercicios(P25, P, { bruto: 30000, territorio: "ES-PV-BI" }).conceptos.find(c => /Minoración/.test(c.titulo));
  assert.deepEqual([bi.filas[0].a, bi.filas[0].b], ["1.583 €", "1.615 €"]);
  assert.deepEqual(E.leerEnlace(E.enlace({ bruto: 18000, territorio: "ES-MD" })), { bruto: 18000, territorio: "ES-MD" });
});

// ---- marginal ---------------------------------------------------------------------------
test("marginal: cada punto es neto(b + 100) − neto(b) del motor, de 12.000 a 120.000 €", () => {
  const s = M.serie(P, "ES-MD");
  assert.equal(s[0].bruto, 12000); assert.equal(s[s.length - 1].bruto, 120000);
  assert.equal(s.length, (120000 - 12000) / M.RANGO.paso + 1);
  for (const p of [s[0], s[27], s[100], s[s.length - 1]]) {
    const d = Math.round((neto({ bruto: p.bruto + 100, territorio: "ES-MD" }).neto - neto({ bruto: p.bruto, territorio: "ES-MD" }).neto) * 100) / 100;
    assert.equal(p.queda, d);
    assert.ok(Math.abs(p.queda + p.irpf + p.ss - 100) < 0.03);
  }
  for (const p of s) assert.ok(p.queda > 0 && p.queda <= 100, "el neto siempre sube con el bruto");
});

test("marginal: saltos localizados y explicados con los parámetros", () => {
  const hs = M.saltos(P, "ES-MD");
  const a = P.estatal.trabajo_reduccion_art20, ct = P.estatal.cotizaciones_trabajador;
  const finRed = hs.find(h => h.concepto === "reduccion" && h.a === "0");
  assert.ok(finRed, "fin de la reducción por rendimientos del trabajo");
  assert.match(finRed.texto, /Se acaba la reducción por rendimientos del trabajo/);
  assert.ok(finRed.despues > finRed.antes + 10, "al acabarse, te queda más de cada 100 €");
  assert.ok(finRed.detalle.includes("7.302 €") && finRed.detalle.includes("19.747,50 €"));
  assert.equal(finRed.norma, a.norma);
  // el rendimiento neto en ese punto es el umbral final de params (bruto − SS − otros gastos)
  const l = neto({ bruto: finRed.bruto, territorio: "ES-MD" }).liquidacion;
  assert.ok(Math.abs(l.componentesRenta.trabajoPrevio + P.estatal.trabajo_otros_gastos.generico - a.umbral_final) < 200);
  const ss = hs.find(h => h.concepto === "ss");
  assert.ok(Math.abs(ss.bruto - 12 * ct.base_maxima_mensual) <= 10);
  assert.ok(ss.texto.includes("61.214,40 €"));
  assert.ok(hs.find(h => h.concepto === "estatal" && /12\.450 €/.test(h.texto)));
  for (let i = 1; i < hs.length; i++) assert.ok(hs[i - 1].bruto <= hs[i].bruto);
  // forales: la bonificación vasca y la deducción por trabajo de Navarra
  assert.ok(M.saltos(P, "ES-PV-BI").some(h => /bonificación de los rendimientos del trabajo/.test(h.texto)));
  assert.ok(M.saltos(P, "ES-NC").some(h => /deducción por rendimientos del trabajo de Navarra/.test(h.texto)));
});

test("marginal: gráfico SVG con sus marcas y tabla alternativa", () => {
  const s = M.serie(P, "ES-CT"), hs = M.saltos(P, "ES-CT", M.RANGO, s), svg = M.grafico(s, hs);
  assert.match(svg, /^<svg class="mg-svg" viewBox="0 0 680 260" role="img" aria-label="[^"]+"/);
  assert.equal((svg.match(/class="mg-salto"/g) || []).length <= hs.length, true);
  assert.ok(svg.includes(`>${hs.length}<`) || svg.includes(`,${hs.length}<`), "la última marca lleva su número");
  assert.equal(M.filasTabla(s).length, 55);
  assert.equal(M.leerEnlace(M.enlace("ES-PV-SS")), "ES-PV-SS");
});

// ---- registro en la aplicación ---------------------------------------------------------
test("las tres vistas están en index.html, en el empaquetador, en el panel «Todo» y con icono", () => {
  const html = leer("index.html"), emp = readFileSync(new URL("../tools/empaquetar.mjs", import.meta.url), "utf8");
  const cuerpo = html.slice(html.indexOf("<!--CUERPO-->"), html.indexOf("<!--/CUERPO-->"));
  for (const [v, js, ico] of [["ofertas", "ofertas", "ofertas"], ["ejercicios", "ejercicios", "ejercicios"], ["marginal", "marginal", "marginal"]]) {
    assert.match(cuerpo, new RegExp(`<section class="vista" id="v-${v}"`));
    assert.match(html, new RegExp(`<script src="js/${js}\\.js"></script>`));
    assert.ok(emp.includes(`'<script src="js/${js}.js"></script>'`), "empaquetar.mjs");
    assert.ok(UI.ICONOS[ico], "icono " + ico);
    assert.ok(UI.CATALOGO.some(g => g.items.some(it => it.href === "#" + v && it.icono === ico)), "panel «Todo»");
    assert.match(leer(`js/${js}.js`), new RegExp(`icono: "${ico}", href: "#${v}"`), "tarjeta de la portada");
  }
});

// ---- páginas SEO --------------------------------------------------------------------------
test("páginas SEO: título ≤ 65, explicación, ejemplos del motor, FAQ y botón a la herramienta prellenada", async () => {
  const { paginasComparadores, EJEMPLOS_OFERTAS, EJEMPLOS_EJERCICIOS } = await import("../tools/seo_comparadores.mjs");
  const ps = paginasComparadores("2026-11-23");
  assert.deepEqual(ps.map(p => p.ruta), ["/comparar-ofertas/", "/irpf-2025-vs-2026/", "/tipo-marginal-real/"]);
  for (const p of ps) {
    const t = p.html.match(/<title>([^<]*)<\/title>/)[1];
    assert.ok(t.length <= 65, `${p.ruta}: ${t}`);
    assert.equal((p.html.match(/<h1\b/g) || []).length, 1);
    assert.match(p.html, /"@type":"FAQPage"/);
    assert.match(p.html, /class="tarjeta faq"/);
    assert.ok(leer(p.ruta.slice(1) + "index.html").includes(p.html.match(/<title>[^<]*<\/title>/)[0]), "página publicada");
  }
  const [of, ej, mg] = ps;
  assert.ok(of.html.includes(`href="/index.html${O.enlace(EJEMPLOS_OFERTAS[0].a, EJEMPLOS_OFERTAS[0].b).replace("&", "&amp;")}"`));
  const r = O.compararOfertas(P, EJEMPLOS_OFERTAS[0].a, EJEMPLOS_OFERTAS[0].b);
  assert.ok(of.html.includes(O.frase(r).replace(/^La/, "la")) || of.html.includes(O.frase(r)));
  assert.ok(ej.html.includes(`href="/index.html${E.enlace(EJEMPLOS_EJERCICIOS[0]).replace("&", "&amp;")}"`));
  assert.ok(ej.html.includes("590,89 €") && ej.html.includes("340 €"));
  assert.ok(mg.html.includes('href="/index.html#marginal?t=ES-MD"'));
  assert.match(mg.html, /<svg class="mg-svg"/);
  assert.match(mg.html, /Ver los datos del gráfico/);
  assert.match(leer("sitemap.xml"), /\/tipo-marginal-real\//);
});
