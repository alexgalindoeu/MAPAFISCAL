# Deducciones autonómicas de Extremadura (DL 1/2018). Ver docs/03_casos_validacion.md.

test_that("Extremadura: material escolar 15 € por hijo de 6 a 15 años (renta <= 19.000)", {
  h <- nuevo_hogar("v","ES-EX", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=17000, cotizaciones_ss=1080)),
    persona("h1","descendiente",5), persona("h2","descendiente",7),
    persona("h3","descendiente",12), persona("h4","descendiente",16)),
    tipo_unidad_familiar="monoparental")
  # solo h2 (7) y h3 (12) -> 2 x 15 = 30
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$material_escolar, 30)

  h2 <- nuevo_hogar("v","ES-EX", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",10)), tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$material_escolar)
})

test_that("Extremadura: partos múltiples 300 € por hijo, solo si parto múltiple", {
  h <- nuevo_hogar("v","ES-EX", list(persona("d1","declarante",34,
    trabajo=list(dinerarias=16000, cotizaciones_ss=1016)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE),
    persona("h2","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental", parto_multiple=TRUE)
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$partos_multiples, 600)

  # sin marcar parto múltiple -> no aplica
  h2 <- nuevo_hogar("v","ES-EX", list(persona("d1","declarante",34,
    trabajo=list(dinerarias=16000, cotizaciones_ss=1016)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE),
    persona("h2","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$partos_multiples)
})

test_that("Extremadura: cuidado de hijos <= 14 años (10 %, límite 400 €)", {
  d1 <- persona("d1","declarante",38, trabajo=list(dinerarias=17000, cotizaciones_ss=1080))
  d1$gastos_cuidado_hijos <- 5000
  h <- nuevo_hogar("v","ES-EX", list(d1, persona("h1","descendiente",10)),
                   tipo_unidad_familiar="monoparental")
  # 10 % de 5.000 = 500 -> topado a 400
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$cuidado_hijos_menores_14, 400)

  d2 <- persona("d1","declarante",38, trabajo=list(dinerarias=17000, cotizaciones_ss=1080))
  d2$gastos_cuidado_hijos <- 5000
  h2 <- nuevo_hogar("v","ES-EX", list(d2, persona("h1","descendiente",16)),
                    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$cuidado_hijos_menores_14)
})

test_that("Extremadura: cuidado de familiares con discapacidad >= 65 % (150 €)", {
  h <- nuevo_hogar("v","ES-EX", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=17000, cotizaciones_ss=1080)),
    persona("h1","descendiente",12, discapacidad="65_mas")),
    tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$cuidado_familiares_discapacidad, 150)

  h2 <- nuevo_hogar("v","ES-EX", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=17000, cotizaciones_ss=1080)),
    persona("h1","descendiente",12, discapacidad="33_64")),
    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$cuidado_familiares_discapacidad)
})

test_that("Extremadura: arrendamiento de vivienda habitual (30 %, límite 1.000 €)", {
  h <- nuevo_hogar("v","ES-EX", list(persona("d1","declarante",30,
    trabajo=list(dinerarias=20000, cotizaciones_ss=1270), alquiler_vivienda_pagos=6000)))
  # 30 % de 6.000 = 1.800 -> 1.000
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual, 1000)
})
