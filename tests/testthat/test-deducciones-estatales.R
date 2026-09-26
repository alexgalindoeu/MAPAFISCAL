# Deducciones estatales de la cuota (art. 68 LIRPF): donativos (Ley 49/2002) y vivienda
# habitual en régimen transitorio (DT 18.ª). Desarrollo en docs/03_casos_validacion.md,
# sección «Deducciones estatales: donativos y vivienda».

asalariado <- function(terr, ...) nuevo_hogar("e", terr, list(persona("d1", "declarante", 40,
  trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905), ...)))

test_that("Donativos: la BASE se limita al 10 % de la base liquidable (art. 69.1), no la deducción", {
  l <- liquidar(asalariado("ES-CM", donativos = 5000))
  # base liquidable 26.095 -> base de la deducción mín(5.000; 2.609,50) = 2.609,50
  # 250 × 80 % + 2.359,50 × 40 % = 200 + 943,80 = 1.143,80 (antes: 2.100 sobre los 5.000)
  expect_equal(l$deducciones_estatales$detalle$donativos, 1143.80)
  expect_equal(l$deducciones_estatales$total_estatal, 571.90)
  expect_equal(l$deducciones_estatales$total_autonomico, 571.90)
  expect_equal(l$cuota_liquida_total, 4939.50 - 1143.80)
})

test_that("Donativos: 80 % hasta 250 € y 45 % del resto si son recurrentes", {
  expect_equal(liquidar(asalariado("ES-CM", donativos = 150))$deducciones_estatales$detalle$donativos, 120)
  expect_equal(liquidar(asalariado("ES-CM", donativos = 1000))$deducciones_estatales$detalle$donativos, 500)
  expect_equal(liquidar(asalariado("ES-CM", donativos = 1000, donativos_recurrentes = TRUE))$deducciones_estatales$detalle$donativos,
               537.50)   # 200 + 750 × 45 %
})

test_that("Vivienda habitual (régimen transitorio): 7,5 % + 7,5 % sobre un máximo de 9.040 €", {
  l <- liquidar(asalariado("ES-MD", vivienda_transitoria_pagos = 12000))
  expect_equal(l$deducciones_estatales$detalle$vivienda_transitoria, 1356)   # 9.040 × 15 %
  expect_equal(l$cuota_liquida_estatal, 2469.75 - 678)
  expect_equal(l$cuota_liquida_autonomica, 2140.78 - 678)
  expect_equal(liquidar(asalariado("ES-MD", vivienda_transitoria_pagos = 4000))$deducciones_estatales$detalle$vivienda_transitoria, 600)
})

test_that("Sin gastos no hay deducciones estatales", {
  l <- liquidar(asalariado("ES-CM"))
  expect_equal(l$deducciones_estatales$total_estatal, 0)
  expect_equal(l$deducciones_estatales$total_autonomico, 0)
})
