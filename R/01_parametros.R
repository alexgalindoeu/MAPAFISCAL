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

# --- Varios ejercicios --------------------------------------------------------
# Cada ejercicio tiene su carpeta params/<año>/ con los cuatro ficheros (estatal,
# autonomico, foral_pais_vasco, navarra). Un fichero puede declarar
# `meta: hereda_de: "<año>/<fichero>.yaml"`: entonces parte de ese fichero y solo
# recoge lo que cambia. Nunca se toma otro año en silencio: si falta el fichero, error.

# Fusión de parámetros para la herencia: las listas con nombre se fusionan por clave
# (recursivo); las listas sin nombre (`tramos`, la `lista` de deducciones) y los valores
# sueltos se sustituyen enteros; una clave con valor nulo (`~` en YAML) se elimina.
fusionar_params <- function(base, cambios) {
  es_mapa <- function(x) is.list(x) && length(x) > 0 && !is.null(names(x)) && all(nzchar(names(x)))
  for (k in names(cambios)) {
    v <- cambios[[k]]
    if (is.null(v)) base[[k]] <- NULL
    else if (es_mapa(v) && es_mapa(base[[k]])) base[[k]] <- fusionar_params(base[[k]], v)
    else base[[k]] <- v
  }
  base
}

#' Lee un fichero de parámetros de un ejercicio, resolviendo su herencia.
leer_params <- function(ejercicio, fichero, base = .params_dir()) {
  ruta <- file.path(base, as.character(ejercicio), fichero)
  if (!file.exists(ruta))
    stop(sprintf("irpfsim: falta params/%s/%s.", ejercicio, fichero), call. = FALSE)
  .resolver_herencia(ruta, base, character())
}

.resolver_herencia <- function(ruta, base, vistos) {
  if (ruta %in% vistos) stop("irpfsim: herencia circular en ", ruta, call. = FALSE)
  x <- .leer_yaml(ruta)
  padre <- x$meta$hereda_de
  if (is.null(padre)) return(x)
  ruta_padre <- file.path(base, padre)
  if (!file.exists(ruta_padre)) stop(sprintf("irpfsim: %s hereda de %s, que no existe.", ruta, padre), call. = FALSE)
  r <- fusionar_params(.resolver_herencia(ruta_padre, base, c(vistos, ruta)), x)
  r$meta$hereda_de <- padre
  r
}

#' Ejercicios con parámetros (carpetas params/<año>/ con estatal.yaml).
ejercicios_disponibles <- function(base = .params_dir()) {
  d <- list.dirs(base, full.names = FALSE, recursive = FALSE)
  d <- d[grepl("^[0-9]{4}$", d) & file.exists(file.path(base, d, "estatal.yaml"))]
  sort(as.integer(d))
}

#' Ejercicio por defecto y ejercicios que ofrece la web (params/ejercicios.yaml).
ejercicios_config <- function(base = .params_dir()) {
  .leer_yaml(file.path(base, "ejercicios.yaml"))
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
#' @param ejercicio  año con carpeta en params/ (ver `ejercicios_disponibles()`)
cargar_parametros <- function(territorio, ejercicio = 2025) {
  if (!territorio %in% TERRITORIOS)
    stop(sprintf("irpfsim: territorio desconocido '%s'.", territorio), call. = FALSE)
  base <- .params_dir()
  if (!dir.exists(file.path(base, as.character(ejercicio))))
    stop(sprintf("irpfsim: no hay parámetros para el ejercicio %s.", ejercicio), call. = FALSE)

  reg <- regimen_territorio(territorio)
  estatal <- leer_params(ejercicio, "estatal.yaml", base)   # también definiciones de renta comunes

  p <- list(
    meta = list(territorio = territorio, ejercicio = ejercicio, regimen = reg),
    estatal = estatal
  )

  if (reg == "comun") {
    auto <- leer_params(ejercicio, "autonomico.yaml", base)
    terr <- auto$territorios[[territorio]]
    if (is.null(terr)) stop(sprintf("irpfsim: sin bloque autonómico para %s.", territorio), call. = FALSE)
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
    if (!is.null(terr$deducciones_autonomicas$estado) &&
        terr$deducciones_autonomicas$estado == "pendiente")
      registrar_aviso(sprintf("[%s] deducciones autonómicas PENDIENTES de carga (solo escala aplicada).", territorio))

  } else if (reg == "foral_pais_vasco") {
    pv <- leer_params(ejercicio, "foral_pais_vasco.yaml", base)
    ov <- pv$overrides[[territorio]] %||% list()
    jur <- fusionar_params(pv$comun, ov[setdiff(names(ov), c("nombre","norma_base"))])
    jur$tipo <- "foral_pais_vasco"
    jur$nombre <- ov$nombre %||% territorio
    p$jurisdiccion <- jur
    registrar_aviso(sprintf("[%s] módulo foral PV: coef. actualización inmuebles y algunas deducciones PENDIENTES.", territorio))

  } else if (reg == "foral_navarra") {
    nv <- leer_params(ejercicio, "navarra.yaml", base)
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
