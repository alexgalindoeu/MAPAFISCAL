# Porcentajes de reducción del alquiler de vivienda leídos de params y fecha de transmisión
# por defecto (31-12 del ejercicio). Cálculo a mano en docs/03, sección «Alquiler de vivienda:
# porcentajes de params; fecha de transmisión por defecto (2026-11-23)».

P25 <- cargar_parametros("ES-MD", 2025)
P26 <- cargar_parametros("ES-MD", 2026)
P_bi <- cargar_parametros("ES-PV-BI", 2025)

alquiler <- function(tipo, ingresos = 10000, gfin = 1000, gded = 1000)
  persona("d1", capital_inmobiliario = list(list(ingresos = ingresos, gastos_financieros = gfin,
    gastos_deducibles = gded, arrendamiento_vivienda = TRUE, tipo_arrendamiento = tipo)))

test_that("Régimen común: reducción del alquiler de vivienda según params (art. 23.2 LIRPF)", {
  # rendimiento neto previo 10.000 − 1.000 − 1.000 = 8.000
  expect_equal(rn_capital_inmobiliario(alquiler("general"), P25, "comun"), 8000 * (1 - 0.50))
  expect_equal(rn_capital_inmobiliario(alquiler("zona_tensionada_bajada"), P25, "comun"), 8000 * (1 - 0.90))
  expect_equal(rn_capital_inmobiliario(alquiler("joven_o_admon"), P25, "comun"), 8000 * (1 - 0.70))
  expect_equal(rn_capital_inmobiliario(alquiler("rehabilitacion"), P25, "comun"), 8000 * (1 - 0.60))
  expect_equal(rn_capital_inmobiliario(alquiler("desconocido"), P25, "comun"), 4000)
  # el porcentaje sale de params: si cambia el parámetro, cambia el resultado
  Pm <- P25; Pm$estatal$capital_inmobiliario$reduccion_arrendamiento_vivienda$general <- 0.25
  expect_equal(rn_capital_inmobiliario(alquiler("general"), Pm, "comun"), 6000)
})

test_that("País Vasco: bonificación sobre ingresos íntegros según params", {
  # ingresos 10.000 × (1 − bonificación) − 1.000 de gastos financieros
  expect_equal(rn_capital_inmobiliario(alquiler(NULL), P_bi, "foral_pais_vasco"), 10000 * 0.70 - 1000)
  expect_equal(rn_capital_inmobiliario(alquiler("zona_tensionada"), P_bi, "foral_pais_vasco"), 10000 * 0.30 - 1000)
  expect_equal(rn_capital_inmobiliario(alquiler("programas_publicos"), P_bi, "foral_pais_vasco"), 10000 * 0.30 - 1000)
  expect_equal(rn_capital_inmobiliario(alquiler("otro"), P_bi, "foral_pais_vasco"), 10000 * 0.80 - 1000)
  Pm <- P_bi; Pm$jurisdiccion$capital_inmobiliario$bonificacion_general <- 0.50
  expect_equal(rn_capital_inmobiliario(alquiler("otro"), Pm, "foral_pais_vasco"), 4000)
})

test_that("DT 9.ª sin fecha de transmisión: se toma el 31-12 del ejercicio", {
  el <- list(valor_transmision = 50000, valor_adquisicion = 10000, fecha_adquisicion = "1990-06-01",
             tipo_elemento = "accion_cotizada", es_transmision = TRUE)
  # 7 años a 31-12-1996 -> exceso 5 × 25 % = 100 %: se abate toda la ganancia anterior al 20-01-2006
  # 2025: 40.000 × (12.997 − 5.712) / 12.997 = 22.420,56
  expect_equal(ganancia_elemento(el, P25, "comun")$ahorro, 40000 * 7285 / 12997)
  expect_equal(round(ganancia_elemento(el, P25, "comun")$ahorro, 2), 22420.56)
  # 2026: 40.000 × (13.362 − 5.712) / 13.362 = 22.900,76 (antes, con 2025-12-31 fijo, 22.420,56)
  expect_equal(round(ganancia_elemento(el, P26, "comun")$ahorro, 2), 22900.76)
  # equivale a dar la fecha 31-12 explícita
  for (P in list(P25, P26)) {
    el2 <- el; el2$fecha_transmision <- sprintf("%d-12-31", P$meta$ejercicio)
    expect_equal(ganancia_elemento(el, P, "comun"), ganancia_elemento(el2, P, "comun"))
  }
})
