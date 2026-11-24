# Traspaso a otra sesión (24-11-2026)

Si eres la sesión que sigue el trabajo, lee esto y después `CLAUDE.md`,
`docs/09_sesion_2026-11-23_github.md` y `docs/informe_para_chatgpt_2026-11-24.md`.

## Forma de trabajar

- Rama de trabajo nueva desde `main`. Una PR por bloque, y se fusiona cuando la CI está en verde.
- Después de fusionar, comprobar que «Publicar web» termina bien y que mapafiscal.es muestra el cambio.
- **Solo fuentes oficiales**: regla 0 de `CLAUDE.md`. Nada de despachos, editoriales, blogs ni prensa.
- Ningún dato personal del titular en la web ni en el código. El contacto es solo `contacto@mapafiscal.es`.
- No tocar Supabase, Stripe ni los ajustes del repositorio sin el OK explícito de Alex.
- No sacar páginas del sitemap y no ocultar los recuadros de anuncios.
- R en la nube: `apt-get install -y r-base-core r-cran-yaml r-cran-jsonlite r-cran-testthat`.
  Antes de cada `Rscript`: `export LANG=C.UTF-8 LC_ALL=C.UTF-8`.

## Trabajo a medias (parches en esta carpeta, sobre main 90f6ebb5)

Se aplican con `git apply -3 docs/traspaso/<nombre>.patch`. Después hay que regenerar:
`Rscript tools/exportar_params.R`, `Rscript tools/montar_validador.R`, `Rscript tools/generar_datos_seo.R`,
`node tools/generar_paginas_seo.mjs` (dos veces) y `node tools/generar_validacion.mjs`.
Luego se pasan todas las comprobaciones de `CLAUDE.md`.
**Ningún parche está terminado ni revisado: hay que revisarlo y completarlo antes de publicar.**

| Parche | Encargo | Estado aproximado |
|---|---|---|
| `cobertura.patch` | Poner al día `docs/02_cobertura.md`, generada desde los datos; página pública «Qué calcula y qué no»; avisos en la calculadora cuando el caso no está cubierto | Avanzado: estaba escribiendo docs/02 |
| `madrid-andalucia.patch` | Deducciones autonómicas que faltan en Madrid (hay 7 de unas 23) y Andalucía | Casi sin empezar |
| `cataluna-valencia.patch` | Deducciones que faltan en Cataluña y la Comunitat Valenciana | Solo comentarios: antes no había acceso a las fuentes oficiales |
| `navarra.patch` | Navarra: familia numerosa, conjunta foral, reducción propia del trabajo, donativos y 6 parámetros pendientes; sustituir Iberley y guiafiscal.es | A medias: iba por el capítulo X (cuota íntegra) |
| `fuentes-forales.patch` | Escala del PV 2025: citar BOB, BOTHA y BOG de cada territorio, no Gipuzkoa en los tres; quitar Cuatrecasas; test contra fuentes no oficiales; comprobar en el BOE el RDL 38/2026 (SMI e IRPF 2027) | A medias |

Fuentes no oficiales que aún quedan en `params/`:
- `params/2025/estatal.yaml` (~130, Iberley);
- `params/2025/navarra.yaml` (~9, ~28 y ~108: guiafiscal.es e Iberley);
- `params/2025/foral_pais_vasco.yaml` (~25, ~54 y ~129: Cuatrecasas).

## Pendiente de decisión de Alex

- **Reembolso parcial del informe:** ahora no revoca el informe.
- **Issue #29:** ¿se cierra? La parte de Google ya está hecha; faltan Microsoft y el correo.
- **AdSense:** la revisión se pidió el 24-11. Si la rechazan, hay que mirar el motivo en AdSense → Sitios.
- **Search Console:** revisarlo a mediados de diciembre con datos de 28 días.
- **Pagos:** para activarlos, seguir el orden de `docs/despliegue_stripe_webhook_reembolsos.md`. La migración va antes de `informePago`.
