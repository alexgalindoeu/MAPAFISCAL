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
  mk <- function(cat, nhijos) {
    miembros <- c(list(persona("d1","declarante",42, trabajo=list(dinerarias=42000, cotizaciones_ss=2667))),
                  lapply(seq_len(nhijos), function(i) persona(paste0("h",i),"descendiente", 8)))
    nuevo_hogar("v","ES-MD", miembros, tipo_unidad_familiar="monoparental", familia_numerosa=cat)
  }
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
