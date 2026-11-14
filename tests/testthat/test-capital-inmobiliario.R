# Capital inmobiliario e imputación de rentas inmobiliarias: datos que pide la calculadora.
# Cálculo a mano en docs/03, sección «Alquileres: tope de intereses y reparación; varias
# imputaciones (2026-11-12)».

P_md <- cargar_parametros("ES-MD", 2025)

test_that("Intereses y reparación no superan los ingresos de cada inmueble (art. 23.1.a.1.º LIRPF)", {
  # local: 6.000 € de ingresos, 9.000 € de intereses y reparación (tope 6.000) y 1.000 € de
  # amortización e IBI -> rendimiento neto -1.000 €
  pe <- persona("d1", capital_inmobiliario = list(list(ingresos = 6000, gastos_financieros = 9000,
                                                       gastos_deducibles = 1000)))
  expect_equal(rn_capital_inmobiliario(pe, P_md, "comun"), -1000)
  # por debajo del tope no cambia nada: 10.000 - 3.000 - 2.000 = 5.000; vivienda, reducción 50 %
  pe2 <- persona("d1", capital_inmobiliario = list(list(ingresos = 10000, gastos_financieros = 3000,
    gastos_deducibles = 2000, arrendamiento_vivienda = TRUE, tipo_arrendamiento = "general")))
  expect_equal(rn_capital_inmobiliario(pe2, P_md, "comun"), 2500)
  # el tope es por inmueble: el exceso de uno no se compensa con los ingresos de otro
  pe3 <- persona("d1", capital_inmobiliario = list(
    list(ingresos = 6000, gastos_financieros = 9000), list(ingresos = 4000, gastos_deducibles = 500)))
  expect_equal(rn_capital_inmobiliario(pe3, P_md, "comun"), 3500)
})

test_that("Varias imputaciones de inmuebles a disposición se suman (art. 85 LIRPF)", {
  pe <- persona("d1", imputacion_inmobiliaria = list(
    list(valor_catastral = 100000, revisado_10_anios = TRUE),    # 1,1 % -> 1.100
    list(valor_catastral = 50000, revisado_10_anios = FALSE)))   # 2 %   -> 1.000
  expect_equal(imputacion_inmobiliaria(pe, P_md), 2100)
  # la forma de un solo inmueble sigue valiendo
  expect_equal(imputacion_inmobiliaria(persona("d1", imputacion_inmobiliaria =
    list(valor_catastral = 50000)), P_md), 1000)
})
