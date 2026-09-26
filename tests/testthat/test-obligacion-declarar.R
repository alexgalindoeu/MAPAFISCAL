# Obligación de declarar (art. 96 LIRPF). Supuestos del Manual Práctico Renta 2025,
# «Delimitación de la obligación de declarar en el IRPF». Resumen en docs/03.

pers <- function(terr = "ES-CM", bruto = 20000, otros_pagadores = 0, retenciones = 0, ...) {
  nuevo_hogar("o", terr, list(persona("d1", "declarante", 40,
    trabajo = if (bruto > 0) list(dinerarias = bruto, cotizaciones_ss = round(bruto * 0.0635, 2),
                                  otros_pagadores = otros_pagadores) else NULL,
    retenciones = retenciones, ...)))
}
obl <- function(h) liquidar(h)$obligacion_declarar

test_that("Trabajo de un pagador: límite de 22.000 €", {
  expect_false(obl(pers(bruto = 22000))$obligado)
  o <- obl(pers(bruto = 22001))
  expect_true(o$obligado); expect_equal(o$por_persona$d1$motivo, "trabajo")
})

test_that("Más de un pagador: 15.876 € si el 2.º y siguientes superan 1.500 €", {
  o <- obl(pers(bruto = 20000, otros_pagadores = 2000))
  expect_true(o$obligado); expect_equal(o$por_persona$d1$limite_trabajo, 15876)
  expect_false(obl(pers(bruto = 20000, otros_pagadores = 1500))$obligado)
})

test_that("Capital mobiliario con retención: límite de 1.600 €", {
  expect_false(obl(pers(capital_mobiliario = list(intereses = 1000, dividendos = 600)))$obligado)
  o <- obl(pers(capital_mobiliario = list(intereses = 1601)))
  expect_true(o$obligado); expect_equal(o$por_persona$d1$motivo, "capital")
})

test_that("Autónomos de alta en el RETA: obligados en todo caso", {
  h <- pers(bruto = 0, actividades = list(metodo = "directa_simplificada", rendimiento_neto_previo = 300))
  o <- obl(h)
  expect_true(o$obligado); expect_equal(o$por_persona$d1$motivo, "alta_reta")
})

test_that("Otras rentas: no obligado si en total no pasan de 1.000 € y las pérdidas son < 500 €", {
  alq <- function(i) pers(bruto = 0, capital_inmobiliario = list(list(ingresos = i)))
  o <- obl(alq(800)); expect_false(o$obligado); expect_equal(o$por_persona$d1$motivo, "rentas_minimas")
  o <- obl(alq(1200)); expect_true(o$obligado); expect_equal(o$por_persona$d1$motivo, "otras_rentas")
  # un alquiler, aunque sea pequeño, saca al asalariado del supuesto de «solo trabajo»
  expect_true(obl(pers(bruto = 15000, capital_inmobiliario = list(list(ingresos = 300))))$obligado)
})

test_that("Vivienda anterior a 2013 y planes de pensiones: hay que presentarla para aplicarlos", {
  o <- obl(pers(vivienda_transitoria_pagos = 6000, prevision_social = list(aportacion_individual = 1000)))
  expect_false(o$obligado)
  expect_equal(o$por_persona$d1$para_aplicar, c("vivienda_transitoria", "prevision_social"))
})

test_that("Conviene presentarla si no es obligatoria y sale a devolver", {
  o <- obl(pers(bruto = 16576, retenciones = 400))   # SMI: cuota resultante 0
  expect_false(o$obligado); expect_true(o$conviene_presentar)
  expect_false(obl(pers(bruto = 16576))$conviene_presentar)
})

test_that("Territorios forales: normativa propia no modelada (NA)", {
  expect_true(is.na(obl(pers(terr = "ES-NC"))$obligado))
  expect_true(is.na(obl(pers(terr = "ES-PV-BI"))$obligado))
})
