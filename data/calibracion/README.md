# Datos de calibración de la muestra sintética

`objetivos_territorio.csv` contiene, por territorio de residencia fiscal, los
**marginales objetivo** a los que se calibra la muestra sintética:

| columna | significado |
|---|---|
| `renta_bruta_media` | renta bruta media anual del declarante |
| `gini_renta_bruta` | índice de Gini de la renta bruta |
| `n_declarantes` | nº de declarantes (para el peso poblacional de cada hogar sintético) |

## Estado actual de los valores

- `fuente_estado = AEAT_2023`: **renta bruta media y nº de titulares verificados** contra la
  *Estadística de los declarantes del IRPF por municipios 2023* de la AEAT (11 territorios:
  AN, AR, AS, IB, CB, EX, MD, MC, CE, ML; CT desde la *Estadística de declarantes*, «renta bruta sujeta»).
- `fuente_estado = ESTIMADO` / `ESTIMADO_foral`: **valores aproximados pendientes de verificar**
  (CN, CM, CL, GA, RI, VC; y los 3 TH vascos + Navarra, que no aparecen en la AEAT).
- El `gini_renta_bruta` es en todos los casos un valor de orden de magnitud pendiente de calcular
  con microdatos.

## Fuentes para completar / sustituir:

- **CCAA de régimen común (15):**
  AEAT — *Estadística de los declarantes del IRPF* por CCAA y por tramo de base imponible.
  https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Estadistica_de_los_declarantes_del_IRPF.shtml
  Además: INE — *Renta media por hogar/persona* (Atlas de distribución de renta) y ECV.

- **Territorios Históricos vascos:** estadísticas de IRPF de las Haciendas Forales
  (Diputaciones de Bizkaia, Gipuzkoa, Araba) y del Órgano de Coordinación Tributaria.

- **Navarra:** *Estadística del IRPF* de la Hacienda Foral de Navarra (Hacienda Tributaria de Navarra).

## Mejora prevista (hito H5)

Pasar de la calibración a 2 momentos (media + Gini de una lognormal) a:
- calibración a la **distribución completa por tramos** (raking / GREG a los recuentos de
  declarantes por tramo de base imponible y por fuente de renta), y/o
- **reconstrucción sintética** a partir de la *Muestra IEF-AEAT de declarantes de IRPF*
  si se obtiene acceso.
