# Rescate del plan de pensiones (R/16_rescate_plan.R). Cálculo a mano en docs/03,
# «Rescate del plan de pensiones».

test_that("plazos de la DT 12.ª.4", {
  P <- cargar_parametros("ES-MD", 2026)
  expect_true(dt12_en_plazo(2026, 2026, P))
  expect_true(dt12_en_plazo(2024, 2026, P))      # el año de la contingencia y los dos siguientes
  expect_false(dt12_en_plazo(2023, 2026, P))
  expect_true(dt12_en_plazo(2014, 2022, P))      # 2011-2014: hasta el octavo ejercicio siguiente
  expect_false(dt12_en_plazo(2012, 2026, P))
  expect_true(dt12_en_plazo(2008, 2018, P))      # antes de 2011: hasta el 31-12-2018
  expect_false(dt12_en_plazo(2008, 2026, P))
  expect_false(dt12_en_plazo(2027, 2026, P))     # cobro antes de la contingencia
})

test_that("capital con la reducción del 40 %: Madrid 2026, 75.000 € con 30.000 anteriores a 2007", {
  P <- cargar_parametros("ES-MD", 2026)
  h <- function(dt12) nuevo_hogar("r", "ES-MD", list(persona("d1", "declarante", 66,
    trabajo = list(dinerarias = 75000, cotizaciones_ss = 0, prestacion_dt12 = dt12))), 2026)
  con <- liquidar(h(30000), P); sin <- liquidar(h(0), P)
  # 75.000 − 40 % de 30.000 = 63.000; − 2.000 de otros gastos = 61.000 (sin reducción del art. 20)
  expect_equal(con$base_liquidable_general, 61000, tolerance = 0.01)
  expect_equal(sin$base_liquidable_general - con$base_liquidable_general, 12000, tolerance = 0.01)
  # cuota estatal: escala sobre 61.000 (9.175,75) − mínimo de 6.700 € al 9,5 % (636,50)
  expect_equal(con$cuota_integra_estatal, 8539.25, tolerance = 0.01)
})

test_that("rescate_plan: capital, renta y mixto", {
  r <- rescate_plan("ES-MD", 2026, 30000, 30000, otros_ingresos = 15000, anio_contingencia = 2026, anios = 5)
  expect_true(r$en_plazo)
  expect_equal(r$reduccion, 12000)
  expect_equal(r$capital$cobros, 60000)
  expect_equal(r$renta$cobros, rep(12000, 5))
  expect_equal(r$mixto$cobros, c(36000, rep(6000, 4)))
  expect_equal(r$capital$extra, sum(r$capital$anual))
  expect_equal(r$mejor, names(which.min(c(capital = r$capital$extra, renta = r$renta$extra, mixto = r$mixto$extra))))
  # fuera de plazo no hay reducción: el capital tributa entero
  f <- rescate_plan("ES-MD", 2026, 30000, 30000, otros_ingresos = 15000, anio_contingencia = 2020, anios = 5)
  expect_false(f$en_plazo)
  expect_equal(f$reduccion, 0)
  expect_gt(f$capital$extra, r$capital$extra)
  # sin nada anterior a 2007, el mixto es la renta
  s <- rescate_plan("ES-EX", 2026, 0, 45000, otros_ingresos = 18000, anios = 3)
  expect_equal(s$mixto$extra, s$renta$extra)
  expect_error(rescate_plan("ES-PV-BI", 2026, 10000, 10000), "régimen común")
})
