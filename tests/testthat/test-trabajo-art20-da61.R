# Reducción del art. 20 LIRPF (cuantía sobre íntegro − gastos a) a e), sin la letra f) y
# deducción por obtención de rendimientos del trabajo (DA 61.ª LIRPF, Ley 5/2025).
# Desarrollo a mano en docs/03_casos_validacion.md, sección «Trabajo: art. 20 y DA 61.ª».

asalariado <- function(territorio, bruto, ss, edad = 40, pension = FALSE, intereses = 0) {
  nuevo_hogar("v", territorio, list(persona("d1", "declarante", edad,
    trabajo = list(dinerarias = bruto, cotizaciones_ss = ss, pension_jubilacion = pension),
    capital_mobiliario = if (intereses > 0) list(intereses = intereses) else NULL)))
}

test_that("Art. 20: la cuantía se fija sin restar antes los 2.000 € de otros gastos (SMI, CLM)", {
  l <- liquidar(asalariado("ES-CM", 16576, 1074.12))
  # 16.576 − 1.074,12 = 15.501,88 -> 7.302 − 1,75 × (15.501,88 − 14.852) = 6.164,71
  expect_equal(l$componentes_renta$reduccion_trabajo, 6164.71, tolerance = 1e-6)
  # 15.501,88 − 2.000 − 6.164,71 = 7.337,17
  expect_equal(l$base_liquidable_general, 7337.17, tolerance = 1e-6)
  # (7.337,17 − 5.550) × 9,5 % en cada tramo (CLM usa la escala estatal)
  expect_equal(l$cuota_integra_estatal, 169.78)
  expect_equal(l$cuota_integra_total, 339.56)
})

test_that("Art. 20: tabla del issue #2 (CLM, cotizaciones al 6,48 %)", {
  expect_equal(liquidar(asalariado("ES-CM", 18000, 1166.40))$cuota_integra_total, 1035.39)
  expect_equal(liquidar(asalariado("ES-CM", 20000, 1296))$cuota_integra_total, 2046.46)
})

test_that("Art. 20: base liquidable del ejemplo 1 de la AEAT (Madrid, 16.500 € y 1.200 €)", {
  l <- liquidar(asalariado("ES-MD", 16500, 1200))
  # 15.300 − 2.000 − [7.302 − 1,75 × (15.300 − 14.852)] = 6.782
  expect_equal(l$base_liquidable_general, 6782)
  expect_equal(l$cuota_integra_estatal, 117.04)            # (6.782 − 5.550) × 9,5 %
  # la deducción absorbe toda la cuota íntegra (límite del 100 %)
  expect_equal(l$deduccion_rendimientos_trabajo$total, l$cuota_integra_total)
  expect_equal(l$cuota_resultante_autoliquidacion, 0)
})

test_that("DA 61.ª: con el SMI la deducción deja la cuota resultante a cero", {
  l <- liquidar(asalariado("ES-CM", 16576, 1074.12))
  expect_equal(l$cuota_liquida_total, 339.56)
  # 340 € limitados a la cuota íntegra que corresponde al trabajo (100 %)
  expect_equal(l$deduccion_rendimientos_trabajo$total, 339.56)
  expect_equal(l$cuota_resultante_autoliquidacion, 0)
  expect_equal(l$cuota_diferencial, 0)
})

test_that("DA 61.ª: tramo decreciente (17.500 € -> 155,20 €, como el ejemplo 3 de la AEAT)", {
  l <- liquidar(asalariado("ES-CM", 17500, 1134))
  expect_equal(l$deduccion_rendimientos_trabajo$total, 155.20)   # 340 − 0,2 × 924
  # cuota íntegra: 2 × (9.713,50 − 5.550) × 9,5 % = 791,065
  expect_equal(l$cuota_resultante_autoliquidacion, 791.065 - 155.20, tolerance = 0.011)
  expect_equal(liquidar(asalariado("ES-CM", 18000, 1166.40))$deduccion_rendimientos_trabajo$total, 55.20)
  expect_equal(liquidar(asalariado("ES-CM", 20000, 1296))$deduccion_rendimientos_trabajo$total, 0)
})

test_that("DA 61.ª: no se aplica a pensiones (ejemplo 2 de la AEAT)", {
  sal <- liquidar(asalariado("ES-CM", 17000, 0, edad = 70))
  pen <- liquidar(asalariado("ES-CM", 17000, 0, edad = 70, pension = TRUE))
  expect_equal(pen$cuota_liquida_total, sal$cuota_liquida_total)   # la cuota no cambia
  expect_equal(pen$deduccion_rendimientos_trabajo$total, 0)
  expect_equal(sal$deduccion_rendimientos_trabajo$total, 255.20)   # 340 − 0,2 × 424
})

test_that("DA 61.ª: otras rentas por encima de 6.500 € impiden la deducción", {
  l <- liquidar(asalariado("ES-CM", 16576, 1074.12, intereses = 7000))
  expect_equal(l$deduccion_rendimientos_trabajo$total, 0)
  expect_equal(l$componentes_renta$reduccion_trabajo, 0)            # tampoco hay reducción del art. 20
})

test_that("DA 61.ª: límite proporcional con rentas del ahorro por debajo de 6.500 €", {
  l <- liquidar(asalariado("ES-CM", 16576, 1074.12, intereses = 2000))
  # cuota íntegra 339,56 (general) + 2 × 2.000 × 9,5 % (ahorro) = 719,56
  expect_equal(l$cuota_integra_total, 719.56)
  # límite = 719,56 × 15.501,88 / (15.501,88 + 2.000) = 637,34 > 340
  expect_equal(l$deduccion_rendimientos_trabajo$total, 340)
  expect_equal(l$cuota_resultante_autoliquidacion, 379.56)
})

test_that("DA 61.ª: solo en régimen común", {
  expect_equal(liquidar(asalariado("ES-NC", 16576, 1074.12))$deduccion_rendimientos_trabajo$total, 0)
  expect_equal(liquidar(asalariado("ES-PV-BI", 16576, 1074.12))$deduccion_rendimientos_trabajo$total, 0)
})
