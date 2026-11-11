// Validador R ↔ JS sin navegador (para CI).
//   Rscript tools/validar_js.R && node tools/validar_js_node.js
// Misma comparación que tools/validar_js.html: cada caso de tools/casos.json (referencia
// calculada por el motor R) se liquida con web/js/irpfsim.js y debe coincidir a ±0,02 €.
"use strict";
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "..");
const irpfsim = require(path.join(raiz, "web/js/irpfsim.js"));
// parámetros de cada ejercicio: params.json (el por defecto) y params_<año>.json
const PS = {};
for (const f of fs.readdirSync(path.join(raiz, "web/datos")).filter(n => /^params(_\d{4})?\.json$/.test(n))) {
  const P = JSON.parse(fs.readFileSync(path.join(raiz, "web/datos", f), "utf8"));
  PS[P.ejercicio] = P;
}
const CASOS = JSON.parse(fs.readFileSync(path.join(raiz, "tools/casos.json"), "utf8"));
const tol = 0.02;

let nbad = 0;
for (const [id, c] of Object.entries(CASOS)) {
  if (c.neto) {   // cotizaciones del trabajador y sueldo neto (R/15_sueldo_neto.R)
    let s;
    try { s = irpfsim.sueldoNeto(c.js, PS[c.js.ejercicio]); }
    catch (e) { console.log(`ERROR ${id}: ${e.message}`); nbad++; continue; }
    const bad = [["cot", s.cotizaciones, c.ref.cot], ["irpf", s.irpf, c.ref.irpf], ["neto", s.neto, c.ref.neto],
      ["cr", s.liquidacion.cuotaResultanteAutoliquidacion, c.ref.cr], ["modo", s.liquidacion.modoTributacionElegido, c.ref.modo]]
      .filter(([, a, b]) => (typeof b === "number") ? Math.abs(a - b) > tol : a !== b);
    if (bad.length) { nbad++; console.log(`FAIL ${id} :: ` + bad.map(([k, a, b]) => `${k} js=${a} r=${b}`).join(" | ")); }
    else console.log(`ok   ${id}  neto=${s.neto.toFixed(2)}`);
    continue;
  }
  let liq;
  try { liq = irpfsim.liquidar(c.js, PS[c.js.ejercicio], "auto"); }
  catch (e) { console.log(`ERROR ${id}: ${e.message}`); nbad++; continue; }
  const checks = [
    ["blg", liq.baseLiquidableGeneral, c.ref.blg],
    ["bla", liq.baseLiquidableAhorro, c.ref.bla],
    ["min", liq.minimoPersonalFamiliar.total, c.ref.minimo],
    ["minAut", liq.minimoPersonalFamiliarAutonomico ? liq.minimoPersonalFamiliarAutonomico.total : 0, c.ref.minimo_aut],
    ["ciEst", liq.cuotaIntegraEstatal, c.ref.ci_est],
    ["ciAut", liq.cuotaIntegraAutonomica, c.ref.ci_aut],
    ["cl", liq.cuotaLiquidaTotal, c.ref.cl],
    ["cr", liq.cuotaResultanteAutoliquidacion, c.ref.cr],
    ["cd", liq.cuotaDiferencial, c.ref.cd],
    ["modo", liq.modoTributacionElegido, c.ref.modo],
    ["obl", liq.obligacionDeclarar ? liq.obligacionDeclarar.obligado : null, c.ref.obl]
  ];
  const bad = checks.filter(([, a, b]) => (typeof b === "number") ? Math.abs(a - b) > tol : a !== b);
  if (bad.length) {
    nbad++;
    console.log(`FAIL ${id} :: ` + bad.map(([k, a, b]) => `${k} js=${a} r=${b}`).join(" | "));
  } else {
    console.log(`ok   ${id}  cl=${liq.cuotaLiquidaTotal.toFixed(2)}`);
  }
}
const n = Object.keys(CASOS).length;
console.log(nbad === 0 ? `VALIDADOR OK (${n})` : `VALIDADOR FAIL: ${nbad} de ${n}`);
process.exit(nbad === 0 ? 0 : 1);
