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

test_that("Cataluña: el alquiler (art. 612-3) mira base imponible − mínimo, no la base liquidable", {
  # 30 años, 41.164 € de trabajo: base imponible 36.550; − 5.550 = 31.000 > 30.000.
  # Con 1.500 € al plan de pensiones (tope individual) la base liquidable baja a 35.050 (− 5.550 = 29.500),
  # pero la deducción usa la base imponible -> no aplica.
  d <- persona("d1","declarante",30, trabajo=list(dinerarias=41164, cotizaciones_ss=2614),
               prevision_social=list(aportacion_individual=1500), alquiler_vivienda_pagos=8000)
  l <- liquidar(nuevo_hogar("v","ES-CT", list(d)), modo="individual")
  expect_lt(l$base_liquidable_general - 5550, 30000)
  expect_null(l$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual)
})

test_that("Cataluña: nacimiento (art. 612-1), 300 € a la familia monoparental y sin extra por parto múltiple", {
  mono <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",34, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
                                       persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)),
                      tipo_unidad_familiar = "monoparental")
  d <- liquidar(mono, modo = "individual")$deducciones_autonomicas$detalle   # en conjunta, 300 € por la vía general
  expect_equal(d$nacimiento_adopcion_monoparental, 300)
  expect_null(d[["nacimiento_adopcion"]])            # variante excluyente (grupo): se aplica la mayor

  # gemelos en individual (pareja): 150 € por hijo y progenitor, sin incremento por parto múltiple
  gem <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",34, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
                                      persona("d2","conyuge",33, trabajo=list(dinerarias=25000, cotizaciones_ss=1588)),
                                      persona("h1","descendiente",0, nacido_en_ejercicio=TRUE),
                                      persona("h2","descendiente",0, nacido_en_ejercicio=TRUE)),
                     tipo_unidad_familiar = "biparental", parto_multiple = TRUE)
  l <- liquidar(gem, modo = "individual")
  # (detalle del primer declarante: 2 × 150 = 300; antes sumaba 150 más por el parto múltiple)
  expect_equal(l$deducciones_autonomicas$detalle$nacimiento_adopcion, 300)
})

test_that("Cataluña: alquiler (art. 612-3), 1.000 € para familia numerosa sin requisito de edad", {
  mk <- function(fn) nuevo_hogar("v","ES-CT", list(
    persona("d1","declarante",45, trabajo=list(dinerarias=30000, cotizaciones_ss=1905), alquiler_vivienda_pagos=12000),
    persona("h1","descendiente",10), persona("h2","descendiente",8), persona("h3","descendiente",5)),
    tipo_unidad_familiar = "monoparental", familia_numerosa = fn)
  d <- liquidar(mk("general"))$deducciones_autonomicas$detalle
  # 10 % de 12.000 = 1.200 -> límite 1.000 (la variante monoparental da lo mismo; solo una por grupo)
  expect_equal(sum(unlist(d[grep("^arrendamiento", names(d))])), 1000)
})

test_that("Cataluña: alquiler (art. 612-3), límite de 1.000 € en conjunta si un declarante tiene <= 35 años", {
  h <- nuevo_hogar("v","ES-CT", list(
    persona("d1","declarante",30, trabajo=list(dinerarias=25000, cotizaciones_ss=1588), alquiler_vivienda_pagos=12000),
    persona("d2","conyuge",40)), tipo_unidad_familiar = "biparental")
  d <- liquidar(h, modo = "conjunta")$deducciones_autonomicas$detalle
  expect_equal(d$arrendamiento_vivienda_habitual, 1000)
})
