# Genera casos.json: hogares en forma JS + su liquidación de referencia (motor R).
# Se compara contra el motor JS en tools/validar_js.html.
source("R/cargar.R"); irpfsim_cargar(".")

# Cada caso: función que devuelve list(js = <hogar en forma JS>, hogar = <irpfsim_hogar>)
casos <- list()
add <- function(id, territorio, uf, fnum, miembros_r, miembros_js, municipio = NULL, despoblada = FALSE) {
  h <- nuevo_hogar(id, territorio, miembros_r, 2025, tipo_unidad_familiar = uf, familia_numerosa = fnum,
                   municipio_habitantes = municipio, zona_despoblada = despoblada)
  js <- list(territorio = territorio, ejercicio = 2025, tipoUnidadFamiliar = uf,
             familiaNumerosa = fnum, miembros = miembros_js)
  if (!is.null(municipio)) js$municipioHabitantes <- municipio
  if (despoblada) js$zonaDespoblada <- TRUE
  casos[[id]] <<- list(js = js, liq = liquidar(h))
}

# 1. soltero trabajo, varios territorios
for (t in c("ES-MD","ES-CT","ES-AN","ES-EX","ES-VC","ES-PV-BI","ES-PV-SS","ES-NC")) {
  add(paste0("soltero30_", t), t, "ninguna", "no",
      list(persona("d1","declarante",35, trabajo=list(dinerarias=30000, cotizaciones_ss=1905), retenciones=3500)),
      list(list(id="d1", rol="declarante", edad=35, trabajo=list(dinerarias=30000, cotizacionesSs=1905), retenciones=3500)))
}
# 2. pareja 2 hijos, un perceptor, común y foral
for (t in c("ES-MD","ES-PV-BI","ES-NC")) {
  add(paste0("pareja2h_", t), t, "biparental", "no",
      list(persona("d1","declarante",40, trabajo=list(dinerarias=45000, cotizaciones_ss=2857),
                   capital_mobiliario=list(dividendos=2000, intereses=500), retenciones=8000),
           persona("d2","conyuge",38, trabajo=list(dinerarias=20000, cotizaciones_ss=1270), retenciones=2000),
           persona("h1","descendiente",8), persona("h2","descendiente",4)),
      list(list(id="d1",rol="declarante",edad=40, trabajo=list(dinerarias=45000,cotizacionesSs=2857),
                capitalMobiliario=list(dividendos=2000, intereses=500), retenciones=8000),
           list(id="d2",rol="conyuge",edad=38, trabajo=list(dinerarias=20000,cotizacionesSs=1270), retenciones=2000),
           list(id="h1",rol="descendiente",edad=8), list(id="h2",rol="descendiente",edad=4)))
}
# 3. DT9a
add("dt9_ct", "ES-CT", "ninguna", "no",
    list(persona("d1","declarante",70, trabajo=list(dinerarias=18000),
      ganancias=list(list(valor_transmision=50000, valor_adquisicion=10000, fecha_adquisicion="1990-06-01",
                          fecha_transmision="2025-03-01", tipo_elemento="accion_cotizada", es_transmision=TRUE)),
      retenciones=1500)),
    list(list(id="d1",rol="declarante",edad=70, trabajo=list(dinerarias=18000),
      ganancias=list(list(valorTransmision=50000, valorAdquisicion=10000, fechaAdquisicion="1990-06-01",
                          fechaTransmision="2025-03-01", tipoElemento="accion_cotizada", esTransmision=TRUE)),
      retenciones=1500)))
# 4. previsión social
add("prevsoc_md", "ES-MD", "ninguna", "no",
    list(persona("d1","declarante",45, trabajo=list(dinerarias=60000, cotizaciones_ss=3810),
      prevision_social=list(aportacion_individual=1500, contribucion_empresarial=8500))),
    list(list(id="d1",rol="declarante",edad=45, trabajo=list(dinerarias=60000,cotizacionesSs=3810),
      previsionSocial=list(aportacionIndividual=1500, contribucionEmpresarial=8500))))
# 5. Madrid alquiler joven + Andalucía monoparental+nacimiento
add("md_alquiler", "ES-MD", "ninguna", "no",
    list(persona("d1","declarante",30, trabajo=list(dinerarias=27000, cotizaciones_ss=1714), alquiler_vivienda_pagos=9000)),
    list(list(id="d1",rol="declarante",edad=30, trabajo=list(dinerarias=27000,cotizacionesSs=1714), alquilerViviendaPagos=9000)))
add("an_mono", "ES-AN", "monoparental", "no",
    list(persona("d1","declarante",32, trabajo=list(dinerarias=24000, cotizaciones_ss=1524)),
         persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)),
    list(list(id="d1",rol="declarante",edad=32, trabajo=list(dinerarias=24000,cotizacionesSs=1524)),
         list(id="h1",rol="descendiente",edad=0, nacidoEnEjercicio=TRUE)))
# 5b. C. Valenciana 2+ hijos (deducción % cuota autonómica + material escolar)
add("vc_2hijos", "ES-VC", "monoparental", "no",
    list(persona("d1","declarante",40, trabajo=list(dinerarias=26000, cotizaciones_ss=1651)),
         persona("h1","descendiente",6), persona("h2","descendiente",9)),
    list(list(id="d1",rol="declarante",edad=40, trabajo=list(dinerarias=26000,cotizacionesSs=1651)),
         list(id="h1",rol="descendiente",edad=6), list(id="h2",rol="descendiente",edad=9)))

# 5c. Cataluña — deducciones (rehabilitación + donativos I+D+i con tope de cuota + ángel inversor)
add("ct_deducciones", "ES-CT", "ninguna", "no",
    list(persona("d1","declarante",45, trabajo=list(dinerarias=50000, cotizaciones_ss=3175),
                 rehabilitacion_vivienda_pagos=6000, donativos_investigacion=800,
                 inversion_angel_inversor=10000)),
    list(list(id="d1",rol="declarante",edad=45, trabajo=list(dinerarias=50000,cotizacionesSs=3175),
              rehabilitacionViviendaPagos=6000, donativosInvestigacion=800,
              inversionAngelInversor=10000)))

# 5d. Galicia — nacimiento por orden (renta baja) + familias dos hijos + libros
add("ga_familia", "ES-GA", "monoparental", "no",
    list(persona("d1","declarante",34, trabajo=list(dinerarias=24000, cotizaciones_ss=1524)),
         persona("h1","descendiente",0, nacido_en_ejercicio=TRUE),
         persona("h2","descendiente",8, gastos_libros_texto=200)),
    list(list(id="d1",rol="declarante",edad=34, trabajo=list(dinerarias=24000,cotizacionesSs=1524)),
         list(id="h1",rol="descendiente",edad=0, nacidoEnEjercicio=TRUE),
         list(id="h2",rol="descendiente",edad=8, gastosLibrosTexto=200)))

# 5e. Castilla y León — discapacidad + cuidado hijos
add("cyl_disc", "ES-CL", "ninguna", "no",
    list({p <- persona("d1","declarante",70, discapacidad="65_mas",
                       trabajo=list(dinerarias=20000, cotizaciones_ss=1270)); p}),
    list(list(id="d1",rol="declarante",edad=70, discapacidad="65_mas",
              trabajo=list(dinerarias=20000, cotizacionesSs=1270))))

# 5f. Canarias — familia monoparental + guardería + nacimiento prorrateado
add("cn_familia", "ES-CN", "biparental", "no",
    list(persona("d1","declarante",34, trabajo=list(dinerarias=25000, cotizaciones_ss=1587)),
         persona("d2","conyuge",33, trabajo=list(dinerarias=20000, cotizaciones_ss=1270)),
         {h <- persona("h1","descendiente",1); h$gastos_guarderia <- 4000; h},
         persona("h2","descendiente",0, nacido_en_ejercicio=TRUE)),
    list(list(id="d1",rol="declarante",edad=34, trabajo=list(dinerarias=25000,cotizacionesSs=1587)),
         list(id="d2",rol="conyuge",edad=33, trabajo=list(dinerarias=20000,cotizacionesSs=1270)),
         list(id="h1",rol="descendiente",edad=1, gastosGuarderia=4000),
         list(id="h2",rol="descendiente",edad=0, nacidoEnEjercicio=TRUE)))

# 5g. Región de Murcia — guardería + material escolar + conciliación (cuotas SS empleada hogar)
add("mc_familia", "ES-MC", "monoparental", "no",
    list({d <- persona("d1","declarante",38, trabajo=list(dinerarias=28000, cotizaciones_ss=1778));
          d$cuotas_ss_empleada_hogar <- 3000; d},
         {h <- persona("h1","descendiente",1); h$gastos_guarderia <- 6000; h},
         persona("h2","descendiente",8)),
    list(list(id="d1",rol="declarante",edad=38, trabajo=list(dinerarias=28000,cotizacionesSs=1778),
              cuotasSsEmpleadaHogar=3000),
         list(id="h1",rol="descendiente",edad=1, gastosGuarderia=6000),
         list(id="h2",rol="descendiente",edad=8)))

# 5h. Aragón — mayores de 70 + cuidado de personas dependientes (ascendiente >= 75)
add("ar_dependientes", "ES-AR", "ninguna", "no",
    list(persona("d1","declarante",72, trabajo=list(dinerarias=19000, cotizaciones_ss=0)),
         persona("a1","ascendiente",82)),
    list(list(id="d1",rol="declarante",edad=72, trabajo=list(dinerarias=19000, cotizacionesSs=0)),
         list(id="a1",rol="ascendiente",edad=82)))

# 5i. Extremadura — material escolar + cuidado de hijos + familiar con discapacidad
add("ex_familia", "ES-EX", "monoparental", "no",
    list({d <- persona("d1","declarante",40, trabajo=list(dinerarias=24000, cotizaciones_ss=1524));
          d$gastos_cuidado_hijos <- 5000; d},
         persona("h1","descendiente",8),
         persona("h2","descendiente",12, discapacidad="65_mas")),
    list(list(id="d1",rol="declarante",edad=40, trabajo=list(dinerarias=24000,cotizacionesSs=1524),
              gastosCuidadoHijos=5000),
         list(id="h1",rol="descendiente",edad=8),
         list(id="h2",rol="descendiente",edad=12, discapacidad="65_mas")))

# 5j. Illes Balears — nacimiento + libros de texto + conciliación < 6 años
add("ib_familia", "ES-IB", "monoparental", "no",
    list({d <- persona("d1","declarante",34, trabajo=list(dinerarias=30000, cotizaciones_ss=1905));
          d$gastos_conciliacion_menores <- 2000; d},
         {h <- persona("h1","descendiente",4); h$gastos_libros_texto <- 300; h},
         persona("h2","descendiente",0, nacido_en_ejercicio=TRUE)),
    list(list(id="d1",rol="declarante",edad=34, trabajo=list(dinerarias=30000,cotizacionesSs=1905),
              gastosConciliacionMenores=2000),
         list(id="h1",rol="descendiente",edad=4, gastosLibrosTexto=300),
         list(id="h2",rol="descendiente",edad=0, nacidoEnEjercicio=TRUE)))

# 5k. Asturias — cuidado de descendientes <= 25 + gastos 0-3 + monoparental
add("as_familia", "ES-AS", "monoparental", "no",
    list({d <- persona("d1","declarante",38, trabajo=list(dinerarias=24000, cotizaciones_ss=1524)); d},
         {h <- persona("h1","descendiente",1); h$gastos_guarderia <- 4000; h},
         persona("h2","descendiente",15)),
    list(list(id="d1",rol="declarante",edad=38, trabajo=list(dinerarias=24000,cotizacionesSs=1524)),
         list(id="h1",rol="descendiente",edad=1, gastosGuarderia=4000),
         list(id="h2",rol="descendiente",edad=15)))

# 5l. Cantabria — enfermedad + guardería + monoparental (límites sobre base − MPF)
add("cb_familia", "ES-CB", "monoparental", "no",
    list({d <- persona("d1","declarante",40, trabajo=list(dinerarias=26000, cotizaciones_ss=1651));
          d$gastos_enfermedad <- 8000; d},
         {h <- persona("h1","descendiente",1); h$gastos_guarderia <- 3000; h}),
    list(list(id="d1",rol="declarante",edad=40, trabajo=list(dinerarias=26000,cotizacionesSs=1651),
              gastosEnfermedad=8000),
         list(id="h1",rol="descendiente",edad=1, gastosGuarderia=3000)))

# 5m. La Rioja — internet + luz/gas jóvenes emancipados + deporte
add("ri_joven", "ES-RI", "ninguna", "no",
    list({d <- persona("d1","declarante",30, trabajo=list(dinerarias=18000, cotizaciones_ss=1143));
          d$gastos_internet <- 600; d$gastos_luz_gas <- 2000; d$gastos_deporte <- 1500; d}),
    list(list(id="d1",rol="declarante",edad=30, trabajo=list(dinerarias=18000, cotizacionesSs=1143),
              gastosInternet=600, gastosLuzGas=2000, gastosDeporte=1500)))

# 5m1. Castilla-La Mancha — contribuyente > 75 + cuidado de ascendiente > 75 + guardería
add("cm_mayores", "ES-CM", "ninguna", "no",
    list({d <- persona("d1","declarante",78, trabajo=list(dinerarias=17000, cotizaciones_ss=0)); d},
         persona("a1","ascendiente",90, rentas_propias=0)),
    list(list(id="d1",rol="declarante",edad=78, trabajo=list(dinerarias=17000, cotizacionesSs=0)),
         list(id="a1",rol="ascendiente",edad=90, rentasPropias=0)))

# 5m2. Comunitat Valenciana — monoparental + guardería < 3 + ascendiente > 75 + abono cultural
add("vc_familia2", "ES-VC", "monoparental", "no",
    list({d <- persona("d1","declarante",44, trabajo=list(dinerarias=27000, cotizaciones_ss=1714));
          d$gastos_abonos_culturales <- 400; d},
         {h <- persona("h1","descendiente",1); h$gastos_guarderia <- 3000; h},
         persona("a1","ascendiente",80, rentas_propias=0)),
    list(list(id="d1",rol="declarante",edad=44, trabajo=list(dinerarias=27000,cotizacionesSs=1714),
              gastosAbonosCulturales=400),
         list(id="h1",rol="descendiente",edad=1, gastosGuarderia=3000),
         list(id="a1",rol="ascendiente",edad=80, rentasPropias=0)))

# 5n0. Andalucía — monoparental + ascendiente > 75 + idiomas/informática + deporte
add("an_ascendiente", "ES-AN", "monoparental", "no",
    list({d <- persona("d1","declarante",45, trabajo=list(dinerarias=32000, cotizaciones_ss=2032));
          d$gastos_deporte <- 900; d},
         {h <- persona("h1","descendiente",10); h$gastos_idiomas_informatica <- 1500; h},
         persona("a1","ascendiente",80, rentas_propias=0)),
    list(list(id="d1",rol="declarante",edad=45, trabajo=list(dinerarias=32000,cotizacionesSs=2032),
              gastosDeporte=900),
         list(id="h1",rol="descendiente",edad=10, gastosIdiomasInformatica=1500),
         list(id="a1",rol="ascendiente",edad=80, rentasPropias=0)))

# 5n. Madrid — familia numerosa especial (% cuota autonómica) + cuidado de ascendiente
add("md_fn_asc", "ES-MD", "biparental", "especial",
    list(persona("d1","declarante",44, trabajo=list(dinerarias=48000, cotizaciones_ss=3048)),
         persona("d2","conyuge",42, trabajo=list(dinerarias=20000, cotizaciones_ss=1270)),
         persona("h1","descendiente",6), persona("h2","descendiente",9),
         persona("h3","descendiente",12), persona("h4","descendiente",15),
         persona("h5","descendiente",17),
         persona("a1","ascendiente",83, rentas_propias=0)),
    list(list(id="d1",rol="declarante",edad=44, trabajo=list(dinerarias=48000,cotizacionesSs=3048)),
         list(id="d2",rol="conyuge",edad=42, trabajo=list(dinerarias=20000,cotizacionesSs=1270)),
         list(id="h1",rol="descendiente",edad=6), list(id="h2",rol="descendiente",edad=9),
         list(id="h3",rol="descendiente",edad=12), list(id="h4",rol="descendiente",edad=15),
         list(id="h5",rol="descendiente",edad=17),
         list(id="a1",rol="ascendiente",edad=83, rentasPropias=0)))

# 5k. C. Valenciana — taper 27.000-30.000, variantes de alquiler (grupo), desempleo, nacimiento 2025
add("vc_taper", "ES-VC", "monoparental", "no",
    list(persona("d1","declarante",30, trabajo=list(dinerarias=32000, cotizaciones_ss=1500),
                 alquiler_vivienda_pagos=5000, desempleado=TRUE),
         persona("h1","descendiente",2), persona("h2","descendiente",9)),
    list(list(id="d1",rol="declarante",edad=30, trabajo=list(dinerarias=32000,cotizacionesSs=1500),
              alquilerViviendaPagos=5000, desempleado=TRUE),
         list(id="h1",rol="descendiente",edad=2), list(id="h2",rol="descendiente",edad=9)))
add("vc_guarderia_2prog", "ES-VC", "biparental", "no",
    list(persona("d1","declarante",34, trabajo=list(dinerarias=24000, cotizaciones_ss=1524)),
         persona("d2","conyuge",33, trabajo=list(dinerarias=22000, cotizaciones_ss=1397)),
         {h <- persona("h1","descendiente",1); h$gastos_guarderia <- 3000; h}),
    list(list(id="d1",rol="declarante",edad=34, trabajo=list(dinerarias=24000,cotizacionesSs=1524)),
         list(id="d2",rol="conyuge",edad=33, trabajo=list(dinerarias=22000,cotizacionesSs=1397)),
         list(id="h1",rol="descendiente",edad=1, gastosGuarderia=3000)))

# 5l. Parejas en individual: gastos y requisitos personales por ámbito, familiares repartidas
add("md_pareja_indiv", "ES-MD", "biparental", "general",
    list(persona("d1","declarante",30, trabajo=list(dinerarias=30000, cotizaciones_ss=1905), alquiler_vivienda_pagos=9000),
         persona("d2","conyuge",45, trabajo=list(dinerarias=28000, cotizaciones_ss=1778)),
         persona("h1","descendiente",1), persona("h2","descendiente",6), persona("h3","descendiente",9)),
    list(list(id="d1",rol="declarante",edad=30, trabajo=list(dinerarias=30000,cotizacionesSs=1905), alquilerViviendaPagos=9000),
         list(id="d2",rol="conyuge",edad=45, trabajo=list(dinerarias=28000,cotizacionesSs=1778)),
         list(id="h1",rol="descendiente",edad=1), list(id="h2",rol="descendiente",edad=6),
         list(id="h3",rol="descendiente",edad=9)))
add("pv_pareja_indiv", "ES-PV-SS", "biparental", "no",
    list(persona("d1","declarante",30, discapacidad="33_64", trabajo=list(dinerarias=30000, cotizaciones_ss=1905),
                 alquiler_vivienda_pagos=6000),
         persona("d2","conyuge",67, trabajo=list(dinerarias=28000, cotizaciones_ss=0)),
         persona("h1","descendiente",4)),
    list(list(id="d1",rol="declarante",edad=30, discapacidad="33_64", trabajo=list(dinerarias=30000,cotizacionesSs=1905),
              alquilerViviendaPagos=6000),
         list(id="d2",rol="conyuge",edad=67, trabajo=list(dinerarias=28000,cotizacionesSs=0)),
         list(id="h1",rol="descendiente",edad=4)))

# 5m. Navarra — emancipación, alquiler general, pensión de jubilación, pareja con edades distintas
add("nc_emancipacion", "ES-NC", "ninguna", "no",
    list(persona("d1","declarante",28, trabajo=list(dinerarias=20000, cotizaciones_ss=1270), alquiler_vivienda_pagos=7200)),
    list(list(id="d1",rol="declarante",edad=28, trabajo=list(dinerarias=20000,cotizacionesSs=1270), alquilerViviendaPagos=7200)))
add("nc_alquiler", "ES-NC", "ninguna", "no",
    list(persona("d1","declarante",40, trabajo=list(dinerarias=25000, cotizaciones_ss=1587), alquiler_vivienda_pagos=6000)),
    list(list(id="d1",rol="declarante",edad=40, trabajo=list(dinerarias=25000,cotizacionesSs=1587), alquilerViviendaPagos=6000)))
add("nc_pension", "ES-NC", "ninguna", "no",
    list(persona("d1","declarante",70, trabajo=list(dinerarias=13000, cotizaciones_ss=0, pension_jubilacion=TRUE),
                 capital_mobiliario=list(intereses=8000))),
    list(list(id="d1",rol="declarante",edad=70, trabajo=list(dinerarias=13000,cotizacionesSs=0, pensionJubilacion=TRUE),
              capitalMobiliario=list(intereses=8000))))
add("nc_pareja_edades", "ES-NC", "biparental", "no",
    list(persona("d1","declarante",40, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
         persona("d2","conyuge",70, trabajo=list(dinerarias=30000, cotizaciones_ss=1905))),
    list(list(id="d1",rol="declarante",edad=40, trabajo=list(dinerarias=30000,cotizacionesSs=1905)),
         list(id="d2",rol="conyuge",edad=70, trabajo=list(dinerarias=30000,cotizacionesSs=1905))))

# 5n. Deducciones condicionadas al municipio de residencia
add("cl_rural", "ES-CL", "monoparental", "no",
    list(persona("d1","declarante",33, trabajo=list(dinerarias=24000, cotizaciones_ss=1524)),
         persona("h1","descendiente",0, nacido_en_ejercicio=TRUE)),
    list(list(id="d1",rol="declarante",edad=33, trabajo=list(dinerarias=24000,cotizacionesSs=1524)),
         list(id="h1",rol="descendiente",edad=0, nacidoEnEjercicio=TRUE)), municipio = 1800)
add("cm_rural", "ES-CM", "ninguna", "no",
    list(persona("d1","declarante",50, trabajo=list(dinerarias=30000, cotizaciones_ss=1905))),
    list(list(id="d1",rol="declarante",edad=50, trabajo=list(dinerarias=30000,cotizacionesSs=1905))),
    municipio = 1200, despoblada = TRUE)
add("vc_despoblamiento", "ES-VC", "biparental", "no",
    list(persona("d1","declarante",40, trabajo=list(dinerarias=26000, cotizaciones_ss=1651)),
         persona("d2","conyuge",38, trabajo=list(dinerarias=24000, cotizaciones_ss=1524)),
         persona("h1","descendiente",6), persona("h2","descendiente",9)),
    list(list(id="d1",rol="declarante",edad=40, trabajo=list(dinerarias=26000,cotizacionesSs=1651)),
         list(id="d2",rol="conyuge",edad=38, trabajo=list(dinerarias=24000,cotizacionesSs=1524)),
         list(id="h1",rol="descendiente",edad=6), list(id="h2",rol="descendiente",edad=9)),
    municipio = 900, despoblada = TRUE)
add("ga_rural", "ES-GA", "monoparental", "no",
    list(persona("d1","declarante",34, trabajo=list(dinerarias=22000, cotizaciones_ss=1397)),
         persona("h1","descendiente",1), persona("h2","descendiente",5)),
    list(list(id="d1",rol="declarante",edad=34, trabajo=list(dinerarias=22000,cotizacionesSs=1397)),
         list(id="h1",rol="descendiente",edad=1), list(id="h2",rol="descendiente",edad=5)), municipio = 3500)
add("cb_rural", "ES-CB", "ninguna", "no",
    list(persona("d1","declarante",32, trabajo=list(dinerarias=28000, cotizaciones_ss=1778), alquiler_vivienda_pagos=6000)),
    list(list(id="d1",rol="declarante",edad=32, trabajo=list(dinerarias=28000,cotizacionesSs=1778), alquilerViviendaPagos=6000)),
    municipio = 2500, despoblada = TRUE)

# 6. rentista puro ahorro
add("rentista_ib", "ES-IB", "ninguna", "no",
    list(persona("d1","declarante",55, capital_mobiliario=list(intereses=50000))),
    list(list(id="d1",rol="declarante",edad=55, capitalMobiliario=list(intereses=50000))))
# 7. jubilado
add("jubilado_ga", "ES-GA", "ninguna", "no",
    list(persona("d1","declarante",70, trabajo=list(dinerarias=25000, cotizaciones_ss=0))),
    list(list(id="d1",rol="declarante",edad=70, trabajo=list(dinerarias=25000, cotizacionesSs=0))))

# 8. reducción del art. 20 y deducción por obtención de rendimientos del trabajo (DA 61.ª)
tr_bajo <- function(id, terr, bruto, ss, edad = 40, pension = FALSE, intereses = 0) add(id, terr, "ninguna", "no",
    list(persona("d1","declarante",edad, trabajo=list(dinerarias=bruto, cotizaciones_ss=ss, pension_jubilacion=pension),
                 capital_mobiliario = if (intereses > 0) list(intereses=intereses) else NULL)),
    list(list(id="d1",rol="declarante",edad=edad, trabajo=list(dinerarias=bruto, cotizacionesSs=ss, pensionJubilacion=pension),
              capitalMobiliario = if (intereses > 0) list(intereses=intereses) else NULL)))
tr_bajo("smi_cm", "ES-CM", 16576, 1074.12)
tr_bajo("da61_tramo_cm", "ES-CM", 17500, 1134)
tr_bajo("da61_pension_cm", "ES-CM", 17000, 0, edad = 70, pension = TRUE)
tr_bajo("da61_ahorro_cm", "ES-CM", 16576, 1074.12, intereses = 2000)
tr_bajo("da61_aeat_md", "ES-MD", 16500, 1200)
add("da61_pareja_vc", "ES-VC", "biparental", "no",     # conjunta elegida, con DA 61.ª
    list(persona("d1","declarante",36, trabajo=list(dinerarias=18200, cotizaciones_ss=1179.36)),
         persona("d2","conyuge",35), persona("h1","descendiente",4)),
    list(list(id="d1",rol="declarante",edad=36, trabajo=list(dinerarias=18200,cotizacionesSs=1179.36)),
         list(id="d2",rol="conyuge",edad=35), list(id="h1",rol="descendiente",edad=4)))

# 9. base del ahorro con el mínimo (art. 66, issue #3) y ejemplo práctico de la AEAT (Aragón)
add("ahorro_minimo_cm", "ES-CM", "ninguna", "no",
    list(persona("d1","declarante",40, capital_mobiliario=list(intereses=10000))),
    list(list(id="d1",rol="declarante",edad=40, capitalMobiliario=list(intereses=10000))))
local({
  h <- nuevo_hogar("aeat_ejemplo_ar", "ES-AR", list(persona("d1","declarante",40, capital_mobiliario=list(intereses=2800))))
  h$miembros[[1]]$ganancias_perdidas_no_transmision <- 23900
  casos[["aeat_ejemplo_ar"]] <<- list(
    js = list(territorio = "ES-AR", ejercicio = 2025, tipoUnidadFamiliar = "ninguna", familiaNumerosa = "no",
              miembros = list(list(id="d1", rol="declarante", edad=40, capitalMobiliario=list(intereses=2800),
                                   gananciasPerdidasNoTransmision=23900))),
    liq = liquidar(h))
})

# 10. mínimos autonómicos (issue #18)
add("minaut_ib_70", "ES-IB", "ninguna", "no",
    list(persona("d1","declarante",70, trabajo=list(dinerarias=24000, cotizaciones_ss=0))),
    list(list(id="d1",rol="declarante",edad=70, trabajo=list(dinerarias=24000,cotizacionesSs=0))))
add("minaut_ri_hijo_disc", "ES-RI", "monoparental", "no",
    list(persona("d1","declarante",40, trabajo=list(dinerarias=30000, cotizaciones_ss=1905)),
         persona("h1","descendiente",10, discapacidad="65_mas")),
    list(list(id="d1",rol="declarante",edad=40, trabajo=list(dinerarias=30000,cotizacionesSs=1905)),
         list(id="h1",rol="descendiente",edad=10, discapacidad="65_mas")))
add("minaut_md_ahorro", "ES-MD", "ninguna", "no",
    list(persona("d1","declarante",40, capital_mobiliario=list(intereses=10000))),
    list(list(id="d1",rol="declarante",edad=40, capitalMobiliario=list(intereses=10000))))
add("minaut_an_pareja", "ES-AN", "biparental", "no",
    list(persona("d1","declarante",68, trabajo=list(dinerarias=28000, cotizaciones_ss=0)),
         persona("d2","conyuge",77), persona("a1","ascendiente",90)),
    list(list(id="d1",rol="declarante",edad=68, trabajo=list(dinerarias=28000,cotizacionesSs=0)),
         list(id="d2",rol="conyuge",edad=77), list(id="a1",rol="ascendiente",edad=90)))

out <- lapply(casos, function(c) list(
  js = c$js,
  ref = list(
    blg = c$liq$base_liquidable_general, bla = c$liq$base_liquidable_ahorro,
    minimo = c$liq$minimo_personal_familiar$total %||% 0,
    minimo_aut = c$liq$minimo_personal_familiar_autonomico$total %||% 0,
    ci_est = c$liq$cuota_integra_estatal, ci_aut = c$liq$cuota_integra_autonomica,
    cl = c$liq$cuota_liquida_total, cr = c$liq$cuota_resultante_autoliquidacion,
    cd = c$liq$cuota_diferencial,
    tme = c$liq$tipo_medio_efectivo, modo = c$liq$modo_tributacion_elegido
  )
))
dir.create("tools", showWarnings = FALSE)
writeLines(jsonlite::toJSON(out, auto_unbox = TRUE, null = "null", digits = 6), "tools/casos.json")
cat("casos.json:", length(out), "casos\n")
