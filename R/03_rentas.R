# =============================================================================
# irpfsim :: cálculo de rendimientos netos, ganancias (DT 9ª) e integración
# =============================================================================
# Estas funciones son COMUNES a los tres regímenes en cuanto a la definición de
# la renta. Lo que difiere entre regímenes (reducción del trabajo, exención de
# dividendos, coeficientes de actualización) se inyecta vía `P` (parámetros) y el
# argumento `regimen`.
# =============================================================================

# --- Rendimientos del trabajo -------------------------------------------------

# Rendimiento neto PREVIO a la reducción del trabajo (art. 19: íntegro - gastos)
rn_trabajo_previo <- function(pers, P, regimen = "comun") {
  tr <- pers$trabajo
  if (is.null(tr)) return(list(previo = 0, integro = 0))
  integro <- (tr$dinerarias %||% 0) + (tr$especie %||% 0)
  # rendimiento irregular: reducción del 30 % sobre base máx. (art. 18.2)
  irr <- tr$rendimiento_irregular %||% NULL
  if (!is.null(irr) && (irr$importe %||% 0) > 0 && (irr$anios %||% 0) > 2) {
    red_irr <- min(irr$importe, P$estatal$trabajo_reduccion_irregular$base_maxima) *
      P$estatal$trabajo_reduccion_irregular$porcentaje
    integro <- integro - red_irr
  }
  # "Otros gastos" del art. 19.2.f (2.000 € genéricos + incrementos): SOLO régimen común.
  # En el País Vasco y Navarra el ajuste equivalente va por la bonificación / reducción
  # propia del trabajo (ver reduccion_trabajo()).
  otros <- 0
  if (regimen == "comun") {
    og <- P$estatal$trabajo_otros_gastos
    otros <- og$generico
    if (isTRUE(tr$movilidad_geografica)) otros <- otros + og$incremento_movilidad_geografica
    if (identical(pers$discapacidad, "33_64") && isTRUE(tr$trabajador_activo_discapacidad))
      otros <- otros + og$incremento_discapacidad_33_64
    if ((identical(pers$discapacidad, "65_mas") || isTRUE(pers$movilidad_reducida)) &&
        isTRUE(tr$trabajador_activo_discapacidad))
      otros <- otros + og$incremento_discapacidad_65_o_movilidad
  }
  gastos <- (tr$cotizaciones_ss %||% 0) + (tr$otros_gastos %||% 0) + min(otros, max(0, integro))
  previo <- integro - gastos
  list(previo = previo, integro = integro)
}

# Reducción del trabajo según régimen
reduccion_trabajo <- function(rn_previo, otras_rentas, pers, P, regimen) {
  if (rn_previo <= 0) return(0)
  if (regimen == "comun") {
    a <- P$estatal$trabajo_reduccion_art20
    if (otras_rentas > a$limite_otras_rentas) return(0)
    if (rn_previo <= a$umbral_pleno) return(min(a$importe_maximo, rn_previo))
    if (rn_previo <= a$umbral_intermedio)
      return(max(0, a$importe_maximo - a$coef_tramo1 * (rn_previo - a$umbral_pleno)))
    if (rn_previo <= a$umbral_final)
      return(max(0, a$base_tramo2 - a$coef_tramo2 * (rn_previo - a$umbral_intermedio)))
    return(0)
  }
  if (regimen == "foral_pais_vasco") {
    b <- P$jurisdiccion$bonificacion_trabajo
    base <- if (otras_rentas > b$limite_otras_rentas) b$importe_minimo
            else if (rn_previo < b$umbral_pleno) b$importe_pleno
            else if (rn_previo <= b$umbral_minimo)
              max(b$importe_minimo, b$importe_pleno - b$coef_reduccion * (rn_previo - b$umbral_pleno))
            else b$importe_minimo
    # incremento por discapacidad del trabajador activo
    mult <- 1
    if (identical(pers$discapacidad, "33_64") && isTRUE(pers$trabajo$trabajador_activo_discapacidad))
      mult <- 1 + b$incremento_discapacidad_33_64
    if ((identical(pers$discapacidad, "65_mas") || isTRUE(pers$movilidad_reducida)) &&
        isTRUE(pers$trabajo$trabajador_activo_discapacidad))
      mult <- 1 + b$incremento_discapacidad_65_o_movilidad
    return(min(base * mult, rn_previo))
  }
  # Navarra: el beneficio va por la deducción por trabajo en cuota (art. 62.5),
  # no por reducción de la base -> aquí 0.
  0
}

# Deducción por trabajo en cuota — Navarra (art. 62.5 DFL 4/2008)
deduccion_trabajo_navarra <- function(rnt, pers, P) {
  dt <- P$jurisdiccion$deduccion_trabajo_cuota
  if (is.null(dt) || rnt <= 0) return(0)
  val <- 0
  for (tr in dt$tramos) {
    if (is.infinite(tr$hasta) || rnt <= tr$hasta) {
      val <- tr$base - (tr$coef %||% 0) * (rnt - (tr$desde %||% 0))
      break
    }
  }
  val <- max(0, val)
  if (identical(pers$discapacidad, "33_64") && isTRUE(pers$trabajo$trabajador_activo_discapacidad))
    val <- val * (1 + dt$incremento_discapacidad_33_64)
  if (identical(pers$discapacidad, "65_mas") && isTRUE(pers$trabajo$trabajador_activo_discapacidad))
    val <- val * (1 + dt$incremento_discapacidad_65_mas)
  # tope: escala del art. 59.1 sobre los RNT
  min(val, aplicar_escala(rnt, P$jurisdiccion$escala_general_foral$tramos))
}

# --- Capital inmobiliario ----------------------------------------------------
rn_capital_inmobiliario <- function(pers, P, regimen) {
  inms <- pers$capital_inmobiliario
  if (is.null(inms) || !length(inms)) return(0)
  total <- 0
  for (im in inms) {
    ingresos <- im$ingresos %||% 0
    gastos   <- (im$gastos_deducibles %||% 0) + (im$gastos_financieros %||% 0)
    neto     <- ingresos - gastos
    if (isTRUE(im$arrendamiento_vivienda) && neto > 0) {
      if (regimen == "comun") {
        r <- P$estatal$capital_inmobiliario$reduccion_arrendamiento_vivienda
        pct <- switch(im$tipo_arrendamiento %||% "general",
                      "zona_tensionada_bajada" = r$zona_tensionada_bajada_renta,
                      "joven_o_admon" = r$primer_alquiler_joven_o_admon,
                      "rehabilitacion" = r$rehabilitacion_reciente,
                      r$general)
        neto <- neto * (1 - pct)
      } else if (regimen == "foral_pais_vasco") {
        ci <- P$jurisdiccion$capital_inmobiliario
        pct <- switch(im$tipo_arrendamiento %||% "vivienda_habitual",
                      "zona_tensionada" = ci$bonificacion_zona_tensionada,
                      "programas_publicos" = ci$bonificacion_programas_publicos,
                      "vivienda_habitual" = ci$bonificacion_vivienda_habitual,
                      ci$bonificacion_general)
        # modelo foral: bonificación sobre ingresos íntegros + gastos financieros reales
        neto <- ingresos * (1 - pct) - (im$gastos_financieros %||% 0)
      }
    }
    total <- total + neto
  }
  total
}

# --- Capital mobiliario ----------------------------------------------------
rn_capital_mobiliario <- function(pers, P, regimen) {
  cm <- pers$capital_mobiliario
  if (is.null(cm)) return(list(ahorro = 0, general = 0))
  dividendos <- cm$dividendos %||% 0
  exencion <- 0
  if (regimen == "foral_pais_vasco")
    exencion <- min(dividendos, P$jurisdiccion$exencion_dividendos$importe %||% 0)
  ahorro <- (dividendos - exencion) + (cm$intereses %||% 0) + (cm$seguros %||% 0) +
            (cm$cesion_terceros_general %||% 0)
  general <- cm$base_general_otros %||% 0   # arrendamiento negocios, PI de terceros, etc.
  list(ahorro = ahorro, general = general)
}

# --- Actividades económicas ------------------------------------------------
rn_actividades <- function(pers, P) {
  ac <- pers$actividades
  if (is.null(ac)) return(0)
  metodo <- ac$metodo %||% "directa_normal"
  if (metodo == "objetiva") {
    if (is.null(ac$rendimiento_neto_modulos)) {
      registrar_aviso("Actividad en estimación objetiva sin `rendimiento_neto_modulos`: subsistema de módulos PENDIENTE (Orden HFP 2025). Se toma 0.")
      return(0)
    }
    return(ac$rendimiento_neto_modulos)
  }
  rnp <- ac$rendimiento_neto_previo %||% 0
  if (metodo == "directa_simplificada") {
    s <- P$estatal$actividades_directa_simplificada
    rnp <- rnp - min(s$gastos_dificil_justificacion_pct * max(0, rnp),
                     s$gastos_dificil_justificacion_max)
  }
  if (isTRUE(ac$inicio_actividad) && rnp > 0) {
    ri <- P$estatal$actividades_reduccion_inicio
    rnp <- rnp - min(rnp, ri$rendimiento_maximo) * ri$porcentaje
  }
  rnp
}

# --- Imputación de rentas inmobiliarias -----------------------------------
imputacion_inmobiliaria <- function(pers, P) {
  ii <- pers$imputacion_inmobiliaria
  if (is.null(ii)) return(0)
  tipo <- if (isTRUE(ii$revisado_10_anios)) P$estatal$imputacion_renta_inmobiliaria$tipo_revisado_10_anios
          else P$estatal$imputacion_renta_inmobiliaria$tipo_general
  (ii$valor_catastral %||% 0) * tipo
}

# --- Ganancias patrimoniales + DT 9ª (abatimiento pre-1994) --------------
.anio <- function(fecha) as.integer(substr(as.character(fecha), 1, 4))

ganancia_elemento <- function(el, P, regimen) {
  if (isTRUE(el$exenta)) return(list(ahorro = 0, general = 0))
  vt <- el$valor_transmision %||% 0
  va <- el$valor_adquisicion %||% 0
  ganancia <- vt - va
  es_transmision <- el$es_transmision %||% TRUE
  if (!es_transmision) return(list(ahorro = 0, general = ganancia))
  if (ganancia <= 0) return(list(ahorro = ganancia, general = 0))  # pérdida -> ahorro

  # DT 9ª: solo si adquirido antes de 1994-12-31
  dt <- if (regimen == "comun") P$estatal$dt9_abatimiento else P$jurisdiccion$dt_abatimiento_pre1994
  if (!is.null(dt) && !is.null(el$fecha_adquisicion) &&
      as.Date(el$fecha_adquisicion) <= as.Date(dt$fecha_corte_adquisicion)) {
    # parte de la ganancia generada hasta 2006-01-20 (prorrateo lineal por días)
    d_total <- as.numeric(as.Date(el$fecha_transmision %||% "2025-12-31") - as.Date(el$fecha_adquisicion))
    d_pre   <- as.numeric(as.Date("2006-01-20") - as.Date(el$fecha_adquisicion))
    frac_pre <- if (d_total > 0) min(1, max(0, d_pre / d_total)) else 1
    ganancia_pre <- ganancia * frac_pre
    # años de permanencia (redondeo al alza) que exceden de 2 a 1996-12-31
    anios <- ceiling(as.numeric(as.Date("1996-12-31") - as.Date(el$fecha_adquisicion)) / 365.25)
    exceso <- max(0, anios - 2)
    coef <- switch(el$tipo_elemento %||% "resto",
                   "inmueble" = dt$coeficientes_por_anio_exceso$inmuebles,
                   "accion_cotizada" = dt$coeficientes_por_anio_exceso$acciones_cotizadas,
                   dt$coeficientes_por_anio_exceso$resto)
    reduccion <- min(1, exceso * coef) * ganancia_pre
    # límite de 400.000 € de valor de transmisión acumulado: se controla fuera (aquí se marca)
    ganancia <- ganancia - reduccion
  }
  list(ahorro = ganancia, general = 0)
}

# --- Integración y compensación (arts. 47-49) ---------------------------
integrar_compensar <- function(rend_general, ganancias_generales,
                               rend_mobil_ahorro, ganancias_ahorro, P) {
  ic <- P$estatal$integracion_compensacion
  # BASE GENERAL: rendimientos+imputaciones ilimitado; pérdidas patrimoniales
  # no derivadas de transmisión compensan hasta el 25 % del saldo positivo.
  saldo_rend_gen <- rend_general
  saldo_gan_gen  <- ganancias_generales
  if (saldo_gan_gen < 0 && saldo_rend_gen > 0) {
    comp <- min(-saldo_gan_gen, saldo_rend_gen * ic$base_general_limite_perdidas_pct)
    saldo_gan_gen  <- saldo_gan_gen + comp
    saldo_rend_gen <- saldo_rend_gen - comp
  }
  big <- saldo_rend_gen + saldo_gan_gen
  # BASE DEL AHORRO: compensación cruzada rendimientos<->ganancias hasta el 25 %.
  s_mob <- rend_mobil_ahorro
  s_gan <- ganancias_ahorro
  if (s_mob < 0 && s_gan > 0) {
    comp <- min(-s_mob, s_gan * ic$base_ahorro_limite_compensacion_pct)
    s_mob <- s_mob + comp; s_gan <- s_gan - comp
  } else if (s_gan < 0 && s_mob > 0) {
    comp <- min(-s_gan, s_mob * ic$base_ahorro_limite_compensacion_pct)
    s_gan <- s_gan + comp; s_mob <- s_mob - comp
  }
  bia <- s_mob + s_gan
  list(base_imponible_general = big, base_imponible_ahorro = max(0, bia))
}
