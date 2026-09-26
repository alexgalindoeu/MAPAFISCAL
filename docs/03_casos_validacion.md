# Casos de validación (cálculo verificado a mano)

Estos casos están codificados en `tests/testthat/test-liquidacion.R` y se ejecutan
en cada `Rscript tests/testthat.R`. Cada uno se desarrolla paso a paso aquí para
poder auditar el motor.

> Nota: se usan los parámetros del ejercicio **2025**. No dependen del trabajo de
> la asignatura de fiscalidad (herramienta independiente).

---

## Caso A — Soltero, 30.000 € de trabajo, residente en Madrid (régimen común)

**Datos:** rendimientos íntegros del trabajo 30.000 €; cotizaciones SS 1.905 €;
sin hijos; sin otras rentas; retenciones 3.500 €.

| Paso | Cálculo | Importe |
|---|---|---|
| Rendimiento íntegro trabajo | 30.000 | 30.000,00 |
| (−) Cotizaciones SS | −1.905 | |
| (−) Otros gastos art. 19.2.f | −2.000 | |
| **Rendimiento neto previo** | 30.000 − 3.905 | 26.095,00 |
| (−) Reducción art. 20 | íntegro − gastos a) a e) = 28.095 > 19.747,50 ⇒ 0 | 0,00 |
| **Rendimiento neto del trabajo = Base imponible general** | | 26.095,00 |
| Base liquidable general | (sin reducciones) | 26.095,00 |
| Mínimo del contribuyente | art. 57 (estatal) | 5.550,00 |
| Mínimo del contribuyente autonómico | art. 2 DL 1/2010 de Madrid (solo tramo autonómico) | 5.956,65 |
| Cuota íntegra **estatal** | escala art. 63 (26.095) − escala(5.550) = 2.997,00 − 527,25 | **2.469,75** |
| Cuota íntegra **autonómica** (Madrid) | escala CM (26.095) − escala(5.956,65) = 2.647,09 − 506,32 | **2.140,78** |
| Cuota íntegra total | | 4.610,53 |
| Deducciones | ninguna | 0,00 |
| **Cuota líquida total** | | **4.610,53** |
| (−) Retenciones | | −3.500,00 |
| **Cuota diferencial** (a ingresar) | | **1.110,53** |
| Tipo medio efectivo | 4.610,53 / 26.095 | 17,67 % |

Detalle escala autonómica Madrid sobre 26.095:
`13.362,22×8,5% + 5.642,41×10,7% + 7.090,37×12,8% = 1.135,79 + 603,74 + 907,57 = 2.647,09`.

---

## Caso B — Soltero, 30.000 € de trabajo, residente en Bizkaia (foral, NF 13/2013)

| Paso | Cálculo | Importe |
|---|---|---|
| Rendimiento íntegro trabajo | | 30.000,00 |
| (−) Cotizaciones SS | −1.905 (no aplica el "otros gastos" de 2.000 € estatal) | |
| **Rendimiento neto previo** | | 28.095,00 |
| (−) Bonificación del trabajo (art. 23 NF) | 28.095 > 23.000 ⇒ 3.000 | −3.000,00 |
| **Rendimiento neto = Base liquidable general** | | 25.095,00 |
| Cuota íntegra (tarifa foral art. 75) | 17.720×23% + 7.375×28% = 4.075,60 + 2.065,00 | **6.140,60** |
| (−) Minoración de cuota (art. 77 NF, Bizkaia 2025) | | −1.615,00 |
| (−) Deducciones familiares | soltero sin hijos ⇒ 0 | 0,00 |
| **Cuota líquida total** | | **4.525,60** |
| Tipo medio efectivo | 4.525,60 / 25.095 | 18,03 % |

Comparación con el Caso A: **mismo perfil, mismo salario** ⇒ Madrid 4.610,53 € /
Bizkaia 4.525,60 € (−1,8 %). Con hijos y ahorro la diferencia se amplía por el
distinto tratamiento (deducción de cuota foral vs. mínimo en base).

---

## Caso C — Soltero, 30.000 € de trabajo, residente en Navarra (foral, DFL 4/2008)

| Paso | Cálculo | Importe |
|---|---|---|
| Rendimiento neto previo | 30.000 − 1.905 | 28.095,00 |
| Base liquidable general | (Navarra canaliza el beneficio del trabajo por la deducción en cuota) | 28.095,00 |
| Cuota íntegra (tarifa foral art. 59) | 4.458×13% + 5.572×22% + 11.145×25% + 6.920×28% | **6.529,23** |
| (−) Deducción por mínimo personal (art. 62.9.a) | 1.084 + incremento por renta 283,85 | −1.367,85 |
| (−) Deducción por trabajo (art. 62.5) | RNT 28.095 ∈ (17.500, 35.000] ⇒ 700 | −700,00 |
| **Cuota líquida total** | | **4.461,38** |

Soltero sin hijos ⇒ el mínimo familiar (art. 62.9.b, ya implementado: 483 €/1er
descendiente…) no aplica. Faltan las deducciones de vivienda y familia numerosa de Navarra.

---

## Caso D — Exención de dividendos del art. 9.24 NF (solo País Vasco)

Dividendos percibidos: 5.000 €.

| Territorio | Base imponible del ahorro | Motivo |
|---|---|---|
| Cataluña (común) | 5.000,00 | El Estado derogó la exención en 2015 (Ley 26/2014) |
| Bizkaia (foral) | 3.500,00 | 5.000 − 1.500 exentos (art. 9.24 NF 13/2013) |

---

## Caso E — Régimen transitorio DT 9ª (activo adquirido antes de 1994)

Acciones cotizadas: valor de adquisición 10.000 € (01-06-1990), valor de
transmisión 50.000 € (01-03-2025). Ganancia bruta 40.000 €.

- Parte de la ganancia generada hasta 20-01-2006 (prorrateo lineal por días):
  ≈ 44,9 % ⇒ ≈ 17.966 € "reducible".
- Años de permanencia a 31-12-1996 que exceden de 2: 7 − 2 = 5.
- Coeficiente acciones cotizadas: 25 %/año ⇒ 5 × 25 % = 125 % → topado al 100 %.
- Reducción = 100 % × 17.966 ≈ 17.966 € ⇒ **ganancia computable ≈ 22.034 €**
  (frente a 40.000 € sin DT 9ª).

El test comprueba que `base_imponible_ahorro(con DT 9ª) < base_imponible_ahorro(sin DT 9ª)`
y que el caso sin DT 9ª computa los 40.000 € íntegros.

---

## Deducciones autonómicas — Cataluña (DL 1/2024)

Codificadas en `tests/testthat/test-ded-cataluna.R`. 7 de las 13 deducciones del
libro sexto del Código Tributario de Catalunya.

| Deducción (art.) | Regla | Comprobación |
|---|---|---|
| Nacimiento o adopción (612-1) | 150 €/progenitor (individual), 300 € (conjunta), solo año del nacimiento | — |
| Alquiler vivienda habitual (612-3) | 10 %, máx. 500 €, ≤ 35 años, *(base − mínimo) ≤ 30.000 / 45.000* | joven bajo umbral → 500 €; renta alta → 0 |
| Rehabilitación vivienda habitual (612-4) | 1,5 %, base máx. 9.040 € | 6.000 € → 90 €; 20.000 € → 135,60 € (tope) |
| Donativos fomento lengua catalana/occitana (612-6) | 15 %, tope 10 % de la cuota íntegra autonómica | — |
| Donativos a I+D+i (612-7) | 30 %, tope 10 % de la cuota íntegra autonómica | 400 € → 120 €; 50.000 € → 10 % de la cuota autonómica |
| Inversión de ángel inversor (612-9) | 40 %, límite 12.000 € | 10.000 € → 4.000 €; 40.000 € → 12.000 € |
| Inversión en cooperativas agrarias/vivienda (612-12) | 20 %, límite 3.000 € | 5.000 € → 1.000 € |

**Pendientes** (requieren campos de entrada que el motor no modela): viudedad
2023-2025 (612-2), alquiler de víctimas de violencia machista (612-11), deducción
por obligación de declarar por > 1 pagador (612-10), intereses de préstamos AGAUR
de máster/doctorado (612-5). El tramo autonómico general del 7,5 % por inversión en
vivienda (613-1) lo aplica ya la deducción estatal transitoria (DT 18ª LIRPF); el
9 % incrementado queda pendiente.

---

## Deducciones autonómicas — Galicia (DL 1/2011)

Codificadas en `tests/testthat/test-ded-cv-ga.R`. 7 deducciones (de ~24).

| Deducción (art.) | Regla | Comprobación |
|---|---|---|
| Nacimiento o adopción (5.Dos) | *(base − mínimo) ≤ 22.000*: 360 / 1.200 / 2.400 € por orden. *> 22.000*: 300 €/hijo (360 parto múltiple). Solo año del nacimiento. | 2 recién nacidos renta baja → 1.560 €; renta media → 300 € |
| Familias con dos hijos (5.Tres.1) | 250 € (exactamente 2 descendientes que dan mínimo) | 2 hijos → 250 €; 3 hijos → 0 |
| Familia numerosa (5.Tres.2) | 250 € (🟡 no se modela el +250 €/hijo desde el 3.º ni el ×2 por discapacidad) | 3 hijos FN → 250 € |
| Alquiler vivienda habitual (5.Siete) | 10 % / 300 € (general, ≤ 1 hijo); 20 % / 600 € (2+ hijos). ≤ 35 años, *(base − mínimo) ≤ 22.000 / 31.000* | joven sin hijos, alquiler 6.000 → 300 € |
| Cuidado de hijos menores (5.Cinco) | 30 % de empleada de hogar / escuela 0-3, máx. 400 € (🟡 no el de 600 €); *(base − mínimo) ≤ 22.000 / 31.000* | — |
| Libros de texto y material escolar (5.Veinticinco) | 15 % (🟡 tabla de tramos no modelada; tope de renta 22.000 / 31.000) | — |

**Pendientes** (inversión/donativos o condicionadas a municipio < 5.000 hab / aldeas
modelo, que el DSL no modela): acogimiento, discapacidad ≥ 65 % con ayuda de terceros,
nuevas tecnologías, inversión en acciones, donaciones I+D+i, climatización/ACS,
rehabilitación en centros históricos, eficiencia energética, incremento del 20 % del
nacimiento en municipios pequeños.

**DSL:** se añadieron las puertas `base_min_individual/conjunta` (deducción solo por
encima de una renta) y `descendientes_min/max` (nº exacto de descendientes).

---

## Deducciones autonómicas — Castilla y León (DL 1/2013)

Codificadas en `tests/testthat/test-ded-cyl.R`. 8 deducciones (de ~18).

| Deducción (art.) | Regla |
|---|---|
| Nacimiento o adopción (4) | 1.010 / 1.475 / 2.351 € por orden (🟡 importes del medio rural más altos, no modelados). Solo año del nacimiento |
| Familia numerosa (3) | 600 € (🟡 no el +1.000 €/hijo desde el 6.º ni el ×2 por discapacidad) |
| Alquiler vivienda habitual jóvenes (7.4) | 20 %, límite 459 €, ≤ 35 años |
| Cuidado de hijos — empleada de hogar (5.1) | 30 %, límite 322 € |
| Cuidado de hijos — escuela infantil de la Comunidad (5.1) | 100 %, límite 1.320 € |
| Cuotas SS de empleada de hogar (5.2) | 15 %, límite 300 €, con hijo < 4 años, *(base − mínimo) ≤ 18.900 / 31.500* |
| Discapacidad del contribuyente ≥ 65 años, grado 33-64 % (6) | 300 €, *(base − mínimo) ≤ 18.900 / 31.500* |
| Discapacidad del contribuyente ≥ 65 años, grado ≥ 65 % (6) | 656 € |
| Discapacidad del contribuyente < 65 años, grado ≥ 65 % (6) | 300 € |

**Pendientes:** partos/adopciones múltiples (4.4 — es un % de la deducción por
nacimiento, acoplada), gastos de adopción, deducciones de inversión y donativos,
vivienda joven en el medio rural (condicionada a municipio), movilidad sostenible.

**DSL:** se añadieron las puertas `descendiente_edad_max` (exige un descendiente por
debajo de una edad) y `requiere_discapacidad_grado` (`"33_64"` / `"65_mas"`).

---

## Deducciones autonómicas — Canarias (DL 1/2009)

Codificadas en `tests/testthat/test-ded-canarias.R`. 6 deducciones (de ~16).

| Deducción (art.) | Regla |
|---|---|
| Nacimiento o adopción (10) | 265 / 265 / 530 € por orden (🟡 4.º 796 €, 5.º+ 928 € no modelados), prorrateo entre progenitores, *base ≤ 46.455 / 61.770* |
| Familia numerosa general (13) | 597 € |
| Familia numerosa especial (13) | 796 € (597 + 199) |
| Familia monoparental (11 ter) | 133 € (con al menos un descendiente a cargo) |
| Gastos de custodia en guardería (12) | 18 % por descendiente < 3 años, límite 530 €/descendiente |
| Gastos de estudios no superiores (7 bis) | 100 % (libros, transporte, uniforme, comedor), límite 133 € (🟡 no el +66 €/descendiente adicional) |

**Pendientes:** gastos de estudios de educación superior fuera de la isla (7 —
necesita el dato "estudia fuera de la isla"), discapacidad de contribuyentes ≥ 65
años, traslado de residencia a otra isla, donativos, inversión en acciones.

---

## Deducciones autonómicas — Región de Murcia (DL 1/2010)

Codificadas en `tests/testthat/test-ded-murcia.R`. 7 deducciones (de ~27).
Fuente: TR de tributos cedidos de la Región de Murcia (DL 1/2010), art. 1, y
AEAT *Manual Práctico Renta 2025, Parte 2 — Deducciones autonómicas / Región de Murcia*.

| Deducción (art. 1.·) | Regla |
|---|---|
| Nacimiento o adopción (Nueve) | 100 / 200 / 300 € por orden del hijo nacido; *base ≤ 30.000 (ind.) / 50.000 (conj.)*; por mitad si ambos progenitores declaran y conviven |
| Gastos de guardería (Tres) | 20 % de los gastos de Primer Ciclo de Ed. Infantil (0–3 años), límite **1.000 €/hijo**; *base ≤ 30.000 / 50.000* |
| Material escolar y libros de texto (Ocho) | **120 € por descendiente** (2.º ciclo infantil, primaria y ESO); *base ≤ 20.000 / 40.000* (🟡 edad 3–16 aproxima la etapa; límites de familia numerosa 33.000/53.000 no modelados); prorrateo |
| Contribuyentes con discapacidad (Diez) | **150 €** por contribuyente con grado ≥ 33 %; *base ≤ 40.000* (ind. o conj.) |
| Conciliación — cuidado de descendientes (Once.A) | 20 % de las cuotas del Sistema Especial de Empleados de Hogar, límite **400 €**; al menos un hijo < 12 años (🟡 requiere alta como empleador; se usa el campo `cuotas_ss_empleada_hogar`) |
| Familia monoparental (Dieciséis) | **303 €** con descendientes a cargo; *base + anualidades exentas ≤ 35.240 €* |
| Arrendamiento de vivienda habitual (Trece) | 10 % de lo pagado, máx. **300 €/contrato**; ≤ 40 años (🟡 alternativas familia numerosa / discapacidad ≥ 65 % no modeladas) |

### Comprobación numérica (test `mc_familia`, validado R↔JS)

Monoparental en Murcia, declarante 38 años, trabajo 28.000 € (cot. SS 1.778),
`cuotas_ss_empleada_hogar` = 3.000; hijo de 1 año con 6.000 € de guardería; hijo de 8 años.

- Guardería: 20 % · 6.000 = 1.200 → **1.000** (tope por hijo).
- Conciliación: 20 % · 3.000 = 600 → **400** (tope); hay hijo < 12.
- Material escolar: el hijo de 8 años → **120** (el de 1 año queda fuera del tramo 3–16).
- Total deducciones autonómicas = 1.520. `cuota_líquida_total` = **1.090,80 €**
  (idéntica en el motor R y en `irpfsim.js`).

**Pendientes:** inversión en vivienda habitual para jóvenes ≤ 40, deducción para
mujeres trabajadoras, conciliación por cuidado de ascendientes (Once.B), acogimiento
no remunerado de mayores, adquisición de vivienda por familias numerosas, y la
batería de donativos e inversiones (patrimonio cultural, investigación biosanitaria,
ahorro de agua, energías renovables, entidades de nueva creación, etc.).

---

## Deducciones autonómicas — Aragón (DL 1/2005), régimen general

Codificadas en `tests/testthat/test-ded-aragon.R`. 5 deducciones (de ~19).
Fuente: TR de tributos cedidos de Aragón (DL 1/2005), art. 110, y AEAT *Manual
Práctico Renta 2025, Parte 2 — Deducciones autonómicas / Aragón*.

**Solo se modela el régimen general.** El *régimen de fiscalidad diferenciada*
(importes ~20 % más altos para residentes en asentamientos rurales con alto riesgo
de despoblación) depende del municipio y no se modela.

| Deducción (art.) | Regla |
|---|---|
| Nacimiento/adopción 3.er hijo o sucesivos (110-2) | 500 € por hijo nacido que sea el 3.º o posterior; **600 €** si *base − (mínimo contrib. + mínimo desc.) ≤ 21.000 (ind.) / 35.000 (conj.)*; prorrateo entre progenitores |
| Cuidado de personas dependientes (110-5) | **150 €**; dependiente = ascendiente ≥ 75 años o ascendiente/descendiente con discapacidad ≥ 65 %; *base − mínimo ≤ 21.000 / 35.000*; prorrateo (🟡 se resta el MPF total en vez de casillas 511+513) |
| Mayores de 70 años (110-14) | **75 €** por contribuyente ≥ 70 años con rendimientos del trabajo/actividades; *base ≤ 23.000 (ind.) / 35.000 (conj.)* (🟡 el requisito de origen de la renta no se comprueba) |
| Gastos de guardería < 3 años (110-17) | 15 % de la custodia, límite **250 €/hijo** (🟡 125 € el año en que cumple 3; tope de base del ahorro 4.000 € no comprobado); *base liquidable < 35.000 / 50.000*; prorrateo |

### Comprobación numérica (test `ar_dependientes`, validado R↔JS)

Soltero de 72 años en Aragón, trabajo (pensión) 19.000 €, con un ascendiente de 82
años a cargo (sin rentas). Deducciones autonómicas = 75 (mayores de 70) + 150
(cuidado de dependientes) = 225. `cuota_líquida_total` = **609,12 €**, idéntica en R
y en `irpfsim.js`.

**Pendientes:** libros de texto y material escolar (110-11) y clases de apoyo/refuerzo
(110-21) — límites en tabla de tramos de base, no modelados; adopción internacional
(110-4) — necesita el dato "adopción internacional"; nacimiento de hijo con
discapacidad (110-3) — necesita marcar la discapacidad del recién nacido; las
condicionadas a municipio (nacimiento 1.º/2.º en poblaciones < 10.000 hab., vivienda
en núcleos rurales, residencia en determinados municipios); donativos e inversiones.

**DSL:** añadida la puerta `requiere_dependiente_a_cargo` (ascendiente ≥ 75 o
asc./desc. con discapacidad ≥ 65 %), en R y en el motor JS.

---

## Deducciones autonómicas — Extremadura (DL 1/2018)

Codificadas en `tests/testthat/test-ded-extremadura.R`. 5 deducciones (de ~19).
Fuente: TR de tributos cedidos de Extremadura (DL 1/2018), arts. 3–13, y AEAT
*Manual Práctico Renta 2025, Parte 2 — Deducciones autonómicas / Extremadura*.

Límites de renta **generales** del art. 12 bis: 19.000 € (individual) / 24.000 €
(conjunta). Los límites incrementados para residentes en municipios y entidades
locales menores < 3.000 hab. (28.000 / 45.000) **no se modelan**.

| Deducción (art.) | Regla |
|---|---|
| Arrendamiento de vivienda habitual (9) | 30 % de lo pagado, límite **1.000 €** (🟡 medio rural 30 %/1.500 y alternativas de familia numerosa / ascendiente separado con 2 hijos / discapacidad ≥ 65 % al requisito de < 36 años no modeladas) |
| Material escolar (10) | **15 € por hijo/descendiente** de 6 a 15 años (edad escolar obligatoria); prorrateo |
| Partos múltiples (3) | **300 € por cada hijo** nacido en el período en un parto múltiple; prorrateo |
| Cuidado de hijos ≤ 14 años (6) | 10 % de lo pagado por su cuidado (empleada de hogar, guardería, campamentos…), límite **400 €** (🟡 exige que ambos progenitores trabajen — no comprobado) |
| Cuidado de familiares con discapacidad (5) | **150 €** por ascendiente/descendiente con discapacidad ≥ 65 % (🟡 modelado una sola vez, no por cada familiar) |

**DSL:** añadidas las puertas `requiere_familiar_discapacidad_65` y
`requiere_parto_multiple` (esta última con el nuevo campo `parto_multiple` del
hogar), en R y en `irpfsim.js`. El tipo `fija_por_hijo_nacido` acepta ahora
`importe` (por hijo nacido) además de `importes_por_orden`.

**Pendientes:** trabajo dependiente (75 €; exige rendimientos del trabajo ≤ 12.000
y resto de rentas ≤ 300 — puerta no modelada), contribuyentes viudos (100/200 €;
necesita marcar el estado de viudedad), y la batería rural/inversión/donativos.

---

## Deducciones autonómicas — Illes Balears (DL 1/2014)

Codificadas en `tests/testthat/test-ded-baleares.R`. 5 deducciones (de ~24).
Fuente: TR de tributos cedidos de les Illes Balears (DL 1/2014), arts. 3 bis–6 ter,
y AEAT *Manual Práctico Renta 2025, Parte 2 — Deducciones autonómicas / Illes Balears*.

Límites de renta generales: **33.000 € (individual) / 52.800 € (conjunta)** — salvo
`nacimiento`, cuyo límite general es 52.800 / 84.480. Los límites incrementados para
familias numerosas/monoparentales no se modelan.

| Deducción (art.) | Regla |
|---|---|
| Arrendamiento de vivienda habitual (3 bis) | 15 % de lo pagado, límite **530 €** (< 36 años o > 65 sin actividad). 🟡 La variante del 20 %/650 € (< 30, discapacidad, familia numerosa/monoparental, autónomo) no se modela |
| Nacimiento (6 ter) | **800 / 1.000 / 1.200 €** por orden del hijo nacido (🟡 4.º y siguientes 1.400 € no distinguidos; regla del 50 % al superar el límite no modelada); prorrateo |
| Libros de texto (4) | **100 %**, límite **220 €/hijo** (🟡 límite incrementado a 350 € no modelado) |
| Aprendizaje extraescolar de idiomas (4 bis) | **15 %**, límite **110 €/hijo** |
| Conciliación — descendientes < 6 años (6 bis) | **40 %** de guardería/custodia/comedor/persona contratada, límite **660 €** (🟡 variante 50 %/900 € y requisito de rendimientos del trabajo no modelados) |

### Comprobación numérica (test `ib_familia`, validado R↔JS)

Monoparental en Balears, declarante 34 años, trabajo 30.000 € (cot. SS 1.905),
`gastos_conciliacion_menores` 2.000 €; hijo de 4 años con 300 € de libros de texto;
hijo recién nacido (2.º hijo).

- Nacimiento (2.º hijo): **1.000 €**.
- Libros de texto: 300 → **220** (tope por hijo).
- Conciliación < 6: 40 % · 2.000 = 800 → **660** (tope).
- Deducciones autonómicas = 1.880. `cuota_líquida_total` = **1.371,75 €**, idéntica
  en R y en `irpfsim.js`.

**Pendientes:** inversiones de mejora de la sostenibilidad, estudios de educación
superior fuera de la isla (necesita el dato), adopción (art. 6 quater), gastos de
mayores de 65 / discapacidad, deducciones del arrendador, mecenazgo y donativos.

---

## Deducciones autonómicas — Principado de Asturias (DL 2/2014)

Codificadas en `tests/testthat/test-ded-asturias.R`. 8 deducciones (de ~27).
Fuente: TR de tributos cedidos de Asturias (DL 2/2014), y AEAT *Manual Práctico
Renta 2025, Parte 2 — Deducciones autonómicas / Principado de Asturias*.

Las variantes incrementadas para concejos en riesgo de despoblamiento **no se
modelan** (dependen del concejo de residencia).

| Deducción (art.) | Regla |
|---|---|
| Familias numerosas (11) | **1.000 €** (general) / **2.000 €** (especial) |
| Familias monoparentales (12) | **500 €** con descendientes a cargo; *base + anualidades exentas ≤ 45.000 €* (🟡 no aplicable en custodia compartida) |
| Partos múltiples / 2+ adopciones misma fecha (10) | **1.000 € por cada hijo** nacido/adoptado; prorrateo |
| Gastos de descendientes en centros de 0 a 3 años (14 bis) | **15 %**, límite **500 €/descendiente** < 3 años; *base ≤ 26.000 / 37.000* (🟡 variante 30 %/1.000 € y minoración por ayudas del Principado no modeladas) |
| Cuidado de descendientes hasta 25 años (14 duodecies) | **600 € por descendiente** ≤ 25 con derecho al mínimo por descendientes; *base ≤ 35.000 / 45.000*; prorrateo |
| Emancipación de jóvenes hasta 35 años (14 terdecies) | **100 %** de los gastos de emancipación (mobiliario, transporte, alquiler/compra), límite **1.000 €**; < 36 años; *base ≤ 35.000 / 45.000* |
| Arrendamiento de vivienda habitual (7) | **30 %**, límite **1.500 €** para < 36 años (🟡 también familia numerosa/monoparental/víctima de violencia — solo por edad aquí); **10 %**, límite **500 €** a partir de 36 años; *base ≤ 35.000 / 45.000* |

### Comprobación numérica (test `as_familia`, validado R↔JS)

Monoparental en Asturias, declarante 38 años, trabajo 24.000 € (cot. SS 1.524);
hijo de 1 año con 4.000 € de guardería; hijo de 15 años.

- Monoparental: **500 €**.
- Gastos 0-3: 15 % · 4.000 = 600 → **500** (tope).
- Cuidado de descendientes ≤ 25: 2 hijos → **1.200 €**.
- Deducciones autonómicas = 2.200. `cuota_líquida_total` = **585,12 €**, idéntica en
  R y en `irpfsim.js`.

**Pendientes:** libros de texto y material escolar (14 ter, tabla de límites por
tramo de base), acogimiento de mayores/menores, vivienda protegida, adopción
internacional, y toda la batería de deducciones condicionadas a concejo en riesgo
de despoblamiento.

---

## Deducciones autonómicas — Cantabria (DL 62/2008)

Codificadas en `tests/testthat/test-ded-cantabria.R`. 6 deducciones (de ~21).
Fuente: TR de la Ley de Medidas Fiscales de Cantabria (DL 62/2008), art. 2, y AEAT
*Manual Práctico Renta 2025, Parte 2 — Deducciones autonómicas / Cantabria*.

Los límites de renta se aplican sobre **base liquidable − mínimo personal y
familiar** (`base_gate: menos_minimo`). Las deducciones condicionadas a municipio en
riesgo de despoblamiento **no se modelan**.

| Deducción (art. 2.·) | Regla |
|---|---|
| Nacimiento o adopción (10) | **1.400 €** por nacimiento/adopción (desde 1-1-2024), en el año y los 2 siguientes; prorrateo por mitad en individual |
| Familias monoparentales (9) | **200 €** con descendientes a cargo; *base − MPF < 31.485 €* |
| Gastos de guardería (8) | **15 %**, límite **300 €/hijo** < 3 años (🟡 límite de renta sin cotejar) |
| Gastos de enfermedad (7) | **10 %** de honorarios sanitarios no cubiertos, límite **500 € (ind.) / 700 € (conj.)**; *base − MPF < 22.946 / 31.485* (🟡 incremento de 100 € por discapacidad ≥ 65 % no modelado) |
| Gastos de educación — libros (13) | **100 %** de libros de texto de enseñanzas obligatorias, límite **200 €** (🟡 el 15 % de idiomas extraescolares y el límite conjunto por unidad familiar no se modelan); prorrateo |
| Arrendamiento de vivienda habitual (1) | **10 %**, límite **300 € (ind.) / 600 € (conj.)**; < 36 años, ≥ 65 o discapacidad ≥ 65 %; *base − MPF < 22.946 / 31.485* |

### Comprobación numérica (test `cb_familia`, validado R↔JS)

Monoparental en Cantabria, declarante 40 años, trabajo 26.000 € (cot. SS 1.651),
`gastos_enfermedad` 8.000 €; hijo de 1 año con 3.000 € de guardería.

- Enfermedad: 10 % · 8.000 = 800 → **500** (tope); base − MPF < 22.946.
- Guardería: 15 % · 3.000 = 450 → **300** (tope).
- Deducciones autonómicas = 800. `cuota_líquida_total` = **1.091,38 €**, idéntica en
  R y en `irpfsim.js`.

**Pendientes:** cuidado de familiares (100 € por descendiente < 3, ascendiente > 70
o familiar con discapacidad ≥ 65 % — por miembro y multicondición), obras de mejora,
donativos, acogimiento familiar, ayuda doméstica, y la batería de deducciones por
municipio en riesgo de despoblamiento.

---

## Deducciones autonómicas — La Rioja (Ley 10/2017)

Codificadas en `tests/testthat/test-ded-larioja.R`. 6 deducciones (de ~25).
Fuente: Ley 10/2017 de La Rioja, art. 32, y AEAT *Manual Práctico Renta 2025,
Parte 2 — Deducciones autonómicas / La Rioja*.

Muchas deducciones de La Rioja tienen una variante con porcentaje/límite
**incrementado para residentes en pequeños municipios** (lista oficial): esas
variantes **no se modelan**.

| Deducción (art. 32.·) | Regla |
|---|---|
| Nacimiento y adopción (1) | **600 / 750 / 900 €** por orden del hijo nacido (🟡 +60 €/hijo en partos/adopciones múltiples no modelado); prorrateo |
| Hijo de 0 a 3 años en escuelas infantiles (6) | **20 %** de los gastos de escolarización no subvencionados, límite **600 €/hijo** < 3 años |
| Arrendamiento de vivienda habitual < 36 años (12) | **10 %**, límite **300 €/contrato**; *base ≤ 18.030 / 30.050* (🟡 variante 20 %/400 € para pequeños municipios no modelada) |
| Acceso a Internet — jóvenes emancipados (9) | **30 %** de los gastos de Internet de la vivienda habitual; < 36 años; *base ≤ 18.030 / 30.050* (🟡 variante del 40 % y el límite máximo no cotejados) |
| Suministro de luz y gas — jóvenes emancipados (10) | **15 %** de los gastos de electricidad/gas; < 36 años; *base ≤ 18.030 / 30.050* (🟡 variante del 20 % y el límite máximo no cotejados) |
| Fomento del ejercicio físico (17) | **30 %** de gimnasios, clases, licencias federativas riojanas, límite **300 €** (🟡 el 100 % para mayores de 65 / discapacidad ≥ 33 % no modelado) |

### Comprobación numérica (test `ri_joven`, validado R↔JS)

Soltero de 30 años en La Rioja, trabajo 18.000 € (cot. SS 1.143); Internet 600 €,
luz/gas 2.000 €, gimnasio 1.500 €.

- Internet: 30 % · 600 = **180 €**.
- Luz/gas: 15 % · 2.000 = **300 €**.
- Deporte: 30 % · 1.500 = 450 → **300 €** (tope).
- Deducciones autonómicas = 780. `cuota_líquida_total` = **191,31 €**, idéntica en R
  y en `irpfsim.js`.

**Pendientes:** todas las deducciones de vivienda (adquisición/construcción/
rehabilitación, jóvenes < 36), acogimiento familiar, vehículos eléctricos,
bicicletas, obras de adecuación por discapacidad, donativos/mecenazgo, patrimonio
histórico, ELA, celiaquía, cuotas de organizaciones agrarias, y toda la batería
condicionada a residir en pequeños municipios.

---

## Deducciones autonómicas — Comunidad de Madrid (DL 1/2010)

Codificadas en `tests/testthat/test-ded-madrid.R`. 9 deducciones (de ~23).
Fuente: TR de tributos cedidos de la Comunidad de Madrid (DL 1/2010), arts. 4, 7 bis,
8, 11, 11 bis, 13 bis, y AEAT *Manual Práctico Renta 2025, Parte 2 — Deducciones
autonómicas / Comunidad de Madrid*.

| Deducción (art.) | Regla |
|---|---|
| Arrendamiento de vivienda habitual (8) | **30 %**, límite **1.237,20 €**; ≤ 40 años; *base ≤ 26.414,22 / 37.322,20*, UF ≤ 61.860 |
| Nacimiento o adopción (4) | **721,70 €/hijo** (desde 2023) en el ejercicio del nacimiento **+ 2 siguientes**; +721,70 €/hijo el 1.er año si parto múltiple; *base ≤ 30.930 / 37.322,20*, UF ≤ 61.860; prorrateo |
| Familia numerosa general (13 bis) | **50 % de la cuota íntegra autonómica**, tope **6.186 € / 12.372 €** (ind./conj.). 🟡 el límite real de renta (30.930 € × nº de miembros de la UF) no se modela |
| Familia numerosa especial (13 bis) | **100 % de la cuota íntegra autonómica**, tope **12.372 € / 24.744 €** |
| Cuidado de ascendientes (7 bis) | **515,50 €** por ascendiente > 65 años o con discapacidad ≥ 33 % con derecho a mínimo por ascendientes; prorrateo |
| Cuidado de hijos < 3 — empleada de hogar (11 bis) | **25 %** de las cuotas al Sistema Especial de Empleados de Hogar, límite **463,95 €**. 🟡 la variante de familia numerosa (40 %/618,60 €) y los supuestos de convivencia con dependiente/discapacitado no se modelan |
| Gastos educativos — escolaridad (11) | **15 %**, límite modelado **927,90 €/hijo** (🟡 el tope real es combinado con idiomas/vestuario) |
| Gastos educativos — idiomas (11) | **15 %**, límite **412,40 €/hijo** (🟡 combinado con vestuario) |
| Gastos educativos — vestuario escolar (11) | **5 %**, límite **412,40 €/hijo** |

### Comprobación numérica (test `md_fn_asc`, validado R↔JS)

Pareja (48.000 + 20.000 € de trabajo), 5 hijos → **familia numerosa especial**,
+ 1 ascendiente de 83 años a cargo. Tributación individual.

- Familia numerosa especial: **100 %** de la cuota íntegra autonómica del declarante
  (por debajo del tope de 12.372 €) → la cuota autonómica queda anulada.
- Cuidado de ascendientes: 515,50 € → **257,75 €** (prorrateo entre los dos progenitores).
- `cuota_líquida_total` = **4.203,12 €**, idéntica en R y en `irpfsim.js`.

**Pendientes:** acogimiento no remunerado de mayores (1.546,50 €, requiere flag),
familias con dos o más descendientes e ingresos reducidos (10 % de la cuota), intereses
de préstamos (vivienda joven < 30, estudios de grado/máster/doctorado), adquisición de
vivienda por nacimiento, adopción internacional, autoempleo de jóvenes, inversión en
entidades nuevas / MAB / nuevos contribuyentes del extranjero, donativos, y las de
municipio en riesgo de despoblación.

### DSL — puertas y tipos nuevos (R + JS, validados)
- `fija_por_ascendiente` — importe por ascendiente ≥ `edad_ascendiente_min` (65 por
  defecto) o con discapacidad reconocida.
- `familia_numerosa_categoria: general|especial` — coincidencia **exacta** de categoría
  (a diferencia de `requiere_familia_numerosa`, que en general incluye a la especial).
- `porcentaje_cuota_autonomica` acepta ahora `limite` / `limite_conjunta` (tope €) y
  `sobre_cuota_integra: true` (calcula sobre la cuota íntegra autonómica completa, no
  sobre la ya minorada por otras deducciones).

---

## Deducciones autonómicas — Andalucía (Ley 5/2021)

Codificadas en `tests/testthat/test-ded-andalucia.R`. 10 deducciones (de ~17).
Fuente: Ley 5/2021 de Tributos Cedidos de Andalucía, arts. 10-22 bis, y AEAT
*Manual Práctico Renta 2025, Parte 2 — Deducciones autonómicas / Andalucía*.

| Deducción (art.) | Regla |
|---|---|
| Nacimiento o adopción (11) | **200 €/hijo** nacido o adoptado (+200 € el 1.er año si parto múltiple) |
| Arrendamiento de vivienda habitual (10) | **15 %**, límite **1.200 €**; ≤ 35 años (también > 65, discapacidad, víctimas); *base ≤ 25.000 / 30.000* |
| Familia numerosa general (14) | **200 €**; *base ≤ 25.000 / 30.000* (art. 14.3) |
| Familia numerosa especial (14) | **+200 €** (400 € en total); *base ≤ 25.000 / 30.000* |
| Familia monoparental (13) | **100 €**; *base ≤ 80.000 / 100.000* |
| Familia monoparental — incremento por ascendiente > 75 (13.2) | **+100 €** por ascendiente que conviva y genere el mínimo por ascendientes **de edad superior a 75 años** (edad ≥ 76 en el motor; rentas ≤ 8.000 €; la discapacidad no cuenta) |
| Contribuyente con discapacidad ≥ 33 % (16) | **150 €**; *base ≤ 25.000 / 30.000* |
| Gastos educativos de idiomas / informática (15) | **15 %**, límite **150 €/descendiente**; *base ≤ 80.000 / 100.000* |
| Ayuda doméstica (19) | **20 %** de las cuotas al Sistema Especial de Empleados de Hogar, límite **500 €**, sin límite de base. Dos supuestos alternativos (variantes del `grupo: ayuda_domestica`): **a)** hijos con mínimo por descendientes y rendimientos del trabajo o de actividades (con cónyuge o pareja, **los dos**); **b)** titular o cónyuge de **75 años o más** |
| Fomento del ejercicio físico (22 bis) | **15 %** de cuotas de gimnasios/clubes, límite **100 €/contribuyente**, **sin límite de base** (el art. 60 solo regula la justificación). Añadido por la Ley 8/2025 con efectos desde el 1-1-2025 |

### Comprobación numérica (test `an_ascendiente`, validado R↔JS)

Familia monoparental en Andalucía, trabajo 32.000 € (cot. SS 2.032); 1 hijo de 10
años con 1.500 € de clases de idiomas; 1 ascendiente de 80 años a cargo; 900 € de
gimnasio.

- Familia monoparental: **100 €**.
- Incremento por ascendiente > 75: **100 €**.
- Gastos de idiomas: 15 % · 1.500 = 225 → **150 €** (tope por descendiente).
- Deporte: 15 % · 900 = 135 → **100 €** (tope).
- Deducciones autonómicas = 450, idénticas en R y en `irpfsim.js`.

### Cotejo con la fuente (2026-09-26, issue #16)

Texto de la Ley 5/2021 en la redacción vigente en 2025 (consolidación del BOE,
`BOE-A-2021-17915`) y subpáginas del Manual Práctico Renta 2025.

**Incremento por ascendiente (art. 13.2).** Solo cuenta el ascendiente que genera el
mínimo por ascendientes *mayores de 75 años* de la normativa estatal: 1.400 € «por cada
ascendiente de edad superior a 75 años» (AEAT, *Mínimo por ascendientes*), con rentas
≤ 8.000 € y convivencia ≥ 6 meses. Familia monoparental con un hijo de 9 años y 30.000 €
de trabajo (tests en `test-ded-andalucia.R`):

| Ascendiente | ¿Genera el mínimo de > 75? | Incremento |
|---|---|---|
| 80 años, sin rentas | sí | **100 €** |
| 75 años | no (no tiene edad *superior* a 75) | 0 |
| 70 años, discapacidad ≥ 65 % | genera el mínimo por ascendientes, pero no el de > 75 | 0 |
| 80 años, 9.000 € de rentas | no (rentas > 8.000 €) | 0 |
| dos, de 78 y 82 años | sí, los dos | 2 · 100 = **200 €** |

**Ayuda doméstica (art. 19.1).** Cotizaciones de la empleada de hogar de 1.800 €;
20 % · 1.800 = **360 €** (< 500 €):

| Hogar | Supuesto | Deducción |
|---|---|---|
| Matrimonio, un hijo de 4 años, solo trabaja uno (conjunta) | a) no: tienen que trabajar los dos | 0 |
| Matrimonio, un hijo de 4 años, trabajan los dos (conjunta) | a) sí | **360 €** |
| Titular de 76 años sin hijos, solo intereses | b) sí | **360 €** |
| Titular de 76 años con trabajo y un hijo de 16 (monoparental) | a) y b): variantes excluyentes | **360 €** (una sola vez) |

**Ejercicio físico (art. 22 bis).** Sin límite de base: con 150.000 € de trabajo y 400 €
de gimnasio, 15 % · 400 = **60 €**.

**Familia numerosa (art. 14.3), corrección fuera de la lista del #16.** La ley exige
que la suma de bases no pase de 25.000 € (individual) o 30.000 € (conjunta); el YAML
no tenía esa puerta. Matrimonio en conjunta con tres hijos y un solo sueldo:

- 28.000 € de trabajo: 28.000 − 1.778 (SS) − 2.000 (otros gastos) − 3.400 (reducción
  por conjunta) = 20.822 € ≤ 30.000 → **200 €**.
- 45.000 € de trabajo: base 36.742 € > 30.000 → **0 €** (antes el motor daba 200 €).

**Pendientes:** cónyuge/pareja con discapacidad ≥ 65 % (requiere flag), asistencia a
personas con discapacidad, inversión en vivienda protegida joven, adopción
internacional, inversión en sociedades, defensa jurídica laboral, donativos
ecológicos, gastos veterinarios y familias celíacas.

---

## Deducciones autonómicas — Comunitat Valenciana (Ley 13/1997)

Codificadas en `tests/testthat/test-ded-valenciana.R` y `test-ded-cv-ga.R`.
13 deducciones (de ~40), contando las variantes del alquiler. Fuente: Ley 13/1997
de la CV, art. 4.Uno, Cuatro y Cinco (redacción de la Ley 5/2025, DOGV 31-05-2025),
y AEAT *Manual Práctico Renta 2025, Parte 2 — Deducciones autonómicas / Comunitat Valenciana*.

> **Reducción lineal (taper) de base — modelada desde 2026-09-25.** El importe (o,
> en las deducciones porcentuales, el **límite máximo**) es íntegro si la base
> liquidable general + ahorro es **< 27.000 €** (44.000 € conjunta); entre 27.000 y
> 30.000 € (44.000–47.000) se multiplica por `1 − (base − 27.000) / 3.000`.
> Familia numerosa especial: tramo 31.000–35.000 (54.000–58.000), divisor 4.000.
> DSL: `taper_individual: [desde, hasta]`, `taper_conjunta: [desde, hasta]`.

| Deducción (art. 4.Uno.·) | Regla |
|---|---|
| Nacimiento o adopción (a) | **600 / 750 / 900 €** por orden del hijo (1º/2º/3º+), en el año del nacimiento y los **dos siguientes**; prorrateo entre progenitores; taper 27–30 k / 44–47 k. *(Hasta 2024: 300 € solo el año del nacimiento.)* |
| Familia numerosa general (d) | **330 €**; taper 27–30 k / 44–47 k; prorrateo |
| Familia numerosa especial (d) | **660 €**; taper **31–35 k / 54–58 k**; prorrateo |
| Familia monoparental (d) | **330 €** (categoría general); **no se acumula** con familia numerosa (`familia_numerosa_categoria: "no"`) (🟡 la especial, 660 €, exige título que no se modela) |
| Custodia en guarderías < 3 años (e) | **15 %**, límite **297 €/hijo** (el límite se reduce en la franja de taper); exige que **todos los progenitores convivientes trabajen** (`requiere_progenitores_trabajan`); prorrateo |
| Contribuyente con discapacidad ≥ 33 % y ≥ 65 años (g) | **197 €**; taper |
| Ascendientes > 75 (o > 65 con discapacidad ≥ 65 %) (h) | **197 €/ascendiente**; taper; prorrateo (🟡 el tipo cuenta también ascendientes < 75 con cualquier discapacidad) |
| Arrendamiento de vivienda habitual (n) | variantes **excluyentes** (`grupo: arrendamiento_vc`, se aplica la mayor): **20 %/800 €** general · **25 %/950 €** si ≤ 35 años **o** discapacidad ≥ 65 % · **30 %/1.100 €** si ambas; límites reducidos por el taper |
| Material escolar (v) | **110 €/hijo** de 6 a 16 años **solo si el contribuyente u otro progenitor conviviente está en desempleo** e inscrito como demandante (`requiere_desempleo`; nuevo campo `desempleado`); prorrateo; taper (🟡 edad aproxima la escolarización) |
| Abonos culturales (x) | **21 %**, base máxima **165 €**; rentas < 50.000 € |
| Contribuyentes con dos o más descendientes (t) | **10 % de la cuota íntegra autonómica**; suma de bases imponibles ≤ **30.000 €** (🟡 en individual con dos progenitores el motor solo ve la base del declarante) |

> **Corrección 2026-09-25.** La versión anterior aplicaba el material escolar a
> cualquier familia (en realidad exige desempleo) y el nacimiento a 300 € solo el año
> del nacimiento (la Ley 5/2025 lo sube a 600/750/900 € y lo extiende a tres
> ejercicios). Ambas sobreestimaban/infraestimaban la cuota de forma material.

### Comprobación numérica — taper (test `CV: taper lineal`)

Monoparental, trabajo 32.000 €, cotizaciones 1.500 € → rendimiento neto
32.000 − 1.500 − 2.000 = **28.500 €** (sin reducción del art. 20). Factor
`1 − (28.500 − 27.000)/3.000 = 0,5` → familia monoparental 330 × 0,5 = **165 €**.
Con 5.000 € de alquiler y 30 años: variante joven `min(25 % · 5.000, 950 × 0,5)` = **475 €**
(la general daría `min(1.000, 400)` = 400 → se aplica la joven).

### Comprobación numérica (caso `vc_familia2`, validado R↔JS)

Familia monoparental en la CV, trabajo 27.000 € (cot. SS 1.714); 1 hijo de 1 año con
3.000 € de guardería; 1 ascendiente de 80 años; 400 € en abonos culturales.
Base liquidable 21.136 € (< 27.000, sin taper).

- Nacimiento (1er hijo, dentro de la ventana de 3 ejercicios): **600 €**.
- Familia monoparental: **330 €**.
- Custodia en guardería: 15 % · 3.000 = 450 → **297 €** (tope).
- Ascendiente > 75: **197 €**.
- Abonos culturales: 21 % · min(400, 165) = **34,65 €**.
- Deducciones autonómicas = **1.458,65 €**, idénticas en R y en `irpfsim.js`.

Casos R↔JS adicionales: `vc_taper` (taper + grupo de alquiler + desempleo + nacimiento
de 2º hijo) y `vc_guarderia_2prog` (guardería con dos progenitores que trabajan, prorrateo).

**Pendientes:** nacimiento/adopción múltiple y con discapacidad, acogimiento,
conciliación trabajo/vida familiar (reformada por la Ley 5/2025), contratación
indefinida de empleada de hogar, primera adquisición de vivienda (≤ 35 / discapacidad),
autoconsumo renovable, obras de mejora, donativos (ecológicos, patrimonio, lengua),
financiación de vivienda, gastos de salud, deporte, formación musical, y la de
municipio en riesgo de despoblamiento.

---

## Deducciones autonómicas — Castilla-La Mancha (Ley 8/2013)

Codificadas en `tests/testthat/test-ded-clm.R`. 9 deducciones (de ~30).
Fuente: Ley 8/2013 de Castilla-La Mancha, de Medidas Tributarias, arts. 1-13, y AEAT
*Manual Práctico Renta 2025, Parte 2 — Deducciones autonómicas / Castilla-La Mancha*.
Límite general de base: **27.000 € individual / 36.000 € conjunta** (art. 13).

| Deducción (art.) | Regla |
|---|---|
| Nacimiento o adopción (1) | **100 €** base por hijo nacido (🟡 100 / 500 / 900 € según sea parto de 1, 2 o 3+ — solo se modela el importe base) |
| Familia numerosa general (2) | **200 €** |
| Familia numerosa especial (2) | **+200 €** (400 € total) |
| Familia monoparental (2 bis) | **200 €** |
| Gastos de guardería < 3 años (3 bis) | **30 %**, límite **500 €/hijo** |
| Discapacidad del contribuyente ≥ 65 % (4) | **300 €** |
| Contribuyente > 75 años (6.1) | **150 €** (🟡 no se modela la exclusión por residir > 30 días en centro residencial) |
| Cuidado de ascendiente > 75 años (6.2) | **150 €/ascendiente** con mínimo por ascendientes |
| Arrendamiento de vivienda habitual < 36 años (9) | **15 %**, límite **500 €** |

### Comprobación numérica (test `cm_mayores`, validado R↔JS)

Contribuyente de 78 años en CLM, pensión 17.000 €, con un ascendiente de 90 años a cargo.

- Contribuyente > 75: **150 €**.
- Cuidado de ascendiente > 75: **150 €**.
- Deducciones autonómicas = 300, idénticas en R y en `irpfsim.js`.

**Pendientes:** libros de texto / idiomas (tabla de tramos de base), discapacidad de
ascendientes o descendientes, acogimientos, los cuatro arrendamientos por colectivo
(familia numerosa, monoparental, discapacidad, dación en pago), intereses de primera
vivienda ≤ 40, inversión/donativos, y toda la batería de zona rural (residencia,
adquisición, traslado) condicionada a municipio.

---

> **Nota de implementación:** al añadir `limite_pct_cuota_autonomica` se descubrió
> que el acceso `d$limite` (partial matching de `$` en R) resolvía silenciosamente a
> `d$limite_pct_cuota_autonomica`. Corregido usando `[[` con coincidencia exacta en
> todo el motor de deducciones + `options(warnPartialMatchDollar = TRUE)`.

---

## Tributación individual de una pareja: ámbito de cada declarante (corrección 2026-09-25)

Codificado en `tests/testthat/test-ambito-individual.R`; casos R↔JS `md_pareja_indiv` y
`pv_pareja_indiv`.

**Error corregido.** En tributación individual con dos declarantes, cada liquidación
sumaba los gastos de **todo** el hogar (p. ej. el alquiler pagado por uno lo deducían
los dos), evaluaba la edad y la discapacidad del **primer** declarante en ambas, y las
deducciones estatales por maternidad y familia numerosa se aplicaban **dos veces**. Lo
mismo en las deducciones forales vascas de alquiler, compra de vivienda, discapacidad y
edad. Sobreestimaba las deducciones de muchas parejas biperceptoras.

**Regla ahora (R y JS):**

| Elemento | Individual (2 declarantes) | Conjunta |
|---|---|---|
| Gastos propios (`porcentaje_campo`: alquiler, cuotas SS, abonos…) | solo los del declarante liquidado | los de la unidad familiar |
| Gastos anotados en hijos / ascendientes | repartidos a partes iguales | íntegros |
| Requisitos personales (edad, discapacidad) | los del declarante liquidado | basta con que los cumpla uno |
| Deducciones familiares autonómicas (hijos, nacimiento, FN, ascendientes…) | **mitad a cada progenitor por defecto**; `prorratea_progenitores: false` lo impide (Cataluña, art. 612-1: 150 € a cada uno) | íntegras |
| Maternidad (art. 81 LIRPF) | una sola vez (primer progenitor con actividad) | una vez |
| Familia numerosa y discapacidad a cargo (art. 81 bis) | mitad a cada uno (art. 81 bis.3) | íntegras |
| Foral PV: alquiler, compra, discapacidad propia, edad | solo del declarante liquidado | de ambos |

### Comprobación numérica

Pareja en Madrid; `d1` de 30 años paga 9.000 € de alquiler; `d2` de 45 años no paga.
- `d1`: 30 % · 9.000 = 2.700 → tope **1.237,20 €**. `d2`: **0 €** (antes también 1.237,20).
- Hijo de 1 año, ambos trabajan: maternidad **1.200 €** en total (antes 2.400).
- Familia numerosa general con 3 hijos: **600 € + 600 €** (antes 1.200 + 1.200).
- Castilla y León, primer hijo nacido: 1.010 € → **505 € a cada progenitor**.
- Cataluña, nacimiento: **150 € a cada progenitor** (sin reparto).
- Gipuzkoa: alquiler de 6.000 € pagado por `d1` → 20 % = **1.200 €** solo en `d1`.

---

## Navarra — alquiler, emancipación y pensiones de jubilación (2026-09-25)

Codificado en `tests/testthat/test-navarra-deducciones.R`; casos R↔JS `nc_emancipacion`,
`nc_alquiler`, `nc_pension`, `nc_pareja_edades`. Fuente primaria: texto de las Leyes
Forales publicado en el BOE — LF 22/2023 (BOE-A-2024-1694), art. primero.Nueve (art. 62.2)
y .Quince (art. 68 quinquies); LF 20/2024 (BOE-A-2025-719), art. primero.Trece (art. 68).

| Deducción | Regla | Dónde |
|---|---|---|
| Alquiler de vivienda habitual (62.2) | **15 %**, máx. **1.500 €**; **20 %**, máx. **1.600 €** si < 30 años o unidad monoparental; rentas ≤ **30.000 €** y alquiler > **10 %** de las rentas | cuota |
| Arrendamiento para emancipación (68 quinquies.A) | 23–35 años: **50 %** del alquiler, máx. **280 €/mes**; rentas ≤ **22.000 €** (33.000 € en unidad familiar). Incompatible con la anterior: se aplica la más favorable | cuota diferencial (reembolsable) |
| Pensión de jubilación contributiva (68.B) | diferencia hasta **14.490 €**; si rentas + pensión + deducción superan **21.619,59 €** (28.980 € en unidad familiar), el exceso la reduce | cuota diferencial (reembolsable) |

Aproximaciones (🟡): "rentas" = base imponible del ámbito; en 68.B no se distingue la
pensión con complemento a mínimos (68.B.1); en 68 quinquies no se modelan los requisitos
de contrato, titularidad ni duración.

### Comprobación numérica

- 40 años, salario 25.000 €, SS 1.587 € → rentas 23.413 € (en Navarra la reducción del
  trabajo va en cuota); alquiler 6.000 € > 2.341 € → **15 % · 6.000 = 900 €**.
- 28 años, salario 20.000 €, SS 1.270 € → rentas 18.730 € ≤ 22.000; alquiler 7.200 € →
  emancipación 50 % = 3.600 → tope **3.360 €** (supera los 1.440 € del 62.2, que no se aplica).
- Pensión 12.000 € → **14.490 − 12.000 = 2.490 €**. Con 13.000 € de pensión y 8.000 € de
  intereses: 21.000 + 1.490 − 21.619,59 = 870,41 de exceso → **619,59 €**.
- Pareja en individual, 40 y 70 años: el mínimo personal de quien tiene 70 lleva el
  incremento de **264 €** (antes se usaba la edad del primer declarante en ambos).

---

## Deducciones condicionadas al municipio de residencia (2026-09-25)

Codificado en `tests/testthat/test-ded-municipio.R`; casos R↔JS `cl_rural`, `cm_rural`,
`vc_despoblamiento`, `ga_rural`, `cb_rural`. Fuente: AEAT *Manual Práctico Renta 2025,
Parte 2*, subpágina de cada deducción.

El hogar lleva dos datos nuevos: `municipio_habitantes` (población del municipio) y
`zona_despoblada` (el municipio figura en la lista oficial de la comunidad: asentamientos
"Rango X" en Aragón, concejos del Decreto 83/2025 en Asturias, Orden PRE/1/2025 en
Cantabria, zonas de la Ley 2/2021 en CLM, anexo de pequeños municipios en La Rioja,
beneficiarios del Fondo de Cooperación Municipal en la C. Valenciana). El motor no
lleva las listas de municipios: la persona indica si el suyo figura.

| CCAA | Deducción | Regla |
|---|---|---|
| Aragón | Residencia (160-2.8) | **600 €**; zona Rango X; base < 35.000 / 50.000 (🟡 base del ahorro ≤ 4.000 no modelada) |
| Aragón | Nacimiento en municipios < 10.000 (110-16) | 1.º/2.º hijo **100/150 €**, o **200/300 €** con base ≤ 23.000 / 35.000 (se aplica la mayor) |
| Asturias | Nacimiento en concejos en riesgo (14 quater) | **300 €** desde el 2.º hijo |
| Cantabria | Residencia (2.11.5) | **20 %** de la cuota íntegra autonómica, máx. **500 €**, menores de 40 |
| Cantabria | Guardería (2.11.2) | **30 %**, máx. **600 €/hijo** < 3 (excluyente con la general: la mayor) |
| Cantabria | Alquiler (2.11.1) | **20 %**, máx. **600 € / 1.200 €** conjunta (excluyente con la general) |
| Castilla-La Mancha | Residencia en zona rural (12 bis) | **15 %** (< 2.000 hab.) / **10 %** (2.000–5.000) de la cuota íntegra autonómica 🟡 porcentaje de "zona en riesgo"; intensa y extrema despoblación tienen 20–25 % |
| Castilla y León | Nacimiento en el medio rural (4.2) | ≤ 5.000 hab.: **1.420 / 2.070 / 3.300 €** (frente a 1.010 / 1.475 / 2.351) |
| Extremadura | Residencia en municipios < 3.000 (11 ter) | **15 %** de la cuota íntegra autonómica; base ≤ 28.000 / 45.000 |
| La Rioja | Hijo de 0 a 3 años en pequeños municipios (32.5) | **100 €/mes** por hijo (12 meses) |
| C. Valenciana | Residencia en municipio en riesgo (4.Uno.aa) | **330 €** + **132 / 198 / 264 €** por 1 / 2 / 3+ descendientes; sin límite de renta |
| Galicia | Nacimiento (5.Dos) | año del nacimiento y **dos siguientes** (≤ 22.000: 360/1.200/2.400 €; 22.000–31.000: 300 €), **+20 %** en municipios < 5.000 hab. |

### Comprobación numérica

- **Castilla y León**, primer hijo nacido, municipio de 1.800 hab.: **1.420 €** (sin municipio: 1.010 €).
- **C. Valenciana**, pareja con 2 hijos en municipio en riesgo: en individual cada uno
  **330 € + 99 €** (198 / 2); en conjunta **330 € + 198 €** (el ejemplo del Manual da 396 €
  para un contribuyente con un hijo compartido: 330 + 132 / 2).
- **Galicia**, monoparental, trabajo 22.000 € (SS 1.397), hijos de 1 y 5 años: base −
  mínimo ≈ 3.848 € ≤ 22.000; el hijo de 1 año es el 2.º → **1.200 €**; en municipio de
  3.500 hab. **1.440 €**.
- **Cantabria**, 32 años, alquiler 6.000 €, municipio en riesgo: general no aplica
  (base > 22.946 €); rural 20 % = 1.200 → tope **600 €**; residencia: 20 % de la cuota
  íntegra autonómica con tope de 500 €.

Pendientes: Madrid (traslado a municipio < 2.500 hab. y adquisición de vivienda: dependen
del año de traslado), vivienda rural de Aragón, CLM, CyL, Extremadura y La Rioja
(inversión), autónomos y transporte en concejos asturianos.

## Trabajo: reducción del art. 20 y deducción por obtención de rendimientos del trabajo (2026-09-25)

Issues #2 y #1. Test `tests/testthat/test-trabajo-art20-da61.R`, casos `smi_cm`,
`da61_tramo_cm`, `da61_pension_cm`, `da61_ahorro_cm`, `da61_aeat_md` y `da61_pareja_vc` del
validador (R ↔ JS), y `test/motor.test.mjs`.

**Art. 20 (corrección).** La cuantía de la reducción se fija con el rendimiento neto
**íntegro − gastos de las letras a) a e)** del art. 19.2, sin los 2.000 € de «otros
gastos» de la letra f) (Manual Práctico Renta 2025, *Fase 3ª: Determinación del rendimiento
neto reducido*). Los 2.000 € se restan igualmente del rendimiento y la reducción no puede
dejarlo negativo. Antes el motor restaba los 2.000 € antes de fijar la cuantía, con lo que
la reducción salía más alta y la cuota, más baja (123,48 € en vez de 339,56 € con el SMI).

**DA 61.ª LIRPF** (DF 3.ª de la Ley 5/2025, BOE-A-2025-15424, efectos 1-1-2025). Solo en
régimen común. Rendimientos íntegros del trabajo de una relación laboral o estatutaria
(no pensiones) < 18.276 € y otras rentas ≤ 6.500 €: **340 €** hasta 16.576 € y
**340 − 0,2 × (íntegros − 16.576)** entre 16.576 y 18.276 €. Límite: la parte de la cuota
íntegra estatal + autonómica que corresponde a esos rendimientos (🟡 proporción: rendimiento
del trabajo menos sus gastos, sobre el total de rendimientos netos y ganancias positivos).
Se resta de la cuota líquida total y da la **cuota resultante de la autoliquidación**, que es
la que usa el motor para elegir modalidad, comparar territorios y calcular el tipo medio.

### Comprobación numérica (Castilla-La Mancha, escala autonómica = estatal, soltero de 40 años)

| Íntegros | Cotizaciones | Íntegro − a) a e) | Reducción art. 20 | Base liquidable | Cuota íntegra | DA 61.ª | Cuota resultante |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 16.576 (SMI) | 1.074,12 | 15.501,88 | 7.302 − 1,75 × 649,88 = **6.164,71** | 7.337,17 | 2 × 1.787,17 × 9,5 % = **339,56** | mín(340; 339,56) = **339,56** | **0** |
| 17.500 | 1.134,00 | 16.366,00 | 7.302 − 1,75 × 1.514 = 4.652,50 | 9.713,50 | 2 × 4.163,50 × 9,5 % = 791,07 | 340 − 0,2 × 924 = **155,20** | **635,87** |
| 18.000 | 1.166,40 | 16.833,60 | 7.302 − 1,75 × 1.981,60 = 3.834,20 | 10.999,40 | **1.035,39** | 340 − 0,2 × 1.424 = 55,20 | 980,19 |
| 20.000 | 1.296,00 | 18.704,00 | 2.364,34 − 1,14 × 1.030,48 = 1.189,59 | 15.514,41 | 2 × (1.550,48 − 527,25) = **2.046,46** | 0 (≥ 18.276) | 2.046,46 |

- La base de 18.000 y 20.000 € coincide con la tabla del issue #2.
- **Pensión de jubilación** de 17.000 € a los 70 años: misma cuota líquida que un salario de
  17.000 € (903,83 €), pero sin DA 61.ª. Con salario la deducción sería 255,20 €.
- **SMI + 7.000 € de intereses**: otras rentas > 6.500 € ⇒ ni reducción del art. 20 ni DA 61.ª.
- **SMI + 2.000 € de intereses**: cuota íntegra 339,56 + 2 × 2.000 × 9,5 % = 719,56 €;
  límite 719,56 × 15.501,88 / 17.501,88 = 637,34 € > 340 ⇒ deducción **340 €**, cuota
  resultante **379,56 €**.

### Ejemplo 1 de la AEAT (Madrid, 16.500 € íntegros, 1.200 € de cotizaciones)

Base liquidable general 15.300 − 2.000 − [7.302 − 1,75 × (15.300 − 14.852)] = **6.782 €**
(igual que la AEAT). Parte estatal (6.782 − 5.550) × 9,5 % = **117,04 €**. La AEAT da una cuota
íntegra total de **187,19 €**, que cuadra con el mínimo autonómico de Madrid de 5.956,65 €:
(6.782 − 5.956,65) × 8,5 % = 70,15 €. El motor aún aplica el mínimo estatal a la parte
autonómica (104,72 €; los mínimos autonómicos de 10 CCAA están pendientes). En los dos casos
la deducción absorbe toda la cuota y la cuota resultante es 0.

## Base del ahorro: gravamen con el mínimo personal y familiar (art. 66.1, issue #3)

Test `tests/testthat/test-ahorro-art66.R`, casos `ahorro_minimo_cm` y `aeat_ejemplo_ar` del
validador (R ↔ JS). **Sin cambios en el motor**: el issue #3 planteaba gravar solo el exceso
de la base del ahorro sobre el mínimo (escala(BLA − mínimo)). El Manual Práctico Renta 2025
(*Gravamen de la base liquidable del ahorro → Gravamen estatal*, y el autonómico igual)
indica el método que ya aplica el motor: se aplica la escala a **toda** la base liquidable
del ahorro y se resta la misma escala aplicada a la parte de esa base que corresponde al
mínimo personal y familiar.

- **Castilla-La Mancha**, 40 años, 10.000 € de intereses y ninguna otra renta: el mínimo
  (5.550 €) pasa entero a la base del ahorro. Por tramo: escala(10.000) − escala(5.550) =
  (6.000 × 9,5 % + 4.000 × 10,5 %) − 527,25 = 990 − 527,25 = **462,75 €**; total **925,50 €**
  (con la lectura del issue serían 845,50 €).
- **Ejemplo práctico de la AEAT** (*Cálculo de las cuotas íntegras estatal y autonómica*):
  residente en Aragón con base liquidable general 23.900 €, del ahorro 2.800 € y mínimo
  5.550 €. Estatal 2.667,75 − 527,25 + 266 = **2.406,50 €**; autonómica (escala de Aragón)
  2.621,89 − 527,25 + 266 = **2.360,64 €**. El motor da las dos cifras al céntimo.

## Mínimos personales y familiares autonómicos (art. 46.1.a Ley 22/2009, issue #18)

Test `tests/testthat/test-minimos-autonomicos.R`; casos `minaut_*`, `soltero30_ES-MD` y
`da61_aeat_md` del validador (R ↔ JS, que ahora compara también el mínimo autonómico).

La cuota íntegra estatal se calcula con el mínimo estatal (arts. 57 a 61 LIRPF) y la
autonómica con el de la comunidad. Solo cambian los importes; los límites de rentas, las
edades, la convivencia y el prorrateo son los estatales. Si la base general no agota el
mínimo autonómico, el resto va a la base del ahorro, igual que con el estatal. Fuente:
Manual Práctico Renta 2025, *Cuadro comparativo de los importes de los mínimos personales y
familiares, estatal y autonómicos para 2025*, y la página de cada comunidad.

| CCAA (norma) | Contribuyente (+65 / +75) | Descendientes 1.º–4.º+ (< 3 años) | Ascendientes (+75) | Discapacidad 33 % / 65 % / asistencia |
|---|---|---|---|---|
| Estatal (arts. 57–60) | 5.550 (1.150 / 1.400) | 2.400 / 2.700 / 4.000 / 4.500 (2.800) | 1.150 (1.400) | 3.000 / 9.000 / 3.000 |
| Andalucía (art. 23 bis Ley 5/2021) | 5.790 (1.200 / 1.460) | 2.510 / 2.820 / 4.170 / 4.700 (2.920) | 1.200 (1.460) | 3.130 / 9.390 / 3.130 |
| Asturias (arts. 2 bis–2 quinquies DL 2/2014) | 6.105 (1.265 / 1.540) | 2.640 / 2.970 / 4.400 / 4.950 (3.080) | 1.265 (1.540) | 3.300 / 9.900 / 3.300 |
| Illes Balears (art. 2 DL 1/2014) | 5.550; **6.105 si > 65** (1.265 / 1.540) | 2.400 / 2.970 / 4.400 / 4.950 (2.800) | 1.265 (1.540) | 3.300 / 9.900 / 3.300 |
| Canarias (art. 18 quater DL 1/2009) | 5.606 (1.162 / 1.414) | 2.424 / 2.727 / 4.040 / 4.545 (2.828) | 1.162 (1.414) | 3.030 / 9.090 / 3.030 |
| Galicia (art. 4 bis DL 1/2011) | 5.789 (1.199 / 1.460) | 2.503 / 2.816 / 4.172 / 4.694 (2.920) | 1.199 (1.460) | 3.129 / 9.387 / 3.129 |
| Madrid (arts. 2–2 quater DL 1/2010) | 5.956,65 (1.234,26 / 1.502,58) | 2.575,85 / 2.897,83 / 4.400 / 4.950 (3.005,16) | 1.234,26 (1.502,58) | 3.219,81 / 9.659,44 / 3.219,81 |
| La Rioja (art. 31 bis Ley 10/2017) | estatal | estatal | estatal | solo descendientes: 3.300 / 9.900; asistencia 3.000 |
| C. Valenciana (art. 2 bis Ley 13/1997) | 6.105 (1.265 / 1.540) | 2.640 / 2.970 / 4.400 / 4.950 (3.080) | 1.265 (1.540) | 3.300 / 9.900 / 3.300 |
| Cataluña (art. 611-2 DL 1/2024), Castilla y León (art. 1 bis DL 1/2013) | estatal | estatal | estatal | estatal |

### Comprobación numérica

- **Ejemplo 1 de la AEAT** (Madrid, 16.500 € íntegros, 1.200 € de cotizaciones): base
  liquidable 6.782 €; estatal (6.782 − 5.550) × 9,5 % = **117,04 €**; autonómica
  (6.782 − 5.956,65) × 8,5 % = **70,15 €**; cuota íntegra total **187,19 €**, la misma que la
  AEAT.
- **Caso A** (Madrid, 30.000 €): autonómica 2.647,09 − 5.956,65 × 8,5 % = 2.647,09 − 506,32
  = **2.140,78 €** (antes 2.175,34 €); cuota líquida **4.610,53 €**.
- **C. Valenciana**, monoparental con hijos de 1 y 5 años: estatal 5.550 + 2.400 + 2.800 +
  2.700 = 13.450 €; autonómico 6.105 + 2.640 + 3.080 + 2.970 = **14.795 €**.
- **Illes Balears**, 70 años: estatal 6.700 €; autonómico 6.105 + 1.265 = **7.370 €**. Con
  40 años, 5.550 € en los dos.
- **La Rioja**, hijo de 10 años con discapacidad del 33 %: estatal 5.550 + 2.400 + 3.000 =
  10.950 €; autonómico 5.550 + 2.400 + **3.300** = 11.250 €.
- **Madrid, solo 10.000 € de intereses**: el mínimo va entero a la base del ahorro. Estatal
  990 − 527,25 = 462,75 €; autonómica 990 − 5.956,65 × 9,5 % = **424,12 €**.

🟡 Las puertas de renta de las deducciones autonómicas que restan el mínimo
(`base_gate: menos_minimo`) siguen usando el mínimo estatal; cada ley autonómica dice cuál
aplica y está sin cotejar.

## Deducciones estatales: donativos y vivienda anterior a 2013 (2026-09-26)

Test `tests/testthat/test-deducciones-estatales.R`; casos `est_*` del validador (R ↔ JS).
Hasta ahora el motor JS no tenía estas dos deducciones (el R sí) y el R limitaba mal los
donativos. Ahora están en los dos motores y la web las pide en el paso 4 (solo régimen común).

**Donativos** (art. 68.3 y 69.1 LIRPF; art. 19 Ley 49/2002): 80 % de los primeros 250 €,
40 % del resto (45 % si se ha donado a la misma entidad en 2023 y 2024 por importe igual o
creciente). La **base** de la deducción (los donativos, no la deducción) no puede superar el
10 % de la base liquidable (casillas 0500 + 0510). Mitad en cada cuota íntegra.

- Castilla-La Mancha, 30.000 € de salario (base liquidable 26.095 €) y 5.000 € donados: base
  mín(5.000; 2.609,50) = 2.609,50 → 250 × 80 % + 2.359,50 × 40 % = 200 + 943,80 = **1.143,80 €**
  (571,90 € en cada cuota). Cuota líquida 4.939,50 − 1.143,80 = **3.795,70 €**. Antes el motor R
  calculaba la deducción sobre los 5.000 € (2.100 €) y la topaba en 2.609,50 €.
- 150 € → 120 €; 1.000 € → 200 + 300 = 500 €; recurrentes → 200 + 750 × 45 % = **537,50 €**.

**Vivienda habitual, régimen transitorio** (DT 18.ª LIRPF; art. 68.1.1.º en su redacción a
31-12-2012): lo pagado en el ejercicio (amortización, intereses y gastos del préstamo) hasta
**9.040 €**, al 7,5 % en la cuota estatal y al 7,5 % en la autonómica.

- Madrid, 30.000 € y 12.000 € pagados: 9.040 × 15 % = **1.356 €** (678 € por cuota). Cuota
  líquida 4.610,53 − 1.356 = **3.254,53 €**. Con 4.000 € pagados, 600 €.

🟡 Pendiente: el 9 % del régimen especial de Cataluña, el límite de 9.040 € en tributación
conjunta (el motor lo aplica una vez por declaración) y los donativos a otras entidades y
partidos políticos.

## Obligación de declarar (art. 96 LIRPF, 2026-09-26)

`R/14_obligacion.R` y `obligacionDeclarar()` en `web/js/irpfsim.js`; test
`tests/testthat/test-obligacion-declarar.R`; casos `obl_*` del validador, que ahora compara
también la obligación (`obl`). Fuente: Manual Práctico Renta 2025, *Delimitación de la
obligación de declarar en el IRPF*. Solo régimen común: en los forales el motor devuelve
`NA` / `null` (tienen regulación propia, no modelada).

Por declarante:
1. **Alta en el RETA** (autónomos): obligado en todo caso. El motor lo supone si hay
   rendimientos de actividad económica (`alta_reta` lo puede fijar).
2. **No obligado** si sus rentas proceden solo de: trabajo ≤ **22.000 €** (≤ **15.876 €** si el
   segundo y siguientes pagadores suman más de **1.500 €**); capital mobiliario y ganancias
   con retención ≤ **1.600 €**; rentas inmobiliarias imputadas ≤ **1.000 €**.
3. **No obligado** si en total (trabajo, capital, actividades y ganancias) no pasa de
   **1.000 €** y las pérdidas son inferiores a **500 €**.
4. En otro caso, obligado.

Además: para aplicar la deducción por vivienda anterior a 2013 o reducir por aportaciones a
planes de pensiones hay que presentarla; y si no es obligatoria pero sale a devolver, la
web avisa de que conviene presentarla.

| Caso | Resultado |
|---|---|
| Trabajo 22.000 € de un pagador | no obligado |
| Trabajo 22.001 € | obligado (trabajo) |
| Trabajo 20.000 €, 2.000 € de otros pagadores | obligado (límite 15.876 €) |
| Trabajo 20.000 €, 1.500 € de otros pagadores | no obligado |
| Trabajo 20.000 € + 1.000 € de intereses + 600 € de dividendos | no obligado (1.600 €) |
| Trabajo 20.000 € + 1.601 € de intereses | obligado (capital) |
| Actividad económica de 300 € | obligado (RETA) |
| Solo 800 € de alquiler | no obligado (≤ 1.000 €) |
| Solo 1.200 € de alquiler | obligado |
| Trabajo 15.000 € + 300 € de alquiler | obligado (no son solo rentas del trabajo) |
| SMI (16.576 €) con 400 € de retenciones | no obligado; conviene presentarla (a devolver 400 €) |

🟡 Simplificaciones, siempre del lado de «obligado»: las ganancias o pérdidas por ventas se
tratan como no sometidas a retención (acciones) y no se modelan las pensiones
compensatorias, los pagadores no obligados a retener ni los tipos fijos de retención.
