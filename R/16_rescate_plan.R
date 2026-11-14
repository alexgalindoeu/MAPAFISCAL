# =============================================================================
# irpfsim :: rescate de un plan de pensiones (régimen común)
# =============================================================================
# Lo cobrado de un plan de pensiones es rendimiento del trabajo (art. 17.2.a.3.º LIRPF).
# Si se cobra en forma de capital, la parte que corresponde a lo aportado hasta el
# 31-12-2006 puede reducirse un 40 % (DT 12.ª LIRPF), en un único ejercicio y dentro de los
# plazos de la DT 12.ª.4. Parámetros: `prestaciones_prevision_dt12` de
# params/<año>/estatal.yaml. Espejo en web/js/irpfsim.js (dt12EnPlazo, rescatePlan),
# validado al céntimo en tools/validar_js.R. Cálculo a mano en docs/03, «Rescate del plan
# de pensiones».
#
# El País Vasco y Navarra regulan el rescate en su normativa foral (integración del 60 % del
# primer cobro en capital con sus propios límites y reglas transitorias): pendiente de
# incorporar con las normas forales del IRPF (BOB, BOG, BOTHA, BON); aquí se rechazan.
# =============================================================================

#' ¿Se puede aplicar la reducción de la DT 12.ª a lo cobrado en `anio_cobro`?
dt12_en_plazo <- function(anio_contingencia, anio_cobro, P) {
  d <- P$estatal$prestaciones_prevision_dt12
  if (is.null(anio_contingencia) || is.na(anio_contingencia) || anio_cobro < anio_contingencia) return(FALSE)
  if (anio_contingencia >= d$anio_regimen_2015)
    return(anio_cobro <= anio_contingencia + d$plazo_desde_2015_anios)
  if (anio_contingencia >= d$anio_regimen_2011)
    return(anio_cobro <= anio_contingencia + d$plazo_2011_2014_anios)
  anio_cobro <= d$ultimo_anio_anterior_2011
}

#' IRPF extra de rescatar un plan de pensiones de tres formas.
#'
#' - capital: todo en el primer año (el del ejercicio), con la reducción del 40 % de lo
#'   anterior a 2007 si está en plazo;
#' - renta: en `anios` cobros anuales iguales, sin reducción;
#' - mixto: lo anterior a 2007 en capital el primer año (con la reducción) y lo posterior en
#'   `anios` cobros anuales iguales.
#' Los demás ingresos del trabajo (`otros_ingresos`, pensión o sueldo) se repiten cada año, y
#' cada año se liquida con la normativa del ejercicio. IRPF = cuota resultante menos las
#' deducciones de la cuota diferencial (como en sueldo_neto()).
rescate_plan <- function(territorio, ejercicio, antes_2007, despues_2007, otros_ingresos = 0,
                         tipo_otros = "pension", edad = 65, anio_contingencia = ejercicio, anios = 5) {
  P <- cargar_parametros(territorio, ejercicio)
  if (P$meta$regimen != "comun")
    stop("irpfsim: el rescate del plan solo está en el motor para el régimen común.", call. = FALSE)
  anios <- max(1L, min(30L, as.integer(anios)))
  antes_2007 <- max(0, antes_2007); despues_2007 <- max(0, despues_2007)
  cot <- if (tipo_otros == "sueldo") cotizaciones_trabajador(otros_ingresos, P) else 0
  irpf <- function(rescate, dt12) {
    tot <- otros_ingresos + rescate
    d1 <- persona("d1", "declarante", edad,
                  trabajo = if (tot > 0) list(dinerarias = tot, cotizaciones_ss = cot, prestacion_dt12 = dt12) else NULL)
    liq <- liquidar(nuevo_hogar("rescate", territorio, list(d1), ejercicio), P)
    red2(liq$cuota_resultante_autoliquidacion - (liq$deducciones_cuota_diferencial$total %||% 0))
  }
  en_plazo <- dt12_en_plazo(anio_contingencia, ejercicio, P)
  sin <- irpf(0, 0)
  extra <- function(cobros, dt12_primero) {
    anual <- vapply(seq_along(cobros), function(i)
      red2(irpf(cobros[[i]], if (i == 1) dt12_primero else 0) - sin), numeric(1))
    list(extra = red2(sum(anual)), anual = anual, cobros = cobros)
  }
  dt12 <- if (en_plazo) antes_2007 else 0
  r <- list(
    capital = extra(antes_2007 + despues_2007, dt12),
    renta = extra(rep((antes_2007 + despues_2007) / anios, anios), 0),
    mixto = extra(c(antes_2007 + despues_2007 / anios, rep(despues_2007 / anios, anios - 1)), dt12)
  )
  orden <- c("capital", "renta", "mixto")
  mejor <- orden[1]
  for (k in orden[-1]) if (r[[k]]$extra < r[[mejor]]$extra - 0.005) mejor <- k
  c(list(en_plazo = en_plazo, reduccion = red2(dt12 * P$estatal$prestaciones_prevision_dt12$porcentaje),
         irpf_sin = sin, anios = anios, mejor = mejor), r)
}
