# Regla 0 de CLAUDE.md: en params/ solo se citan fuentes oficiales (BOE, boletines
# autonómicos y forales, AEAT, Haciendas forales y webs de los gobiernos). Este test falla si
# algún YAML de params/ nombra una fuente no oficial conocida: despachos, editoriales
# jurídicas, gestoras, asociaciones del sector, blogs u otras calculadoras. Mira el texto
# entero del fichero (valores y comentarios), sin distinguir mayúsculas.

NO_OFICIALES <- c(
  "Iberley", "guiafiscal", "Cuatrecasas", "Garrigues", "Wolters", "Lefebvre", "Aranzadi",
  "vLex", "Deloitte", "KPMG", "PwC", "BBVA AM", "INVERCO",
  "Cinco Días", "idealista", "Rankia", "TaxDown", "elEconomista", "Infoautónomos"
)

test_that("params/ no cita fuentes no oficiales", {
  # La opción puede ser relativa (irpfsim_cargar(".")) y testthat cambia el directorio de
  # trabajo a tests/testthat: se busca params/ hacia arriba si no está donde dice la opción.
  dir_params <- getOption("irpfsim.params_dir")
  for (cand in c(dir_params, file.path("..", "..", "params"), file.path("..", "params")))
    if (!is.null(cand) && dir.exists(cand)) { dir_params <- cand; break }
  expect_true(dir.exists(dir_params))
  ficheros <- list.files(dir_params, pattern = "\\.ya?ml$", recursive = TRUE, full.names = TRUE)
  expect_gt(length(ficheros), 0)
  hallazgos <- character()
  for (f in ficheros) {
    lineas <- readLines(f, encoding = "UTF-8", warn = FALSE)
    for (n in NO_OFICIALES) {
      i <- grep(n, lineas, ignore.case = TRUE, fixed = FALSE)
      if (length(i)) hallazgos <- c(hallazgos, sprintf("%s/%s:%d cita «%s»", basename(dirname(f)), basename(f), i, n))
    }
  }
  expect(length(hallazgos) == 0,
         paste0("Fuentes no oficiales en params/ (regla 0 de CLAUDE.md):\n", paste(hallazgos, collapse = "\n")))
})
