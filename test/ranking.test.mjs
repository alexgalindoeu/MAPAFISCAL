// Ranking anual para la prensa (/ranking-irpf-comunidades/, tools/seo_ranking.mjs): las cifras
// de la página y de los datos descargables salen de web/datos/seo_comparativas.json (motor R).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generar } from "../tools/generar_paginas_seo.mjs";
import { datosRanking, conclusiones, RUTA_RANKING, ficheroDatos } from "../tools/seo_ranking.mjs";
import { eurosExactos } from "../tools/seo_comun.mjs";

const leer = f => JSON.parse(readFileSync(new URL("../web/datos/" + f, import.meta.url), "utf8"));
const C = leer("seo_comparativas.json"), T = leer("seo_territorios.json");
const { ficheros, urls } = generar();
const html = ficheros.get("ranking-irpf-comunidades/index.html");
const ej = C.ejercicio;
const d = datosRanking(C, T);
const puestoEsperado = (lista, f) => 1 + lista.filter(x => x.cuota_liquida_total < f.cuota_liquida_total - 0.005).length;

test("la página existe, con su título, en el sitemap y en llms.txt", () => {
  assert.ok(html, "no se genera la página");
  assert.deepEqual(C.salarios_ranking, [20000, 30000, 50000, 80000]);
  assert.match(html, new RegExp(`<title>Ranking IRPF por comunidades ${ej}: dónde se paga menos`));
  assert.ok(urls.includes(RUTA_RANKING));
  assert.match(ficheros.get("sitemap.xml"), /<loc>https:\/\/mapafiscal\.es\/ranking-irpf-comunidades\/<\/loc>/);
  assert.match(ficheros.get("llms.txt"), /\/ranking-irpf-comunidades\//);
  assert.match(ficheros.get("llms.txt"), new RegExp(`/datos/ranking-irpf-${ej}\\.csv`));
});

test("tabla: los 19 territorios con cuota, tipo medio y puesto de seo_comparativas.json", () => {
  const tabla = html.match(/<table class="cobertura ranking-tabla">[\s\S]*?<\/table>/)[0];
  const filas = tabla.match(/<tbody>([\s\S]*)<\/tbody>/)[1].split("</tr>").filter(Boolean);
  assert.equal(filas.length, 19);
  for (const s of C.salarios_ranking) {
    const lista = C.comparativas[String(s)];
    assert.equal(lista.length, 19, String(s));
    for (const f of lista) {
      const x = d.filas.find(r => r.territorio === f.territorio).por[s];
      assert.equal(x.cuota, f.cuota_liquida_total);
      assert.equal(x.tipo, Math.round(f.cuota_liquida_total / s * 10000) / 10000);
      assert.equal(x.tipoBase, f.tipo_medio_efectivo);
      assert.equal(x.puesto, puestoEsperado(lista, f), `${f.territorio} con ${s}`);
    }
  }
  // cada fila de la página lleva, por sueldo, el puesto, la cuota al céntimo y el tipo medio
  for (const fila of d.filas) {
    const tr = filas.find(h => h.includes(`>${fila.nombre}</a>`));
    assert.ok(tr, fila.nombre);
    const celdas = [...tr.matchAll(/<td class="num">([^<]*)<\/td>/g)].map(m => m[1]);
    assert.deepEqual(celdas, C.salarios_ranking.flatMap(s => {
      const x = fila.por[s];
      return [x.puesto + ".º", eurosExactos(x.cuota), (100 * x.tipo).toFixed(1).replace(".", ",") + " %"];
    }));
  }
});

test("cinco conclusiones con las cifras exactas de la comparativa", () => {
  const cs = conclusiones(d);
  assert.equal(cs.length, 5);
  const lis = [...html.matchAll(/<li data-clave="[^"]+">([^<]+)<\/li>/g)].map(m => m[1]);
  assert.equal(lis.length, 5);
  const c30 = C.comparativas["30000"], min = c30[0].cuota_liquida_total, max = c30.at(-1).cuota_liquida_total;
  const dif = eurosExactos(Math.round((max - min) * 100) / 100);
  const diferencia = cs.find(c => c.clave === "diferencia").texto;
  assert.ok(diferencia.startsWith(`Con 30.000 € brutos hay ${dif} de diferencia`), diferencia);
  assert.ok(diferencia.includes(eurosExactos(min)) && diferencia.includes(eurosExactos(max)) && diferencia.includes(c30.at(-1).nombre));
  for (const s of C.salarios_ranking) {
    const l = C.comparativas[String(s)];
    assert.ok(cs.find(c => c.clave === "brecha").texto.includes(eurosExactos(Math.round((l.at(-1).cuota_liquida_total - l[0].cuota_liquida_total) * 100) / 100)), String(s));
  }
  for (const c of cs) assert.doesNotMatch(c.texto, /undefined|NaN/);
});

test("mapa SVG en el servidor con los 19 territorios, metodología, licencia y sección para periodistas", () => {
  const svg = html.match(/<svg class="mapa-svg ranking-mapa"[\s\S]*?<\/svg>/)[0];
  assert.equal((svg.match(/<path class="terr"/g) || []).length, 19);
  assert.match(svg, /fill="var\(--m-(g[1-3]|0|r[1-3])\)"/);
  assert.match(html, /href="\/metodologia\/"/);
  assert.match(html, /href="\/validacion\/"/);
  assert.match(html, /CC BY 4\.0/);
  assert.match(html, /rel="license noopener"/);
  assert.match(html, /id="periodistas"[\s\S]*Para periodistas[\s\S]*mailto:contacto@mapafiscal\.es/);
});

test("Dataset en JSON-LD con distribution en CSV y JSON", () => {
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const ds = ld.find(o => o["@type"] === "Dataset");
  assert.ok(ds);
  assert.equal(ds.license, "https://creativecommons.org/licenses/by/4.0/");
  assert.deepEqual(ds.distribution.map(x => [x.encodingFormat, x.contentUrl]), [
    ["text/csv", `https://mapafiscal.es/${ficheroDatos(ej, "csv")}`],
    ["application/json", `https://mapafiscal.es/${ficheroDatos(ej, "json")}`]
  ]);
});

test("datos descargables: el CSV y el JSON traen las mismas cifras que seo_comparativas.json", () => {
  const csv = ficheros.get(ficheroDatos(ej, "csv")), json = JSON.parse(ficheros.get(ficheroDatos(ej, "json")));
  assert.ok(csv.startsWith("﻿ejercicio;sueldo_bruto_anual;puesto;codigo;territorio;regimen;cuota_irpf_euros;tipo_medio_sobre_bruto_pct;tipo_medio_sobre_base_imponible_pct\n"));
  const filas = csv.slice(1).trim().split("\n").slice(1).map(l => l.split(";"));
  assert.equal(filas.length, 19 * C.salarios_ranking.length);
  assert.equal(json.datos.length, filas.length);
  assert.match(json.licencia.nombre, /CC BY 4\.0/);
  for (const s of C.salarios_ranking) for (const f of C.comparativas[String(s)]) {
    const l = filas.find(x => x[1] === String(s) && x[3] === f.territorio);
    assert.ok(l, `${f.territorio} ${s}`);
    assert.equal(l[0], String(ej));
    assert.equal(l[4], f.nombre);
    assert.equal(l[6], f.cuota_liquida_total.toFixed(2).replace(".", ","));
    assert.equal(l[7], (Math.round(f.cuota_liquida_total / s * 10000) / 100).toFixed(2).replace(".", ","));
    assert.equal(l[8], (Math.round(f.tipo_medio_efectivo * 10000) / 100).toFixed(2).replace(".", ","));
    assert.equal(+l[2], puestoEsperado(C.comparativas[String(s)], f));
    const j = json.datos.find(x => x.sueldo_bruto_anual === s && x.codigo === f.territorio);
    assert.equal(j.cuota_liquida_total, f.cuota_liquida_total);
    assert.equal(j.tipo_medio_efectivo, f.tipo_medio_efectivo);
    assert.equal(j.tipo_medio_sobre_bruto, Math.round(f.cuota_liquida_total / s * 10000) / 10000);
    assert.ok(j.tipo_medio_sobre_bruto < j.tipo_medio_efectivo || j.tipo_medio_efectivo === 0);
  }
  // los ficheros del repo son los que genera el generador
  assert.equal(readFileSync(new URL("../web/" + ficheroDatos(ej, "csv"), import.meta.url), "utf8"), csv);
});
