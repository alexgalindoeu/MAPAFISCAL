# =============================================================================
# irpfsim :: obligación de declarar (art. 96 LIRPF, régimen común)
# =============================================================================
# Por persona declarante. Solo régimen común: los territorios forales tienen su propia
# regulación (no modelada). Fuente y límites: `obligacion_declarar` en estatal.yaml.
#
# Simplificaciones (del lado de «obligado», para no decir a nadie que no tiene que declarar
# cuando sí): las ganancias patrimoniales se tratan como no sometidas a retención (ventas de
# acciones), y cualquier rendimiento de actividad económica supone alta en el RETA salvo que
# se indique `alta_reta = FALSE`.
# =============================================================================

obligacion_declarar_persona <- function(pe, P) {
  o <- P$estatal$obligacion_declarar
  tr <- pe$trabajo
  trabajo <- if (is.null(tr)) 0 else (tr$dinerarias %||% 0) + (tr$especie %||% 0)
  otros_pagadores <- if (is.null(tr)) 0 else (tr$otros_pagadores %||% 0)
  # B: capital mobiliario (íntegros positivos, sometidos a retención)
  cm <- pe$capital_mobiliario
  capital_ret <- if (is.null(cm)) 0 else
    sum(vapply(cm, function(v) if (is.numeric(v)) max(0, sum(v)) else 0, numeric(1)))
  # C: rentas inmobiliarias imputadas
  imput <- imputacion_inmobiliaria(pe, P)
  # otras rentas: alquileres (íntegros), actividades y ganancias o pérdidas
  alquileres <- sum(vapply(pe$capital_inmobiliario %||% list(), function(im) max(0, im$ingresos %||% 0), numeric(1)))
  act <- rn_actividades(pe, P)
  hay_actividad <- !is.null(pe$actividades)
  gan <- vapply(pe$ganancias %||% list(), function(el)
    (el$valor_transmision %||% 0) - (el$valor_adquisicion %||% 0), numeric(1))
  gan <- c(gan, pe$ganancias_perdidas_no_transmision %||% 0)
  ganancias <- sum(gan[gan > 0]); perdidas <- -sum(gan[gan < 0])

  para_aplicar <- character()
  if ((pe$vivienda_transitoria_pagos %||% 0) > 0) para_aplicar <- c(para_aplicar, "vivienda_transitoria")
  ps <- pe$prevision_social
  if (!is.null(ps) && ((ps$aportacion_individual %||% 0) + (ps$contribucion_empresarial %||% 0)) > 0)
    para_aplicar <- c(para_aplicar, "prevision_social")

  limite_trabajo <- if (otros_pagadores > o$segundo_pagador_umbral) o$trabajo_varios_pagadores else o$trabajo_un_pagador
  alta_reta <- pe$alta_reta %||% hay_actividad
  res <- function(obligado, motivo) list(obligado = obligado, motivo = motivo,
                                         limite_trabajo = limite_trabajo, para_aplicar = para_aplicar)
  if (isTRUE(alta_reta)) return(res(TRUE, "alta_reta"))

  solo_abc <- alquileres == 0 && !hay_actividad && ganancias == 0 && perdidas == 0
  if (solo_abc && trabajo <= limite_trabajo && capital_ret <= o$capital_y_ganancias_con_retencion &&
      imput <= o$rentas_inmobiliarias_imputadas)
    return(res(FALSE, "limites"))
  total <- trabajo + capital_ret + alquileres + max(0, act) + ganancias
  if (total <= o$rentas_totales_minimas && perdidas < o$perdidas_patrimoniales_maximas)
    return(res(FALSE, "rentas_minimas"))
  motivo <- if (trabajo > limite_trabajo) "trabajo"
            else if (capital_ret > o$capital_y_ganancias_con_retencion) "capital"
            else if (imput > o$rentas_inmobiliarias_imputadas) "imputaciones"
            else "otras_rentas"
  res(TRUE, motivo)
}

# Para el hogar: por declarante, y si conviene presentarla aunque no sea obligatoria
# (resultado a devolver). NA en territorios forales.
obligacion_declarar <- function(hogar, P, cuota_diferencial) {
  if (P$meta$regimen != "comun")
    return(list(obligado = NA, conviene_presentar = NA, por_persona = list()))
  por <- list()
  for (d in declarantes(hogar)) por[[d$id]] <- obligacion_declarar_persona(d, P)
  obligado <- any(vapply(por, function(x) x$obligado, logical(1)))
  list(obligado = obligado, conviene_presentar = !obligado && cuota_diferencial < 0, por_persona = por)
}
