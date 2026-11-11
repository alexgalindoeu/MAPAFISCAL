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
#   web/datos/seo_deducciones.json   — deducciones publicables (confirmadas y con fuente
#                                       primaria) de cada territorio.
#   web/datos/seo_guias.json         — cifras de las guías (escalas 2025/2026, mínimos,
#                                       planes de pensiones, donativos, obligación de
#                                       declarar y calendario de params/calendario_renta.yaml).
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
# 3) Deducciones publicables por territorio (web/irpf/<territorio>/deducciones/).
#    Solo se publica lo que está `confirmado` y cita una fuente primaria (BOE, boletín,
#    Manual Práctico de la AEAT o la Hacienda foral). Y para no dar una idea equivocada de
#    quién tiene derecho, una deducción solo sale si TODOS sus supuestos están confirmados:
#    se descarta si algún supuesto sin confirmar de la misma comunidad comparte con ella el
#    `grupo`, el artículo de la norma o el prefijo del `id` (p. ej. `familia_monoparental`
#    frente a `familia_monoparental_ascendientes_75`), también entre los `pendientes`.
#    Los textos los redacta tools/generar_paginas_seo.mjs a partir de estos datos.
# -----------------------------------------------------------------------------
FUENTE_PRIMARIA <- "BOE-A-|Manual Pr[aá]ctico|agenciatributaria|BOG|BOB|BOTHA|BON\\b|DF Gipuzkoa|DFB|Hacienda Foral"

titulo_aeat <- function(fuente) {
  m <- regmatches(fuente, regexpr("«[^»]+»", fuente))
  if (length(m)) substr(m, 2, nchar(m) - 1) else NA_character_
}
url_aeat <- function(fuente) {
  m <- regmatches(fuente, regexpr("https://sede\\.agenciatributaria\\.gob\\.es/[^ )]+", fuente))
  if (length(m)) m else NA_character_
}
ids_boe <- function(fuente) unique(regmatches(fuente, gregexpr("BOE-A-[0-9]{4}-[0-9]+", fuente))[[1]])
articulo <- function(norma) {
  m <- regmatches(norma, regexpr("Arts?\\. [0-9]+[^ ,]*( (bis|ter|qu[a-z]+))?", norma))
  if (length(m)) sub("[),]+$", "", sub("^Arts?\\. ", "", m)) else NA_character_
}
prefijo_id <- function(id) paste(head(strsplit(id, "_")[[1]], 2), collapse = "_")
relacionados <- function(a, b) !is.na(a) && !is.na(b) &&
  (a == b || startsWith(a, paste0(b, ".")) || startsWith(b, paste0(a, ".")))

es_publicable <- function(d) identical(d$estado, "confirmado") && !is.null(d$fuente) &&
  grepl(FUENTE_PRIMARIA, d$fuente) && !is.na(titulo_aeat(d$fuente))

deducciones_comun <- function(t) {
  a <- auto$territorios[[t]]; da <- a$deducciones_autonomicas
  lista <- da$lista %||% list()
  ok <- Filter(es_publicable, lista)
  if (!length(ok)) return(NULL)
  resto <- Filter(function(d) !es_publicable(d), lista)
  pend <- Filter(function(p) is.character(p) && substr(p, 1, 1) != "(", unlist(da$pendientes %||% list()))
  titulos <- unique(vapply(ok, function(d) titulo_aeat(d$fuente), ""))
  fichas <- list()
  for (tit in titulos) {
    items <- Filter(function(d) identical(titulo_aeat(d$fuente), tit), ok)
    choca <- any(vapply(items, function(d) {
      any(vapply(resto, function(r)
        (!is.null(d$grupo) && identical(d$grupo, r$grupo)) ||
          relacionados(articulo(d$norma), articulo(r$norma)) ||
          identical(prefijo_id(d$id), prefijo_id(r$id)), logical(1))) ||
        any(vapply(pend, function(p) identical(prefijo_id(d$id), prefijo_id(p)), logical(1)))
    }, logical(1)))
    if (choca) next
    fuentes <- vapply(items, function(d) d$fuente, "")
    urls <- unique(na.omit(vapply(fuentes, url_aeat, "", USE.NAMES = FALSE)))
    fichas[[length(fichas) + 1]] <- list(
      titulo = tit,
      url_aeat = if (length(urls)) urls[[1]] else NULL,
      boe = as.list(unique(unlist(lapply(fuentes, ids_boe)))),
      normas = as.list(unique(vapply(items, function(d) d$norma, ""))),
      supuestos = lapply(items, function(d) { d$estado <- NULL; d$fuente <- NULL; d })
    )
  }
  if (!length(fichas)) return(NULL)
  list(territorio = t, nombre = a$nombre, regimen = "comun", fichas = fichas)
}

# Forales. País Vasco: los bloques `deduccion_*` y la minoración de cuota, con el estado del
# territorio (override) y solo si la fuente es de la Hacienda de ESE territorio (el bloque
# común toma los importes de Gipuzkoa). Navarra: sus bloques `deduccion_*` y el mínimo
# personal (que allí es una deducción de la cuota), con fuente primaria.
HACIENDA_PV <- list("ES-PV-BI" = "DFB|Bizkaia|BOB", "ES-PV-SS" = "Gipuzkoa|BOG",
                    "ES-PV-VI" = "Araba|Álava|DFA|BOTHA")
deducciones_pv <- function(t) {
  ov <- pv$overrides[[t]] %||% list()
  nombres <- grep("^(deduccion_|minoracion_cuota$)", names(pv$comun), value = TRUE)
  bloques <- list()
  for (k in nombres) {
    b <- pv$comun[[k]]
    if (is.list(ov[[k]])) b <- fusionar_params(b, ov[[k]])
    if (!identical(b$estado, "confirmado") || is.null(b$fuente)) next
    if (!grepl(HACIENDA_PV[[t]], b$fuente) || !grepl(FUENTE_PRIMARIA, b$fuente)) next
    bloques[[k]] <- b
  }
  if (!length(bloques)) return(NULL)
  list(territorio = t, nombre = ov$nombre, regimen = "foral_pais_vasco", norma_base = ov$norma_base,
       bloques = bloques)
}
deducciones_navarra <- function() {
  nombres <- grep("^(deduccion_|minimo_personal_deduccion$)", names(nv), value = TRUE)
  bloques <- Filter(function(b) identical(b$estado, "confirmado") && !is.null(b$fuente) &&
                      grepl("BOE-A-|BON\\b|Hacienda Foral", b$fuente), nv[nombres])
  if (!length(bloques)) return(NULL)
  list(territorio = "ES-NC", nombre = "Navarra", regimen = "foral_navarra",
       norma_base = "Decreto Foral Legislativo 4/2008, Texto Refundido de la Ley Foral del IRPF",
       bloques = bloques)
}

ded <- c(lapply(setNames(TERRITORIOS_COMUN, TERRITORIOS_COMUN), deducciones_comun),
         lapply(setNames(names(HACIENDA_PV), names(HACIENDA_PV)), deducciones_pv),
         list("ES-NC" = deducciones_navarra()))
ded <- Filter(Negate(is.null), ded)
seo_deducciones <- list(ejercicio = EJERCICIO, generado = as.character(Sys.Date()), territorios = ded)

# -----------------------------------------------------------------------------
# 4) Datos de las guías (web/guias/*): escalas, mínimos, previsión social, donativos,
#    obligación de declarar y calendario, con su norma y su fuente. De 2026 solo se usa
#    lo que params/2026 ya trae cotejado (estatal y forales; las autonómicas, aún no).
# -----------------------------------------------------------------------------
est26 <- leer_params(2026, "estatal.yaml")
pv26  <- leer_params(2026, "foral_pais_vasco.yaml")
nv26  <- leer_params(2026, "navarra.yaml")
cal   <- yaml::read_yaml("params/calendario_renta.yaml")

escala <- function(b) list(norma = b$norma, fuente = b$fuente %||% NULL, tramos = tramos_json(b$tramos))

minimos_autonomicos <- Filter(Negate(is.null), lapply(TERRITORIOS_COMUN, function(t) {
  m <- auto$territorios[[t]]$minimo_autonomico
  if (is.null(m) || !identical(m$estado, "confirmado")) return(NULL)
  list(territorio = t, nombre = auto$territorios[[t]]$nombre, norma = m$norma, fuente = m$fuente,
       contribuyente = m[["minimo_contribuyente"]], descendientes = m[["minimo_descendientes"]],
       ascendientes = m[["minimo_ascendientes"]], discapacidad = m[["minimo_discapacidad"]])
}))

# Ahorro de aportar a un plan de pensiones: liquidación real del motor con y sin la
# aportación, en el mismo caso de referencia que las comparativas.
APORTACION <- 1500
SALARIOS_PP <- c(30000, 45000, 60000)
caso_pp <- function(salario, aportacion) {
  nuevo_hogar("seo-pp", "ES-MD", list(
    persona("d1", "declarante", edad = 40,
            prevision_social = if (aportacion > 0) list(aportacion_individual = aportacion) else NULL,
            trabajo = list(dinerarias = salario, cotizaciones_ss = round(salario * SS_TIPO)))
  ), ejercicio = EJERCICIO)
}
ahorro_pp <- lapply(SALARIOS_PP, function(s) {
  sin <- comparar_territorios(caso_pp(s, 0), ejercicio = EJERCICIO)
  con <- comparar_territorios(caso_pp(s, APORTACION), ejercicio = EJERCICIO)
  lapply(seq_len(nrow(sin)), function(i) list(
    territorio = sin$territorio[i], nombre = nombre_territorio(sin$territorio[i]),
    ahorro = round(sin$cuota_liquida_total[i] - con$cuota_liquida_total[con$territorio == sin$territorio[i]], 2)))
})
names(ahorro_pp) <- format(SALARIOS_PP, scientific = FALSE, trim = TRUE)

seo_guias <- list(
  ejercicio = EJERCICIO,
  generado = as.character(Sys.Date()),
  escalas = list(
    estatal_2025 = escala(est$escala_general_estatal),
    estatal_2026 = escala(est26$escala_general_estatal),
    ahorro_estatal_2025 = escala(est$escala_ahorro_estatal),
    ahorro_autonomica_2025 = escala(est$escala_ahorro_autonomica),
    ahorro_estatal_2026 = escala(est26$escala_ahorro_estatal),
    ahorro_autonomica_2026 = escala(est26$escala_ahorro_autonomica),
    pais_vasco_2025 = escala(pv$comun$escala_general_foral),
    pais_vasco_2026 = escala(pv26$comun$escala_general_foral),
    navarra_2025 = escala(nv$escala_general_foral),
    navarra_2026 = escala(nv26$escala_general_foral)
  ),
  minimos = list(
    contribuyente = est$minimo_contribuyente, descendientes = est$minimo_descendientes,
    ascendientes = est$minimo_ascendientes, discapacidad = est$minimo_discapacidad,
    contribuyente_2026 = est26$minimo_contribuyente, descendientes_2026 = est26$minimo_descendientes,
    autonomicos = minimos_autonomicos
  ),
  prevision_social = list(
    reduccion = est$reduccion_prevision_social, reduccion_2026 = est26$reduccion_prevision_social,
    aportacion_ejemplo = APORTACION, supuesto = seo_comparativas$supuesto, ahorro = ahorro_pp
  ),
  donativos = list(estatal = est$deduccion_donativos, estatal_2026 = est26$deduccion_donativos),
  obligacion_declarar = list(estatal = est$obligacion_declarar, estatal_2026 = est26$obligacion_declarar),
  calendario = Filter(function(x) identical(x$estado, "confirmado"), cal$campanas)
)

# -----------------------------------------------------------------------------
comprobar <- "--comprobar" %in% commandArgs(trailingOnly = TRUE)
ok1 <- escribir(seo_comparativas, "web/datos/seo_comparativas.json", comprobar,
                paste(", ejercicio", EJERCICIO, ",", length(SALARIOS), "sueldos de referencia"))
ok2 <- escribir(seo_territorios, "web/datos/seo_territorios.json", comprobar,
                paste(", ejercicio", EJERCICIO, ",", length(territorios), "territorios"))
ok3 <- escribir(seo_deducciones, "web/datos/seo_deducciones.json", comprobar,
                paste(", ejercicio", EJERCICIO, ",", length(ded), "territorios con deducciones publicables"))
ok4 <- escribir(seo_guias, "web/datos/seo_guias.json", comprobar, ", datos de las guías")
if (comprobar && !(ok1 && ok2 && ok3 && ok4)) quit(status = 1)
