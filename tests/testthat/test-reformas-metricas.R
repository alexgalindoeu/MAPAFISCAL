test_that("aplicar_reforma es inmutable y modifica la ruta indicada", {
  P0 <- cargar_parametros("ES-MD", 2025)
  rf <- reforma(parche_tipo_tramo("estatal","escala_general_estatal", 3, 0.18),
                parche_minimo("general", 6000))
  P1 <- aplicar_reforma(P0, rf)
  expect_equal(P0$jurisdiccion$escala_general_estatal[[3]]$tipo, 0.15)  # original intacto
  expect_equal(P1$jurisdiccion$escala_general_estatal[[3]]$tipo, 0.18)
  expect_equal(P1$estatal$minimo_contribuyente$general, 6000)
})

test_that("una reforma que sube tipos aumenta la cuota", {
  h <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante",35,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905))))
  P0 <- cargar_parametros("ES-MD", 2025)
  P1 <- aplicar_reforma(P0, reforma(parche_tipo_tramo("estatal","escala_general_estatal",3,0.18)))
  expect_gt(liquidar(h, P1)$cuota_liquida_total, liquidar(h, P0)$cuota_liquida_total)
})

test_that("gini: 0 en igualdad perfecta, ~1 en concentración máxima", {
  expect_equal(gini(rep(100, 50)), 0)
  x <- c(rep(0, 999), 1e6)
  expect_gt(gini(x), 0.9)
})

test_that("gini con pesos coincide con gini replicando observaciones", {
  x <- c(10, 20, 30, 40); w <- c(2, 1, 1, 3)
  x_rep <- rep(x, w)
  expect_equal(gini(x, w), gini(x_rep), tolerance = 1e-8)
})

test_that("simular() devuelve variación de recaudación coherente con la reforma", {
  m <- generar_muestra(n_por_territorio = 120, territorios = c("ES-MD","ES-AN"), semilla = 42)
  rf <- reforma(parche_tipo_tramo("estatal","escala_general_estatal", 2, 0.14))  # sube 12->14
  sim <- simular(m, rf)
  expect_gt(sim$impacto$variacion_recaudacion, 0)
  expect_equal(nrow(sim$impacto$por_decil_base), 10)
})

test_that("comparar_territorios devuelve una fila por territorio", {
  h <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante",35,
    trabajo=list(dinerarias=35000, cotizaciones_ss=2222))))
  cmp <- comparar_territorios(h, territorios = c("ES-MD","ES-CT","ES-PV-BI","ES-NC"))
  expect_equal(nrow(cmp), 4)
  expect_true(all(cmp$cuota_liquida_total > 0))
})
