# Deducciones autonómicas de la Comunitat Valenciana (Ley 13/1997). Ver docs/03_casos_validacion.md.

test_that("CV: familia monoparental (no numerosa) 330 €, base <= 30.000", {
  h <- nuevo_hogar("v","ES-VC", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=28000, cotizaciones_ss=1778)),
    persona("h1","descendiente",7)), tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$familia_monoparental, 330)

  h2 <- nuevo_hogar("v","ES-VC", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=45000, cotizaciones_ss=2857)),
    persona("h1","descendiente",7)), tipo_unidad_familiar="monoparental")
  expect_null(liquidar(h2, modo="individual")$deducciones_autonomicas$detalle$familia_monoparental)
})

test_that("CV: custodia en guarderías 15 %, límite 297 €/hijo < 3", {
  h1 <- persona("h1","descendiente",1); h1$gastos_guarderia <- 3000
  h2 <- persona("h2","descendiente",4); h2$gastos_guarderia <- 2000   # 4 años -> fuera
  h <- nuevo_hogar("v","ES-VC", list(persona("d1","declarante",35,
    trabajo=list(dinerarias=26000, cotizaciones_ss=1651)), h1, h2),
    tipo_unidad_familiar="monoparental")
  # 15 % de 3.000 = 450 -> 297
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$custodia_guarderias, 297)
})

test_that("CV: contribuyente con discapacidad y >= 65 años -> 197 €", {
  mk <- function(edad) {
    p <- persona("d1","declarante", edad, discapacidad="33_64",
                 trabajo=list(dinerarias=20000, cotizaciones_ss=1270))
    liquidar(nuevo_hogar("v","ES-VC", list(p)))$deducciones_autonomicas$detalle$contribuyente_discapacidad_65
  }
  expect_equal(mk(67), 197)
  expect_null(mk(55))   # < 65
})

test_that("CV: ascendiente > 75 -> 197 € por ascendiente", {
  h <- nuevo_hogar("v","ES-VC", list(
    persona("d1","declarante",50, trabajo=list(dinerarias=27000, cotizaciones_ss=1714)),
    persona("a1","ascendiente",80, rentas_propias=0)))
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$ascendientes_75, 197)
})

test_that("CV: abonos culturales 21 %, base máxima 165 €, rentas < 50.000", {
  d1 <- persona("d1","declarante",30, trabajo=list(dinerarias=30000, cotizaciones_ss=1905))
  d1$gastos_abonos_culturales <- 500
  h <- nuevo_hogar("v","ES-VC", list(d1))
  # base topada a 165 -> 21 % = 34,65
  expect_equal(liquidar(h)$deducciones_autonomicas$detalle$abonos_culturales, round(0.21 * 165, 2))

  d2 <- persona("d1","declarante",30, trabajo=list(dinerarias=70000, cotizaciones_ss=4445))
  d2$gastos_abonos_culturales <- 500
  expect_null(liquidar(nuevo_hogar("v","ES-VC", list(d2)))$deducciones_autonomicas$detalle$abonos_culturales)
})

# ---- Reducción lineal (taper) y variantes, Ley 13/1997 art. 4.Cuatro y Cinco (red. Ley 5/2025) ----

test_that("CV: taper lineal entre 27.000 y 30.000 (monoparental a base 28.500 -> 50 %)", {
  # rn trabajo = 32.000 − 1.500 − 2.000 = 28.500 (sin reducción art. 20) -> factor 1 − 1.500/3.000 = 0,5
  h <- nuevo_hogar("v","ES-VC", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=32000, cotizaciones_ss=1500)),
    persona("h1","descendiente",7)), tipo_unidad_familiar="monoparental")
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$familia_monoparental, 165)
})

test_that("CV: nacimiento 2025 = 600/750/900 por orden, ventana de 3 ejercicios", {
  h <- nuevo_hogar("v","ES-VC", list(persona("d1","declarante",33,
    trabajo=list(dinerarias=20000, cotizaciones_ss=1270)),
    persona("h1","descendiente",5), persona("h2","descendiente",2)),
    tipo_unidad_familiar="monoparental")
  # h2 (2 años) es el 2º hijo y está dentro de la ventana -> 750 €
  expect_equal(liquidar(h, modo="individual")$deducciones_autonomicas$detalle$nacimiento_adopcion, 750)
})

test_that("CV: familia numerosa especial 660 € con taper 31.000-35.000 (base 33.000 -> 330)", {
  hijos <- lapply(1:5, function(i) persona(paste0("h", i), "descendiente", 3 + i))
  h <- nuevo_hogar("v","ES-VC", c(list(persona("d1","declarante",45,
    trabajo=list(dinerarias=36000, cotizaciones_ss=1000))), hijos),
    tipo_unidad_familiar="monoparental", familia_numerosa="especial")
  d <- liquidar(h, modo="individual")$deducciones_autonomicas$detalle
  expect_equal(d$familia_numerosa_especial, 330)
  expect_null(d$familia_monoparental)          # no se acumula con la de familia numerosa
})

test_that("CV: alquiler — variantes excluyentes, se aplica la mayor (joven 25 %/950)", {
  mk <- function(dinerarias, ss) {
    p <- persona("d1","declarante",30, trabajo=list(dinerarias=dinerarias, cotizaciones_ss=ss),
                 alquiler_vivienda_pagos=5000)
    liquidar(nuevo_hogar("v","ES-VC", list(p)))$deducciones_autonomicas$detalle
  }
  d <- mk(25000, 1587)                          # base 21.413 < 27.000
  expect_equal(d$arrendamiento_vivienda_habitual_joven, 950)
  expect_null(d[["arrendamiento_vivienda_habitual"]])   # [[ ]]: evita la coincidencia parcial de $
  d2 <- mk(32000, 1500)                         # base 28.500 -> el límite se reduce al 50 %: 475
  expect_equal(d2$arrendamiento_vivienda_habitual_joven, 475)
})

test_that("CV: material escolar solo con progenitor en desempleo (110 €/hijo)", {
  mk <- function(desempleado) {
    p <- persona("d1","declarante",40, trabajo=list(dinerarias=20000, cotizaciones_ss=1270),
                 desempleado=desempleado)
    liquidar(nuevo_hogar("v","ES-VC", list(p, persona("h1","descendiente",10)),
                         tipo_unidad_familiar="monoparental"))$deducciones_autonomicas$detalle$material_escolar
  }
  expect_null(mk(FALSE))
  expect_equal(mk(TRUE), 110)
})

test_that("CV: guardería exige que trabajen los dos progenitores; se prorratea en individual", {
  mk <- function(trabaja_d2) {
    h1 <- persona("h1","descendiente",1); h1$gastos_guarderia <- 3000
    d2 <- if (trabaja_d2) persona("d2","conyuge",33, trabajo=list(dinerarias=22000, cotizaciones_ss=1397))
          else persona("d2","conyuge",33)
    h <- nuevo_hogar("v","ES-VC", list(persona("d1","declarante",34,
      trabajo=list(dinerarias=24000, cotizaciones_ss=1524)), d2, h1), tipo_unidad_familiar="biparental")
    liquidar(h, modo="individual")$deducciones_autonomicas$detalle$custodia_guarderias
  }
  expect_null(mk(FALSE))
  expect_equal(mk(TRUE), 148.5)                 # min(15 % × 3.000, 297) / 2
})
