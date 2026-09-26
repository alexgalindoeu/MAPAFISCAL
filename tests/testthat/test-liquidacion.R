# Casos de validación con cálculo verificado a mano paso a paso.
# (Ver docs/03_casos_validacion.md para el desarrollo de cada uno.)

caso_soltero <- function(territorio, dinerarias = 30000, ss = 1905, retenciones = 0, edad = 35) {
  nuevo_hogar("v", territorio, list(persona("d1", "declarante", edad,
    trabajo = list(dinerarias = dinerarias, cotizaciones_ss = ss),
    retenciones = retenciones)))
}

test_that("Caso A — soltero 30.000 € trabajo, Madrid (régimen común)", {
  liq <- liquidar(caso_soltero("ES-MD", retenciones = 3500))
  expect_equal(liq$base_liquidable_general, 26095)
  expect_equal(liq$cuota_integra_estatal, 2469.75)
  # mínimo autonómico de Madrid 5.956,65 € (art. 2 DL 1/2010): 2.647,09 − 506,32
  expect_equal(liq$cuota_integra_autonomica, 2140.78)
  expect_equal(liq$cuota_liquida_total, 4610.53)
  expect_equal(liq$cuota_diferencial, 1110.53)
  expect_equal(round(liq$tipo_medio_efectivo, 4), 0.1767)
})

test_that("Caso B — soltero 30.000 € trabajo, Bizkaia (foral PV)", {
  liq <- liquidar(caso_soltero("ES-PV-BI"))
  expect_equal(liq$base_liquidable_general, 25095)     # 30000 - 1905 SS - 3000 bonif. trabajo
  expect_equal(liq$cuota_integra_total, 6140.60)
  expect_equal(liq$minoracion_cuota, 1615)             # minoración de cuota Bizkaia 2025
  expect_equal(liq$cuota_liquida_total, 4525.60)       # 6.140,60 - 1.615
})

test_that("Caso C — soltero 30.000 € trabajo, Navarra (foral)", {
  liq <- liquidar(caso_soltero("ES-NC"))
  expect_equal(round(liq$cuota_integra_total, 2), 6529.23)
  # cuota íntegra 6.529,23 - mínimo personal 1.367,85 - deducción por trabajo 700
  expect_equal(liq$deducciones_autonomicas$detalle$trabajo, 700)
  expect_equal(liq$cuota_liquida_total, 4461.38)
})

test_that("Navarra: mínimo familiar por descendientes (art. 62.9.b) reduce la cuota", {
  sin <- nuevo_hogar("v","ES-NC", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=40000, cotizaciones_ss=2540))))
  con <- nuevo_hogar("v","ES-NC", list(persona("d1","declarante",40,
    trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    persona("h1","descendiente",6), persona("h2","descendiente",3)),
    tipo_unidad_familiar="monoparental")
  liqc <- liquidar(con, modo="individual")
  # 1º hijo 483 + 2º hijo 512 = 995
  expect_equal(liqc$deducciones_autonomicas$detalle$minimo_familiar, 995)
  expect_lt(liqc$cuota_liquida_total, liquidar(sin, modo="individual")$cuota_liquida_total)
})

test_that("Régimen común: elige la tributación de menor cuota", {
  h <- nuevo_hogar("v", "ES-CT", list(
    persona("d1","declarante",40, trabajo=list(dinerarias=40000, cotizaciones_ss=2540)),
    persona("d2","conyuge",40, trabajo=list(dinerarias=3000)),
    persona("h1","descendiente",5)
  ), tipo_unidad_familiar = "biparental")
  liq <- liquidar(h, modo = "auto")
  expect_true(liq$modo_tributacion_elegido %in% c("individual","conjunta"))
  expect_lte(liq$cuota_liquida_total,
             liquidar(h, modo = "individual")$cuota_liquida_total + 1e-6)
  expect_lte(liq$cuota_liquida_total,
             liquidar(h, modo = "conjunta")$cuota_liquida_total + 1e-6)
})

test_that("La exención de dividendos del art. 9.24 NF solo aplica en País Vasco", {
  h_pv <- nuevo_hogar("v","ES-PV-BI", list(persona("d1","declarante",40,
    capital_mobiliario = list(dividendos = 5000))))
  h_ct <- nuevo_hogar("v","ES-CT", list(persona("d1","declarante",40,
    capital_mobiliario = list(dividendos = 5000))))
  # PV: base del ahorro = 5000 - 1500 exentos = 3500 ; común: 5000
  expect_equal(liquidar(h_pv)$base_imponible_ahorro, 3500)
  expect_equal(liquidar(h_ct)$base_imponible_ahorro, 5000)
})

test_that("Previsión social: aportación individual limitada a 1.500 €", {
  base <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=45000, cotizaciones_ss=2857))))
  con_plan <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=45000, cotizaciones_ss=2857),
    prevision_social=list(aportacion_individual=5000))))
  # solo 1.500 € reducen la base -> la BLG baja exactamente 1.500
  expect_equal(liquidar(base)$base_liquidable_general - liquidar(con_plan)$base_liquidable_general, 1500)
})

test_that("Previsión social: contribución empresarial añade hasta 8.500 € más", {
  h <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=60000, cotizaciones_ss=3810),
    prevision_social=list(aportacion_individual=1500, contribucion_empresarial=8500))))
  h0 <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante",45,
    trabajo=list(dinerarias=60000, cotizaciones_ss=3810))))
  expect_equal(liquidar(h0)$base_liquidable_general - liquidar(h)$base_liquidable_general, 10000)
})

test_that("DT 9ª reduce la ganancia de un activo pre-1994", {
  con_dt9 <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante",70,
    ganancias = list(list(valor_transmision=50000, valor_adquisicion=10000,
      fecha_adquisicion="1990-06-01", fecha_transmision="2025-03-01",
      tipo_elemento="accion_cotizada", es_transmision=TRUE)))))
  sin_dt9 <- nuevo_hogar("v","ES-MD", list(persona("d1","declarante",70,
    ganancias = list(list(valor_transmision=50000, valor_adquisicion=10000,
      fecha_adquisicion="2015-06-01", fecha_transmision="2025-03-01",
      tipo_elemento="accion_cotizada", es_transmision=TRUE)))))
  expect_lt(liquidar(con_dt9)$base_imponible_ahorro, liquidar(sin_dt9)$base_imponible_ahorro)
  expect_equal(liquidar(sin_dt9)$base_imponible_ahorro, 40000)
})
