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
# Forales (`prestaciones_prevision_capital` de su YAML):
# - País Vasco: el primer cobro en capital se integra al 60 % hasta 300.000 € (arts. 18.a).3.ª
#   y 19.2.a) de las NF del IRPF), sin corte por fecha de aportación; mixto = hasta 300.000 €
#   en capital el primer año y el resto en renta.
# - Navarra: reducción del 40 % de lo aportado hasta 2017 (`antes_2007` hace de «antes del
#   corte»), en el año de la contingencia o los dos siguientes (DT 25.ª, LF 16/2017).
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
  reg <- P$meta$regimen
  pc <- P$jurisdiccion$prestaciones_prevision_capital
  if (reg != "comun" && is.null(pc))
    stop("irpfsim: el rescate del plan no está en el motor para este territorio.", call. = FALSE)
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
  en_plazo <- if (reg == "comun") dt12_en_plazo(anio_contingencia, ejercicio, P)
              else if (reg == "foral_pais_vasco") TRUE
              else foral_nc_en_plazo(anio_contingencia, ejercicio, pc)
  sin <- irpf(0, 0)
  extra <- function(cobros, dt12_primero) {
    anual <- vapply(seq_along(cobros), function(i)
      red2(irpf(cobros[[i]], if (i == 1) dt12_primero else 0) - sin), numeric(1))
    list(extra = red2(sum(anual)), anual = anual, cobros = cobros)
  }
  tot <- antes_2007 + despues_2007
  if (reg == "foral_pais_vasco") {
    cap <- min(tot, pc$limite %||% Inf); resto <- tot - cap
    dt12 <- tot
    mixto <- extra(c(cap + resto / anios, rep(resto / anios, anios - 1)), cap)
  } else {
    dt12 <- if (en_plazo) antes_2007 else 0
    mixto <- extra(c(antes_2007 + despues_2007 / anios, rep(despues_2007 / anios, anios - 1)), dt12)
  }
  r <- list(capital = extra(tot, dt12), renta = extra(rep(tot / anios, anios), 0), mixto = mixto)
  pct <- if (reg == "comun") P$estatal$prestaciones_prevision_dt12$porcentaje else pc$porcentaje_reduccion
  reduccion <- red2(min(dt12, if (reg == "comun") Inf else pc$limite %||% Inf) * pct)
  corte <- if (reg == "comun") 2007L else if (reg == "foral_navarra") as.integer(pc$anio_corte_aportaciones) else NA_integer_
  orden <- c("capital", "renta", "mixto")
  mejor <- orden[1]
  for (k in orden[-1]) if (r[[k]]$extra < r[[mejor]]$extra - 0.005) mejor <- k
  c(list(en_plazo = en_plazo, reduccion = reduccion, regimen = reg, corte = corte,
         irpf_sin = sin, anios = anios, mejor = mejor), r)
}

#' Navarra (DT 25.ª TR IRPF): contingencias desde 2018, cobro ese año o los dos siguientes;
#' anteriores, hasta 2020.
foral_nc_en_plazo <- function(anio_contingencia, anio_cobro, pc) {
  if (is.null(anio_contingencia) || is.na(anio_contingencia) || anio_cobro < anio_contingencia) return(FALSE)
  if (anio_contingencia >= pc$anio_regimen) return(anio_cobro <= anio_contingencia + pc$plazo_anios)
  anio_cobro <= pc$ultimo_anio_anterior
}
