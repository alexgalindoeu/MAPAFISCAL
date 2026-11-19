// Validador R ↔ JS sin navegador (para CI).
//   Rscript tools/validar_js.R && node tools/validar_js_node.js
// Misma comparación que tools/validar_js.html: cada caso de tools/casos.json (referencia
// calculada por el motor R) se liquida con web/js/irpfsim.js y debe coincidir a ±0,02 €.
// También se usa como módulo (require): validar() devuelve el detalle de cada caso, que
// tools/generar_validacion.mjs publica en web/validacion/.
"use strict";
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "..");
const irpfsim = require(path.join(raiz, "web/js/irpfsim.js"));
const TOL = 0.02;

// parámetros de cada ejercicio: params.json (el por defecto) y params_<año>.json
function cargarParams() {
  const PS = {};
  for (const f of fs.readdirSync(path.join(raiz, "web/datos")).filter(n => /^params(_\d{4})?\.json$/.test(n))) {
    const P = JSON.parse(fs.readFileSync(path.join(raiz, "web/datos", f), "utf8"));
    PS[P.ejercicio] = P;
  }
  return PS;
}
const cargarCasos = () => JSON.parse(fs.readFileSync(path.join(raiz, "tools/casos.json"), "utf8"));

// Un caso: { id, tipo, comprobaciones: [[cifra, js, r]], fallos: [...], error, resumen }
function compararCaso(id, c, PS) {
  const P = PS[c.js.ejercicio];
  let tipo, comprobaciones, resumen;
  try {
    if (c.rescate) {   // rescate del plan de pensiones (R/16_rescate_plan.R)
      const s = irpfsim.rescatePlan(c.js, P);
      tipo = "rescate";
      comprobaciones = [["plazo", s.enPlazo, c.ref.en_plazo], ["sin", s.irpfSin, c.ref.sin], ["capital", s.capital.extra, c.ref.capital],
        ["renta", s.renta.extra, c.ref.renta], ["mixto", s.mixto.extra, c.ref.mixto], ["mejor", s.mejor, c.ref.mejor]];
      resumen = `capital=${s.capital.extra.toFixed(2)}`;
    } else if (c.neto) {   // cotizaciones del trabajador y sueldo neto (R/15_sueldo_neto.R)
      const s = irpfsim.sueldoNeto(c.js, P);
      tipo = "neto";
      comprobaciones = [["cot", s.cotizaciones, c.ref.cot], ["irpf", s.irpf, c.ref.irpf], ["neto", s.neto, c.ref.neto],
        ["cr", s.liquidacion.cuotaResultanteAutoliquidacion, c.ref.cr], ["modo", s.liquidacion.modoTributacionElegido, c.ref.modo]];
      resumen = `neto=${s.neto.toFixed(2)}`;
    } else {
      const liq = irpfsim.liquidar(c.js, P, "auto");
      tipo = "liquidacion";
      comprobaciones = [
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
      resumen = `cl=${liq.cuotaLiquidaTotal.toFixed(2)}`;
    }
  } catch (e) {
    return { id, tipo: tipo || "liquidacion", comprobaciones: [], fallos: [], error: e.message, resumen: "" };
  }
  const fallos = comprobaciones.filter(([, a, b]) => (typeof b === "number") ? Math.abs(a - b) > TOL : a !== b);
  return { id, tipo, comprobaciones, fallos, error: null, resumen };
}

function validar(CASOS = cargarCasos(), PS = cargarParams()) {
  return Object.entries(CASOS).map(([id, c]) => Object.assign(compararCaso(id, c, PS), { caso: c }));
}

module.exports = { validar, compararCaso, cargarCasos, cargarParams, TOL };

if (require.main === module) {
  const res = validar();
  let nbad = 0;
  for (const r of res) {
    if (r.error) { console.log(`ERROR ${r.id}: ${r.error}`); nbad++; }
    else if (r.fallos.length) { nbad++; console.log(`FAIL ${r.id} :: ` + r.fallos.map(([k, a, b]) => `${k} js=${a} r=${b}`).join(" | ")); }
    else console.log(`ok   ${r.id}  ${r.resumen}`);
  }
  const n = res.length;
  console.log(nbad === 0 ? `VALIDADOR OK (${n})` : `VALIDADOR FAIL: ${nbad} de ${n}`);
  process.exit(nbad === 0 ? 0 : 1);
}
