# =============================================================================
# Datos para las páginas SEO por territorio y por sueldo (tools/generar_paginas_seo.mjs).
# Todo sale del motor y de los YAML de params/: no se escribe a mano ninguna cifra
# ni ninguna cita legal.
#
#   Rscript tools/generar_datos_seo.R              # regenera los dos JSON
#   Rscript tools/generar_datos_seo.R --comprobar  # falla si no coinciden con el motor
#
# Genera:
#   web/datos/seo_comparativas.json  — comparativa de los 19 territorios en 5 sueldos
#                                       de referencia (liquidación real del motor).
#   web/datos/seo_territorios.json   — escala combinada, mínimo y deducciones de cada
#                                       territorio, con su norma y su fuente.
# =============================================================================
source("R/cargar.R"); irpfsim_cargar(".")

EJERCICIO <- 2025
SALARIOS <- c(20000, 30000, 40000, 60000, 100000)
SS_TIPO <- 0.0635   # mismo valor por defecto que web/js/app.js para f-ss

json <- function(x) paste0(as.character(jsonlite::prettify(
  jsonlite::toJSON(x, auto_unbox = TRUE, null = "null", digits = NA), indent = 1)), "")

escribir <- function(x, destino, comprobar, etiqueta) {
  if (comprobar) {
    if (!file.exists(destino)) {
      message(destino, " no existe. Genéralo con `Rscript tools/generar_datos_seo.R`.")
      return(FALSE)
    }
    actual <- gsub("\r", "", readChar(destino, file.size(destino), useBytes = TRUE), fixed = TRUE)
    x$generado <- jsonlite::fromJSON(actual)$generado
    if (!identical(charToRaw(actual), charToRaw(enc2utf8(json(x))))) {
      message(destino, " no coincide con lo que calcula el motor.\n",
              "Regenéralo con `Rscript tools/generar_datos_seo.R` y no lo edites a mano.")
      return(FALSE)
    }
    cat(destino, " coincide con el motor\n", sep = "")
    return(TRUE)
  }
  con <- file(destino, "wb"); writeBin(charToRaw(enc2utf8(json(x))), con); close(con)
  cat(basename(destino), ": ", file.size(destino), " bytes", etiqueta, "\n", sep = "")
  TRUE
}

# -----------------------------------------------------------------------------
# 1) Comparativa de sueldos: liquidación real del motor en los 19 territorios.
# -----------------------------------------------------------------------------
nombre_territorio <- function(t) cargar_parametros(t, EJERCICIO)$jurisdiccion$nombre %||% t

caso_salario <- function(salario) {
  nuevo_hogar("seo", "ES-MD", list(
    persona("d1", "declarante", edad = 40,
            trabajo = list(dinerarias = salario, cotizaciones_ss = round(salario * SS_TIPO)))
  ), ejercicio = EJERCICIO)
}

comparativa_salario <- function(salario) {
  d <- comparar_territorios(caso_salario(salario), ejercicio = EJERCICIO)
  d <- d[order(d$cuota_liquida_total), ]
  lapply(seq_len(nrow(d)), function(i) list(
    puesto = i, territorio = d$territorio[i], nombre = nombre_territorio(d$territorio[i]),
    cuota_liquida_total = round(d$cuota_liquida_total[i], 2),
    tipo_medio_efectivo = round(d$tipo_medio_efectivo[i], 4)
  ))
}

seo_comparativas <- list(
  ejercicio = EJERCICIO,
  generado = as.character(Sys.Date()),
  supuesto = paste(
    "Una persona declarante, 40 años, un único rendimiento del trabajo de 12 pagas,",
    "sin cónyuge ni hijos, sin vivienda ni deducciones autonómicas.",
    "Cotización a la Seguridad Social: 6,35 % del salario (el valor por defecto",
    "de la calculadora), sin aplicar el tope máximo de cotización.",
    "No es una liquidación oficial ni tiene en cuenta tu situación real."
  ),
  ss_tipo = SS_TIPO,
  salarios = as.list(SALARIOS),
  comparativas = setNames(lapply(SALARIOS, comparativa_salario), format(SALARIOS, scientific = FALSE, trim = TRUE))
)

# -----------------------------------------------------------------------------
# 2) Escala combinada, mínimo y deducciones de cada territorio, con su cita legal.
#    Se leen los YAML crudos (no el objeto ya aplanado de cargar_parametros()) para
#    conservar norma/fuente/estado.
# -----------------------------------------------------------------------------
est  <- leer_params(EJERCICIO, "estatal.yaml")
auto <- leer_params(EJERCICIO, "autonomico.yaml")
pv   <- leer_params(EJERCICIO, "foral_pais_vasco.yaml")
nv   <- leer_params(EJERCICIO, "navarra.yaml")

tipo_marginal_en <- function(tramos, x) {
  for (t in tramos) if (x <= t$hasta) return(t$tipo)
  tramos[[length(tramos)]]$tipo
}

# Combina dos escalas marginales (estatal + autonómica) en una sola, tramo a tramo.
combinar_escalas <- function(tramos_a, tramos_b) {
  cotas <- sort(unique(c(sapply(tramos_a, function(x) x$hasta), sapply(tramos_b, function(x) x$hasta))))
  lapply(cotas, function(c) list(
    hasta = if (is.infinite(c)) NULL else c,
    tipo = round(tipo_marginal_en(tramos_a, c) + tipo_marginal_en(tramos_b, c), 4)
  ))
}

tramos_json <- function(tramos) lapply(tramos, function(t) list(
  hasta = if (is.null(t$hasta) || is.infinite(t$hasta)) NULL else t$hasta, tipo = t$tipo
))

deducciones_resumen <- function(da) {
  if (is.null(da)) return(list(modeladas = 0, provisionales = 0, pendientes = 0))
  lista <- da$lista %||% list()
  list(
    modeladas = length(lista),
    provisionales = sum(vapply(lista, function(d) identical(d$estado, "provisional"), logical(1))),
    pendientes = length(Filter(function(p) is.character(p) && substr(p, 1, 1) != "(", da$pendientes %||% list()))
  )
}

datos_territorio_comun <- function(t) {
  a <- auto$territorios[[t]]
  escala <- combinar_escalas(est$escala_general_estatal$tramos, a$escala_general_autonomica$tramos)
  min_auto <- a$minimo_autonomico
  # Solo cuenta como "mínimo propio" si sustituye el general (< 65 años) del art. 57 LIRPF;
  # algunos territorios (p. ej. Illes Balears) solo elevan el incremento por mayores de 65,
  # y otros (Castilla y León, Cataluña, La Rioja) no tocan el mínimo del contribuyente, solo
  # el de descendientes/ascendientes/discapacidad. `[[ ]]` exacto: nada de $ parcial.
  general_propio <- min_auto$minimo_contribuyente[["general"]]
  list(
    territorio = t, nombre = a$nombre, regimen = "comun",
    escala_combinada = list(
      tramos = tramos_json(escala),
      fuente_estatal = list(norma = est$escala_general_estatal$norma, fuente = est$escala_general_estatal$fuente),
      fuente_autonomica = list(norma = a$escala_general_autonomica$norma, fuente = a$escala_general_autonomica$fuente)
    ),
    minimo_contribuyente = list(
      general = est$minimo_contribuyente$general,
      general_territorio = general_propio %||% est$minimo_contribuyente$general,
      tiene_minimo_propio = !is.null(general_propio),
      fuente_estatal = list(norma = est$minimo_contribuyente$norma, fuente = est$minimo_contribuyente$fuente),
      fuente_autonomica = if (!is.null(general_propio)) list(norma = min_auto$norma, fuente = min_auto$fuente) else NULL
    ),
    deducciones = deducciones_resumen(a$deducciones_autonomicas)
  )
}

datos_territorio_pv <- function(t, nombre) {
  e <- pv$comun$escala_general_foral
  list(
    territorio = t, nombre = nombre, regimen = "foral_pais_vasco",
    escala_combinada = list(tramos = tramos_json(e$tramos), fuente_estatal = NULL,
                            fuente_autonomica = list(norma = e$norma, fuente = e$fuente)),
    minimo_contribuyente = NULL, deducciones = NULL
  )
}

datos_navarra <- function() {
  e <- nv$escala_general_foral
  list(
    territorio = "ES-NC", nombre = "Comunidad Foral de Navarra", regimen = "foral_navarra",
    escala_combinada = list(tramos = tramos_json(e$tramos), fuente_estatal = NULL,
                            fuente_autonomica = list(norma = e$norma, fuente = e$fuente)),
    minimo_contribuyente = NULL, deducciones = NULL
  )
}

TERRITORIOS_COMUN <- names(auto$territorios)
territorios <- c(
  setNames(lapply(TERRITORIOS_COMUN, datos_territorio_comun), TERRITORIOS_COMUN),
  list(
    "ES-PV-BI" = datos_territorio_pv("ES-PV-BI", "Bizkaia"),
    "ES-PV-SS" = datos_territorio_pv("ES-PV-SS", "Gipuzkoa"),
    "ES-PV-VI" = datos_territorio_pv("ES-PV-VI", "Araba/Álava"),
    "ES-NC" = datos_navarra()
  )
)

seo_territorios <- list(
  ejercicio = EJERCICIO,
  generado = as.character(Sys.Date()),
  territorios = territorios
)

# -----------------------------------------------------------------------------
comprobar <- "--comprobar" %in% commandArgs(trailingOnly = TRUE)
ok1 <- escribir(seo_comparativas, "web/datos/seo_comparativas.json", comprobar,
                paste(", ejercicio", EJERCICIO, ",", length(SALARIOS), "sueldos de referencia"))
ok2 <- escribir(seo_territorios, "web/datos/seo_territorios.json", comprobar,
                paste(", ejercicio", EJERCICIO, ",", length(territorios), "territorios"))
if (comprobar && !(ok1 && ok2)) quit(status = 1)
