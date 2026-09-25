# Deducciones autonómicas de Cataluña (DL 1/2024). Ver docs/03_casos_validacion.md.

test_that("Cataluña: rehabilitación de vivienda habitual (1,5 %, base máx. 9.040 €)", {
  h <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=40000, cotizaciones_ss=2540),
    rehabilitacion_vivienda_pagos=6000)))
  d <- liquidar(h)$deducciones_autonomicas$detalle
  expect_equal(d$rehabilitacion_vivienda_habitual, round(6000 * 0.015, 2))   # 90,00

  # por encima de la base máxima el importe se topa en 9.040 × 1,5 % = 135,60
  h2 <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=40000, cotizaciones_ss=2540),
    rehabilitacion_vivienda_pagos=20000)))
  expect_equal(liquidar(h2)$deducciones_autonomicas$detalle$rehabilitacion_vivienda_habitual, 135.60)
})

test_that("Cataluña: donativos a I+D+i (30 %) topados al 10 % de la cuota íntegra autonómica", {
  h <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905),
    donativos_investigacion=400)))
  liq <- liquidar(h)
  d <- liq$deducciones_autonomicas$detalle
  # 30 % de 400 = 120, salvo que supere el 10 % de la cuota íntegra autonómica
  tope <- 0.10 * liq$cuota_integra_autonomica
  expect_equal(d$donativos_investigacion_i_d_i, min(120, tope), tolerance = 0.02)

  # donativo grande -> se topa al 10 % de la cuota autonómica
  h2 <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905),
    donativos_investigacion=50000)))
  liq2 <- liquidar(h2)
  expect_equal(liq2$deducciones_autonomicas$detalle$donativos_investigacion_i_d_i,
               0.10 * liq2$cuota_integra_autonomica, tolerance = 0.02)
})

test_that("Cataluña: inversión de ángel inversor (40 %, límite 12.000 €)", {
  h <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=80000, cotizaciones_ss=5080),
    inversion_angel_inversor=10000)))
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$inversion_angel_inversor, 4000)

  h2 <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=80000, cotizaciones_ss=5080),
    inversion_angel_inversor=40000)))
  expect_equal(liquidar(h2)$deducciones_autonomicas$detalle$inversion_angel_inversor, 12000)
})

test_that("Cataluña: inversión en cooperativas agrarias/vivienda (20 %, límite 3.000 €)", {
  h <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=45000, cotizaciones_ss=2858),
    inversion_cooperativas_cat=5000)))
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$inversion_cooperativas_agrarias_vivienda, 1000)
})
