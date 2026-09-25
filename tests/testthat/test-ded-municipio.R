# Deducciones condicionadas al municipio de residencia (población y/o lista oficial de
# zonas rurales o en riesgo de despoblación). Fuente: AEAT Manual Renta 2025, Parte 2.

hog <- function(terr, miembros, municipio = NULL, despoblada = FALSE, uf = "ninguna")
  nuevo_hogar("m", terr, miembros, tipo_unidad_familiar = uf,
              municipio_habitantes = municipio, zona_despoblada = despoblada)
trab <- function(id, rol, edad, salario, ss, ...) persona(id, rol, edad,
  trabajo = list(dinerarias = salario, cotizaciones_ss = ss), ...)
det <- function(h, modo = "auto") liquidar(h, modo = modo)$deducciones_autonomicas$detalle

test_that("Castilla y León: nacimiento en municipio <= 5.000 hab. usa los importes rurales", {
  m <- list(trab("d1", "declarante", 33, 24000, 1524), persona("h1", "descendiente", 0, nacido_en_ejercicio = TRUE))
  expect_equal(det(hog("ES-CL", m, municipio = 1800, uf = "monoparental"))$nacimiento_adopcion_medio_rural, 1420)
  d <- det(hog("ES-CL", m, uf = "monoparental"))                      # sin municipio informado
  expect_equal(d$nacimiento_adopcion, 1010)
  expect_null(d$nacimiento_adopcion_medio_rural)
})

test_that("Castilla-La Mancha: 15 % de la cuota íntegra autonómica en zona rural < 2.000 hab.", {
  m <- list(trab("d1", "declarante", 50, 30000, 1905))
  l <- liquidar(hog("ES-CM", m, municipio = 1200, despoblada = TRUE))
  expect_equal(l$deducciones_autonomicas$detalle$residencia_zona_rural_menos_2000,
               round(0.15 * l$cuota_integra_autonomica, 2), tolerance = 0.011)
  expect_null(det(hog("ES-CM", m, municipio = 1200))$residencia_zona_rural_menos_2000)   # sin zona oficial
})

test_that("Comunitat Valenciana: 330 € + incremento por descendientes, repartido en individual", {
  m <- list(trab("d1", "declarante", 40, 26000, 1651), trab("d2", "conyuge", 38, 24000, 1524),
            persona("h1", "descendiente", 6), persona("h2", "descendiente", 9))
  h <- hog("ES-VC", m, municipio = 900, despoblada = TRUE, uf = "biparental")
  P <- cargar_parametros("ES-VC")
  a1 <- liquidar_comun_scope(h, P, "individual", "d1")$deducciones_autonomicas$detalle
  expect_equal(a1$residencia_municipio_despoblamiento, 330)          # cada contribuyente
  expect_equal(a1$residencia_despoblamiento_2_descendientes, 99)     # 198 / 2
  cj <- liquidar_comun_scope(h, P, "conjunta")$deducciones_autonomicas$detalle
  expect_equal(cj$residencia_municipio_despoblamiento, 330)          # una vez en conjunta
  expect_equal(cj$residencia_despoblamiento_2_descendientes, 198)
})

test_that("Galicia: nacimiento en los dos años siguientes y +20 % en municipio < 5.000 hab.", {
  m <- list(trab("d1", "declarante", 34, 22000, 1397), persona("h1", "descendiente", 1),
            persona("h2", "descendiente", 5))
  # el hijo de 1 año es el 2.º por orden: 1.200 €; en municipio de 3.500 hab. +20 % = 1.440
  expect_equal(det(hog("ES-GA", m, municipio = 3500, uf = "monoparental"))$nacimiento_adopcion_renta_baja, 1440)
  expect_equal(det(hog("ES-GA", m, uf = "monoparental"))$nacimiento_adopcion_renta_baja, 1200)
})

test_that("Cantabria: alquiler rural 20 %/600 € (se aplica la mayor) y 20 % de la cuota a menores de 40", {
  m <- list(trab("d1", "declarante", 32, 28000, 1778, alquiler_vivienda_pagos = 6000))
  l <- liquidar(hog("ES-CB", m, municipio = 2500, despoblada = TRUE))
  d <- l$deducciones_autonomicas$detalle
  expect_equal(d$arrendamiento_municipio_despoblamiento, 600)
  expect_null(d[["arrendamiento_vivienda_habitual"]])
  expect_equal(d$residencia_municipio_despoblamiento, min(500, round(0.20 * l$cuota_integra_autonomica, 2)),
               tolerance = 0.011)
})

test_that("Aragón (600 €), Extremadura (15 % cuota, < 3.000 hab.) y La Rioja (hijo 0-3: 1.200 €)", {
  expect_equal(det(hog("ES-AR", list(trab("d1", "declarante", 45, 25000, 1587)), despoblada = TRUE))$residencia_municipios_despoblacion, 600)
  l <- liquidar(hog("ES-EX", list(trab("d1", "declarante", 45, 25000, 1587)), municipio = 1500))
  expect_equal(l$deducciones_autonomicas$detalle$residencia_municipios_menos_3000,
               round(0.15 * l$cuota_integra_autonomica, 2), tolerance = 0.011)
  ri <- hog("ES-RI", list(trab("d1", "declarante", 30, 25000, 1587), persona("h1", "descendiente", 1)),
            despoblada = TRUE, uf = "monoparental")
  expect_equal(det(ri)$hijo_0_3_pequenos_municipios, 1200)
})
