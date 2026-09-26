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

test_that("Andalucía: el incremento por ascendiente exige el mínimo por ascendientes > 75 (art. 13.2)", {
  con_asc <- function(a) nuevo_hogar("v","ES-AN", list(
    persona("d1","declarante",44, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",9), a), tipo_unidad_familiar="monoparental")
  inc <- function(a) liquidar(con_asc(a), modo="individual")$deducciones_autonomicas$detalle$familia_monoparental_ascendientes_75
  # 75 años: no tiene «edad superior a 75» -> sin incremento
  expect_null(inc(persona("a1","ascendiente",75)))
  # 70 años con discapacidad >= 65 %: genera mínimo por ascendientes, pero no el de > 75
  expect_null(inc(persona("a1","ascendiente",70, discapacidad="65_mas")))
  # 80 años con rentas > 8.000 €: no genera el mínimo por ascendientes
  expect_null(inc(persona("a1","ascendiente",80, rentas_propias=9000)))
  # dos ascendientes de 78 y 82 -> 2 x 100
  h2 <- nuevo_hogar("v","ES-AN", list(
    persona("d1","declarante",50, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",15), persona("a1","ascendiente",78), persona("a2","ascendiente",82)),
    tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$familia_monoparental_ascendientes_75, 200)
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

test_that("Andalucía: ayuda doméstica, supuestos del art. 19.1 a) y b)", {
  ded <- function(h, modo = "conjunta") liquidar(h, modo = modo)$deducciones_autonomicas$detalle
  titular <- function(edad, ...) { d <- persona("d1","declarante",edad, ...); d$cuotas_ss_empleada_hogar <- 1800; d }
  # a) matrimonio con un hijo en el que solo trabaja uno -> no aplica
  h_a <- nuevo_hogar("v","ES-AN", list(
    titular(40, trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    persona("d2","conyuge",38), persona("h1","descendiente",4)), tipo_unidad_familiar="biparental")
  expect_null(ded(h_a)[["ayuda_domestica"]])
  # a) los dos trabajan -> 20 % de 1.800 = 360
  h_a2 <- nuevo_hogar("v","ES-AN", list(
    titular(40, trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    persona("d2","conyuge",38, trabajo=list(dinerarias=18000, cotizaciones_ss=1143)),
    persona("h1","descendiente",4)), tipo_unidad_familiar="biparental")
  expect_equal(ded(h_a2)[["ayuda_domestica"]], 360)
  # b) titular de 76 años, sin hijos ni rendimientos del trabajo -> 360
  h_b <- nuevo_hogar("v","ES-AN", list(titular(76, capital_mobiliario=list(intereses=20000))))
  d_b <- ded(h_b, "individual")
  expect_equal(d_b[["ayuda_domestica_mayores_75"]], 360)
  expect_null(d_b[["ayuda_domestica"]])
  # a) y b) a la vez -> una sola deducción (variantes del mismo grupo)
  h_ab <- nuevo_hogar("v","ES-AN", list(
    titular(76, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)), persona("h1","descendiente",16)),
    tipo_unidad_familiar="monoparental")
  d_ab <- ded(h_ab, "individual")
  expect_equal(sum(unlist(d_ab[c("ayuda_domestica","ayuda_domestica_mayores_75")])), 360)
})

test_that("Andalucía: familia numerosa solo con base <= 25.000 / 30.000 (art. 14.3)", {
  fn <- function(sueldo) nuevo_hogar("v","ES-AN", list(
    persona("d1","declarante",45, trabajo=list(dinerarias=sueldo, cotizaciones_ss=round(sueldo*0.0635))),
    persona("d2","conyuge",43),
    persona("h1","descendiente",5), persona("h2","descendiente",8), persona("h3","descendiente",11)),
    tipo_unidad_familiar="biparental", familia_numerosa="general")
  # 28.000 € de trabajo: base conjunta 20.822 <= 30.000 -> 200 €
  expect_equal(liquidar(fn(28000), modo="conjunta")$deducciones_autonomicas$detalle$familia_numerosa_general, 200)
  # 45.000 € de trabajo: base conjunta 36.742 > 30.000 -> no aplica
  expect_null(liquidar(fn(45000), modo="conjunta")$deducciones_autonomicas$detalle$familia_numerosa_general)
})

test_that("Andalucía: fomento del ejercicio físico 15 %, límite 100 €", {
  d1 <- persona("d1","declarante",35, trabajo=list(dinerarias=28000, cotizaciones_ss=1778))
  d1$gastos_deporte <- 900
  h <- nuevo_hogar("v","ES-AN", list(d1))
  # 15% de 900 = 135 -> topado a 100
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$ejercicio_fisico_deporte, 100)

  # sin límite de renta (art. 22 bis; el art. 60 solo regula la justificación): 15 % de 400 = 60
  d2 <- persona("d1","declarante",45, trabajo=list(dinerarias=150000, cotizaciones_ss=5500))
  d2$gastos_deporte <- 400
  expect_equal(liquidar(nuevo_hogar("v","ES-AN", list(d2)))$deducciones_autonomicas$detalle$ejercicio_fisico_deporte, 60)
})
