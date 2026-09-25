# Deducciones autonómicas de La Rioja (Ley 10/2017). Ver docs/03_casos_validacion.md.

test_that("La Rioja: nacimiento por orden del hijo (600/750/900), con prorrateo", {
  h <- nuevo_hogar("v","ES-RI", list(persona("d1","declarante",34,
    trabajo=list(dinerarias=24000, cotizaciones_ss=1524)),
    persona("h1","descendiente",3),
    persona("h2","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental")
  # el recién nacido es el 2.º -> 750 €
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion, 750)

  h2 <- nuevo_hogar("v","ES-RI", c(list(
    persona("d1","declarante",34, trabajo=list(dinerarias=24000, cotizaciones_ss=1524)),
    persona("d2","conyuge",33, trabajo=list(dinerarias=22000, cotizaciones_ss=1397))),
    list(persona("h1","descendiente",3), persona("h2","descendiente",0, nacido_en_ejercicio=TRUE))),
    tipo_unidad_familiar="biparental")
  expect_equal(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion, 375)
})

test_that("La Rioja: hijo de 0 a 3 años en escuelas infantiles (20 %, límite 600 €/hijo)", {
  h1 <- persona("h1","descendiente",1); h1$gastos_guarderia <- 4000
  h <- nuevo_hogar("v","ES-RI", list(persona("d1","declarante",35,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)), h1),
    tipo_unidad_familiar="monoparental")
  # 20 % de 4.000 = 800 -> topado a 600
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$hijo_0_3_escuelas_infantiles, 600)
})

test_that("La Rioja: arrendamiento de vivienda habitual < 36 años (10 %, límite 300 €)", {
  h <- nuevo_hogar("v","ES-RI", list(persona("d1","declarante",30,
    trabajo=list(dinerarias=18000, cotizaciones_ss=1143), alquiler_vivienda_pagos=5000)))
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual_joven, 300)
})

test_that("La Rioja: acceso a Internet y suministro de luz/gas para jóvenes emancipados", {
  d1 <- persona("d1","declarante",30, trabajo=list(dinerarias=18000, cotizaciones_ss=1143))
  d1$gastos_internet <- 600
  d1$gastos_luz_gas <- 2000
  h <- nuevo_hogar("v","ES-RI", list(d1))
  d <- liquidar(h)$deducciones_autonomicas$detalle
  expect_equal(d$acceso_internet_jovenes_emancipados, 180)   # 30 % de 600
  expect_equal(d$suministro_luz_gas_emancipados, 300)        # 15 % de 2.000

  # 40 años -> no es joven emancipado
  d2 <- persona("d1","declarante",40, trabajo=list(dinerarias=18000, cotizaciones_ss=1143))
  d2$gastos_internet <- 600
  expect_null(liquidar(nuevo_hogar("v","ES-RI", list(d2)))$deducciones_autonomicas$detalle$acceso_internet_jovenes_emancipados)
})

test_that("La Rioja: fomento del ejercicio físico (30 %, límite 300 €)", {
  d1 <- persona("d1","declarante",45, trabajo=list(dinerarias=30000, cotizaciones_ss=1905))
  d1$gastos_deporte <- 1500
  h <- nuevo_hogar("v","ES-RI", list(d1))
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$fomentar_ejercicio_fisico, 300)
})
