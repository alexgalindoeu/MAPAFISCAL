# Deducciones autonómicas de la Región de Murcia (DL 1/2010). Ver docs/03_casos_validacion.md.

test_that("Murcia: nacimiento por orden con límite de renta y prorrateo entre progenitores", {
  h <- nuevo_hogar("v","ES-MC", list(
    persona("d1","declarante",34, trabajo=list(dinerarias=24000, cotizaciones_ss=1524)),
    persona("d2","conyuge",33, trabajo=list(dinerarias=22000, cotizaciones_ss=1397)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)),
    tipo_unidad_familiar="biparental")
  # 1er hijo -> 100 € ; ambos progenitores declaran y conviven -> por mitad
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion, 50)

  # por encima de 30.000 € en individual -> no aplica
  h2 <- nuevo_hogar("v","ES-MC", list(
    persona("d1","declarante",40, trabajo=list(dinerarias=60000, cotizaciones_ss=3810)),
    persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)))
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion)
})

test_that("Murcia: gastos de guardería (20 %, límite 1.000 €/hijo, Primer Ciclo Ed. Infantil)", {
  h1 <- persona("h1","descendiente",1); h1$gastos_guarderia <- 6000
  h2 <- persona("h2","descendiente",2); h2$gastos_guarderia <- 2000
  h3 <- persona("h3","descendiente",4); h3$gastos_guarderia <- 3000   # 4 años -> fuera del 1er ciclo
  h <- nuevo_hogar("v","ES-MC", list(persona("d1","declarante",35,
    trabajo=list(dinerarias=28000, cotizaciones_ss=1778)), h1, h2, h3),
    tipo_unidad_familiar="monoparental")
  # 20% de 6000 = 1200 -> 1000 ; 20% de 2000 = 400 ; h3 excluido -> 1400
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$gastos_guarderia, 1400)
})

test_that("Murcia: material escolar y libros de texto (120 €/hijo, 2º ciclo infantil-ESO)", {
  h <- nuevo_hogar("v","ES-MC", list(persona("d1","declarante",42,
    trabajo=list(dinerarias=19000, cotizaciones_ss=1207)),
    persona("h1","descendiente",5), persona("h2","descendiente",10),
    persona("h3","descendiente",17)),   # 17 años -> fuera del tramo
    tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$material_escolar_libros, 240)

  # por encima de 20.000 € en individual -> no aplica
  h2 <- nuevo_hogar("v","ES-MC", list(persona("d1","declarante",42,
    trabajo=list(dinerarias=35000, cotizaciones_ss=2223)),
    persona("h1","descendiente",10)), tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$material_escolar_libros)
})

test_that("Murcia: deducción de 150 € para contribuyentes con discapacidad (renta <= 40.000)", {
  mk <- function(grado, renta) {
    p <- persona("d1","declarante",50, discapacidad=grado,
                 trabajo=list(dinerarias=renta, cotizaciones_ss=round(renta*0.0635)))
    liquidar(nuevo_hogar("v","ES-MC", list(p)))$deducciones_autonomicas$detalle$contribuyente_discapacidad
  }
  expect_equal(mk("33_64", 25000), 150)
  expect_equal(mk("65_mas", 25000), 150)
  expect_null(mk("65_mas", 50000))   # base > 40.000
})

test_that("Murcia: conciliación — cuidado de descendientes (20 % cuotas SS empleada hogar, máx. 400)", {
  d1 <- persona("d1","declarante",38, trabajo=list(dinerarias=30000, cotizaciones_ss=1905))
  d1$cuotas_ss_empleada_hogar <- 3000
  h <- nuevo_hogar("v","ES-MC", list(d1, persona("h1","descendiente",8)),
                   tipo_unidad_familiar="monoparental")
  # 20 % de 3.000 = 600 -> topado a 400
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$conciliacion_cuidado_descendientes, 400)

  # sin hijo menor de 12 -> no aplica
  d2 <- persona("d1","declarante",38, trabajo=list(dinerarias=30000, cotizaciones_ss=1905))
  d2$cuotas_ss_empleada_hogar <- 3000
  h2 <- nuevo_hogar("v","ES-MC", list(d2, persona("h1","descendiente",13)),
                    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2)$deducciones_autonomicas$detalle$conciliacion_cuidado_descendientes)
})

test_that("Murcia: familia monoparental 303 € (con descendientes, renta <= 35.240)", {
  h <- nuevo_hogar("v","ES-MC", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",7)), tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$familia_monoparental, 303)

  # por encima de 35.240 € -> no aplica
  h2 <- nuevo_hogar("v","ES-MC", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=48000, cotizaciones_ss=3048)),
    persona("h1","descendiente",7)), tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$familia_monoparental)
})
