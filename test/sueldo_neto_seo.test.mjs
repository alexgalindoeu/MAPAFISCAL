// Páginas /sueldo-neto/: los datos de web/datos/seo_sueldo_neto.json (motor R) coinciden
// al céntimo con irpfsim.sueldoNeto, y las páginas tienen lo que piden (neto, FAQ, enlaces).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { generar } from "../tools/generar_paginas_seo.mjs";

const require = createRequire(import.meta.url);
const motor = require("../web/js/irpfsim.js");
const D = require("../web/datos/seo_sueldo_neto.json");
const P0 = require("../web/datos/params.json");
const P = P0.ejercicio === D.ejercicio ? P0 : require(`../web/datos/params_${D.ejercicio}.json`);
const { ficheros, urls } = generar();

test("seo_sueldo_neto.json coincide con irpfsim.sueldoNeto (R ↔ JS)", () => {
  const muestras = [[15000, "ES-AN"], [30000, "ES-MD"], [45000, "ES-PV-BI"], [100000, "ES-NC"], [25200, "ES-CT"]];
  for (const [bruto, territorio] of muestras) {
    const js = motor.sueldoNeto({ bruto, territorio, edad: D.supuesto.edad, hijos: [], tipoContrato: "indefinido" }, P);
    const r = D.sueldos[String(bruto)];
    assert.ok(Math.abs(js.neto - r.territorios[territorio].neto) < 0.01, `${bruto} ${territorio}: ${js.neto} ≠ ${r.territorios[territorio].neto}`);
    assert.ok(Math.abs(js.irpf - r.territorios[territorio].irpf) < 0.01, `${bruto} ${territorio}: IRPF`);
    assert.ok(Math.abs(js.cotizaciones - r.ss.total) < 0.01, `${bruto}: Seguridad Social`);
  }
  // referencia de test/herramientas.test.mjs
  assert.equal(D.sueldos["30000"].territorios["ES-MD"].neto, 23451.98);
});

test("páginas nacionales, mensuales y por territorio, en el sitemap", () => {
  const sn = urls.filter(u => u.startsWith("/sueldo-neto/"));
  assert.equal(sn.length, 1 + D.mensuales.length + Object.keys(D.sueldos).length + 19 * D.importes_territorio.length);
  assert.ok(sn.length <= 560);
  const mapa = ficheros.get("sitemap.xml");
  for (const u of ["/sueldo-neto/", "/sueldo-neto/30000/", "/sueldo-neto/30000/bizkaia/", "/sueldo-neto/mensual/1800/"])
    assert.ok(mapa.includes(`https://mapafiscal.es${u}</loc>`), u);
  assert.match(ficheros.get("comparar-sueldo/index.html"), /href="\/sueldo-neto\/"/);
  assert.match(ficheros.get("irpf/index.html"), /href="\/sueldo-neto\/">Sueldo neto/, "enlace en el pie");
});

test("la página de un territorio trae neto, desglose, comparación, vecinos y FAQ", () => {
  const h = ficheros.get("sueldo-neto/30000/madrid/index.html");
  assert.match(h, /23\.452 €/);
  assert.match(h, /1\.954 €/, "neto al mes en 12 pagas");
  assert.match(h, /1\.675 €/, "neto al mes en 14 pagas");
  assert.match(h, /Seguridad Social[\s\S]*1\.950 €/);
  assert.match(h, /"@type":"FAQPage"/);
  assert.match(h, /href="\/sueldo-neto\/28000\/madrid\/"/);
  assert.match(h, /href="\/sueldo-neto\/30000\/navarra\/"/);
  assert.match(h, /href="\/index\.html#sueldo-neto"/);
  assert.match(h, /contrato indefinido/);
  assert.match(h, /2026/);
  const m = ficheros.get("sueldo-neto/mensual/1800/index.html");
  assert.match(m, /12 pagas/); assert.match(m, /14 pagas/);
  assert.match(m, /href="\/sueldo-neto\/25200\/"/);
});

// ---- bloques propios de cada página por territorio (d.detalle) ---------------------------
const C = require("../web/js/conjunta.js");
const irpfDe = liq => liq.cuotaResultanteAutoliquidacion - ((liq.deduccionesCuotaDiferencial && liq.deduccionesCuotaDiferencial.total) || 0);

test("detalle: hijos, cónyuge a cargo y 1.000 € más coinciden con el motor JS (R ↔ JS)", () => {
  const [e1, e2] = D.detalle.edades_hijos;
  for (const [bruto, t] of [[30000, "ES-MD"], [22000, "ES-GA"], [45000, "ES-PV-SS"], [60000, "ES-NC"], [18000, "ES-CN"]]) {
    const x = D.detalle.territorios[String(bruto)][t];
    const neto = hijos => motor.sueldoNeto({ bruto, territorio: t, edad: D.supuesto.edad, hijos, tipoContrato: "indefinido" }, P);
    assert.ok(Math.abs(neto([e1]).neto - x.hijo1.neto) < 0.01, `${bruto} ${t}: un hijo`);
    assert.ok(Math.abs(neto([e1, e2]).neto - x.hijos2.neto) < 0.01, `${bruto} ${t}: dos hijos`);
    const mas = motor.sueldoNeto({ bruto: bruto + 1000, territorio: t, edad: D.supuesto.edad, hijos: [], tipoContrato: "indefinido" }, P);
    assert.ok(Math.abs(mas.neto - x.mas_1000.neto) < 0.01, `${bruto} ${t}: 1.000 € más`);
    for (const [k, hijos] of [["pareja", []], ["pareja_hijos2", [e1, e2]]]) {
      const h = C.conjunta(P, { territorio: t, tipo: "matrimonio", a: { bruto, edad: D.supuesto.edad }, b: { bruto: 0, edad: D.supuesto.edad }, hijos: hijos.slice() }).hogar;
      const liq = motor.liquidar(h, P, "auto");
      assert.ok(Math.abs(irpfDe(liq) - x[k].irpf) < 0.01, `${bruto} ${t}: ${k} ${irpfDe(liq)} ≠ ${x[k].irpf}`);
      assert.equal(liq.modoTributacionElegido, x[k].modo, `${bruto} ${t}: ${k} modo`);
    }
  }
});

const texto = h => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const bloque = (h, titulo) => { const t = texto(h), i = t.indexOf(titulo); assert.ok(i >= 0, `falta «${titulo}»`); return t.slice(i, i + 700); };

test("dos páginas de la misma familia difieren en los bloques propios", () => {
  const pares = [["30000/madrid", "30000/castilla-la-mancha"], ["30000/madrid", "32000/madrid"], ["22000/galicia", "24000/galicia"], ["60000/bizkaia", "60000/gipuzkoa"]];
  const bloques = ["Lo que dice esta cifra", "con hijos o con pareja a cargo", "Con 1.000 € brutos más al año"];
  for (const [a, b] of pares) {
    const ha = ficheros.get(`sueldo-neto/${a}/index.html`), hb = ficheros.get(`sueldo-neto/${b}/index.html`);
    for (const t of bloques) assert.notEqual(bloque(ha, t), bloque(hb, t), `${a} y ${b} repiten «${t}»`);
  }
  // deducciones autonómicas: cambian con el sueldo (Murcia: con 25.000 € entra, con 60.000 € no)
  const m25 = bloque(ficheros.get("sueldo-neto/25000/murcia/index.html"), "a las que llegas con");
  const m60 = bloque(ficheros.get("sueldo-neto/60000/murcia/index.html"), "a las que llegas con");
  assert.notEqual(m25, m60);
  assert.match(m60, /no entras en ninguna/);
  assert.match(ficheros.get("sueldo-neto/25000/murcia/index.html"), /href="\/irpf\/murcia\/deducciones\/[a-z0-9-]+\/"/);
});

test("vecinos por tierra sacados del mapa, y las islas sin vecinos", async () => {
  const { vecinosGeograficos } = await import("../tools/seo_sueldo_neto.mjs");
  const v = vecinosGeograficos();
  assert.deepEqual([...v["ES-MD"]].sort(), ["ES-CL", "ES-CM"]);
  assert.deepEqual(v["ES-IB"], []); assert.deepEqual(v["ES-CN"], []);
  for (const [a, l] of Object.entries(v)) for (const b of l) assert.ok(v[b].includes(a), `${a}–${b} simétrico`);
  const h = texto(ficheros.get("sueldo-neto/30000/madrid/index.html"));
  assert.match(h, /Castilla y León/); assert.match(h, /Castilla-La Mancha/);
  assert.match(texto(ficheros.get("sueldo-neto/30000/canarias/index.html")), /no limita por tierra/);
});

test("«¿cuánto me devuelve?» y «dos pagadores»: cada página tiene su lectura propia", () => {
  const dev = (s, t) => bloque(ficheros.get(`cuanto-me-devuelve/${s}/${t}/index.html`), "frente a los otros territorios");
  assert.notEqual(dev("hijo", "madrid"), dev("hijo", "castilla-la-mancha"));
  assert.match(dev("hijo", "madrid"), /territorios con los que limita/);
  assert.match(dev("alquiler", "canarias"), /no limita por tierra/);
  assert.match(ficheros.get("cuanto-me-devuelve/hijo/madrid/index.html"), /href="\/sueldo-neto\/35000\/madrid\/"/);
  const dp = i => bloque(ficheros.get(`dos-pagadores/${i}/index.html`), "Lo que dice esta cifra");
  assert.notEqual(dp(24000), dp(26000));
  assert.match(dp(30000), /la declaración saldría a cero/);
});

test("el detalle de 30.000 € en Madrid: familia, 1.000 € más y deducciones con fuente", () => {
  const x = D.detalle.territorios["30000"]["ES-MD"];
  const h = texto(ficheros.get("sueldo-neto/30000/madrid/index.html"));
  const s = D.sueldos["30000"];
  const miles = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const quedan = Math.round(x.mas_1000.neto - s.territorios["ES-MD"].neto);
  assert.ok(h.includes(`el neto sube ${miles(quedan)} €`), "1.000 € más");
  assert.ok(h.includes(`${miles(30000 - Math.round(s.ss.total) - Math.round(x.hijos2.irpf))} €`), "neto con dos hijos");
  assert.match(h, /Por gastos educativos/);
  assert.match(h, /declaración conjunta/);
});
