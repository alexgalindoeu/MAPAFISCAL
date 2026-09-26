# Deducciones autonómicas de la Comunidad de Madrid (DL 1/2010). Ver docs/03_casos_validacion.md.

test_that("Madrid: cuidado de ascendientes 515,50 € por ascendiente > 65 (con prorrateo)", {
  # un solo declarante -> importe íntegro
  h1 <- nuevo_hogar("v","ES-MD", list(
    persona("d1","declarante",50, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("a1","ascendiente",82, rentas_propias=0)))
  expect_equal(liquidar(h1, modo="individual")$deducciones_autonomicas$detalle$cuidado_ascendientes, 515.50)

  # dos declarantes en individual -> por mitad
  h2 <- nuevo_hogar("v","ES-MD", list(
    persona("d1","declarante",50, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("d2","conyuge",49, trabajo=list(dinerarias=28000, cotizaciones_ss=1778)),
    persona("a1","ascendiente",82, rentas_propias=0)), tipo_unidad_familiar="biparental")
  expect_equal(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$cuidado_ascendientes, 257.75)

  # sin ascendiente -> no aplica
  h3 <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante",50,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905))))
  expect_null(liquidar(h3)$deducciones_autonomicas$detalle$cuidado_ascendientes)
})

test_that("Madrid: familia numerosa = % de la cuota íntegra autonómica (50 % general, 100 % especial)", {
  mk <- function(cat, nhijos, reciente = TRUE) {
    miembros <- c(list(persona("d1","declarante",42, trabajo=list(dinerarias=42000, cotizaciones_ss=2667))),
                  lapply(seq_len(nhijos), function(i) persona(paste0("h",i),"descendiente", 8)))
    nuevo_hogar("v","ES-MD", miembros, tipo_unidad_familiar="monoparental", familia_numerosa=cat,
                familia_numerosa_reciente=reciente)
  }
  # título con efectos antes de 2023 (o sin informar) -> no aplica (art. 13 bis.2)
  lv <- liquidar(mk("general", 3, reciente = FALSE), modo="individual")
  expect_null(lv$deducciones_autonomicas$detalle$familia_numerosa_general)
  lg <- liquidar(mk("general", 3), modo="individual")
  expect_equal(lg$deducciones_autonomicas$detalle$familia_numerosa_general,
               round(min(lg$cuota_integra_autonomica * 0.50, 6186), 2))
  expect_null(lg$deducciones_autonomicas$detalle$familia_numerosa_especial)

  le <- liquidar(mk("especial", 5), modo="individual")
  expect_equal(le$deducciones_autonomicas$detalle$familia_numerosa_especial,
               round(min(le$cuota_integra_autonomica * 1.00, 12372), 2))
  expect_null(le$deducciones_autonomicas$detalle$familia_numerosa_general)

  # sin familia numerosa -> ninguna
  ln <- liquidar(mk("no", 1), modo="individual")
  expect_null(ln$deducciones_autonomicas$detalle$familia_numerosa_general)
  expect_null(ln$deducciones_autonomicas$detalle$familia_numerosa_especial)
})

test_that("Madrid: cuidado de hijos < 3 — 25 % cuotas SS empleada hogar, límite 463,95 €", {
  d1 <- persona("d1","declarante",35, trabajo=list(dinerarias=32000, cotizaciones_ss=2032))
  d1$cuotas_ss_empleada_hogar <- 2500
  h <- nuevo_hogar("v","ES-MD", list(d1, persona("h1","descendiente",1)),
                   tipo_unidad_familiar="monoparental")
  # 25 % de 2.500 = 625 -> topado a 463,95
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$cuidado_hijos_menores_3_empleada_hogar, 463.95)

  # hijo de 5 años -> no aplica
  d2 <- persona("d1","declarante",35, trabajo=list(dinerarias=32000, cotizaciones_ss=2032))
  d2$cuotas_ss_empleada_hogar <- 2500
  h2 <- nuevo_hogar("v","ES-MD", list(d2, persona("h1","descendiente",5)),
                    tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2)$deducciones_autonomicas$detalle$cuidado_hijos_menores_3_empleada_hogar)
})

test_that("Madrid: empleada de hogar, supuestos a) y d) del art. 11 bis y variante de familia numerosa", {
  det <- function(h, modo = "conjunta") liquidar(h, modo = modo)$deducciones_autonomicas$detalle
  emp <- function(...) { d <- persona("d1","declarante",36, ...); d$cuotas_ss_empleada_hogar <- 1200; d }
  # a) el otro progenitor no trabaja -> no aplica
  h_a <- nuevo_hogar("v","ES-MD", list(emp(trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    persona("d2","conyuge",34), persona("h1","descendiente",1)), tipo_unidad_familiar="biparental")
  expect_null(det(h_a)[["cuidado_hijos_menores_3_empleada_hogar"]])
  # a) trabajan los dos -> 25 % de 1.200 = 300
  h_a2 <- nuevo_hogar("v","ES-MD", list(emp(trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    persona("d2","conyuge",34, trabajo=list(dinerarias=22000, cotizaciones_ss=1397)),
    persona("h1","descendiente",1)), tipo_unidad_familiar="biparental")
  expect_equal(det(h_a2)[["cuidado_hijos_menores_3_empleada_hogar"]], 300)
  # a) familia numerosa -> 40 % de 1.200 = 480 (solo la variante mayor)
  h_fn <- nuevo_hogar("v","ES-MD", list(emp(trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    persona("d2","conyuge",34, trabajo=list(dinerarias=22000, cotizaciones_ss=1397)),
    persona("h1","descendiente",1), persona("h2","descendiente",4), persona("h3","descendiente",7)),
    tipo_unidad_familiar="biparental", familia_numerosa="general")
  d_fn <- det(h_fn)
  expect_equal(d_fn[["cuidado_hijos_menores_3_empleada_hogar_fn"]], 480)
  expect_null(d_fn[["cuidado_hijos_menores_3_empleada_hogar"]])
  # d) contribuyente con discapacidad, sin hijos ni actividad -> 300
  h_d <- nuevo_hogar("v","ES-MD", list(emp(discapacidad="33_64", capital_mobiliario=list(intereses=15000))))
  expect_equal(det(h_d, "individual")[["empleada_hogar_contribuyente_discapacidad"]], 300)
})

test_that("Madrid: gastos educativos con límite único por hijo (art. 11)", {
  hijo <- function(id, edad, esc = 0, idi = 0, ves = 0) {
    h <- persona(id, "descendiente", edad)
    h$gastos_escolaridad <- esc; h$gastos_idiomas <- idi; h$gastos_vestuario_escolar <- ves; h
  }
  h <- nuevo_hogar("v","ES-MD", list(
    persona("d1","declarante",40, trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    hijo("h1", 10, esc = 5000, idi = 1000, ves = 400),   # 750 + 150 + 20 = 920 <= 927,90
    hijo("h2", 12, idi = 3000, ves = 200),               # 450 + 10 = 460 -> 412,40
    hijo("h3", 1, esc = 8000, idi = 500)),               # primer ciclo: solo escolaridad, 1.200 -> 1.031
    tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$gastos_educativos, 2363.40)

  # dos progenitores en individual -> cada uno la mitad
  h2 <- nuevo_hogar("v","ES-MD", list(
    persona("d1","declarante",40, trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    persona("d2","conyuge",40, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    hijo("h1", 10, esc = 5000, idi = 1000, ves = 400)), tipo_unidad_familiar="biparental")
  expect_equal(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$gastos_educativos, 460)

  # art. 18.2: base de la UF (2 miembros) > 2 x 30.930 = 61.860 -> no aplica
  h3 <- nuevo_hogar("v","ES-MD", list(
    persona("d1","declarante",45, trabajo=list(dinerarias=70000, cotizaciones_ss=4445)),
    hijo("h1", 10, esc = 5000)), tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h3, modo="individual")$deducciones_autonomicas$detalle$gastos_educativos)
})
