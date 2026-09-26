# =============================================================================
# irpfsim :: mínimo personal y familiar (régimen común, arts. 56-61 LIRPF)
# =============================================================================
# En régimen común el mínimo NO se resta de la base: se aplica la escala a la
# base y a la parte de la base correspondiente al mínimo, y se restan las cuotas.
# =============================================================================

# autonomico = TRUE: importes del mínimo para el gravamen autonómico. Las CCAA que los
# han modificado (art. 46.1.a Ley 22/2009) los traen en `minimo_autonomico`, solo con lo
# que cambia; el resto (límites de rentas, edades, prorrateo) es el estatal.
minimo_personal_familiar <- function(hogar, P, modo = "individual", declarante_id = NULL,
                                     autonomico = FALSE) {
  e <- P$estatal
  ov <- if (autonomico) P$jurisdiccion$minimo_autonomico else NULL
  # Prorrateo del mínimo por descendientes/ascendientes: si en tributación
  # individual hay dos declarantes con derecho, se divide entre 2 (art. 61.1ª LIRPF).
  prorrateo <- if (modo == "individual" && length(declarantes(hogar)) > 1) 0.5 else 1
  mc <- modifyList(e$minimo_contribuyente, ov[["minimo_contribuyente"]] %||% list())
  md <- modifyList(e$minimo_descendientes, ov[["minimo_descendientes"]] %||% list())
  ma <- modifyList(e$minimo_ascendientes, ov[["minimo_ascendientes"]] %||% list())
  mdi <- modifyList(e$minimo_discapacidad, ov[["minimo_discapacidad"]] %||% list())
  mdi_desc <- modifyList(mdi, ov[["minimo_discapacidad_descendientes"]] %||% list())
  # mínimo general: algunas CCAA fijan otro importe para mayores de 65 años (Illes Balears)
  general_de <- function(c) if (c$edad > 65 && !is.null(mc[["general_mayor_65"]])) mc[["general_mayor_65"]] else mc$general

  # Contribuyente(s) en el ámbito
  contribs <- if (modo == "conjunta") declarantes(hogar)
              else Filter(function(m) m$id == declarante_id, hogar$miembros)

  min_contrib <- 0
  min_disc_contrib <- 0
  for (c in contribs) {
    m <- general_de(c)
    if (c$edad > 65) m <- m + mc$incremento_mayor_65
    if (c$edad > 75) m <- m + mc$incremento_mayor_75
    # En conjunta el mínimo del contribuyente es 5.550 por la unidad (no por persona),
    # salvo los incrementos por edad de cada uno.
    if (modo == "conjunta") {
      if (identical(c, contribs[[1]])) min_contrib <- min_contrib + general_de(c)
      if (c$edad > 65) min_contrib <- min_contrib + mc$incremento_mayor_65
      if (c$edad > 75) min_contrib <- min_contrib + mc$incremento_mayor_75
    } else {
      min_contrib <- min_contrib + m
    }
    min_disc_contrib <- min_disc_contrib + minimo_discapacidad_persona(c, mdi)
  }

  # Descendientes
  desc <- descendientes(hogar)
  # Filtrar por límites de renta / edad (dependencia)
  desc <- Filter(function(d) {
    (d$rentas_propias %||% 0) <= md$limite_rentas_descendiente &&
      (d$edad < md$edad_maxima || d$discapacidad != "no")
  }, desc)
  min_desc <- 0
  min_disc_desc <- 0
  if (length(desc)) {
    # ordenar (los importes crecen con el orden)
    for (i in seq_along(desc)) {
      d <- desc[[i]]
      imp <- if (i == 1) md$importes[["1"]]
             else if (i == 2) md$importes[["2"]]
             else if (i == 3) md$importes[["3"]]
             else md$importes[["4+"]]
      if (d$edad < 3) imp <- imp + md$incremento_menor_3_anios
      factor <- if ((d$convivencia_meses %||% 12) >= 6) 1 else 0.5
      min_desc <- min_desc + imp * factor * prorrateo
      min_disc_desc <- min_disc_desc + minimo_discapacidad_persona(d, mdi_desc) * prorrateo
    }
  }

  # Ascendientes
  asc <- Filter(function(a) {
    (a$rentas_propias %||% 0) <= ma$limite_rentas_ascendiente &&
      (a$edad >= ma$edad_minima || a$discapacidad != "no") &&
      (a$convivencia_meses %||% 12) >= 6
  }, ascendientes(hogar))
  min_asc <- 0
  min_disc_asc <- 0
  for (a in asc) {
    imp <- ma$importe
    if (a$edad > 75) imp <- imp + ma$incremento_mayor_75
    min_asc <- min_asc + imp * prorrateo
    min_disc_asc <- min_disc_asc + minimo_discapacidad_persona(a, mdi) * prorrateo
  }

  total <- min_contrib + min_desc + min_asc +
    min_disc_contrib + min_disc_desc + min_disc_asc

  list(
    total = total,
    contribuyente = min_contrib,
    descendientes = min_desc,
    ascendientes = min_asc,
    discapacidad = min_disc_contrib + min_disc_desc + min_disc_asc
  )
}

minimo_discapacidad_persona <- function(p, mdi) {
  if (identical(p$discapacidad, "no") || is.null(p$discapacidad)) return(0)
  base <- if (identical(p$discapacidad, "65_mas")) mdi$grado_65_mas else mdi$grado_33_64
  extra <- if (isTRUE(p$ayuda_terceros) || isTRUE(p$movilidad_reducida) ||
               identical(p$discapacidad, "65_mas")) mdi$gastos_asistencia else 0
  base + extra
}
