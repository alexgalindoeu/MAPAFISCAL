test_that("optimizar() identifica el traslado de residencia más barato", {
  h <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=50000, cotizaciones_ss=3175))))
  opt <- optimizar(h, palancas = list(plan_pensiones_pasos = 3000))
  ids <- vapply(opt$recomendaciones, function(r) r$id, character(1))
  traslados <- opt$recomendaciones[grepl("^traslado_", ids)]
  expect_gte(length(traslados), 1)
  expect_gt(traslados[[1]]$ahorro_anual, 0)
  expect_lt(traslados[[1]]$cuota_resultante, opt$cuota_actual)
})

test_that("optimizar() valora la aportación a plan de pensiones", {
  h <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=70000, cotizaciones_ss=4445))))
  opt <- optimizar(h, palancas = list(plan_pensiones_pasos = c(1500), incluir_traslado = FALSE))
  ids <- vapply(opt$recomendaciones, function(r) r$id, character(1))
  expect_true("plan_pensiones" %in% ids)
  pp <- opt$recomendaciones[[which(ids == "plan_pensiones")]]
  # 1.500 € a un marginal ~37-40 % -> ahorro ~555-600 €
  expect_gt(pp$ahorro_anual, 400)
  expect_lt(pp$ahorro_anual, 800)
})

test_that("optimizar() no propone nada absurdo para una renta muy baja", {
  h <- nuevo_hogar("v","ES-EX", list(persona("d1","declarante",30,
    trabajo=list(dinerarias=13000, cotizaciones_ss=825))))
  opt <- optimizar(h, palancas = list(incluir_traslado = FALSE))
  # con base tras art. 20 muy baja, aportar a pensiones no puede ahorrar más que la cuota actual
  pp <- Filter(function(r) grepl("plan_pensiones", r$id) && !is.na(r$ahorro_anual), opt$recomendaciones)
  expect_true(all(vapply(pp, function(r) r$ahorro_anual <= opt$cuota_actual + 0.01, logical(1))))
  expect_lte(opt$cuota_actual, 300)   # renta de 13.000 € apenas tributa
})
