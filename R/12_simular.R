# =============================================================================
# irpfsim :: simulación de reformas sobre la muestra
# =============================================================================

#' Liquida toda una muestra bajo un juego de parámetros (opcionalmente reformado).
#'
#' @param muestra data.frame de generar_muestra()
#' @param reforma opcional; objeto irpfsim_reforma
#' @param ejercicio año de parámetros
#' @param cache_parametros si TRUE, cachea parámetros por territorio
#' @return data.frame con una fila por hogar y las magnitudes de la liquidación
liquidar_muestra <- function(muestra, reforma = NULL, ejercicio = 2025) {
  terrs <- unique(muestra$territorio)
  Pcache <- list()
  for (t in terrs) {
    P <- cargar_parametros(t, ejercicio)
    if (!is.null(reforma)) P <- aplicar_reforma(P, reforma)
    Pcache[[t]] <- P
  }
  res <- lapply(seq_len(nrow(muestra)), function(i) {
    hg <- muestra$hogar[[i]]
    liq <- tryCatch(liquidar(hg, parametros = Pcache[[hg$territorio]], modo = "auto"),
                    error = function(e) NULL)
    if (is.null(liq)) return(NULL)
    d <- as.data.frame(liq)
    d$id_hogar <- muestra$id_hogar[i]
    d$peso <- muestra$peso[i]
    d$renta_bruta <- muestra$renta_bruta[i]
    d
  })
  out <- do.call(rbind, res)
  out$renta_disponible <- out$renta_bruta - out$cuota_resultante_autoliquidacion
  out
}

#' Simula una reforma: liquida baseline y reforma, y calcula el impacto distributivo.
#'
#' @return lista con $baseline, $reforma (data.frames) y $impacto (métricas)
simular <- function(muestra, reforma, ejercicio = 2025, k_deciles = 10) {
  base <- liquidar_muestra(muestra, reforma = NULL, ejercicio = ejercicio)
  refo <- liquidar_muestra(muestra, reforma = reforma, ejercicio = ejercicio)
  m <- merge(base[, c("id_hogar","peso","renta_bruta","cuota_resultante_autoliquidacion","renta_disponible")],
             refo[, c("id_hogar","cuota_resultante_autoliquidacion","renta_disponible")],
             by = "id_hogar", suffixes = c("_base","_reforma"))

  imp <- list(
    recaudacion_base    = sum(m$cuota_resultante_autoliquidacion_base * m$peso),
    recaudacion_reforma = sum(m$cuota_resultante_autoliquidacion_reforma * m$peso),
    variacion_recaudacion = sum((m$cuota_resultante_autoliquidacion_reforma - m$cuota_resultante_autoliquidacion_base) * m$peso),
    gini_disp_base    = gini(m$renta_disponible_base, m$peso),
    gini_disp_reforma = gini(m$renta_disponible_reforma, m$peso),
    redistribucion_base = indices_redistribucion(m$renta_bruta, m$cuota_resultante_autoliquidacion_base, m$peso),
    redistribucion_reforma = indices_redistribucion(m$renta_bruta, m$cuota_resultante_autoliquidacion_reforma, m$peso),
    ganadores_perdedores = ganadores_perdedores(m$renta_disponible_base, m$renta_disponible_reforma, m$peso),
    por_decil_base    = tabla_por_decil(setNames(m[, c("renta_bruta","cuota_resultante_autoliquidacion_base")],
                                                 c("renta_bruta","cuota_resultante_autoliquidacion")),
                                        w = m$peso, k = k_deciles),
    por_decil_reforma = tabla_por_decil(setNames(m[, c("renta_bruta","cuota_resultante_autoliquidacion_reforma")],
                                                 c("renta_bruta","cuota_resultante_autoliquidacion")),
                                        w = m$peso, k = k_deciles)
  )
  structure(list(baseline = base, reforma = refo, panel = m, impacto = imp),
            class = "irpfsim_simulacion")
}

print.irpfsim_simulacion <- function(x, ...) {
  i <- x$impacto
  cat("<irpfsim_simulacion>\n")
  cat(sprintf("  Recaudación base    : %15.0f €\n", i$recaudacion_base))
  cat(sprintf("  Recaudación reforma : %15.0f €\n", i$recaudacion_reforma))
  cat(sprintf("  Variación           : %+15.0f €  (%+.2f %%)\n", i$variacion_recaudacion,
              100 * i$variacion_recaudacion / i$recaudacion_base))
  cat(sprintf("  Gini renta disponible: %.4f -> %.4f  (%+.4f)\n",
              i$gini_disp_base, i$gini_disp_reforma, i$gini_disp_reforma - i$gini_disp_base))
  cat(sprintf("  Kakwani (progresividad): %.4f -> %.4f\n",
              i$redistribucion_base$kakwani, i$redistribucion_reforma$kakwani))
  gp <- i$ganadores_perdedores
  cat(sprintf("  Hogares: %.1f %% ganan | %.1f %% pierden | %.1f %% igual\n",
              gp$pct_ganan, gp$pct_pierden, gp$pct_igual))
  invisible(x)
}

#' Comparativa de un mismo perfil de hogar en varios territorios.
comparar_territorios <- function(hogar_base, territorios = TERRITORIOS, ejercicio = 2025) {
  do.call(rbind, lapply(territorios, function(t) {
    hg <- hogar_base; hg$territorio <- t
    hg <- nuevo_hogar(hg$id_hogar, t, hg$miembros, ejercicio,
                      hg$tipo_unidad_familiar, hg$familia_numerosa, hg$titulo_familia_numerosa)
    liq <- tryCatch(liquidar(hg, modo = "auto"), error = function(e) NULL)
    if (is.null(liq)) return(NULL)
    d <- as.data.frame(liq)
    d
  }))
}
