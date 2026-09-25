# Deducciones autonómicas de Aragón (DL 1/2005), régimen general. Ver docs/03_casos_validacion.md.

test_that("Aragón: nacimiento del 3.er hijo — 600 € (renta baja) con prorrateo entre progenitores", {
  h <- nuevo_hogar("v","ES-AR", list(
    persona("d1","declarante",36, trabajo=list(dinerarias=18000, cotizaciones_ss=1143)),
    persona("d2","conyuge",35, trabajo=list(dinerarias=17000, cotizaciones_ss=1080)),
    persona("h1","descendiente",6), persona("h2","descendiente",3),
    persona("h3","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="biparental")
  d <- liquidar(h, modo="individual")$deducciones_autonomicas$detalle
  # base − mínimo < 21.000 -> 600 € ; conviven ambos progenitores -> por mitad
  expect_equal(d$nacimiento_adopcion_tercer_hijo_renta_baja, 300)
  expect_null(d$nacimiento_adopcion_tercer_hijo_general)
})

test_that("Aragón: nacimiento del 3.er hijo — 500 € general cuando la renta supera el umbral", {
  h <- nuevo_hogar("v","ES-AR", list(
    persona("d1","declarante",40, trabajo=list(dinerarias=55000, cotizaciones_ss=3492)),
    persona("h1","descendiente",7), persona("h2","descendiente",4),
    persona("h3","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental")
  d <- liquidar(h, modo="individual")$deducciones_autonomicas$detalle
  expect_equal(d$nacimiento_adopcion_tercer_hijo_general, 500)
  expect_null(d$nacimiento_adopcion_tercer_hijo_renta_baja)

  # solo 2 hijos -> ninguno es el 3.º -> no aplica
  h2 <- nuevo_hogar("v","ES-AR", list(
    persona("d1","declarante",40, trabajo=list(dinerarias=55000, cotizaciones_ss=3492)),
    persona("h1","descendiente",4),
    persona("h2","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion_tercer_hijo_general)
})

test_that("Aragón: cuidado de personas dependientes — 150 €", {
  # ascendiente de 80 años a cargo
  h <- nuevo_hogar("v","ES-AR", list(
    persona("d1","declarante",50, trabajo=list(dinerarias=20000, cotizaciones_ss=1270)),
    persona("a1","ascendiente",80)))
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$cuidado_personas_dependientes, 150)

  # ascendiente de 70 años sin discapacidad -> no es "dependiente"
  h2 <- nuevo_hogar("v","ES-AR", list(
    persona("d1","declarante",50, trabajo=list(dinerarias=20000, cotizaciones_ss=1270)),
    persona("a1","ascendiente",70)))
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$cuidado_personas_dependientes)

  # descendiente con discapacidad >= 65 % -> sí
  h3 <- nuevo_hogar("v","ES-AR", list(
    persona("d1","declarante",45, trabajo=list(dinerarias=20000, cotizaciones_ss=1270)),
    persona("h1","descendiente",10, discapacidad="65_mas")),
    tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h3, modo="individual")$deducciones_autonomicas$detalle$cuidado_personas_dependientes, 150)
})

test_that("Aragón: deducción de 75 € para mayores de 70 años (base <= 23.000)", {
  h <- nuevo_hogar("v","ES-AR", list(persona("d1","declarante",72,
    trabajo=list(dinerarias=20000, cotizaciones_ss=0))))
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$mayores_70_anos, 75)

  h2 <- nuevo_hogar("v","ES-AR", list(persona("d1","declarante",72,
    trabajo=list(dinerarias=30000, cotizaciones_ss=0))))
  expect_null(liquidar(h2)$deducciones_autonomicas$detalle$mayores_70_anos)

  # menor de 70 -> no aplica
  h3 <- nuevo_hogar("v","ES-AR", list(persona("d1","declarante",68,
    trabajo=list(dinerarias=20000, cotizaciones_ss=0))))
  expect_null(liquidar(h3)$deducciones_autonomicas$detalle$mayores_70_anos)
})

test_that("Aragón: gastos de guardería (15 %, límite 250 €/hijo < 3)", {
  h1 <- persona("h1","descendiente",1); h1$gastos_guarderia <- 3000
  h2 <- persona("h2","descendiente",2); h2$gastos_guarderia <- 1000
  h <- nuevo_hogar("v","ES-AR", list(persona("d1","declarante",35,
    trabajo=list(dinerarias=28000, cotizaciones_ss=1778)), h1, h2),
    tipo_unidad_familiar="monoparental")
  # 15% de 3000 = 450 -> 250 ; 15% de 1000 = 150 -> 400
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$gastos_guarderia_menores_3, 400)
})
