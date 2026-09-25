# =============================================================================
# Genera web/datos/mapa_es.json: el mapa de los 19 territorios fiscales como trazados
# SVG ya proyectados (sin dependencias en el navegador).
#
# Fuente geométrica: es-atlas 0.6.0 (MIT, © Martín González) sobre datos del
# Instituto Geográfico Nacional (CC BY 4.0) — data/geo/es-atlas-provinces.json.
# Proyección: cónica conforme de Lambert (paralelos 37° y 43°, origen 40° N 3° O);
# Canarias se proyecta aparte y se coloca en un recuadro al sureste (mar Mediterráneo).
# Ceuta, Melilla y Gibraltar se omiten (fuera del alcance de la herramienta).
# =============================================================================
topo <- jsonlite::fromJSON("data/geo/es-atlas-provinces.json", simplifyVector = FALSE)

PROV_TERR <- c(
  "01"="ES-PV-VI", "48"="ES-PV-BI", "20"="ES-PV-SS", "31"="ES-NC",
  "04"="ES-AN","11"="ES-AN","14"="ES-AN","18"="ES-AN","21"="ES-AN","23"="ES-AN","29"="ES-AN","41"="ES-AN",
  "22"="ES-AR","44"="ES-AR","50"="ES-AR", "33"="ES-AS", "07"="ES-IB", "35"="ES-CN","38"="ES-CN",
  "39"="ES-CB", "02"="ES-CM","13"="ES-CM","16"="ES-CM","19"="ES-CM","45"="ES-CM",
  "05"="ES-CL","09"="ES-CL","24"="ES-CL","34"="ES-CL","37"="ES-CL","40"="ES-CL","42"="ES-CL","47"="ES-CL","49"="ES-CL",
  "08"="ES-CT","17"="ES-CT","25"="ES-CT","43"="ES-CT", "06"="ES-EX","10"="ES-EX",
  "15"="ES-GA","27"="ES-GA","32"="ES-GA","36"="ES-GA", "28"="ES-MD", "30"="ES-MC", "26"="ES-RI",
  "03"="ES-VC","12"="ES-VC","46"="ES-VC")

# ---- decodificar arcos (cuantizados y en deltas) ----------------------------------
sc <- unlist(topo$transform$scale); tr <- unlist(topo$transform$translate)
arcos <- lapply(topo$arcs, function(a) {
  m <- do.call(rbind, lapply(a, unlist))
  m <- apply(m, 2, cumsum)
  if (is.null(dim(m))) m <- matrix(m, nrow = 1)
  cbind(m[, 1] * sc[1] + tr[1], m[, 2] * sc[2] + tr[2])
})
arco <- function(i) if (i >= 0) arcos[[i + 1]] else arcos[[-i]][nrow(arcos[[-i]]):1, , drop = FALSE]
anillo <- function(idx) {
  pts <- NULL
  for (k in seq_along(idx)) {
    a <- arco(idx[[k]])
    pts <- if (is.null(pts)) a else rbind(pts, a[-1, , drop = FALSE])
  }
  pts
}

# ---- proyección cónica conforme de Lambert --------------------------------------
rad <- pi / 180
phi1 <- 37 * rad; phi2 <- 43 * rad; phi0 <- 40 * rad; lam0 <- -3 * rad
n  <- log(cos(phi1) / cos(phi2)) / log(tan(pi/4 + phi2/2) / tan(pi/4 + phi1/2))
F_ <- cos(phi1) * tan(pi/4 + phi1/2)^n / n
rho0 <- F_ / tan(pi/4 + phi0/2)^n
lcc <- function(lon, lat) {
  rho <- F_ / tan(pi/4 + lat * rad / 2)^n
  th <- n * (lon * rad - lam0)
  cbind(rho * sin(th), -(rho0 - rho * cos(th)))        # y hacia abajo (SVG)
}

# ---- anillos por territorio -------------------------------------------------------
geoms <- topo$objects$provinces$geometries
anillos <- list()      # territorio -> lista de matrices proyectadas
uso_arcos <- list()    # índice de arco -> territorios que lo usan
for (g in geoms) {
  terr <- PROV_TERR[g$id]
  if (is.na(terr)) next
  polys <- if (g$type == "Polygon") list(g$arcs) else g$arcs
  for (p in polys) for (r in p) {
    idx <- unlist(r)
    pts <- anillo(idx)
    anillos[[terr]] <- c(anillos[[terr]], list(lcc(pts[, 1], pts[, 2])))
    for (i in idx) {
      key <- as.character(if (i >= 0) i else -i - 1)
      uso_arcos[[key]] <- unique(c(uso_arcos[[key]], terr))
    }
  }
}

# ---- recolocar Canarias en recuadro ------------------------------------------------
# Al 76 % y en la esquina inferior derecha (mar al sur de Baleares y al este de Murcia),
# el único hueco libre del lienzo que no se superpone a ningún territorio.
peninsula <- do.call(rbind, unlist(anillos[setdiff(names(anillos), "ES-CN")], recursive = FALSE))
canarias  <- do.call(rbind, anillos[["ES-CN"]])
bb_p <- apply(peninsula, 2, range); bb_c <- apply(canarias, 2, range)
s_can <- 0.76; margen <- 0.004
destino <- c(bb_p[2, 1] - margen - s_can * diff(bb_c[, 1]),   # borde derecho = el de la península
             bb_p[2, 2] - margen - s_can * diff(bb_c[, 2]))   # borde inferior = el de la península
mover <- function(m) cbind((m[, 1] - bb_c[1, 1]) * s_can + destino[1],
                           (m[, 2] - bb_c[1, 2]) * s_can + destino[2])
anillos[["ES-CN"]] <- lapply(anillos[["ES-CN"]], mover)
caja_can <- rbind(destino, destino + s_can * c(diff(bb_c[, 1]), diff(bb_c[, 2])))

# ---- escalar a viewBox --------------------------------------------------------------
todo <- do.call(rbind, unlist(anillos, recursive = FALSE))
bb <- apply(todo, 2, range)
W <- 1000; pad <- 12
k <- (W - 2 * pad) / diff(bb[, 1])
H <- ceiling(diff(bb[, 2]) * k + 2 * pad)
esc <- function(m) cbind((m[, 1] - bb[1, 1]) * k + pad, (m[, 2] - bb[1, 2]) * k + pad)

a_path <- function(m) {                                    # trazado relativo con enteros
  m <- round(esc(m))
  keep <- c(TRUE, rowSums(abs(diff(m))) > 0)
  m <- m[keep, , drop = FALSE]
  if (nrow(m) < 3) return("")
  d <- diff(m)
  paste0("M", m[1, 1], " ", m[1, 2], "l", paste(apply(d, 1, function(r) paste(r[1], r[2])), collapse = " "), "z")
}
paths <- lapply(anillos, function(rs) paste(vapply(rs, a_path, ""), collapse = ""))

# fronteras entre territorios distintos (arcos compartidos por >= 2 territorios)
fr_idx <- as.integer(names(Filter(function(t) length(t) >= 2, uso_arcos)))
fronteras <- paste(vapply(fr_idx, function(i) {
  m <- round(esc(lcc(arcos[[i + 1]][, 1], arcos[[i + 1]][, 2])))
  d <- diff(m)
  paste0("M", m[1, 1], " ", m[1, 2], "l", paste(apply(d, 1, function(r) paste(r[1], r[2])), collapse = " "))
}, ""), collapse = "")

# centro de etiqueta: centroide del anillo de mayor superficie
centro <- lapply(anillos, function(rs) {
  area <- vapply(rs, function(m) { x <- m[, 1]; y <- m[, 2]; abs(sum(x * c(y[-1], y[1]) - c(x[-1], x[1]) * y)) / 2 }, 0)
  m <- esc(rs[[which.max(area)]])
  round(colMeans(m))
})
cc <- round(esc(caja_can))
# escuadra en los lados izquierdo y superior del recuadro
recuadro <- sprintf("M%d %dL%d %dL%d %d", cc[1, 1] - 14, cc[2, 2] + 6, cc[1, 1] - 14, cc[1, 2] - 12, cc[2, 1] + 6, cc[1, 2] - 12)

out <- list(
  fuente = "es-atlas 0.6.0 (MIT) sobre datos del Instituto Geográfico Nacional (CC BY 4.0); proyección cónica conforme de Lambert",
  viewBox = c(0, 0, W, H),
  territorios = paths,
  fronteras = fronteras,
  recuadroCanarias = recuadro,
  centros = centro
)
writeLines(jsonlite::toJSON(out, auto_unbox = TRUE), "web/datos/mapa_es.json")
cat(sprintf("mapa_es.json: %d territorios, %d fronteras, viewBox %dx%d, %s bytes\n",
            length(paths), length(fr_idx), W, H, format(file.size("web/datos/mapa_es.json"), big.mark = " ")))
