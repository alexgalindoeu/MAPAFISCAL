# Mínimos personales y familiares autonómicos (art. 46.1.a Ley 22/2009): importes propios de
# cada CCAA para el gravamen autonómico. Fuente: Manual Práctico Renta 2025, «Cuadro comparativo
# de los importes de los mínimos personales y familiares, estatal y autonómicos para 2025».
# Desarrollo en docs/03_casos_validacion.md, sección «Mínimos autonómicos».

soltero <- function(terr, edad = 40, bruto = 30000, ss = 1905, ...) {
  nuevo_hogar("m", terr, list(persona("d1", "declarante", edad,
    trabajo = list(dinerarias = bruto, cotizaciones_ss = ss), ...)))
}

test_that("Ejemplo 1 de la AEAT (Madrid, 16.500 € y 1.200 €): cuota íntegra 187,19 € al céntimo", {
  l <- liquidar(soltero("ES-MD", bruto = 16500, ss = 1200))
  expect_equal(l$minimo_personal_familiar$total, 5550)
  expect_equal(l$minimo_personal_familiar_autonomico$total, 5956.65)
  expect_equal(l$cuota_integra_estatal, 117.04)        # (6.782 − 5.550) × 9,5 %
  expect_equal(l$cuota_integra_autonomica, 70.15)      # (6.782 − 5.956,65) × 8,5 %
  expect_equal(l$cuota_integra_total, 187.19)
})

test_that("El mínimo estatal no cambia; el autonómico solo afecta a la cuota autonómica", {
  md <- liquidar(soltero("ES-MD"))
  expect_equal(md$cuota_integra_estatal, 2469.75)
  expect_equal(md$minimo_personal_familiar$total, 5550)
  expect_equal(md$minimo_personal_familiar_autonomico$total, 5956.65)
})

test_that("Importes completos: Comunitat Valenciana, monoparental con hijos de 1 y 5 años", {
  h <- nuevo_hogar("m", "ES-VC", list(persona("d1", "declarante", 40,
    trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905)),
    persona("h1", "descendiente", 1), persona("h2", "descendiente", 5)), tipo_unidad_familiar = "monoparental")
  l <- liquidar(h)
  # estatal 5.550 + 2.400 + 2.800 (< 3 años) + 2.700 = 13.450
  expect_equal(l$minimo_personal_familiar$total, 13450)
  # autonómico 6.105 + 2.640 + 3.080 + 2.970 = 14.795
  expect_equal(l$minimo_personal_familiar_autonomico$total, 14795)
})

test_that("Andalucía, Asturias, Canarias y Galicia: mínimo del contribuyente con edad", {
  expect_equal(liquidar(soltero("ES-AN", edad = 80))$minimo_personal_familiar_autonomico$total, 5790 + 1200 + 1460)
  expect_equal(liquidar(soltero("ES-AS", edad = 70))$minimo_personal_familiar_autonomico$total, 6105 + 1265)
  expect_equal(liquidar(soltero("ES-CN"))$minimo_personal_familiar_autonomico$total, 5606)
  expect_equal(liquidar(soltero("ES-GA", edad = 70))$minimo_personal_familiar_autonomico$total, 5789 + 1199)
})

test_that("Illes Balears: 6.105 € de mínimo general solo para mayores de 65 años", {
  expect_equal(liquidar(soltero("ES-IB"))$minimo_personal_familiar_autonomico$total, 5550)
  expect_equal(liquidar(soltero("ES-IB", edad = 70))$minimo_personal_familiar_autonomico$total, 6105 + 1265)
  expect_equal(liquidar(soltero("ES-IB", edad = 80))$minimo_personal_familiar_autonomico$total, 6105 + 1265 + 1540)
})

test_that("La Rioja: solo cambia la discapacidad de los descendientes (asistencia sigue en 3.000 €)", {
  hijo <- function(grado) nuevo_hogar("m", "ES-RI", list(persona("d1", "declarante", 40,
    trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905)),
    persona("h1", "descendiente", 10, discapacidad = grado)), tipo_unidad_familiar = "monoparental")
  l33 <- liquidar(hijo("33_64"))
  expect_equal(l33$minimo_personal_familiar$total, 5550 + 2400 + 3000)
  expect_equal(l33$minimo_personal_familiar_autonomico$total, 5550 + 2400 + 3300)
  l65 <- liquidar(hijo("65_mas"))
  expect_equal(l65$minimo_personal_familiar_autonomico$total, 5550 + 2400 + 9900 + 3000)
  # la discapacidad del propio contribuyente no cambia en La Rioja
  expect_equal(liquidar(soltero("ES-RI", discapacidad = "33_64"))$minimo_personal_familiar_autonomico$total, 5550 + 3000)
})

test_that("Cataluña, Castilla y León y las CCAA sin importes propios usan el estatal", {
  for (t in c("ES-CT", "ES-CL", "ES-AR", "ES-CM", "ES-MC", "ES-EX", "ES-CB")) {
    l <- liquidar(soltero(t, edad = 70))
    expect_equal(l$minimo_personal_familiar_autonomico$total, l$minimo_personal_familiar$total, label = t)
  }
})

test_that("El mínimo autonómico va a la base del ahorro cuando la general no lo agota", {
  h <- nuevo_hogar("m", "ES-MD", list(persona("d1", "declarante", 40, capital_mobiliario = list(intereses = 10000))))
  l <- liquidar(h)
  # estatal: escala(10.000) − escala(5.550) = 990 − 527,25
  expect_equal(l$cuota_integra_estatal, 462.75)
  # autonómica (escala del ahorro autonómica): 990 − (5.956,65 × 9,5 %) = 990 − 565,88
  expect_equal(l$cuota_integra_autonomica, 424.12)
})
