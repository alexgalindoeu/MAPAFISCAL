# Runner: "/c/Program Files/R/R-4.3.3/bin/Rscript.exe" tests/testthat.R
library(testthat)
source("R/cargar.R"); irpfsim_cargar(".")
test_dir("tests/testthat", reporter = "summary")
