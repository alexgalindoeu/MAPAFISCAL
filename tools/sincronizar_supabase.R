# =============================================================================
# Sincroniza el catálogo normativo con Supabase (tablas de lectura pública).
# La fuente de verdad sigue siendo params/<ejercicio>/*.yaml; aquí solo se copia.
#
#   Rscript tools/sincronizar_supabase.R
#
# Escribe:
#   supabase/seed/catalogo_<ejercicio>.sql   — SQL autónomo e idempotente (para el SQL
#                                              editor o `supabase db execute`)
#   supabase/seed/partes/params_<n>.txt      — el params.json troceado + MD5 de cada
#                                              trozo, para cargas vía API/MCP con límite
#                                              de tamaño (ver supabase/README.md)
#
# El SQL deriva territorios, deducciones y pendientes del propio params.json, así el
# catálogo en la base de datos no puede desincronizarse del motor JS.
# =============================================================================
source("R/cargar.R"); irpfsim_cargar(".")
source("tools/exportar_params.R")          # refresca web/datos/params.json

ejercicio <- 2025L
params_json <- as.character(jsonlite::minify(paste(readLines("web/datos/params.json", warn = FALSE, encoding = "UTF-8"), collapse = "\n")))
commit <- tryCatch(system("git rev-parse --short HEAD", intern = TRUE), error = function(e) NA_character_)
stopifnot(!grepl("$mf$", params_json, fixed = TRUE))

# SQL que, dado `p.params` (jsonb), rellena el catálogo del ejercicio.
sql_derivar <- function(fuente_params) sprintf("
with p as (select %s as params)
insert into public.territorios (codigo, nombre, regimen)
select t.key, t.value->>'nombre', t.value->>'regimen'
from p, jsonb_each(p.params->'territorios') t
on conflict (codigo) do update set nombre = excluded.nombre, regimen = excluded.regimen;

delete from public.ejercicios where ejercicio = %d;   -- cascada a deducciones y pendientes

insert into public.ejercicios (ejercicio, generado, motor_version, params)
select %d, (params->>'generado')::date, %s, params from (select %s as params) p;

insert into public.deducciones (ejercicio, territorio, id, norma, tipo, estado, definicion)
select e.ejercicio, t.key, d->>'id', d->>'norma', d->>'tipo', coalesce(d->>'estado', 'confirmado'), d
from public.ejercicios e,
     jsonb_each(e.params->'territorios') t,
     jsonb_array_elements(coalesce(t.value->'deducciones_autonomicas'->'lista', '[]'::jsonb)) d
where e.ejercicio = %d;

insert into public.deducciones_pendientes (ejercicio, territorio, id)
select e.ejercicio, t.key, pend #>> '{}'
from public.ejercicios e,
     jsonb_each(e.params->'territorios') t,
     jsonb_array_elements(coalesce(t.value->'deducciones_autonomicas'->'pendientes', '[]'::jsonb)) pend
where e.ejercicio = %d and jsonb_typeof(pend) = 'string' and left(pend #>> '{}', 1) <> '('
on conflict do nothing;
", fuente_params, ejercicio, ejercicio, if (is.na(commit)) "null" else sprintf("'%s'", commit),
   fuente_params, ejercicio, ejercicio)

dir.create("supabase/seed/partes", recursive = TRUE, showWarnings = FALSE)

# 1) SQL autónomo
lit_json <- paste0("$mf$", params_json, "$mf$::jsonb")
sql <- c("-- Generado por tools/sincronizar_supabase.R — no editar a mano.",
         sprintf("-- Ejercicio %d · commit %s", ejercicio, commit),
         "begin;", sql_derivar(lit_json), "commit;")
out <- sprintf("supabase/seed/catalogo_%d.sql", ejercicio)
writeLines(sql, out, useBytes = TRUE)

# 2) Trozos del params.json (para APIs con límite de tamaño) + manifiesto MD5
unlink(list.files("supabase/seed/partes", full.names = TRUE))
tam <- 18000L
n <- ceiling(nchar(params_json) / tam)
manif <- character()
for (k in seq_len(n)) {
  trozo <- substr(params_json, (k - 1) * tam + 1, k * tam)
  f <- sprintf("supabase/seed/partes/params_%02d.txt", k)
  con <- file(f, "wb"); writeBin(charToRaw(enc2utf8(trozo)), con); close(con)
  manif <- c(manif, sprintf("%02d %s %d", k, unname(tools::md5sum(f)), nchar(trozo)))
}
writeLines(manif, "supabase/seed/partes/MD5")
writeLines(sql_derivar("(select string_agg(texto, '' order by parte) from privado.carga_params)::jsonb"),
           "supabase/seed/partes/derivar.sql", useBytes = TRUE)

cat(sprintf("%s (%s bytes) · params.json en %d trozos · commit %s\n",
            out, format(file.size(out), big.mark = " "), n, commit))
