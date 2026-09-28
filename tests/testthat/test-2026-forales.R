# Ejercicio 2026, territorios forales: País Vasco (NF 6/2025 Gipuzkoa, NF 7/2025 Bizkaia,
# NF 21/2025 Araba, escala del ahorro de la NF 1/2025) y Navarra (LF 17/2025). Desarrollo a
# mano en docs/03_casos_validacion.md, sección «Ejercicio 2026: territorios forales».

hogar26 <- function(t, miembros, ej = 2026) nuevo_hogar("v", t, miembros, ejercicio = ej)
sal26 <- function(b, ss, edad = 40, ...)
  persona("d1", "declarante", edad, trabajo = list(dinerarias = b, cotizaciones_ss = ss), ...)
familia26 <- function(t, ej = 2026)
  hogar26(t, list(sal26(40000, 2540, 45), persona("h1", "descendiente", 8), persona("h2", "descendiente", 4)), ej)

test_that("PV 2026: escala del ahorro de la NF 1/2025 (segundo tramo hasta 15.000 €)", {
  j <- cargar_parametros("ES-PV-SS", 2026)$jurisdiccion
  expect_equal(j$escala_ahorro_foral$tramos[[2]], list(hasta = 15000, tipo = 0.20))
  # cuotas acumuladas del art. 76.1: 1.425 / 2.925 / 6.225 / 11.025 / ... / 77.025
  expect_equal(vapply(c(7500, 15000, 30000, 50000, 300000), aplicar_escala, 0, j$escala_ahorro_foral$tramos),
               c(1425, 2925, 6225, 11025, 77025))
  l <- liquidar(hogar26("ES-PV-SS", list(persona("d1", "declarante", 40, capital_mobiliario = list(intereses = 15400)))))
  expect_equal(l$cuota_integra_total, 3013)          # 2.925 + 400 × 22 %
  expect_equal(l$cuota_liquida_total, 3013 - 1615)
})

test_that("Gipuzkoa 2026: tarifa deflactada y +2 % en minoración y descendientes", {
  l26 <- liquidar(familia26("ES-PV-SS")); l25 <- liquidar(familia26("ES-PV-SS", 2025))
  # 37.460 − 3.000 de bonificación = 34.460; 4.158,40 + 16.380 × 28 % = 8.744,80
  expect_equal(l26$cuota_integra_total, 8744.80)
  expect_equal(l26$minoracion_cuota, 1615)
  expect_equal(l26$deducciones_autonomicas$detalle$descendientes, 682 + 844 + 394)
  expect_equal(l26$cuota_liquida_total, 5209.80)
  expect_equal(l25$cuota_liquida_total, 5298.80)
})

test_that("Araba 2026: la NF 21/2025 no actualiza descendientes (siguen los de 2025)", {
  l <- liquidar(familia26("ES-PV-VI"))
  expect_equal(l$minoracion_cuota, 1615)
  expect_equal(l$deducciones_autonomicas$detalle$descendientes, 668 + 827 + 386)
  expect_equal(l$cuota_liquida_total, 8744.80 - 1615 - 1881)
})

test_that("Bizkaia 2026: gran dependencia 1.935 € (Gipuzkoa, 2.040 €)", {
  gd <- function(t) liquidar(hogar26(t, list(persona("d1", "declarante", 50,
          trabajo = list(dinerarias = 40000, cotizaciones_ss = 2540), discapacidad = "65_mas", ayuda_terceros = TRUE))))
  expect_equal(gd("ES-PV-BI")$deducciones_autonomicas$detalle$discapacidad, 1935)
  expect_equal(gd("ES-PV-BI")$cuota_liquida_total, 8744.80 - 1615 - 1935)
  expect_equal(gd("ES-PV-SS")$deducciones_autonomicas$detalle$discapacidad, 2040)
  j <- cargar_parametros("ES-PV-BI", 2026)$jurisdiccion
  expect_equal(j$deduccion_discapacidad$grado_33_64, 906)              # el resto, del bloque común
  expect_equal(j$deduccion_anualidades_alimentos_hijos$limites[["1"]], 204.60)   # 30 % de 682
})

test_that("Navarra 2026: mínimo personal por tramos y nueva deducción por trabajo", {
  n <- cargar_parametros("ES-NC", 2026)$jurisdiccion$minimo_personal_deduccion
  expect_null(n$incremento_rentas_bajas)
  expect_equal(vapply(c(10000, 17500, 22476, 30000, 30904, 32000, 40000),
                      function(r) red2(importe_por_tramos(r, n$incremento_rentas)), 0),
               c(1280, 1280, 830.17, 150, 82.20, 0, 0))
  # 15.000 € de salario: RNT 14.047; cuota 2.809,63 − (1.084 + 1.280) − (1.400 − 0,14 × 1.547) < 0
  l <- liquidar(hogar26("ES-NC", list(sal26(15000, 953))))
  expect_equal(l$deducciones_autonomicas$detalle$trabajo, 1183.42)
  expect_equal(l$deducciones_autonomicas$detalle$minimo_personal, 2364)
  expect_equal(l$cuota_liquida_total, 0)
  expect_equal(liquidar(hogar26("ES-NC", list(sal26(15000, 953)), 2025))$cuota_liquida_total, 530.33)
  # 24.000 €: RNT 22.476; mínimo 1.084 + 830,17; trabajo 700
  expect_equal(liquidar(hogar26("ES-NC", list(sal26(24000, 1524))))$cuota_liquida_total, 4955.91 - 1914.17 - 700)
  # 33.000 €: RNT 30.904; incremento 150 − 0,075 × 904 = 82,20
  expect_equal(liquidar(hogar26("ES-NC", list(sal26(33000, 2096))))$deducciones_autonomicas$detalle$minimo_personal, 1166.20)
})

test_that("Navarra 2026: deducción por pensión de jubilación hasta 15.400 €", {
  p <- function(ej) liquidar(hogar26("ES-NC", list(persona("d1", "declarante", 70,
         trabajo = list(dinerarias = 14000, cotizaciones_ss = 0, pension_jubilacion = TRUE))), ej))
  expect_equal(p(2026)$cuota_diferencial, -1400)     # 15.400 − 14.000, cuota líquida 0
  expect_equal(p(2025)$cuota_diferencial, 249.88 - 490)
  expect_equal(cargar_parametros("ES-NC", 2026)$jurisdiccion$escala_general_foral,
               cargar_parametros("ES-NC", 2025)$jurisdiccion$escala_general_foral)   # sin cambios
})
