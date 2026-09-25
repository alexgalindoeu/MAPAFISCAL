# =============================================================================
# irpfsim :: optimizador fiscal (feature para asesores / gestores)
# =============================================================================
# Dado un hogar, busca la configuración que minimiza la cuota líquida y devuelve
# un conjunto de "palancas" ordenadas por ahorro anual.
# =============================================================================

#' Optimiza la carga fiscal de un hogar.
#'
#' @param hogar objeto irpfsim_hogar
#' @param palancas configuración de las palancas a explorar (ver defaults)
#' @return objeto irpfsim_optimizacion
optimizar <- function(hogar, palancas = list()) {
  cfg <- utils::modifyList(list(
    plan_pensiones_pasos = c(1000, 1500, 3000, 5000),
    territorios = TERRITORIOS,
    incluir_traslado = TRUE
  ), palancas)

  liq0 <- liquidar(hogar, modo = "auto")
  cuota0 <- liq0$cuota_liquida_total
  recs <- list()

  add_rec <- function(id, titulo, detalle, cuota_nueva, reversible = TRUE, categoria = "general") {
    ahorro <- cuota0 - cuota_nueva
    if (ahorro > 0.5)
      recs[[length(recs) + 1]] <<- list(id = id, titulo = titulo, detalle = detalle,
        ahorro_anual = red2(ahorro), cuota_resultante = red2(cuota_nueva),
        reversible = reversible, categoria = categoria)
  }

  # --- 1. Tributación individual vs conjunta ---
  if (!is.na(liq0$comparativa$conjunta)) {
    mejor_modo <- if (liq0$comparativa$conjunta < liq0$comparativa$individual) "conjunta" else "individual"
    peor <- max(liq0$comparativa$individual, liq0$comparativa$conjunta)
    if (mejor_modo != "individual" || liq0$modo_tributacion_elegido != mejor_modo) {}
    add_rec("modo_tributacion",
            sprintf("Presentar declaración %s", mejor_modo),
            sprintf("Individual: %.2f € · Conjunta: %.2f €. El motor ya aplica la más favorable.",
                    liq0$comparativa$individual, liq0$comparativa$conjunta),
            min(liq0$comparativa$individual, liq0$comparativa$conjunta),
            categoria = "declaracion")
  }

  # --- 2. Aportación a plan de pensiones / EPSV: buscar el punto de saturación ---
  d1 <- declarantes(hogar)[[1]]
  fmt <- function(x) formatC(x, big.mark = ".", decimal.mark = ",", format = "d")
  simular_aporte <- function(paso) {
    h2 <- hogar; m <- h2$miembros
    idx <- which(vapply(m, function(x) x$id, character(1)) == d1$id)
    ps <- m[[idx]]$prevision_social %||% list(aportacion_individual = 0, contribucion_empresarial = 0)
    ps$aportacion_individual <- (ps$aportacion_individual %||% 0) + paso
    m[[idx]]$prevision_social <- ps; h2$miembros <- m
    liquidar(h2, modo = "auto")$cuota_liquida_total
  }
  pasos <- sort(unique(cfg$plan_pensiones_pasos))
  ahorros <- vapply(pasos, function(p) cuota0 - simular_aporte(p), numeric(1))
  if (max(ahorros) > 0.5) {
    # menor aportación que alcanza (casi) el ahorro máximo
    i_opt <- which(ahorros >= max(ahorros) - 0.5)[1]
    add_rec("plan_pensiones",
            sprintf("Aportar ~%s € a plan de pensiones / EPSV", fmt(pasos[i_opt])),
            sprintf("Ahorro fiscal %s €/año (marginal ~%.0f %%). Aportar por encima de %s € ya no reduce más la cuota este año (límite legal).",
                    fmt(round(ahorros[i_opt])), 100 * ahorros[i_opt] / pasos[i_opt], fmt(pasos[i_opt])),
            cuota0 - ahorros[i_opt], categoria = "prevision_social")
  }

  # --- 3. Traslado de residencia fiscal (top 3 territorios más baratos) ---
  if (isTRUE(cfg$incluir_traslado)) {
    comp <- comparar_territorios(hogar, territorios = setdiff(cfg$territorios, hogar$territorio))
    if (!is.null(comp) && nrow(comp)) {
      comp <- comp[order(comp$cuota_liquida_total), ]
      for (k in seq_len(min(3, nrow(comp)))) {
        top <- comp[k, ]
        add_rec(sprintf("traslado_%s", top$territorio),
                sprintf("Trasladar la residencia fiscal a %s", top$nombre),
                sprintf("Con la misma situación, la cuota sería %.2f € (frente a %.2f €). Requiere residencia efectiva > 183 días/año y centro de intereses económicos.",
                        top$cuota_liquida_total, cuota0),
                top$cuota_liquida_total, reversible = FALSE, categoria = "territorio")
      }
    }
  }

  # --- 4. Deducciones autonómicas a las que podría tener derecho y no está usando ---
  P <- cargar_parametros(hogar$territorio, hogar$ejercicio)
  da <- P$jurisdiccion$deducciones_autonomicas
  if (!is.null(da) && identical(da$estado, "cargado")) {
    for (ded in da$lista) {
      # simular que aporta el dato del campo si es de tipo importe
      if (identical(ded$tipo, "porcentaje_campo") && !is.null(ded$campo)) {
        ya <- sum(vapply(hogar$miembros, function(mm) mm[[ded$campo]] %||% 0, numeric(1)))
        if (ya == 0) {
          recs[[length(recs) + 1]] <- list(id = paste0("ded_", ded$id),
            titulo = sprintf("Revisar deducción autonómica: %s", gsub("_", " ", ded$id)),
            detalle = sprintf("Norma: %s. Si tienes gastos de '%s' y cumples los requisitos de renta/edad, deduce el %.0f %% (límite %s €).",
                              ded$norma %||% "", ded$campo, 100 * (ded$porcentaje %||% 0), ded[["limite"]] %||% "s/l"),
            ahorro_anual = NA_real_, cuota_resultante = NA_real_, reversible = TRUE, categoria = "deduccion_potencial")
        }
      }
    }
  }

  # Ordenar por ahorro (NA al final)
  recs <- recs[order(vapply(recs, function(r) -(r$ahorro_anual %||% -Inf), numeric(1)))]

  structure(list(
    cuota_actual = red2(cuota0),
    tipo_efectivo_actual = liq0$tipo_medio_efectivo,
    modo_actual = liq0$modo_tributacion_elegido,
    recomendaciones = recs,
    ahorro_maximo_combinable = red2(sum(vapply(
      Filter(function(r) !is.na(r$ahorro_anual) && r$categoria %in% c("prevision_social", "declaracion"),
             recs[!duplicated(vapply(recs, function(r) r$categoria, character(1)))]),
      function(r) r$ahorro_anual, numeric(1))))
  ), class = "irpfsim_optimizacion")
}

print.irpfsim_optimizacion <- function(x, ...) {
  cat(sprintf("<irpfsim_optimizacion> cuota actual %.2f € (tipo %.2f %%, %s)\n",
              x$cuota_actual, 100 * x$tipo_efectivo_actual, x$modo_actual))
  if (!length(x$recomendaciones)) { cat("  Sin palancas de ahorro identificadas.\n"); return(invisible(x)) }
  for (r in x$recomendaciones) {
    ah <- if (is.na(r$ahorro_anual)) "  (revisar)" else sprintf("−%.0f €/año", r$ahorro_anual)
    cat(sprintf("  [%s] %s  %s\n", r$categoria, r$titulo, ah))
    cat(sprintf("        %s\n", r$detalle))
  }
  invisible(x)
}
