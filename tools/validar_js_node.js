// Validador R ↔ JS sin navegador (para CI).
//   Rscript tools/validar_js.R && node tools/validar_js_node.js
// Misma comparación que tools/validar_js.html: cada caso de tools/casos.json (referencia
// calculada por el motor R) se liquida con web/js/irpfsim.js y debe coincidir a ±0,02 €.
"use strict";
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "..");
const irpfsim = require(path.join(raiz, "web/js/irpfsim.js"));
const P = JSON.parse(fs.readFileSync(path.join(raiz, "web/datos/params.json"), "utf8"));
const CASOS = JSON.parse(fs.readFileSync(path.join(raiz, "tools/casos.json"), "utf8"));
const tol = 0.02;

let nbad = 0;
for (const [id, c] of Object.entries(CASOS)) {
  let liq;
  try { liq = irpfsim.liquidar(c.js, P, "auto"); }
  catch (e) { console.log(`ERROR ${id}: ${e.message}`); nbad++; continue; }
  const checks = [
    ["blg", liq.baseLiquidableGeneral, c.ref.blg],
    ["bla", liq.baseLiquidableAhorro, c.ref.bla],
    ["min", liq.minimoPersonalFamiliar.total, c.ref.minimo],
    ["ciEst", liq.cuotaIntegraEstatal, c.ref.ci_est],
    ["ciAut", liq.cuotaIntegraAutonomica, c.ref.ci_aut],
    ["cl", liq.cuotaLiquidaTotal, c.ref.cl],
    ["cd", liq.cuotaDiferencial, c.ref.cd],
    ["modo", liq.modoTributacionElegido, c.ref.modo]
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
