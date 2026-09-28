# Varios ejercicios: herencia de parámetros entre años (params/<año>/, `meta: hereda_de`) y
# fusión con fusionar_params(). Desarrollo en docs/03, sección «Varios ejercicios».

test_that("fusionar_params: mapas por clave, listas sin nombre enteras y `~` elimina", {
  base <- list(a = 1, b = list(x = 1, y = 2), tramos = list(list(hasta = 10, tipo = 0.1), list(hasta = Inf, tipo = 0.2)),
               quitar = list(z = 1))
  cambios <- list(b = list(y = 3), tramos = list(list(hasta = Inf, tipo = 0.15)), quitar = NULL, nueva = "n")
  r <- fusionar_params(base, cambios)
  expect_equal(r$a, 1)
  expect_equal(r$b, list(x = 1, y = 3))
  expect_equal(r$tramos, list(list(hasta = Inf, tipo = 0.15)))   # sustituida, no mezclada
  expect_false("quitar" %in% names(r))
  expect_equal(r$nueva, "n")
})

test_that("Hay ejercicio por defecto y 2026 está disponible, heredando de 2025", {
  expect_true(all(c(2025L, 2026L) %in% ejercicios_disponibles()))
  cfg <- ejercicios_config()
  expect_true(cfg$por_defecto %in% ejercicios_disponibles())
  expect_true(all(cfg$publicados %in% ejercicios_disponibles()))
  e26 <- leer_params(2026, "estatal.yaml")
  expect_equal(e26$meta$ejercicio, 2026)
  expect_equal(e26$meta$hereda_de, "2025/estatal.yaml")
  expect_equal(e26$minimo_contribuyente, leer_params(2025, "estatal.yaml")$minimo_contribuyente)
})

test_that("País Vasco 2026: se aplican la tarifa general deflactada y la escala del ahorro nueva", {
  # Antes, la herencia con modifyList() dejaba los tramos de 2025 (las listas sin nombre no se
  # sustituían): la tarifa de 2026 no se aplicaba.
  j25 <- cargar_parametros("ES-PV-BI", 2025)$jurisdiccion
  j26 <- cargar_parametros("ES-PV-BI", 2026)$jurisdiccion
  expect_equal(j25$escala_general_foral$tramos[[1]]$hasta, 17720)
  expect_equal(j26$escala_general_foral$tramos[[1]]$hasta, 18080)
  expect_equal(j26$escala_ahorro_foral$tramos[[1]], list(hasta = 7500, tipo = 0.19))
  expect_equal(j26$bonificacion_trabajo, j25$bonificacion_trabajo)   # heredada
  # misma renta: en 2026 la tarifa deflactada un 2 % da menos cuota
  h <- function(ej) nuevo_hogar("pv", "ES-PV-BI", list(persona("d1", "declarante", 40,
         trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905))), ejercicio = ej)
  expect_lt(liquidar(h(2026))$cuota_liquida_total, liquidar(h(2025))$cuota_liquida_total)
})

test_that("Un ejercicio sin parámetros da error, sin tomar otro año en silencio", {
  expect_error(cargar_parametros("ES-MD", 2019), "no hay parámetros")
  expect_error(leer_params(2019, "estatal.yaml"), "falta params/2019/estatal.yaml")
})
