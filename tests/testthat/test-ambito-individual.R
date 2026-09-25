# Tributación individual de una pareja: cada declarante se liquida en su propio
# ámbito. Sus gastos y circunstancias personales cuentan solo en su declaración; las
# deducciones familiares se reparten por mitades. Ver docs/03_casos_validacion.md.

pareja <- function(territorio, d1_extra = list(), d2_extra = list(), hijos = list(),
                   familia_numerosa = "no") {
  d1 <- do.call(persona, c(list("d1", "declarante", 30,
                  trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905)), d1_extra))
  d2 <- do.call(persona, c(list("d2", "conyuge", 45,
                  trabajo = list(dinerarias = 28000, cotizaciones_ss = 1778)), d2_extra))
  nuevo_hogar("p", territorio, c(list(d1, d2), hijos), tipo_unidad_familiar = "biparental",
              familia_numerosa = familia_numerosa)
}
ambito <- function(h, id) {
  P <- cargar_parametros(h$territorio)
  if (P$meta$regimen == "comun") liquidar_comun_scope(h, P, "individual", id)
  else liquidar_pais_vasco_scope(h, P, "individual", id)
}

test_that("el alquiler lo deduce solo quien lo paga, con su propia edad (Madrid)", {
  h <- pareja("ES-MD", d1_extra = list(alquiler_vivienda_pagos = 9000))
  # d1 (30 años) paga 9.000 €: 30 % = 2.700 -> tope 1.237,20
  expect_equal(ambito(h, "d1")$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual, 1237.2)
  # d2 no paga alquiler (y además tiene 45 años): nada
  expect_null(ambito(h, "d2")$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual)
})

test_that("los requisitos de edad se miran en el declarante del ámbito, no en el primero", {
  # el alquiler lo paga d2, de 45 años: no cumple el requisito de < 40 de Madrid
  h <- pareja("ES-MD", d2_extra = list(alquiler_vivienda_pagos = 9000))
  expect_null(ambito(h, "d2")$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual)
  expect_null(ambito(h, "d1")$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual)
})

test_that("maternidad (art. 81) se aplica una sola vez en la pareja", {
  h <- pareja("ES-MD", hijos = list(persona("h1", "descendiente", 1)))
  m1 <- ambito(h, "d1")$deducciones_cuota_diferencial$detalle$maternidad
  m2 <- ambito(h, "d2")$deducciones_cuota_diferencial$detalle$maternidad
  expect_equal(sum(c(m1, m2)), 1200)
})

test_that("familia numerosa estatal (art. 81 bis) se prorratea por mitades", {
  hijos <- lapply(1:3, function(i) persona(paste0("h", i), "descendiente", 4 + i))
  h <- pareja("ES-MD", hijos = hijos, familia_numerosa = "general")
  expect_equal(ambito(h, "d1")$deducciones_cuota_diferencial$detalle$familia_numerosa, 600)
  expect_equal(ambito(h, "d2")$deducciones_cuota_diferencial$detalle$familia_numerosa, 600)
})

test_that("deducciones familiares autonómicas: reparto por defecto y excepción de Cataluña", {
  nacido <- list(persona("h1", "descendiente", 0, nacido_en_ejercicio = TRUE))
  # Castilla y León: 1.010 € por el primer hijo, repartidos entre los dos progenitores
  h <- pareja("ES-CL", hijos = nacido)
  expect_equal(ambito(h, "d1")$deducciones_autonomicas$detalle$nacimiento_adopcion, 505)
  # Cataluña: 150 € a cada progenitor en individual (no se reparten)
  h2 <- pareja("ES-CT", hijos = nacido)
  expect_equal(ambito(h2, "d1")$deducciones_autonomicas$detalle$nacimiento_adopcion, 150)
  expect_equal(ambito(h2, "d2")$deducciones_autonomicas$detalle$nacimiento_adopcion, 150)
})

test_that("País Vasco: alquiler y discapacidad propios solo en el ámbito de su titular", {
  h <- pareja("ES-PV-SS", d1_extra = list(alquiler_vivienda_pagos = 6000, discapacidad = "33_64"))
  a1 <- ambito(h, "d1")$deducciones_autonomicas$detalle
  a2 <- ambito(h, "d2")$deducciones_autonomicas$detalle
  expect_equal(a1$alquiler_vivienda, 1200)          # 20 % de 6.000 (límite 1.600)
  expect_null(a2$alquiler_vivienda)
  expect_gt(a1$discapacidad, 0)
  expect_null(a2$discapacidad)
})
