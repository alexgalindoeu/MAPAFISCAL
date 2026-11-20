# Contrato de entrada: un importe como texto es un error en R, igual que en el motor JS
# (test/contrato_motor.test.mjs). No se debe calcular con él.
test_that("un importe como texto no se liquida", {
  P <- cargar_parametros("ES-MD", 2025)
  h <- nuevo_hogar("txt", "ES-MD", list(
    persona("d1", "declarante", edad = 40, trabajo = list(dinerarias = "30000", cotizaciones_ss = 0))
  ), ejercicio = 2025)
  expect_error(liquidar(h, P))
})
