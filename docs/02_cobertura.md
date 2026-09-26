# Cobertura del motor `irpfsim` — estado a 2026-09-25

Leyenda: ✅ implementado y con parámetros verificados · 🟡 implementado con parámetros
provisionales o parciales · ⛔ pendiente (hook presente, no calcula).

## 1. Motor de cálculo

| Componente | Común (Estado + 15 CCAA) | País Vasco (3 TH) | Navarra |
|---|---|---|---|
| Escala general (tarifa) | ✅ | ✅ | ✅ |
| Escala del ahorro | ✅ | ✅ (2025 y 2026) | ✅ |
| Rendimientos del trabajo (art. 19: íntegro − gastos) | ✅ | ✅ | ✅ |
| Reducción del trabajo | ✅ art. 20 (2025), cuantía sobre íntegro − gastos a) a e) | ✅ bonificación art. 23 | 🟡 usa art. 20 provisional |
| Deducción por obtención de rendimientos del trabajo (DA 61.ª, Ley 5/2025) | ✅ importes y requisitos · 🟡 límite proporcional con otras rentas y en conjunta | — | — |
| Capital inmobiliario + reducción arrendamiento | 🟡 (%s reforma vivienda por confirmar) | 🟡 modelo foral 20 % | 🟡 |
| Capital mobiliario (ahorro/general) | ✅ | ✅ + exención 1.500 € art. 9.24 | ✅ |
| Actividades — estimación directa (normal/simplificada) | ✅ | ✅ | ✅ |
| Actividades — estimación objetiva (módulos) | ⛔ entra como `rendimiento_neto_modulos` exógeno | ⛔ | ⛔ |
| Ganancias/pérdidas patrimoniales | ✅ | ✅ | ✅ |
| Régimen transitorio DT 9ª (pre-1994) | ✅ | 🟡 (coef. iguales a estatal) | 🟡 |
| Coeficientes de actualización de inmuebles | ✅ (suprimidos) | ⛔ tabla anual pendiente | ⛔ |
| Integración y compensación (arts. 47–49) | ✅ (límites 25 %) | ✅ (reglas estatales) | ✅ (reglas estatales) |
| Reducciones de base (previsión social, p. compensatorias) | ✅ previsión social por partícipe (1.500 € + 8.500 € empresariales, 30 % del rendimiento del art. 19) · 🟡 incremento de autónomos, coeficientes del plan de empleo, cónyuge | 🟡 (límites EPSV) | ⛔ |
| Tributación individual vs. conjunta (elige la mínima) | ✅ | ✅ | 🟡 |
| Mínimo personal y familiar | ✅ estatal (en base, con prorrateo art. 61) · ✅ importes autonómicos propios para el tramo autonómico (8 CCAA; Cataluña y Castilla y León mantienen los estatales) | ✅ (deducción de cuota) | ✅ personal + familiar (deducción de cuota, con prorrateo) |
| Anualidades por alimentos a hijos (escala separada) | ✅ | ⛔ | ⛔ |
| Deducciones estatales de cuota (vivienda transit., donativos) | ✅ vivienda anterior a 2013 (7,5 % + 7,5 %, 9.040 € por declaración también en conjunta) y donativos Ley 49/2002 (80 / 40 / 45 %, base ≤ 10 % de la base liquidable) · 🟡 régimen especial del 9 % de Cataluña, otras fundaciones y partidos | — | — |
| Deducciones autonómicas de cuota | 🟡 motor genérico dirigido por datos. **Las 15 CCAA de régimen común con catálogo cargado** (5–18 deducciones cada una, las de mayor incidencia), con reducción lineal por base (taper), variantes excluyentes y reparto entre progenitores en individual. Deducciones rurales / de despoblación cargadas en 9 CCAA (datos de municipio del hogar). Quedan pendientes las de inversión/donativos y algunas rurales ligadas al año de traslado | — | — |
| Deducciones forales familiares/personales | — | ✅ Gipuzkoa · 🟡 Bizkaia/Araba | ✅ mínimo personal y familiar, trabajo · 🟡 pensiones de jubilación (art. 68.B) · ⛔ familia numerosa |
| Deducciones de vivienda/alquiler forales | — | ✅ | ✅ alquiler (art. 62.2) · 🟡 emancipación (art. 68 quinquies.A) · ⛔ adquisición (régimen transitorio) |
| Bonificación Ceuta/Melilla (art. 68.4, 60 %) | fuera de alcance (Ceuta y Melilla descartadas) | — | — |
| Deducciones "impropias" (maternidad, familia numerosa) | 🟡 | — | — |
| Cuota diferencial (retenciones como input) | ✅ | ✅ | ✅ |
| Obligación de declarar (art. 96) | ✅ (simplificada del lado de «obligado») | ⛔ normativa foral | ⛔ normativa foral |

## 2. Parámetros por jurisdicción (ejercicio 2025)

| Jurisdicción | Escala general | Escala ahorro | Mínimos / bonif. | Deducciones | Fuente principal |
|---|---|---|---|---|---|
| Estatal (territorio común) | ✅ | ✅ | ✅ | 🟡 estatales / ⛔ autonómicas | LIRPF; AEAT Manual Renta 2025 |
| Las 15 CCAA de régimen común | ✅ | — | — | 🟡 **carga parcial** (5–18 deducciones por CCAA; catálogos completos pendientes) | Ley de tributos cedidos de cada CCAA + AEAT Manual Renta 2025, subpágina de cada deducción |
|  ↳ **Cataluña** | ✅ 7 de 13 (nacimiento, alquiler, rehabilitación vivienda, donativos lengua, donativos I+D+i, ángel inversor, cooperativas). Pendientes: viudedad, alquiler víctimas violencia, > 1 pagador, préstamos máster/doctorado, tramo autonómico vivienda 9 %. | | | | DL 1/2024, Manual Renta 2025 Parte 2 |
|  ↳ **Galicia** | ✅ 7 de ~24 (nacimiento por renta/orden, familias 2 hijos, FN, alquiler ×2 tramos, cuidado hijos, libros). Pendientes: inversión/donativos y las condicionadas a municipio. | | | | DL 1/2011, Manual Renta 2025 Parte 2 |
|  ↳ **Castilla y León** | ✅ 8 de ~18 (nacimiento por orden, FN, alquiler joven, cuidado hijos ×2, cuotas SS empleada hogar, discapacidad ×3). Pendientes: partos múltiples (acoplada), inversión/donativos, vivienda rural. | | | | DL 1/2013, Manual Renta 2025 Parte 2 |
|  ↳ **Canarias** | ✅ 6 de ~16 (nacimiento por orden con límite 46.455 €, FN general/especial, monoparental, guardería < 3, estudios no superiores). Pendientes: estudios superiores fuera de isla, discapacidad ≥ 65, donativos. | | | | DL 1/2009, Manual Renta 2025 Parte 2 |
|  ↳ **Región de Murcia** | ✅ 7 de ~27 (nacimiento por orden 30.000/50.000 € + prorrateo, guardería 20 %/1.000, material escolar 120 €, discapacidad 150 €, conciliación 20 %/400, monoparental 303 €/35.240, alquiler 10 %/300). Pendientes: inversión vivienda jóvenes, mujeres trabajadoras, donativos, y ~15 más. | | | | DL 1/2010, Manual Renta 2025 Parte 2 |
|  ↳ **Aragón** | ✅ 5 de ~19 (régimen general: nacimiento 3.er hijo 500/600, cuidado de personas dependientes 150, mayores de 70 años 75, guardería 15 %/250). Pendientes: libros/clases de apoyo (tabla de tramos), adopción internacional, nacimiento hijo con discapacidad, y las condicionadas a municipio + el régimen de fiscalidad diferenciada. | | | | DL 1/2005, Manual Renta 2025 Parte 2 |
|  ↳ **Extremadura** | ✅ 5 de ~19 (arrendamiento 30 %/1.000, material escolar 15 €, partos múltiples 300 €, cuidado de hijos ≤ 14 al 10 %/400, cuidado de familiares con discapacidad ≥ 65 % 150 €; límites 19.000/24.000). Pendientes: trabajo dependiente y viudedad (puertas nuevas), y las condicionadas a municipio < 3.000 hab. | | | | DL 1/2018, Manual Renta 2025 Parte 2 |
|  ↳ **Illes Balears** | ✅ 5 de ~24 (arrendamiento 15 %/530, nacimiento por orden 800/1.000/1.200, libros 100 %/220, idiomas extraescolares 15 %/110, conciliación < 6 años 40 %/660; límites 33.000/52.800). Pendientes: variantes incrementadas (20 %/650, 50 %/900, 350 €), estudios fuera de isla, donativos e inversión. | | | | DL 1/2014, Manual Renta 2025 Parte 2 |
|  ↳ **Principado de Asturias** | ✅ 8 de ~27 (FN 1.000/2.000, monoparental 500, partos múltiples 1.000/hijo, gastos 0-3 15 %/500, cuidado de descendientes ≤ 25 años 600 €, emancipación ≤ 35 años 100 %/1.000, arrendamiento 30 %/1.500 joven y 10 %/500 general; límites 35.000/45.000 salvo 0-3 con 26.000/37.000). Pendientes: libros (tabla de tramos) y las condicionadas a concejo de despoblamiento. | | | | DL 2/2014, Manual Renta 2025 Parte 2 |
|  ↳ **Cantabria** | ✅ 6 de ~21 (nacimiento 1.400 €, monoparental 200, guardería 15 %/300, gastos de enfermedad 10 %/500, educación-libros 100 %/200, arrendamiento 10 %/300; límites sobre base − MPF). Pendientes: cuidado de familiares (por miembro), obras de mejora, y las condicionadas a municipio de despoblamiento. | | | | DL 62/2008, Manual Renta 2025 Parte 2 |
|  ↳ **La Rioja** | ✅ 6 de ~25 (nacimiento por orden 600/750/900, escuelas infantiles 0-3 20 %/600, arrendamiento < 36 10 %/300, internet emancipados 30 %, luz/gas emancipados 15 %, deporte 30 %/300). Pendientes: variantes de pequeños municipios (porcentajes/límites incrementados) y vivienda/donativos. | | | | Ley 10/2017, Manual Renta 2025 Parte 2 |
|  ↳ **Comunidad de Madrid** | ✅ 7 de ~23 (arrendamiento < 41 30 %/1.237, nacimiento 721,70 € ×3 años con prorrateo, familia numerosa general 50 % / especial 100 % de la cuota autonómica con tope, solo con título obtenido desde 2023, cuidado de ascendientes 515,50 €, empleada de hogar 25 %/463,95 o 40 %/618,60 con familia numerosa, gastos educativos con límite único por hijo 412,40 / 927,90 / 1.031; límite de la UF de 30.930 € por miembro). Pendientes: empleada de hogar por familiar dependiente o con discapacidad, acogimiento (flag), familias 2+ descendientes con ingresos bajos, intereses de préstamos (vivienda joven, estudios), y las de inversión/donativos y municipio en despoblación. | | | | DL 1/2010, Manual Renta 2025 Parte 2 |
|  ↳ **Andalucía** | ✅ 10 de ~17 (nacimiento 200 €, arrendamiento < 36 / > 65 15 %/1.200, familia numerosa general+especial, familia monoparental 100 € + 100 €/ascendiente > 75, discapacidad 150 €, gastos educativos idiomas/informática 15 %/150, ayuda doméstica 20 %/500, deporte 15 %/100). Pendientes: cónyuge con discapacidad (flag), asistencia a discapacidad, inversión/donativos, veterinarios, celíacos. | | | | Ley 5/2021, Manual Renta 2025 Parte 2 |
|  ↳ **Comunitat Valenciana** | ✅ 13 de ~40 (nacimiento 600/750/900 € × 3 ejercicios, familia numerosa general/especial, monoparental, guarderías < 3, discapacidad ≥ 65, ascendientes > 75, alquiler en 3 variantes excluyentes, material escolar si hay desempleo, abonos culturales, 2+ descendientes). **Taper de base modelado.** | | | | Ley 13/1997 (red. Ley 5/2025), Manual Renta 2025 Parte 2 |
|  ↳ **Castilla-La Mancha** | ✅ 9 de ~30 (nacimiento, familia numerosa general+especial, familia monoparental 200 €, guardería < 3 30 %/500, discapacidad ≥ 65 % 300 €, contribuyente > 75 150 €, cuidado de ascendiente > 75 150 €, arrendamiento < 36 15 %/500; límite general de base 27.000/36.000). Pendientes: libros de texto (tabla de tramos), discapacidad de ascendientes/descendientes, acogimientos, arrendamientos por colectivo, y las de zona rural / inversión / donativos. | | | | Ley 8/2013, Manual Renta 2025 Parte 2 |
| ~~Ceuta, Melilla~~ | **fuera del alcance de la herramienta** (decisión de producto 2026-09-09) — el régimen (escala supletoria art. 65 + bonif. 60 % art. 68.4) queda documentado en `docs/00` | | | | |
| Bizkaia | ✅ | ✅ | 🟡 | 🟡 | NF 13/2013; DF Gipuzkoa Modelo 109 (2025) (armonizado); Cuatrecasas 05/2025 |
| Gipuzkoa | ✅ | ✅ | ✅ | ✅ familiares / 🟡 otras | DF Gipuzkoa, Modelo 109 (2025) |
| Araba/Álava | ✅ | ✅ | 🟡 | 🟡 | NF 33/2013 (armonizado) |
| Navarra | ✅ | ✅ | 🟡 personal + familiar (art. 62.9, importes de fuente secundaria) + trabajo (art. 62.5) | ✅ alquiler 62.2 (BOE) · 🟡 emancipación, pensiones de jubilación · ⛔ familia numerosa, donativos | TR IRPF (DFL 4/2008), LF 22/2023 y LF 20/2024 (BOE); guiafiscal / rentanavarra.com para el art. 62.9 (cotejar con BON) |
| Ejercicio **2026** | ✅ solo País Vasco (tarifa + ahorro) | ✅ | hereda 2025 | hereda 2025 | NF 7/2025, NF 2/2025, etc. |

## 3. Muestra sintética y métricas

| Componente | Estado |
|---|---|
| Generador de hogares sintéticos (lognormal calibrada a media+Gini) | ✅ |
| Objetivos de calibración por territorio | 🟡 renta media verificada AEAT 2023 en 11 territorios; 6 CCAA + 4 forales ESTIMADAS; Gini pendiente (`data/calibracion/`) |
| Reponderación / raking a marginales por tramo | ⛔ (previsto H5) |
| Gini (ponderado), deciles, tipo efectivo por decil | ✅ |
| Reynolds-Smolensky, Kakwani, índice de concentración | ✅ |
| Ganadores/perdedores por reforma | ✅ |
| Comparador de un perfil en los 19 territorios | ✅ |

## 4. Interfaces

| Interfaz | Estado |
|---|---|
| API REST (plumber) — `/liquidar`, `/comparar`, `/simular`, `/optimizar`, `/parametros` | ✅ |
| Dashboard Shiny — comparador de perfiles + simulador de reformas + cobertura | ✅ |
| Motor sin dependencias de UI (apto para frontend web) | ✅ |
| **Motor JavaScript** (`web/js/irpfsim.js`) — port fiel, validado contra R (46 casos, `tools/validar_js.html`) | ✅ |
| **Mapafiscal** — web interactiva 100 % cliente (`web/`; `npm run empaquetar` genera el HTML autónomo) | ✅ |
| **Optimizador** (`optimizar()`) — palancas: plan de pensiones, individual/conjunta, traslado, deducciones a revisar | 🟡 v1 (3 palancas + deducciones potenciales) |

## 5. Limitaciones conocidas (v1)

1. **Deducciones autonómicas: las 15 CCAA de régimen común con catálogo cargado (parcial).**
   Cada comunidad tiene 5–18 deducciones cargadas (nacimiento, arrendamiento, familia
   numerosa/monoparental, guardería/0-3, discapacidad, material escolar, conciliación,
   cuidado de ascendientes/descendientes, residencia en zona rural o despoblada, etc.).
   Quedan pendientes: las de inversión/donativos, las tablas de límite por tramo de
   base (libros de texto) y algunas rurales ligadas al año de traslado ⇒ el motor puede
   seguir sobreestimando algo la cuota autonómica en hogares con esas deducciones.
   Bastantes límites de renta siguen `provisional` (valor estándar, pendiente de
   cotejo). El DSL (`R/06_deducciones.R`) soporta: importe fijo, fijo por hijo (con
   edad), fijo por hijo nacido (importes por orden o importe por hijo), % de un campo
   (con límite/edad/renta), % de la cuota íntegra autonómica, y puertas por
   discapacidad del contribuyente/familiar, dependiente a cargo, parto múltiple,
   monoparental, familia numerosa, nº de descendientes y base − mínimo. **Desde
   2026-09-25 soporta además:** reducción lineal por base (taper), variantes excluyentes
   (`grupo`), reparto entre progenitores por defecto, municipio (población y zona
   despoblada, con incremento por municipio pequeño) y desempleo.
2. **Módulos (estimación objetiva) no modelados.** Entran como rendimiento neto exógeno.
3. **Navarra**: escala + mínimo personal y familiar (art. 62.9, importes de fuente
   secundaria, cotejar con el BON) + trabajo (art. 62.5) + alquiler (art. 62.2, texto del
   BOE) + emancipación (68 quinquies.A) y complemento de pensiones de jubilación (68.B),
   ambas sobre la cuota diferencial. Faltan familia numerosa, donativos y la tributación
   conjunta foral completa.
4. **Reducción del trabajo por perceptor** se aproxima usando "otras rentas" del conjunto
   del ámbito (exacto para hogares monoperceptores; conservador para biperceptores).
5. **Tributación individual de parejas**: cada declarante se liquida en su ámbito (sus
   gastos y requisitos personales solo en su declaración; lo familiar se reparte). Ver docs/03.
6. **Parámetros marcados `provisional`/`pendiente`** en los YAML: ver `params/2025/*.yaml`
   (campo `estado`) y la lista `avisos_parametros()` que devuelve cada liquidación.
7. Fuera de alcance: régimen de impatriados (art. 93), IRNR, doble imposición internacional
   con cálculo completo, rentas irregulares > 2 años más allá de la reducción del 30 %.
