# Gravamen de la base liquidable del ahorro (art. 66.1 LIRPF) y ejemplo oficial de cuotas
# íntegras de la AEAT. Desarrollo en docs/03_casos_validacion.md, sección «Base del ahorro».

test_that("Art. 66: con el mínimo en la base del ahorro, escala(BLA) − escala(mínimo en ahorro) (issue #3)", {
  # Manual Práctico Renta 2025, «Gravamen de la base liquidable del ahorro → Gravamen estatal»:
  # la escala se aplica a toda la base del ahorro y se resta la misma escala aplicada a la
  # parte de esa base que corresponde al mínimo personal y familiar.
  h <- nuevo_hogar("a", "ES-CM", list(persona("d1", "declarante", 40,
    capital_mobiliario = list(intereses = 10000))))
  l <- liquidar(h)
  expect_equal(l$base_liquidable_general, 0)
  expect_equal(l$base_liquidable_ahorro, 10000)
  # escala(10.000) = 6.000 × 9,5 % + 4.000 × 10,5 % = 990; escala(5.550) = 527,25
  expect_equal(l$cuota_integra_estatal, 462.75)
  expect_equal(l$cuota_integra_autonomica, 462.75)
  expect_equal(l$cuota_integra_total, 925.50)
})

test_that("Ejemplo práctico de la AEAT: cuotas íntegras en Aragón (general 23.900 €, ahorro 2.800 €)", {
  # Manual Práctico Renta 2025, «Ejemplo práctico: cálculo de las cuotas íntegras estatal y
  # autonómica»: estatal 2.406,50 €, autonómica 2.360,64 €.
  h <- nuevo_hogar("a", "ES-AR", list(persona("d1", "declarante", 40,
    capital_mobiliario = list(intereses = 2800))))
  h$miembros[[1]]$ganancias_perdidas_no_transmision <- 23900   # base general sin reducciones
  l <- liquidar(h)
  expect_equal(l$base_liquidable_general, 23900)
  expect_equal(l$base_liquidable_ahorro, 2800)
  expect_equal(l$minimo_personal_familiar$total, 5550)
  expect_equal(l$cuota_integra_estatal, 2406.50)
  expect_equal(l$cuota_integra_autonomica, 2360.64)
})
