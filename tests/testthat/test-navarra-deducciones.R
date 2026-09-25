# Navarra: alquiler (art. 62.2), emancipación (art. 68 quinquies.A) y pensión de
# jubilación (art. 68.B). Fuente: LF 22/2023 y LF 20/2024 (BOE). Ver docs/03.

nc <- function(miembros, uf = "ninguna") nuevo_hogar("n", "ES-NC", miembros, tipo_unidad_familiar = uf)
ded <- function(h, modo = "individual") liquidar(h, modo = modo)

test_that("alquiler general: 15 % con límite 1.500 € (rentas <= 30.000, alquiler > 10 %)", {
  # rn trabajo = 25.000 − 1.587 = 23.413 (en Navarra la reducción del trabajo va en cuota)
  h <- nc(list(persona("d1", "declarante", 40, trabajo = list(dinerarias = 25000, cotizaciones_ss = 1587),
                       alquiler_vivienda_pagos = 6000)))
  l <- ded(h)
  expect_equal(l$deducciones_autonomicas$detalle$alquiler_vivienda, 900)      # 15 % de 6.000
  expect_null(l$deducciones_cuota_diferencial$detalle$emancipacion)             # 40 años: no
})

test_that("alquiler: sin deducción si las rentas superan 30.000 € o el alquiler no llega al 10 %", {
  alta <- nc(list(persona("d1", "declarante", 40, trabajo = list(dinerarias = 40000, cotizaciones_ss = 2540),
                          alquiler_vivienda_pagos = 9000)))
  expect_null(ded(alta)$deducciones_autonomicas$detalle$alquiler_vivienda)
  poco <- nc(list(persona("d1", "declarante", 40, trabajo = list(dinerarias = 25000, cotizaciones_ss = 1587),
                          alquiler_vivienda_pagos = 2000)))                     # 2.000 < 10 % de 23.413
  expect_null(ded(poco)$deducciones_autonomicas$detalle$alquiler_vivienda)
})

test_that("emancipación (23-35 años): 50 % hasta 280 €/mes, reembolsable, excluye la del art. 62.2", {
  # rn = 20.000 − 1.270 = 18.730 <= 22.000 ; 50 % de 7.200 = 3.600 -> tope 3.360
  h <- nc(list(persona("d1", "declarante", 28, trabajo = list(dinerarias = 20000, cotizaciones_ss = 1270),
                       alquiler_vivienda_pagos = 7200)))
  l <- ded(h)
  expect_equal(l$deducciones_cuota_diferencial$detalle$emancipacion, 3360)
  expect_null(l$deducciones_autonomicas$detalle$alquiler_vivienda)
  expect_equal(l$cuota_diferencial, round(l$cuota_liquida_total - 3360, 2))
})

test_that("pensión de jubilación contributiva: complemento hasta 14.490 € con límite de rentas", {
  p1 <- persona("d1", "declarante", 70, trabajo = list(dinerarias = 12000, cotizaciones_ss = 0,
                                                        pension_jubilacion = TRUE))
  expect_equal(ded(nc(list(p1)))$deducciones_cuota_diferencial$detalle$pension_jubilacion, 2490)
  # con 8.000 € de intereses: rentas 21.000 + deducción 1.490 superan 21.619,59 en 870,41
  p2 <- persona("d1", "declarante", 70, trabajo = list(dinerarias = 13000, cotizaciones_ss = 0,
                                                        pension_jubilacion = TRUE),
                capital_mobiliario = list(intereses = 8000))
  expect_equal(ded(nc(list(p2)))$deducciones_cuota_diferencial$detalle$pension_jubilacion, 619.59)
  # un salario (no pensión) no da derecho
  p3 <- persona("d1", "declarante", 60, trabajo = list(dinerarias = 12000, cotizaciones_ss = 762))
  expect_null(ded(nc(list(p3)))$deducciones_cuota_diferencial$detalle$pension_jubilacion)
})

test_that("mínimo personal en individual: cada declarante con su edad", {
  h <- nc(list(persona("d1", "declarante", 40, trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905)),
               persona("d2", "conyuge", 70, trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905))),
          uf = "biparental")
  P <- cargar_parametros("ES-NC")
  m1 <- liquidar_navarra_scope(h, P, "individual", "d1")$deducciones_autonomicas$detalle$minimo_personal
  m2 <- liquidar_navarra_scope(h, P, "individual", "d2")$deducciones_autonomicas$detalle$minimo_personal
  expect_equal(m2 - m1, P$jurisdiccion$minimo_personal_deduccion$incremento_65)   # +264 € por tener >= 65
})
