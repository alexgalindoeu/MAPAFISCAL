# Reducción por aportaciones a previsión social en los territorios forales: País Vasco (arts.
# 70 a 72 de las NF del IRPF; EPSV y planes) y Navarra (art. 55.1.7.º TR IRPF). Cálculo a
# mano en docs/03, «Forales: planes de pensiones, EPSV y rescate».

red_foral <- function(terr, edad, bruto, ss, ind, emp = 0, ejercicio = 2025) {
  h <- nuevo_hogar("p", terr, list(persona("d1", "declarante", edad,
    trabajo = list(dinerarias = bruto, cotizaciones_ss = ss),
    prevision_social = list(aportacion_individual = ind, contribucion_empresarial = emp))), ejercicio)
  liquidar(h, modo = "individual")$reducciones_base$prevision_social
}

test_that("País Vasco: 5.000 € propios, 8.000 € de empresa y tope conjunto (12.000 / 10.000 €)", {
  expect_equal(red_foral("ES-PV-BI", 45, 60000, 3900, 6000), 5000)
  expect_equal(red_foral("ES-PV-BI", 45, 60000, 3900, 6000, 9000), 12000)
  expect_equal(red_foral("ES-PV-BI", 45, 60000, 3900, 6000, 9000, 2026), 10000)
  expect_equal(red_foral("ES-PV-SS", 45, 60000, 3900, 3000, 4000), 7000)
  # sin límite porcentual: con 14.000 € de sueldo (6.000 de base tras la bonificación) se reducen 5.000 €
  expect_equal(red_foral("ES-PV-VI", 45, 14000, 910, 5000), 5000)
})

test_that("Navarra: 30 % de los rendimientos (50 % desde los 51) y 1.500 € + 8.500 € de empresa", {
  # 4.000 € de sueldo, 260 € de cotizaciones: 30 % de 3.740 = 1.122
  expect_equal(red_foral("ES-NC", 40, 4000, 260, 1500), 1122)
  expect_equal(red_foral("ES-NC", 40, 40000, 2600, 3000), 1500)
  # 55 años: 50 % de (40.000 + 2.000 − 2.600) = 19.700; límite 1.500 + 2.000 = 3.500
  expect_equal(red_foral("ES-NC", 55, 40000, 2600, 3000, 2000), 3500)
  # 50 años: aún el 30 % (8.000 € + 2.000 € de empresa − 520 €: 30 % de 9.480 = 2.844 frente a 3.500)
  expect_equal(red_foral("ES-NC", 50, 8000, 520, 3000, 2000), 2844)
  expect_equal(red_foral("ES-NC", 51, 8000, 520, 3000, 2000), 3500)
})

test_that("Navarra: la reducción baja la base liquidable general", {
  h <- function(ind) nuevo_hogar("p", "ES-NC", list(persona("d1", "declarante", 40,
    trabajo = list(dinerarias = 40000, cotizaciones_ss = 2600),
    prevision_social = list(aportacion_individual = ind))))
  expect_equal(liquidar(h(0))$base_liquidable_general - liquidar(h(1500))$base_liquidable_general, 1500)
})
