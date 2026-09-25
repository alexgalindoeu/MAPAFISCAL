# =============================================================================
# irpfsim :: utilidades base
# =============================================================================

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0 || (length(a) == 1 && is.na(a))) b else a

# Redondeo a 2 decimales (la AEAT redondea la cuota; configurable)
red2 <- function(x) round(x + 1e-9, 2)

#' Aplica una escala progresiva por tramos marginales a una base.
#'
#' @param base numérico (>= 0 tras truncar; valores negativos devuelven 0)
#' @param tramos lista de listas con campos `hasta` (límite superior; puede ser Inf)
#'   y `tipo` (tipo marginal en tanto por uno). Deben venir ordenados de menor a mayor.
#' @return cuota resultante (sin redondear)
aplicar_escala <- function(base, tramos) {
  if (is.null(base) || is.na(base) || base <= 0) return(0)
  cuota <- 0
  prev  <- 0
  for (tr in tramos) {
    lim  <- tr$hasta
    tipo <- tr$tipo
    if (is.null(lim) || is.infinite(lim) || base <= lim) {
      cuota <- cuota + (base - prev) * tipo
      return(cuota)
    }
    cuota <- cuota + (lim - prev) * tipo
    prev  <- lim
  }
  cuota
}

#' Tipo marginal de una escala en un punto de base dado.
tipo_marginal_escala <- function(base, tramos) {
  if (is.null(base) || base < 0) base <- 0
  prev <- 0
  for (tr in tramos) {
    lim <- tr$hasta
    if (is.null(lim) || is.infinite(lim) || base <= lim) return(tr$tipo)
    prev <- lim
  }
  tramos[[length(tramos)]]$tipo
}

# YAML: convierte `.inf` y "inf" a Inf tras la carga
.normalizar_inf <- function(x) {
  if (is.list(x)) return(lapply(x, .normalizar_inf))
  if (is.character(x) && length(x) == 1 && tolower(x) %in% c(".inf", "inf", "+inf")) return(Inf)
  x
}

# Aviso de parámetro no confirmado (se acumula para el informe de trazabilidad)
.irpfsim_env <- new.env(parent = emptyenv())
.irpfsim_env$avisos <- character(0)

registrar_aviso <- function(msg) {
  .irpfsim_env$avisos <- unique(c(.irpfsim_env$avisos, msg))
  invisible(NULL)
}
avisos_parametros <- function() .irpfsim_env$avisos
limpiar_avisos    <- function() { .irpfsim_env$avisos <- character(0); invisible(NULL) }

# Comprobación ligera de tipos (sustituye a checkmate para no añadir dependencia dura)
stopifnot_num <- function(x, nombre, min = -Inf) {
  if (!is.numeric(x) || is.na(x) || x < min)
    stop(sprintf("irpfsim: '%s' debe ser numérico >= %s (recibido: %s)", nombre, min, x), call. = FALSE)
  invisible(TRUE)
}
