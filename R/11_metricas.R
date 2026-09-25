# =============================================================================
# irpfsim :: métricas distributivas
# =============================================================================

#' Índice de Gini (con pesos opcionales).
gini <- function(x, w = NULL) {
  if (is.null(w)) w <- rep(1, length(x))
  ok <- is.finite(x) & is.finite(w) & w > 0
  x <- x[ok]; w <- w[ok]
  if (length(x) < 2) return(NA_real_)
  o <- order(x); x <- x[o]; w <- w[o]
  wx <- w * x
  cw <- cumsum(w) / sum(w)
  cwx <- cumsum(wx) / sum(wx)
  p_prev <- c(0, head(cw, -1))
  L_prev <- c(0, head(cwx, -1))
  1 - sum((cw - p_prev) * (cwx + L_prev))
}

#' Deciles ponderados de un vector (devuelve el decil 1..10 de cada observación).
deciles <- function(x, w = NULL, k = 10) {
  if (is.null(w)) w <- rep(1, length(x))
  o <- order(x)
  cw <- cumsum(w[o]) / sum(w)
  d <- findInterval(cw, seq(0, 1, length.out = k + 1)[-c(1, k + 1)]) + 1
  d[d > k] <- k
  out <- integer(length(x)); out[o] <- d
  out
}

#' Curva de incidencia por decil: renta bruta, cuota, tipo efectivo, renta disponible.
tabla_por_decil <- function(df, var_renta = "renta_bruta", var_cuota = "cuota_liquida_total",
                            w = NULL, k = 10) {
  w <- w %||% rep(1, nrow(df))
  df$.d <- deciles(df[[var_renta]], w, k)
  df$.w <- w
  ag <- lapply(split(df, df$.d), function(g) {
    rb <- weighted.mean(g[[var_renta]], g$.w)
    cu <- weighted.mean(g[[var_cuota]], g$.w)
    data.frame(decil = g$.d[1], n = sum(g$.w),
               renta_bruta_media = rb, cuota_media = cu,
               tipo_efectivo_medio = ifelse(rb > 0, cu / rb, 0),
               renta_disponible_media = rb - cu)
  })
  do.call(rbind, ag)
}

#' Índices de progresividad y capacidad redistributiva.
#'  - Reynolds-Smolensky: Gini(antes) - Gini(después)  (efecto redistributivo)
#'  - Kakwani: Concentración(impuesto) - Gini(renta antes)  (progresividad)
indices_redistribucion <- function(renta_antes, impuesto, w = NULL) {
  w <- w %||% rep(1, length(renta_antes))
  renta_despues <- renta_antes - impuesto
  g_antes   <- gini(renta_antes, w)
  g_despues <- gini(renta_despues, w)
  # curva de concentración del impuesto: ordenar por renta_antes
  o <- order(renta_antes)
  ci_tax <- {
    ww <- w[o]; tt <- impuesto[o]
    cw <- cumsum(ww) / sum(ww)
    ct <- cumsum(ww * tt) / sum(ww * tt)
    p_prev <- c(0, head(cw, -1)); L_prev <- c(0, head(ct, -1))
    1 - sum((cw - p_prev) * (ct + L_prev))
  }
  list(
    gini_antes = g_antes,
    gini_despues = g_despues,
    reynolds_smolensky = g_antes - g_despues,
    indice_concentracion_impuesto = ci_tax,
    kakwani = ci_tax - g_antes
  )
}

#' Ganadores y perdedores de una reforma.
ganadores_perdedores <- function(renta_disp_base, renta_disp_reforma, w = NULL, umbral = 1) {
  w <- w %||% rep(1, length(renta_disp_base))
  delta <- renta_disp_reforma - renta_disp_base
  data.frame(
    pct_ganan   = 100 * sum(w[delta >  umbral]) / sum(w),
    pct_pierden = 100 * sum(w[delta < -umbral]) / sum(w),
    pct_igual   = 100 * sum(w[abs(delta) <= umbral]) / sum(w),
    delta_medio = weighted.mean(delta, w)
  )
}
