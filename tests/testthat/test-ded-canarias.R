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
