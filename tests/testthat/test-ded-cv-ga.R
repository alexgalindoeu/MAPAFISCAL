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

test_that("Galicia: familia numerosa 250 € + 250 € por hijo desde el 3.º; arrendamiento joven 10 % (300 €)", {
  h <- nuevo_hogar("v","ES-GA", list(persona("d1","declarante",42,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",5), persona("h2","descendiente",8), persona("h3","descendiente",11)),
    tipo_unidad_familiar="monoparental", familia_numerosa="general")
  d <- liquidar(h)$deducciones_autonomicas$detalle
  # 3 hijos: 250 + 250 (tercer hijo) = 500 (Ley 10/2023, exposición de motivos)
  expect_equal(d$familia_numerosa_mas_2_hijos + d$familia_numerosa_incremento_por_hijo, 500)
  expect_null(d[["familia_numerosa"]])

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

test_that("Galicia: base imponible menos el mínimo del gravamen AUTONÓMICO (casilla 0520) (#22)", {
  # monoparental con un recién nacido; base imponible 32.800 (37.160 − 2.360 − 2.000)
  # mínimo estatal 5.550 + 2.400 + 2.800 = 10.750 -> 22.050 (> 22.000: tramo de 300 €)
  # mínimo autonómico de Galicia 5.789 + 2.503 + 2.920 = 11.212 -> 21.588 (<= 22.000: 360 €)
  h <- nuevo_hogar("v","ES-GA", list(
    persona("d1","declarante",34, trabajo=list(dinerarias=37160, cotizaciones_ss=2360)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)), tipo_unidad_familiar="monoparental")
  l <- liquidar(h, modo="individual")
  expect_equal(l$base_imponible_general, 32800)
  d <- l$deducciones_autonomicas$detalle
  expect_equal(d$nacimiento_adopcion_renta_baja, 360)
  expect_null(d[["nacimiento_adopcion_renta_media"]])
})

test_that("Galicia: familia numerosa (5.Tres.2), especial, discapacidad e incompatibilidad con dos hijos", {
  fn <- function(n, cat = "general", disc = "no", fnum = TRUE) {
    hijos <- lapply(seq_len(n), function(i) persona(paste0("h", i), "descendiente", 3 * i,
                                                     discapacidad = if (i == 1) disc else "no"))
    nuevo_hogar("v","ES-GA", c(list(persona("d1","declarante",42,
      trabajo=list(dinerarias=40000, cotizaciones_ss=2540))), hijos),
      tipo_unidad_familiar="monoparental", familia_numerosa = if (fnum) cat else "no")
  }
  tot <- function(h) { d <- liquidar(h, modo="individual")$deducciones_autonomicas$detalle
    sum(unlist(d[grepl("^familia", names(d))])) }
  expect_equal(tot(fn(2)), 250)                      # FN de hasta 2 hijos (sin 5.Tres.1)
  expect_equal(tot(fn(2, "especial")), 400)          # especial, hasta 2 hijos
  expect_equal(tot(fn(4)), 250 + 2 * 250)            # 3.º y 4.º: +250 cada uno
  expect_equal(tot(fn(3, disc = "65_mas")), 2 * 500) # descendiente >= 65 %: se duplica
  expect_equal(tot(fn(3, disc = "33_64")), 500)      # grado insuficiente
  expect_equal(tot(fn(2, fnum = FALSE)), 250)        # sin título: familias con dos hijos
  expect_equal(tot(fn(2, fnum = FALSE, disc = "65_mas")), 500)
})

test_that("Galicia: alquiler (5.Siete) con base IMPONIBLE <= 22.000, hijos menores y discapacidad", {
  alq <- function(sueldo, hijos = list(), disc = "no") {
    h <- nuevo_hogar("v","ES-GA", c(list(persona("d1","declarante",32, discapacidad = disc,
      trabajo=list(dinerarias=sueldo, cotizaciones_ss=round(sueldo * 0.0635)), alquiler_vivienda_pagos=4000)),
      hijos), tipo_unidad_familiar = if (length(hijos)) "monoparental" else "ninguna")
    d <- liquidar(h, modo="individual")$deducciones_autonomicas$detalle
    sum(unlist(d[grepl("^arrendamiento", names(d))]))
  }
  expect_equal(alq(22000), 300)                      # BI 18.603: 10 % de 4.000 = 400 -> 300
  expect_equal(alq(27000), 0)                        # BI 23.286 > 22.000, aunque BI − mínimo < 22.000
  dos <- list(persona("h1","descendiente",4), persona("h2","descendiente",9))
  expect_equal(alq(22000, dos), 600)                 # 2 hijos menores: 20 % de 4.000 = 800 -> 600
  uno_mayor <- list(persona("h1","descendiente",4), persona("h2","descendiente",19))
  expect_equal(alq(22000, uno_mayor), 300)           # solo 1 menor de edad -> 10 % / 300
  expect_equal(alq(22000, disc = "33_64"), 600)      # arrendatario con discapacidad: x2
})

test_that("Galicia: cuidado de hijos (5.Cinco): hijos <= 3, los dos progenitores trabajan, 600 € con dos", {
  cuid <- function(edades, trabaja_d2 = TRUE, gasto = 3000) {
    d1 <- persona("d1","declarante",33, trabajo=list(dinerarias=20000, cotizaciones_ss=1270))
    d1$gastos_cuidado_hijos <- gasto
    d2 <- if (trabaja_d2) persona("d2","conyuge",33, trabajo=list(dinerarias=14000, cotizaciones_ss=889))
          else persona("d2","conyuge",33)
    h <- nuevo_hogar("v","ES-GA", c(list(d1, d2), lapply(seq_along(edades), function(i)
      persona(paste0("h", i), "descendiente", edades[i]))), tipo_unidad_familiar="biparental")
    d <- liquidar(h, modo="conjunta")$deducciones_autonomicas$detalle
    sum(unlist(d[grepl("^cuidado_hijos", names(d))]))
  }
  expect_equal(cuid(2), 400)                         # 30 % de 3.000 = 900 -> 400
  expect_equal(cuid(c(1, 3)), 600)                   # dos hijos de <= 3 años -> 600
  expect_equal(cuid(c(1, 6)), 400)                   # el de 6 no cuenta para el tope de 600
  expect_equal(cuid(5), 0)                           # ningún hijo de <= 3 años
  expect_equal(cuid(2, trabaja_d2 = FALSE), 0)       # tienen que trabajar los dos
})

test_that("Galicia: libros (5.Veinticinco) 15 %, límite 105 €/hijo, renta per cápita <= 30.000", {
  lib <- function(sueldo) {
    h1 <- persona("h1","descendiente",8); h1$gastos_libros_texto <- 400
    h2 <- persona("h2","descendiente",13); h2$gastos_libros_texto <- 900
    liquidar(nuevo_hogar("v","ES-GA", list(persona("d1","declarante",40,
      trabajo=list(dinerarias=sueldo, cotizaciones_ss=round(sueldo * 0.0635))), h1, h2),
      tipo_unidad_familiar="monoparental"), modo="individual")$deducciones_autonomicas$detalle$libros_texto_material_escolar
  }
  expect_equal(lib(40000), 60 + 105)                 # 15 % de 400 = 60; 15 % de 900 = 135 -> 105
  expect_null(lib(100000))                           # 3 miembros: BI 91.650 > 90.000
})

test_that("Galicia: nacimiento duplicado con hijo con discapacidad >= 33 % (5.Dos.4)", {
  h <- nuevo_hogar("v","ES-GA", list(
    persona("d1","declarante",33, trabajo=list(dinerarias=22000, cotizaciones_ss=1397)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE, discapacidad="33_64")),
    tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion_renta_baja, 720)
})
