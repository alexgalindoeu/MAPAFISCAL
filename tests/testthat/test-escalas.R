test_that("aplicar_escala reproduce la escala estatal general (art. 63)", {
  tr <- list(list(hasta=12450,tipo=0.095), list(hasta=20200,tipo=0.12),
             list(hasta=35200,tipo=0.15), list(hasta=60000,tipo=0.185),
             list(hasta=300000,tipo=0.225), list(hasta=Inf,tipo=0.245))
  expect_equal(aplicar_escala(12450, tr), 12450*0.095)
  expect_equal(aplicar_escala(20200, tr), 1182.75 + 7750*0.12)
  # punto de la tabla AEAT: base 20.200 -> cuota íntegra estatal acumulada 2.112,75
  expect_equal(round(aplicar_escala(20200, tr), 2), 2112.75)
  # base 35.200 -> 4.362,75
  expect_equal(round(aplicar_escala(35200, tr), 2), 4362.75)
  # base 60.000 -> 8.950,75
  expect_equal(round(aplicar_escala(60000, tr), 2), 8950.75)
})

test_that("aplicar_escala es monótona y 0 en base<=0", {
  tr <- list(list(hasta=1000,tipo=0.1), list(hasta=Inf,tipo=0.2))
  expect_equal(aplicar_escala(0, tr), 0)
  expect_equal(aplicar_escala(-5, tr), 0)
  expect_true(aplicar_escala(2000, tr) > aplicar_escala(1500, tr))
})

test_that("tipo_marginal_escala devuelve el tramo correcto", {
  tr <- list(list(hasta=1000,tipo=0.1), list(hasta=2000,tipo=0.2), list(hasta=Inf,tipo=0.3))
  expect_equal(tipo_marginal_escala(500, tr), 0.1)
  expect_equal(tipo_marginal_escala(1500, tr), 0.2)
  expect_equal(tipo_marginal_escala(5000, tr), 0.3)
})

test_that("las 21 escalas autonómicas/forales cargan y son crecientes en 'hasta'", {
  for (t in TERRITORIOS) {
    P <- cargar_parametros(t, 2025)
    esc <- if (P$meta$regimen == "comun") P$jurisdiccion$escala_general_autonomica
           else if (P$meta$regimen == "foral_pais_vasco") P$jurisdiccion$escala_general_foral$tramos
           else P$jurisdiccion$escala_general_foral$tramos
    lims <- vapply(esc, function(x) x$hasta, numeric(1))
    expect_true(all(diff(lims) > 0), info = t)
    expect_true(is.infinite(lims[length(lims)]), info = t)
  }
})
