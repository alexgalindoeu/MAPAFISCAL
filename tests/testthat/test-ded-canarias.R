# Deducciones autonómicas de Canarias (DL 1/2009). Ver docs/03_casos_validacion.md.

test_that("Canarias: familia monoparental 133 € (con descendientes a cargo)", {
  h <- nuevo_hogar("v","ES-CN", list(persona("d1","declarante",38,
    trabajo=list(dinerarias=26000, cotizaciones_ss=1651)),
    persona("h1","descendiente",7)), tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$familia_monoparental, 133)

  # sin descendientes -> no aplica (tipo_unidad_familiar tampoco sería monoparental, pero por si acaso)
  h2 <- nuevo_hogar("v","ES-CN", list(persona("d1","declarante",38,
    trabajo=list(dinerarias=26000, cotizaciones_ss=1651))))
  expect_null(liquidar(h2)$deducciones_autonomicas$detalle$familia_monoparental)
})

test_that("Canarias: guardería < 3 años (18 %, límite 530 €/descendiente)", {
  h1 <- persona("h1","descendiente",1); h1$gastos_guarderia <- 4000
  h2 <- persona("h2","descendiente",2); h2$gastos_guarderia <- 1000
  h3 <- persona("h3","descendiente",5); h3$gastos_guarderia <- 3000   # 5 años -> no cuenta
  h <- nuevo_hogar("v","ES-CN", list(persona("d1","declarante",35,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)), h1, h2, h3),
    tipo_unidad_familiar="monoparental")
  # 18% de 4000 = 720 -> 530 ; 18% de 1000 = 180 ; h3 excluido -> 530 + 180 = 710
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$gastos_custodia_guarderias, 710)
})

test_that("Canarias: nacimiento se prorratea entre progenitores en individual", {
  h <- nuevo_hogar("v","ES-CN", c(list(
    persona("d1","declarante",34, trabajo=list(dinerarias=25000, cotizaciones_ss=1587)),
    persona("d2","conyuge",33, trabajo=list(dinerarias=22000, cotizaciones_ss=1397))),
    list(persona("h1","descendiente",0, nacido_en_ejercicio=TRUE))),
    tipo_unidad_familiar="biparental")
  liq <- liquidar(h, modo="individual")
  expect_equal(liq$deducciones_autonomicas$detalle$nacimiento_adopcion, 132.5)   # 265 / 2
})

test_that("Canarias: nacimiento no aplica por encima del límite de renta (46.455 €)", {
  h <- nuevo_hogar("v","ES-CN", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=60000, cotizaciones_ss=3810)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)))
  expect_null(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion)
})

test_that("Canarias: nacimiento por orden del hijo (796 € el 4.º, 928 € el 5.º y siguientes)", {
  mk <- function(edades) nuevo_hogar("v","ES-CN", c(list(persona("d1","declarante",40,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905))),
    lapply(seq_along(edades), function(i) persona(paste0("h", i), "descendiente", edades[i],
                                                 nacido_en_ejercicio = edades[i] == 0))),
    tipo_unidad_familiar = "monoparental")
  expect_equal(liquidar(mk(c(10, 8, 5, 0)), modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion, 796)
  expect_equal(liquidar(mk(c(12, 10, 8, 5, 0)), modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion, 928)
  expect_equal(liquidar(mk(c(8, 5, 0)), modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion, 530)
})

test_that("Canarias: familia numerosa 597 / 796 €, y 1.326 / 1.459 € con discapacidad >= 65 %", {
  mk <- function(fn, disc = "no") nuevo_hogar("v","ES-CN", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",10, discapacidad = disc), persona("h2","descendiente",8), persona("h3","descendiente",5)),
    tipo_unidad_familiar = "monoparental", familia_numerosa = fn)
  fn_total <- function(h) { d <- liquidar(h, modo="individual")$deducciones_autonomicas$detalle
                            sum(unlist(d[grep("^familia_numerosa", names(d))])) }
  expect_equal(fn_total(mk("general")), 597)
  expect_equal(fn_total(mk("especial")), 796)
  expect_equal(fn_total(mk("general", "65_mas")), 1326)
  expect_equal(fn_total(mk("especial", "65_mas")), 1459)
})

test_that("Canarias: estudios no superiores, límite 133 € + 66 € por hijo adicional", {
  h <- nuevo_hogar("v","ES-CN", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905), gastos_estudios_no_superiores=1000),
    persona("h1","descendiente",10), persona("h2","descendiente",8), persona("h3","descendiente",5)),
    tipo_unidad_familiar = "monoparental")
  # 100 % de 1.000 -> límite 133 + 2 × 66 = 265
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$gastos_estudios_no_superiores, 265)
})

test_that("Canarias: monoparental y guardería con el límite de renta de 46.455 €", {
  h1 <- persona("h1","descendiente",1); h1$gastos_guarderia <- 2000
  h <- nuevo_hogar("v","ES-CN", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=60000, cotizaciones_ss=3810)), h1), tipo_unidad_familiar = "monoparental")
  d <- liquidar(h, modo="individual")$deducciones_autonomicas$detalle
  expect_null(d$familia_monoparental)
  expect_null(d$gastos_custodia_guarderias)
})
