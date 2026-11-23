// Exportar CSV (web/js/csv.js) y curva del plan de pensiones (curvaPlan de web/js/herramientas.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const CSV = require("../web/js/csv.js");
const ESC = require("../web/js/escenarios.js");
const HERR = require("../web/js/herramientas.js");
const P = JSON.parse(readFileSync(new URL("../web/datos/params.json", import.meta.url), "utf8"));

test("CSV para Excel en español: BOM, «;», coma decimal y comillas solo donde hacen falta", () => {
  const t = CSV.aCsv([["Territorio", "Cuota (€)", "Nota"], ["Araba/Álava", CSV.numero(1426.47, 2), "con; punto y coma"], ["Madrid", 0.1 + 0.2, 'dice "hola"'], ["x", -0.001, null]]);
  assert.ok(t.startsWith("﻿"), "falta el BOM");
  assert.equal(t, '﻿Territorio;Cuota (€);Nota\nAraba/Álava;1426,47;"con; punto y coma"\nMadrid;0,3;"dice ""hola"""\nx;-0,001;\n');
  assert.equal(CSV.numero(1426.4, 2), "1426,40");
  assert.equal(CSV.numero(-0.001, 2), "0,00");
  assert.equal(CSV.numero(24031.44), "24031,44");
  assert.equal(CSV.numero(NaN), "");
  assert.equal(CSV.nombreFichero("Comparar Álava 2025.csv"), "comparar-alava-2025.csv");
});

test("curvas del deslizador: una fila por sueldo y cuota y tipo medio de cada territorio", () => {
  const puntos = [15000, 30000].map(s => ({ s, d: ESC.porTerritorio(P, ESC.hogarTipo(P, "ES-MD", s)) }));
  const filas = ESC.filasCurvas(puntos, P, CSV.numero);
  const ts = Object.keys(P.territorios);
  assert.equal(filas.length, 3);
  assert.equal(filas[0].length, 1 + 2 * ts.length);
  assert.equal(filas[0][0], "Sueldo bruto anual (€)");
  const i = filas[0].indexOf(`${P.territorios["ES-CT"].nombre}: cuota IRPF (€)`);
  assert.ok(i > 0);
  assert.equal(filas[2][0], 30000);
  assert.equal(filas[2][i], CSV.numero(puntos[1].d["ES-CT"].cuota, 2));
  assert.equal(filas[2][i + 1], CSV.numero(100 * puntos[1].d["ES-CT"].tipo, 2));
  const texto = CSV.aCsv(filas);
  assert.equal(texto.split("\n").length, 4);
  assert.match(texto.split("\n")[2], /^30000;\d+,\d\d;\d+,\d\d;/);
});

test("curva del plan de pensiones: de 0 al límite, ahorro creciente, euro marginal y agotamiento", () => {
  const base = { territorio: "ES-MD", edad: 45, hijos: [], aportacion: 1500, contribucionEmpresa: 0 };
  // 40.000 € en Madrid: el ahorro no se agota y el primer tramo es más corto que el límite.
  const c = HERR.curvaPlan(P, Object.assign({ bruto: 40000 }, base));
  assert.equal(c.puntos[0].aportacion, 0);
  assert.equal(c.puntos[0].ahorro, 0);
  assert.equal(c.puntos.at(-1).aportacion, c.limite);
  for (let i = 1; i < c.puntos.length; i++) assert.ok(c.puntos[i].ahorro >= c.puntos[i - 1].ahorro - 0.005, "el ahorro no puede bajar");
  const r = HERR.plan(P, Object.assign({ bruto: 40000 }, base, { aportacion: c.limite }));
  assert.equal(c.ahorroMax, r.ahorroMax);
  assert.equal(c.agota, null);
  assert.ok(c.marginal.tipo > 0 && c.marginal.hasta > 0 && c.marginal.hasta <= c.limite);
  // hasta `hasta` cada euro ahorra el mismo tipo (±0,5 €), y algo después ya ahorra menos
  const ahorro = a => HERR.plan(P, Object.assign({ bruto: 40000 }, base, { aportacion: a })).ahorro;
  assert.ok(Math.abs(ahorro(c.marginal.hasta) - c.marginal.tipo * c.marginal.hasta) <= 1);
  if (!c.marginal.todo) assert.ok(ahorro(c.limite) < c.marginal.tipo * c.limite - 0.5);

  // 17.400 € en Madrid: la cuota llega a cero antes del límite y el ahorro se agota.
  const b = HERR.curvaPlan(P, Object.assign({ bruto: 17400 }, base));
  assert.ok(b.agota != null && b.agota < b.limite, JSON.stringify(b.agota));
  assert.equal(ahorroDe(b, b.limite), b.ahorroMax);
  assert.ok(HERR.plan(P, Object.assign({ bruto: 17400 }, base, { aportacion: b.agota })).ahorro >= b.ahorroMax - 0.5);

  // Sin IRPF que reducir: curva plana y sin marginal.
  const z = HERR.curvaPlan(P, Object.assign({ bruto: 15000 }, base));
  assert.equal(z.ahorroMax, 0);
  assert.equal(z.marginal, null);
});
const ahorroDe = (c, a) => c.puntos.find(p => p.aportacion === a).ahorro;
