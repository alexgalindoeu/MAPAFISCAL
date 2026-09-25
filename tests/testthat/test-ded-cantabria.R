# Deducciones autonómicas de Cantabria (DL 62/2008). Ver docs/03_casos_validacion.md.
# Los límites de renta se aplican sobre base liquidable − mínimo personal y familiar.

test_that("Cantabria: nacimiento 1.400 € (ventana de 3 años), con prorrateo en individual", {
  h <- nuevo_hogar("v","ES-CB", list(persona("d1","declarante",34,
    trabajo=list(dinerarias=25000, cotizaciones_ss=1587)),
    persona("h1","descendiente",1)), tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion, 1400)

  h2 <- nuevo_hogar("v","ES-CB", c(list(
    persona("d1","declarante",34, trabajo=list(dinerarias=25000, cotizaciones_ss=1587)),
    persona("d2","conyuge",33, trabajo=list(dinerarias=23000, cotizaciones_ss=1461))),
    list(persona("h1","descendiente",1))), tipo_unidad_familiar="biparental")
  expect_equal(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion, 700)
})

test_that("Cantabria: familias monoparentales 200 € (base − MPF < 31.485)", {
  h <- nuevo_hogar("v","ES-CB", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("h1","descendiente",8)), tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$familias_monoparentales, 200)

  h2 <- nuevo_hogar("v","ES-CB", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=60000, cotizaciones_ss=3810)),
    persona("h1","descendiente",8)), tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$familias_monoparentales)
})

test_that("Cantabria: gastos de guardería (15 %, límite 300 €/hijo < 3)", {
  h1 <- persona("h1","descendiente",1); h1$gastos_guarderia <- 3000
  h <- nuevo_hogar("v","ES-CB", list(persona("d1","declarante",35,
    trabajo=list(dinerarias=28000, cotizaciones_ss=1778)), h1),
    tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$gastos_guarderia, 300)
})

test_that("Cantabria: gastos de enfermedad (10 %, límite 500 €, base − MPF < 22.946)", {
  d1 <- persona("d1","declarante",45, trabajo=list(dinerarias=25000, cotizaciones_ss=1587))
  d1$gastos_enfermedad <- 8000
  h <- nuevo_hogar("v","ES-CB", list(d1))
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$gastos_enfermedad, 500)

  d2 <- persona("d1","declarante",45, trabajo=list(dinerarias=50000, cotizaciones_ss=3175))
  d2$gastos_enfermedad <- 8000
  expect_null(liquidar(nuevo_hogar("v","ES-CB", list(d2)))$deducciones_autonomicas$detalle$gastos_enfermedad)
})

test_that("Cantabria: gastos de educación — libros de texto 100 %, límite 200 €", {
  h1 <- persona("h1","descendiente",10); h1$gastos_libros_texto <- 500
  h <- nuevo_hogar("v","ES-CB", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=28000, cotizaciones_ss=1778)), h1),
    tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$gastos_educacion_libros, 200)
})

test_that("Cantabria: arrendamiento de vivienda habitual (10 %, límite 300 €, < 36 años)", {
  h <- nuevo_hogar("v","ES-CB", list(persona("d1","declarante",30,
    trabajo=list(dinerarias=25000, cotizaciones_ss=1587), alquiler_vivienda_pagos=5000)))
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$arrendamiento_vivienda_habitual, 300)
})
