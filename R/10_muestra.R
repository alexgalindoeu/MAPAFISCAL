# =============================================================================
# irpfsim :: muestra sintética de hogares
# =============================================================================
# v1: generador PARAMÉTRICO calibrado a marginales por territorio (renta bruta
#     media y Gini de renta bruta) + composición del hogar. Las cifras objetivo
#     por territorio se cargan de data/calibracion/objetivos_territorio.csv
#     (plantilla incluida; sustituir por Estadística de declarantes IRPF AEAT +
#     boletines de las Haciendas forales).
#
# Método: renta bruta ~ lognormal(mu, sigma) con (mu, sigma) resueltos para
#     casar media y Gini objetivo (Gini_lognormal = 2*Phi(sigma/sqrt(2)) - 1).
#     Reponderación (raking) opcional a totales de declarantes por tramo.
# =============================================================================

#' Parámetros lognormales que reproducen una media y un Gini dados.
.lognorm_de_media_gini <- function(media, gini) {
  sigma <- sqrt(2) * qnorm((gini + 1) / 2)
  mu <- log(media) - sigma^2 / 2
  c(mu = mu, sigma = sigma)
}

objetivos_calibracion <- function(path = NULL) {
  path <- path %||% file.path(.params_dir(), "..", "data", "calibracion", "objetivos_territorio.csv")
  if (file.exists(path)) {
    df <- utils::read.csv(path, stringsAsFactors = FALSE)
    est <- df$territorio[grepl("ESTIMADO", df$fuente_estado %||% "")]
    if (length(est))
      registrar_aviso(sprintf("Calibración: %d territorio(s) con renta media ESTIMADA (%s). Verificar con AEAT / Haciendas forales.",
                              length(est), paste(est, collapse = ", ")))
    return(df)
  }
  registrar_aviso("Muestra sintética: sin fichero de calibración; usando plantilla homogénea.")
  data.frame(territorio = TERRITORIOS, renta_bruta_media = 27000,
             gini_renta_bruta = 0.33, n_declarantes = 1e6, stringsAsFactors = FALSE)
}

#' Genera una muestra sintética de hogares.
#'
#' @param n_por_territorio nº de hogares sintéticos por territorio
#' @param territorios vector de territorios (por defecto todos)
#' @param semilla RNG
#' @return data.frame con un hogar por fila (descriptores) + columna list `hogar`
generar_muestra <- function(n_por_territorio = 2000, territorios = TERRITORIOS,
                            ejercicio = 2025, semilla = 1) {
  set.seed(semilla)
  obj <- objetivos_calibracion()
  filas <- list()
  for (terr in territorios) {
    o <- obj[obj$territorio == terr, ]
    if (!nrow(o)) o <- obj[1, ]
    lp <- .lognorm_de_media_gini(o$renta_bruta_media, o$gini_renta_bruta)
    n <- n_por_territorio
    renta <- rlnorm(n, lp["mu"], lp["sigma"])
    # composición del hogar
    tipo_uf <- sample(c("ninguna","biparental","monoparental"), n, replace = TRUE,
                      prob = c(0.55, 0.35, 0.10))
    n_hijos <- rpois(n, 0.9) * (tipo_uf != "ninguna" | rbinom(n, 1, 0.15))
    n_hijos <- pmin(n_hijos, 5L)
    edad <- round(pmin(pmax(rnorm(n, 45, 13), 18), 90))
    # reparto de renta por fuente (Dirichlet aproximado)
    w_trab <- rbeta(n, 6, 2); w_act <- rbeta(n, 1, 9); w_cap <- rbeta(n, 1, 12)
    s <- w_trab + w_act + w_cap
    w_trab <- w_trab/s; w_act <- w_act/s; w_cap <- w_cap/s
    fam_num <- ifelse(n_hijos >= 4, "especial", ifelse(n_hijos == 3, "general", "no"))

    for (i in seq_len(n)) {
      miembros <- list(persona(
        id = "d1", rol = "declarante", edad = edad[i],
        trabajo = list(dinerarias = round(renta[i] * w_trab[i]), cotizaciones_ss = round(renta[i] * w_trab[i] * 0.0635)),
        actividades = if (w_act[i] * renta[i] > 500) list(metodo = "directa_simplificada",
                        rendimiento_neto_previo = round(renta[i] * w_act[i])) else NULL,
        capital_mobiliario = list(dividendos = round(renta[i] * w_cap[i] * 0.5),
                                  intereses = round(renta[i] * w_cap[i] * 0.5)),
        retenciones = round(renta[i] * w_trab[i] * 0.14)
      ))
      if (tipo_uf[i] == "biparental")
        miembros <- c(miembros, list(persona(id = "d2", rol = "conyuge", edad = edad[i],
          trabajo = list(dinerarias = round(renta[i] * 0.5 * w_trab[i])), retenciones = 0)))
      for (h in seq_len(n_hijos[i]))
        miembros <- c(miembros, list(persona(id = paste0("h", h), rol = "descendiente",
          edad = sample(0:24, 1), rentas_propias = 0)))
      hg <- nuevo_hogar(paste0(terr, "_", i), terr, miembros, ejercicio,
                        tipo_unidad_familiar = tipo_uf[i],
                        familia_numerosa = fam_num[i])
      filas[[length(filas) + 1]] <- list(
        id_hogar = hg$id_hogar, territorio = terr, renta_bruta = renta[i],
        tipo_uf = tipo_uf[i], n_hijos = n_hijos[i], edad = edad[i],
        peso = o$n_declarantes / n, hogar = hg
      )
    }
  }
  df <- data.frame(
    id_hogar = vapply(filas, `[[`, character(1), "id_hogar"),
    territorio = vapply(filas, `[[`, character(1), "territorio"),
    renta_bruta = vapply(filas, `[[`, numeric(1), "renta_bruta"),
    tipo_uf = vapply(filas, `[[`, character(1), "tipo_uf"),
    n_hijos = vapply(filas, `[[`, numeric(1), "n_hijos"),
    edad = vapply(filas, `[[`, numeric(1), "edad"),
    peso = vapply(filas, `[[`, numeric(1), "peso"),
    stringsAsFactors = FALSE
  )
  df$hogar <- lapply(filas, `[[`, "hogar")
  class(df) <- c("irpfsim_muestra", "data.frame")
  df
}
