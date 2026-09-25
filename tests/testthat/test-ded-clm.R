# Deducciones autonómicas de Castilla-La Mancha (Ley 8/2013). Ver docs/03_casos_validacion.md.

test_that("CLM: familia monoparental 200 €, base <= 27.000", {
  h <- nuevo_hogar("v","ES-CM", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=25000, cotizaciones_ss=1587)),
    persona("h1","descendiente",7)), tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$familia_monoparental, 200)

  h2 <- nuevo_hogar("v","ES-CM", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    persona("h1","descendiente",7)), tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$familia_monoparental)
})

test_that("CLM: gastos de guardería 30 %, límite 500 €/hijo < 3", {
  h1 <- persona("h1","descendiente",1); h1$gastos_guarderia <- 3000
  h2 <- persona("h2","descendiente",2); h2$gastos_guarderia <- 1000
  h3 <- persona("h3","descendiente",4); h3$gastos_guarderia <- 2000   # fuera
  h <- nuevo_hogar("v","ES-CM", list(persona("d1","declarante",34,
    trabajo=list(dinerarias=24000, cotizaciones_ss=1524)), h1, h2, h3),
    tipo_unidad_familiar="monoparental")
  # 30% de 3000 = 900 -> 500 ; 30% de 1000 = 300 ; h3 excluido -> 800
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$gastos_guarderia, 800)
})

test_that("CLM: discapacidad del contribuyente (grado >= 65 %) -> 300 €", {
  mk <- function(grado, renta) {
    p <- persona("d1","declarante",55, discapacidad=grado,
                 trabajo=list(dinerarias=renta, cotizaciones_ss=round(renta*0.0635)))
    liquidar(nuevo_hogar("v","ES-CM", list(p)))$deducciones_autonomicas$detalle$discapacidad_contribuyente
  }
  expect_equal(mk("65_mas", 20000), 300)
  expect_null(mk("33_64", 20000))   # grado insuficiente
  expect_null(mk("65_mas", 40000))  # base > 27.000
})

test_that("CLM: contribuyente > 75 (150 €) y cuidado de ascendiente > 75 (150 €)", {
  h <- nuevo_hogar("v","ES-CM", list(
    persona("d1","declarante",78, trabajo=list(dinerarias=18000, cotizaciones_ss=0)),
    persona("a1","ascendiente",90, rentas_propias=0)))
  d <- liquidar(h, modo="individual")$deducciones_autonomicas$detalle
  expect_equal(d$contribuyente_mayor_75, 150)
  expect_equal(d$cuidado_ascendientes_75, 150)

  # contribuyente de 70 -> no aplica la de mayores de 75
  h2 <- nuevo_hogar("v","ES-CM", list(persona("d1","declarante",70,
    trabajo=list(dinerarias=18000, cotizaciones_ss=0))))
  expect_null(liquidar(h2)$deducciones_autonomicas$detalle$contribuyente_mayor_75)
})
