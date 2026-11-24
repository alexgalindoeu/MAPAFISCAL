> Notas de investigación (24-11-2026), sacadas de fuentes oficiales (BOE, boletines y Manual de la AEAT) por un agente de la sesión. **No son normativa cargada**: cada cifra hay que cotejarla otra vez y llevarla a `params/` con su test, su caso en `tools/validar_js.R` y su cálculo en `docs/03`. Lo ya hecho a partir de estas notas: Madrid, art. 8 (PR #106) y C. Valenciana, letra ad) (deporte).

# Deducciones autonómicas IRPF 2025 pendientes: Cataluña (ES-CT) y Comunitat Valenciana (ES-VC)

Investigación en solo lectura (24-11-2026). No se ha tocado el repo. Base: `params/2025/autonomico.yaml`
(bloques ES-CT, líneas 1124-1290, y ES-VC, 2103-2377), `R/06_deducciones.R`, `R/02_hogar.R`, `R/14_obligacion.R`,
`tests/testthat/test-ded-cataluna.R` y `test-ded-valenciana.R`.

## Fuentes usadas (todas oficiales)

| Clave | Norma | URL |
|---|---|---|
| CT-DL1/2024 | DL 1/2024, de 12 de marzo, libro sexto del Código tributario de Catalunya (BOE-A-2024-6951), **versión consolidada «Modificación publicada el 16/10/2025»**, que es la vigente el 31-12-2025 (la siguiente es la del 25/03/2026, y entre las dos no cambia ningún art. 612-x ni el 613-1, según el diff) | https://www.boe.es/buscar/act.php?id=BOE-A-2024-6951&tn=1&p=20251016 |
| CT-DL5/2025 | Decreto-ley 5/2025, de 25 de marzo (BOE-A-2025-10270): añade el art. 612-11 «con efectos de 1 de enero de 2025» | https://www.boe.es/buscar/doc.php?id=BOE-A-2025-10270 |
| CT-L11/2026 | Ley 11/2026, de 9 de julio (BOE-A-2026-24007): añade los arts. 612-13, 612-14 y 612-15 | https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-24007 |
| VC-L13/1997 | Ley 13/1997 (BOE-A-1998-8202), **versión «Modificación publicada el 29/12/2025»** (en vigor el 30-12-2025, DL 14/2025), que es la vigente en el devengo del 31-12-2025 | https://www.boe.es/buscar/act.php?id=BOE-A-1998-8202&tn=1&p=20251229 |
| VC-DL14/2025 | Decreto-ley 14/2025, de 26 de diciembre (DOGV-r-2025-90320): cambia la redacción de las letras c), h), i), l), n) y z). «entrará en vigor el día siguiente al de su publicación» (30-12-2025), así que **se aplica a 2025** | https://www.boe.es/buscar/doc.php?id=DOGV-r-2025-90320 |
| VC-DL1/2026 | Decreto-ley 1/2026, de 27 de febrero (DOGV-r-2026-90037): letras ac) y ad), «Con efectos para los devengos producidos a partir del 1 de enero de 2025, inclusive» | https://www.boe.es/buscar/doc.php?id=DOGV-r-2026-90037 |
| VC-DL2/2026 | Decreto-ley 2/2026, de 6 de marzo (DOGV-r-2026-90041): **nueva letra ae)** «Con efectos para los devengos producidos a partir del 1 de enero de 2025, inclusive» | https://www.boe.es/buscar/doc.php?id=DOGV-r-2026-90041 |
| VC-DL12/2024 | Decreto-ley 12/2024, de 12 de noviembre (DOGV-r-2024-90200), deducciones DANA (arts. 4 y 5); art. 5 en la redacción de la DF 1.ª del DL 17/2024 (DOGV-r-2024-90263) | https://www.boe.es/buscar/doc.php?id=DOGV-r-2024-90200 · https://www.boe.es/buscar/doc.php?id=DOGV-r-2024-90263 |
| AEAT-CT / AEAT-VC | Manual Práctico Renta 2025, Parte 2, Cataluña y Comunitat Valenciana. Lo he leído con WebFetch (curl desde el contenedor falla en el proxy). La herramienta solo devuelve **resúmenes**, no texto literal, así que lo uso para casillas e interpretación y **no** como cita literal de cifras | https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-cataluna.html · …/comunitat-valenciana.html |

Las versiones posteriores de la Ley 13/1997 (03/03, 06/03, 30/03, 02/07 y 10/08/2026) se compararon con un diff:
- DL 1/2026 cambia ac) y ad) con efecto retroactivo a 2025.
- DL 2/2026 añade ae), también con efecto retroactivo a 2025.
- La Ley 3/2026 (BOE-A-2026-15683, en vigor el 03-07-2026) solo retoca la redacción de c), h), i), l), n) y z): signos de puntuación y la supresión de «reconocido de manera permanente» en c). No cambia importes y no tiene efectos para 2025.

Por tanto, **el texto aplicable a 2025 es la versión 20251229, más ac)/ad) en la redacción del DL 1/2026 y ae) del DL 2/2026**.

---

# A. CATALUÑA (ES-CT)

El AEAT-CT recoge 13 deducciones para 2025. Las 7 ya cargadas coinciden con la lista. Pendientes:

## A1. Viudedad: art. 612-2 DL 1/2024 — VERIFICADO

Texto literal (CT-DL1/2024, sin modificaciones desde el texto original de 15-03-2024):
> «1. Los contribuyentes que queden viudos durante el ejercicio se pueden aplicar una deducción de 150 euros. Esta deducción es aplicable en la declaración correspondiente al ejercicio en que los contribuyentes queden viudos y a los dos ejercicios inmediatamente posteriores.
> 2. Si la persona contribuyente que queda viuda tiene a su cargo uno o más descendientes que, de conformidad con la normativa reguladora del impuesto sobre la renta de las personas físicas, computen al efecto de aplicar el mínimo por descendientes, puede aplicarse una deducción de 300 euros en la declaración correspondiente al ejercicio en que queda viuda y en los dos ejercicios inmediatamente posteriores, siempre que los descendientes mantengan los requisitos para computar al efecto de aplicar el mínimo citado.»

- Importe: 150 €, o 300 € con descendientes que dan derecho al mínimo. Son excluyentes: el 300 sustituye al 150 («puede aplicarse una deducción de 300 euros»).
- Ventana: año de la viudedad y los dos siguientes. En 2025 valen las viudedades de 2023, 2024 y 2025. El AEAT-CT titula «Para contribuyentes que hayan quedado viudos en los ejercicios 2023, 2024 y 2025» y pide el año de viudedad en la casilla [1936] del Anexo B.5.
- Sin límite de renta, ni porcentaje, ni reducción lineal (taper).
- Entrada nueva del motor: `persona$anio_viudedad` (entero). Hoy no existe.

```yaml
        - id: viudedad
          norma: "Art. 612-2.1 DL 1/2024"
          estado: confirmado
          fuente: "Art. 612-2 DL 1/2024, de 12 de marzo (libro sexto del Código tributario de Catalunya; BOE-A-2024-6951), redacción original vigente en 2025; AEAT Manual Práctico Renta 2025, Parte 2, Cataluña, «Para contribuyentes que hayan quedado viudos en los ejercicios 2023, 2024 y 2025» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-cataluna/contribuyentes-que-hayan-quedado-viudos.html)"
          tipo: fija
          importe: 150
          requiere_viudedad_anios: 3        # NUEVA puerta: ejercicio - anio_viudedad ∈ {0,1,2}
          prorratea_progenitores: false
          grupo: viudedad_ct
        - id: viudedad_descendientes
          norma: "Art. 612-2.2 DL 1/2024"
          estado: confirmado
          fuente: "(la misma)"
          tipo: fija
          importe: 300
          requiere_viudedad_anios: 3
          descendientes_min: 1              # que den derecho al mínimo por descendientes
          prorratea_progenitores: false
          grupo: viudedad_ct
```

## A2. Alquiler de la vivienda habitual de víctimas de violencia machista: art. 612-11 — VERIFICADO (cifras); compatibilidad no verificada

Texto literal (añadido por el art. 3.4 del DL 5/2025, BOE-A-2025-10270, «con efectos de 1 de enero de 2025»):
> «1. La contribuyente que acredite tener la condición de víctima de violencia machista de acuerdo con la Ley 5/2008, de 24 de abril, del derecho de las mujeres a erradicar la violencia machista, puede deducir el 20 %, hasta un máximo de 1.000 euros anuales, de las cantidades satisfechas en el periodo impositivo en concepto de alquiler de la vivienda habitual, siempre que su base imponible total, menos el mínimo personal y familiar no sea superior a 30.000 euros anuales.
> El porcentaje y el importe máximo de deducción se elevan hasta el 25 % y los 1.200 euros, si, además, la persona contribuyente tiene una discapacidad igual o superior al 65 % o si tiene algún hijo o hija menor de edad a cargo.
> Esta deducción se puede disfrutar como máximo durante tres ejercicios consecutivos.»

- **Ojo: el comentario del YAML («100 %/1.000 €») está mal. Son el 20 % con un máximo de 1.000 €, o el 25 % con un máximo de 1.200 €.**
- Límite de renta: base imponible − mínimo personal y familiar ≤ 30.000 €, que en el motor es `base_gate: menos_minimo`. La ley no fija un límite distinto en conjunta. El AEAT-CT lo concreta en las casillas [0435] + [0460] − [0520] y añade que hay que ser titular del contrato. También dice que el hijo menor debe dar derecho al mínimo por descendientes y que una misma vivienda no puede generar más de 1.000 € (1.200 €).
- El tope de tres ejercicios consecutivos no se puede modelar sin histórico. Se ignora y se deja en un comentario.
- **Compatibilidad con el art. 612-3: no lo dice ni el 612-11 ni el 612-3 en su texto literal.** No está verificado. Propongo no meterla en el `grupo: alquiler_ct` (acumulable) y marcarla `provisional` hasta cotejarlo con el apartado del Manual. En su página, el resumen de WebFetch no recoge nada sobre compatibilidad.
- Entrada nueva: `persona$victima_violencia_machista` (lógico). Hoy no existe; solo hay "víctimas de terrorismo" en otras CCAA, y también en pendientes. Hijo menor a cargo: descendiente < 18 con mínimo, que ya se puede calcular.

```yaml
        - id: alquiler_victimas_violencia_machista
          norma: "Art. 612-11 DL 1/2024 (añadido por el DL 5/2025, efectos 1-1-2025)"
          estado: provisional   # compatibilidad con el art. 612-3 sin verificar; el tope de 3 ejercicios no se modela
          fuente: "Art. 612-11 DL 1/2024 (BOE-A-2024-6951), añadido por el art. 3.4 del Decreto-ley 5/2025 (BOE-A-2025-10270) con efectos de 1-1-2025; AEAT Manual Práctico Renta 2025, Parte 2, Cataluña, «Por alquiler de la vivienda habitual de víctimas de violencia machista» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-cataluna/alquiler-vivienda-habitual-victimas-violencia-machista.html)"
          tipo: porcentaje_campo
          campo: alquiler_vivienda_pagos
          porcentaje: 0.20
          limite: 1000
          requiere_victima_violencia: true     # NUEVA puerta
          base_gate: menos_minimo
          base_max_individual: 30000
          base_max_conjunta: 30000             # la ley no prevé otro límite en conjunta
          prorratea_progenitores: false
          grupo: alquiler_victimas_ct
        - id: alquiler_victimas_violencia_machista_incrementada
          norma: "Art. 612-11.1, párrafo 2.º, DL 1/2024"
          estado: provisional
          fuente: "(la misma)"
          tipo: porcentaje_campo
          campo: alquiler_vivienda_pagos
          porcentaje: 0.25
          limite: 1200
          requiere_victima_violencia: true
          requiere_discapacidad_grado: "65_mas"   # o, en una segunda variante: descendientes_min: 1 + descendientes_edad_max_cuenta: 17
          base_gate: menos_minimo
          base_max_individual: 30000
          base_max_conjunta: 30000
          prorratea_progenitores: false
          grupo: alquiler_victimas_ct
```

## A3. Obligación de declarar por tener más de un pagador: art. 612-10 — VERIFICADO

Texto literal (sin modificar desde el original):
> «1. Los contribuyentes que, como consecuencia de tener más de un pagador de rendimientos del trabajo, resulten obligados a presentar la declaración del impuesto, de acuerdo con lo que dispone el artículo 96 de la Ley 35/2006, […] se pueden aplicar una deducción por el importe que resulte de restar de la cuota íntegra autonómica la cuota íntegra estatal, siempre que la diferencia sea positiva.
> 2. Esta deducción no resulta aplicable a los contribuyentes que se hayan acogido o se puedan acoger al procedimiento especial de retenciones regulado en el artículo 89.A) del Reglamento […]».

- Importe: max(0, cuota íntegra autonómica [0546] − cuota íntegra estatal [0545]). Esas casillas las cita el AEAT-CT.
- Requisito: estar obligado a declarar **solo** porque hay más de un pagador, es decir, trabajo entre 15.876 € y 22.000 € con el 2.º y siguientes pagadores por encima de 1.500 €. El AEAT-CT detalla los casos excluidos: capital mobiliario o ganancias con retención por más de 1.600 €; imputaciones o letras sin retención por más de 1.000 €; cualquier rendimiento de capital inmobiliario, de actividades o de ganancias no retenidas. Recuerda también que con más de 22.000 € siempre hay obligación.
- El motor ya tiene `trabajo$otros_pagadores` y `obligacion_declarar_persona()` en `R/14_obligacion.R` (umbrales `trabajo_varios_pagadores: 15876` y `segundo_pagador_umbral`), así que **no hacen falta entradas nuevas**. Lo que falta es un `tipo` nuevo, `diferencia_cuotas_aut_est`, y una puerta `requiere_obligacion_solo_por_pagadores`: obligado con el límite de varios pagadores y no obligado con el de un solo pagador, sin otras causas de obligación. La exclusión del procedimiento especial (modelo 146, pensionistas) no se modela y va en un comentario.

```yaml
        - id: obligacion_declarar_mas_de_un_pagador
          norma: "Art. 612-10 DL 1/2024"
          estado: confirmado
          fuente: "Art. 612-10 DL 1/2024 (BOE-A-2024-6951), redacción original vigente en 2025; AEAT Manual Práctico Renta 2025, Parte 2, Cataluña, «Por obligación de presentar la declaración del IRPF por razón de tener más de un pagador» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-cataluna/presentar-declaracion-irpf-razon-tener-pagador.html)"
          tipo: diferencia_cuotas_aut_est          # NUEVO: max(0, 0546 − 0545)
          requiere_obligacion_solo_por_pagadores: true   # NUEVA puerta (usa R/14_obligacion.R)
          prorratea_progenitores: false
```
Nota: el resultado depende del orden de cálculo. Usa cuotas **íntegras**, no líquidas, así que se puede calcular antes de las demás deducciones.

## A4. Intereses de préstamos AGAUR para máster y doctorado: art. 612-5 — VERIFICADO

> «1. Los contribuyentes pueden deducir el importe de los intereses pagados en el periodo impositivo correspondiente a los préstamos concedidos a través de la Agencia de Gestión de Ayudas Universitarias e Investigación para la financiación de estudios de máster y de doctorado.»

- Se deduce el 100 % de los intereses, sin límite ni puerta de renta. El AEAT-CT pide el número de identificación del préstamo en la casilla [1928] del Anexo B.5.
- Campo nuevo: `persona$intereses_prestamo_agaur`. Hoy no existe.

```yaml
        - id: intereses_prestamos_master_doctorado
          norma: "Art. 612-5 DL 1/2024"
          estado: confirmado
          fuente: "Art. 612-5 DL 1/2024 (BOE-A-2024-6951), redacción original vigente en 2025; AEAT Manual Práctico Renta 2025, Parte 2, Cataluña, «Por el pago de intereses de préstamos para los estudios de máster y doctorado» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-cataluna/pago-intereses-prestamos.html)"
          tipo: porcentaje_campo
          campo: intereses_prestamo_agaur
          porcentaje: 1.0
```

## A5. Tramo autonómico de la deducción por vivienda (régimen transitorio): art. 613-1 — VERIFICADO

> «1. […] los porcentajes de deducción por inversión en vivienda habitual en el tramo autonómico son los siguientes: a) Con carácter general, el 7,5 %. b) El 15 % si se trata de las obras de adecuación de la vivienda habitual de personas con discapacidad […].
> 2. Los contribuyentes que han adquirido la vivienda habitual antes del 30 de julio de 2011, o han satisfecho antes de esta fecha cantidades para la construcción de la vivienda habitual y tengan derecho a la deducción por inversión en la vivienda, se aplican el porcentaje del 9 % cuando se encuentren en alguna de les situaciones siguientes: a) Tener treinta y dos años o menos en la fecha de devengo del impuesto. b) Haber estado en el paro durante ciento ochenta y tres días o más durante el ejercicio. c) Tener un grado de discapacidad igual o superior al 65 %. d) Formar parte de una unidad familiar que incluya por lo menos un hijo en la fecha de devengo del impuesto.
> Para poder disfrutar de este porcentaje de deducción, es necesario que la suma de la base imponible general y del ahorro, menos el mínimo personal y familiar, […] no exceda de 30.000 euros. En el caso de tributación conjunta, este límite se computa de modo individual para cada uno de los contribuyentes que tenga derecho a la deducción […].»

- El 7,5 % general ya lo aplica `estatal.yaml: deduccion_vivienda_transitoria.porcentaje_autonomico_defecto: 0.075`, y coincide con la ley.
- Faltan dos casos:
  - El 15 % por obras de adecuación por discapacidad. Hoy no se distingue el tipo de pago.
  - El 9 %.
- No es una deducción de la `lista`: cambia el porcentaje autonómico de la deducción transitoria. Propongo un bloque `tramo_autonomico_vivienda` por territorio, que lea `deducciones_estatales()` en `R/06_deducciones.R:33-41`, que hoy usa siempre el porcentaje por defecto.
- Entradas: `vivienda_transitoria_pagos` ya existe. Hay que añadir:
  - `vivienda_adquirida_antes_30_07_2011` (lógico);
  - opcionalmente `vivienda_obras_adecuacion_discapacidad_pagos`.
- Para el paro de 183 días o más se puede usar `desempleado` + `meses_desempleo >= 6`, aunque es una aproximación por meses en vez de días.

```yaml
    tramo_autonomico_vivienda:      # ES-CT; lo lee deducciones_estatales()
      norma: "Art. 613-1 DL 1/2024"
      estado: confirmado
      fuente: "Art. 613-1 DL 1/2024 (BOE-A-2024-6951), redacción original vigente en 2025; AEAT Manual Práctico Renta 2025, Parte 2, Cataluña, «Tramo autonómico de la deducción por inversión en vivienda habitual» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-cataluna/tramo-autonomico-deduccion-inversion-vivienda-habitual.html)"
      porcentaje_general: 0.075
      porcentaje_obras_adecuacion_discapacidad: 0.15
      incrementado:
        porcentaje: 0.09
        adquisicion_antes_de: "2011-07-30"
        alternativos: { edad_max: 32, dias_paro_min: 183, discapacidad_grado: "65_mas", hijo_en_uf: true }
        base_gate: menos_minimo         # 0435 + 0460 − 0520 <= 30.000, también por contribuyente en conjunta
        base_max: 30000
```

## A6. Donaciones para medio ambiente, patrimonio natural y custodia del territorio: art. 612-8 — VERIFICADO

En el YAML figura como «% por confirmar». El texto:
> «1. Los contribuyentes se pueden aplicar […] una deducción del 15 % de las cantidades donadas, con el límite máximo del 5 % de la cuota íntegra autonómica, a favor de fundaciones o asociaciones que figuren en el censo de entidades ambientales vinculadas a la ecología y a la protección y mejora del medio ambiente del departamento competente en esta materia.»

Campo nuevo: `donativos_medio_ambiente_cat`. La clave `limite_pct_cuota_autonomica` ya existe.
```yaml
        - id: donativos_medio_ambiente
          norma: "Art. 612-8 DL 1/2024"
          estado: confirmado
          fuente: "Art. 612-8 DL 1/2024 (BOE-A-2024-6951), redacción original vigente en 2025; AEAT Manual Práctico Renta 2025, Parte 2, Cataluña, «Por donaciones a determinadas entidades en beneficio del medio ambiente…» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-cataluna/donaciones-determinadas-entidades-beneficio.html)"
          tipo: porcentaje_campo
          campo: donativos_medio_ambiente_cat
          porcentaje: 0.15
          limite_pct_cuota_autonomica: 0.05
```

## A7. Novedades que no están en el YAML

- **Art. 612-13, talidomida (Ley 11/2026).** Se aplican los tipos medios de gravamen a la ayuda pública que se integra en la base. Su apartado 3 dice: «es aplicable a las ayudas públicas percibidas e integradas por el contribuyente en las bases imponibles generales de los ejercicios 2023 y sucesivos», y el 4: «Para aplicar la deducción en las autoliquidaciones de los ejercicios 2023, 2024 y 2025 es necesario que el contribuyente inste a su rectificación». **Afecta a 2025 solo por rectificación.** Es un caso muy minoritario; propongo añadirla a `pendientes`.
- **Arts. 612-14 (forestal, 15 % con un límite del 5 % de la cuota) y 612-15 (celiaquía, 250 €).** El 612-14 entra en vigor el 14-07-2026 y el 612-15 está condicionado (DF 8.ª.2 Ley 11/2026), así que **ninguno afecta a 2025**. Son para `params/2026`.
- El art. 612-3 (alquiler general) fue modificado con efectos de 1-1-2025 por el DL 5/2025 y por la DF 3.ª de la Ley 8/2025 (BOE-A-2025-16833). El repo ya lo tiene como `confirmado`, y la redacción que he visto coincide con lo cargado (10 %, 500/1.000 €, 30.000/45.000 €).

---

# B. COMUNITAT VALENCIANA (ES-VC)

El AEAT-VC lista 41 apartados para 2025. El ámbito común es el art. 4.Cuatro y Cinco Ley 13/1997 (VC-L13/1997):
- Límite de base liquidable general + ahorro: 30.000/47.000 €.
- Reducción lineal entre 27.000-30.000 y 44.000-47.000, con divisor 3.000. En el motor: `taper_individual: [27000, 30000]`, `taper_conjunta: [44000, 47000]`.

Letras sujetas a ese límite según el texto literal del apartado Cuatro: a), b), c), d) general, e), f), g), h), i), k), l), n), ñ), u), v), w), y), ab). **No están sujetas: j), m), o), p)-s), x), z), aa).** ac), ad) y ae) llevan límites propios.

## B1. Nacimiento o adopción múltiples: art. 4.Uno.b) — VERIFICADO
> «b) Por nacimiento o adopción múltiples, durante el período impositivo, como consecuencia de parto múltiple o de dos o más adopciones constituidas en la misma fecha: 246 euros, siempre que los hijos nacidos o adoptados cumplan, a su vez, los demás requisitos que den derecho a la aplicación del correspondiente mínimo por descendientes […] Cuando más de un contribuyente declarante tenga derecho a la aplicación de esta deducción, su importe se prorrateará entre ellos por partes iguales. La aplicación de esta deducción resultará compatible con la de las recogidas en las letras a), c) y d) de este apartado Uno.»

- Son 246 € **por parto o adopción, no por hijo**. El AEAT-VC lo confirma: «one fixed 246 € per event».
- No hay ventana de varios años: solo el ejercicio («durante el período impositivo»).
- Según el art. 4.Uno.aa), es incompatible para el mismo descendiente con los incrementos por despoblamiento.
- Entrada: `hogar$parto_multiple` ya existe.

```yaml
        - id: nacimiento_adopcion_multiple
          norma: "Art. 4.Uno.b), Cuatro y Cinco Ley 13/1997"
          estado: confirmado
          fuente: "Art. 4.Uno.b), Cuatro y Cinco Ley 13/1997, redacción vigente a 31-12-2025 (BOE-A-1998-8202); AEAT Manual Práctico Renta 2025, Parte 2, Comunitat Valenciana, «Por nacimiento o adopción múltiples» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunitat-valenciana/nacimiento-adopcion-multiples.html)"
          tipo: fija_por_hijo_nacido
          anios_ventana: 1
          importe: 0
          importe_multiple: 246        # una vez por el hogar (R/06_deducciones.R:387-391)
          requiere_parto_multiple: true
          prorratea_progenitores: true
          base_max_individual: 30000
          base_max_conjunta: 47000
          taper_individual: [27000, 30000]
          taper_conjunta: [44000, 47000]
```
Hay que añadir `nacimiento_adopcion_multiple` a `descendientes_sin_deduccion` de los incrementos por despoblamiento. Hoy solo excluye `nacimiento_adopcion`; la letra aa) excluye a), b) y c). El campo admite un solo id, así que haría falta una lista.

## B2. Nacimiento, adopción o acogimiento de una persona con discapacidad: art. 4.Uno.c) — VERIFICADO (cifras); el supuesto de 303 € es ambiguo
Redacción del DL 14/2025, vigente el 31-12-2025:
> «c) Por nacimiento, adopción, acogimiento o delegación de guarda, durante el período impositivo, de una persona con un grado de discapacidad igual o superior al 65 %, o un grado de discapacidad intelectual o mental reconocido de manera permanente igual o superior al 33 %, siempre que la misma cumpla, a su vez, los demás requisitos que den derecho a la aplicación del correspondiente mínimo por descendientes […] – 246 euros, cuando sea el único hijo o hija, o persona menor de edad acogida o con delegación de guarda confines de adopción por el contribuyente que padezca dicha discapacidad. – 303 euros, cuando conviva con otra persona que dé derecho a la aplicación de esta deducción. Cuando más de un contribuyente declarante tenga derecho a la aplicación de esta deducción su importe se prorrateará entre ellos por partes iguales.»

- 246 € si es el único hijo con esa discapacidad, o 303 € si convive con otra persona que dé derecho a la deducción. Es compatible con a), b) y d).
- Entrada: `persona$discapacidad = "65_mas"` en el descendiente nacido ya existe. La discapacidad intelectual de grado 33 % o más no se distingue (la misma limitación que en h).
- Sobre el 303 €: no está claro si «otra persona que dé derecho» se refiere a otro hijo con discapacidad nacido en un ejercicio anterior. Propongo `provisional` para la variante de 303 € y aplicarla solo cuando haya al menos dos descendientes con discapacidad del 65 % o más, siendo al menos uno nacido en el ejercicio.

```yaml
        - id: nacimiento_adopcion_discapacidad
          norma: "Art. 4.Uno.c), Cuatro y Cinco Ley 13/1997 (red. DL 14/2025)"
          estado: confirmado
          fuente: "Art. 4.Uno.c), Cuatro y Cinco Ley 13/1997, redacción del Decreto-ley 14/2025 (DOGV-r-2025-90320) vigente a 31-12-2025 (BOE-A-1998-8202); AEAT Manual Práctico Renta 2025, Parte 2, Comunitat Valenciana, «Por nacimiento, adopción, acogimiento o delegación de guarda de personas con discapacidad» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunitat-valenciana/nacimiento-adopcion-acogimiento-delegacion-guarda-discapacidad.html)"
          tipo: fija_por_hijo_nacido
          anios_ventana: 1
          importe: 246
          importe_multiple: 0
          hijo_discapacidad_grado: "65_mas"      # NUEVA puerta por hijo nacido
          prorratea_progenitores: true
          grupo: nacimiento_discapacidad_vc
          base_max_individual: 30000
          base_max_conjunta: 47000
          taper_individual: [27000, 30000]
          taper_conjunta: [44000, 47000]
        # variante de 303 € (convive con otra persona con derecho a la deducción): estado provisional
```

## B3. Conciliación del trabajo con la vida familiar: art. 4.Uno.f) — VERIFICADO
Redacción de la Ley 5/2025 (BOE-A-2025-11959), en vigor el 01-06-2025:
> «f) Por conciliación del trabajo con la vida familiar: 460 euros por cada hijo o hija o persona acogida o con delegación de guarda con fines de adopción mayor de tres años y menor de cinco años.
> Esta deducción corresponderá exclusivamente a la madre o acogedora y serán requisitos para su disfrute: 1. Que las personas que generen el derecho a su aplicación permitan la aplicación del correspondiente mínimo por descendientes […] 2. Que la madre o acogedora realice una actividad por cuenta propia o ajena por la cual esté dada de alta en el régimen correspondiente de la Seguridad Social o mutualidad. 3. [límites del apartado Cuatro]
> La deducción se calculará de forma proporcional al número de meses en que se cumplan los requisitos anteriores […]
> La deducción tendrá como límite las cotizaciones y cuotas totales a la Seguridad Social y mutualidades de carácter alternativo devengadas en cada periodo impositivo, y que, además, lo hubiesen sido desde el día en que el menor cumpla los tres años y hasta el día anterior al que cumpla los cinco años. […] se computarán las cotizaciones y cuotas por sus importes íntegros […]»

**Ojo: el comentario del YAML («hijo 6 meses-3 años») está desfasado.** El texto vigente se refiere a hijos de 3 a 5 años. El AEAT-VC confirma 460 € e indica que la Ley 5/2025 crea un régimen transitorio para quien falleció antes del 01-06-2025, con el límite de cotizaciones por hijo. Ese caso no hace falta modelarlo. Según el AEAT-VC, es incompatible con la letra i), lo que coincide con la propia letra i).

Para el motor:
- El motor no registra el sexo. Se puede atribuir como en la maternidad estatal (`R/06_deducciones.R:502`, primer progenitor con actividad).
- Meses: el hijo cuenta los meses en que tiene entre 3 y 5 años. Con la edad entera a 31-12, la aproximación es hijo de 3 años = meses desde que cumplió 3 (desconocido) e hijo de 4 = 12 meses. Hace falta una fecha de nacimiento o una aproximación (`provisional`).
- Límite de cotizaciones: `trabajo$cotizaciones_ss` y las cuotas de RETA ya existen, aunque son las del año entero y no las del periodo de 3 a 5 años.

```yaml
        - id: conciliacion_trabajo_vida_familiar
          norma: "Art. 4.Uno.f), Cuatro y Cinco Ley 13/1997 (red. Ley 5/2025)"
          estado: provisional   # meses (fecha de nacimiento), atribución a la madre y tope de cotizaciones aproximados
          fuente: "Art. 4.Uno.f), Cuatro y Cinco Ley 13/1997, redacción de la Ley 5/2025 (BOE-A-2025-11959), vigente a 31-12-2025 (BOE-A-1998-8202); AEAT Manual Práctico Renta 2025, Parte 2, Comunitat Valenciana, «Por conciliación del trabajo con la vida familiar» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunitat-valenciana/conciliacion-trabajo-vida-familiar.html)"
          tipo: fija_por_hijo
          importe: 460
          edad_hijo_min: 3
          edad_hijo_max: 4
          requiere_madre_trabaja: true        # NUEVA (o reutilizar la lógica de maternidad)
          limite_cotizaciones_propias: true   # NUEVO tope
          prorratea_progenitores: true
          base_max_individual: 30000
          base_max_conjunta: 47000
          taper_individual: [27000, 30000]
          taper_conjunta: [44000, 47000]
```

## B4. Contratación indefinida de empleados de hogar para el cuidado de personas: art. 4.Uno.i) — VERIFICADO
Redacción del DL 14/2025:
> «i) […] el 50 % de las cuotas satisfechas por las cotizaciones efectuadas durante el periodo impositivo por los meses en cuyo último día se cumplan los siguientes requisitos: a) Que el contribuyente tenga a su cargo a: – una o varias personas de edad menor de 5 años […] mínimo por descendentes […]; – una o varias personas ascendentes […] mayores de 75 años, o de 65 años si tienen una discapacidad igual o superior al 65 % […]. b) Que los contribuyentes desarrollen actividades por cuenta propia o ajena […]
> El límite de la deducción será de 660 euros en caso de que el contribuyente tenga a su cargo un menor, y de 1.100 euros en el supuesto de que sean dos menores o más o se trate de familias monoparentales, de acuerdo con lo que establece el Decreto 19/2018 […]. Cuando el contribuyente tenga a su cargo un ascendiente el límite será de 330 euros, aumentando a 550 euros en el supuesto de que sean dos o más. Cuando dos contribuyentes tengan derecho a la aplicación de esta deducción, su límite se prorrateará entre ellos por partes iguales. Esta deducción resultará incompatible con las establecidas en las letras e, f y h de este apartado.»

- Los límites de menores y de ascendientes **se suman**: el ejemplo del AEAT-VC da 1.100 + 330 = 1.430 €. Por eso no sirve un `grupo` de variantes. Hace falta un límite compuesto: `limite_por_menores {1: 660, "2+": 1100, monoparental: 1100}` + `limite_por_ascendientes {1: 330, "2+": 550}`.
- La reducción lineal se aplica al límite.
- La incompatibilidad con e), f) y h) exige elegir la combinación más favorable. Hoy los `grupo` solo admiten variantes de una misma deducción, así que **hace falta lógica nueva**.
- Entrada: `cuotas_ss_empleada_hogar` ya existe (Andalucía, Madrid). Requisito de actividad: `requiere_progenitores_trabajan` o `requiere_trabajo_o_actividad`, que ya existen.

```yaml
        - id: contratacion_indefinida_empleada_hogar
          norma: "Art. 4.Uno.i), Cuatro y Cinco Ley 13/1997 (red. DL 14/2025)"
          estado: confirmado
          fuente: "Art. 4.Uno.i), Cuatro y Cinco Ley 13/1997, redacción del Decreto-ley 14/2025 vigente a 31-12-2025 (BOE-A-1998-8202); AEAT Manual Práctico Renta 2025, Parte 2, Comunitat Valenciana, «Por contratar de manera indefinida a personas afiliadas en el Sistema Especial de Empleados de Hogar…» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunitat-valenciana/contratar-manera-indefinida-personas-afiliadas.html)"
          tipo: porcentaje_campo
          campo: cuotas_ss_empleada_hogar
          porcentaje: 0.50
          limite_compuesto:                    # NUEVO
            menores_5: { "1": 660, "2+": 1100, monoparental: 1100 }   # monoparental = título del Decreto 19/2018 (hogar$titulo_monoparental)
            ascendientes: { "1": 330, "2+": 550 }   # > 75, o > 65 con discapacidad >= 65 %, con mínimo por ascendiente
          requiere_trabajo_o_actividad: true
          incompatible_con: [custodia_guarderias, conciliacion_trabajo_vida_familiar, ascendientes_75]   # NUEVO
          prorratea_progenitores: true
          base_max_individual: 30000
          base_max_conjunta: 47000
          taper_individual: [27000, 30000]
          taper_conjunta: [44000, 47000]
```

## B5. Primera adquisición de la vivienda habitual por menores de 35 años: art. 4.Uno.k) — VERIFICADO
> «k) Por cantidades destinadas a la primera adquisición de su vivienda habitual por contribuyentes de edad igual o inferior a 35 años a la fecha de devengo del impuesto: el 5 % de las cantidades satisfechas durante el período impositivo por la primera adquisición de vivienda que constituya o vaya a constituir la residencia habitual del contribuyente, excepción hecha de la parte de las mismas correspondiente a intereses. […] La aplicación de esta deducción resultará compatible con la de las recogidas en las letras j) y l) de este apartado Uno.»

- La ley no fija una base máxima. El AEAT-VC tampoco la indica y dice que deben cumplirse «los requisitos generales de la deducción estatal por inversión en vivienda habitual».
- El apartado Dos exige que el patrimonio aumente y la DA 16.ª limita los medios de pago. Según la letra m), es incompatible con m) para las mismas cantidades.
- Campo nuevo: `primera_vivienda_pagos_sin_intereses`. Hoy no existe; `vivienda_transitoria_pagos` es otra cosa.

```yaml
        - id: primera_adquisicion_vivienda_35
          norma: "Art. 4.Uno.k), Dos, Cuatro y Cinco Ley 13/1997"
          estado: confirmado
          fuente: "Art. 4.Uno.k), Dos, Cuatro y Cinco y DA 16.ª Ley 13/1997, redacción vigente a 31-12-2025 (BOE-A-1998-8202); AEAT Manual Práctico Renta 2025, Parte 2, Comunitat Valenciana, «Por cantidades destinadas a la primera adquisición de su vivienda habitual por contribuyentes de edad igual o inferior a 35 años» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunitat-valenciana/primera-adquisicion-vivienda-habitual-igual-anos.html)"
          tipo: porcentaje_campo
          campo: adquisicion_vivienda_vc_pagos      # NUEVO (sin intereses)
          requiere_primera_vivienda: true           # NUEVO flag
          porcentaje: 0.05
          edad_max: 36
          base_max_individual: 30000
          base_max_conjunta: 47000
          taper_individual: [27000, 30000]
          taper_conjunta: [44000, 47000]
```
Duda de interpretación: no está claro si la reducción lineal se aplica al importe de la deducción. El apartado Cinco habla de «importes y límites de deducción», y el AEAT-VC aplica el porcentaje al importe.

## B6. Adquisición de la vivienda habitual por personas con discapacidad: art. 4.Uno.l) — VERIFICADO
Redacción del DL 14/2025: «el 5 % de las cantidades satisfechas […] por la adquisición de la vivienda que constituya o vaya a constituir la residencia habitual del contribuyente, excepción hecha de la parte de las mismas correspondiente a intereses», para personas «con un grado de discapacidad igual o superior al 65 %; o un grado de discapacidad intelectual o mental reconocido de manera permanente igual o superior al 33 %». Es compatible con j) y k). Usa el mismo bloque que B5, sin el requisito de primera vivienda ni el `edad_max`, con `requiere_discapacidad_grado: "65_mas"`.

## B7. Arrendamiento de una vivienda por actividad en otro municipio: art. 4.Uno.ñ) — VERIFICADO
> «ñ) […] el 10 % de las cantidades satisfechas en el periodo impositivo, con el límite de 224 euros. […] 1.º Que la vivienda arrendada, radicada en la Comunitat Valenciana, diste más de 50 kilómetros de aquella en la que el contribuyente residía inmediatamente antes del arrendamiento. 2.º Que las cantidades satisfechas en concepto de arrendamiento no sean retribuidas por el empleador. 3.º [límites del Cuatro] […] Esta deducción resultará compatible con la recogida en la letra n de este apartado.»

Entrada: flag nuevo `alquiler_por_traslado_laboral`, sobre `alquiler_vivienda_pagos`, con `porcentaje: 0.10`, `limite: 224` y la reducción lineal estándar. Es acumulable, así que va fuera del `grupo: arrendamiento_vc`.

## B8. Instalaciones de autoconsumo y energía renovable: art. 4.Uno.o) — VERIFICADO
> «o) Los contribuyentes podrán deducirse un 40 % del importe de las cantidades invertidas en instalaciones realizadas en la vivienda habitual […] Esta deducción podrá aplicarse a las inversiones realizadas en las viviendas que constituyan segundas residencias […] si bien en este supuesto el porcentaje de deducción será del 20 %. […] La base máxima anual de esta deducción se establece en 8.800 euros por vivienda y ejercicio. La parte de la inversión apoyada, en su caso, con subvenciones públicas no dará derecho a deducción. Las cantidades […] no deducidas por insuficiencia de cuota íntegra podrán aplicarse en […] los cuatro años inmediatos y sucesivos.»

- **No tiene límite de renta**: la letra o) no figura en el apartado Cuatro, y el AEAT-VC tampoco menciona límite.
- La exigencia de que aumente el patrimonio (apartado Dos) no se modela.
- Campo nuevo: `inversion_autoconsumo_vc`; opcionalmente `inversion_autoconsumo_vc_segunda` para el 20 %.

```yaml
        - id: autoconsumo_energia_renovable
          norma: "Art. 4.Uno.o) y Dos Ley 13/1997"
          estado: confirmado
          fuente: "Art. 4.Uno.o), Dos y DA 16.ª Ley 13/1997, redacción vigente a 31-12-2025 (BOE-A-1998-8202); AEAT Manual Práctico Renta 2025, Parte 2, Comunitat Valenciana, «Por cantidades invertidas en instalaciones de autoconsumo…» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunitat-valenciana/cantidades-invertidas-instalaciones-autoconsumo-generacion-termica.html)"
          tipo: porcentaje_campo
          campo: inversion_autoconsumo_vc
          porcentaje: 0.40
          base_maxima: 8800
```

## B9. Inversión en acciones o participaciones de entidades nuevas o de reciente creación: art. 4.Uno.z) — VERIFICADO
Redacción del DL 14/2025, en vigor el 30-12-2025 y por tanto aplicable en el devengo de 2025:
> «z) 1. Los contribuyentes podrán deducir en la cuota íntegra autonómica, y con límite de 6.600 euros, el 30 % de las cantidades invertidas durante el ejercicio en la suscripción y desembolso de acciones o participaciones sociales […] 2. La deducción regulada en el número 1 podrá incrementarse en un 15 % adicional, con límite de 15.000 euros, cuando […] las entidades receptoras de fondos cumplan alguna de las siguientes condiciones: – Acrediten ser pequeñas y medianas empresas innovadoras […] o estén participadas por universidades u organismos de investigación. – Tengan su domicilio fiscal en algún municipio en riesgo de despoblamiento. – Sean calificados como Empresas Emergentes de la Comunitat Valenciana. 3. […] el importe no deducido podrá aplicarse en los tres períodos impositivos siguientes […]»

- Antes del DL 14/2025, el límite incrementado era de **9.900 €** (versión de 31-05-2025). Para 2025 vale **15.000 €**, con el 45 % en total («15 % adicional»). Hay que comprobar si el Manual lo aplica así; no lo he podido cotejar literalmente.
- Sin límite de renta.
- Campo nuevo: `inversion_entidades_nuevas_vc`; opcionalmente otro para el caso incrementado.

```yaml
        - id: inversion_entidades_nuevas
          norma: "Art. 4.Uno.z) Ley 13/1997 (red. DL 14/2025)"
          estado: confirmado
          fuente: "Art. 4.Uno.z) Ley 13/1997, redacción del Decreto-ley 14/2025 (DOGV-r-2025-90320) vigente a 31-12-2025 (BOE-A-1998-8202); AEAT Manual Práctico Renta 2025, Parte 2, Comunitat Valenciana, «Por inversión en la adquisición de acciones y participaciones sociales en entidades nuevas o de reciente creación» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunitat-valenciana/inversion-adquisicion-acciones-participaciones-entidades.html)"
          tipo: porcentaje_campo
          campo: inversion_entidades_nuevas_vc
          porcentaje: 0.30
          limite: 6600
          grupo: inversion_entidades_vc
        - id: inversion_entidades_nuevas_incrementada
          norma: "Art. 4.Uno.z).2 Ley 13/1997 (red. DL 14/2025)"
          estado: provisional   # «15 % adicional» leído como 45 % total; falta cotejo con el Manual
          fuente: "(la misma)"
          tipo: porcentaje_campo
          campo: inversion_entidades_nuevas_vc_incrementada
          porcentaje: 0.45
          limite: 15000
          grupo: inversion_entidades_vc
```

## B10. Incremento de los costes de financiación ajena de la vivienda habitual: art. 4.Uno.u) — VERIFICADO
> «u) […] podrán deducirse el 50 % de la diferencia positiva entre las cantidades abonadas durante el periodo impositivo y las satisfechas durante el año anterior, siempre que no hubieran aplicado la deducción estatal por inversión en vivienda habitual, con el límite de 100 euros.» Además, una regla de prorrateo por 360 días si el préstamo se constituyó el año anterior, y la reducción lineal estándar (apartado Cuatro).

Campos nuevos: `intereses_vivienda_pagos` e `intereses_vivienda_pagos_anio_anterior`. Incompatible con `vivienda_transitoria_pagos > 0`.

## B11. Obras de conservación o mejora en la vivienda habitual: art. 4.Uno.w) — VERIFICADO
> «El importe de la deducción ascenderá al 20 por ciento de las cantidades satisfechas en el periodo impositivo por las obras realizadas. El importe de la deducción ascenderá hasta un 50 por ciento de las cantidades satisfechas […] por las obras realizadas dirigidas a mejorar la accesibilidad de personas con un grado de discapacidad igual o superior al 33 %. […] La base máxima anual de esta deducción será de 5.500 euros.»

- Lleva la reducción lineal estándar.
- Excluye las inversiones de la letra o) y la parte subvencionada.
- Cuando varios contribuyentes tienen derecho por la misma vivienda, la base se pondera según su porcentaje de titularidad.
- Campo nuevo: `obras_conservacion_vivienda_vc`; opcionalmente `obras_accesibilidad_vivienda_vc` para el 50 %.

## B12. Gastos de salud: art. 4.Uno.ac) — VERIFICADO, con límites del DL 1/2026
Cinco conceptos compatibles entre sí. El límite es por contribuyente.
> «1. Para el tratamiento y cuidado de las personas afectadas por enfermedades crónicas de alta complejidad y las denominadas "raras", hasta 100 euros. En el supuesto de que se trate de una familia numerosa o monoparental, la deducción será de hasta 150 euros. 2. Destinados al tratamiento y cuidado de personas diagnosticadas de daño cerebral adquirido o de la enfermedad de alzhéimer, hasta 100 euros. [ídem 150 €] 3. […] salud bucodental de carácter no estético, el 30 % de los gastos generados. El importe máximo de la deducción será de 150 euros. 4. […] salud mental, el 30 % […] máximo […] 150 euros. 5. […] lentes graduadas […] el 30 % […] máximo […] 100 euros.»

**Límite de renta para 2025 (DL 1/2026, con efectos desde el 1-1-2025):** «Que la suma de la base liquidable general y de la base liquidable del ahorro no sea superior a 60.000 euros en tributación individual y a 78.000 euros en caso de tributación conjunta. Los límites de deducción se aplicarán a los contribuyentes cuya suma […] sea inferior a 54.000 euros, en tributación individual, o inferior a 72.000 euros, en tributación conjunta.» La reducción lineal divide por **6.000**. El AEAT-VC lo confirma.

**Atención: la versión consolidada de 29-12-2025 todavía dice 32.000/48.000 con reducción entre 29.000 y 32.000; para 2025 no vale.**

- En los conceptos 1 y 2 no hay porcentaje («hasta 100 euros»), así que lo leo como el 100 % del gasto con ese tope. Queda `provisional` hasta cotejarlo con el Manual.
- Campos nuevos, uno por concepto: `gastos_salud_cronicas_raras`, `gastos_salud_dca_alzheimer`, `gastos_salud_bucodental`, `gastos_salud_mental`, `gastos_salud_lentes`. Hoy existe `gastos_enfermedad`, pero es de otra CCAA.

```yaml
        - id: gastos_salud_bucodental
          norma: "Art. 4.Uno.ac).3 Ley 13/1997 (red. DL 1/2026, efectos 1-1-2025)"
          estado: confirmado
          fuente: "Art. 4.Uno.ac) Ley 13/1997, redacción del Decreto-ley 1/2026, art. 2 (DOGV-r-2026-90037), con efectos para los devengos desde el 1-1-2025 (BOE-A-1998-8202); AEAT Manual Práctico Renta 2025, Parte 2, Comunitat Valenciana, «Por cantidades satisfechas en determinados gastos de salud» (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunitat-valenciana/cantidades-satisfechas-determinados-gastos-salud.html)"
          tipo: porcentaje_campo
          campo: gastos_salud_bucodental
          porcentaje: 0.30
          limite: 150
          base_max_individual: 60000
          base_max_conjunta: 78000
          taper_individual: [54000, 60000]
          taper_conjunta: [72000, 78000]
        # salud mental: idem (0,30 / 150); lentes: 0,30 / 100;
        # crónicas o raras y DCA/alzhéimer: porcentaje 1.0, limite 100 (150 con familia numerosa o monoparental) -> provisional
```

## B13. Deporte y actividades saludables: art. 4.Uno.ad) — VERIFICADO (DL 1/2026)
> «el 30 % con el límite de 150 euros de importe de la deducción. Si el declarante es mayor de sesenta y cinco años o tiene una discapacidad igual o superior al 33 %, el porcentaje de deducción será del 50 % […] 150 euros. Si el declarante es mayor de setenta y cinco años o tiene una discapacidad igual o superior al 65 %, el porcentaje de deducción será del 100 % […] 150 euros.»

- Límites de renta de 60.000/78.000 €, con reducción lineal entre 54.000-60.000 y 72.000-78.000 (DL 1/2026, efectos 2025).
- El campo `gastos_deporte` ya existe (Andalucía).
- Tres variantes en `grupo`: 30 %; 50 % con `edad_min: 66` o discapacidad ≥ 33; 100 % con `edad_min: 76` o discapacidad ≥ 65.

## B14. Gastos de fomento y formación musicales: art. 4.Uno.ae) — NUEVA, VERIFICADA (DL 2/2026, efectos 2025)
> «ae) Por las cantidades satisfechas en el período impositivo para sufragar los siguientes gastos vinculados con el fomento y formación musicales, con el límite de 150 euros.» Son conceptos tasados (conservatorios, sociedades musicales, formación, instrumentos y partituras, entradas). Lleva los mismos límites de 60.000/78.000 € y la misma reducción, con divisor 6.000.

Es el 100 % del gasto hasta 150 €; así lo resume también el AEAT-VC. Campo nuevo: `gastos_formacion_musical_vc`.

## B15. Otras deducciones de la lista (cifras verificadas en VC-L13/1997)

| Letra | Deducción | Cifras literales | Límite de renta | Entrada |
|---|---|---|---|---|
| j) | Arrendador de vivienda con renta por debajo del precio de referencia | «el 5 % de los rendimientos íntegros», «base máxima anual […] 3.300 euros»; contratos iniciados en el ejercicio y fianza depositada | No | nueva (`rendimientos_alquiler_precio_referencia`) |
| m) | Adquisición o rehabilitación con ayudas públicas | «112 euros por cada contribuyente», o el tipo medio autonómico × la ayuda en regeneración urbana | No | nueva |
| n) | Arrendamiento: tercera condición, víctima de violencia de género | 25 %/950 € con una condición, 30 %/1.100 € con dos o más; «Tener la consideración de víctima de violencia de género según […] la Ley 7/2012» | Sí | **flag nuevo `victima_violencia_genero`**; ampliaría las variantes ya cargadas |
| p) | Donaciones con finalidad ecológica | «El 20 por ciento para los primeros 250 euros y el 25 por ciento para el resto» | No; base ≤ 30 % de la base liquidable solo en q.2-3, r y s (apartado Dos) | nueva |
| q) | Patrimonio cultural valenciano | 20 % de los primeros 250 € y 25 % del resto | No | nueva |
| r) | Fomento del valenciano | 20 % de los primeros 250 € y 25 % del resto | No | nueva |
| s) | Fines culturales, científicos o deportivos no profesionales | «25 por ciento», o 20 % de los primeros 250 € si se aplica el art. 68.3.a LIRPF | No | nueva |
| y) | Vehículos nuevos (Orden 5/2020) | «El 10 %»; base máxima = importe subvencionable + 10 % | Sí | nueva |
| ab) | Tratamientos de fertilidad (mujeres de 40 a 45 años) | «100 euros» | Sí | nueva |
| — | DA 17.ª (COVID: ERTE, donaciones) | tipo medio autonómico; 20 % de los primeros 150 € y 25 % del resto | — | residual, no modelar |

## B16. DANA de octubre de 2024 (no está en el YAML; el AEAT-VC la incluye en 2025): DL 12/2024 — VERIFICADO
- **Art. 4, reparación de la vivienda habitual.** Texto: «Para los períodos impositivos terminados en los años 2024 y 2025 será de aplicación una deducción del 100 % de los gastos de reparación […] siempre que la suma de la base liquidable general y de la base liquidable del ahorro no sea superior a los 45.000 euros, en tributación individual, o a 60.000 euros, en tributación conjunta.» Y: «El importe máximo de la deducción será de 2.000 euros siempre que la suma […] sea inferior a 40.000 euros, en tributación individual, o inferior a 55.000 euros, en tributación conjunta.» La reducción lineal divide por 5.000. Se descuentan las ayudas públicas y la parte cubierta por el seguro. Solo para municipios del ámbito del Acuerdo del Consell de 4-11-2024. Arrastre de 4 años.
- **Art. 5, aportaciones a fondos propios de entidades.** Redacción de la DF 1.ª del DL 17/2024: «el 45% de las cantidades invertidas, desde el día de entrada en vigor de la presente norma hasta el 31 de diciembre de 2025», con un «límite por contribuyente de 9.900 euros». También: «La base de la deducción no podrá superar el 30 por cien de la base liquidable del contribuyente» y es «incompatible con la regulada en la letra z […] respecto de la misma entidad receptora».
- Entradas nuevas: flag de municipio afectado, gasto de reparación neto y aportación. Para la web son deducciones de nicho; propongo añadirlas a `pendientes` con estas cifras ya verificadas.

## Otras observaciones sobre el bloque ES-VC ya cargado (sin cambiar nada)
- `descendientes_sin_deduccion: nacimiento_adopcion` en los incrementos por despoblamiento: la letra aa) también los declara incompatibles con b) y c). Hay que revisarlo cuando se carguen B1 y B2.
- El comentario de cabecera dice «13 implementadas». Para 2025 el Manual tiene 41 apartados, con la nueva ae) y las de la DANA.

---

# Campos de entrada: existentes y nuevos

| Campo | ¿Existe? | Lo usan |
|---|---|---|
| `hogar$parto_multiple` | sí | VC b) |
| `persona$discapacidad` (también en descendientes) | sí | VC c), l); CT 612-11 |
| `trabajo$otros_pagadores` + `R/14_obligacion.R` | sí | CT 612-10 |
| `alquiler_vivienda_pagos` | sí | CT 612-11, VC ñ) |
| `cuotas_ss_empleada_hogar` | sí | VC i) |
| `gastos_deporte` | sí | VC ad) |
| `vivienda_transitoria_pagos` | sí | CT 613-1 |
| `desempleado` / `meses_desempleo` | sí | CT 613-1 (paro de 183 días o más, aproximado) |
| `anio_viudedad` | **no** | CT 612-2 |
| `victima_violencia_machista` / `victima_violencia_genero` | **no** | CT 612-11, VC n) |
| `intereses_prestamo_agaur` | **no** | CT 612-5 |
| `donativos_medio_ambiente_cat` | **no** | CT 612-8 |
| `vivienda_adquirida_antes_30_07_2011` (+ obras de adecuación) | **no** | CT 613-1 |
| madre / sexo, meses de alta, fecha de nacimiento del hijo | **no** | VC f) |
| `adquisicion_vivienda_vc_pagos` + `primera_vivienda` | **no** | VC k), l) |
| `alquiler_por_traslado_laboral` | **no** | VC ñ) |
| `inversion_autoconsumo_vc` | **no** | VC o) |
| `inversion_entidades_nuevas_vc` | **no** | VC z) |
| intereses de la vivienda del año y del anterior | **no** | VC u) |
| `obras_conservacion_vivienda_vc` | **no** | VC w) |
| `gastos_salud_*` (5) | **no** | VC ac) |
| `gastos_formacion_musical_vc` | **no** | VC ae) |

Cambios de motor que harían falta, con paridad R ↔ JS en `web/js/irpfsim.js`:
- tipo `diferencia_cuotas_aut_est` (CT 612-10);
- puertas `requiere_viudedad_anios`, `requiere_victima_violencia` y `hijo_discapacidad_grado`;
- un `limite_compuesto` de menores + ascendientes y un `incompatible_con` entre deducciones distintas (VC i);
- un porcentaje autonómico de vivienda transitoria por territorio (CT 613-1);
- una lista en `descendientes_sin_deduccion`.

---

# Resumen

**Verificado con texto literal oficial (BOE / versiones consolidadas de BOE con DOGV/DOGC):**
- CT 612-2, viudedad: 150/300 €, año de la viudedad y los dos siguientes, sin límite de renta.
- CT 612-11, víctimas: **20 %/1.000 € o 25 %/1.200 €** (el YAML dice por error «100 %/1.000 €»), base − mínimo ≤ 30.000 €, efectos 1-1-2025.
- CT 612-10, dos pagadores: max(0, cuota íntegra autonómica − estatal).
- CT 612-5, AGAUR: 100 % de los intereses.
- CT 613-1, vivienda: 7,5 %, 15 % y 9 % con sus requisitos.
- CT 612-8, medio ambiente: 15 % con un límite del 5 % de la cuota íntegra autonómica.
- VC b) 246 € por parto; VC c) 246/303 €.
- VC f): **460 € por hijo de 3 a 5 años** (el comentario del YAML está desfasado).
- VC i): 50 % con un límite de 660/1.100 € + 330/550 €, acumulables.
- VC k), l): 5 %; VC ñ): 10 %/224 €; VC o): 40 %/20 %, base de 8.800 €, sin límite de renta.
- VC u): 50 %/100 €; VC w): 20 %/50 %, base de 5.500 €.
- VC z): 30 %/6.600 €, incrementada con límite de **15.000 €** (DL 14/2025).
- VC ac)/ad): **límites de 60.000/78.000 € con reducción de 54.000 a 60.000 y de 72.000 a 78.000 (DL 1/2026, retroactivo a 2025)**.
- VC ae), música: nueva, 150 €, retroactiva a 2025.
- VC j), m), p)-s), y), ab).
- DANA (DL 12/2024): art. 4, 100 % con máximo de 2.000 €; art. 5, 45 % con límite de 9.900 €.

**No verificado o dudoso (dejar `provisional` o `pendiente`):**
- Compatibilidad de CT 612-11 con 612-3: no aparece en la norma.
- El supuesto exacto de 303 € de VC c).
- Si «hasta 100 €» en VC ac).1-2 significa el 100 % del gasto.
- La lectura del 45 % total en VC z).2.
- Aproximaciones del motor en VC f): meses, madre, tope de cotizaciones.
- CT 612-13 (talidomida): se aplica a 2025 solo por rectificación.
- CT 612-14 y 612-15: no afectan a 2025 (son para 2026).
- El Manual AEAT 2025 es accesible con WebFetch pero solo da resúmenes. Las citas literales de este informe son todas del BOE. Las referencias AEAT valen para casillas e interpretación y conviene cotejarlas literalmente antes de marcar `confirmado` aquello que dependa del Manual: los conceptos 1 y 2 de ac), z).2 y la compatibilidad de 612-11.
