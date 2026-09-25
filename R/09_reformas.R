# =============================================================================
# irpfsim :: motor de reformas
# =============================================================================
# Una reforma es una lista de "parches" sobre el árbol de parámetros:
#   list(
#     list(territorio = "estatal", ruta = "escala_general_estatal/tramos/6/tipo", valor = 0.26),
#     list(territorio = c("ES-PV-BI","ES-PV-SS"), ruta = "minoracion_cuota/importe_bizkaia", valor = 1700)
#   )
# `territorio`: "estatal" (afecta al bloque $estatal) o un código de TERRITORIOS
#   (afecta al bloque $jurisdiccion de ese territorio). Puede ser un vector.
# `ruta`: ruta separada por "/" dentro del bloque; los índices numéricos entran
#   en listas (1-based).
# =============================================================================

reforma <- function(...) {
  ps <- list(...)
  structure(ps, class = "irpfsim_reforma")
}

.set_ruta <- function(obj, partes, valor) {
  k <- partes[[1]]
  idx <- suppressWarnings(as.integer(k))
  if (!is.na(idx)) k <- idx
  if (length(partes) == 1) { obj[[k]] <- valor; return(obj) }
  if (is.null(obj[[k]])) obj[[k]] <- list()
  obj[[k]] <- .set_ruta(obj[[k]], partes[-1], valor)
  obj
}

#' Aplica una reforma a un objeto de parámetros ya cargado (inmutable).
aplicar_reforma <- function(parametros, reforma) {
  if (is.null(reforma) || !length(reforma)) return(parametros)
  P <- parametros
  terr <- P$meta$territorio
  for (parche in reforma) {
    destinos <- parche$territorio %||% "estatal"
    if (!(terr %in% destinos || "estatal" %in% destinos && FALSE)) {
      # aplica si el territorio de estos parámetros está en la lista,
      # o si el parche es "estatal" (afecta al bloque $estatal de cualquier régimen común)
    }
    partes <- strsplit(parche$ruta, "/", fixed = TRUE)[[1]]
    if ("estatal" %in% destinos) {
      P$estatal <- .set_ruta(P$estatal, partes, parche$valor)
      # si la escala estatal cambió, refrescar la copia en $jurisdiccion (régimen común)
      if (identical(P$meta$regimen, "comun")) {
        if (identical(partes[1], "escala_general_estatal"))
          P$jurisdiccion$escala_general_estatal <- P$estatal$escala_general_estatal$tramos
        if (identical(partes[1], "escala_ahorro_estatal"))
          P$jurisdiccion$escala_ahorro_estatal <- P$estatal$escala_ahorro_estatal$tramos
        if (identical(partes[1], "escala_ahorro_autonomica"))
          P$jurisdiccion$escala_ahorro_autonomica <- P$estatal$escala_ahorro_autonomica$tramos
      }
    }
    if (terr %in% destinos) {
      P$jurisdiccion <- .set_ruta(P$jurisdiccion, partes, parche$valor)
    }
  }
  P
}

#' Azúcar para reformas frecuentes.
parche_tipo_tramo <- function(territorio, escala, n_tramo, tipo) {
  list(territorio = territorio, ruta = sprintf("%s/tramos/%d/tipo", escala, n_tramo), valor = tipo)
}
parche_minimo <- function(campo, valor) {
  list(territorio = "estatal", ruta = sprintf("minimo_contribuyente/%s", campo), valor = valor)
}

print.irpfsim_reforma <- function(x, ...) {
  cat(sprintf("<irpfsim_reforma> %d parche(s)\n", length(x)))
  for (p in x) cat(sprintf("  - [%s] %s := %s\n",
                           paste(p$territorio %||% "estatal", collapse = ","), p$ruta,
                           paste(p$valor, collapse = ",")))
  invisible(x)
}
