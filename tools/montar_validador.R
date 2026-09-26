# Monta tools/validar_js.html (autónomo) a partir de params.json, irpfsim.js, casos.json
source("R/cargar.R"); irpfsim_cargar(".")
source("tools/exportar_params.R")   # refresca params.json de los YAML
source("tools/validar_js.R")        # refresca casos.json (referencia del motor R)
engine <- paste(readLines("web/js/irpfsim.js", warn = FALSE, encoding = "UTF-8"), collapse = "\n")
params <- as.character(jsonlite::minify(paste(readLines("web/datos/params.json", warn = FALSE, encoding = "UTF-8"), collapse = "\n")))
casos  <- readLines("tools/casos.json", warn = FALSE, encoding = "UTF-8")[1]

html <- sprintf('<!doctype html><meta charset="utf-8"><title>Validador JS vs R</title>
<style>body{font:13px monospace;padding:1rem}.ok{color:green}.bad{color:red;font-weight:bold}</style>
<pre id="out">corriendo...</pre>
<script>%s</script>
<script>
const P = %s;
const CASOS = %s;
const tol = 0.02;
let lines = [], nbad = 0;
for (const [id, c] of Object.entries(CASOS)) {
  let liq;
  try { liq = irpfsim.liquidar(c.js, P, "auto"); }
  catch (e) { lines.push("ERROR " + id + ": " + e.message); nbad++; continue; }
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
  let bad = checks.filter(([k, a, b]) => (typeof b === "number") ? Math.abs(a - b) > tol : a !== b);
  if (bad.length) {
    nbad++;
    lines.push("FAIL " + id + " :: " + bad.map(([k, a, b]) => k + " js=" + a + " r=" + b).join(" | "));
  } else {
    lines.push("ok   " + id + "  cl=" + liq.cuotaLiquidaTotal.toFixed(2));
  }
}
lines.unshift(nbad === 0 ? "TODOS OK (" + Object.keys(CASOS).length + ")" : nbad + " CASOS CON DIFERENCIAS");
document.getElementById("out").textContent = lines.join("\\n");
document.title = nbad === 0 ? "VALIDADOR OK" : "VALIDADOR FAIL " + nbad;
</script>', engine, params, casos)

writeLines(html, "tools/validar_js.html")
cat("validar_js.html:", file.size("tools/validar_js.html"), "bytes\n")
