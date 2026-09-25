# Deducciones autonómicas de Andalucía (Ley 5/2021). Ver docs/03_casos_validacion.md.

test_that("Andalucía: familia monoparental 100 € + 100 € por ascendiente > 75", {
  h <- nuevo_hogar("v","ES-AN", list(
    persona("d1","declarante",44, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",9),
    persona("a1","ascendiente",80, rentas_propias=0)),
    tipo_unidad_familiar="monoparental")
  d <- liquidar(h, modo="individual")$deducciones_autonomicas$detalle
  expect_equal(d$familia_monoparental, 100)
  expect_equal(d$familia_monoparental_ascendientes_75, 100)

  # sin ascendiente -> solo la base
  h2 <- nuevo_hogar("v","ES-AN", list(
    persona("d1","declarante",44, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",9)), tipo_unidad_familiar="monoparental")
  d2 <- liquidar(h2, modo="individual")$deducciones_autonomicas$detalle
  expect_equal(d2$familia_monoparental, 100)
  expect_null(d2$familia_monoparental_ascendientes_75)
})

test_that("Andalucía: gastos educativos de idiomas/informática 15 %, límite 150 €/descendiente", {
  h1 <- persona("h1","descendiente",10); h1$gastos_idiomas_informatica <- 1500
  h2 <- persona("h2","descendiente",13); h2$gastos_idiomas_informatica <- 400
  h <- nuevo_hogar("v","ES-AN", list(persona("d1","declarante",42,
    trabajo=list(dinerarias=35000, cotizaciones_ss=2223)), h1, h2),
    tipo_unidad_familiar="monoparental")
  # 15% de 1500 = 225 -> 150 ; 15% de 400 = 60 -> total 210
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$gastos_educativos_idiomas_informatica, 210)

  # base > 80.000 en individual -> no aplica
  h3 <- persona("h3","descendiente",10); h3$gastos_idiomas_informatica <- 1000
  hbig <- nuevo_hogar("v","ES-AN", list(persona("d1","declarante",42,
    trabajo=list(dinerarias=120000, cotizaciones_ss=7620)), h3),
    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(hbig, modo="individual")$deducciones_autonomicas$detalle$gastos_educativos_idiomas_informatica)
})

test_that("Andalucía: ayuda doméstica 20 % cuotas SS empleada hogar, límite 500 €", {
  d1 <- persona("d1","declarante",40, trabajo=list(dinerarias=40000, cotizaciones_ss=2540))
  d1$cuotas_ss_empleada_hogar <- 3200
  h <- nuevo_hogar("v","ES-AN", list(d1, persona("h1","descendiente",6)),
                   tipo_unidad_familiar="monoparental")
  # 20% de 3200 = 640 -> topado a 500
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$ayuda_domestica, 500)

  # sin descendientes -> no aplica
  d2 <- persona("d1","declarante",40, trabajo=list(dinerarias=40000, cotizaciones_ss=2540))
  d2$cuotas_ss_empleada_hogar <- 3200
  expect_null(liquidar(nuevo_hogar("v","ES-AN", list(d2)))$deducciones_autonomicas$detalle$ayuda_domestica)
})

test_that("Andalucía: fomento del ejercicio físico 15 %, límite 100 €", {
  d1 <- persona("d1","declarante",35, trabajo=list(dinerarias=28000, cotizaciones_ss=1778))
  d1$gastos_deporte <- 900
  h <- nuevo_hogar("v","ES-AN", list(d1))
  # 15% de 900 = 135 -> topado a 100
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$ejercicio_fisico_deporte, 100)
})
