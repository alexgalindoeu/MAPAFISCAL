# =============================================================================
# irpfsim :: deducciones de la cuota (régimen común)
# =============================================================================

# Deducciones estatales sobre la cuota íntegra (art. 68 y DDTT).
# Devuelve $total_estatal y $total_autonomico (parte de tramo autonómico).
deducciones_estatales <- function(hogar, P, rentas, base_liquidable_total, personas = hogar$miembros) {
  e <- P$estatal
  det <- list()
  tot_est <- 0; tot_aut <- 0

  # Donativos y vivienda: gastos propios de las personas del ámbito liquidado
  # (en individual, solo los del declarante; en conjunta, los de la unidad familiar).
  donativos <- 0
  for (m in personas) donativos <- donativos + (m$donativos %||% 0)
  if (donativos > 0) {
    d <- e$deduccion_donativos$ley49_2002
    ded <- min(donativos, d$tramo1_limite) * d$tramo1_porcentaje +
      max(0, donativos - d$tramo1_limite) * d$resto_porcentaje
    tope <- base_liquidable_total * d$limite_base_liquidable_pct
    ded <- min(ded, tope)
    det$donativos <- red2(ded)
    tot_est <- tot_est + ded / 2   # reparto 50/50 (simplificado)
    tot_aut <- tot_aut + ded / 2
  }

  # Vivienda habitual — régimen transitorio (adquisición anterior a 2013)
  viv <- 0
  for (m in personas) viv <- viv + (m$vivienda_transitoria_pagos %||% 0)
  if (viv > 0) {
    dv <- e$deduccion_vivienda_transitoria
    base <- min(viv, dv$base_maxima)
    ded_est <- base * dv$porcentaje_estatal
    ded_aut <- base * dv$porcentaje_autonomico_defecto
    det$vivienda_transitoria <- red2(ded_est + ded_aut)
    tot_est <- tot_est + ded_est
    tot_aut <- tot_aut + ded_aut
    registrar_aviso("Deducción por vivienda habitual (transitoria): estado PROVISIONAL.")
  }

  list(detalle = det, total_estatal = red2(tot_est), total_autonomico = red2(tot_aut))
}

# Deducciones autonómicas (tramo autonómico) — motor genérico dirigido por datos.
#
# Cada entrada de `deducciones_autonomicas$lista` en params/2025/autonomico.yaml:
#   id, norma, tipo, y campos según el tipo:
#     tipo: "porcentaje_campo"      -> porcentaje * sum(miembros[[campo]]); tope `limite`
#     tipo: "porcentaje_campo_hijo" -> lo anterior, por cada descendiente que cumpla `edad_hijo_max`
#     tipo: "fija_por_hijo_nacido"  -> `importe` por descendiente nacido en el ejercicio
#                                      (age <= `anios_ventana`-1); `importe_multiple` si parto múltiple
#     tipo: "fija"                  -> `importe` (una vez)
#   Puertas comunes (todas opcionales):
#     base_max_individual, base_max_conjunta, base_max_unidad_familiar,
#     edad_max, edad_min, requiere_familia_numerosa (TRUE/"especial"),
#     prorratea_progenitores (TRUE -> /2 en individual con 2 declarantes),
#     requiere_desempleo (algún declarante con `desempleado: TRUE`),
#     requiere_progenitores_trabajan (todos los declarantes con trabajo o actividad)
#   Modificadores:
#     taper_individual / taper_conjunta: [desde, hasta] -> reducción lineal del importe
#       (o del `limite` en las porcentuales) cuando la base está entre ambos umbrales
#     grupo: variantes excluyentes de una misma deducción; solo se aplica la mayor
deducciones_autonomicas <- function(hogar, P, rentas, modo = "individual", base_total = 0,
                                    cuota_integra_autonomica = NA_real_, minimo = 0,
                                    declarante_id = NULL) {
  da <- P$jurisdiccion$deducciones_autonomicas
  if (is.null(da) || identical(da$estado, "pendiente") ||
      !length(da$lista %||% list())) {
    if (!identical(da$estado, "cargado"))
      registrar_aviso(sprintf("[%s] deducciones autonómicas no cargadas: cuota autonómica sin minorar.",
                              P$meta$territorio))
    return(list(detalle = list(), total = 0, estado = da$estado %||% "pendiente"))
  }

  es_conj <- modo == "conjunta"
  n_prog  <- length(declarantes(hogar))
  base_ind <- base_total
  base_uf  <- base_total   # aproximación: base del ámbito liquidado (ver docs/02_cobertura §5.4)
  desc <- descendientes(hogar)

  # Ámbito personal: en individual, el declarante que se liquida; en conjunta, todos.
  # Los requisitos personales (edad, discapacidad) se exigen a esa(s) persona(s): en
  # conjunta basta con que los cumpla uno de los cónyuges.
  decs <- declarantes(hogar)
  ambito <- if (es_conj || is.null(declarante_id)) decs else Filter(function(p) identical(p$id, declarante_id), decs)
  if (!length(ambito)) ambito <- decs[1]
  ids_ambito <- vapply(ambito, function(p) p$id %||% "", character(1))
  ind_compartido <- !es_conj && n_prog > 1      # individual con dos progenitores

  # `g(d, k)` accede a `d[[k]]` con coincidencia EXACTA (evita el partial matching de `$`,
  # p. ej. d$limite resolviendo a d$limite_pct_cuota_autonomica).
  g <- function(d, k) d[[k]]

  pasa_personales <- function(d, p) {
    edad <- p$edad %||% 40
    disc <- !identical(p$discapacidad %||% "no", "no")
    dg <- g(d, "requiere_discapacidad_grado")
    if (!is.null(dg) && !identical(p$discapacidad %||% "no", dg)) return(FALSE)
    if (!is.null(g(d,"edad_max")) && !is.null(g(d,"edad_min_alt"))) {
      if (edad >= g(d,"edad_max") && edad < g(d,"edad_min_alt") && !disc) return(FALSE)
    } else {
      if (!is.null(g(d,"edad_max")) && edad >= g(d,"edad_max")) return(FALSE)
      if (!is.null(g(d,"edad_min")) && edad <  g(d,"edad_min")) return(FALSE)
    }
    if (isTRUE(g(d,"requiere_discapacidad_contribuyente")) && !disc) return(FALSE)
    TRUE
  }

  # Deducciones familiares: en individual con dos progenitores se reparten por mitades
  # (regla general de las leyes autonómicas). `prorratea_progenitores: false` lo impide.
  es_familiar <- function(d) {
    tipo <- g(d, "tipo")
    tipo %in% c("fija_por_hijo", "fija_por_hijo_nacido", "porcentaje_campo_hijo", "fija_por_ascendiente") ||
      (identical(tipo, "fija") && (!is.null(g(d,"requiere_familia_numerosa")) ||
         !is.null(g(d,"familia_numerosa_categoria")) || isTRUE(g(d,"requiere_monoparental")) ||
         !is.null(g(d,"descendientes_min")) || isTRUE(g(d,"requiere_dependiente_a_cargo")) ||
         isTRUE(g(d,"requiere_familiar_discapacidad_65")) || isTRUE(g(d,"requiere_parto_multiple"))))
  }
  prorratea <- function(d) {
    pp <- g(d, "prorratea_progenitores")
    if (is.null(pp)) es_familiar(d) else isTRUE(pp)
  }

  pasa_puertas <- function(d) {
    b <- if (identical(g(d,"base_gate"), "menos_minimo")) max(0, base_total - minimo) else base_ind
    if (!is.null(g(d,"base_max_individual")) && !es_conj && b > g(d,"base_max_individual")) return(FALSE)
    if (!is.null(g(d,"base_max_conjunta"))   &&  es_conj && b > g(d,"base_max_conjunta"))   return(FALSE)
    if (!is.null(g(d,"base_min_individual")) && !es_conj && b < g(d,"base_min_individual")) return(FALSE)
    if (!is.null(g(d,"base_min_conjunta"))   &&  es_conj && b < g(d,"base_min_conjunta"))   return(FALSE)
    if (!is.null(g(d,"base_max_unidad_familiar")) && base_uf > g(d,"base_max_unidad_familiar")) return(FALSE)
    nd <- length(desc)
    if (!is.null(g(d,"descendientes_min")) && nd < g(d,"descendientes_min")) return(FALSE)
    if (!is.null(g(d,"descendientes_max")) && nd > g(d,"descendientes_max")) return(FALSE)
    if (!is.null(g(d,"descendiente_edad_max")) &&
        !any(vapply(desc, function(h) (h$edad %||% 99) <= g(d,"descendiente_edad_max"), logical(1))))
      return(FALSE)
    if (!any(vapply(ambito, function(p) pasa_personales(d, p), logical(1)))) return(FALSE)
    rfn <- g(d,"requiere_familia_numerosa")
    if (!is.null(rfn)) {
      if (identical(rfn, "especial") && hogar$familia_numerosa != "especial") return(FALSE)
      if (isTRUE(rfn) && hogar$familia_numerosa == "no") return(FALSE)
    }
    fnc <- g(d, "familia_numerosa_categoria")   # coincidencia EXACTA de categoría
    if (!is.null(fnc)) {
      cat_h <- if (hogar$familia_numerosa == "especial") "especial"
               else if (hogar$familia_numerosa != "no") "general" else "no"
      if (!identical(cat_h, fnc)) return(FALSE)
    }
    if (isTRUE(g(d,"requiere_monoparental")) && hogar$tipo_unidad_familiar != "monoparental") return(FALSE)
    if (isTRUE(g(d,"requiere_dependiente_a_cargo"))) {
      # persona dependiente = ascendiente >= 75 años, o ascendiente/descendiente con
      # grado de discapacidad >= 65 % ("65_mas"), cualquiera que sea su edad.
      asc <- ascendientes(hogar)
      hay_dep <- any(vapply(asc, function(p) (p$edad %||% 0) >= 75, logical(1))) ||
        any(vapply(c(asc, desc), function(p)
          identical(p$discapacidad %||% "no", "65_mas"), logical(1)))
      if (!hay_dep) return(FALSE)
    }
    if (isTRUE(g(d,"requiere_familiar_discapacidad_65"))) {
      hay <- any(vapply(c(ascendientes(hogar), desc), function(p)
        identical(p$discapacidad %||% "no", "65_mas"), logical(1)))
      if (!hay) return(FALSE)
    }
    if (isTRUE(g(d,"requiere_parto_multiple")) && !isTRUE(hogar$parto_multiple)) return(FALSE)
    # municipio de residencia: población máxima y/o lista oficial de zonas despobladas
    mh <- g(d, "municipio_hab_max")
    if (!is.null(mh) && (is.null(hogar$municipio_habitantes) || hogar$municipio_habitantes > mh)) return(FALSE)
    if (isTRUE(g(d, "requiere_zona_despoblada")) && !isTRUE(hogar$zona_despoblada)) return(FALSE)
    if (isTRUE(g(d, "excluye_zona_despoblada")) && isTRUE(hogar$zona_despoblada)) return(FALSE)
    mhm <- g(d, "municipio_hab_min")          # variante "general" que excluye a los municipios pequeños
    if (!is.null(mhm) && !is.null(hogar$municipio_habitantes) && hogar$municipio_habitantes < mhm) return(FALSE)
    # algún progenitor/declarante en desempleo e inscrito como demandante de empleo
    if (isTRUE(g(d,"requiere_desempleo")) &&
        !any(vapply(declarantes(hogar), function(p) isTRUE(p$desempleado), logical(1)))) return(FALSE)
    # todos los progenitores que conviven obtienen rendimientos del trabajo o de actividades
    if (isTRUE(g(d,"requiere_progenitores_trabajan")) &&
        !all(vapply(declarantes(hogar), function(p) !is.null(p$trabajo) || !is.null(p$actividades),
                    logical(1)))) return(FALSE)
    TRUE
  }

  # Reducción lineal ("taper") del importe o del límite cuando la base está entre dos
  # umbrales: factor = 1 − (b − desde) / (hasta − desde), acotado a [0, 1].
  # YAML: taper_individual: [desde, hasta]; taper_conjunta: [desde, hasta].
  factor_taper <- function(d) {
    tp <- if (es_conj) g(d, "taper_conjunta") else g(d, "taper_individual")
    if (is.null(tp)) return(1)
    tp <- unlist(tp)
    b <- if (identical(g(d,"base_gate"), "menos_minimo")) max(0, base_total - minimo) else base_ind
    if (b <= tp[1]) return(1)
    max(0, min(1, 1 - (b - tp[1]) / (tp[2] - tp[1])))
  }

  # Candidatos de la 1ª pasada; `grupo` agrupa variantes excluyentes de una misma
  # deducción (p. ej. alquiler general / joven / discapacidad): se aplica la mayor.
  cand <- list()
  for (d in da$lista) {
    if (!pasa_puertas(d)) next
    tipo <- g(d, "tipo"); val <- 0
    porc <- g(d, "porcentaje") %||% 0
    lim  <- if (es_conj && !is.null(g(d, "limite_conjunta"))) g(d, "limite_conjunta") else g(d, "limite")
    campo <- g(d, "campo") %||% ""
    ft <- factor_taper(d)
    taper_en_limite <- tipo %in% c("porcentaje_campo", "porcentaje_campo_hijo") && !is.null(lim)
    if (taper_en_limite) lim <- lim * ft

    if (identical(tipo, "fija")) {
      val <- g(d, "importe") %||% 0

    } else if (identical(tipo, "porcentaje_campo")) {
      # gasto propio de las personas del ámbito; el que figura en hijos/ascendientes se
      # reparte entre los progenitores en individual
      base <- sum(vapply(hogar$miembros, function(m) {
        v <- m[[campo]] %||% 0
        es_decl <- (m$rol %||% "") %in% c("declarante", "conyuge")
        if (es_decl) { if ((m$id %||% "") %in% ids_ambito) v else 0 }
        else if (ind_compartido) v / n_prog else v
      }, numeric(1)))
      if (!is.null(g(d,"base_maxima"))) base <- min(base, g(d,"base_maxima"))
      val <- base * porc
      if (!is.null(lim)) val <- min(val, lim)
      tpc <- g(d, "limite_pct_cuota_autonomica")
      if (!is.null(tpc) && !is.na(cuota_integra_autonomica))
        val <- min(val, cuota_integra_autonomica * tpc)

    } else if (identical(tipo, "porcentaje_campo_hijo")) {
      for (h in desc) {
        if (!is.null(g(d,"edad_hijo_max")) && (h$edad %||% 99) > g(d,"edad_hijo_max")) next
        v <- (h[[campo]] %||% 0) * porc
        if (!is.null(lim)) v <- min(v, lim)
        val <- val + v
      }

    } else if (identical(tipo, "fija_por_hijo_nacido")) {
      ventana <- (g(d,"anios_ventana") %||% 1)
      es_nacido <- function(h) (h$edad %||% 99) <= ventana - 1 || isTRUE(h$nacido_en_ejercicio)
      nacidos <- Filter(es_nacido, desc)
      ipo <- g(d, "importes_por_orden")
      if (!is.null(ipo)) {
        ord <- order(vapply(desc, function(h) -(h$edad %||% 0), numeric(1)))
        for (k in seq_along(desc)) if (es_nacido(desc[[ord[k]]])) {
          key <- if (k <= 2) as.character(k) else "3+"
          val <- val + (ipo[[key]] %||% ipo[["3+"]] %||% 0)
        }
      } else {
        imp_h <- if (es_conj && !is.null(g(d,"importe_conjunta"))) g(d,"importe_conjunta") else (g(d,"importe") %||% 0)
        val <- length(nacidos) * imp_h
        if (isTRUE(hogar$parto_multiple)) val <- val + (g(d,"importe_multiple") %||% imp_h)
      }

    } else if (identical(tipo, "fija_por_hijo")) {
      hh <- Filter(function(h) (is.null(g(d,"edad_hijo_min")) || (h$edad %||% 99) >= g(d,"edad_hijo_min")) &&
                               (is.null(g(d,"edad_hijo_max")) || (h$edad %||% 99) <= g(d,"edad_hijo_max")), desc)
      val <- length(hh) * (g(d,"importe") %||% 0)

    } else if (identical(tipo, "fija_por_ascendiente")) {
      asc <- ascendientes(hogar)
      cuenta <- sum(vapply(asc, function(a)
        (a$edad %||% 0) >= (g(d,"edad_ascendiente_min") %||% 65) ||
        !identical(a$discapacidad %||% "no", "no"), logical(1)))
      val <- cuenta * (g(d,"importe") %||% 0)
    }

    if (!taper_en_limite) val <- val * ft
    # incremento por residir en un municipio pequeño (p. ej. +20 % en Galicia, < 5.000 hab.)
    fm <- g(d, "incremento_municipio")
    if (!is.null(fm) && !is.null(hogar$municipio_habitantes) && hogar$municipio_habitantes <= fm$hab_max)
      val <- val * fm$factor
    if (prorratea(d) && ind_compartido) val <- val / n_prog
    if (val > 0) cand[[length(cand) + 1]] <- list(id = g(d,"id") %||% "ded", val = val,
                                                  grupo = g(d, "grupo"))
  }

  total <- 0; det <- list()
  for (k in seq_along(cand)) {
    cc <- cand[[k]]
    if (!is.null(cc$grupo)) {
      rivales <- Filter(function(x) identical(x$grupo, cc$grupo), cand)
      mejor <- which.max(vapply(rivales, function(x) x$val, numeric(1)))
      if (!identical(rivales[[mejor]]$id, cc$id)) next
    }
    det[[cc$id]] <- red2(cc$val); total <- total + cc$val
  }

  # Segunda pasada: deducciones como % de la cuota íntegra autonómica.
  # Por defecto sobre la cuota ya minorada por las deducciones anteriores; con
  # `sobre_cuota_integra: true` sobre la cuota íntegra autonómica completa.
  if (!is.na(cuota_integra_autonomica)) {
    base_cuota <- max(0, cuota_integra_autonomica - total)
    for (d in da$lista) {
      if (!identical(g(d,"tipo"), "porcentaje_cuota_autonomica")) next
      if (!pasa_puertas(d)) next
      if (!is.null(g(d,"min_descendientes")) && length(desc) < g(d,"min_descendientes")) next
      b <- if (isTRUE(g(d,"sobre_cuota_integra"))) max(0, cuota_integra_autonomica) else base_cuota
      val <- b * (g(d,"porcentaje") %||% 0)
      lim <- if (es_conj && !is.null(g(d,"limite_conjunta"))) g(d,"limite_conjunta") else g(d,"limite")
      if (!is.null(lim)) val <- min(val, lim)
      val <- val * factor_taper(d)
      if (val > 0) { det[[g(d,"id") %||% "ded"]] <- red2(val); total <- total + val }
    }
  }

  list(detalle = det, total = red2(total), estado = "cargado")
}

# Deducciones "impropias" (art. 81 y 81 bis): maternidad, familia numerosa,
# discapacidad de familiares a cargo. Pueden generar devolución.
deducciones_impropias <- function(hogar, P, rentas, modo = "conjunta", declarante_id = NULL) {
  e <- P$estatal
  det <- list(); total <- 0
  decs <- declarantes(hogar)
  n_prog <- length(decs)
  ind_compartido <- modo != "conjunta" && n_prog > 1 && !is.null(declarante_id)
  trabaja <- function(m) !is.null(m$trabajo) || !is.null(m$actividades)

  # Maternidad (art. 81): corresponde a la madre que trabaja. El motor no registra el
  # sexo: en individual se atribuye al primer progenitor con actividad (una sola vez).
  hijos_menores_3 <- sum(vapply(descendientes(hogar), function(d) d$edad < 3, logical(1)))
  madre_trabaja <- if (ind_compartido) {
    titular <- Filter(trabaja, decs)
    length(titular) > 0 && identical(titular[[1]]$id, declarante_id)
  } else any(vapply(decs, trabaja, logical(1)))
  if (hijos_menores_3 > 0 && madre_trabaja) {
    dm <- e$deduccion_maternidad
    val <- hijos_menores_3 * dm$importe_anual
    guarderia <- sum(vapply(hogar$miembros, function(m) m$gastos_guarderia %||% 0, numeric(1)))
    if (guarderia > 0) val <- val + min(guarderia, dm$incremento_guarderia * hijos_menores_3)
    det$maternidad <- red2(val); total <- total + val
    registrar_aviso("Deducción por maternidad: estado PROVISIONAL.")
  }

  # Familia numerosa
  if (hogar$familia_numerosa != "no") {
    df <- e$deduccion_familia_numerosa_y_discapacidad_cargo
    val <- if (hogar$familia_numerosa == "especial") df$familia_numerosa_especial
           else df$familia_numerosa_general
    n_desc <- length(descendientes(hogar))
    umbral <- if (hogar$familia_numerosa == "especial") 6 else 4
    if (n_desc > umbral) val <- val + (n_desc - umbral + 1) * df$incremento_por_hijo_adicional
    if (ind_compartido) val <- val / n_prog     # art. 81 bis.3: prorrateo por partes iguales
    det$familia_numerosa <- red2(val); total <- total + val
  }

  # Discapacidad de ascendiente/descendiente a cargo
  n_disc_fam <- sum(vapply(c(descendientes(hogar), ascendientes(hogar)),
                           function(p) p$discapacidad != "no", logical(1)))
  if (n_disc_fam > 0) {
    df <- e$deduccion_familia_numerosa_y_discapacidad_cargo
    val <- n_disc_fam * df$ascendiente_o_descendiente_discapacidad
    if (ind_compartido) val <- val / n_prog
    det$discapacidad_familiares_cargo <- red2(val); total <- total + val
  }

  list(detalle = det, total = red2(total))
}
