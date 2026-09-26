# Navarra: deducciones por mínimo personal y familiar (art. 62.9 DFL 4/2008, redacción de la Ley
# Foral 22/2023, vigente en 2025). Desarrollo en docs/03, sección «Navarra: mínimos del art. 62.9».

nv <- function(bruto, ss = 0, edad = 40, hijos = list(), ...) {
  miembros <- c(list(persona("d1", "declarante", edad, trabajo = list(dinerarias = bruto, cotizaciones_ss = ss), ...)), hijos)
  nuevo_hogar("n", "ES-NC", miembros, tipo_unidad_familiar = if (length(hijos)) "monoparental" else "ninguna")
}
det <- function(h) liquidar(h)$deducciones_autonomicas$detalle

test_that("Mínimo personal: 1.084 € + 150 € si las rentas no superan 30.000 €", {
  expect_equal(det(nv(30000))$minimo_personal, 1084 + 150)
  expect_equal(det(nv(30001))$minimo_personal, 1084)
})

test_that("Mínimo personal por edad: 264 € desde los 65 años o 585 € desde los 75 (no se suman)", {
  expect_equal(det(nv(20000, edad = 70))$minimo_personal, 1084 + 150 + 264)
  expect_equal(det(nv(20000, edad = 80))$minimo_personal, 1084 + 150 + 585)
})

test_that("Descendientes: incremento del 40 % hasta 20.000 € de rentas, decreciente hasta 30.000 €", {
  hijo <- list(persona("h1", "descendiente", 5))
  # rentas 16.857 (18.000 − 1.143): 483 × 1,40
  expect_equal(det(nv(18000, ss = 1143, hijos = hijo))$minimo_familiar, 676.20)
  # rentas 25.000: 40 − 50 × 5.000 / 20.000 = 27,5 % -> 483 × 1,275 = 615,825
  expect_equal(det(nv(25000, hijos = hijo))$minimo_familiar, 615.825, tolerance = 0.006)
  # rentas 30.000: 15 %; por encima de 30.000, sin incremento
  expect_equal(det(nv(30000, hijos = hijo))$minimo_familiar, 483 * 1.15, tolerance = 0.006)
  expect_equal(det(nv(30001, hijos = hijo))$minimo_familiar, 483)
})

test_that("Descendientes: menores de 30 años, o con discapacidad a cualquier edad", {
  expect_equal(det(nv(40000, hijos = list(persona("h1", "descendiente", 29))))$minimo_familiar, 483)
  expect_equal(det(nv(40000, hijos = list(persona("h1", "descendiente", 30))))$minimo_familiar %||% 0, 0)
  expect_equal(det(nv(40000, hijos = list(persona("h1", "descendiente", 35, discapacidad = "33_64"))))$minimo_familiar,
               483 + 674)   # la discapacidad no lleva el incremento por rentas
})
