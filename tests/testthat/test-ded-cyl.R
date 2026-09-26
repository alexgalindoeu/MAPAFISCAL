# Deducciones autonómicas de Castilla y León (DL 1/2013). Ver docs/03_casos_validacion.md.

test_that("CyL: cuotas SS de empleada de hogar (15 %, límite 300 €, hijo < 4, renta ≤ 18.900)", {
  h1 <- persona("h1","descendiente",2); h1$rentas_propias <- 0
  d1 <- persona("d1","declarante",35, trabajo=list(dinerarias=18000, cotizaciones_ss=1143))
  d1$cuotas_ss_empleada_hogar <- 2500
  h <- nuevo_hogar("v","ES-CL", list(d1, h1), tipo_unidad_familiar="monoparental")
  liq <- liquidar(h, modo="individual")
  # base − mínimo = (18000 − 1143 − 2000) − (5550 + 2400) ≈ 6.907 < 18.900 ; hijo de 2 años
  # 15 % de 2.500 = 375 -> topado a 300
  expect_equal(liq$deducciones_autonomicas$detalle$cuotas_ss_empleada_hogar, 300)

  # sin hijo menor de 4 -> no aplica
  h2v <- persona("d1","declarante",35, trabajo=list(dinerarias=18000, cotizaciones_ss=1143))
  h2v$cuotas_ss_empleada_hogar <- 2500
  h2 <- nuevo_hogar("v","ES-CL", list(h2v, persona("h1","descendiente",7)),
                    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$cuotas_ss_empleada_hogar)
})

test_that("CyL: deducción por discapacidad del contribuyente según edad y grado", {
  mk <- function(edad, grado, renta) {
    p <- persona("d1","declarante", edad, discapacidad = grado,
                 trabajo = list(dinerarias = renta, cotizaciones_ss = round(renta*0.0635)))
    liquidar(nuevo_hogar("v","ES-CL", list(p)))$deducciones_autonomicas$detalle
  }
  expect_equal(mk(70, "33_64", 20000)$contribuyente_discapacidad_65_grado_33, 300)
  expect_equal(mk(70, "65_mas", 20000)$contribuyente_discapacidad_65_grado_65, 656)
  expect_equal(mk(50, "65_mas", 20000)$contribuyente_discapacidad_menor_65_grado_65, 300)
  # renta por encima de 18.900 (base − mínimo) -> no aplica
  expect_null(mk(70, "65_mas", 45000)$contribuyente_discapacidad_65_grado_65)
})

test_that("CyL: cuidado de hijos — empleada de hogar (30 %/322) y escuela infantil (100 %/1.320)", {
  d1 <- persona("d1","declarante",38, trabajo=list(dinerarias=35000, cotizaciones_ss=2223))
  d1$gastos_empleada_hogar <- 2000
  d1$gastos_escuela_infantil_cyl <- 3000
  h <- nuevo_hogar("v","ES-CL", list(d1, persona("h1","descendiente",2)),
                   tipo_unidad_familiar="monoparental")
  d <- liquidar(h)$deducciones_autonomicas$detalle
  expect_equal(d$cuidado_hijos_empleada_hogar, min(0.30*2000, 322))   # 322
  expect_equal(d$cuidado_hijos_escuela_infantil, min(3000, 1320))     # 1320
})

test_that("CyL: familia numerosa según el número de descendientes (art. 3)", {
  fn <- function(nhijos, disc_hijo = "no", cat = "general") {
    hijos <- lapply(seq_len(nhijos), function(i)
      persona(paste0("h", i), "descendiente", 2 + 2 * i, discapacidad = if (i == 1) disc_hijo else "no"))
    nuevo_hogar("v","ES-CL", c(list(persona("d1","declarante",45,
      trabajo=list(dinerarias=40000, cotizaciones_ss=2540))), hijos),
      tipo_unidad_familiar="monoparental", familia_numerosa=cat)
  }
  total_fn <- function(h) { d <- liquidar(h, modo="individual")$deducciones_autonomicas$detalle
    sum(unlist(d[grepl("^familia_numerosa", names(d))])) }
  expect_equal(total_fn(fn(3)), 600)                            # general
  expect_equal(total_fn(fn(4)), 1500)                           # 4 descendientes
  expect_equal(total_fn(fn(5, cat = "especial")), 2500)         # 5 descendientes
  expect_equal(total_fn(fn(7, cat = "especial")), 2500 + 2 * 1000)  # 6.º y 7.º: +1.000 cada uno
  expect_equal(total_fn(fn(3, disc_hijo = "65_mas")), 600 + 600)    # descendiente >= 65 %
  expect_equal(total_fn(fn(3, disc_hijo = "33_64")), 600)           # grado insuficiente

  # dos progenitores en individual -> cada uno la mitad (4 descendientes: 750)
  h2 <- nuevo_hogar("v","ES-CL", c(list(
    persona("d1","declarante",45, trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    persona("d2","conyuge",44, trabajo=list(dinerarias=30000, cotizaciones_ss=1905))),
    lapply(1:4, function(i) persona(paste0("h", i), "descendiente", 3 * i))),
    tipo_unidad_familiar="biparental", familia_numerosa="general")
  expect_equal(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$familia_numerosa_4_descendientes, 750)
})
