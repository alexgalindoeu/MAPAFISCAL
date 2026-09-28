// Coherencia estructural de web/datos/params.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { P } from "./ayuda.mjs";

const REGIMENES = new Set(["comun", "foral_pais_vasco", "foral_navarra"]);
const ESTADOS = new Set(["confirmado", "provisional", "cargado", "pendiente"]);

function comprobarEscala(escala, nombre) {
  assert.ok(Array.isArray(escala) && escala.length > 0, `${nombre}: escala vacía`);
  let anterior = 0;
  escala.forEach((tramo, i) => {
    assert.ok(tramo.tipo > 0 && tramo.tipo < 0.6, `${nombre}: tipo fuera de rango en el tramo ${i + 1}`);
    if (i === escala.length - 1) {
      assert.equal(tramo.hasta, null, `${nombre}: el último tramo debe ser abierto (hasta: null)`);
    } else {
      assert.ok(tramo.hasta > anterior, `${nombre}: límites no crecientes en el tramo ${i + 1}`);
      anterior = tramo.hasta;
    }
  });
  for (let i = 1; i < escala.length; i++) {
    assert.ok(escala[i].tipo >= escala[i - 1].tipo, `${nombre}: tipos no progresivos en el tramo ${i + 1}`);
  }
}

test("ejercicio y fecha de generación", () => {
  assert.equal(P.ejercicio, 2025);
  assert.match(P.generado, /^\d{4}-\d{2}-\d{2}$/);
});

test("escalas estatales y forales", () => {
  comprobarEscala(P.estatal.escala_general_estatal, "general estatal");
  comprobarEscala(P.estatal.escala_ahorro_estatal, "ahorro estatal");
  comprobarEscala(P.estatal.escala_ahorro_autonomica, "ahorro autonómica");
  comprobarEscala(P.foral_pv.escala_general_foral, "general País Vasco");
  comprobarEscala(P.foral_pv.escala_ahorro_foral, "ahorro País Vasco");
  comprobarEscala(P.navarra.escala_general_foral, "general Navarra");
  comprobarEscala(P.navarra.escala_ahorro_foral, "ahorro Navarra");
});

test("19 territorios con régimen válido y escala autonómica en régimen común", () => {
  const territorios = Object.entries(P.territorios);
  assert.equal(territorios.length, 19);
  for (const [codigo, t] of territorios) {
    assert.match(codigo, /^ES-/);
    assert.ok(t.nombre, `${codigo}: sin nombre`);
    assert.ok(REGIMENES.has(t.regimen), `${codigo}: régimen ${t.regimen}`);
    if (t.regimen === "comun") comprobarEscala(t.escala_general_autonomica, t.nombre);
  }
});

test("cada parámetro con estado declara uno válido", () => {
  const recorrer = (x, ruta) => {
    if (Array.isArray(x)) return x.forEach((v, i) => recorrer(v, `${ruta}[${i}]`));
    if (x && typeof x === "object") {
      if ("estado" in x) assert.ok(ESTADOS.has(x.estado), `${ruta}: estado "${x.estado}"`);
      for (const [k, v] of Object.entries(x)) recorrer(v, `${ruta}.${k}`);
    }
  };
  recorrer(P, "params");
});

test("deducciones autonómicas: identificadores únicos por territorio", () => {
  for (const [codigo, t] of Object.entries(P.territorios)) {
    const lista = (t.deducciones_autonomicas && t.deducciones_autonomicas.lista) || [];
    const ids = lista.map(d => d.id);
    assert.equal(new Set(ids).size, ids.length, `${codigo}: ids repetidos`);
  }
});

test("ejercicios: el por defecto es params.json y los demás, params_<año>.json con la misma estructura", () => {
  assert.equal(P.ejercicios.por_defecto, P.ejercicio);
  assert.ok(P.ejercicios.publicados.includes(P.ejercicio));
  const dir = new URL("../web/datos/", import.meta.url);
  for (const f of readdirSync(dir).filter(n => /^params_\d{4}\.json$/.test(n))) {
    const Q = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    assert.equal(f, `params_${Q.ejercicio}.json`);
    assert.notEqual(Q.ejercicio, P.ejercicio);
    assert.deepEqual(Q.ejercicios, P.ejercicios, `${f}: bloque «ejercicios» distinto`);
    assert.deepEqual(Object.keys(Q).sort(), Object.keys(P).sort(), `${f}: claves de primer nivel`);
    assert.deepEqual(Object.keys(Q.estatal).sort(), Object.keys(P.estatal).sort(), `${f}: bloques estatales`);
    assert.deepEqual(Object.keys(Q.territorios).sort(), Object.keys(P.territorios).sort(), `${f}: territorios`);
    comprobarEscala(Q.estatal.escala_general_estatal, `${f} general estatal`);
    comprobarEscala(Q.foral_pv.escala_general_foral, `${f} general País Vasco`);
    comprobarEscala(Q.foral_pv.escala_ahorro_foral, `${f} ahorro País Vasco`);
    comprobarEscala(Q.navarra.escala_general_foral, `${f} general Navarra`);
  }
});
