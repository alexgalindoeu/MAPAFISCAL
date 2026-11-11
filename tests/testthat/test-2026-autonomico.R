# Ejercicio 2026, régimen común: escalas autonómicas (Ley 2/2026 de Extremadura y Ley 5/2026
# de la Comunitat Valenciana; el resto, heredadas de 2025). Desarrollo a mano en
# docs/03_casos_validacion.md, sección «Ejercicio 2026: escalas y mínimos autonómicos».

esc26 <- function(t, ej = 2026) cargar_parametros(t, ej)$jurisdiccion$escala_general_autonomica
sol26 <- function(t, b, ss, ej = 2026) liquidar(nuevo_hogar("s", t, list(persona("d1", "declarante", 35,
  trabajo = list(dinerarias = b, cotizaciones_ss = ss))), ejercicio = ej))

test_that("Extremadura 2026: 7,75 % y 9,75 % en los dos primeros tramos (DF 2.ª Ley 2/2026)", {
  e <- esc26("ES-EX")
  expect_equal(vapply(e[1:3], `[[`, 0, "tipo"), c(0.0775, 0.0975, 0.16))
  # cuotas acumuladas de la tabla de la DF 2.ª.Uno (964,88 redondeado)
  expect_equal(vapply(c(12450, 20200, 24200, 35200, 60000, 80200, 99200, 120200), aplicar_escala, 0, e),
               c(964.875, 1720.50, 2360.50, 4285.50, 9493.50, 14240.50, 18800.50, 23945.50))
  # soltero, 30.000 €: base 26.095; 2.692,125 − 5.550 × 7,75 % = 2.262,00 (2025: 2.298,63)
  expect_equal(sol26("ES-EX", 30000, 1905)$cuota_integra_autonomica, 2262.00)
  expect_equal(sol26("ES-EX", 30000, 1905, 2025)$cuota_integra_autonomica, 2298.63)
})

test_that("Comunitat Valenciana 2026: escala de once tramos del art. 18 Ley 5/2026", {
  e <- esc26("ES-VC")
  expect_length(e, 11)
  expect_equal(vapply(c(12000, 22000, 32000, 42000, 52000, 62000, 72000, 100000, 150000, 200000), aplicar_escala, 0, e),
               c(1056, 2226, 3686, 5386, 7326, 9516, 11956, 19264, 32939, 47114))   # cuotas del DOGV
  expect_equal(e[[11]]$tipo, 0.2935)
  # 30.000 €: 2.823,87 − 6.105 × 8,8 % = 2.286,63; 120.000 €: 22.846,85 − 537,24 = 22.309,61
  expect_equal(sol26("ES-VC", 30000, 1905)$cuota_integra_autonomica, 2286.63)
  expect_equal(sol26("ES-VC", 120000, 4900)$cuota_integra_autonomica, 22309.61)
  expect_equal(sol26("ES-VC", 120000, 4900, 2025)$cuota_integra_autonomica, 22753.05)
})

test_that("Las otras 13 CCAA heredan la escala y los mínimos de 2025", {
  for (t in setdiff(TERRITORIOS[vapply(TERRITORIOS, regimen_territorio, "") == "comun"], c("ES-EX", "ES-VC"))) {
    expect_equal(esc26(t), esc26(t, 2025), info = t)
    expect_equal(cargar_parametros(t, 2026)$jurisdiccion$minimo_autonomico,
                 cargar_parametros(t, 2025)$jurisdiccion$minimo_autonomico, info = t)
  }
  expect_equal(sol26("ES-MD", 30000, 1905)$cuota_liquida_total, 4610.53)   # = Caso A (2025)
})

test_that("Andalucía, Galicia y Canarias: provisionales por un proyecto de ley con efectos 2026", {
  a26 <- leer_params(2026, "autonomico.yaml")$territorios
  for (t in c("ES-AN", "ES-GA", "ES-CN")) {
    expect_equal(a26[[t]]$escala_general_autonomica$estado, "provisional", info = t)
    expect_match(a26[[t]]$escala_general_autonomica$motivo, "1-1-2026", info = t)
  }
  for (t in c("ES-EX", "ES-VC")) expect_equal(a26[[t]]$escala_general_autonomica$estado, "confirmado")
  expect_equal(a26[["ES-AR"]]$escala_general_autonomica$estado, "confirmado")   # heredado
})
