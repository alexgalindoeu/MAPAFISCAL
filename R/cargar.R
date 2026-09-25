# =============================================================================
# irpfsim :: cargador (mientras el proyecto no se instala como paquete formal)
# =============================================================================
# Uso:
#   source("R/cargar.R")           # desde la raíz del proyecto
#   irpfsim_cargar()
# =============================================================================

irpfsim_cargar <- function(raiz = NULL) {
  if (is.null(raiz)) {
    for (cand in c(".", "..", "../..")) if (dir.exists(file.path(cand, "R")) &&
        dir.exists(file.path(cand, "params"))) { raiz <- normalizePath(cand); break }
  }
  if (is.null(raiz)) stop("irpfsim: no encuentro la raíz del proyecto.")
  options(irpfsim.params_dir = file.path(raiz, "params"),
          warnPartialMatchDollar = TRUE)   # evita bugs por coincidencia parcial de `$` en listas YAML
  ficheros <- c("00_utils.R","01_parametros.R","02_hogar.R","03_rentas.R",
                "04_minimos.R","05_pipeline_comun.R","06_deducciones.R",
                "07_forales.R","08_dispatch.R","09_reformas.R","10_muestra.R",
                "11_metricas.R","12_simular.R","13_optimizar.R")
  for (f in ficheros) {
    p <- file.path(raiz, "R", f)
    if (file.exists(p)) sys.source(p, envir = globalenv())
  }
  limpiar_avisos()
  message("irpfsim cargado. Territorios: ", paste(TERRITORIOS, collapse = ", "))
  invisible(TRUE)
}
