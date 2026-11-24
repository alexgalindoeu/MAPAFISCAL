> Notas de investigación (24-11-2026), sacadas de fuentes oficiales (BOE, boletines y Manual de la AEAT) por un agente de la sesión. **No son normativa cargada**: cada cifra hay que cotejarla otra vez y llevarla a `params/` con su test, su caso en `tools/validar_js.R` y su cálculo en `docs/03`. Lo ya hecho a partir de estas notas: Madrid, art. 8 (PR #106) y C. Valenciana, letra ad) (deporte).

# Deducciones autonómicas IRPF 2025 que faltan: Comunidad de Madrid y Andalucía

Investigación en solo lectura. No se ha tocado el repo.

## Fuentes usadas (solo oficiales)

| Id | Texto | Versión usada para 2025 |
|---|---|---|
| **MD** | Decreto Legislativo 1/2010, de 21 de octubre, TR de tributos cedidos de la Comunidad de Madrid. BOE, legislación consolidada: `BOCM-m-2010-90068` | `https://www.boe.es/buscar/act.php?id=BOCM-m-2010-90068&tn=1&p=20250627` («Modificación publicada el 27/06/2025»). Los arts. 3 a 18 coinciden con la versión `p=20241230`. La versión siguiente (`p=20251229`, Ley 6/2025 de Madrid, BOE-A-2026-3218) entra «en vigor a partir del 01/01/2026», así que **no se aplica a 2025** |
| **AN** | Ley 5/2021, de 20 de octubre, de Tributos Cedidos de Andalucía, `BOE-A-2021-17915` | `https://www.boe.es/buscar/act.php?id=BOE-A-2021-17915&tn=1&p=20251231` (versión con la Ley 8/2025). La DF 18.ª.b) de la Ley 8/2025 (`https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-945`) dice que los apartados uno a cinco de la DF 9.ª, que tocan el IRPF, «surtirán efectos desde el día 1 de enero de 2025». Por eso esta versión es la aplicable a 2025 en los arts. 10, 11, 22 bis, 22 ter y 22 quater. Los demás artículos están igual que en la versión `p=20241230` |

- **El Manual Práctico de Renta 2025 de la AEAT no se ha podido consultar.** `sede.agenciatributaria.gob.es` responde «Connection reset by peer» desde el proxy. Todas las cifras de abajo salen del texto consolidado del BOE. No hay contraste con el Manual.
- El BOE advierte que el texto consolidado «es de carácter informativo y no tiene valor jurídico». Propongo `estado: confirmado` cuando la frase literal está en ese texto, como ya se hace con el resto del YAML, y `pendiente` donde el modelado exige datos que el motor no tiene o una interpretación.
- No he usado ninguna fuente no oficial.

---

## 0. Hallazgos sobre lo que ya está cargado (no son deducciones nuevas)

1. **Madrid, art. 8 (alquiler): falta un umbral.** El texto dice: «Solo se tendrá derecho a la deducción cuando las cantidades abonadas por el arrendamiento de la vivienda habitual superen el 20 por ciento de la base imponible, entendiendo como tal la suma de la base imponible general y la del ahorro del contribuyente.» El bloque `arrendamiento_vivienda_habitual` de ES-MD no lo modela. No hay clave para ello en `R/06_deducciones.R` ni test en `test-ded-madrid.R`. Hace falta una clave nueva, por ejemplo `campo_min_pct_base: 0.20` (base imponible 0435 + 0460), en R y en JS. **Es la deducción madrileña con más usuarios, y hoy se concede de más.**
2. **Madrid, comentario de `pendientes`:** pone «base UF < 24.000». El art. 14 dice «no sea superior a 24.744 euros» (≤ 24.744). Ver la ficha M1.
3. **Madrid, art. 12 ter** (matrícula de jóvenes menores de 30 años que trabajan, 50 %, límite 400 €): es nuevo de la Ley 6/2025 y está «en vigor a partir del 01/01/2026». **No es de 2025**, no debe cargarse en `params/2025`.
4. **Andalucía, art. 10.1:** el texto dice «menores de 35 años o mayores de 65 años o que tengan la consideración de víctima de violencia doméstica, víctima del terrorismo». El motor, con `edad_min_alt: 65`, admite a quien tiene 65 años justos, porque `edad < edad_min_alt` es el único corte. Tampoco modela el supuesto de las víctimas. Es una desviación menor.
5. **Andalucía, art. 11.5:** la deducción por nacimiento es incompatible con la de familia numerosa (art. 14) y con la de adopción internacional (art. 12). La primera ya está anotada en el YAML. La segunda hay que tenerla en cuenta al cargar la ficha A8.

---

## 1. Comunidad de Madrid: deducciones que faltan (2025), por impacto estimado

Uso las claves del motor que ya existen (`R/06_deducciones.R`). Una clave nueva va marcada **(nueva)** y exige el mismo cambio en `web/js/irpfsim.js` y un caso en `tools/validar_js.R`.

Recordatorio del art. 18:
- **Art. 18.1:** los arts. 6, 7 y 8 tienen límite de base imponible 26.414,22 € (individual) / 37.322,20 € (conjunta); el art. 4, 30.930 / 37.322,20.
- **Art. 18.2:** los arts. 10, 10 bis, 10 ter, 11, 11 bis, 13 y 13 bis exigen que la base de la unidad familiar (UF) no supere «multiplicar por 30.930 el número de miembros de dicha unidad familiar».
- **Art. 18.3:** en el art. 9, la base de la deducción no puede superar el 10 % de la base liquidable.
- Los arts. 5, 8 bis, 8 ter, 12, 12 bis, 14, 15, 16, 17 y 17 bis no tienen el límite del art. 18. El art. 14 tiene su propio límite de 24.744 €.

### M1. Familias con dos o más descendientes e ingresos reducidos (art. 14)
- **Literal:** «Los contribuyentes que tengan dos o más descendientes que generen a su favor el derecho a la aplicación del correspondiente mínimo […] y cuya suma de bases imponibles no sea superior a 24.744 euros podrán aplicar una deducción del 10 por 100 del importe resultante de minorar la cuota íntegra autonómica en el resto de deducciones autonómicas aplicables en la Comunidad de Madrid y la parte de deducciones estatales que se apliquen sobre dicha cuota íntegra autonómica.»
- **Suma de bases:** «a) Las de los contribuyentes que tengan derecho, por los mismos descendientes, a la aplicación del mínimo […] tanto si declaran individual como conjuntamente. b) Las de los propios descendientes que dan derecho al citado mínimo.» Cada base es la «suma de la base imponible general y del ahorro».
- **Requisitos:** 2 o más descendientes con mínimo, y una suma de bases (progenitores + descendientes) de 24.744 € o menos. Sin límite de importe.
- **Motor:**
  - Se puede usar el tipo `porcentaje_cuota_autonomica` de la segunda pasada, sin `sobre_cuota_integra`, que ya minora las autonómicas, con `min_descendientes: 2`.
  - El umbral debe sumar las bases de los dos progenitores aunque declaren por separado, más las rentas de los descendientes: clave **(nueva)** `base_max_suma_progenitores_descendientes: 24744`. La aproximación es `rentas_propias` del descendiente.
  - Falta restar «la parte de deducciones estatales que se apliquen sobre dicha cuota íntegra autonómica» (la mitad autonómica de las deducciones estatales). Hoy la segunda pasada no la descuenta.
- **YAML propuesto:**
```yaml
        - id: familias_dos_descendientes_ingresos_reducidos
          norma: "Art. 14 DL 1/2010 Madrid"
          estado: provisional   # cifras confirmadas; base y umbral aproximados (ver nota)
          fuente: "Art. 14 DL 1/2010, versión consolidada BOE BOCM-m-2010-90068 vigente en 2025 (https://www.boe.es/buscar/act.php?id=BOCM-m-2010-90068&tn=1&p=20250627)"
          tipo: porcentaje_cuota_autonomica
          porcentaje: 0.10
          min_descendientes: 2
          base_max_suma_progenitores_descendientes: 24744   # (nueva)
          suma_bases: imponibles
```

### M2. Intereses de préstamos para estudios de Grado, Máster y Doctorado (art. 12 bis)
- **Literal:** «Los contribuyentes podrán deducir el importe de los intereses pagados en el período impositivo correspondientes a préstamos obtenidos para cursar estudios universitarios en cualquiera de los tres ciclos […]». Es el **100 % de los intereses, sin límite** de importe ni de renta.
- **Requisitos:**
  - Estudios del propio contribuyente, de su cónyuge o de los descendientes con mínimo (o por los que pague anualidades por alimentos).
  - Préstamo de una entidad de crédito (art. 1 de la Ley 10/2014).
  - El destino de los fondos debe constar en el contrato (art. 18.4.e).
- **Campo:** **nuevo**, `intereses_prestamo_estudios` (por declarante). El tipo `porcentaje_campo` con `porcentaje: 1.0` ya sirve.
```yaml
        - id: intereses_prestamos_estudios
          norma: "Arts. 12 bis y 18.4.e) DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Art. 12 bis DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: intereses_prestamo_estudios
          porcentaje: 1.00
```

### M3. Intereses de hipoteca de jóvenes menores de 30 años (art. 12)
- **Literal:** «Los contribuyentes menores de treinta años podrán deducirse el 25 por ciento de los intereses satisfechos durante el período impositivo por préstamos hipotecarios obtenidos para la adquisición de su vivienda habitual, con el límite máximo de deducción de 1.031 euros anuales.» También: «La deducción resultará aplicable por los intereses satisfechos hasta el mes anterior a aquel en que el contribuyente cumpla los treinta años de edad.»
- **Límite de renta:** ninguno, porque el art. 18 no incluye el art. 12.
- **Incompatibilidad:** con el art. 10, según el art. 10.4: «Esta deducción es incompatible con la deducción que regula el artículo 12.» Ver M4.
- **Campo:** **nuevo**, `intereses_hipoteca_vivienda_habitual`. Con `edad_max: 30` (el corte del motor es estricto, `edad >= 30` queda fuera) no se prorratea el año en que cumple 30.
```yaml
        - id: intereses_prestamo_vivienda_jovenes
          norma: "Art. 12 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Art. 12 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: intereses_hipoteca_vivienda_habitual
          porcentaje: 0.25
          limite: 1031
          edad_max: 30
          grupo: intereses_vivienda_md
```

### M4. Incremento de los costes de financiación de la vivienda por la subida de tipos (art. 10)
- **Literal:** «aplicar el porcentaje de deducción del 25 por ciento sobre el exceso correspondiente a los intereses satisfechos en el período impositivo […] sobre los intereses que se hubieran satisfecho en el período impositivo si se hubiera aplicado a las citadas condiciones, en ese ejercicio, el euríbor correspondiente al mes de diciembre de 2022, con el límite de 300 euros anuales.»
- **Requisitos:**
  - Préstamo hipotecario «a tipo de interés variable», con la vivienda adquirida antes del inicio del periodo y que siga siendo la habitual.
  - «precio de adquisición […] igual o inferior a 390.000,00 euros».
  - Límite de la UF del art. 18.2 (30.930 € × miembros).
  - Incompatible con el art. 12.
- **Campos:**
  - **nuevo** `exceso_intereses_hipoteca_euribor_2022`: el exceso lo calcula el usuario o su banco. El motor no puede reconstruirlo.
  - **nuevo** `precio_adquisicion_vivienda`.
  - Clave **(nueva)** `campo_max: {campo: precio_adquisicion_vivienda, valor: 390000}`.
```yaml
        - id: incremento_costes_financiacion_vivienda
          norma: "Arts. 10 y 18.2 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Arts. 10 y 18.2 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: exceso_intereses_hipoteca_euribor_2022
          porcentaje: 0.25
          limite: 300
          campo_max: { campo: precio_adquisicion_vivienda, valor: 390000 }   # (nueva)
          grupo: intereses_vivienda_md        # incompatible con el art. 12
          base_max_por_miembro_uf: 30930
          suma_bases: imponibles
```
Nota: `grupo` aplica la mayor de las dos. La ley dice «incompatible» sin fijar criterio, así que la elección queda en manos del contribuyente y aplicar la más favorable es razonable.

### M5. Donativos a fundaciones y clubes deportivos (art. 9 + art. 18.3)
- **Literal:**
  - «deducir el 15 por 100 de las cantidades donadas a fundaciones que cumplan con los requisitos de la Ley 1/1998 […] de Fundaciones de la Comunidad de Madrid»
  - «el 15 por 100 de las cantidades donadas a clubes deportivos elementales y básicos»
  - Art. 18.3: «la base de la misma no podrá exceder del 10 por cien de la base liquidable, entendiendo como tal la suma de la base liquidable general y la del ahorro del contribuyente.»
- **Requisitos:** fundaciones inscritas en el Registro de Fundaciones de la Comunidad de Madrid; clubes inscritos en el Registro de Asociaciones Deportivas de la Comunidad de Madrid. Sin límite de renta.
- **Campo:** **nuevo**, `donativos_fundaciones_madrid`. Es distinto de `donativos` (Ley 49/2002 estatal). Clave **(nueva)** `base_max_pct_base_liquidable: 0.10`. Hoy solo existe en la deducción estatal.
```yaml
        - id: donativos_fundaciones_clubes_deportivos
          norma: "Arts. 9 y 18.3 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Arts. 9 y 18.3 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: donativos_fundaciones_madrid
          porcentaje: 0.15
          base_max_pct_base_liquidable: 0.10   # (nueva)
```

### M6. Empleada de hogar por un familiar dependiente o con discapacidad (art. 11 bis.2.b y c): la parte que falta de un artículo ya cargado
- **Literal:**
  - b) «conviva con un ascendiente, descendiente, colateral por consanguinidad de segundo grado, o cónyuge, en todos los casos mayores de 65 años, que tenga reconocido alguno de los grados de dependencia […]»
  - c) «conviva con un ascendiente, descendiente, colateral […] o cónyuge que tenga reconocido un grado de discapacidad igual o superior al 33 por ciento.»
  - Art. 11 bis.3: solo cuentan los que conviven más de 183 días «y no tengan rentas anuales, excluidas las exentas, superiores a 8.000 euros».
  - Art. 11 bis.4.c: el empleador debe tener actividad durante 183 días o más, o cobrar prestación por desempleo o pensión.
- **Importes:** los mismos que ya están cargados: 25 % con límite de 463,95 €; 40 % con límite de 618,60 € en familia numerosa. Límite de la UF del art. 18.2.
- **Campos:** **nuevo** `grado_dependencia` por persona. Para c) basta `discapacidad != "no"` de un ascendiente, descendiente o cónyuge con `rentas_propias <= 8000`, más **(nueva)** `requiere_actividad_o_pension`.
```yaml
        - id: empleada_hogar_familiar_discapacidad
          norma: "Arts. 11 bis.2.c), 11 bis.3, 11 bis.4.c) y 18.2 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Art. 11 bis DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: cuotas_ss_empleada_hogar
          porcentaje: 0.25
          limite: 463.95
          grupo: empleada_hogar_md
          requiere_familiar_discapacidad_conviviente: { grado: "33", rentas_max: 8000 }   # (nueva)
          requiere_actividad_o_pension: true                                            # (nueva)
          base_max_por_miembro_uf: 30930
          suma_bases: imponibles
        # + variante _fn (0.40 / 618.60, requiere_familia_numerosa: true) y la b) con grado_dependencia y edad > 65
```

### M7. Acogimiento familiar de menores (art. 6 + art. 18.1)
- **Literal:** «por cada menor en régimen de acogimiento familiar simple, permanente o preadoptivo, administrativo o judicial, siempre que convivan con el menor durante más de ciento ochenta y tres días del período impositivo»:
  - «a) 618,60 euros si se trata del primer menor»
  - «b) 773,25 euros si se trata del segundo»
  - «c) 927,90 euros si se trata del tercer menor […] o sucesivo».
- **Otras reglas:**
  - No hay deducción si el acogimiento preadoptivo acaba en adopción ese año, porque entonces se aplica la del art. 4.
  - En matrimonios o uniones de hecho que declaran por separado se prorratea.
  - Base imponible de 26.414,22 € o menos en individual, o de 37.322,20 € o menos en conjunta (art. 18.1).
  - Certificado de la Consejería (art. 18.4.a).
- **Campo:** **nuevo** `acogido: true` en el descendiente, con `convivencia_meses >= 7` como aproximación de «más de 183 días». La clave `importes_por_orden` ya existe en `fija_por_hijo_nacido`. Habría que crear un tipo **(nuevo)** `fija_por_acogido` o un filtro `solo_acogidos: true`.
```yaml
        - id: acogimiento_familiar_menores
          norma: "Arts. 6 y 18.1 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Arts. 6 y 18.1 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: fija_por_acogido          # (nueva)
          importes_por_orden: { "1": 618.60, "2": 773.25, "3+": 927.90 }
          convivencia_dias_min: 184
          base_max_individual: 26414.22
          base_max_conjunta: 37322.20
          suma_bases: imponibles
          prorratea_progenitores: true
```

### M8. Adquisición de vivienda habitual por nacimiento o adopción (art. 13)
- **Literal:**
  - «podrán deducirse el 10 por ciento de su precio de adquisición»
  - «El importe de la deducción se prorrateará por décimas partes y se aplicará en el período impositivo en que se produzca la adquisición [y] los nueve siguientes, sin que la deducción anual aplicable pueda superar los 1.546,50 euros.»
  - «La vivienda deberá adquirirse en los tres años siguientes, contados de fecha a fecha, desde que se produzca el nacimiento o adopción de un hijo del contribuyente por el que tenga derecho a la aplicación del mínimo por descendientes».
  - El precio incluye «los gastos y tributos inherentes».
- **Límite:** el de la UF del art. 18.2.
- **Campo:** **nuevo**, `precio_adquisicion_vivienda_nacimiento` (precio + gastos de una compra que cumple los requisitos). Tipo `porcentaje_campo` con `porcentaje: 0.01` (10 % / 10 años) y `limite: 1546.50`.
```yaml
        - id: adquisicion_vivienda_por_nacimiento
          norma: "Arts. 13 y 18.2 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Arts. 13 y 18.2 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: precio_adquisicion_vivienda_nacimiento
          porcentaje: 0.01          # 10 % del precio, en décimas partes durante 10 ejercicios
          limite: 1546.50
          base_max_por_miembro_uf: 30930
          suma_bases: imponibles
```

### M9. Gastos del arrendador de viviendas (art. 8 bis)
- **Literal:** «Los contribuyentes que tengan inmuebles arrendados como vivienda podrán deducirse el 10 por ciento de las cantidades satisfechas en el ejercicio por gastos de conservación y reparación, la formalización de contratos de arrendamiento, primas de seguros por daños e impagos y la obtención de certificados de eficiencia energética vinculados con tales arrendamientos, con un límite de deducción de 154,65 euros anuales.»
- **Requisitos:** sin límite de renta. El depósito de la fianza en la Agencia de Vivienda Social es obligatorio (art. 18.4.c).
- **Campo:** **nuevo**, `gastos_arrendador_vivienda`. Podría derivarse en parte de `capital_inmobiliario$gastos_financieros`, que hoy mezcla intereses y conservación, así que mejor un campo propio.
```yaml
        - id: gastos_arrendamiento_viviendas
          norma: "Art. 8 bis DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Art. 8 bis DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: gastos_arrendador_vivienda
          porcentaje: 0.10
          limite: 154.65
```

### M10. Adopción internacional (art. 5)
- **Literal:**
  - «En el supuesto de adopción internacional, los contribuyentes podrán deducir 721,70 euros por cada hijo adoptado en el período impositivo.»
  - «Esta deducción es compatible con la deducción por nacimiento o adopción de hijos regulada en el artículo 4»
  - «Cuando el niño adoptado conviva con ambos padres adoptivos el importe de la deducción se incrementará en un 50 % […] y se prorrateará por partes iguales […] si optaran por tributación individual.»
- **Límite de renta:** ninguno (el art. 18 no incluye el art. 5).
- **Campo:** **nuevo** `adopcion_internacional: true` en el descendiente, junto con `nacido_en_ejercicio`. Clave **(nueva)** `incremento_ambos_progenitores: 0.5`.
```yaml
        - id: adopcion_internacional
          norma: "Art. 5 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Art. 5 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: fija_por_hijo_nacido
          solo_adopcion_internacional: true      # (nueva)
          importe: 721.70
          anios_ventana: 1
          incremento_ambos_progenitores: 0.50    # (nueva): 1.082,55 € entre los dos
          prorratea_progenitores: true
```

### M11. Acogimiento no remunerado de mayores de 65 años o con discapacidad (art. 7 + art. 18.1)
- **Literal:** «deducir 1.546,50 euros por cada persona mayor de sesenta y cinco años o con discapacidad igual o superior al 33 por 100, que conviva con el contribuyente durante más de ciento ochenta y tres días al año en régimen de acogimiento sin contraprestación, cuando no diera lugar a la obtención de ayudas o subvenciones de la Comunidad de Madrid.»
- **Exclusión:** no procede con el mayor de 65 años «ligado al contribuyente por un vínculo de parentesco de consanguinidad o de afinidad de grado igual o inferior al cuarto».
- **Otras reglas:** prorrateo entre contribuyentes; límite de base del art. 18.1 (26.414,22 / 37.322,20 €).
- **Campo:** **nuevo**, rol `acogido` o flag `acogido_sin_contraprestacion` en el miembro, con `parentesco_grado`.
```yaml
        - id: acogimiento_no_remunerado_mayores
          norma: "Arts. 7 y 18.1 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Arts. 7 y 18.1 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: fija_por_acogido_mayor      # (nueva)
          importe: 1546.50
          edad_acogido_min: 66              # «mayor de sesenta y cinco años», o discapacidad >= 33 %
          convivencia_dias_min: 184
          base_max_individual: 26414.22
          base_max_conjunta: 37322.20
          suma_bases: imponibles
          prorratea_progenitores: true
```

### M12. Fomento del autoempleo de jóvenes menores de 35 años (art. 16)
- **Literal:** «Los contribuyentes menores de treinta y cinco años que causen alta por primera vez en el Censo de Empresarios, Profesionales y Retenedores […] podrán aplicar una deducción en la cuota íntegra autonómica […] de 1.031 euros.»
- **Requisitos:** se aplica en el ejercicio del alta; la actividad debe desarrollarse «principalmente en el territorio de la Comunidad de Madrid» y el contribuyente debe mantenerse en el censo un año como mínimo. Sin límite de renta.
- **Campo:** **nuevo**, `alta_censo_primera_vez: true` por declarante.
```yaml
        - id: autoempleo_jovenes
          norma: "Art. 16 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Art. 16 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: fija
          importe: 1031
          edad_max: 35
          requiere_alta_censo_primera_vez: true   # (nueva)
```

### M13. Cambio de residencia a un municipio en riesgo de despoblación (art. 10 bis)
- **Literal:** contribuyentes «menores de treinta y cinco años que trasladen su residencia habitual a un municipio de la Comunidad de Madrid que tenga una población inferior a 2.500 habitantes» (mediante compra, o alquiler a quien no sea pariente hasta el tercer grado) pueden deducir «1.000 euros, tanto en el período impositivo en el que se produzca el cambio de residencia como en el siguiente», con permanencia del año del traslado y los tres siguientes.
- **Compatibilidad y límite:** compatible con el art. 10 ter; límite de la UF del art. 18.2.
- **Campos:** `municipio_habitantes` (ya existe) + `municipio_hab_max: 2499` (ya existe) + **nuevo** `anio_traslado_residencia` (año del traslado; vale 2025 o 2024).
```yaml
        - id: cambio_residencia_municipio_despoblacion
          norma: "Arts. 10 bis y 18.2 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Arts. 10 bis y 18.2 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: fija
          importe: 1000
          edad_max: 35
          municipio_hab_max: 2499
          requiere_traslado_residencia_anios: 2   # (nueva): ejercicio del traslado y el siguiente
          base_max_por_miembro_uf: 30930
          suma_bases: imponibles
```

### M14. Adquisición de vivienda habitual en municipios en riesgo de despoblación (art. 10 ter)
- **Literal:**
  - Contribuyentes «menores de treinta y cinco años que adquieran un inmueble que vaya a constituir su vivienda habitual […] en un municipio […] que cuente con una población inferior a 2.500 habitantes […] podrán deducir […] el 10 por ciento del precio de adquisición»
  - «se prorrateará por décimas partes y se aplicará en el período impositivo en el que se produzca la adquisición y los nueve períodos impositivos siguientes, sin que la deducción anual aplicable pueda superar los 1.546,50 euros.»
  - El precio incluye los gastos y tributos y excluye los intereses.
- **Compatibilidad y límite:** compatible con los arts. 10 bis y 12; límite de la UF del art. 18.2.
- **Campo:** **nuevo**, `precio_adquisicion_vivienda_despoblacion`.
```yaml
        - id: adquisicion_vivienda_municipios_despoblacion
          norma: "Arts. 10 ter y 18.2 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Arts. 10 ter y 18.2 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: precio_adquisicion_vivienda_despoblacion
          porcentaje: 0.01
          limite: 1546.50
          edad_max: 35            # condición en la adquisición; el motor solo ve la edad actual (aproximación)
          municipio_hab_max: 2499
          base_max_por_miembro_uf: 30930
          suma_bases: imponibles
```

### M15. Arrendamiento de viviendas vacías (art. 8 ter)
- **Literal:**
  - Los propietarios o usufructuarios de viviendas vacías «durante al menos un año anterior a la celebración de un contrato de arrendamiento […] podrán deducir en la cuota íntegra autonómica 1.000 euros por cada uno de los bienes inmuebles destinados al arrendamiento de una vivienda, en el ejercicio en que se formalice el correspondiente contrato»
  - «El importe de la deducción se prorrateará en función del porcentaje de participación en la propiedad».
- **Requisitos:** contrato de 3 años como mínimo; el arrendatario no puede ser cónyuge ni pariente hasta el tercer grado; el contribuyente puede tener como máximo 5 inmuebles destinados a vivienda.
- **Compatibilidad y límite:** compatible con el art. 8 bis; sin límite de renta.
- **Campo:** **nuevo**, `viviendas_vacias_arrendadas` (número ponderado por el porcentaje de titularidad). Tipo `porcentaje_campo` con `porcentaje: 1000`, o un tipo **(nuevo)** `fija_por_unidad`.
```yaml
        - id: arrendamiento_viviendas_vacias
          norma: "Art. 8 ter DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Art. 8 ter DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: fija_por_unidad        # (nueva)
          campo: viviendas_vacias_arrendadas
          importe: 1000
```

### M16 a M18. Inversiones (impacto muy bajo en una calculadora de hogares)

- **M16. Art. 15, acciones de entidades nuevas o de reciente creación:**
  - «deducción del 40 por ciento de las cantidades invertidas»; «El límite de deducción aplicable será de 9.279 euros anuales.»
  - «será del 50 por 100 […] con un límite de 12.372,00 euros, en el caso de sociedades creadas o participadas por universidades o centros de investigación», y también para sociedades laborales y cooperativas (apdo. 5).
  - Requisitos: como máximo el 40 % del capital junto con familiares; mantenerla 3 años; domicilio social y fiscal en Madrid; actividad económica; empleo.
  - Campo **nuevo** `inversion_entidades_nueva_creacion_md`, más la variante `_universidad`.
- **M17. Art. 17, MAB:** «el 20 por 100 de las cantidades invertidas […] a través del segmento de empresas en expansión del Mercado Alternativo Bursátil […] con un máximo de 10.310 euros de deducción». Mantenimiento de 2 años; como máximo el 10 % del capital; domicilio en Madrid. Incompatible con el art. 15 para la misma inversión. Campo **nuevo** `inversion_mab`.
- **M18. Art. 17 bis, nuevos contribuyentes procedentes del extranjero:**
  - «deducción del 20 por ciento del valor de adquisición» de valores de deuda o de participación, sin límite de importe.
  - Requisitos: no haber sido residente en España en los 5 años anteriores; inversión en el ejercicio de la residencia, en el siguiente o, en algún caso, en el anterior; mantenimiento de 6 años.
  - El remanente puede aplicarse en los 5 ejercicios siguientes «en caso de insuficiencia de cuota íntegra», y se aplica «con posterioridad al resto de deducciones».
  - Incompatible con los arts. 15 y 17.
  - El motor no tiene arrastre de remanentes: `estado: pendiente` para el modelado.

```yaml
        - id: inversion_entidades_nueva_creacion
          norma: "Art. 15.1-3 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Art. 15 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: inversion_entidades_nueva_creacion_md
          porcentaje: 0.40
          limite: 9279
          grupo: inversion_md
        - id: inversion_entidades_universidades_laborales
          norma: "Art. 15.4-5 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Art. 15 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: inversion_entidades_universidades_laborales_md
          porcentaje: 0.50
          limite: 12372
        - id: inversion_mab
          norma: "Art. 17 DL 1/2010 Madrid"
          estado: confirmado
          fuente: "Art. 17 DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: inversion_mab
          porcentaje: 0.20
          limite: 10310
        - id: nuevos_contribuyentes_extranjero
          norma: "Art. 17 bis DL 1/2010 Madrid"
          estado: pendiente      # cifras confirmadas; el motor no arrastra remanentes ni aplica «con posterioridad al resto»
          fuente: "Art. 17 bis DL 1/2010, versión BOE BOCM-m-2010-90068 vigente en 2025 (p=20250627)"
          tipo: porcentaje_campo
          campo: inversion_nuevo_residente_md
          porcentaje: 0.20
```

**Fuera de 2025:** art. 12 ter (desde 2026). Las 23 letras del art. 3 en 2025 son a) a v): con las 9 ya cargadas (arts. 4, 7 bis, 8, 11, 11 bis.a/d y 13 bis) y las de arriba, el catálogo queda completo.

---

## 2. Andalucía: deducciones que faltan (2025), por impacto estimado

Base de las puertas: «suma de las bases imponibles general y del ahorro», que en el motor es `suma_bases: imponibles`, como el resto del bloque ES-AN.

### A1. Asistencia a personas con discapacidad (art. 18)
- **Literal:**
  - Apdo. 1: «Los contribuyentes que tengan derecho a la aplicación del mínimo por discapacidad de descendientes o ascendientes […] podrán deducirse de la cuota íntegra autonómica la cantidad de 100 euros por persona con discapacidad.» «Tendrán derecho […] cuando la suma de las bases imponibles general y del ahorro no sea superior a 80.000 euros, en tributación individual, o a 100.000 euros en caso de tributación conjunta.»
  - Apdo. 2: prorrateo según las reglas estatales del mínimo.
  - Apdo. 3: cuando la persona con discapacidad «necesita[n] ayuda de terceras personas y generen derecho a la aplicación del mínimo en concepto de gastos de asistencia […] el 20% del importe satisfecho a la Seguridad Social, en concepto de cuota fija que sea por cuenta del empleador […] con el límite de 500 euros anuales por contribuyente.» Solo puede aplicarlo el titular del hogar familiar afiliado en Andalucía.
  - Art. 19.3: el apdo. 3 es incompatible con la ayuda doméstica «cuando se trate de la misma persona empleada».
- **Campos (ya existen):** `discapacidad` y `ayuda_terceros` / `movilidad_reducida` de descendientes y ascendientes, más `cuotas_ss_empleada_hogar`.
  - Falta un tipo **(nuevo)** `fija_por_familiar_discapacidad`. Debe contar los descendientes o ascendientes con discapacidad que generan el mínimo, con el prorrateo de `prorratea_progenitores`.
  - Para el apdo. 3, **(nueva)** `requiere_familiar_gastos_asistencia: true` y meterlo en el `grupo: ayuda_domestica` existente.
  - Aproximación: el mínimo por gastos de asistencia del motor sale de `ayuda_terceros || movilidad_reducida || 65_mas`.
```yaml
        - id: asistencia_personas_discapacidad
          norma: "Art. 18.1 y 18.2 Ley 5/2021"
          estado: confirmado
          fuente: "Art. 18 Ley 5/2021, versión consolidada BOE vigente en 2025 (https://www.boe.es/buscar/act.php?id=BOE-A-2021-17915&tn=1&p=20251231)"
          tipo: fija_por_familiar_discapacidad   # (nueva): desc. o asc. con mínimo por discapacidad
          importe: 100
          base_max_individual: 80000
          base_max_conjunta: 100000
          suma_bases: imponibles
          prorratea_progenitores: true
        - id: asistencia_personas_discapacidad_empleada_hogar
          norma: "Arts. 18.3 y 19.3 Ley 5/2021"
          estado: confirmado
          fuente: "Arts. 18.3 y 19.3 Ley 5/2021, versión BOE vigente en 2025 (p=20251231)"
          tipo: porcentaje_campo
          campo: cuotas_ss_empleada_hogar
          porcentaje: 0.20
          limite: 500
          grupo: ayuda_domestica                     # incompatible con el art. 19 por la misma empleada
          requiere_familiar_gastos_asistencia: true  # (nueva)
          # sin límite de renta en el apdo. 3: el límite 80.000/100.000 del párrafo 2.º del apdo. 1 se refiere a «esta deducción» del apdo. 1 (interpretación literal; contrastar con el Manual AEAT)
```
⚠ Dudoso: si el límite de 80.000 / 100.000 € del apdo. 1 alcanza también al apdo. 3. La literalidad lo sitúa dentro del apdo. 1. No he podido contrastarlo con el Manual de la AEAT, que está bloqueado. Propongo dejar el apdo. 3 como `provisional` hasta comprobarlo.

### A2. Familias con enfermedad celíaca diagnosticada (art. 22 quater, efectos 1-1-2025)
- **Literal:**
  - «una deducción de 100 euros por cada persona integrante de su núcleo familiar que tenga enfermedad celíaca diagnosticada.»
  - El núcleo familiar es el contribuyente, su cónyuge o pareja inscrita, y «aquellas personas que le den derecho a la aplicación del mínimo por ascendientes o descendientes».
  - «Cuando dos o más contribuyentes tengan derecho […] por razón de una misma persona, su importe se distribuirá por partes iguales.»
  - Hace falta un informe médico oficial del SSPA o del SNS, o de la aseguradora privada.
- **Límite de renta:** ninguno en el texto.
- **Campo:** **nuevo**, `enfermedad_celiaca: true` por persona. Tipo **(nuevo)** `fija_por_persona_con_flag` o similar.
```yaml
        - id: familias_celiacas
          norma: "Art. 22 quater Ley 5/2021"
          estado: confirmado
          fuente: "Art. 22 quater Ley 5/2021, añadido por la DF 9.ª.5 de la Ley 8/2025 con efectos desde el 1-1-2025 (DF 18.ª.b; BOE-A-2026-945); versión BOE p=20251231"
          tipo: fija_por_persona_flag    # (nueva): contribuyente, cónyuge, desc./asc. con mínimo
          flag: enfermedad_celiaca
          importe: 100
          prorratea_progenitores: true   # por la misma persona, a partes iguales
```

### A3. Gastos veterinarios (art. 22 ter, efectos 1-1-2025)
- **Literal:**
  - «del 30% de las cantidades satisfechas en el periodo impositivo en concepto de gastos veterinarios derivados de la adquisición de animales de compañía o de la tenencia de perros de asistencia.»
  - «El importe máximo de la deducción será de 100 euros anuales por contribuyente y será aplicable en relación con los gastos veterinarios satisfechos por el contribuyente desde el 1 de enero de 2025».
  - Periodo de los gastos: el año siguiente a la adquisición, los 3 años siguientes si fue adopción, o toda la tenencia si es un perro de asistencia.
  - Solo cuentan vacunaciones, desparasitación y tratamientos obligatorios, y la esterilización preceptiva.
  - Hace falta factura veterinaria.
  - Límite de renta: «no supere los 80.000 euros en tributación individual ni los 100.000 euros en tributación conjunta».
  - Solo para adquisiciones desde el 1-1-2025, salvo los perros de asistencia.
- **Campo:** **nuevo**, `gastos_veterinarios` (gasto que ya cumple los requisitos).
```yaml
        - id: gastos_veterinarios
          norma: "Art. 22 ter Ley 5/2021"
          estado: confirmado
          fuente: "Art. 22 ter Ley 5/2021, añadido por la DF 9.ª.4 de la Ley 8/2025 con efectos desde el 1-1-2025 (DF 18.ª.b; BOE-A-2026-945); versión BOE p=20251231"
          tipo: porcentaje_campo
          campo: gastos_veterinarios
          porcentaje: 0.30
          limite: 100
          base_max_individual: 80000
          base_max_conjunta: 100000
          suma_bases: imponibles
```

### A4. Inversión en vivienda habitual protegida o de jóvenes (art. 9)
- **Literal:**
  - «una deducción del 6 % por las cantidades satisfechas en el período impositivo por la adquisición o rehabilitación del inmueble que constituya o vaya a constituir la vivienda habitual del contribuyente, siempre que concurra alguna de las siguientes condiciones […]: a) Que la vivienda tenga la calificación de protegida […] b) Que el adquirente sea menor de 35 años.»
  - En conjunta basta con que la edad la cumpla un cónyuge o el progenitor de la familia monoparental.
  - «La base máxima de esta deducción será de 9.040 euros anuales», es decir, una deducción máxima de 542,40 €. Es una cifra derivada, no literal.
  - Límite de renta: «no sea superior a 25.000 euros, en tributación individual, o a 30.000 euros».
  - La base incluye amortización, intereses y gastos, según la norma estatal a 31-12-2012.
- **Campos:** `adquisicion_vivienda_pagos` ya existe, aunque hoy solo lo usan los forales (`R/07_forales.R`). Hace falta **nuevo** `vivienda_protegida: true` (hogar). Con `base_maxima: 9040`, que ya existe en `porcentaje_campo`, y `edad_max: 35` como alternativa a la vivienda protegida: clave **(nueva)** `edad_max_o_flag: vivienda_protegida`. Otra opción son dos variantes en un `grupo`.
```yaml
        - id: inversion_vivienda_jovenes
          norma: "Art. 9.1.b) Ley 5/2021"
          estado: confirmado
          fuente: "Art. 9 Ley 5/2021, redacción de la Ley 7/2024 (BOE-A-2025-413) vigente en 2025; versión BOE p=20251231"
          tipo: porcentaje_campo
          campo: adquisicion_vivienda_pagos
          porcentaje: 0.06
          base_maxima: 9040
          edad_max: 35
          grupo: vivienda_an
          base_max_individual: 25000
          base_max_conjunta: 30000
          suma_bases: imponibles
        - id: inversion_vivienda_protegida
          norma: "Art. 9.1.a) Ley 5/2021"
          estado: confirmado
          fuente: "Art. 9 Ley 5/2021, versión BOE p=20251231"
          tipo: porcentaje_campo
          campo: adquisicion_vivienda_pagos
          porcentaje: 0.06
          base_maxima: 9040
          requiere_vivienda_protegida: true   # (nueva)
          grupo: vivienda_an
          base_max_individual: 25000
          base_max_conjunta: 30000
          suma_bases: imponibles
```
Nota: el texto no limita la deducción a compras anteriores a 2013. Remite a la norma estatal de 2012 solo para «la base y el límite máximo». No lo he podido contrastar con el Manual de la AEAT.

### A5. Cónyuge o pareja de hecho con discapacidad (art. 17)
- **Literal:** «Los contribuyentes con cónyuges o parejas inscritas […] que no sean declarantes por tributación individual del impuesto en el ejercicio y con un grado de discapacidad igual o superior al 65% tendrán derecho a aplicar una deducción de 100 euros». Límite de renta: «no sea superior a 25.000 euros, en caso de tributación individual, o a 30.000 euros».
- **Incompatibilidad:** «No tendrán derecho […] los contribuyentes con cónyuges o parejas de hecho con discapacidad que hayan aplicado la deducción prevista en el artículo anterior» (art. 16).
- **Campos:** el cónyuge con `discapacidad = "65_mas"` ya existe. Falta saber si el cónyuge presenta declaración individual: **nuevo** flag `no_declara` en el miembro cónyuge. En conjunta se cumple por definición. Clave **(nueva)** `requiere_conyuge_discapacidad_65_no_declarante`, y `grupo` con `contribuyente_discapacidad` para la incompatibilidad.
```yaml
        - id: conyuge_pareja_discapacidad
          norma: "Art. 17 Ley 5/2021"
          estado: confirmado
          fuente: "Art. 17 Ley 5/2021, versión BOE p=20251231"
          tipo: fija
          importe: 100
          requiere_conyuge_discapacidad_65_no_declarante: true   # (nueva)
          grupo: discapacidad_an          # incompatible con el art. 16 (contribuyente_discapacidad)
          base_max_individual: 25000
          base_max_conjunta: 30000
          suma_bases: imponibles
```
(Habría que añadir `grupo: discapacidad_an` al bloque `contribuyente_discapacidad` ya cargado. Ojo: el `grupo` elige la mayor, y la norma excluye el art. 17 cuando se aplica el 16. Los importes son 150 € frente a 100 €, así que el resultado coincide.)

### A6. Gastos de defensa jurídica de la relación laboral (art. 21)
- **Literal:** «por el importe que hayan satisfecho, en concepto de gastos de defensa jurídica derivados de la relación laboral en procedimientos judiciales de despido, extinción de contrato y reclamación de cantidades, con el límite de 200 euros.» Es el 100 % del gasto. Sin límite de renta.
- **Campo:** **nuevo**, `gastos_defensa_juridica_laboral`.
```yaml
        - id: defensa_juridica_laboral
          norma: "Art. 21 Ley 5/2021"
          estado: confirmado
          fuente: "Art. 21 Ley 5/2021, versión BOE p=20251231"
          tipo: porcentaje_campo
          campo: gastos_defensa_juridica_laboral
          porcentaje: 1.00
          limite: 200
```

### A7. Donativos con finalidad ecológica (art. 22)
- **Literal:** «del 10% de las cantidades donadas durante el período impositivo» a entidades públicas andaluzas de defensa del medio ambiente o a entidades de la Ley 49/2002 cuyo «fin exclusivo sea la defensa del medio ambiente y se hallen inscritas en los correspondientes registros de la Comunidad Autónoma de Andalucía»; «El límite de deducción aplicable será de 150 euros.» Sin límite de renta.
- **Campo:** **nuevo**, `donativos_ecologicos_andalucia`. Es distinto del `donativos` estatal: una donación a una entidad de la Ley 49/2002 cuenta en ambas deducciones, así que el usuario tendría que informar la parte ecológica por separado.
```yaml
        - id: donativos_ecologicos
          norma: "Art. 22 Ley 5/2021"
          estado: confirmado
          fuente: "Art. 22 Ley 5/2021, versión BOE p=20251231"
          tipo: porcentaje_campo
          campo: donativos_ecologicos_andalucia
          porcentaje: 0.10
          limite: 150
```

### A8. Adopción de hijos en el ámbito internacional (art. 12)
- **Literal:** «una deducción de 600 euros por cada hijo adoptado en el período impositivo en el que se haya inscrito la adopción en el Registro Civil.» Límite de renta: «no sea superior a 80.000 euros, en caso de tributación individual, o a 100.000 euros». «Cuando sean dos los contribuyentes […] su importe se distribuirá por partes iguales.»
- **Incompatibilidad:** con la del art. 11 (art. 11.5).
- **Campo:** **nuevo**, `adopcion_internacional: true` en el descendiente. Mismo `grupo` que `nacimiento_an`; con un solo hijo se aplica la mayor (600 € frente a 200 / 400 €).
```yaml
        - id: adopcion_internacional
          norma: "Arts. 12 y 11.5 Ley 5/2021"
          estado: confirmado
          fuente: "Arts. 11.5 y 12 Ley 5/2021, versión BOE p=20251231"
          tipo: fija_por_hijo_nacido
          solo_adopcion_internacional: true   # (nueva)
          importe: 600
          anios_ventana: 1
          grupo: nacimiento_an                # incompatible con el art. 11
          base_max_individual: 80000
          base_max_conjunta: 100000
          suma_bases: imponibles
          prorratea_progenitores: true
```
⚠ El `grupo` compara el total por hogar. Si hay varios hijos y solo uno es de adopción internacional, la incompatibilidad del art. 11.5 debería aplicarse hijo a hijo, y no es así. Hay que hacer un test con ese caso.

### A9. Inversión en acciones por constitución o ampliación de capital (art. 20)
- **Literal:** «del 20% de las cantidades invertidas durante el ejercicio en la adquisición de acciones o participaciones sociales como consecuencia de acuerdos de constitución de sociedades o de ampliación de capital» (SA, SAL, SRL, SRLL, cooperativa); «el límite de deducción aplicable será de 4.000 euros anuales»; «será del 50%, con un límite de 12.000 euros, en el caso de sociedades creadas o participadas por universidades o centros de investigación».
- **Requisitos:** como máximo el 40 % del capital con familiares; mantenerla 3 años; sin funciones ejecutivas ni relación laboral; escritura pública; domicilio en Andalucía; empleo.
- **Campos:** **nuevos**, `inversion_sociedades_nueva_creacion_an` y la variante `_universidad`.
```yaml
        - id: inversion_sociedades_nueva_creacion
          norma: "Art. 20.1-3 Ley 5/2021"
          estado: confirmado
          fuente: "Art. 20 Ley 5/2021, versión BOE p=20251231"
          tipo: porcentaje_campo
          campo: inversion_sociedades_nueva_creacion_an
          porcentaje: 0.20
          limite: 4000
        - id: inversion_sociedades_universidades
          norma: "Art. 20.4 Ley 5/2021"
          estado: confirmado
          fuente: "Art. 20 Ley 5/2021, versión BOE p=20251231"
          tipo: porcentaje_campo
          campo: inversion_sociedades_universidades_an
          porcentaje: 0.50
          limite: 12000
```

Con estas 9, el catálogo andaluz de 2025 (arts. 9 a 22 quater) queda completo. Ya estaban cargados los arts. 10, 11, 13, 14, 15, 16, 19 y 22 bis.

---

## 3. Campos y claves nuevas que pediría el motor (resumen)

| Ya existen | Nuevos campos de entrada | Nuevas claves o tipos del motor (R y JS) |
|---|---|---|
| `cuotas_ss_empleada_hogar`, `discapacidad`, `ayuda_terceros`, `movilidad_reducida`, `municipio_habitantes`, `nacido_en_ejercicio`, `adquisicion_vivienda_pagos` (solo forales hoy), `base_maxima`, `min_descendientes`, `importes_por_orden`, `grupo`, `prorratea_progenitores`, `base_max_por_miembro_uf` | MD: `intereses_prestamo_estudios`, `intereses_hipoteca_vivienda_habitual`, `exceso_intereses_hipoteca_euribor_2022`, `precio_adquisicion_vivienda`, `donativos_fundaciones_madrid`, `gastos_arrendador_vivienda`, `precio_adquisicion_vivienda_nacimiento`, `precio_adquisicion_vivienda_despoblacion`, `viviendas_vacias_arrendadas`, `alta_censo_primera_vez`, `anio_traslado_residencia`, `grado_dependencia`, `acogido` / `acogido_sin_contraprestacion`, `adopcion_internacional`, inversiones. AN: `enfermedad_celiaca`, `gastos_veterinarios`, `vivienda_protegida`, `no_declara` (cónyuge), `gastos_defensa_juridica_laboral`, `donativos_ecologicos_andalucia`, `adopcion_internacional`, inversiones | `campo_min_pct_base` (corrección del art. 8 MD), `base_max_suma_progenitores_descendientes`, `base_max_pct_base_liquidable`, `campo_max`, `fija_por_acogido`, `fija_por_acogido_mayor`, `fija_por_unidad`, `fija_por_familiar_discapacidad`, `fija_por_persona_flag`, `solo_adopcion_internacional`, `incremento_ambos_progenitores`, `requiere_familiar_gastos_asistencia`, `requiere_conyuge_discapacidad_65_no_declarante`, `requiere_vivienda_protegida`, `requiere_alta_censo_primera_vez`, `requiere_traslado_residencia_anios`, `requiere_actividad_o_pension`, `requiere_familiar_discapacidad_conviviente` |

Por CLAUDE.md, cada una necesita: test en `tests/testthat/test-ded-{madrid,andalucia}.R`, cálculo a mano en `docs/03_casos_validacion.md`, caso en `tools/validar_js.R`, y regenerar `params.json` y las páginas SEO de deducciones.

---

## 4. Resumen: verificado y no verificado

**Verificado con texto literal oficial** (BOE, legislación consolidada, versión vigente en 2025):
- Madrid (DL 1/2010, `BOCM-m-2010-90068`, versión `p=20250627`): todos los porcentajes, importes, límites, edades y umbrales de los arts. 5, 6, 7, 8 bis, 8 ter, 9, 10, 10 bis, 10 ter, 11 bis.2.b/c, 12, 12 bis, 13, 14, 15, 16, 17, 17 bis y 18.
- Andalucía (Ley 5/2021, `BOE-A-2021-17915`, versión `p=20251231`): todas las cifras de los arts. 9, 12, 17, 18, 20, 21, 22, 22 ter y 22 quater. Los efectos desde el 1-1-2025 de los arts. 22 ter y 22 quater están comprobados en la DF 18.ª.b) de la Ley 8/2025 (`BOE-A-2026-945`).
- Madrid art. 12 ter: es de 2026, no de 2025. Comprobado.

**No verificado:**
- **Manual Práctico de Renta 2025 de la AEAT:** inaccesible desde la red de la sesión (conexión cortada). No hay contraste para ninguna cifra ni para las interpretaciones.
- **Interpretaciones abiertas**, a dejar `provisional` hasta contrastarlas con el Manual:
  - Si el límite de 80.000 / 100.000 € del art. 18.1 de Andalucía alcanza al 18.3.
  - Si el art. 9 de Andalucía se aplica a compras posteriores a 2013.
  - Cómo restar «la parte de deducciones estatales» en el art. 14 de Madrid.
  - El cálculo del exceso de intereses del art. 10 de Madrid (lo tendría que dar el usuario).
- **Errores de lo ya cargado** (sección 0): falta el umbral del 20 % del art. 8 de Madrid (alquiler); el comentario de pendientes pone 24.000 € y la ley dice 24.744 €; Andalucía 10.1 admite a quien tiene 65 años justos y no modela a las víctimas.
