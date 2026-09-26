# =============================================================================
# irpfsim :: pipeline de liquidación — RÉGIMEN COMÚN (territorio común + 15 CCAA)
# =============================================================================

# Agrega las rentas de un conjunto de personas y devuelve los componentes de base
agregar_rentas <- function(personas, P, regimen) {
  trabajo_previo <- 0; otras_rentas_trabajo <- 0
  cap_inmob <- 0
  cap_mob_ahorro <- 0; cap_mob_general <- 0
  actividades <- 0
  imput <- 0
  gan_ahorro <- 0; gan_general <- 0
  prev_social_ind <- 0; prev_social_emp <- 0
  pensiones_comp <- 0
  retenciones <- 0
  anualidades <- 0

  for (pe in personas) {
    t <- rn_trabajo_previo(pe, P, regimen)
    trabajo_previo <- trabajo_previo + t$previo
    ci <- rn_capital_inmobiliario(pe, P, regimen)
    cm <- rn_capital_mobiliario(pe, P, regimen)
    ac <- rn_actividades(pe, P)
    im <- imputacion_inmobiliaria(pe, P)
    cap_inmob <- cap_inmob + ci
    cap_mob_ahorro <- cap_mob_ahorro + cm$ahorro
    cap_mob_general <- cap_mob_general + cm$general
    actividades <- actividades + ac
    imput <- imput + im
    # ganancias
    for (el in (pe$ganancias %||% list())) {
      g <- ganancia_elemento(el, P, regimen)
      gan_ahorro <- gan_ahorro + g$ahorro
      gan_general <- gan_general + g$general
    }
    gan_general <- gan_general + (pe$ganancias_perdidas_no_transmision %||% 0)
    # "otras rentas" para el test del art. 20 (todo lo que no es trabajo)
    otras_rentas_trabajo <- otras_rentas_trabajo + ci + cm$ahorro + cm$general + ac + im
    # reducciones de base
    ps <- pe$prevision_social
    if (!is.null(ps)) {
      prev_social_ind <- prev_social_ind + (ps$aportacion_individual %||% 0)
      prev_social_emp <- prev_social_emp + (ps$contribucion_empresarial %||% 0)
    }
    rd <- pe$reducciones
    if (!is.null(rd)) {
      pensiones_comp <- pensiones_comp + (rd$pensiones_compensatorias %||% 0)
      anualidades <- anualidades + (rd$anualidades_alimentos_hijos %||% 0)
    }
    retenciones <- retenciones + (pe$retenciones %||% 0)
  }

  # Reducción del trabajo (por persona sería lo correcto; aquí se aplica al agregado
  # usando otras_rentas del conjunto — aproximación válida para hogares de 1 perceptor)
  red_trabajo <- 0
  for (pe in personas) {
    tp <- rn_trabajo_previo(pe, P, regimen)
    otras_pe <- otras_rentas_trabajo  # conservador
    # la cuantía se fija sobre el rendimiento sin la letra f); no puede dejar negativo el
    # rendimiento neto ya minorado en ella
    red <- reduccion_trabajo(tp$previo_art20, otras_pe, pe, P, regimen)
    red_trabajo <- red_trabajo + min(red, max(0, tp$previo))
  }
  trabajo_neto <- max(0, trabajo_previo - red_trabajo)

  rend_general <- trabajo_neto + cap_inmob + cap_mob_general + actividades + imput
  ic <- integrar_compensar(rend_general, gan_general, cap_mob_ahorro, gan_ahorro, P)

  list(
    trabajo_neto = trabajo_neto,
    trabajo_previo = trabajo_previo,
    reduccion_trabajo = red_trabajo,
    capital_inmobiliario = cap_inmob,
    capital_mobiliario_ahorro = cap_mob_ahorro,
    capital_mobiliario_general = cap_mob_general,
    actividades = actividades,
    imputaciones = imput,
    ganancias_ahorro = gan_ahorro,
    ganancias_general = gan_general,
    base_imponible_general = ic$base_imponible_general,
    base_imponible_ahorro = ic$base_imponible_ahorro,
    prevision_social_individual = prev_social_ind,
    prevision_social_empresarial = prev_social_emp,
    pensiones_compensatorias = pensiones_comp,
    anualidades_alimentos = anualidades,
    retenciones = retenciones
  )
}

# Reducciones de la base imponible general -> base liquidable
aplicar_reducciones_base <- function(rentas, hogar, P, modo) {
  e <- P$estatal
  big <- rentas$base_imponible_general
  bia <- rentas$base_imponible_ahorro

  # Previsión social (arts. 51-52): aportación individual limitada a min(1.500 €, 30 % de
  # rendimientos del trabajo + actividades); las contribuciones empresariales añaden hasta 8.500 €.
  rs <- e$reduccion_prevision_social
  rend_base <- rentas$trabajo_neto + max(0, rentas$actividades)
  red_ps_ind <- min(rentas$prevision_social_individual, rs$limite_general_abs,
                    rs$limite_general_pct_rend * rend_base)
  red_ps_emp <- min(rentas$prevision_social_empresarial, rs$incremento_contribucion_empresarial)
  red_ps <- min(red_ps_ind + red_ps_emp, max(0, big))
  big <- big - red_ps

  # Pensiones compensatorias (agota BIG; resto a BIA)
  red_pc <- min(rentas$pensiones_compensatorias, max(0, big))
  big <- big - red_pc
  resto_pc <- rentas$pensiones_compensatorias - red_pc
  bia <- max(0, bia - min(resto_pc, bia))

  # Tributación conjunta
  red_conj <- 0
  if (modo == "conjunta") {
    rc <- e$reduccion_tributacion_conjunta
    red_conj <- if (hogar$tipo_unidad_familiar == "monoparental") rc$monoparental else rc$biparental
    aplicado <- min(red_conj, max(0, big))
    big <- big - aplicado
    resto <- red_conj - aplicado
    bia <- max(0, bia - min(resto, bia))
  }

  list(
    base_liquidable_general = max(0, big),
    base_liquidable_ahorro = max(0, bia),
    desglose = list(prevision_social = red_ps, pensiones_compensatorias = red_pc,
                    tributacion_conjunta = red_conj)
  )
}

# Gravamen de una base (general o ahorro) minorando por la parte de mínimo
gravar_con_minimo <- function(base, minimo_aplicable, escala) {
  aplicable <- min(minimo_aplicable, base)
  max(0, aplicar_escala(base, escala) - aplicar_escala(aplicable, escala))
}

# Deducción por obtención de rendimientos del trabajo (DA 61.ª LIRPF, Ley 5/2025).
# Por cada persona del ámbito con rendimientos íntegros del trabajo de una relación
# laboral o estatutaria (no pensiones) inferiores al umbral final y otras rentas no
# superiores al límite: importe según tramo, limitado a la parte de la cuota íntegra
# total que corresponde a esos rendimientos (ver la nota del bloque en estatal.yaml).
deduccion_rendimientos_trabajo <- function(personas, P, cuota_integra_total) {
  d <- P$estatal$deduccion_obtencion_rendimientos_trabajo
  if (is.null(d) || cuota_integra_total <= 0) return(list(total = 0, detalle = list()))
  filas <- lapply(personas, function(pe) {
    tr <- pe$trabajo
    rit <- if (is.null(tr)) 0 else (tr$dinerarias %||% 0) + (tr$especie %||% 0)
    neto <- if (is.null(tr)) 0 else max(0, rit - (tr$cotizaciones_ss %||% 0) - (tr$otros_gastos %||% 0))
    laboral <- !is.null(tr) && !isTRUE(tr$pension_jubilacion)
    cm <- rn_capital_mobiliario(pe, P, "comun")
    gan <- sum(vapply(pe$ganancias %||% list(), function(el) {
      g <- ganancia_elemento(el, P, "comun"); g$ahorro + g$general }, numeric(1))) +
      (pe$ganancias_perdidas_no_transmision %||% 0)
    otras <- max(0, rn_capital_inmobiliario(pe, P, "comun")) + max(0, cm$ahorro) + max(0, cm$general) +
      max(0, rn_actividades(pe, P)) + max(0, imputacion_inmobiliaria(pe, P)) + max(0, gan) +
      (if (laboral) 0 else neto)
    list(id = pe$id, rit = if (laboral) rit else 0, neto = if (laboral) neto else 0, otras = otras)
  })
  denominador <- sum(vapply(filas, function(x) x$neto + x$otras, numeric(1)))
  detalle <- list()
  for (x in filas) {
    if (x$rit <= 0 || x$rit >= d$umbral_final || x$otras > d$limite_otras_rentas) next
    importe <- if (x$rit <= d$umbral_pleno) d$importe_maximo
               else d$importe_maximo - d$coef_reduccion * (x$rit - d$umbral_pleno)
    limite <- if (denominador > 0) cuota_integra_total * x$neto / denominador else 0
    v <- max(0, min(importe, limite))
    if (v > 0) detalle[[x$id]] <- red2(v)
  }
  list(total = sum(unlist(detalle)), detalle = detalle)
}

#' Liquidación en régimen común para un ámbito (individual o conjunta)
liquidar_comun_scope <- function(hogar, P, modo, declarante_id = NULL) {
  regimen <- "comun"
  personas <- if (modo == "conjunta") {
    c(declarantes(hogar),
      Filter(function(m) m$rol == "descendiente", hogar$miembros))
  } else Filter(function(m) m$id == declarante_id, hogar$miembros)

  rentas <- agregar_rentas(personas, P, regimen)
  redb <- aplicar_reducciones_base(rentas, hogar, P, modo)
  blg <- redb$base_liquidable_general
  bla <- redb$base_liquidable_ahorro

  mpf <- minimo_personal_familiar(hogar, P, modo, declarante_id)
  minimo <- mpf$total
  # mínimo para el gravamen autonómico (importes propios de la CCAA, si los tiene)
  mpf_aut <- minimo_personal_familiar(hogar, P, modo, declarante_id, autonomico = TRUE)
  minimo_aut <- mpf_aut$total

  esc_g_est <- P$jurisdiccion$escala_general_estatal
  esc_g_aut <- P$jurisdiccion$escala_general_autonomica
  esc_a_est <- P$jurisdiccion$escala_ahorro_estatal
  esc_a_aut <- P$jurisdiccion$escala_ahorro_autonomica

  # Mínimo: primero contra la base general; remanente contra la del ahorro
  min_en_general <- min(minimo, blg)
  min_en_ahorro  <- max(0, minimo - blg)
  min_aut_en_general <- min(minimo_aut, blg)
  min_aut_en_ahorro  <- max(0, minimo_aut - blg)

  # --- Anualidades por alimentos a hijos (arts. 64/75): escala separada ---
  anual <- rentas$anualidades_alimentos
  if (anual > 0 && modo != "conjunta") {
    inc <- P$estatal$anualidades_alimentos_hijos$incremento_minimo_contribuyente
    cig_est <- aplicar_escala(anual, esc_g_est) + aplicar_escala(max(0, blg - anual), esc_g_est) -
      aplicar_escala(min(minimo + inc, blg), esc_g_est)
    cig_aut <- aplicar_escala(anual, esc_g_aut) + aplicar_escala(max(0, blg - anual), esc_g_aut) -
      aplicar_escala(min(minimo_aut + inc, blg), esc_g_aut)
    cig_est <- max(0, cig_est); cig_aut <- max(0, cig_aut)
  } else {
    cig_est <- gravar_con_minimo(blg, min_en_general, esc_g_est)
    cig_aut <- gravar_con_minimo(blg, min_aut_en_general, esc_g_aut)
  }

  cia_est <- gravar_con_minimo(bla, min_en_ahorro, esc_a_est)
  cia_aut <- gravar_con_minimo(bla, min_aut_en_ahorro, esc_a_aut)

  cuota_integra_estatal    <- cig_est + cia_est
  cuota_integra_autonomica <- cig_aut + cia_aut

  # --- Deducciones ---
  ded_est <- deducciones_estatales(hogar, P, rentas, blg + bla, personas = personas)
  ded_aut <- deducciones_autonomicas(hogar, P, rentas, modo, blg + bla,
                                     cuota_integra_autonomica = cuota_integra_autonomica,
                                     minimo = minimo, declarante_id = declarante_id)

  cl_est <- max(0, cuota_integra_estatal - ded_est$total_estatal)
  cl_aut <- max(0, cuota_integra_autonomica - ded_aut$total - ded_est$total_autonomico)

  # Bonificación Ceuta/Melilla (art. 68.4): reduce ambas cuotas
  bonif <- P$jurisdiccion$bonificacion_residencia
  bonif_cm <- 0
  if (!is.null(bonif)) {
    b <- bonif$porcentaje
    bonif_cm <- (cl_est + cl_aut) * b
    cl_est <- cl_est * (1 - b)
    cl_aut <- cl_aut * (1 - b)
  }

  cuota_liquida_total <- cl_est + cl_aut

  # Deducción por obtención de rendimientos del trabajo (DA 61.ª): se resta de la cuota
  # líquida total (tras la de doble imposición internacional, no modelada) y da la cuota
  # resultante de la autoliquidación, que no puede ser negativa
  drt <- deduccion_rendimientos_trabajo(personas, P, cuota_integra_estatal + cuota_integra_autonomica)
  drt$total <- red2(min(drt$total, cuota_liquida_total))
  cuota_resultante <- cuota_liquida_total - drt$total

  # Deducciones "impropias" (pueden dar negativo -> devolución)
  impropias <- deducciones_impropias(hogar, P, rentas, modo = modo, declarante_id = declarante_id)

  cuota_diferencial <- cuota_resultante - rentas$retenciones - impropias$total

  base_imponible_total <- rentas$base_imponible_general + rentas$base_imponible_ahorro
  tme <- if (base_imponible_total > 0) cuota_resultante / base_imponible_total else 0

  list(
    modo = modo,
    componentes_renta = rentas,
    base_imponible_general = rentas$base_imponible_general,
    base_imponible_ahorro = rentas$base_imponible_ahorro,
    reducciones_base = redb$desglose,
    base_liquidable_general = blg,
    base_liquidable_ahorro = bla,
    minimo_personal_familiar = mpf,
    minimo_personal_familiar_autonomico = mpf_aut,
    cuota_integra_estatal = red2(cuota_integra_estatal),
    cuota_integra_autonomica = red2(cuota_integra_autonomica),
    cuota_integra_total = red2(cuota_integra_estatal + cuota_integra_autonomica),
    deducciones_estatales = ded_est,
    deducciones_autonomicas = ded_aut,
    bonificacion_residencia = red2(bonif_cm),
    cuota_liquida_estatal = red2(cl_est),
    cuota_liquida_autonomica = red2(cl_aut),
    cuota_liquida_total = red2(cuota_liquida_total),
    deduccion_rendimientos_trabajo = drt,
    cuota_resultante_autoliquidacion = red2(cuota_resultante),
    retenciones = red2(rentas$retenciones),
    deducciones_cuota_diferencial = impropias,
    cuota_diferencial = red2(cuota_diferencial),
    tipo_medio_efectivo = round(tme, 4)
  )
}
