# Cotizaciones del trabajador a la Seguridad Social (órdenes de cotización 2025 y 2026) y
# sueldo neto anual. Cálculo a mano en docs/03, sección «Cotizaciones del trabajador y
# sueldo neto».

P25 <- cargar_parametros("ES-MD", 2025)
P26 <- cargar_parametros("ES-MD", 2026)

test_that("Tipos del trabajador: 6,48 % (2025) y 6,50 % (2026) indefinido; +0,05 p.p. temporal", {
  expect_equal(cotizaciones_trabajador_detalle(30000, P25)$tipo, 0.0648)
  expect_equal(cotizaciones_trabajador_detalle(30000, P26)$tipo, 0.0650)
  expect_equal(cotizaciones_trabajador_detalle(30000, P26, "temporal")$tipo, 0.0655)
  expect_equal(cotizaciones_trabajador(30000, P26), 1950)        # 12 × 2.500 × 6,50 %
  expect_equal(cotizaciones_trabajador(30000, P25), 1944)        # 12 × 2.500 × 6,48 %
  expect_equal(cotizaciones_trabajador(30000, P26, "temporal"), 1965)
  expect_error(cotizaciones_trabajador(30000, P26, "fijo"))
})

test_that("Base máxima y cotización adicional de solidaridad", {
  # 2026, temporal, 80.000 €: base 5.101,20 → 4.009,54; solidaridad 12 × (510,12 × 0,19 % +
  # 1.055,35 × 0,21 %) = 38,23
  d <- cotizaciones_trabajador_detalle(80000, P26, "temporal")
  expect_equal(d$base_mensual, 5101.20)
  expect_equal(d$ordinaria, 4009.54)
  expect_equal(d$solidaridad, 38.23)
  expect_equal(d$total, 4047.77)
  # 2025, indefinido, 100.000 €: los tres tramos (0,15 / 0,17 / 0,19 %)
  expect_equal(cotizaciones_trabajador(100000, P25), 3888.62)
  # justo en la base máxima no hay solidaridad
  expect_equal(cotizaciones_trabajador_detalle(12 * 5101.20, P26)$solidaridad, 0)
})

test_that("Por debajo de la base mínima se cotiza por la retribución (jornada parcial)", {
  expect_equal(cotizaciones_trabajador(12000, P26), 780)
  expect_equal(cotizaciones_trabajador(0, P26), 0)
})

test_that("Sueldo neto anual: bruto − cotizaciones − IRPF (Madrid, 2026)", {
  s <- sueldo_neto(30000, "ES-MD", 2026)
  expect_equal(s$cotizaciones, 1950)
  expect_equal(s$irpf, 4598.02)                  # 2.463,00 estatal + 2.135,02 autonómica
  expect_equal(s$neto, 23451.98)
  # aportación de 1.500 € a un plan: ahorro = 1.500 × (15 % + 12,8 %) = 417 €
  expect_equal(sueldo_neto(30000, "ES-MD", 2026, aportacion_plan = 1500)$irpf, 4598.02 - 417)
  # donativo de 150 €: 80 % = 120 €
  expect_equal(sueldo_neto(30000, "ES-MD", 2026, donativos = 150)$irpf, 4598.02 - 120)
})

test_that("Sueldo neto con un hijo menor de 3 años: la deducción por maternidad reduce el IRPF", {
  s0 <- sueldo_neto(30000, "ES-CM", 2026, hijos = 2)
  liq <- s0$liquidacion
  expect_equal(s0$irpf, red2(liq$cuota_resultante_autoliquidacion - liq$deducciones_cuota_diferencial$total))
  expect_true(liq$deducciones_cuota_diferencial$total >= 1200)
})
