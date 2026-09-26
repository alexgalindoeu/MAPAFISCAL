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
  # 18.000 € de salario + 8.000 € de contribución empresarial imputada (art. 17.1.e) y 1.143 € de
  # cotizaciones: rendimiento del art. 19 = 26.000 − 1.143 − 2.000 = 22.857
  # límite = mín(30 % × 22.857 = 6.857,10; 1.500 + 8.000) = 6.857,10
  expect_equal(red_ps(con_plan(bruto = 18000, ss = 1143, ind = 1500, emp = 8000)), 6857.10)
  # autónomo en directa simplificada: 4.000 − 5 % = 3.800 -> 30 % = 1.140
  h <- con_plan(bruto = 0, ind = 1500, actividades = list(metodo = "directa_simplificada", rendimiento_neto_previo = 4000))
  expect_equal(red_ps(h), 1140)
})

test_that("La contribución empresarial es rendimiento íntegro del trabajo (art. 17.1.e LIRPF)", {
  # con plan: 18.000 + 8.000 imputados; sin plan: 26.000 de salario. Mismo rendimiento del
  # art. 19 (22.857) y sin reducción del art. 20; la diferencia es solo la reducción de 6.857,10
  con <- liquidar(con_plan(bruto = 18000, ss = 1143, emp = 8000))
  sin <- liquidar(con_plan(bruto = 26000, ss = 1143))
  expect_equal(sin$base_liquidable_general, 22857)
  expect_equal(con$base_liquidable_general, 22857 - 6857.10)
  # obligación de declarar: 15.000 + 8.000 = 23.000 € de rendimientos íntegros > 22.000 €
  ob <- liquidar(con_plan(bruto = 15000, ss = 952.5, emp = 8000))$obligacion_declarar
  expect_true(ob$obligado)
  expect_equal(ob$por_persona$d1$motivo, "trabajo")
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
