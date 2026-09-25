# Documento de diseño — Microsimulador del IRPF español (`irpfsim`)

> Estado: **v1 implementada** (2026-09-08).
> Este documento mantiene el mapa de parámetros y la arquitectura de referencia.
> Para el estado real de cada pieza del motor ver **[`02_cobertura.md`](02_cobertura.md)**;
> para el desarrollo de los casos de test ver **[`03_casos_validacion.md`](03_casos_validacion.md)**.
>
> **Cambios respecto al borrador inicial (decididos con Alex el 2026-09-08):**
> - La herramienta es **independiente**: no se valida contra el trabajo de la asignatura
>   de fiscalidad. Los §9 y las preguntas ligadas a ese caso quedan obsoletos; la
>   validación se hace con casos propios verificados a mano (`03_casos_validacion.md`).
> - Ejercicio base **IRPF 2025**, con hueco para IRPF 2026 (`params/2026/`).
> - Estimación objetiva (módulos): confirmada "completa" pero planificada para H4;
>   en v1 entra como rendimiento neto exógeno.
> - Anualidades por alimentos / pensiones compensatorias: incluidas en v1 (régimen común).
> - Se añade una **API REST (plumber)** además del dashboard Shiny, pensando en el
>   futuro frontend web: el motor R no tiene dependencias de UI.

---

## 0. Cómo leer este documento

Este es el **mapa de parámetros y el diseño de arquitectura** que pediste tener cerrado *antes* de escribir el motor. No hay código de cálculo todavía. El objetivo es que detectes errores de diseño de reglas ahora, cuando corregirlos cuesta un párrafo, y no cuando estén replicados en 22 módulos.

**Leyenda de estado de cada parámetro / bloque de reglas:**

| Marca | Significado |
|---|---|
| ✅ **LOCALIZADO** | Tengo el valor y la fuente primaria (BOE / boletín foral / ley autonómica). Citada en el propio documento. |
| ⚠️ **POR CONFIRMAR** | Tengo un valor provisional (de fuente secundaria fiable o de un ejercicio anterior) pero falta cotejar con la norma vigente 2025. |
| ❌ **POR BUSCAR** | Slot identificado, valor no localizado aún. |
| 🔵 **DECISIÓN DE DISEÑO** | Necesito que elijas tú antes de implementar (alcance, simplificación, tratamiento). |

**Ejercicio base:** IRPF **2025** (devengo 2025, campaña primavera 2026). Todo el sistema de parámetros lleva una dimensión `ejercicio`, de modo que **IRPF 2026** entra como un juego de parámetros paralelo en cuanto sus normas sean definitivas (varias ya lo son: NF 7/2025 de Bizkaia, etc.). Ver §2.6.

**Territorios cubiertos (22 módulos de jurisdicción):**

1. Núcleo estatal — territorio común (base compartida por 15 CCAA + Ceuta + Melilla)
2–16. Las 15 CCAA de régimen común: Andalucía, Aragón, Asturias, Illes Balears, Canarias, Cantabria, Castilla-La Mancha, Castilla y León, Cataluña, Extremadura, Galicia, La Rioja, Madrid, Región de Murcia, Comunitat Valenciana
17–18. ~~Ciudades autónomas: Ceuta y Melilla~~ — **fuera del alcance de la herramienta desde 2026-09-09** (decisión de producto). El régimen (tramo autonómico = escala estatal supletoria + bonificación 60/50 % por residencia, art. 68.4 LIRPF) se documenta aquí por si se reincorporan.
19. Bizkaia — Norma Foral 13/2013 (Concierto Económico)
20. Gipuzkoa — Norma Foral 3/2014
21. Araba/Álava — Norma Foral 33/2013
22. Navarra — Texto Refundido (D.F. Leg. 4/2008), Convenio Económico

> Nota terminológica: el País Vasco como CCAA **no** tiene IRPF propio; lo tienen los tres Territorios Históricos. Por eso hay 3 módulos vascos y no 1.

---

## 1. Objetivo y alcance

Réplica de alta fidelidad legal del IRPF español en toda su complejidad territorial, para:

- Liquidar el impuesto de un hogar dado su territorio de residencia fiscal.
- Simular reformas (cambiar cualquier tramo, tipo, mínimo o deducción en una o varias jurisdicciones) y recalcular una muestra.
- Medir efecto distributivo: renta disponible por decil, Gini antes/después, tipo efectivo medio por decil y territorio, y **comparativa de carga fiscal entre territorios para un mismo perfil de hogar**.

### 1.1 Dentro de alcance (v1)

- Rentas: trabajo, capital mobiliario, capital inmobiliario, actividades económicas **en estimación directa (normal y simplificada) y en estimación objetiva / módulos completa** (decisión tuya del 2026-09-08), ganancias y pérdidas patrimoniales, imputación de rentas inmobiliarias.
- Renta general vs. renta del ahorro, con reglas de integración y compensación.
- Base imponible → base liquidable → mínimo personal y familiar → cuota íntegra estatal y autonómica/foral → deducciones → cuota líquida → cuota diferencial → tipo efectivo.
- Tributación individual vs. conjunta (el motor evalúa ambas y elige, con opción de forzar).
- Circunstancias personales y familiares: edad, discapacidad (grados 33–64 % y ≥65 %), ascendientes y descendientes a cargo, familia numerosa (general y especial), monoparentalidad.
- Régimen transitorio DT 9ª LIRPF (y su equivalente foral) para elementos adquiridos antes de 31-12-1994.
- Especialidad de Bizkaia: exención de dividendos art. 9.24 NF 13/2013 (hasta 1.500 €), que el Estado derogó en 2015.

### 1.2 Fuera de alcance (v1) — documentado para v2

- Regímenes especiales: régimen de impatriados ("Ley Beckham", art. 93 LIRPF), no residentes (IRNR), trabajadores fronterizos.
- Rentas en el extranjero, deducción por doble imposición internacional, transparencia fiscal internacional.
- Anualidades por alimentos a los hijos por decisión judicial (tratamiento especial de escala) — 🔵 podría entrar en v1 si tu caso de test lo usa.
- Regularizaciones plurianuales, rentas irregulares con período de generación > 2 años más allá de la reducción del 30 %.
- Modelo 720 / declaraciones informativas.
- Retenciones a cuenta calculadas desde cero (se toman como *input* del hogar; el motor sí las usa para la cuota diferencial).

### 1.3 🔵 Decisiones de alcance que necesito que confirmes

1. **Estimación objetiva (módulos):** confirmaste "completa desde v1". Implica modelar la Orden anual de módulos (HFP) entera: actividades, unidades de módulo, rendimiento anual por unidad, índices correctores (población, temporada, nuevas actividades, exceso), reducciones generales, y el límite de exclusión. Es un subsistema grande. Propuesta: se implementa como su propio submódulo `actividades_objetiva/` **después** del hito 1 (estatal + Bizkaia en estimación directa), para no bloquear la validación con tu caso real. ¿OK?
2. **Anualidades por alimentos a hijos:** ¿aparecen en las liquidaciones de Ramón/Susana/Ricardo? Si sí, entran en v1.
3. **Pensiones compensatorias al cónyuge / por alimentos a otras personas:** reducción de base imponible general. Bajo coste, propongo incluirla en v1.

---

## 2. Arquitectura del sistema

### 2.1 Lenguaje, organización y dependencias

- **Lenguaje:** R (≥ 4.3). Estructura de **paquete** (`irpfsim`) para tener espacios de nombres, tests (`testthat`), documentación (`roxygen2`) y control de versiones limpio.
- **Dependencias mínimas:** `data.table` (rendimiento sobre la muestra), `yaml` (parámetros), `checkmate` (validación de inputs). Dashboard: `shiny`, `bslib`, `ggplot2`, `DT`, `plotly` (opcional). Métricas: implementación propia de Gini/deciles (sin dependencia pesada tipo `ineq`, para control total).
- **Sin dependencias de red en el motor.** Toda la normativa vive en ficheros de parámetros versionados.

```
irpf-microsim/
├── docs/
│   ├── 00_documento_diseno.md         ← este fichero
│   ├── 01_esquema_hogar.md            ← spec del input (se escribe tras tu revisión)
│   ├── 02_esquema_liquidacion.md      ← spec del output
│   └── fuentes/                       ← PDFs de BOE / boletines forales / leyes autonómicas
├── params/
│   ├── 2025/
│   │   ├── estatal.yaml
│   │   ├── comun_<cca>.yaml           ← 17 ficheros (tramo autonómico + deducciones)
│   │   ├── bizkaia.yaml
│   │   ├── gipuzkoa.yaml
│   │   ├── araba.yaml
│   │   └── navarra.yaml
│   ├── 2026/                          ← se va rellenando según se publican normas
│   └── esquema_parametros.yaml        ← contrato/estructura que todo fichero debe cumplir
├── R/
│   ├── core/                          ← lógica común (pipeline, integración, escalas, mínimos)
│   ├── jurisdicciones/                ← un fichero por módulo de jurisdicción
│   ├── reformas/                      ← motor de reformas
│   ├── muestra/                       ← generación y calibración de la muestra sintética
│   ├── metricas/                      ← Gini, deciles, tipos efectivos
│   └── dashboard/                     ← app Shiny
├── data/
│   ├── calibracion/                   ← microdatos/marginales AEAT, INE, Haciendas forales
│   └── muestra_sintetica.parquet
└── tests/
    ├── testthat/
    └── casos_validacion/              ← tu trabajo de fiscalidad + otros casos cerrados
```

### 2.2 El contrato común de jurisdicción (la interfaz)

Todos los módulos implementan **la misma firma**:

```r
liquidar_<jurisdiccion>(hogar, parametros, opciones) -> liquidacion
```

- `hogar`: objeto validado (ver §2.3). Incluye el territorio de residencia fiscal, que determina qué módulo se invoca vía tabla de despacho.
- `parametros`: el juego de parámetros de esa jurisdicción y ese ejercicio, ya cargado y validado.
- `opciones`: `modo_tributacion` (`"auto"` | `"individual"` | `"conjunta"`), `year`, flags de traza/depuración.
- `liquidacion`: objeto estandarizado (§2.4). **La estructura de salida es idéntica en las 22 jurisdicciones**, aunque algunos campos sean 0 o `NA` donde no apliquen (p. ej. "cuota autonómica" en un módulo foral se mapea a "cuota foral").

Internamente, los módulos de **régimen común** (17) comparten casi todo: llaman a `liquidar_comun(hogar, params)` del `core/` y solo aportan (a) la escala del tramo autonómico y (b) la función de deducciones autonómicas. Los módulos **forales** (3) y **Navarra** son módulos completos porque su estructura difiere (ver §5, §6).

### 2.3 Modelo de datos de entrada — el hogar

Un `hogar` es una lista con:

**Nivel hogar**
- `id_hogar`
- `residencia_fiscal`: código de territorio (`"ES-MD"`, `"ES-CT"`, `"ES-BI"`, `"ES-NA"`, `"ES-CE"`…). Determina el módulo.
- `ejercicio`: 2025 (o 2026).
- `miembros`: lista de personas.
- `elementos_patrimoniales`: lista de bienes con ganancias/pérdidas en el ejercicio (para DT 9ª hace falta fecha de adquisición).

**Nivel persona** (cada miembro)
- `id_persona`, `rol` (`declarante`, `conyuge`, `descendiente`, `ascendiente`)
- `edad`, `fecha_nacimiento`
- `discapacidad`: `"no"` | `"33_64"` | `"65_mas"`; `movilidad_reducida` (bool); `ayuda_terceros` (bool)
- `convivencia_meses`, `vinculo` (para mínimos por ascendientes/descendientes)
- `rentas_propias_anuales` (para el test de dependencia: 8.000 € / 1.800 € según concepto)
- `discapacidad_judicial` (para "hijo mayor incapacitado" en unidad familiar)

**Rentas (por persona)** — cada partida con los campos que su régimen necesita:
- `trabajo`: `retribuciones_dinerarias`, `retribuciones_especie`, `cotizaciones_ss`, `otros_gastos_deducibles`, `movilidad_geografica` (bool), `rendimiento_irregular` (importe y periodo de generación), `situaciones_especiales` (prolongación actividad, discapacidad trabajador activo)
- `capital_inmobiliario`: por inmueble — `ingresos_integros`, `gastos` (financieros, reparación, IBI, comunidad, amortización), `arrendamiento_vivienda` (bool, para reducción art. 23.2), `parentesco_arrendatario`
- `capital_mobiliario`: `dividendos`, `intereses`, `seguros_vida`, `cesion_capitales_propios`, `arrendamiento_muebles_negocios`, `propiedad_intelectual`
- `actividades_economicas`: `metodo` (`directa_normal` | `directa_simplificada` | `objetiva`); para directa: `ingresos`, `gastos`, `provisiones`; para objetiva: `actividad_iae`, `unidades_modulo` (personal asalariado/no, superficie, potencia, mesas, población del municipio…), `dias_actividad`
- `ganancias_patrimoniales`: enlazadas a `elementos_patrimoniales` — `valor_transmision`, `valor_adquisicion`, `fecha_adquisicion`, `fecha_transmision`, `tipo_elemento` (inmueble / acción cotizada / otro), `reinversion` (vivienda habitual, mayores de 65)
- `imputacion_inmobiliaria`: `valor_catastral`, `revisado_10_anios` (bool)
- `regimen_prevision_social`: aportaciones a planes de pensiones, mutualidades, etc.
- `retenciones_y_pagos_a_cuenta`: total soportado (para cuota diferencial)
- `reducciones_base`: pensiones compensatorias satisfechas, anualidades por alimentos

**Circunstancias de la unidad familiar**
- `tipo_unidad_familiar`: `biparental` | `monoparental` | `ninguna`
- `familia_numerosa`: `"no"` | `"general"` | `"especial"`
- `titulo_familia_numerosa` (para deducciones autonómicas que lo exigen)

> 🔵 **Decisión:** ¿Nivel de granularidad de las rentas del trabajo? Propongo el detalle de arriba (permite reproducir el art. 19). Alternativa más simple: un único `rendimiento_neto_trabajo` ya calculado como input. Recomiendo el detalle para poder simular reformas de gastos/reducciones.

### 2.4 Modelo de datos de salida — la liquidación

Objeto `liquidacion` idéntico en todas las jurisdicciones:

```
$ territorio                     "ES-BI"
$ modo_tributacion_elegido       "conjunta"
$ base_imponible_general
$ base_imponible_ahorro
$ reducciones_base_general       (desglose)
$ base_liquidable_general
$ base_liquidable_ahorro
$ minimo_personal_y_familiar     (desglose: contribuyente / descendientes / ascendientes / discapacidad)
$ cuota_integra_estatal          (en forales: 0; ver cuota_integra_foral)
$ cuota_integra_autonomica       (en forales: cuota_integra_foral)
$ cuota_integra_total
$ deducciones_estatales          (lista con importe y base legal de cada una)
$ deducciones_autonomicas        (idem)
$ cuota_liquida_estatal
$ cuota_liquida_autonomica
$ cuota_liquida_total
$ retenciones_y_pagos_a_cuenta
$ deducciones_cuota_diferencial  (maternidad, familia numerosa, ...)
$ cuota_diferencial
$ resultado_declaracion          (a ingresar / a devolver)
$ tipo_medio_efectivo            cuota_liquida_total / base_imponible_total
$ tipo_marginal                  (calculado con +1 € de base general)
$ traza                          (opcional: cada paso del pipeline con su importe y artículo)
```

### 2.5 Pipeline de cálculo genérico (régimen común)

12 pasos. Cada uno es una función pura de `core/`; los módulos autonómicos solo inyectan escala autonómica y deducciones autonómicas en los pasos 7 y 11.

| # | Paso | Artículos LIRPF (territorio común) |
|---|---|---|
| 1 | Clasificar y agregar rentas por fuente y por naturaleza (general / ahorro) | 6, 44–46 |
| 2 | Rendimiento neto por fuente: gastos + reducciones | trabajo 17–20; cap. inmob. 21–24; cap. mobil. 25–26; act. econ. 27–32 |
| 3 | Ganancias/pérdidas patrimoniales por elemento; DT 9ª (abatimiento pre-1994); clasificación general/ahorro | 33–39; DT 9ª |
| 4 | Integración y compensación → **base imponible general** y **base imponible del ahorro** | 47–49 |
| 5 | Reducciones de la base imponible general (previsión social, pensiones compensatorias, **tributación conjunta**) → **base liquidable general** (y remanente sobre ahorro) | 50–55, 84 |
| 6 | Importe del mínimo personal y familiar | 56–61 |
| 7 | Gravamen de la base liquidable general: **escala estatal (art. 63)** y **escala autonómica (art. 74)**, aplicadas a la BLG y al mínimo; cuota = t(BLG) − t(mínimo) | 62–66, 73–76 |
| 8 | Gravamen de la base liquidable del ahorro (parte estatal art. 66 / parte autonómica art. 76); parte del mínimo no absorbida por la BLG | 66, 76 |
| 9 | Cuota íntegra estatal / cuota íntegra autonómica | 67, 77 |
| 10 | Deducciones estatales sobre la cuota (vivienda DT 18ª, donativos, obras eficiencia energética DA 50ª, doble imposición, etc.), con reparto estatal/autonómico | 68, 78–80 |
| 11 | **Deducciones autonómicas** (módulo CCAA) | 46 bis, Ley 22/2009, ley autonómica |
| 12 | Cuota líquida estatal + autonómica → cuota líquida total; restar retenciones/pagos a cuenta; aplicar deducciones "impropias" (maternidad art. 81, familia numerosa 81 bis) → cuota diferencial y resultado | 79–81 bis, 97–103 |

**Tributación conjunta:** el motor ejecuta el pipeline en modo individual para cada declarante y en modo conjunto para la unidad familiar, y devuelve el de menor cuota líquida total (salvo `modo_tributacion` forzado).

### 2.6 Sistema de parámetros

- Un fichero YAML por (jurisdicción × ejercicio). Estructura común definida en `params/esquema_parametros.yaml` y validada al cargar.
- **Cada parámetro es un objeto, no un número suelto:**

```yaml
escala_general_estatal:
  descripcion: "Escala del gravamen estatal de la base liquidable general"
  norma: "Art. 63.1.1º LIRPF (Ley 35/2006), redacción vigente 2025"
  fuente: "BOE-A-2006-20764; Manual Práctico Renta 2025 (AEAT)"
  estado: confirmado          # confirmado | provisional | pendiente
  vigencia_desde: 2021-01-01
  tramos:
    - { hasta: 12450,  tipo: 0.095 }
    - { hasta: 20200,  tipo: 0.12 }
    - { hasta: 35200,  tipo: 0.15 }
    - { hasta: 60000,  tipo: 0.185 }
    - { hasta: 300000, tipo: 0.225 }
    - { hasta: .inf,   tipo: 0.245 }
```

- El motor nunca lleva números hardcodeados; todo sale de estos ficheros. La traza de salida cita `norma` y `fuente` de cada parámetro que intervino.
- **IRPF 2026:** carpeta `params/2026/` paralela. El dashboard permite elegir ejercicio. Donde una norma 2026 aún no sea definitiva, el fichello marca `estado: provisional` y el dashboard lo advierte.

### 2.7 Motor de reformas

Una **reforma** es una lista de *parches* sobre el árbol de parámetros:

```r
reforma <- list(
  list(jurisdiccion = "estatal", ruta = "escala_general_estatal/tramos/6/tipo", valor = 0.26),
  list(jurisdiccion = "ES-CT",   ruta = "deduccion_alquiler_joven/porcentaje",  valor = 0.20),
  list(jurisdiccion = c("ES-BI","ES-SS","ES-VI"), ruta = "minoracion_cuota", valor = 1600)
)
```

- `aplicar_reforma(parametros, reforma)` devuelve un árbol de parámetros modificado (inmutable; el original no se toca).
- `simular(muestra, reforma, año)` recalcula toda la muestra bajo baseline y bajo reforma y devuelve ambos conjuntos de liquidaciones + un `diff`.
- Soporta: cambiar un tipo/tramo/umbral, añadir/quitar un tramo, cambiar un mínimo, activar/desactivar una deducción, cambiar un porcentaje o límite de deducción, y aplicar el mismo parche a varias jurisdicciones a la vez.
- Reformas "estructurales" (p. ej. "aplicar la tarifa de Madrid en toda España", "unificar mínimos estatales y forales") se expresan como funciones que generan la lista de parches.

### 2.8 Muestra sintética y calibración

🔵 Bloque con decisiones pendientes; propuesta:

- **Unidad:** hogar fiscal. Generamos ~100.000–500.000 hogares sintéticos.
- **Fuentes de calibración (todas públicas):**
  - AEAT — *Estadística de los declarantes del IRPF* por CCAA (rangos de base imponible, nº de declarantes, cuota, por tramo y por comunidad). ✅ existe y es anual.
  - AEAT — *Muestra de declarantes IRPF IEF-AEAT* (microdatos anonimizados) si está disponible para el ejercicio. ⚠️ verificar acceso.
  - INE — *Encuesta de Condiciones de Vida (ECV)* y *Encuesta Financiera de las Familias (EFF, Banco de España)*: estructura de hogares, composición, rentas del capital.
  - Haciendas forales — estadísticas de IRPF de las Diputaciones y de Navarra (equivalente foral de la estadística AEAT). ❌ localizar los boletines concretos.
- **Método:** generación por *reweighting* / *calibración a marginales* (raking / GREG) para cuadrar, por territorio, la distribución de renta bruta, la composición de rentas (peso trabajo/capital/actividades), el tamaño y tipo de hogar, y el nº de declarantes por tramo. Alternativa: *synthetic reconstruction* a partir de la muestra IEF-AEAT si hay acceso.
- **Validación de la muestra:** recaudación agregada simulada vs. recaudación real por territorio (±X %); nº de declarantes por tramo; Gini de renta bruta vs. INE.

### 2.9 Métricas distributivas

Implementación propia, documentada:
- Renta disponible = renta bruta − cuota líquida total (− cotizaciones si se modelan aparte).
- **Deciles** de renta (equivalente OCDE modificada; configurable) — nacional y por territorio.
- **Gini** de renta bruta y de renta disponible, antes y después de la reforma, nacional y por territorio; **índice de Reynolds-Smolensky** (capacidad redistributiva) y **Kakwani** (progresividad).
- **Tipo efectivo medio** por decil y por territorio; **tipo marginal efectivo**.
- **Ganadores/perdedores:** % de hogares con Δrenta disponible >0 / <0 / ≈0, por decil y territorio.
- **Comparador de perfiles:** para un hogar-tipo parametrizable (p. ej. "pareja, 2 hijos, 40.000 € de trabajo, alquiler"), tabla de cuota líquida y tipo efectivo en los 22 territorios simultáneamente.

### 2.10 Dashboard Shiny

- Panel de **selección de territorio(s)** (mapa + selector múltiple).
- Panel de **reforma**: sliders/inputs para cada parámetro de la(s) jurisdicción(es) elegida(s), agrupados (escala general, escala ahorro, mínimos, reducción trabajo, deducciones).
- Panel de **resultados**: curva de Δrenta disponible por decil, Gini antes/después, tabla de tipos efectivos, mapa de carga fiscal.
- Panel de **comparador de perfiles** (§2.9).
- Recálculo incremental: la muestra se cachea; una reforma solo recalcula lo afectado.

---

## 3. Mapa de parámetros — NÚCLEO ESTATAL (territorio común), ejercicio 2025

> Fuente base: Ley 35/2006 (LIRPF) y RD 439/2007 (RIRPF), redacción vigente 2025; *Manual Práctico Renta 2025* de la AEAT. Enlaces en §12.

### 3.1 Escalas de gravamen

| Parámetro | Estado | Valor 2025 | Fuente |
|---|---|---|---|
| Escala general **estatal** (art. 63) | ✅ | Tramos (hasta €, tipo): 12.450 → 9,50 % · 20.200 → 12 % · 35.200 → 15 % · 60.000 → 18,50 % · 300.000 → 22,50 % · resto → 24,50 % | AEAT Manual 2025, "Gravamen estatal base liquidable general" |
| Escala general **autonómica supletoria** (art. 65) — se usa solo si una CCAA no aprueba la suya y en Ceuta/Melilla | ✅ | Idéntica a la estatal (misma tabla) | Art. 65 LIRPF |
| Escala del **ahorro** — parte estatal (art. 66.1) | ✅ | 6.000 → 9,50 % · 50.000 → 10,50 % · 200.000 → 11,50 % · 300.000 → 13,50 % · resto → 15 % | AEAT Manual 2025, "Gravamen estatal base liquidable del ahorro" |
| Escala del **ahorro** — parte autonómica (art. 76) | ✅ | Misma tabla que la estatal del ahorro (⇒ tarifa del ahorro **combinada**: 19 % / 21 % / 23 % / 27 % / 30 %) | Art. 76 LIRPF |
| Nuevo 5º tramo del ahorro (>300.000 € al 30 %) | ✅ | Vigente desde 2025 (antes 28 %) | Cuatrecasas / LPGE; AEAT Manual 2025 |

### 3.2 Mínimo personal y familiar (arts. 56–61)

| Parámetro | Estado | Valor 2025 | Fuente |
|---|---|---|---|
| Mínimo del contribuyente | ✅ | 5.550 € · +1.150 € si >65 · +1.400 € adicional si >75 | AEAT Manual 2025, cuadro-resumen mínimos |
| Mínimo por descendientes | ✅ | 1º 2.400 € · 2º 2.700 € · 3º 4.000 € · 4º y ss. 4.500 € · +2.800 € por cada <3 años | idem |
| Mínimo por ascendientes | ✅ | 1.150 € (>65 o discapacidad) · +1.400 € si >75 | idem |
| Mínimo por discapacidad (contribuyente, ascendiente o descendiente) | ✅ | 3.000 € (grado 33–64 %) · 9.000 € (≥65 %) · +3.000 € gastos de asistencia (ayuda de terceros / movilidad reducida / ≥65 %) | idem |
| Límites de renta del descendiente/ascendiente para dar derecho a mínimo | ⚠️ | Descendiente: no declarar con rentas >1.800 € (o >8.000 € rentas anuales); ascendiente: rentas ≤8.000 € y no declarar con rentas >1.800 € | Arts. 58–59 LIRPF — confirmar redacción exacta |
| Requisito de convivencia | ✅ | Descendiente/ascendiente: convivencia ≥ mitad del período (o dependencia económica con internamiento) | Arts. 58–59 |

### 3.3 Rendimientos del trabajo (arts. 17–20)

| Parámetro | Estado | Valor 2025 | Fuente |
|---|---|---|---|
| Reducción por obtención de rendimientos del trabajo (art. 20) | ✅ | Importe máximo **7.302 €** (rendimiento neto ≤ 14.852 €). Tramo 1: 14.852–17.673,52 € ⇒ 7.302 − 1,75 × (RNT − 14.852). Tramo 2: 17.673,52–19.747,50 € ⇒ 2.364,34 − 1,14 × (RNT − 17.673,52). Requiere rentas distintas del trabajo ≤ 6.500 €. | AEAT Manual 2025; Iberley art. 20 |
| "Otros gastos deducibles" genéricos (art. 19.2.f) | ⚠️ | 2.000 € · +2.000 € movilidad geográfica (desempleado que acepta empleo con traslado) · +3.500 € / 7.750 € trabajador activo con discapacidad | Confirmar en RIRPF/Manual 2025 |
| Gastos deducibles: cotizaciones SS, colegios de huérfanos, cuotas sindicales y colegiales obligatorias, defensa jurídica | ⚠️ | Cuotas sindicales sin límite; colegiales obligatorias hasta 500 €; defensa jurídica hasta 300 € | Art. 19.2 |
| Reducción rentas irregulares del trabajo (período generación >2 años o notoriamente irregulares) | ⚠️ | 30 %, sobre base máxima 300.000 € | Art. 18.2 |
| Reducción adicional trabajadores activos con discapacidad | ⚠️ | Ya incluida arriba como "otros gastos" (3.500 / 7.750 €) | Art. 19.2.f |

### 3.4 Rendimientos del capital inmobiliario (arts. 21–24)

| Parámetro | Estado | Valor 2025 | Fuente |
|---|---|---|---|
| Reducción por arrendamiento de vivienda (art. 23.2) — **reformada por Ley 12/2023** | ❌ | Nuevos porcentajes desde 2024: 50 % general; 90 % (zona tensionada con bajada ≥5 % de renta); 70 % (primer alquiler a jóvenes 18–35 en zona tensionada / vivienda a Admón. pública); 60 % (rehabilitación reciente). Confirmar cifras y condiciones 2025. | Ley 12/2023 por el derecho a la vivienda; art. 23.2 LIRPF |
| Gastos deducibles (financieros + reparación limitados a ingresos; exceso 4 años) | ⚠️ | Límite conjunto intereses+conservación = rendimiento íntegro; exceso deducible en 4 años | Art. 23.1 |
| Amortización inmueble | ⚠️ | 3 % sobre el mayor de coste de adquisición satisfecho o valor catastral (excl. suelo) | Art. 23.1.b RIRPF |
| Rendimiento mínimo en parentesco (art. 24) | ⚠️ | Imputación mínima = imputación de renta inmobiliaria si arrendatario es pariente ≤3er grado | Art. 24 |

### 3.5 Rendimientos del capital mobiliario (arts. 25–26)

| Parámetro | Estado | Valor 2025 | Fuente |
|---|---|---|---|
| Clasificación en base del ahorro (dividendos, intereses, seguros, cesión a terceros) vs. base general (cesión de capitales a entidades vinculadas por encima de x3 fondos propios; propiedad intelectual de terceros; arrendamiento de negocios) | ⚠️ | Reglas art. 25/46 | Arts. 25, 46 |
| Gastos deducibles capital mobiliario | ✅ | Solo administración y depósito de valores negociables | Art. 26.1.a |
| Reducción rendimientos irregulares | ⚠️ | 30 %, base máxima 300.000 € | Art. 26.2 |
| **Especialidad Bizkaia — no aplica en estatal:** exención dividendos 1.500 € (art. 9.24 NF) | ✅ (como ausencia) | El Estado **derogó** esta exención con efectos 2015 (Ley 26/2014). En territorio común **no existe**. | Ley 26/2014 |

### 3.6 Actividades económicas (arts. 27–32)

| Parámetro | Estado | Valor 2025 | Fuente |
|---|---|---|---|
| Estimación directa **simplificada**: conjunto de gastos de difícil justificación | ⚠️ | 5 % del rendimiento neto previo, **máximo 2.000 €** | Art. 30 LIRPF / art. 30 RIRPF |
| Estimación directa simplificada: umbral de aplicación | ⚠️ | Cifra de negocio del conjunto de actividades ≤ 600.000 € año anterior y no renuncia | Art. 28 RIRPF |
| Reducción por inicio de actividad | ⚠️ | 20 % del rendimiento neto positivo, 2 primeros ejercicios | Art. 32.3 |
| Reducción para autónomos económicamente dependientes / rendimientos del trabajo asimilados (art. 32.2.1º) | ⚠️ | Estructura análoga a la del art. 20 (importes y umbrales propios) | Art. 32.2 |
| **Estimación objetiva (módulos)** — Orden anual HFP | ❌ 🔵 | Subsistema completo: magnitudes de exclusión (250.000 € ingresos / 150.000 € facturación a empresarios / 250.000 € compras; límites reducidos prorrogados año a año), módulos por actividad (personal, superficie, potencia eléctrica, mesas, población…), rendimiento anual por unidad, índices correctores, reducción general anual, reducción especial (p. ej. Lorca, La Palma), reducción agraria. Requiere la **Orden de módulos 2025** (HFP). | Orden HFP de módulos 2025 (BOE) — POR LOCALIZAR |
| Límites forfait módulos agrícolas/ganaderos (índices de rendimiento neto por producto) | ❌ | Tabla de índices por tipo de cultivo/ganado en la Orden | idem |

### 3.7 Ganancias y pérdidas patrimoniales (arts. 33–39 + DT 9ª)

| Parámetro | Estado | Valor 2025 | Fuente |
|---|---|---|---|
| Clasificación: ganancias por transmisión → base del ahorro; sin transmisión (premios, ayudas) → base general | ✅ | Art. 46.b / 45 | LIRPF |
| **DT 9ª — coeficientes de abatimiento** (elementos adquiridos antes de 31-12-1994) | ✅ | Se aplica a la parte de ganancia generada hasta 20-01-2006. Coef. reductores por año de permanencia que exceda de 2 a 31-12-1996: **11,11 %** inmuebles · **25 %** acciones cotizadas · **14,28 %** resto de elementos. Límite: valor de transmisión acumulado de 400.000 € por contribuyente (a partir de ahí no hay reducción). | DT 9ª LIRPF (redacción Ley 26/2014); BOE-A-2006-20764 |
| Coeficientes de actualización del valor de adquisición de inmuebles | ✅ (como ausencia) | **Suprimidos** desde 2015 para IRPF (territorio común). Sí existen en normativa foral. | Ley 26/2014 |
| Exención por reinversión en vivienda habitual | ⚠️ | 100 % si se reinvierte todo el importe en 2 años | Art. 38.1 |
| Exención mayores de 65 años (vivienda habitual; o renta vitalicia hasta 240.000 €) | ⚠️ | Vivienda habitual: exenta sin reinversión. Otros elementos: exenta si se constituye renta vitalicia ≤ 240.000 € en 6 meses | Art. 38.3 / 33.4.b |
| Exención transmisión vivienda habitual por dependencia severa/gran dependencia | ⚠️ | Exenta | Art. 33.4.b |
| Pérdidas: no cómputo de pérdidas por transmisiones con recompra (2 meses valores cotizados / 1 año no cotizados) | ⚠️ | Art. 33.5 | LIRPF |

### 3.8 Integración y compensación (arts. 44–49)

| Parámetro | Estado | Valor 2025 | Fuente |
|---|---|---|---|
| Base general: saldo de rendimientos + imputaciones (integración ilimitada entre sí) | ✅ | Art. 48.a | |
| Base general: saldo de ganancias/pérdidas no derivadas de transmisión; si negativo, compensa hasta el **25 %** del saldo positivo de rendimientos; exceso a 4 años | ✅ | Art. 48.b | |
| Base del ahorro: rendimientos del capital mobiliario del ahorro; saldo negativo compensa hasta **25 %** del saldo positivo de ganancias del ahorro | ✅ | Art. 49.1.a | |
| Base del ahorro: ganancias/pérdidas por transmisión; saldo negativo compensa hasta **25 %** del saldo positivo de rendimientos del ahorro; exceso a 4 años | ✅ | Art. 49.1.b | |

### 3.9 Reducciones de la base imponible general (arts. 51–55, 61 bis, 84)

| Parámetro | Estado | Valor 2025 | Fuente |
|---|---|---|---|
| Aportaciones a sistemas de previsión social (planes de pensiones, etc.) | ⚠️ | Límite: menor de 1.500 € o 30 % de rendimientos netos del trabajo y actividades; +8.500 € por contribuciones empresariales (con condiciones de proporción según aportación del trabajador); +5.000 € seguros colectivos de dependencia | Arts. 51–52; DA 16ª |
| Aportaciones a favor del cónyuge (rendimientos del cónyuge <8.000 €) | ⚠️ | Máx. 1.000 € | Art. 51.7 |
| Reducción por tributación conjunta | ✅ | **3.400 €** unidad familiar biparental · **2.150 €** unidad familiar monoparental (no aplicable si se convive con el otro progenitor) | Art. 84.2; AEAT Manual 2025 |
| Pensiones compensatorias al cónyuge y anualidades por alimentos (salvo a hijos) fijadas judicialmente | ⚠️ | Reducen la base imponible general (sin límite propio, hasta agotarla; resto a la del ahorro) | Art. 55 |
| Aportaciones a patrimonios protegidos de personas con discapacidad | ⚠️ | Límite 10.000 €/aportante y 24.250 €/conjunto | Art. 54 |

### 3.10 Deducciones de la cuota — estatales (art. 68 y DDTT)

| Parámetro | Estado | Valor 2025 | Fuente |
|---|---|---|---|
| Deducción por inversión en vivienda habitual — **régimen transitorio** | ⚠️ | Solo para adquisiciones **anteriores a 01-01-2013**. 15 % (7,5 % tramo estatal + 7,5 % autonómico salvo que la CCAA fije otro) sobre base máxima 9.040 €. Incluye cuentas vivienda no; obras de adecuación por discapacidad base 12.080 € al 20 % (10+10). | DT 18ª LIRPF |
| Deducción por alquiler de vivienda habitual — régimen transitorio estatal | ⚠️ | Contratos **anteriores a 01-01-2015**: 10,05 % sobre base máx. 9.040 € si base imponible <24.107,20 € | DT 15ª LIRPF |
| Deducción por donativos (Ley 49/2002, mod. RDL 6/2023) | ⚠️ | **80 %** primeros 250 € · **40 %** resto (**45 %** si donativo recurrente a la misma entidad ≥ 3 años). Límite 10 % base liquidable. Donativos a fundaciones/partidos no L.49/2002: 10 %/20 % con límites. | Art. 68.3 LIRPF; Ley 49/2002 art. 19; RDL 6/2023 |
| Deducción por obras de mejora de eficiencia energética en viviendas | ⚠️ | 20 % / 40 % / 60 % según tipo de obra y reducción de demanda/consumo; bases máximas 5.000 / 7.500 / 15.000 €. Prorrogada — confirmar vigencia 2025. | DA 50ª LIRPF; RDL 19/2021 y prórrogas |
| Deducción por adquisición de vehículos eléctricos "enchufables" e instalación de puntos de recarga | ⚠️ | 15 %, bases máx. 20.000 € / 4.000 €. Vigencia prorrogada — confirmar 2025. | DA 58ª LIRPF; RDL 5/2023 |
| Deducción por rentas obtenidas en **Ceuta y Melilla** | ✅ | 60 % de la parte de cuota correspondiente a rentas obtenidas y computadas en Ceuta/Melilla (residentes); 50 % no residentes con ciertas rentas | Art. 68.4 LIRPF |
| Deducción por doble imposición internacional | ⚠️ | Menor de: impuesto extranjero / tipo medio efectivo × renta extranjera | Art. 80 |
| Deducción por maternidad (impropia, art. 81) | ⚠️ | 1.200 €/año por hijo <3 años (madres trabajadoras); +1.000 € por gastos de guardería/centro autorizado | Art. 81 |
| Deducción por familia numerosa / ascendiente o descendiente con discapacidad a cargo / cónyuge con discapacidad (art. 81 bis) | ⚠️ | 1.200 €/año (familia numerosa general, +600 €/hijo desde el 4º/6º) · 2.400 € (especial) · 1.200 € por ascendiente/descendiente con discapacidad · 1.200 € cónyuge con discapacidad (rentas <8.000 €) | Art. 81 bis |
| Deducción por unidades familiares con residentes en otros Estados UE/EEE | ⚠️ | Equipara al efecto de la tributación conjunta cuando no se puede optar a ella | DA 48ª |
| Límites conjuntos de determinadas deducciones (base de inversiones empresariales art. 68.2) | ⚠️ | Remisión a normativa del Impuesto sobre Sociedades | Art. 68.2 |
| Obligación de declarar — umbrales | ⚠️ | Trabajo: 22.000 € (1 pagador) / 15.876 € (>1 pagador con 2º y ss. >1.500 €). Confirmar cifra 2025 (era 15.876 € en 2024). Capital mobiliario + ganancias sujetas a retención: 1.600 €. Rentas inmobiliarias imputadas, etc.: 1.000 €. | Art. 96 LIRPF |

### 3.11 Reparto estatal/autonómico y cuota líquida

| Parámetro | Estado | Valor 2025 | Fuente |
|---|---|---|---|
| Reparto de la deducción por vivienda (transitoria) y del tramo autonómico de deducciones estatales | ⚠️ | 50 % estatal / 50 % autonómico salvo porcentaje autonómico propio | Art. 78, DT 18ª |
| Cuota líquida estatal mínima / incremento por pérdida del derecho a deducciones | ⚠️ | Art. 59 RIRPF | |
| Gravamen especial sobre premios de loterías (DA 33ª) | ⚠️ | 20 % sobre el exceso de 40.000 € exentos | DA 33ª LIRPF |

---

## 4. Mapa de parámetros — CCAA de régimen común (17 territorios)

**Estructura común a los 17 ficheros `params/2025/comun_<cca>.yaml`:**

Cada CCAA aporta exactamente dos bloques sobre el núcleo estatal:

**A) Escala autonómica de la base liquidable general** (sustituye al art. 65 supletorio)
- `escala_autonomica_general`: lista de tramos `{hasta, tipo}`.
- Estado global: ❌ **POR BUSCAR las 17** (con matices: algunas coinciden con la supletoria, otras están muy deflactadas o tienen más tramos).

**B) Deducciones autonómicas de la cuota íntegra autonómica** (art. 46 bis, Ley 22/2009, ley propia de cada CCAA)
Catálogo típico de *slots* a rellenar por CCAA (cada uno con importe/porcentaje, base máxima, límites de renta y requisitos):

| Slot de deducción autonómica | Presente en (aprox.) | Estado |
|---|---|---|
| Nacimiento o adopción de hijos | casi todas | ❌ |
| Familia numerosa | casi todas | ❌ |
| Familia monoparental | varias | ❌ |
| Por descendientes / cuidado de hijos menores (guardería) | varias | ❌ |
| Por ascendientes mayores / con discapacidad a cargo | varias | ❌ |
| Discapacidad del contribuyente | casi todas | ❌ |
| Arrendamiento de vivienda habitual (general) | casi todas | ❌ |
| Arrendamiento de vivienda habitual — jóvenes | muchas | ❌ |
| Adquisición/rehabilitación de vivienda habitual (jóvenes, zonas rurales, protegida) | muchas | ❌ |
| Gastos de vivienda en municipios en riesgo de despoblación / zonas rurales | Aragón, CyL, Galicia, C-LM, Extremadura, La Rioja… | ❌ |
| Donativos (medioambientales, culturales, I+D, mecenazgo, a fundaciones autonómicas) | casi todas | ❌ |
| Gastos de estudios / educación / material escolar / idiomas | Madrid, C. Valenciana, Baleares, Aragón… | ❌ |
| Gastos de salud / no cubiertos por la SS / primas de seguro médico | Cantabria, C. Valenciana, Andalucía… | ❌ |
| Inversión en acciones de nuevas entidades ("business angels") | casi todas | ❌ |
| Autoempleo / inicio de actividad / jóvenes autónomos | varias | ❌ |
| Conciliación / cuidado de familiares / empleada de hogar | Madrid, Andalucía, Canarias… | ❌ |
| Familia numerosa/monoparental — cuota íntegra | varias | ❌ |
| Acogimiento de menores / mayores | varias | ❌ |
| Alquiler para el arrendador (fomento) | algunas | ❌ |
| Adquisición de libros de texto / informática | varias | ❌ |
| Gastos de guardería 0–3 | varias | ❌ |
| Por cónyuge/pareja con discapacidad | algunas | ❌ |
| Por partos múltiples | varias | ❌ |
| Por víctimas del terrorismo / violencia de género | varias | ❌ |
| Deducciones "COVID"/donativos investigación (residuales) | algunas | ❌ |
| Deducción complementaria al tramo autonómico de la deducción estatal por vivienda | varias | ❌ |
| Deducción por inversión en vivienda habitual para <35 años (tramo autonómico) | varias | ❌ |

**Fuentes por CCAA (por localizar, una por comunidad):**
- Texto refundido / ley de medidas fiscales de cada CCAA (todas tienen uno consolidado).
- AEAT publica un anexo "Deducciones autonómicas" en el Manual Práctico Renta 2025, comunidad por comunidad — **es el atajo de partida** (✅ existe; ⚠️ hay que extraer y citar la norma autonómica detrás de cada cifra).

**Casos con estructura especial ya identificados:**
- **Madrid:** escala autonómica más baja que la supletoria; deflactación reciente; deducción por gastos educativos con tramos por concepto (escolaridad, idiomas, vestuario). ❌ valores.
- **Cataluña:** tramo autonómico propio con tipo mínimo elevado (>10 % en primer tramo hasta cierto punto); mínimo del contribuyente incrementado a 6.105 € para rentas bajas (art. autonómico). ⚠️ confirmar 2025.
- **Andalucía:** rebaja y deflactación de escala 2022–2023; amplio catálogo de deducciones. ❌.
- **C. Valenciana:** escala propia; deducciones muy numerosas con límites por base liquidable. ❌.
- **Illes Balears, Galicia, Aragón, Canarias, Extremadura, La Rioja, Cantabria, Asturias, Castilla-La Mancha, Castilla y León, Murcia:** cada una con escala propia y catálogo. ❌.

**Ceuta y Melilla (módulos 17–18):**
- Tramo autonómico: escala supletoria estatal (art. 65). ✅
- Bonificación por residencia: la deducción del art. 68.4 (60 % de la cuota) actúa de facto como su "beneficio autonómico". ✅
- Deducciones propias de las Ciudades Autónomas: ❌ verificar si existen (Ceuta y Melilla tienen algunas por su régimen especial).

---

## 5. Mapa de parámetros — Territorios Históricos vascos

**Diferencias estructurales frente al territorio común (aplican a los 3):**

1. **No hay escala estatal + autonómica.** Hay **una sola tarifa foral** sobre la base liquidable general (art. 75 NF Bizkaia / equivalentes). La "cuota íntegra" es única (la mapeamos al campo `cuota_integra_autonomica`/`cuota_integra_foral`; `cuota_integra_estatal` = 0).
2. **Las circunstancias familiares no son "mínimos" que reducen la base**, sino **deducciones de la cuota** ("minoración de cuota" general + deducciones por descendientes, ascendientes, edad, discapacidad, tributación conjunta). Esto cambia el orden del pipeline.
3. **Tarifa del ahorro foral propia** (tipos y tramos distintos de los estatales).
4. **Bonificación del trabajo** (art. 23 NF) en vez de la reducción del art. 20 estatal: importe a tanto alzado con minoración para rentas altas.
5. **Exención de dividendos** hasta 1.500 € (art. 9.24 NF Bizkaia) — mantiene lo que el Estado derogó en 2015.
6. **Coeficientes de actualización** del valor de adquisición de inmuebles en ganancias patrimoniales (el territorio común los suprimió; el foral los mantiene).
7. **DT 9ª foral** (equivalente al abatimiento pre-1994) con su propia redacción y límites.
8. Tratamiento propio de EPSV (Entidades de Previsión Social Voluntaria) en las reducciones de base.
9. Estimación objetiva foral: **Decreto Foral de módulos** propio de cada Diputación (no la Orden HFP estatal).

### 5.1 Bizkaia — Norma Foral 13/2013 (ejercicio 2025)

| Parámetro | Estado | Valor | Fuente |
|---|---|---|---|
| Tarifa general (art. 75) 2025 | ⚠️ | La versión **2026** (NF 7/2025, deflactación 2 %) es: 18.080 → 23 % · 36.160 → 28 % · 54.240 → 35 % · 77.450 → 40 % · 107.260 → 45 % · 142.960 → 46 % · 208.390 → 47 % · resto → 49 %. **Falta la tabla 2025** (anterior a esa deflactación) — la da la NF de Presupuestos 2025 y el Manual/Norma consolidada a 2025. | Iberley art. 75; DFB "Comparativa cambios IRPF 2025" (KA-01876) — POR EXTRAER |
| Tarifa del ahorro foral 2025 | ❌ | Tramos y tipos propios (históricamente ~20 % → 25 %, con tramos en 2.500 / 10.000 / 15.000 / 30.000 €; revisar si hay nuevos tramos altos). | Art. 76 NF 13/2013 consolidada 2025 |
| Bonificación por trabajo (art. 23 NF) | ❌ | Importe a tanto alzado (~4.000 €) con reducción progresiva para rendimientos altos y suplemento por discapacidad. Cifras 2025. | Art. 23 NF 13/2013 |
| "Otros gastos deducibles" del trabajo (equivalente al 2.000 € estatal) | ❌ | Verificar si existe y cuantía | NF 13/2013 |
| Minoración de cuota general (art. 77 NF) | ❌ | Importe fijo por declarante (~1.500 €) — cifra 2025 | Art. 77 NF |
| Deducción por descendientes (art. 79 NF) | ❌ | Importes por orden: 1º / 2º / 3º / 4º / 5º y ss. (crecientes), + suplemento por cada descendiente <6 años. Cifras 2025. | Art. 79 NF |
| Deducción por abono de anualidades por alimentos a hijos | ❌ | % sobre las cantidades abonadas | Art. 79 NF |
| Deducción por ascendientes (art. 80 NF) | ❌ | Importe fijo por ascendiente a cargo | Art. 80 NF |
| Deducción por discapacidad o dependencia (art. 81 NF) | ❌ | Importes por grado (33–65 %, ≥65 %, con ayuda de terceros) y por dependencia | Art. 81 NF |
| Deducción por edad (art. 82 NF) | ❌ | Contribuyentes >65 y >75 con base ≤ umbral | Art. 82 NF |
| Deducción por tributación conjunta (art. 78 NF) | ❌ | Importe fijo (biparental / monoparental) | Art. 78 NF |
| Mínimo exento / umbrales de obligación de declarar | ❌ | Propios de Bizkaia (p. ej. 20.000 € un pagador con matices) | NF 13/2013 art. 102 y ss. |
| Exención dividendos art. 9.24 NF | ✅ (existencia) | Exentos los primeros **1.500 €/año** de dividendos y participaciones en beneficios (con exclusiones: valores adquiridos en los 2 meses previos si se transmiten en los 2 meses siguientes, etc.). | Art. 9.24 NF 13/2013 |
| Reducción por arrendamiento de vivienda | ❌ | % foral (históricamente 20 % + bonificación de gastos sin justificación) | Art. 32 NF |
| Rendimiento del capital inmobiliario — gasto a tanto alzado 20 % + intereses | ❌ | Modelo foral distinto del estatal (deducción del 20 % de los ingresos + gastos financieros) | Art. 32 NF |
| Ganancias patrimoniales: coeficientes de actualización 2025 | ❌ | Tabla anual de coeficientes (Decreto Foral / Norma de Presupuestos) | NF 13/2013 art. 45–46 + norma anual |
| DT 9ª foral (elementos pre-31-12-1994) | ⚠️ | Estructura análoga a la estatal (coef. 100 %/año de exceso sobre 10 años, con límites); redacción foral propia. Tu trabajo la usa ⇒ prioridad de validación. | DT NF 13/2013 |
| Tratamiento EPSV en reducciones de base | ❌ | Límites propios de aportación (individual + empresarial) | Art. 70–72 NF |
| Reducción por tributación conjunta (si opera como reducción de base y no solo como deducción) | ❌ | Confirmar naturaleza | NF 13/2013 |
| Deducciones vivienda habitual (adquisición y alquiler) — **vigentes, no transitorias** | ❌ | Bizkaia mantiene deducción por adquisición (18 % / crédito fiscal vivienda con límite vital ~36.000 €) y por alquiler (20 %, límite ~1.600 €, más para jóvenes/familia numerosa). Cifras 2025. | Arts. 87–89 NF |
| Deducciones por donativos, mecenazgo, cuotas sindicales/partidos, doble imposición dividendos | ❌ | % forales | Arts. 90 y ss. NF |
| Deducción por participación de trabajadores en su empresa | ❌ | % foral | NF |
| Estimación objetiva — Decreto Foral de módulos de Bizkaia 2025 | ❌ 🔵 | Régimen foral propio; magnitudes y módulos por actividad | Decreto Foral anual DFB |

> **Nota:** Bizkaia es el hito 1 junto con el estatal. Necesito (a) tu documento de fiscalidad para fijar el ejercicio exacto y cotejar cada importe, y (b) descargar la NF 13/2013 **consolidada a 2025** y las Normas Forales de Presupuestos 2024 y 2025 (deflactaciones). Ver §9 y §11.

### 5.2 Gipuzkoa — Norma Foral 3/2014

- Misma estructura que Bizkaia. Tarifa general y del ahorro **armonizadas con Bizkaia** (el Órgano de Coordinación Tributaria mantiene alineados los tres territorios en tarifa; difieren en algunas deducciones y detalles). ⚠️ confirmar identidad de tarifa 2025.
- Todos los *slots* del §5.1 replicados con numeración de artículos de la NF 3/2014. Estado: ❌.
- Fuente: NF 3/2014 consolidada; boletines de Presupuestos de Gipuzkoa (NF 6/2025 para 2026 ya publicada).

### 5.3 Araba/Álava — Norma Foral 33/2013

- Misma estructura. Tarifa armonizada con Bizkaia/Gipuzkoa. ⚠️ confirmar 2025.
- Todos los *slots* del §5.1 con numeración de la NF 33/2013. Estado: ❌.
- Fuente: NF 33/2013 consolidada; Normas Forales de ejecución presupuestaria de Álava; BOTHA.

---

## 6. Mapa de parámetros — Navarra

**Norma:** Texto Refundido de la Ley Foral del IRPF (Decreto Foral Legislativo 4/2008), redacción vigente 2025; Ley Foral de modificación de tributos anual; Convenio Económico (Ley 28/1990).

**Diferencias estructurales frente al territorio común:**

1. **Tarifa única foral** sobre la base liquidable general (no hay split estatal/autonómico). Históricamente ~13 % → 52 % en más tramos que el Estado.
2. **Tarifa del ahorro foral propia** (tramos y tipos distintos; Navarra ha tenido tipos marginales del ahorro más altos, hasta ~28–30 % en tramos altos con umbrales propios).
3. **Mínimos personales y familiares que operan como deducción de la cuota** (no como reducción de la base): Navarra convierte el mínimo en una deducción calculada aplicando la tarifa al mínimo teórico, con importes propios por contribuyente, descendientes, ascendientes, discapacidad y edad.
4. **Reducción por rendimientos del trabajo** con tabla propia (importes y umbrales distintos del art. 20 estatal).
5. Catálogo propio de deducciones: vivienda (adquisición y alquiler, vigentes y generosas para jóvenes), familia numerosa, por hijos, pensiones, donaciones, I+D, trabajo (deducción por rendimientos del trabajo en cuota), inversión en vivienda en pueblos, etc.
6. **Estimación objetiva:** Orden Foral de módulos propia del Departamento de Economía y Hacienda de Navarra.
7. Tratamiento propio de planes de pensiones y de EPSV.
8. Deducción por trabajo y "deducción por pensiones de viudedad / jubilación" específicas.

| Bloque de parámetros Navarra | Estado | Fuente |
|---|---|---|
| Tarifa general (art. 59 TR) 2025 | ❌ | TR IRPF Navarra consolidado + Ley Foral de presupuestos/medidas 2025; BON |
| Tarifa del ahorro (art. 60 TR) 2025 | ❌ | idem |
| Deducción por mínimo personal y familiar (importes por contribuyente, descendientes 1º–…, ascendientes, discapacidad, edad) | ❌ | Arts. 62 y ss. TR |
| Reducción/deducción por rendimientos del trabajo (tabla propia) | ❌ | Art. 55 TR (reducción) y art. 62.a (deducción por trabajo en cuota) |
| Reducción por tributación conjunta / reglas de unidad familiar | ❌ | Art. 71 y ss. TR |
| Deducciones por vivienda (adquisición jóvenes, alquiler, alquiler emancipación) | ❌ | Art. 62.1 TR |
| Deducción por familia numerosa | ❌ | Art. 62.6 TR |
| Deducción por descendientes con discapacidad / por cuidado | ❌ | Art. 62 TR |
| Deducciones por donativos y mecenazgo (Ley Foral 10/1996 y ss.) | ❌ | Ley Foral de mecenazgo |
| Aportaciones a previsión social — límites forales | ❌ | Art. 55 TR |
| Coeficientes de actualización de inmuebles (ganancias) 2025 | ❌ | Ley Foral anual; BON |
| Régimen transitorio elementos pre-1994 (equivalente DT 9ª) | ❌ | DT TR IRPF Navarra |
| Estimación objetiva — Orden Foral de módulos 2025 | ❌ 🔵 | Orden Foral HAP Navarra |
| Umbrales de obligación de declarar | ❌ | Art. 78 TR |

---

## 7. Tipos de renta y reglas de integración — matriz por régimen

| Concepto | Territorio común | Forales (PV) | Navarra |
|---|---|---|---|
| Estructura de la tarifa BLG | Estatal (art. 63) + Autonómica (art. 74) | Única foral (art. 75 NF) | Única foral (art. 59 TR) |
| Tarifa del ahorro | Estatal + autonómica, tramos 6k/50k/200k/300k, 19–30 % | Foral propia | Foral propia |
| Circunstancias familiares | Reducen la **base** (mínimo personal y familiar, arts. 56–61) aplicando la tarifa al mínimo | **Deducción de cuota** (minoración + deducciones familiares) | **Deducción de cuota** (tarifa aplicada al mínimo teórico) |
| Reducción rendimientos del trabajo | Art. 20 (máx. 7.302 € en 2025) | Bonificación del trabajo (art. 23 NF, a tanto alzado) | Reducción propia (art. 55 TR) + deducción por trabajo |
| Exención dividendos 1.500 € | ❌ No (derogada 2015) | ✅ **Bizkaia** art. 9.24 NF (verificar Gipuzkoa/Álava) | ⚠️ verificar |
| Coef. actualización inmuebles (ganancias) | ❌ Suprimidos 2015 | ✅ Vigentes (tabla anual) | ✅ Vigentes (tabla anual) |
| Abatimiento pre-1994 | DT 9ª LIRPF (límite 400.000 € valor transmisión) | DT foral propia | DT foral propia |
| Integración/compensación general↔ahorro | Límite 25 % (art. 48–49) | Reglas forales (verificar % y plazos) | Reglas forales |
| Estimación objetiva | Orden HFP estatal | Decreto Foral de cada Diputación | Orden Foral de Navarra |

---

## 8. Circunstancias personales y familiares — cómo las trata cada territorio

Matriz a completar (filas = circunstancia; columnas = 22 territorios) con el **mecanismo** (mínimo en base / deducción en cuota / reducción / no contemplado) y la **cuantía**. Circunstancias:

- Edad del contribuyente (>65, >75)
- Discapacidad del contribuyente (33–64 %, ≥65 %, con ayuda de terceros / movilidad reducida)
- Nº de descendientes (1º, 2º, 3º, 4º+), y descendientes <3 años / <6 años
- Descendientes con discapacidad
- Ascendientes a cargo (>65, >75, con discapacidad)
- Familia numerosa general / especial
- Familia monoparental
- Tributación conjunta (biparental / monoparental)
- Nacimiento o adopción en el ejercicio
- Partos múltiples
- Acogimiento

Este es el entregable que hace única la herramienta (§2.9 "comparador de perfiles"). Se rellena a medida que se cierran las jurisdicciones.

---

## 9. Caso de validación — tu trabajo de fiscalidad

**Uso:** *golden test* del hito 1. El motor común y el foral de Bizkaia deben reproducir **exactamente** (al céntimo, o con tolerancia ≤ 0,01 €) tus liquidaciones de Ramón, Susana y Ricardo.

**Necesito que me pases:**
1. El documento con las tres liquidaciones (enunciado + solución paso a paso).
2. Confirmación del **ejercicio** al que están referidas (¿2023? ¿2024?) — fija el juego de parámetros contra el que validar.
3. Qué figuras concretas tocan, para priorizar: por lo que mencionas, al menos —
   - LIRPF territorio común (Ramón / Susana / Ricardo, o parte de ellos).
   - NF 13/2013 de Bizkaia.
   - Régimen transitorio **DT 9ª** (activos adquiridos antes de 1994) — abatimiento.
   - Exención **art. 9.24 NF** de dividendos (1.500 €).

**Cómo se incorpora:** cada liquidación se codifica como un `hogar` en `tests/casos_validacion/` con su resultado esperado; `testthat` compara campo a campo (`base_imponible_general`, `base_del_ahorro`, `cuota_integra`, `deducciones`, `cuota_liquida`, `tipo_efectivo`). No se avanza al hito 2 hasta que los tres pasan.

---

## 10. Roadmap por hitos

| Hito | Contenido | Precondición |
|---|---|---|
| **H0** | *(este documento)* Mapa de parámetros + arquitectura, revisado y aprobado por Alex | — |
| **H1** | `core/` + módulo **estatal** (territorio común, sin deducciones autonómicas) + módulo **Bizkaia**, ambos en estimación directa. Validación con tus 3 casos. | H0 aprobado + documento de fiscalidad + parámetros estatales/Bizkaia 2025 completos |
| **H2** | Módulos **Gipuzkoa**, **Araba** y **Navarra** | H1 verde + parámetros forales + Navarra completos |
| **H3** | Los **17 módulos de CCAA de régimen común** (escala autonómica + deducciones autonómicas), en bloques de 3–4 | H1 verde + parámetros por CCAA |
| **H4** | Subsistema de **estimación objetiva / módulos** (estatal + forales + Navarra) | H1–H3 |
| **H5** | **Muestra sintética** + calibración por territorio | H1 (motor usable) |
| **H6** | **Motor de reformas** + **métricas** distributivas | H5 |
| **H7** | **Dashboard Shiny** | H6 |
| **H8** | Juego de parámetros **IRPF 2026** + validaciones adicionales | normas 2026 definitivas |

---

## 11. Preguntas abiertas / decisiones que necesito de ti

**Bloqueantes para empezar H1:**

1. **Pásame el documento de fiscalidad** (liquidaciones Ramón/Susana/Ricardo) y **dime el ejercicio** al que corresponde. Es la referencia de validación y fija el año del juego foral a cotejar primero.
2. ¿Las liquidaciones incluyen **anualidades por alimentos a hijos** y/o **pensiones compensatorias**? (define si entran en H1).
3. ¿Alguna de ellas usa **estimación objetiva/módulos** o son todas estimación directa? (si son directa, módulos se va a H4 sin bloquear H1).

**De diseño (puedes contestar "como propongas"):**

4. Granularidad del input de rentas del trabajo: ¿detalle art. 19 (recomendado) o `rendimiento_neto` agregado?
5. Unidad de análisis de la muestra: hogar fiscal con selección automática individual/conjunta — ¿de acuerdo?
6. Estimación objetiva completa: confirmas que puede ir en **H4** (después de validar el núcleo), no en H1.
7. Métricas: ¿quieres además de Gini los índices de Reynolds-Smolensky y Kakwani (progresividad/redistribución)? (recomiendo sí, es barato y es lo que se publica en la literatura).
8. ¿Nombre del paquete `irpfsim` te vale?

**Para que yo busque (no bloquean H0, sí H1–H3):**

9. NF 13/2013 de Bizkaia **consolidada a 2025** + Normas Forales de Presupuestos de Bizkaia 2024 y 2025 (deflactaciones y tarifa 2025).
10. Orden HFP de módulos 2025 (BOE) y Decretos/Órdenes Forales de módulos 2025.
11. Anexo "Deducciones autonómicas" del Manual Práctico Renta 2025 (AEAT) + textos consolidados de las 17 leyes autonómicas de medidas fiscales.
12. TR del IRPF de Navarra consolidado + Ley Foral de medidas tributarias 2025.
13. Estadística de declarantes del IRPF por CCAA (AEAT) y equivalentes forales, ejercicio de referencia, para calibración.

---

## 12. Fuentes consultadas para este borrador

**Estatal (IRPF 2025):**
- [Ley 35/2006 del IRPF — BOE consolidado](https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764)
- [AEAT — Manual Práctico Renta 2025: gravamen estatal de la base liquidable general](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/gravamen-base-liquidable-general/gravamen-estatal.html)
- [AEAT — Manual Práctico Renta 2025: gravamen estatal de la base liquidable del ahorro](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/gravamen-base-liquidable-ahorro/gravamen-estatal.html)
- [AEAT — Manual Práctico Renta 2025: cuadro-resumen del mínimo personal y familiar](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c14-adecuacion-impuesto-circunstancias-personales/cuadro-resumen-minimo-personal-familiar.html)
- [AEAT — Manual Práctico Renta 2025: reducción por obtención de rendimientos del trabajo](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-ayuda-presentacion/irpf-2025/7-cumplimentacion-irpf/7_1-rendimientos-trabajo-personal/7_1_6-reduccion-obtencion-rendimientos-trabajo.html)
- [AEAT — Manual Práctico Renta 2025: reducción por tributación conjunta](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c13-determinacion-renta-contribuyente-sujeta-gravamen/reducciones-base-imponible-general/reduccion-tributacion-conjunta.html)
- [Iberley — art. 20 LIRPF](https://www.iberley.es/legislacion/articulo-20-ley-impuesto-sobre-renta-personas-fisicas-irpf)
- [Cuatrecasas — Incremento del tipo del ahorro en IRPF a partir de 2025](https://www.cuatrecasas.com/es/spain/fiscalidad/art/irpf-incremento-tipo-ahorro-2025)

**Bizkaia:**
- [Norma Foral 13/2013 del IRPF de Bizkaia — texto (gardentasuna.bizkaia.eus)](https://gardentasuna.bizkaia.eus/documents/5956715/5957343/NORMAFORAL13-2013.pdf)
- [Iberley — art. 75 NF 13/2013 (tarifa general)](https://www.iberley.es/legislacion/articulo-75-irpf-bizkaia)
- [Iberley — NF 13/2013 de Bizkaia (texto consolidado)](https://www.iberley.es/legislacion/nf-13-2013-5-dic-bizkaia-irpf-bizkaia-12885235)
- [DFB — Comparativa de cambios en el IRPF de Bizkaia para 2025](https://dfb.microsoftcrmportals.com/es-ES/Articulo/?Code=KA-01876)
- [Fiscal-impuestos — Bizkaia: Presupuestos 2026, tarifa IRPF (NF 7/2025)](https://www.fiscal-impuestos.com/Bizkaia-presupuestos-2026-actualizacion-beneficios-fiscales-tarifa-IRPF-tasa-prevencion-extincion-incendios-salvamento)

**Otros territorios (punto de partida):**
- [Guía fiscal — Tablas IRPF País Vasco (Bizkaia, Gipuzkoa, Álava)](https://guiafiscal.es/irpf/pais-vasco/)
- [Gipuzkoa — NF 6/2025 de Presupuestos 2026](https://www.gipuzkoa.eus/es/web/ogasuna/-/6/2025_foru_araua)

> Las fuentes secundarias (Iberley, Cuatrecasas, guías) se usan solo como orientación; **cada parámetro que entre en el motor se cita contra su norma primaria** (BOE, BOB, BOG, BOTHA, BON, boletín autonómico).
