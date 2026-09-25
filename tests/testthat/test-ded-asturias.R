# Deducciones autonómicas del Principado de Asturias (DL 2/2014). Ver docs/03_casos_validacion.md.

test_that("Asturias: familias monoparentales 500 € (base <= 45.000)", {
  h <- nuevo_hogar("v","ES-AS", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",8)), tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$familias_monoparentales, 500)

  h2 <- nuevo_hogar("v","ES-AS", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=60000, cotizaciones_ss=3810)),
    persona("h1","descendiente",8)), tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$familias_monoparentales)
})

test_that("Asturias: partos múltiples 1.000 € por hijo, solo si parto múltiple", {
  h <- nuevo_hogar("v","ES-AS", list(persona("d1","declarante",34,
    trabajo=list(dinerarias=25000, cotizaciones_ss=1587)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE),
    persona("h2","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental", parto_multiple=TRUE)
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$partos_multiples, 2000)

  h2 <- nuevo_hogar("v","ES-AS", list(persona("d1","declarante",34,
    trabajo=list(dinerarias=25000, cotizaciones_ss=1587)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE),
    persona("h2","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$partos_multiples)
})

test_that("Asturias: gastos de descendientes en centros de 0 a 3 años (15 %, límite 500 €)", {
  h1 <- persona("h1","descendiente",1); h1$gastos_guarderia <- 4000
  h <- nuevo_hogar("v","ES-AS", list(persona("d1","declarante",35,
    trabajo=list(dinerarias=22000, cotizaciones_ss=1397)), h1),
    tipo_unidad_familiar="monoparental")
  # 15 % de 4.000 = 600 -> topado a 500
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$gastos_descendientes_0_3, 500)
})

test_that("Asturias: cuidado de descendientes de hasta 25 años (600 € por descendiente)", {
  h <- nuevo_hogar("v","ES-AS", list(persona("d1","declarante",50,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",10), persona("h2","descendiente",20),
    persona("h3","descendiente",26)),   # 26 -> fuera
    tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$cuidado_descendientes_hasta_25, 1200)
})

test_that("Asturias: emancipación de jóvenes de hasta 35 años (100 %, límite 1.000 €)", {
  d1 <- persona("d1","declarante",30, trabajo=list(dinerarias=28000, cotizaciones_ss=1778))
  d1$gastos_emancipacion <- 3000
  h <- nuevo_hogar("v","ES-AS", list(d1))
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$emancipacion_jovenes_35, 1000)

  # 40 años -> no aplica
  d2 <- persona("d1","declarante",40, trabajo=list(dinerarias=28000, cotizaciones_ss=1778))
  d2$gastos_emancipacion <- 3000
  expect_null(liquidar(nuevo_hogar("v","ES-AS", list(d2)))$deducciones_autonomicas$detalle$emancipacion_jovenes_35)
})

test_that("Asturias: arrendamiento — 30 %/1.500 hasta 35 años, 10 %/500 a partir de 36", {
  joven <- nuevo_hogar("v","ES-AS", list(persona("d1","declarante",30,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905), alquiler_vivienda_pagos=6000)))
  dj <- liquidar(joven)$deducciones_autonomicas$detalle
  expect_equal(dj$arrendamiento_vivienda_habitual_joven, 1500)      # 30 % de 6.000 = 1.800 -> 1.500
  expect_null(dj$arrendamiento_vivienda_habitual_general)

  mayor <- nuevo_hogar("v","ES-AS", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905), alquiler_vivienda_pagos=6000)))
  dm <- liquidar(mayor)$deducciones_autonomicas$detalle
  expect_equal(dm$arrendamiento_vivienda_habitual_general, 500)     # 10 % de 6.000 = 600 -> 500
  expect_null(dm$arrendamiento_vivienda_habitual_joven)
})
