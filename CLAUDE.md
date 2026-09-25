# Mapafiscal: notas para Claude

- Proyecto en español: código, comentarios, commits, issues y PRs.
- Flujo: `git pull` de `main` antes de empezar; cada cambio en una rama nueva y con PR (nada directo a `main`).
- `web/js/irpfsim.js` es el port del motor R de referencia (`R/`) y debe dar los mismos resultados al céntimo. No cambies su lógica sin reflejar el mismo cambio en el motor R, o avisa de que la paridad queda pendiente.
- `web/datos/params.json` se genera desde `params/2025/*.yaml` con `Rscript tools/exportar_params.R`. No se edita a mano: la CI lo regenera y falla si no coincide. Todo parámetro nuevo lleva `norma`, `fuente` y `estado` (`confirmado`, `provisional` o `pendiente`).
- `web/index.html` delimita el cuerpo con `<!--CUERPO-->`/`<!--/CUERPO-->`. `tools/empaquetar.mjs` sustituye las etiquetas `<link>` y `<script src>` por su contenido, así que no cambies esas líneas sin actualizar el empaquetador.
- Comprobaciones: `npm test` y `npm run validar` (paridad R ↔ JS). Para ver la web: `npm run servir`, o `npm run empaquetar` y abrir `dist/mapafiscal.html`.

## Motor R de referencia

```bash
# en Windows, Rscript es "/c/Program Files/R/R-4.3.3/bin/Rscript.exe"
Rscript tests/testthat.R                     # tests del motor (todo en verde)
Rscript tests/smoke.R                        # salida legible de unos cuantos hogares
Rscript tools/exportar_params.R              # YAML -> web/datos/params.json
Rscript tools/exportar_params.R --comprobar  # lo que hace la CI
Rscript tools/montar_validador.R             # params + casos + tools/validar_js.html
node tools/validar_js_node.js                # mismo validador sin navegador
Rscript tools/generar_mapa.R                 # data/geo -> web/datos/mapa_es.json
Rscript tools/sincronizar_supabase.R         # params.json -> supabase/seed/ (catálogo)
```

Si cambias una regla en R: (1) haz el mismo cambio en `web/js/irpfsim.js`, (2) añade el
caso a `tools/validar_js.R`, (3) `Rscript tools/montar_validador.R` y abre
`tools/validar_js.html`: tiene que decir "VALIDADOR OK".

## Estructura

- `R/00..13_*.R` — motor (cargar con `source("R/cargar.R"); irpfsim_cargar(".")`).
- `params/<ejercicio>/*.yaml` — normativa, fuente única de los parámetros.
- `tests/` — tests R (testthat). `test/` — tests Node de la web y del motor JS.
- `tools/` — generadores (`*.R`), validador R ↔ JS, empaquetador y servidor de la web (`*.mjs`).
- `docs/` — diseño (`00`), cobertura (`02`), casos de validación paso a paso (`03`),
  arquitectura web (`04`) y registros de sesión.
- `supabase/` — migraciones SQL, Edge Functions (Stripe) y semilla del catálogo. Proyecto
  `mapafiscal` (ref `pqiqrcvuztxrwrwizppj`). Todo acceso a datos pasa por RLS; ninguna
  clave secreta va al repo.
- `inst/plumber/plumb.R` — API REST. `inst/shiny/app.R` — dashboard de reformas.

## Reglas del motor de deducciones

- En tributación individual de una pareja cada declarante se liquida en su ámbito: sus
  gastos y requisitos personales solo cuentan en su declaración; las deducciones
  familiares se reparten por defecto (`prorratea_progenitores: false` para excepciones).
- Reducción lineal por base: `taper_individual` / `taper_conjunta`. Variantes
  excluyentes: `grupo` (se aplica la mayor). Municipio: `municipio_hab_max/min`,
  `requiere_zona_despoblada`, `incremento_municipio`.

## Reglas al añadir normativa

1. Fuente primaria siempre (BOE / BOB / BOG / BOTHA / BON / boletín autonómico) o el
   Manual Práctico de Renta de la AEAT. Cítala en el YAML.
2. Si no puedes verificar un valor, `estado: pendiente` o `provisional` — no lo inventes.
3. Cada regla nueva → un test en `tests/testthat/` con el cálculo a mano en
   `docs/03_casos_validacion.md`, y un caso en `tools/validar_js.R`.
4. El motor no lleva cifras hardcodeadas: todo sale de `params/`.

## Commits

Terminar los mensajes de commit con la línea `Co-Authored-By:` de Claude.
