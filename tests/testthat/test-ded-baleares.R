# Deducciones autonómicas de les Illes Balears (DL 1/2014). Ver docs/03_casos_validacion.md.

test_that("Balears: nacimiento por orden del hijo (800/1000/1200), límite 52.800 €", {
  h <- nuevo_hogar("v","ES-IB", list(persona("d1","declarante",34,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",4),
    persona("h2","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental")
  # el recién nacido es el 2.º hijo -> 1.000 €
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$nacimiento, 1000)

  # por encima de 52.800 € -> no aplica (no se modela la regla del 50 %)
  h2 <- nuevo_hogar("v","ES-IB", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=70000, cotizaciones_ss=4445)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)))
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$nacimiento)
})

test_that("Balears: libros de texto 100 %, límite 220 €/hijo (base <= 33.000)", {
  h1 <- persona("h1","descendiente",8);  h1$gastos_libros_texto <- 300
  h2 <- persona("h2","descendiente",12); h2$gastos_libros_texto <- 150
  h <- nuevo_hogar("v","ES-IB", list(persona("d1","declarante",42,
    trabajo=list(dinerarias=24000, cotizaciones_ss=1524)), h1, h2),
    tipo_unidad_familiar="monoparental")
  # 300 -> 220 ; 150 -> 150 ; total 370
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$libros_texto, 370)
})

test_that("Balears: aprendizaje extraescolar de idiomas 15 %, límite 110 €/hijo", {
  h1 <- persona("h1","descendiente",10); h1$gastos_idiomas_extranjeros <- 1000
  h <- nuevo_hogar("v","ES-IB", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=24000, cotizaciones_ss=1524)), h1),
    tipo_unidad_familiar="monoparental")
  # 15 % de 1000 = 150 -> topado a 110
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$aprendizaje_idiomas_extranjeros, 110)
})

test_that("Balears: conciliación menores de 6 años 40 %, límite 660 €", {
  d1 <- persona("d1","declarante",40, trabajo=list(dinerarias=24000, cotizaciones_ss=1524))
  d1$gastos_conciliacion_menores <- 2000
  h <- nuevo_hogar("v","ES-IB", list(d1, persona("h1","descendiente",4)),
                   tipo_unidad_familiar="monoparental")
  # 40 % de 2000 = 800 -> topado a 660
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$conciliacion_menores_6, 660)

  # hijo de 7 años -> no hay menor de 6 -> no aplica
  d2 <- persona("d1","declarante",40, trabajo=list(dinerarias=24000, cotizaciones_ss=1524))
  d2$gastos_conciliacion_menores <- 2000
  h2 <- nuevo_hogar("v","ES-IB", list(d2, persona("h1","descendiente",7)),
                    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$conciliacion_menores_6)
})

test_that("Balears: arrendamiento de vivienda habitual 15 %, límite 530 € (< 36 años)", {
  h <- nuevo_hogar("v","ES-IB", list(persona("d1","declarante",30,
    trabajo=list(dinerarias=24000, cotizaciones_ss=1524), alquiler_vivienda_pagos=5000)))
  # 15 % de 5000 = 750 -> topado a 530
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual, 530)
})
