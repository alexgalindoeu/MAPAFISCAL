# Ejercicio 2026, núcleo estatal (params/2026/estatal.yaml): DA 61.ª en la redacción del
# RDL 5/2026 y deducciones con plazo prorrogadas por el RDL 7/2026. Desarrollo a mano en
# docs/03_casos_validacion.md, sección «Ejercicio 2026: núcleo estatal».

asalariado26 <- function(territorio, bruto, ss, ejercicio = 2026, intereses = 0) {
  nuevo_hogar("v", territorio, list(persona("d1", "declarante", 40,
    trabajo = list(dinerarias = bruto, cotizaciones_ss = ss),
    capital_mobiliario = if (intereses > 0) list(intereses = intereses) else NULL)),
    ejercicio = ejercicio)
}

test_that("2026: bloques estatales comprobados sin cambios se heredan de 2025", {
  e25 <- leer_params(2025, "estatal.yaml"); e26 <- leer_params(2026, "estatal.yaml")
  for (b in c("escala_general_estatal", "escala_ahorro_estatal", "minimo_contribuyente",
              "minimo_descendientes", "trabajo_otros_gastos", "trabajo_reduccion_art20",
              "reduccion_prevision_social", "reduccion_tributacion_conjunta", "obligacion_declarar"))
    expect_equal(e26[[b]], e25[[b]], info = b)
})

test_that("DA 61.ª 2026: con el SMI (17.094 €) la deducción anula la cuota (CLM)", {
  l <- liquidar(asalariado26("ES-CM", 17094, 1111.11))   # cotizaciones del 6,50 %
  # 17.094 − 1.111,11 = 15.982,89; art. 20: 7.302 − 1,75 × 1.130,89 = 5.322,94
  # BLG = 15.982,89 − 2.000 − 5.322,94 = 8.659,95; cuota: 2 × 9,5 % × 3.109,95 = 590,89
  expect_equal(l$cuota_integra_total, 590.89, tolerance = 0.006)
  expect_equal(l$deduccion_rendimientos_trabajo$total, 590.89, tolerance = 0.006)
  expect_equal(l$cuota_resultante_autoliquidacion, 0, tolerance = 0.006)
  # con las reglas de 2025 la deducción era de 340 − 0,2 × 518 = 236,40 €
  l25 <- liquidar(asalariado26("ES-CM", 17094, 1111.11, ejercicio = 2025))
  expect_equal(l25$deduccion_rendimientos_trabajo$total, 236.40)
  expect_equal(l25$cuota_resultante_autoliquidacion, 590.89 - 236.40, tolerance = 0.006)
})

test_that("DA 61.ª 2026: tramo decreciente y umbral final", {
  l <- liquidar(asalariado26("ES-CM", 18500, 1202.50))
  expect_equal(l$deduccion_rendimientos_trabajo$total, 309.69)   # 590,89 − 0,2 × 1.406
  # cuota íntegra: 2 × 9,5 % × (12.275,125 − 5.550) = 1.277,77
  expect_equal(l$cuota_resultante_autoliquidacion, 1277.77 - 309.69, tolerance = 0.011)
  expect_equal(liquidar(asalariado26("ES-CM", 20000, 1300))$deduccion_rendimientos_trabajo$total, 9.69)
  expect_equal(liquidar(asalariado26("ES-CM", 20048.45, 1303.15))$deduccion_rendimientos_trabajo$total, 0)
})

test_that("DA 61.ª 2026: sin deducción con más de 6.500 € de otras rentas", {
  l <- liquidar(asalariado26("ES-CM", 17094, 1111.11, intereses = 6600))
  expect_equal(l$deduccion_rendimientos_trabajo$total, 0)
})

test_that("2026: deducciones con plazo (RDL 7/2026) y límites de módulos sin verificar", {
  e26 <- leer_params(2026, "estatal.yaml")
  ee <- e26$deduccion_obras_eficiencia_energetica
  expect_equal(ee$estado, "confirmado")
  expect_equal(ee$reduccion_demanda$pagos_hasta, "2026-12-31")
  expect_equal(ee$rehabilitacion_edif$pagos_hasta, "2027-12-31")
  expect_equal(ee$rehabilitacion_edif$base_maxima, 5000)
  expect_equal(ee$rehabilitacion_edif$base_acumulada_maxima, 15000)
  ve <- e26$deduccion_vehiculos_electricos
  expect_equal(c(ve$porcentaje, ve$base_maxima_vehiculo, ve$base_maxima_punto_recarga), c(0.15, 20000, 4000))
  expect_equal(ve$adquisicion_hasta, "2026-12-31")
  au <- e26$deduccion_autoconsumo_renovable
  expect_equal(c(au$porcentaje_inmueble, au$porcentaje_edificio_residencial, au$base_maxima), c(0.10, 0.20, 5000))
  expect_equal(e26$estimacion_objetiva$estado, "pendiente")
})
