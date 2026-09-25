source("R/cargar.R"); irpfsim_cargar(".")

cat("\n== Test 1: soltero, 30.000 € trabajo, Madrid ==\n")
h1 <- nuevo_hogar("h1", "ES-MD", list(
  persona("d1", "declarante", edad = 35,
          trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905),
          retenciones = 3500)
))
print(liquidar(h1))

cat("\n== Test 2: mismo perfil, comparativa 22 territorios ==\n")
comp <- comparar_territorios(h1)
print(comp[, c("territorio","cuota_liquida_total","tipo_medio_efectivo")])

cat("\n== Test 3: pareja 2 hijos, 45.000 + 20.000, Bizkaia, con ahorro ==\n")
h3 <- nuevo_hogar("h3", "ES-PV-BI", list(
  persona("d1","declarante",40, trabajo=list(dinerarias=45000, cotizaciones_ss=2857),
          capital_mobiliario=list(dividendos=2000, intereses=500), retenciones=8000),
  persona("d2","conyuge",38, trabajo=list(dinerarias=20000, cotizaciones_ss=1270), retenciones=2000),
  persona("h1","descendiente",8), persona("h2","descendiente",4)
), tipo_unidad_familiar="biparental")
print(liquidar(h3))

cat("\n== Test 4: Navarra, 40.000 € ==\n")
h4 <- nuevo_hogar("h4","ES-NC", list(persona("d1","declarante",45,
  trabajo=list(dinerarias=40000, cotizaciones_ss=2540), retenciones=7000)))
print(liquidar(h4))

cat("\n== Test 5: DT 9ª — venta de acciones adquiridas en 1990 ==\n")
h5 <- nuevo_hogar("h5","ES-CT", list(persona("d1","declarante",70,
  trabajo=list(dinerarias=18000),
  ganancias=list(list(valor_transmision=50000, valor_adquisicion=10000,
                      fecha_adquisicion="1990-06-01", fecha_transmision="2025-03-01",
                      tipo_elemento="accion_cotizada", es_transmision=TRUE)),
  retenciones=1500)))
print(liquidar(h5))

cat("\n== Test 6: muestra + reforma (mínimo 5.550 -> 6.500; 3er tramo estatal 15 -> 17 %) ==\n")
m <- generar_muestra(n_por_territorio = 400, territorios = c("ES-MD","ES-CT","ES-AN","ES-PV-BI","ES-NC"))
rf <- reforma(
  parche_minimo("general", 6500),
  parche_tipo_tramo("estatal","escala_general_estatal", 3, 0.17)
)
sim <- simular(m, rf)
print(sim)
cat("\n-- Tabla por decil (baseline) --\n"); print(sim$impacto$por_decil_base)

cat("\n== Avisos de parámetros ==\n")
print(avisos_parametros())
cat("\nOK\n")
