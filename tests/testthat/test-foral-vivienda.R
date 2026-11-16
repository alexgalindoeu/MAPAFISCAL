# Vivienda en el País Vasco (arts. 86 y 87 de las NF del IRPF, revisión fiscal de 2025):
# cuenta vivienda con base anual común de 8.500 € con la compra, alquiler incrementado de los
# menores de 36 años y de los colectivos. Cálculo a mano en docs/03, «País Vasco: vivienda».

ded_viv <- function(terr, edad, ..., fnum = "no", uf = "ninguna", extra = list()) {
  d1 <- persona("d1", "declarante", edad, trabajo = list(dinerarias = 32000, cotizaciones_ss = 2080), ...)
  h <- nuevo_hogar("v", terr, c(list(d1), extra), 2025, tipo_unidad_familiar = uf, familia_numerosa = fnum)
  liquidar(h, modo = "individual")$deducciones_autonomicas$detalle
}

test_that("Cuenta vivienda: 23 % para menores de 36 con la base que deja libre la compra", {
  d <- ded_viv("ES-PV-BI", 30, adquisicion_vivienda_pagos = 4000, cuenta_vivienda_aportaciones = 6000)
  expect_equal(d$adquisicion_vivienda, 920)     # 23 % de 4.000
  expect_equal(d$cuenta_vivienda, 1035)         # 23 % de (8.500 − 4.000)
})

test_that("Cuenta vivienda: 18 % a partir de los 36 y nada si la compra agota la base", {
  expect_equal(ded_viv("ES-PV-VI", 40, cuenta_vivienda_aportaciones = 5000)$cuenta_vivienda, 900)
  expect_equal(ded_viv("ES-PV-VI", 40, cuenta_vivienda_aportaciones = 12000)$cuenta_vivienda, 1530)
  d <- ded_viv("ES-PV-SS", 45, adquisicion_vivienda_pagos = 10000, cuenta_vivienda_aportaciones = 3000, fnum = "general")
  expect_equal(d$adquisicion_vivienda, 1955)    # familia numerosa: 23 %, límite 1.955
  expect_equal(d$cuenta_vivienda, 0)
})

test_that("Alquiler: 35 % con 2.800 € para menores de 36 y familia numerosa; 20 % el resto", {
  expect_equal(ded_viv("ES-PV-BI", 33, alquiler_vivienda_pagos = 9000)$alquiler_vivienda, 2800)
  expect_equal(ded_viv("ES-PV-BI", 36, alquiler_vivienda_pagos = 6000)$alquiler_vivienda, 1200)
  expect_equal(ded_viv("ES-PV-BI", 40, alquiler_vivienda_pagos = 6000, fnum = "general")$alquiler_vivienda, 2100)
})
