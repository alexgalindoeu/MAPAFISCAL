# =============================================================================
# irpfsim :: carga y gestión de parámetros legales
# =============================================================================

# Directorio de parámetros: opción de sesión > variable de entorno > ruta relativa
.params_dir <- function() {
  d <- getOption("irpfsim.params_dir", Sys.getenv("IRPFSIM_PARAMS_DIR", ""))
  if (nzchar(d) && dir.exists(d)) return(d)
  for (cand in c("params", "../params", "../../params")) if (dir.exists(cand)) return(normalizePath(cand))
  stop("irpfsim: no encuentro el directorio 'params'. Fija options(irpfsim.params_dir=...).", call. = FALSE)
}

.leer_yaml <- function(path) {
  x <- yaml::read_yaml(path)
  .normalizar_inf(x)
}

#' Devuelve el "régimen" de un territorio.
regimen_territorio <- function(territorio) {
  if (territorio %in% c("ES-PV-BI", "ES-PV-SS", "ES-PV-VI")) return("foral_pais_vasco")
  if (territorio == "ES-NC") return("foral_navarra")
  "comun"   # 15 CCAA de régimen común
}

TERRITORIOS <- c(
  # Régimen común (Ceuta y Melilla quedan fuera del alcance de la herramienta)
  "ES-AN","ES-AR","ES-AS","ES-IB","ES-CN","ES-CB","ES-CM","ES-CL","ES-CT",
  "ES-EX","ES-GA","ES-MD","ES-MC","ES-RI","ES-VC",
  # Foral
  "ES-PV-BI","ES-PV-SS","ES-PV-VI","ES-NC"
)

#' Carga el juego de parámetros aplicable a un territorio y ejercicio.
#'
#' Devuelve una lista con, al menos: `$estatal` (siempre, como base común de
#' definiciones de renta), y `$jurisdiccion` (la escala/deducciones específicas).
#'
#' @param territorio código de TERRITORIOS
#' @param ejercicio  año (2025 por defecto; 2026 disponible parcialmente)
cargar_parametros <- function(territorio, ejercicio = 2025) {
  if (!territorio %in% TERRITORIOS)
    stop(sprintf("irpfsim: territorio desconocido '%s'.", territorio), call. = FALSE)
  base <- .params_dir()
  dir_e <- file.path(base, as.character(ejercicio))
  if (!dir.exists(dir_e)) stop(sprintf("irpfsim: no hay parámetros para el ejercicio %s.", ejercicio), call. = FALSE)

  reg <- regimen_territorio(territorio)
  estatal <- .leer_yaml(file.path(base, "2025", "estatal.yaml"))   # definiciones de renta comunes de referencia

  p <- list(
    meta = list(territorio = territorio, ejercicio = ejercicio, regimen = reg),
    estatal = estatal
  )

  if (reg == "comun") {
    auto <- .leer_yaml(file.path(base, "2025", "autonomico.yaml"))
    if (ejercicio != 2025 && file.exists(file.path(dir_e, "autonomico.yaml")))
      auto <- .leer_yaml(file.path(dir_e, "autonomico.yaml"))
    terr <- auto$territorios[[territorio]]
    if (is.null(terr)) stop(sprintf("irpfsim: sin bloque autonómico para %s.", territorio), call. = FALSE)
    if (ejercicio == 2025) {
      # escala estatal del ejercicio pedido
      p$jurisdiccion <- list(
        tipo = "comun",
        nombre = terr$nombre,
        escala_general_estatal    = estatal$escala_general_estatal$tramos,
        escala_general_autonomica = terr$escala_general_autonomica$tramos,
        escala_ahorro_estatal     = estatal$escala_ahorro_estatal$tramos,
        escala_ahorro_autonomica  = estatal$escala_ahorro_autonomica$tramos,
        bonificacion_residencia   = terr$bonificacion_residencia,
        deducciones_autonomicas   = terr$deducciones_autonomicas,
        minimo_autonomico         = terr$minimo_autonomico
      )
    } else {
      est_e <- .leer_yaml(file.path(dir_e, "estatal.yaml"))
      p$estatal <- est_e
      p$jurisdiccion <- list(
        tipo = "comun", nombre = terr$nombre,
        escala_general_estatal    = est_e$escala_general_estatal$tramos,
        escala_general_autonomica = terr$escala_general_autonomica$tramos,
        escala_ahorro_estatal     = est_e$escala_ahorro_estatal$tramos,
        escala_ahorro_autonomica  = est_e$escala_ahorro_autonomica$tramos,
        bonificacion_residencia   = terr$bonificacion_residencia,
        deducciones_autonomicas   = terr$deducciones_autonomicas,
        minimo_autonomico         = terr$minimo_autonomico
      )
    }
    if (!is.null(terr$deducciones_autonomicas$estado) &&
        terr$deducciones_autonomicas$estado == "pendiente")
      registrar_aviso(sprintf("[%s] deducciones autonómicas PENDIENTES de carga (solo escala aplicada).", territorio))

  } else if (reg == "foral_pais_vasco") {
    fpath <- file.path(dir_e, "foral_pais_vasco.yaml")
    if (!file.exists(fpath)) fpath <- file.path(base, "2025", "foral_pais_vasco.yaml")
    pv <- .leer_yaml(fpath)
    # herencia 2026 -> 2025 para lo no sobreescrito
    if (!is.null(pv$meta$hereda_de)) {
      basep <- .leer_yaml(file.path(base, pv$meta$hereda_de))
      pv$comun <- modifyList(basep$comun, pv$comun)
      if (is.null(pv$overrides)) pv$overrides <- basep$overrides
      for (nm in setdiff(names(basep), c("meta","comun","overrides")))
        if (is.null(pv[[nm]])) pv[[nm]] <- basep[[nm]]
    }
    ov <- pv$overrides[[territorio]] %||% list()
    jur <- modifyList(pv$comun, ov[setdiff(names(ov), c("nombre","norma_base"))])
    jur$tipo <- "foral_pais_vasco"
    jur$nombre <- ov$nombre %||% territorio
    p$jurisdiccion <- jur
    registrar_aviso(sprintf("[%s] módulo foral PV: coef. actualización inmuebles y algunas deducciones PENDIENTES.", territorio))

  } else if (reg == "foral_navarra") {
    npath <- file.path(dir_e, "navarra.yaml")
    if (!file.exists(npath)) npath <- file.path(base, "2025", "navarra.yaml")
    nv <- .leer_yaml(npath)
    nv$tipo <- "foral_navarra"
    nv$nombre <- "Comunidad Foral de Navarra"
    p$jurisdiccion <- nv
    registrar_aviso("[ES-NC] módulo Navarra: mínimos familiares, deducciones de vivienda y reducción del trabajo PENDIENTES.")
  }

  class(p) <- "irpfsim_parametros"
  p
}

print.irpfsim_parametros <- function(x, ...) {
  cat(sprintf("<irpfsim_parametros> territorio=%s ejercicio=%s regimen=%s\n",
              x$meta$territorio, x$meta$ejercicio, x$meta$regimen))
  invisible(x)
}
