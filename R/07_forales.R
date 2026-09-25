# =============================================================================
# irpfsim :: módulos forales — País Vasco (3 TH) y Navarra
# =============================================================================
# Estructura distinta del régimen común:
#   - tarifa foral única (sin escala estatal + autonómica)
#   - circunstancias familiares -> deducción de cuota (no mínimo en base)
# =============================================================================

# ---------------------------------------------------------------------------
# PAÍS VASCO
# ---------------------------------------------------------------------------
liquidar_pais_vasco_scope <- function(hogar, P, modo, declarante_id = NULL) {
  regimen <- "foral_pais_vasco"
  J <- P$jurisdiccion
  personas <- if (modo == "conjunta")
    c(declarantes(hogar), Filter(function(m) m$rol == "descendiente", hogar$miembros))
  else Filter(function(m) m$id == declarante_id, hogar$miembros)

  rentas <- agregar_rentas(personas, P, regimen)
  big <- rentas$base_imponible_general
  bia <- rentas$base_imponible_ahorro

  # Reducciones de la base imponible general
  rs <- J$reduccion_prevision_social
  aport_pv <- (rentas$prevision_social_individual %||% 0) + (rentas$prevision_social_empresarial %||% 0)
  red_ps <- min(aport_pv, rs$limite_conjunto %||% 12000, max(0, big))
  big <- big - red_ps
  red_pc <- min(rentas$pensiones_compensatorias, max(0, big))
  big <- big - red_pc
  red_conj <- 0
  if (modo == "conjunta") {
    red_conj <- J$reduccion_tributacion_conjunta$importe
    big <- max(0, big - red_conj)
  }
  blg <- max(0, big); bla <- max(0, bia)

  # Cuota íntegra: tarifa foral única
  cig <- aplicar_escala(blg, J$escala_general_foral$tramos %||% J$escala_general_foral)
  cia <- aplicar_escala(bla, J$escala_ahorro_foral$tramos %||% J$escala_ahorro_foral)
  cuota_integra <- cig + cia

  # Minoración de cuota
  min_cuota_importe <- J$minoracion_cuota$importe_gipuzkoa %||% J$minoracion_cuota$importe %||% 1583
  if (J$nombre == "Bizkaia")     min_cuota_importe <- J$minoracion_cuota$importe_bizkaia %||% min_cuota_importe
  if (J$nombre == "Araba/Álava") min_cuota_importe <- J$minoracion_cuota$importe_araba %||% min_cuota_importe
  n_autoliq <- if (modo == "conjunta") 1 else 1
  minoracion <- min_cuota_importe * n_autoliq

  # Deducciones familiares y personales
  ded <- deducciones_forales_pv(hogar, J, modo, blg + bla, declarante_id)

  cuota_liquida <- max(0, cuota_integra - minoracion - ded$total)
  cuota_diferencial <- cuota_liquida - rentas$retenciones

  bit <- rentas$base_imponible_general + rentas$base_imponible_ahorro
  tme <- if (bit > 0) cuota_liquida / bit else 0

  list(
    modo = modo,
    componentes_renta = rentas,
    base_imponible_general = rentas$base_imponible_general,
    base_imponible_ahorro = rentas$base_imponible_ahorro,
    reducciones_base = list(prevision_social = red_ps, pensiones_compensatorias = red_pc,
                            tributacion_conjunta = red_conj),
    base_liquidable_general = blg,
    base_liquidable_ahorro = bla,
    minimo_personal_familiar = list(total = 0, nota = "Régimen foral: circunstancias familiares vía deducción de cuota"),
    cuota_integra_estatal = 0,
    cuota_integra_autonomica = red2(cuota_integra),
    cuota_integra_total = red2(cuota_integra),
    minoracion_cuota = red2(minoracion),
    deducciones_autonomicas = ded,
    deducciones_estatales = list(total_estatal = 0, total_autonomico = 0, detalle = list()),
    cuota_liquida_estatal = 0,
    cuota_liquida_autonomica = red2(cuota_liquida),
    cuota_liquida_total = red2(cuota_liquida),
    deduccion_rendimientos_trabajo = list(total = 0, detalle = list()),   # DA 61.ª: solo régimen común
    cuota_resultante_autoliquidacion = red2(cuota_liquida),
    retenciones = red2(rentas$retenciones),
    deducciones_cuota_diferencial = list(total = 0, detalle = list()),
    cuota_diferencial = red2(cuota_diferencial),
    tipo_medio_efectivo = round(tme, 4)
  )
}

deducciones_forales_pv <- function(hogar, J, modo, base_total, declarante_id = NULL) {
  det <- list(); total <- 0
  prorr <- if (modo == "individual" && length(declarantes(hogar)) > 1) 0.5 else 1
  # personas cuyas circunstancias y gastos propios cuentan en este ámbito
  decs <- declarantes(hogar)
  ambito <- if (modo == "conjunta" || is.null(declarante_id)) decs
            else Filter(function(p) identical(p$id, declarante_id), decs)

  # Descendientes (importes crecientes por orden)
  dd <- J$deduccion_descendientes
  desc <- descendientes(hogar)
  desc <- Filter(function(d) (d$rentas_propias %||% 0) <= 8000, desc)
  if (length(desc)) {
    sd <- 0
    for (i in seq_along(desc)) {
      key <- if (i <= 4) as.character(i) else "5+"
      imp <- dd$importes[[key]] %||% dd$importes[["5+"]]
      if ((desc[[i]]$edad %||% 99) < 6) imp <- imp + (dd$incremento_menor_6_anios %||% 0)
      sd <- sd + imp
    }
    sd <- sd * prorr
    det$descendientes <- red2(sd); total <- total + sd
  }

  # Ascendientes
  asc <- Filter(function(a) (a$rentas_propias %||% 0) <= 8000 &&
                  (a$convivencia_meses %||% 12) >= 6, ascendientes(hogar))
  if (length(asc)) {
    v <- length(asc) * (J$deduccion_ascendientes$importe %||% 0) * prorr
    det$ascendientes <- red2(v); total <- total + v
  }

  # Discapacidad: la propia (personas del ámbito) y la de familiares (prorrateada)
  dsc <- J$deduccion_discapacidad
  importe_disc <- function(p) {
    if (identical(p$discapacidad, "33_64")) dsc$grado_33_64
    else if (identical(p$discapacidad, "65_mas"))
      (if (isTRUE(p$ayuda_terceros)) dsc$grado_75_40_puntos_o_gran_dependencia
       else dsc$grado_65_mas_o_dependencia_moderada)
    else 0
  }
  disc_total <- sum(vapply(ambito, importe_disc, numeric(1))) +
    prorr * sum(vapply(c(desc, asc), importe_disc, numeric(1)))
  if (disc_total > 0) { det$discapacidad <- red2(disc_total); total <- total + disc_total }

  # Edad (65 / 75 años): cada contribuyente del ámbito
  de <- J$deduccion_edad
  for (p in ambito) {
    if ((p$edad %||% 0) < 65) next
    cfg <- if (p$edad >= 75) de$individual$edad_75 else de$individual$edad_65
    base_ded <- base_total
    val <- if (base_ded <= cfg$base_plena) cfg$importe
           else if (base_ded >= cfg$base_cero) 0
           else max(0, cfg$importe - cfg$coef_reduccion * (base_ded - cfg$base_plena))
    if (val > 0) { det$edad <- red2((det$edad %||% 0) + val); total <- total + val }
  }

  # Alquiler / adquisición de vivienda habitual: pagos propios de las personas del ámbito
  for (m in ambito) {
    alq <- m$alquiler_vivienda_pagos %||% 0
    if (alq > 0) {
      da <- J$deduccion_alquiler_vivienda
      cfg <- if (isTRUE(m$colectivo_especial_vivienda)) da$colectivo_especial else da$general
      v <- min(alq * cfg$porcentaje, cfg$limite)
      det$alquiler_vivienda <- red2((det$alquiler_vivienda %||% 0) + v); total <- total + v
    }
    adq <- m$adquisicion_vivienda_pagos %||% 0
    if (adq > 0) {
      dq <- J$deduccion_adquisicion_vivienda
      cfg <- if ((m$edad %||% 99) < 36) dq$menor_36
             else if (isTRUE(m$colectivo_especial_vivienda)) dq$colectivo_especial
             else dq$general
      v <- min(adq * cfg$porcentaje, cfg$limite_anual)
      det$adquisicion_vivienda <- red2((det$adquisicion_vivienda %||% 0) + v); total <- total + v
    }
  }

  list(detalle = det, total = red2(total))
}

# ---------------------------------------------------------------------------
# NAVARRA
# ---------------------------------------------------------------------------
liquidar_navarra_scope <- function(hogar, P, modo, declarante_id = NULL) {
  regimen <- "foral_navarra"
  J <- P$jurisdiccion
  personas <- if (modo == "conjunta")
    c(declarantes(hogar), Filter(function(m) m$rol == "descendiente", hogar$miembros))
  else Filter(function(m) m$id == declarante_id, hogar$miembros)

  rentas <- agregar_rentas(personas, P, regimen)
  blg <- max(0, rentas$base_imponible_general - min(rentas$pensiones_compensatorias, rentas$base_imponible_general))
  bla <- rentas$base_imponible_ahorro

  cig <- aplicar_escala(blg, J$escala_general_foral$tramos)
  cia <- aplicar_escala(bla, J$escala_ahorro_foral$tramos)
  cuota_integra <- cig + cia

  # Deducción por trabajo en cuota (art. 62.5) — por perceptor
  ded_trabajo <- 0
  for (pe in personas) {
    rnt <- rn_trabajo_previo(pe, P, "foral_navarra")$previo
    if (rnt > 0) ded_trabajo <- ded_trabajo + deduccion_trabajo_navarra(rnt, pe, P)
  }

  # Deducción por mínimo personal (importe fijo; mayor para bases bajas) — art. 62.9.a
  mp <- J$minimo_personal_deduccion
  base_total <- blg + bla
  n_contrib <- if (modo == "conjunta") length(declarantes(hogar)) else 1
  ded_min <- 0
  # contribuyentes del ámbito: en individual, el declarante que se liquida (no el primero)
  contribs_nv <- if (modo == "conjunta" || is.null(declarante_id)) declarantes(hogar)
                 else Filter(function(p) identical(p$id, declarante_id), declarantes(hogar))
  if (modo != "conjunta" && is.null(declarante_id)) contribs_nv <- declarantes(hogar)[1]
  for (c in contribs_nv) {
    inc <- if (base_total <= (mp$umbral_pleno %||% 17500)) (mp$incremento_rentas_bajas %||% 0)
           else if (base_total >= (mp$umbral_cero_incremento %||% 32000)) 0
           else (mp$incremento_rentas_bajas %||% 0) *
             (1 - (base_total - mp$umbral_pleno) / (mp$umbral_cero_incremento - mp$umbral_pleno))
    m <- (mp$importe_general %||% 0) + max(0, inc)
    if ((c$edad %||% 0) >= 65) m <- m + (mp$incremento_65 %||% 0)
    if ((c$edad %||% 0) >= 75) m <- m + (mp$incremento_75 %||% 0)
    if (identical(c$discapacidad, "33_64")) m <- m + (mp$incremento_discapacidad_33_64 %||% 0)
    if (identical(c$discapacidad, "65_mas")) m <- m + (mp$incremento_discapacidad_65_mas %||% 0)
    ded_min <- ded_min + m
  }

  # Deducción por mínimo familiar — art. 62.9.b (descendientes y ascendientes).
  # Prorrateo entre progenitores en tributación individual (art. 62.9).
  mf <- J$minimo_familiar_deduccion
  prorr_nv <- if (modo == "individual" && length(declarantes(hogar)) > 1) 0.5 else 1
  ded_fam <- 0
  if (!is.null(mf)) {
    dd <- mf$descendientes
    desc_nv <- Filter(function(d) (d$rentas_propias %||% 0) <= (mf$limite_rentas_familiar %||% 8000),
                      descendientes(hogar))
    for (i in seq_along(desc_nv)) {
      d <- desc_nv[[i]]
      key <- if (i <= 5) as.character(i) else "6+"
      imp <- dd$importes[[key]] %||% dd$importes[["6+"]] %||% 0
      if ((d$edad %||% 99) < 3) imp <- imp + (dd$incremento_menor_3_anios %||% 0)
      if (identical(d$discapacidad, "33_64")) imp <- imp + (dd$incremento_discapacidad_33_64 %||% 0)
      if (identical(d$discapacidad, "65_mas")) imp <- imp + (dd$incremento_discapacidad_65_mas %||% 0)
      ded_fam <- ded_fam + imp * prorr_nv
    }
    aa <- mf$ascendientes
    asc_nv <- Filter(function(a) (a$rentas_propias %||% 0) <= (mf$limite_rentas_familiar %||% 8000) &&
                       ((a$edad %||% 0) >= 65 || a$discapacidad != "no"), ascendientes(hogar))
    for (a in asc_nv) {
      imp <- if ((a$edad %||% 0) >= 75) (aa$importe_75 %||% 0) else (aa$importe_65 %||% 0)
      if (identical(a$discapacidad, "33_64")) imp <- imp + (aa$incremento_discapacidad_33_64 %||% 0)
      if (identical(a$discapacidad, "65_mas")) imp <- imp + (aa$incremento_discapacidad_65_mas %||% 0)
      ded_fam <- ded_fam + imp * prorr_nv
    }
  } else {
    registrar_aviso("[ES-NC] mínimo familiar no cargado.")
  }

  bit <- rentas$base_imponible_general + rentas$base_imponible_ahorro
  cuota_disponible <- max(0, cuota_integra - ded_min - ded_fam - ded_trabajo)

  # Alquiler (art. 62.2, cuota) y emancipación (art. 68 quinquies.A, cuota diferencial):
  # incompatibles entre sí; se aplica la más favorable. Pagos propios del ámbito.
  alq <- sum(vapply(contribs_nv, function(p) p$alquiler_vivienda_pagos %||% 0, numeric(1)))
  da <- J$deduccion_alquiler_vivienda; de <- J$deduccion_emancipacion
  ded_alq <- 0; ded_eman <- 0
  if (alq > 0 && !is.null(da)) {
    joven <- any(vapply(contribs_nv, function(p) (p$edad %||% 99) < da$joven_o_monoparental$edad_max, logical(1))) ||
      identical(hogar$tipo_unidad_familiar, "monoparental")
    cfg <- if (joven) da$joven_o_monoparental else da$general
    if (bit <= da$rentas_max && alq > da$umbral_esfuerzo * bit)
      ded_alq <- min(alq * cfg$porcentaje, cfg$limite, cuota_disponible)
  }
  if (alq > 0 && !is.null(de)) {
    edad_ok <- any(vapply(contribs_nv, function(p) {
      e <- p$edad %||% 0; e >= de$edad_min && e <= de$edad_max }, logical(1)))
    en_uf <- length(declarantes(hogar)) > 1 || length(descendientes(hogar)) > 0
    lim_r <- if (en_uf) de$rentas_max_unidad_familiar else de$rentas_max_individual
    if (edad_ok && bit <= lim_r) ded_eman <- min(alq * de$porcentaje, 12 * de$limite_mensual)
  }
  if (ded_eman > 0 && ded_eman >= ded_alq) ded_alq <- 0 else ded_eman <- 0

  # Pensión de jubilación contributiva (art. 68.B, cuota diferencial): hasta 14.490 €
  dp <- J$deduccion_pension_jubilacion; ded_pen <- 0
  if (!is.null(dp)) for (p in contribs_nv) {
    tr <- p$trabajo
    pen <- tr$dinerarias %||% 0
    if (isTRUE(tr$pension_jubilacion) && pen > 0 && pen < dp$umbral) {
      d <- dp$umbral - pen
      lim <- if (length(declarantes(hogar)) > 1) dp$rentas_max_unidad_familiar else dp$rentas_max_individual
      exceso <- (bit + d) - lim
      if (exceso > 0) d <- max(0, d - exceso)
      ded_pen <- ded_pen + d
    }
  }

  cuota_liquida <- max(0, cuota_disponible - ded_alq)
  ded_cd <- ded_eman + ded_pen
  cuota_diferencial <- cuota_liquida - rentas$retenciones - ded_cd
  tme <- if (bit > 0) cuota_liquida / bit else 0
  det_cd <- list()
  if (ded_eman > 0) det_cd$emancipacion <- red2(ded_eman)
  if (ded_pen > 0) det_cd$pension_jubilacion <- red2(ded_pen)
  det_aut <- list(minimo_personal = red2(ded_min), minimo_familiar = red2(ded_fam), trabajo = red2(ded_trabajo))
  if (ded_alq > 0) det_aut$alquiler_vivienda <- red2(ded_alq)

  list(
    modo = modo,
    componentes_renta = rentas,
    base_imponible_general = rentas$base_imponible_general,
    base_imponible_ahorro = rentas$base_imponible_ahorro,
    reducciones_base = list(),
    base_liquidable_general = blg,
    base_liquidable_ahorro = bla,
    minimo_personal_familiar = list(total = red2(ded_min + ded_fam),
      nota = "Navarra: mínimo personal y familiar como deducción de cuota"),
    cuota_integra_estatal = 0,
    cuota_integra_autonomica = red2(cuota_integra),
    cuota_integra_total = red2(cuota_integra),
    deducciones_autonomicas = list(total = red2(ded_min + ded_fam + ded_trabajo + ded_alq),
      detalle = det_aut),
    deducciones_estatales = list(total_estatal = 0, total_autonomico = 0, detalle = list()),
    cuota_liquida_estatal = 0,
    cuota_liquida_autonomica = red2(cuota_liquida),
    cuota_liquida_total = red2(cuota_liquida),
    deduccion_rendimientos_trabajo = list(total = 0, detalle = list()),   # DA 61.ª: solo régimen común
    cuota_resultante_autoliquidacion = red2(cuota_liquida),
    retenciones = red2(rentas$retenciones),
    deducciones_cuota_diferencial = list(total = red2(ded_cd), detalle = det_cd),
    cuota_diferencial = red2(cuota_diferencial),
    tipo_medio_efectivo = round(tme, 4)
  )
}
