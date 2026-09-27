# =============================================================================
# Exporta los parámetros a web/datos/ para el motor JavaScript.
# Fuente única de verdad: params/<año>/*.yaml, con la herencia entre ejercicios
# resuelta (ver leer_params() en R/01_parametros.R).
#
#   Rscript tools/exportar_params.R              # regenera los JSON de todos los ejercicios
#   Rscript tools/exportar_params.R --comprobar  # falla si algún fichero no sale de los YAML
#
# El ejercicio por defecto (params/ejercicios.yaml) va a web/datos/params.json y cada uno
# de los demás a web/datos/params_<año>.json.
# --comprobar (CI) regenera en memoria y compara con los ficheros versionados, salvo la
# fecha `generado`, que cambia cada día.
# =============================================================================
source("R/cargar.R"); irpfsim_cargar(".")

flat_escala <- function(tr) lapply(tr, function(x) list(hasta = if (is.infinite(x$hasta)) NULL else x$hasta, tipo = x$tipo))

cfg_ejercicios <- ejercicios_config()

params_web <- function(ejercicio) {
  est  <- leer_params(ejercicio, "estatal.yaml")
  auto <- leer_params(ejercicio, "autonomico.yaml")
  pv   <- leer_params(ejercicio, "foral_pais_vasco.yaml")
  nv   <- leer_params(ejercicio, "navarra.yaml")

  estatal <- list(
    escala_general_estatal = flat_escala(est$escala_general_estatal$tramos),
    escala_ahorro_estatal  = flat_escala(est$escala_ahorro_estatal$tramos),
    escala_ahorro_autonomica = flat_escala(est$escala_ahorro_autonomica$tramos),
    minimo_contribuyente = est$minimo_contribuyente,
    minimo_descendientes = est$minimo_descendientes,
    minimo_ascendientes  = est$minimo_ascendientes,
    minimo_discapacidad  = est$minimo_discapacidad,
    trabajo_otros_gastos = est$trabajo_otros_gastos,
    trabajo_reduccion_art20 = est$trabajo_reduccion_art20,
    capital_mobiliario = est$capital_mobiliario,
    actividades_directa_simplificada = est$actividades_directa_simplificada,
    dt9_abatimiento = est$dt9_abatimiento,
    integracion_compensacion = est$integracion_compensacion,
    reduccion_prevision_social = est$reduccion_prevision_social,
    reduccion_tributacion_conjunta = est$reduccion_tributacion_conjunta,
    imputacion_renta_inmobiliaria = est$imputacion_renta_inmobiliaria,
    anualidades_alimentos_hijos = est$anualidades_alimentos_hijos,
    deduccion_obtencion_rendimientos_trabajo = est$deduccion_obtencion_rendimientos_trabajo,
    deduccion_vivienda_transitoria = est$deduccion_vivienda_transitoria,
    deduccion_donativos = est$deduccion_donativos,
    obligacion_declarar = est$obligacion_declarar,
    deduccion_maternidad = est$deduccion_maternidad,
    deduccion_familia_numerosa_y_discapacidad_cargo = est$deduccion_familia_numerosa_y_discapacidad_cargo
  )

  territorios <- list()
  for (code in names(auto$territorios)) {
    t <- auto$territorios[[code]]
    territorios[[code]] <- list(
      nombre = t$nombre, regimen = "comun",
      escala_general_autonomica = flat_escala(t$escala_general_autonomica$tramos),
      bonificacion_residencia = t$bonificacion_residencia,
      deducciones_autonomicas = t$deducciones_autonomicas,
      minimo_autonomico = t$minimo_autonomico
    )
  }

  pv_comun <- pv$comun
  foral_pv <- list(
    escala_general_foral = flat_escala(pv_comun$escala_general_foral$tramos),
    escala_ahorro_foral  = flat_escala(pv_comun$escala_ahorro_foral$tramos),
    bonificacion_trabajo = pv_comun$bonificacion_trabajo,
    reduccion_prevision_social = pv_comun$reduccion_prevision_social,
    reduccion_tributacion_conjunta = pv_comun$reduccion_tributacion_conjunta,
    minoracion_cuota = pv_comun$minoracion_cuota,
    exencion_dividendos = pv_comun$exencion_dividendos,
    deduccion_descendientes = pv_comun$deduccion_descendientes,
    deduccion_ascendientes = pv_comun$deduccion_ascendientes,
    deduccion_discapacidad = pv_comun$deduccion_discapacidad,
    deduccion_edad = pv_comun$deduccion_edad,
    deduccion_alquiler_vivienda = pv_comun$deduccion_alquiler_vivienda,
    deduccion_adquisicion_vivienda = pv_comun$deduccion_adquisicion_vivienda,
    dt_abatimiento_pre1994 = pv_comun$dt_abatimiento_pre1994,
    overrides = pv$overrides
  )
  for (code in c("ES-PV-BI","ES-PV-SS","ES-PV-VI"))
    territorios[[code]] <- list(nombre = pv$overrides[[code]]$nombre, regimen = "foral_pais_vasco")

  navarra <- list(
    escala_general_foral = flat_escala(nv$escala_general_foral$tramos),
    escala_ahorro_foral  = flat_escala(nv$escala_ahorro_foral$tramos),
    minimo_personal_deduccion = nv$minimo_personal_deduccion,
    minimo_familiar_deduccion = nv$minimo_familiar_deduccion,
    deduccion_trabajo_cuota = list(
      tramos = lapply(nv$deduccion_trabajo_cuota$tramos, function(x)
        list(hasta = if (is.infinite(x$hasta)) NULL else x$hasta, base = x$base, coef = x$coef, desde = x$desde)),
      incremento_discapacidad_33_64 = nv$deduccion_trabajo_cuota$incremento_discapacidad_33_64,
      incremento_discapacidad_65_mas = nv$deduccion_trabajo_cuota$incremento_discapacidad_65_mas),
    deduccion_alquiler_vivienda = nv$deduccion_alquiler_vivienda,
    deduccion_emancipacion = nv$deduccion_emancipacion,
    deduccion_pension_jubilacion = nv$deduccion_pension_jubilacion,
    dt_abatimiento_pre1994 = nv$dt_abatimiento_pre1994
  )
  territorios[["ES-NC"]] <- list(nombre = "Comunidad Foral de Navarra", regimen = "foral_navarra")

  list(
    ejercicio = ejercicio,
    generado = as.character(Sys.Date()),
    ejercicios = list(por_defecto = cfg_ejercicios$por_defecto, publicados = I(cfg_ejercicios$publicados)),
    estatal = estatal,
    foral_pv = foral_pv,
    navarra = navarra,
    territorios = territorios
  )
}

destino_ejercicio <- function(ejercicio)
  if (ejercicio == cfg_ejercicios$por_defecto) "web/datos/params.json" else sprintf("web/datos/params_%d.json", ejercicio)

# JSON con sangría de 1 espacio y saltos LF, sin redondear cifras
json_params <- function(x) paste0(as.character(jsonlite::prettify(
  jsonlite::toJSON(x, auto_unbox = TRUE, null = "null", digits = NA), indent = 1)), "")

comprobar <- "--comprobar" %in% commandArgs(trailingOnly = TRUE)
fallos <- 0
for (ej in ejercicios_disponibles()) {
  out <- params_web(ej)
  destino <- destino_ejercicio(ej)
  if (comprobar) {
    if (!file.exists(destino)) {
      message(destino, " no existe. Genéralo con `Rscript tools/exportar_params.R`.")
      fallos <- fallos + 1; next
    }
    actual <- gsub("\r", "", readChar(destino, file.size(destino), useBytes = TRUE), fixed = TRUE)
    out$generado <- jsonlite::fromJSON(actual)$generado
    if (!identical(charToRaw(actual), charToRaw(enc2utf8(json_params(out))))) {
      message(destino, " no coincide con params/", ej, "/*.yaml.\n",
              "Regenéralo con `Rscript tools/exportar_params.R` y no lo edites a mano.")
      fallos <- fallos + 1
    } else cat(destino, " coincide con params/", ej, "/*.yaml\n", sep = "")
  } else {
    con <- file(destino, "wb"); writeBin(charToRaw(enc2utf8(json_params(out))), con); close(con)
    cat(basename(destino), ": ejercicio ", ej, ", ", file.size(destino), " bytes, ",
        length(out$territorios), " territorios\n", sep = "")
  }
}
if (comprobar && fallos > 0) quit(status = 1)
