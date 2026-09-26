# Reducción por aportaciones a sistemas de previsión social (arts. 51.6 y 52.1 LIRPF): límites
# por partícipe y 30 % de los rendimientos netos del art. 19. Desarrollo en docs/03, sección
# «Planes de pensiones: límites por partícipe».

con_plan <- function(terr = "ES-CM", bruto = 30000, ss = 1905, ind = 0, emp = 0, ...) {
  nuevo_hogar("p", terr, list(persona("d1", "declarante", 40,
    trabajo = if (bruto > 0) list(dinerarias = bruto, cotizaciones_ss = ss) else NULL,
    prevision_social = list(aportacion_individual = ind, contribucion_empresarial = emp), ...)))
}
red_ps <- function(h, modo = "auto") liquidar(h, modo = modo)$reducciones_base$prevision_social

test_that("Límite general de 1.500 € y ampliación de hasta 8.500 € por contribuciones empresariales", {
  expect_equal(red_ps(con_plan(ind = 1500)), 1500)
  expect_equal(red_ps(con_plan(ind = 3000)), 1500)
  expect_equal(red_ps(con_plan(ind = 1500, emp = 2000)), 3500)
  expect_equal(liquidar(con_plan(ind = 1500))$base_liquidable_general, 26095 - 1500)
})

test_that("El 30 % se calcula sobre el rendimiento neto del art. 19 y limita el total", {
  # 18.000 € y 1.143 € de cotizaciones: rendimiento del art. 19 = 18.000 − 1.143 − 2.000 = 14.857
  # límite = mín(30 % × 14.857 = 4.457,10; 1.500 + 8.000) = 4.457,10
  expect_equal(red_ps(con_plan(bruto = 18000, ss = 1143, ind = 1500, emp = 8000)), 4457.10)
  # autónomo en directa simplificada: 4.000 − 5 % = 3.800 -> 30 % = 1.140
  h <- con_plan(bruto = 0, ind = 1500, actividades = list(metodo = "directa_simplificada", rendimiento_neto_previo = 4000))
  expect_equal(red_ps(h), 1140)
})

test_that("En tributación conjunta cada partícipe conserva su propio límite", {
  h <- nuevo_hogar("p", "ES-MD", list(
    persona("d1", "declarante", 45, trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905),
            prevision_social = list(aportacion_individual = 1500)),
    persona("d2", "conyuge", 44, trabajo = list(dinerarias = 20000, cotizaciones_ss = 1270),
            prevision_social = list(aportacion_individual = 1500))), tipo_unidad_familiar = "biparental")
  expect_equal(red_ps(h, "conjunta"), 3000)   # 1.500 + 1.500 (antes: 1.500 en total)
  expect_equal(liquidar(h, modo = "individual")$reducciones_base$prevision_social, 1500)   # la del primer declarante
})
