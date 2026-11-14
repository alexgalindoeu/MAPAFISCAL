# =============================================================================
# Datos de las páginas «¿Cuánto me devuelve Hacienda por…?» (tools/seo_devuelve.mjs).
# Para cada situación y cada uno de los 19 territorios liquida con el motor el mismo
# hogar tipo con y sin la situación, a tres sueldos, y guarda la diferencia de cuota
# líquida. Solo cuentan las piezas confirmadas:
#   - deducciones autonómicas: solo las que publica /irpf/<territorio>/deducciones/
#     (web/datos/seo_deducciones.json: confirmadas, con fuente primaria y con todos sus
#     supuestos confirmados); las demás se quitan de los parámetros antes de liquidar;
#   - piezas estatales y forales: el bloque de params/ que explica la situación tiene
#     que estar `confirmado`; si no, el territorio sale sin cifra (`publicable: false`).
#
#   Rscript tools/generar_datos_seo.R            # antes: escribe seo_deducciones.json
#   Rscript tools/generar_datos_devuelve.R       # escribe web/datos/seo_devuelve.json
#   Rscript tools/generar_datos_devuelve.R --comprobar
# =============================================================================
source("R/cargar.R"); irpfsim_cargar(".")

EJERCICIO <- 2025
SALARIOS <- c(20000, 35000, 60000)
SS_TIPO <- 0.0635   # el mismo que tools/generar_datos_seo.R

est  <- leer_params(EJERCICIO, "estatal.yaml")
auto <- leer_params(EJERCICIO, "autonomico.yaml")
pv   <- leer_params(EJERCICIO, "foral_pais_vasco.yaml")
nv   <- leer_params(EJERCICIO, "navarra.yaml")
seo_ded <- jsonlite::fromJSON("web/datos/seo_deducciones.json", simplifyVector = FALSE)

# Deducciones autonómicas publicadas: id -> título de la ficha (Manual Práctico de la AEAT).
publicadas <- function(t) {
  d <- seo_ded$territorios[[t]]; out <- list()
  if (is.null(d$fichas)) return(out)
  for (f in d$fichas) for (s in f$supuestos) out[[s$id]] <- f$titulo
  out
}
bloque_foral_ok <- function(t, k) {
  d <- seo_ded$territorios[[t]]
  !is.null(d$bloques) && !is.null(d$bloques[[k]])
}
estado <- function(b) identical(b$estado, "confirmado")

trabajador <- function(id, salario, edad = 40, ...) persona(id, "declarante", edad = edad,
  trabajo = list(dinerarias = salario, cotizaciones_ss = round(salario * SS_TIPO)), ...)

# Cada situación: hogar sin y con, y las piezas que la explican en cada régimen.
#   comun: bloques estatales y, si hay, el mínimo autonómico que tiene que estar confirmado.
#   pv / nc: bloque foral (NULL = no hay pieza confirmada que calcular).
SITUACIONES <- list(
  "hijo" = list(
    hogar = function(s, con) {
      m <- list(trabajador("d1", s), trabajador("d2", s))
      if (con) m <- c(m, list(persona("h1", "descendiente", edad = 0, nacido_en_ejercicio = TRUE)))
      list(miembros = m, tipo = "biparental")
    },
    comun = "minimo_descendientes", minimo_aut = "minimo_descendientes",
    pv = "deduccion_descendientes", nc = "minimo_familiar_deduccion"),
  "familia-numerosa" = list(
    hogar = function(s, con) list(miembros = list(trabajador("d1", s), trabajador("d2", s),
      persona("h1", "descendiente", edad = 2), persona("h2", "descendiente", edad = 6),
      persona("h3", "descendiente", edad = 10)), tipo = "biparental",
      fn = if (con) "general" else "no"),
    comun = character(), minimo_aut = NULL, pv = NULL, nc = "deduccion_familia_numerosa"),
  "ascendiente-a-cargo" = list(
    hogar = function(s, con) {
      m <- list(trabajador("d1", s, edad = 50))
      if (con) m <- c(m, list(persona("a1", "ascendiente", edad = 80, rentas_propias = 6000)))
      list(miembros = m, tipo = "ninguna")
    },
    comun = "minimo_ascendientes", minimo_aut = "minimo_ascendientes",
    pv = "deduccion_ascendientes", nc = "minimo_familiar_deduccion"),
  "mayor-65" = list(
    hogar = function(s, con) list(miembros = list(trabajador("d1", s, edad = if (con) 67 else 60)), tipo = "ninguna"),
    comun = "minimo_contribuyente", minimo_aut = "minimo_contribuyente",
    pv = "deduccion_edad", nc = "minimo_personal_deduccion"),
  "discapacidad-33" = list(
    hogar = function(s, con) list(miembros = list(trabajador("d1", s, discapacidad = if (con) "33_64" else "no")), tipo = "ninguna"),
    comun = "minimo_discapacidad", minimo_aut = "minimo_discapacidad",
    pv = "deduccion_discapacidad", nc = "minimo_personal_deduccion"),
  "discapacidad-65" = list(
    hogar = function(s, con) list(miembros = list(trabajador("d1", s, discapacidad = if (con) "65_mas" else "no")), tipo = "ninguna"),
    comun = "minimo_discapacidad", minimo_aut = "minimo_discapacidad",
    pv = "deduccion_discapacidad", nc = "minimo_personal_deduccion"),
  "alquiler" = list(
    hogar = function(s, con) list(miembros = list(trabajador("d1", s, edad = 30,
      alquiler_vivienda_pagos = if (con) 9000 else 0)), tipo = "ninguna"),
    comun = character(), minimo_aut = NULL,
    pv = "deduccion_alquiler_vivienda", nc = "deduccion_alquiler_vivienda"),
  "hipoteca-antes-2013" = list(
    hogar = function(s, con) list(miembros = list(trabajador("d1", s, edad = 45,
      vivienda_transitoria_pagos = if (con) 9000 else 0,
      adquisicion_vivienda_pagos = 0)), tipo = "ninguna"),
    hogar_pv = function(s, con) list(miembros = list(trabajador("d1", s, edad = 45,
      adquisicion_vivienda_pagos = if (con) 9000 else 0)), tipo = "ninguna"),
    comun = "deduccion_vivienda_transitoria", minimo_aut = NULL,
    pv = "deduccion_adquisicion_vivienda", nc = "deducciones_vivienda"),
  "donativo" = list(
    hogar = function(s, con) list(miembros = list(trabajador("d1", s, donativos = if (con) 250 else 0)), tipo = "ninguna"),
    comun = "deduccion_donativos", minimo_aut = NULL, pv = NULL, nc = "deducciones_donativos")
)

nombre_territorio <- function(t) cargar_parametros(t, EJERCICIO)$jurisdiccion$nombre %||% t

# Parámetros del territorio sin lo no confirmado que podría colarse en la diferencia.
params_confirmados <- function(t) {
  P <- cargar_parametros(t, EJERCICIO)
  reg <- P$meta$regimen
  if (reg == "comun") {
    ok <- names(publicadas(t))
    da <- P$jurisdiccion$deducciones_autonomicas
    if (!is.null(da$lista)) P$jurisdiccion$deducciones_autonomicas$lista <-
      Filter(function(d) d$id %in% ok, da$lista)
  } else if (reg == "foral_navarra") {
    # emancipación (provisional) es incompatible con la de alquiler: fuera
    P$jurisdiccion$deduccion_emancipacion <- NULL
    P$jurisdiccion$deduccion_pension_jubilacion <- NULL
  }
  P
}

cuota <- function(t, P, h) {
  hg <- nuevo_hogar("devuelve", t, h$miembros, EJERCICIO, tipo_unidad_familiar = h$tipo,
                    familia_numerosa = h$fn %||% "no", titulo_familia_numerosa = !identical(h$fn %||% "no", "no"))
  liquidar(hg, parametros = P, modo = "auto")
}
ded_aut <- function(liq) {
  d <- liq$deducciones_autonomicas$detalle %||% list()
  d[vapply(d, function(v) is.numeric(v) && sum(v) > 0, logical(1))]
}

calcular <- function(sit_slug, t) {
  S <- SITUACIONES[[sit_slug]]
  P <- params_confirmados(t); reg <- P$meta$regimen
  piezas <- character(); publicable <- TRUE
  if (reg == "comun") {
    for (k in S$comun) { piezas <- c(piezas, k); if (!estado(est[[k]])) publicable <- FALSE }
    ma <- auto$territorios[[t]]$minimo_autonomico
    propio_min <- !is.null(S$minimo_aut) && !is.null(ma) && !is.null(ma[[S$minimo_aut]])
    if (propio_min && !estado(ma)) publicable <- FALSE
  } else {
    k <- if (reg == "foral_pais_vasco") S$pv else S$nc
    propio_min <- FALSE
    if (is.null(k)) publicable <- FALSE
    else {
      piezas <- k
      ok <- if (reg == "foral_pais_vasco") bloque_foral_ok(t, k) else bloque_foral_ok(t, k)
      if (!ok) publicable <- FALSE
    }
  }
  fh <- if (reg == "foral_pais_vasco" && !is.null(S$hogar_pv)) S$hogar_pv else S$hogar
  ahorro <- list(); deds <- list()
  for (s in SALARIOS) {
    sin <- cuota(t, P, fh(s, FALSE)); con <- cuota(t, P, fh(s, TRUE))
    ahorro[[format(s, scientific = FALSE)]] <- round(sin$cuota_liquida_total - con$cuota_liquida_total, 2)
    if (reg == "comun") {
      da_sin <- ded_aut(sin); da_con <- ded_aut(con)
      for (id in names(da_con)) {
        dif <- sum(da_con[[id]]) - sum(da_sin[[id]] %||% 0)
        if (dif > 0.005) deds[[id]] <- publicadas(t)[[id]] %||% id
      }
    }
  }
  list(territorio = t, nombre = nombre_territorio(t), regimen = reg, publicable = publicable,
       piezas = as.list(piezas), minimo_autonomico_propio = isTRUE(propio_min),
       deducciones_autonomicas = if (length(deds)) lapply(names(deds), function(i) list(id = i, titulo = deds[[i]])) else list(),
       ahorro = if (publicable) ahorro else NULL)
}

datos <- list(
  ejercicio = EJERCICIO,
  generado = as.character(Sys.Date()),
  salarios = as.list(SALARIOS),
  ss_tipo = SS_TIPO,
  importes = list(alquiler = 9000, hipoteca = 9000, donativo = 250, edad_ascendiente = 80,
                  rentas_ascendiente = 6000),
  normas = list(
    minimo_contribuyente = est$minimo_contribuyente$norma, minimo_descendientes = est$minimo_descendientes$norma,
    minimo_ascendientes = est$minimo_ascendientes$norma, minimo_discapacidad = est$minimo_discapacidad$norma,
    deduccion_vivienda_transitoria = est$deduccion_vivienda_transitoria$norma,
    deduccion_donativos = est$deduccion_donativos$norma),
  situaciones = setNames(lapply(names(SITUACIONES), function(sl)
    setNames(lapply(TERRITORIOS, function(t) calcular(sl, t)), TERRITORIOS)), names(SITUACIONES))
)

json <- function(x) as.character(jsonlite::prettify(
  jsonlite::toJSON(x, auto_unbox = TRUE, null = "null", digits = NA), indent = 1))
destino <- "web/datos/seo_devuelve.json"
if ("--comprobar" %in% commandArgs(trailingOnly = TRUE)) {
  if (!file.exists(destino)) { message(destino, " no existe."); quit(status = 1) }
  actual <- gsub("\r", "", readChar(destino, file.size(destino), useBytes = TRUE), fixed = TRUE)
  datos$generado <- jsonlite::fromJSON(actual)$generado
  if (!identical(charToRaw(actual), charToRaw(enc2utf8(json(datos))))) {
    message(destino, " no coincide con el motor. Regenéralo con `Rscript tools/generar_datos_devuelve.R`.")
    quit(status = 1)
  }
  cat(destino, " coincide con el motor\n", sep = "")
} else {
  con <- file(destino, "wb"); writeBin(charToRaw(enc2utf8(json(datos))), con); close(con)
  n <- sum(unlist(lapply(datos$situaciones, function(s) vapply(s, function(x) isTRUE(x$publicable), logical(1)))))
  cat(basename(destino), ": ", length(SITUACIONES), " situaciones, ", n, " de ",
      length(SITUACIONES) * length(TERRITORIOS), " territorio-situación con cifra\n", sep = "")
}
