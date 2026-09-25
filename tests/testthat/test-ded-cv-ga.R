test_that("C. Valenciana: nacimiento 2025 (600 € el 1º, Ley 5/2025) con límite de renta; FN general 330 €", {
  h <- nuevo_hogar("v","ES-VC", list(
    persona("d1","declarante",33, trabajo=list(dinerarias=26000, cotizaciones_ss=1651)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental")
  d <- liquidar(h)$deducciones_autonomicas$detalle
  expect_equal(d$nacimiento_adopcion, 600)

  # renta alta -> no aplica en individual (base_max_individual 30.000; conjunta 47.000)
  h2 <- nuevo_hogar("v","ES-VC", list(
    persona("d1","declarante",33, trabajo=list(dinerarias=52000, cotizaciones_ss=3302)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion)

  h3 <- nuevo_hogar("v","ES-VC", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=25000, cotizaciones_ss=1587)),
    persona("h1","descendiente",5), persona("h2","descendiente",8), persona("h3","descendiente",10)),
    tipo_unidad_familiar="monoparental", familia_numerosa="general")
  expect_equal(liquidar(h3)$deducciones_autonomicas$detalle$familia_numerosa_general, 330)
})

test_that("Galicia: familia numerosa 250 €; arrendamiento joven 10 % (300 €)", {
  h <- nuevo_hogar("v","ES-GA", list(persona("d1","declarante",42,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",5), persona("h2","descendiente",8), persona("h3","descendiente",11)),
    tipo_unidad_familiar="monoparental", familia_numerosa="general")
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$familia_numerosa, 250)

  joven <- nuevo_hogar("v","ES-GA", list(persona("d1","declarante",29,
    trabajo=list(dinerarias=19000, cotizaciones_ss=1207), alquiler_vivienda_pagos=6000)))
  # base − mínimo ≈ 9.243 < 22.000; sin hijos -> variante general 10 %/300
  expect_equal(liquidar(joven)$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual_general, 300)
})

test_that("Galicia: nacimiento por orden e importe según (base − mínimo)", {
  # renta baja: 2 recién nacidos -> 360 + 1.200 = 1.560
  baja <- nuevo_hogar("v","ES-GA", list(
    persona("d1","declarante",34, trabajo=list(dinerarias=24000, cotizaciones_ss=1524)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE),
    persona("h2","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental")
  d <- liquidar(baja, modo="individual")$deducciones_autonomicas$detalle
  expect_equal(d$nacimiento_adopcion_renta_baja, 360 + 1200)
  expect_null(d$nacimiento_adopcion_renta_media)

  # renta media (base − mínimo > 22.000): 300 €/hijo
  media <- nuevo_hogar("v","ES-GA", list(
    persona("d1","declarante",38, trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)))
  dm <- liquidar(media, modo="individual")$deducciones_autonomicas$detalle
  expect_equal(dm$nacimiento_adopcion_renta_media, 300)
  expect_null(dm$nacimiento_adopcion_renta_baja)
})

test_that("Galicia: familias con dos hijos (250 €, exactamente 2 descendientes)", {
  h2 <- nuevo_hogar("v","ES-GA", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=35000, cotizaciones_ss=2223)),
    persona("h1","descendiente",6), persona("h2","descendiente",10)),
    tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h2)$deducciones_autonomicas$detalle$familias_dos_hijos, 250)

  h3 <- nuevo_hogar("v","ES-GA", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=35000, cotizaciones_ss=2223)),
    persona("h1","descendiente",6), persona("h2","descendiente",10), persona("h3","descendiente",2)),
    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h3)$deducciones_autonomicas$detalle$familias_dos_hijos)  # 3 hijos -> no aplica
})

test_that("C. Valenciana: deducción del 10 % de la cuota autonómica por 2+ descendientes", {
  h <- nuevo_hogar("v","ES-VC", list(
    persona("d1","declarante",40, trabajo=list(dinerarias=26000, cotizaciones_ss=1651)),
    persona("h1","descendiente",6), persona("h2","descendiente",9)),
    tipo_unidad_familiar="monoparental")
  liq <- liquidar(h, modo="individual")
  d <- liq$deducciones_autonomicas$detalle
  expect_true(!is.null(d$dos_o_mas_descendientes))
  # 10 % de (cuota íntegra autonómica − resto de deducciones autonómicas)
  otras <- liq$deducciones_autonomicas$total - d$dos_o_mas_descendientes
  expect_equal(d$dos_o_mas_descendientes,
               0.10 * (liq$cuota_integra_autonomica - otras), tolerance = 0.02)
})

test_that("Aragón: guardería <3 años, 15 % límite 250 €/hijo", {
  h1 <- persona("h1","descendiente",1)
  h1$gastos_guarderia <- 3000
  h <- nuevo_hogar("v","ES-AR", list(
    persona("d1","declarante",34, trabajo=list(dinerarias=28000, cotizaciones_ss=1778)), h1),
    tipo_unidad_familiar="monoparental")
  # 15% de 3000 = 450 -> topado a 250
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$gastos_guarderia_menores_3, 250)
})
