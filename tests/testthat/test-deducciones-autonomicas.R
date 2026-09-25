test_that("Madrid: deducción por arrendamiento (30 %, límite 1.237,20, edad<40, límite renta)", {
  # Joven 30 años, base 24.000, alquiler 9.000 -> 30 % = 2.700 topado a 1.237,20
  h <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante", edad = 30,
    trabajo = list(dinerarias = 27000, cotizaciones_ss = 1714),
    alquiler_vivienda_pagos = 9000)))
  liq <- liquidar(h)
  expect_equal(liq$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual, 1237.20)

  # Mismo caso pero 45 años -> no aplica (edad_max 40)
  h2 <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante", edad = 45,
    trabajo = list(dinerarias = 27000, cotizaciones_ss = 1714),
    alquiler_vivienda_pagos = 9000)))
  expect_null(liquidar(h2)$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual)

  # Renta alta -> no aplica (base_max_individual 26.414,22)
  h3 <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante", edad = 30,
    trabajo = list(dinerarias = 40000, cotizaciones_ss = 2540),
    alquiler_vivienda_pagos = 9000)))
  expect_null(liquidar(h3)$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual)
})

test_that("Madrid: deducción por nacimiento se prorratea entre progenitores en individual", {
  hijos <- list(persona("h1","descendiente", edad = 0, nacido_en_ejercicio = TRUE))
  h <- nuevo_hogar("v","ES-MD", c(list(
    persona("d1","declarante",34, trabajo=list(dinerarias=25000, cotizaciones_ss=1587)),
    persona("d2","conyuge",33, trabajo=list(dinerarias=22000, cotizaciones_ss=1397))
  ), hijos), tipo_unidad_familiar = "biparental")
  liq <- liquidar(h, modo = "individual")
  # 721,70 / 2 progenitores = 360,85 en la liquidación individual combinada -> x2 = 721,70
  expect_equal(liq$deducciones_autonomicas$detalle$nacimiento_adopcion, 360.85)
})

test_that("Deducción autonómica reduce la cuota líquida frente a no aplicarla", {
  h <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante", edad = 30,
    trabajo = list(dinerarias = 26000, cotizaciones_ss = 1651),
    alquiler_vivienda_pagos = 6000)))
  P <- cargar_parametros("ES-MD", 2025)
  con <- liquidar(h, P)$cuota_liquida_total
  P2 <- P; P2$jurisdiccion$deducciones_autonomicas <- list(estado = "pendiente", lista = list())
  sin <- liquidar(h, P2)$cuota_liquida_total
  expect_lt(con, sin)
  expect_equal(round(sin - con, 2), min(6000 * 0.30, 1237.20))
})

test_that("Andalucía: nacimiento (200 €), monoparental (100 €), FN, discapacidad con límites de renta", {
  # Nacimiento
  h <- nuevo_hogar("v","ES-AN", list(
    persona("d1","declarante",32, trabajo=list(dinerarias=24000, cotizaciones_ss=1524)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental")
  liq <- liquidar(h, modo="individual")
  expect_equal(liq$deducciones_autonomicas$detalle$nacimiento_adopcion, 200)
  expect_equal(liq$deducciones_autonomicas$detalle$familia_monoparental, 100)

  # Discapacidad: aplica bajo el umbral, no por encima
  bajo <- nuevo_hogar("v","ES-AN", list(persona("d1","declarante",50, discapacidad="33_64",
    trabajo=list(dinerarias=24000, cotizaciones_ss=1524))))
  alto <- nuevo_hogar("v","ES-AN", list(persona("d1","declarante",50, discapacidad="33_64",
    trabajo=list(dinerarias=40000, cotizaciones_ss=2540))))
  expect_equal(liquidar(bajo)$deducciones_autonomicas$detalle$contribuyente_discapacidad, 150)
  expect_null(liquidar(alto)$deducciones_autonomicas$detalle$contribuyente_discapacidad)
})

test_that("Andalucía: arrendamiento 15 % solo para <35 (o >65 / discapacidad)", {
  joven <- nuevo_hogar("v","ES-AN", list(persona("d1","declarante",30,
    trabajo=list(dinerarias=22000, cotizaciones_ss=1397), alquiler_vivienda_pagos=6000)))
  medio <- nuevo_hogar("v","ES-AN", list(persona("d1","declarante",50,
    trabajo=list(dinerarias=22000, cotizaciones_ss=1397), alquiler_vivienda_pagos=6000)))
  expect_equal(liquidar(joven)$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual, 900)
  expect_null(liquidar(medio)$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual)
})

test_that("Cataluña: deducción por alquiler con puerta de renta (base − mínimo)", {
  # base − mínimo justo por debajo de 30.000: aplica
  h <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",30,
    trabajo=list(dinerarias=36000, cotizaciones_ss=2286), alquiler_vivienda_pagos=7000)))
  liq <- liquidar(h, modo = "individual")
  # base ~31.714 − mínimo 5.550 = 26.164 < 30.000 -> aplica; 10% de 7000 = 700 topado a 500
  expect_equal(liq$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual, 500)

  # renta más alta: base − mínimo > 30.000 -> no aplica
  h2 <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",30,
    trabajo=list(dinerarias=42000, cotizaciones_ss=2667), alquiler_vivienda_pagos=7000)))
  expect_null(liquidar(h2, modo = "individual")$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual)
})
