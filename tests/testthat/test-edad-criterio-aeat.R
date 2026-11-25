# Edad de 65 y 75 años: criterio de la AEAT (decisión del dueño, 25-11-2026). El Manual
# Práctico Renta 2025 (parte 1, cap. 14, «Mínimo del contribuyente») habla de
# «contribuyentes de edad igual o superior a 65 años o a 75 años»: el incremento se aplica a
# quien los ha cumplido a la fecha de devengo. El motor usa `edad >= 65` y `edad >= 75` en el
# mínimo del contribuyente y de ascendientes, y las deducciones autonómicas para «mayores de
# 65/75 años» usan edad_min 65/75. Ver docs/03, «Edad de 65 y 75 años: criterio de la AEAT».

test_that("Mínimo del contribuyente: +1.150 € con 65 años cumplidos y +1.400 € más con 75", {
  m <- function(edad) liquidar(nuevo_hogar("v","ES-MD", list(persona("d1","declarante",edad,
    trabajo=list(dinerarias=30000, cotizaciones_ss=1905)))), modo="individual")$minimo_personal_familiar$total
  expect_equal(m(64), 5550)
  expect_equal(m(65), 6700)          # 5.550 + 1.150
  expect_equal(m(74), 6700)
  expect_equal(m(75), 8100)          # 5.550 + 1.150 + 1.400
})

test_that("Mínimo por ascendientes: +1.400 € con 75 años cumplidos", {
  m <- function(edad) liquidar(nuevo_hogar("v","ES-MD", list(
    persona("d1","declarante",50, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
    persona("a1","ascendiente",edad, rentas_propias=0))), modo="individual")$minimo_personal_familiar$total
  expect_equal(m(64), 5550)          # sin mínimo por ascendiente (ni edad ni discapacidad)
  expect_equal(m(65), 6700)          # 5.550 + 1.150
  expect_equal(m(74), 6700)
  expect_equal(m(75), 8100)          # 5.550 + 1.150 + 1.400
})
