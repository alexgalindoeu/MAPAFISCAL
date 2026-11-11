# =============================================================================
# irpfsim :: cotizaciones del trabajador a la Seguridad Social y sueldo neto anual
# =============================================================================
# Parámetros: bloque `cotizaciones_trabajador` de params/<año>/estatal.yaml (órdenes de
# cotización de cada año). Espejo en web/js/irpfsim.js (cotizacionesTrabajador,
# sueldoNeto), validado al céntimo en tools/validar_js.R. Cálculo a mano en docs/03,
# sección «Cotizaciones del trabajador y sueldo neto».
# =============================================================================

.bloque_cotizaciones <- function(P) {
  ct <- P$estatal$cotizaciones_trabajador %||% P$cotizaciones_trabajador
  if (is.null(ct)) stop("irpfsim: faltan los parámetros `cotizaciones_trabajador`.", call. = FALSE)
  ct
}

#' Desglose anual de la cotización a cargo del trabajador (Régimen General).
#'
#' Base mensual = bruto anual / 12 (pagas extra prorrateadas), hasta la base máxima. Por
#' debajo de la base mínima de jornada completa se entiende jornada parcial, cuya base
#' mínima se reduce en proporción, y se cotiza por la retribución. La parte de la
#' retribución mensual que excede la base máxima paga la cotización adicional de
#' solidaridad (art. 19 bis LGSS) por tramos.
#' @param bruto_anual retribución anual sujeta a cotización (€)
#' @param P parámetros del ejercicio (con `$estatal`) o el propio bloque estatal
#' @param tipo_contrato "indefinido" o "temporal" (duración determinada)
cotizaciones_trabajador_detalle <- function(bruto_anual, P, tipo_contrato = "indefinido") {
  if (!tipo_contrato %in% c("indefinido", "temporal"))
    stop("irpfsim: tipo_contrato debe ser 'indefinido' o 'temporal'.", call. = FALSE)
  ct <- .bloque_cotizaciones(P)
  t <- ct$tipos
  mensual <- max(0, bruto_anual %||% 0) / 12
  base <- min(mensual, ct$base_maxima_mensual)
  tipo <- t$contingencias_comunes + t$formacion_profesional + t$mei +
    if (tipo_contrato == "temporal") t$desempleo_temporal else t$desempleo_indefinido
  # solidaridad: tramos de retribución mensual por encima de la base máxima
  sol <- 0; desde <- ct$base_maxima_mensual
  for (tr in ct$solidaridad$tramos) {
    hasta <- tr$hasta %||% Inf
    if (mensual > desde) sol <- sol + (min(mensual, hasta) - desde) * tr$tipo
    desde <- hasta
  }
  list(
    base_mensual = red2(base),
    tipo = tipo,
    contingencias_comunes = red2(12 * base * t$contingencias_comunes),
    desempleo = red2(12 * base * (if (tipo_contrato == "temporal") t$desempleo_temporal else t$desempleo_indefinido)),
    formacion_profesional = red2(12 * base * t$formacion_profesional),
    mei = red2(12 * base * t$mei),
    ordinaria = red2(12 * base * tipo),
    solidaridad = red2(12 * sol),
    total = red2(12 * base * tipo + 12 * sol)
  )
}

#' Cotización anual del trabajador a la Seguridad Social (€).
cotizaciones_trabajador <- function(bruto_anual, P, tipo_contrato = "indefinido")
  cotizaciones_trabajador_detalle(bruto_anual, P, tipo_contrato)$total

#' Sueldo neto anual tras la declaración (no es la retención de la nómina).
#'
#' neto = bruto − cotizaciones del trabajador − IRPF del año, donde el IRPF es la cuota
#' resultante de la autoliquidación menos las deducciones que se restan de la cuota
#' diferencial (maternidad, familia numerosa…): es decir, la cuota diferencial con
#' retenciones nulas. Las retenciones son anticipos de ese mismo impuesto.
#' @param hijos edades de los hijos (0 = nacido en el ejercicio)
#' @param aportacion_plan aportación propia a planes de pensiones (€/año)
#' @param donativos donativos a entidades de la Ley 49/2002 (€/año)
sueldo_neto <- function(bruto_anual, territorio, ejercicio = 2025, edad = 40, hijos = integer(),
                        tipo_contrato = "indefinido", aportacion_plan = 0, donativos = 0,
                        donativos_recurrentes = FALSE) {
  P <- cargar_parametros(territorio, ejercicio)
  cot <- cotizaciones_trabajador(bruto_anual, P, tipo_contrato)
  d1 <- persona("d1", "declarante", edad,
                trabajo = if (bruto_anual > 0) list(dinerarias = bruto_anual, cotizaciones_ss = cot) else NULL,
                prevision_social = if (aportacion_plan > 0) list(aportacion_individual = aportacion_plan) else NULL,
                donativos = donativos, donativos_recurrentes = donativos_recurrentes)
  desc <- lapply(seq_along(hijos), function(i)
    persona(paste0("h", i), "descendiente", hijos[[i]], nacido_en_ejercicio = hijos[[i]] == 0))
  h <- nuevo_hogar("neto", territorio, c(list(d1), desc), ejercicio,
                   tipo_unidad_familiar = if (length(hijos)) "monoparental" else "ninguna")
  liq <- liquidar(h, P)
  irpf <- red2(liq$cuota_resultante_autoliquidacion - (liq$deducciones_cuota_diferencial$total %||% 0))
  list(bruto = bruto_anual, cotizaciones = cot, irpf = irpf,
       neto = red2(bruto_anual - cot - irpf), liquidacion = liq)
}
