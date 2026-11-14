# Rescate del plan de pensiones o la EPSV en los forales (R/16_rescate_plan.R). Cálculo a
# mano en docs/03, «Forales: planes de pensiones, EPSV y rescate».

test_that("País Vasco: el primer cobro en capital se integra al 60 % hasta 300.000 €", {
  r <- rescate_plan("ES-PV-BI", 2026, 30000, 50000, otros_ingresos = 15000, anios = 5)
  expect_true(r$en_plazo)
  expect_equal(r$reduccion, 32000)          # 40 % de 80.000
  expect_equal(r$regimen, "foral_pais_vasco")
  # por debajo del tope, el mixto es el capital
  expect_equal(r$mixto$extra, r$capital$extra)
  # con 350.000 €, la reducción se queda en el 40 % de 300.000
  g <- rescate_plan("ES-PV-SS", 2025, 0, 350000, otros_ingresos = 20000, anios = 10)
  expect_equal(g$reduccion, 120000)
  expect_equal(g$mixto$cobros[[1]], 300000 + 5000)
  # la reducción equivale a cobrar el 60 %: capital de 80.000 = 48.000 sin reducción
  h <- function(x) { liq <- liquidar(nuevo_hogar("x", "ES-PV-BI", list(persona("d1", "declarante", 65,
    trabajo = list(dinerarias = x))), 2026)); liq$cuota_resultante_autoliquidacion }
  expect_equal(r$capital$extra, red2(h(15000 + 48000) - h(15000)))
})

test_that("Navarra: 40 % de lo aportado hasta 2017, el año de la contingencia o los dos siguientes", {
  r <- rescate_plan("ES-NC", 2026, 40000, 20000, otros_ingresos = 15000, anio_contingencia = 2025, anios = 4)
  expect_true(r$en_plazo)
  expect_equal(r$reduccion, 16000)
  expect_equal(r$corte, 2018L)
  f <- rescate_plan("ES-NC", 2026, 40000, 20000, otros_ingresos = 15000, anio_contingencia = 2022, anios = 4)
  expect_false(f$en_plazo)
  expect_equal(f$reduccion, 0)
  expect_gt(f$capital$extra, r$capital$extra)
  expect_true(foral_nc_en_plazo(2017, 2020, list(anio_regimen = 2018, plazo_anios = 2, ultimo_anio_anterior = 2020)))
  expect_false(foral_nc_en_plazo(2017, 2021, list(anio_regimen = 2018, plazo_anios = 2, ultimo_anio_anterior = 2020)))
})
