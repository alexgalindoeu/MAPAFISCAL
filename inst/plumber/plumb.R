# =============================================================================
# irpfsim :: API REST (plumber) — capa de servicio para un futuro frontend web
# =============================================================================
# Arranque:
#   "C:/Program Files/R/R-4.3.3/bin/Rscript.exe" -e ^
#     "plumber::pr_run(plumber::pr('inst/plumber/plumb.R'), port=8000)"
#
# Endpoints:
#   GET  /territorios
#   GET  /parametros?territorio=ES-MD&ejercicio=2025
#   POST /liquidar            body = hogar JSON  (?modo=auto|individual|conjunta)
#   POST /comparar            body = hogar JSON  (?territorios=ES-MD,ES-CT,...)
#   POST /simular             body = { reforma: [...], n_por_territorio, territorios }
# =============================================================================

.raiz <- Sys.getenv("IRPFSIM_ROOT", "")
if (!nzchar(.raiz)) for (cand in c(".", "..", "../..", "../../.."))
  if (dir.exists(file.path(cand, "R")) && dir.exists(file.path(cand, "params"))) { .raiz <- normalizePath(cand); break }
source(file.path(.raiz, "R", "cargar.R"))
irpfsim_cargar(.raiz)

#* @apiTitle irpfsim — Microsimulador del IRPF español
#* @apiDescription Motor de liquidación y simulación de reformas del IRPF (estatal + 17 CCAA + 3 TH vascos + Navarra)

#* @get /territorios
function() list(territorios = TERRITORIOS)

#* @get /parametros
#* @param territorio:str
#* @param ejercicio:int
function(territorio = "ES-MD", ejercicio = 2025) {
  P <- cargar_parametros(territorio, as.integer(ejercicio))
  list(meta = P$meta, jurisdiccion = P$jurisdiccion, avisos = avisos_parametros())
}

#* @post /liquidar
#* @param modo:str
#* @serializer unboxedJSON
function(req, modo = "auto") {
  limpiar_avisos()
  hogar <- hogar_desde_json(req$postBody)
  liq <- liquidar(hogar, modo = modo)
  unclass(liq)
}

#* @post /comparar
#* @param territorios:str
#* @serializer unboxedJSON
function(req, territorios = paste(TERRITORIOS, collapse = ",")) {
  limpiar_avisos()
  hogar <- hogar_desde_json(req$postBody)
  ts <- strsplit(territorios, ",")[[1]]
  df <- comparar_territorios(hogar, territorios = ts)
  df[order(df$cuota_resultante_autoliquidacion), ]
}

#* @post /simular
#* @serializer unboxedJSON
function(req) {
  limpiar_avisos()
  body <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
  ts <- unlist(body$territorios %||% c("ES-MD","ES-CT","ES-AN"))
  n  <- body$n_por_territorio %||% 500
  parches <- lapply(body$reforma, function(p) {
    list(territorio = unlist(p$territorio), ruta = p$ruta, valor = p$valor)
  })
  rf <- do.call(reforma, parches)
  m <- generar_muestra(n_por_territorio = n, territorios = ts,
                       ejercicio = body$ejercicio %||% 2025)
  sim <- simular(m, rf, ejercicio = body$ejercicio %||% 2025)
  list(impacto = sim$impacto)
}

#* @post /optimizar
#* @serializer unboxedJSON
function(req) {
  limpiar_avisos()
  hogar <- hogar_desde_json(req$postBody)
  unclass(optimizar(hogar))
}

#* @get /healthz
function() list(status = "ok", ts = as.character(Sys.time()))
