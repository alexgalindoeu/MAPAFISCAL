# =============================================================================
# irpfsim :: dispatcher — liquidar(hogar) elige módulo y modo de tributación
# =============================================================================

#' Liquida el IRPF de un hogar.
#'
#' @param hogar objeto irpfsim_hogar
#' @param parametros opcional; si NULL se cargan por (territorio, ejercicio)
#' @param modo "auto" (elige individual/conjunta por menor cuota) | "individual" | "conjunta"
#' @return objeto `irpfsim_liquidacion`
liquidar <- function(hogar, parametros = NULL, modo = "auto") {
  validar_hogar(hogar)
  P <- parametros %||% cargar_parametros(hogar$territorio, hogar$ejercicio)
  reg <- P$meta$regimen
  fscope <- switch(reg,
                   "comun" = liquidar_comun_scope,
                   "foral_pais_vasco" = liquidar_pais_vasco_scope,
                   "foral_navarra" = liquidar_navarra_scope,
                   stop("régimen no soportado"))

  decs <- declarantes(hogar)
  puede_conjunta <- hogar$tipo_unidad_familiar %in% c("biparental", "monoparental")

  resultados <- list()
  if (modo %in% c("auto", "individual")) {
    # suma de liquidaciones individuales de cada declarante
    indiv <- lapply(decs, function(d) fscope(hogar, P, "individual", d$id))
    resultados$individual <- .combinar_individuales(indiv)
  }
  if ((modo %in% c("auto", "conjunta")) && puede_conjunta) {
    resultados$conjunta <- fscope(hogar, P, "conjunta")
  }

  elegido <- if (modo == "conjunta" && !is.null(resultados$conjunta)) "conjunta"
             else if (modo == "individual") "individual"
             else if (!is.null(resultados$conjunta) &&
                      resultados$conjunta$cuota_liquida_total < resultados$individual$cuota_liquida_total)
               "conjunta"
             else "individual"

  liq <- resultados[[elegido]]
  liq$territorio <- hogar$territorio
  liq$ejercicio <- hogar$ejercicio
  liq$regimen <- reg
  liq$modo_tributacion_elegido <- elegido
  liq$comparativa <- list(
    individual = resultados$individual$cuota_liquida_total,
    conjunta   = if (!is.null(resultados$conjunta)) resultados$conjunta$cuota_liquida_total else NA_real_
  )
  liq$avisos_parametros <- avisos_parametros()
  class(liq) <- "irpfsim_liquidacion"
  liq
}

# Combina liquidaciones individuales de varios declarantes en un único objeto-hogar
.combinar_individuales <- function(lst) {
  if (length(lst) == 1) return(lst[[1]])
  suma <- function(campo) sum(vapply(lst, function(x) x[[campo]] %||% 0, numeric(1)))
  base <- lst[[1]]
  for (campo in c("base_imponible_general","base_imponible_ahorro","base_liquidable_general",
                  "base_liquidable_ahorro","cuota_integra_estatal","cuota_integra_autonomica",
                  "cuota_integra_total","cuota_liquida_estatal","cuota_liquida_autonomica",
                  "cuota_liquida_total","retenciones","cuota_diferencial"))
    base[[campo]] <- red2(suma(campo))
  bit <- base$base_imponible_general + base$base_imponible_ahorro
  base$tipo_medio_efectivo <- if (bit > 0) round(base$cuota_liquida_total / bit, 4) else 0
  base$modo <- "individual"
  base
}

print.irpfsim_liquidacion <- function(x, ...) {
  cat(sprintf("<irpfsim_liquidacion> %s (ejercicio %s, régimen %s)\n", x$territorio, x$ejercicio, x$regimen))
  cat(sprintf("  Modo de tributación : %s\n", x$modo_tributacion_elegido))
  cat(sprintf("  Base imponible      : general %.2f | ahorro %.2f\n",
              x$base_imponible_general, x$base_imponible_ahorro))
  cat(sprintf("  Base liquidable     : general %.2f | ahorro %.2f\n",
              x$base_liquidable_general, x$base_liquidable_ahorro))
  if (!is.null(x$minimo_personal_familiar$total))
    cat(sprintf("  Mínimo pers. y fam. : %.2f\n", x$minimo_personal_familiar$total))
  cat(sprintf("  Cuota íntegra       : estatal %.2f | autonómica/foral %.2f | total %.2f\n",
              x$cuota_integra_estatal, x$cuota_integra_autonomica, x$cuota_integra_total))
  cat(sprintf("  Cuota líquida total : %.2f\n", x$cuota_liquida_total))
  cat(sprintf("  Retenciones         : %.2f\n", x$retenciones))
  cat(sprintf("  Cuota diferencial   : %.2f  (%s)\n", x$cuota_diferencial,
              if (x$cuota_diferencial >= 0) "a ingresar" else "a devolver"))
  cat(sprintf("  Tipo medio efectivo : %.2f %%\n", 100 * x$tipo_medio_efectivo))
  if (length(x$avisos_parametros))
    cat(sprintf("  [!] %d aviso(s) de parámetros. Ver $avisos_parametros\n", length(x$avisos_parametros)))
  invisible(x)
}

# Salida plana para data.frame / API
as.data.frame.irpfsim_liquidacion <- function(x, ...) {
  data.frame(
    territorio = x$territorio, ejercicio = x$ejercicio, regimen = x$regimen,
    modo = x$modo_tributacion_elegido,
    base_imponible_general = x$base_imponible_general,
    base_imponible_ahorro = x$base_imponible_ahorro,
    base_liquidable_general = x$base_liquidable_general,
    base_liquidable_ahorro = x$base_liquidable_ahorro,
    minimo = x$minimo_personal_familiar$total %||% 0,
    cuota_integra_estatal = x$cuota_integra_estatal,
    cuota_integra_autonomica = x$cuota_integra_autonomica,
    cuota_integra_total = x$cuota_integra_total,
    cuota_liquida_total = x$cuota_liquida_total,
    retenciones = x$retenciones,
    cuota_diferencial = x$cuota_diferencial,
    tipo_medio_efectivo = x$tipo_medio_efectivo,
    stringsAsFactors = FALSE
  )
}

liquidacion_a_json <- function(x, ...) jsonlite::toJSON(unclass(x), auto_unbox = TRUE, pretty = TRUE, digits = 4, null = "null")
