# =============================================================================
# irpfsim :: modelo de datos del hogar (input del motor)
# =============================================================================
# Un `hogar` es una lista con:
#   $id_hogar, $territorio, $ejercicio
#   $tipo_unidad_familiar  : "biparental" | "monoparental" | "ninguna"
#   $familia_numerosa      : "no" | "general" | "especial"
#   $miembros              : lista de personas
#
# Cada persona (lista) admite:
#   id, rol ("declarante"|"conyuge"|"descendiente"|"ascendiente"),
#   edad, discapacidad ("no"|"33_64"|"65_mas"), movilidad_reducida (lgl),
#   ayuda_terceros (lgl), discapacidad_judicial (lgl),
#   convivencia_meses (0-12), rentas_propias (num, para test de dependencia),
#   y bloques de renta:
#     trabajo: list(dinerarias, especie, cotizaciones_ss, otros_gastos,
#                   movilidad_geografica, rendimiento_irregular=list(importe,anios),
#                   trabajador_activo_discapacidad)
#     capital_inmobiliario: lista de inmuebles list(ingresos, gastos_deducibles,
#                   gastos_financieros, arrendamiento_vivienda, tipo_arrendamiento,
#                   irregular)
#     capital_mobiliario: list(dividendos, intereses, seguros, cesion_terceros_general,
#                   base_general_otros)
#     actividades: list(metodo, rendimiento_neto_previo, gastos_dificil_justif,
#                   inicio_actividad, rendimiento_neto_modulos)
#     ganancias: lista de elementos list(valor_transmision, valor_adquisicion,
#                   fecha_adquisicion, fecha_transmision, tipo_elemento,
#                   es_transmision, exenta)
#     ganancias_perdidas_no_transmision: num (premios, ayudas -> base general)
#     imputacion_inmobiliaria: list(valor_catastral, revisado_10_anios)
#     prevision_social: list(aportacion_individual, contribucion_empresarial)
#     reducciones: list(pensiones_compensatorias, anualidades_alimentos_hijos)
#     retenciones: num
# =============================================================================

persona <- function(id, rol = "declarante", edad = 40,
                    discapacidad = "no", movilidad_reducida = FALSE,
                    ayuda_terceros = FALSE, discapacidad_judicial = FALSE,
                    convivencia_meses = 12, rentas_propias = 0,
                    trabajo = NULL, capital_inmobiliario = NULL,
                    capital_mobiliario = NULL, actividades = NULL,
                    ganancias = NULL, ganancias_perdidas_no_transmision = 0,
                    imputacion_inmobiliaria = NULL, prevision_social = NULL,
                    reducciones = NULL, retenciones = 0,
                    donativos = 0, nacido_en_ejercicio = FALSE, ...) {
  extra <- list(...)   # campos libres para deducciones autonómicas/forales:
                       # alquiler_vivienda_pagos, adquisicion_vivienda_pagos,
                       # gastos_escolaridad, gastos_idiomas, gastos_vestuario_escolar,
                       # gastos_guarderia, vivienda_transitoria_pagos, colectivo_especial_vivienda, ...
  base <- list(
    id = id, rol = rol, edad = edad,
    discapacidad = discapacidad, movilidad_reducida = movilidad_reducida,
    ayuda_terceros = ayuda_terceros, discapacidad_judicial = discapacidad_judicial,
    convivencia_meses = convivencia_meses, rentas_propias = rentas_propias,
    trabajo = trabajo, capital_inmobiliario = capital_inmobiliario,
    capital_mobiliario = capital_mobiliario, actividades = actividades,
    ganancias = ganancias %||% list(),
    ganancias_perdidas_no_transmision = ganancias_perdidas_no_transmision,
    imputacion_inmobiliaria = imputacion_inmobiliaria,
    prevision_social = prevision_social, reducciones = reducciones,
    retenciones = retenciones, donativos = donativos,
    nacido_en_ejercicio = nacido_en_ejercicio
  )
  structure(utils::modifyList(base, extra), class = "irpfsim_persona")
}

nuevo_hogar <- function(id_hogar, territorio, miembros, ejercicio = 2025,
                        tipo_unidad_familiar = "ninguna",
                        familia_numerosa = "no", titulo_familia_numerosa = FALSE,
                        parto_multiple = FALSE,
                        municipio_habitantes = NULL, zona_despoblada = FALSE,
                        familia_numerosa_reciente = FALSE) {
  # municipio_habitantes: población del municipio de residencia (NULL = no informada);
  # zona_despoblada: el municipio figura en la lista oficial de zonas rurales o en riesgo
  # de despoblación de la comunidad (cada CCAA publica la suya).
  # familia_numerosa_reciente: el reconocimiento del título de familia numerosa tiene
  # efectos en el ejercicio o en los dos anteriores (Madrid, art. 13 bis DL 1/2010).
  h <- structure(list(
    id_hogar = id_hogar, territorio = territorio, ejercicio = ejercicio,
    tipo_unidad_familiar = tipo_unidad_familiar,
    familia_numerosa = familia_numerosa,
    titulo_familia_numerosa = titulo_familia_numerosa,
    parto_multiple = parto_multiple,
    municipio_habitantes = municipio_habitantes,
    zona_despoblada = isTRUE(zona_despoblada),
    familia_numerosa_reciente = isTRUE(familia_numerosa_reciente),
    miembros = miembros
  ), class = "irpfsim_hogar")
  validar_hogar(h)
  h
}

validar_hogar <- function(h) {
  if (!inherits(h, "irpfsim_hogar")) stop("irpfsim: no es un hogar.", call. = FALSE)
  if (!h$territorio %in% TERRITORIOS)
    stop(sprintf("irpfsim: territorio '%s' no válido.", h$territorio), call. = FALSE)
  if (!length(h$miembros)) stop("irpfsim: el hogar no tiene miembros.", call. = FALSE)
  roles <- vapply(h$miembros, function(m) m$rol, character(1))
  if (!"declarante" %in% roles) stop("irpfsim: el hogar necesita al menos un 'declarante'.", call. = FALSE)
  if (!h$tipo_unidad_familiar %in% c("biparental","monoparental","ninguna"))
    stop("irpfsim: tipo_unidad_familiar no válido.", call. = FALSE)
  if (!h$familia_numerosa %in% c("no","general","especial"))
    stop("irpfsim: familia_numerosa no válida.", call. = FALSE)
  invisible(TRUE)
}

# --- Helpers de acceso ----------------------------------------------------------
declarantes  <- function(h) Filter(function(m) m$rol %in% c("declarante","conyuge"), h$miembros)
descendientes <- function(h) Filter(function(m) m$rol == "descendiente", h$miembros)
ascendientes <- function(h) Filter(function(m) m$rol == "ascendiente", h$miembros)

# --- JSON <-> hogar (para la API web) -----------------------------------------
hogar_desde_json <- function(txt) {
  x <- jsonlite::fromJSON(txt, simplifyVector = FALSE)
  miembros <- lapply(x$miembros, function(m) do.call(persona, m))
  nuevo_hogar(
    id_hogar = x$id_hogar %||% "h1",
    territorio = x$territorio,
    miembros = miembros,
    ejercicio = x$ejercicio %||% 2025,
    tipo_unidad_familiar = x$tipo_unidad_familiar %||% "ninguna",
    familia_numerosa = x$familia_numerosa %||% "no",
    titulo_familia_numerosa = x$titulo_familia_numerosa %||% FALSE,
    parto_multiple = x$parto_multiple %||% FALSE
  )
}

print.irpfsim_hogar <- function(x, ...) {
  cat(sprintf("<irpfsim_hogar> id=%s territorio=%s ejercicio=%s uf=%s fam.num=%s miembros=%d\n",
              x$id_hogar, x$territorio, x$ejercicio, x$tipo_unidad_familiar,
              x$familia_numerosa, length(x$miembros)))
  invisible(x)
}
