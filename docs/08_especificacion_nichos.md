# Especificación: vivienda, despido y doble imposición (reglas «de nicho»)

Documento de trabajo para la sesión que tenga R y pueda implementar estas reglas en el motor
de referencia (`R/`) y en su port (`web/js/irpfsim.js`) con paridad al céntimo. Aquí no se
toca el motor ni `params/`: solo se especifica. Sigue las «Reglas al añadir normativa» de
`CLAUDE.md` (fuente primaria, `estado` honesto, test + caso a mano + caso del validador, sin
cifras en el código).

Régimen: **común** (Ley 35/2006, LIRPF; RD 439/2007, RIRPF). País Vasco y Navarra tienen
normas propias para todo esto; quedan fuera (ver § 8).

| # | Regla | Prioridad | Dónde entra en el motor |
|---|---|---|---|
| 1 | Exención por reinversión en vivienda habitual (art. 38.1 LIRPF, art. 41 RIRPF) | alta | `ganancia_elemento()` / `gananciaElemento()` |
| 3 | Imputación de rentas inmobiliarias prorrateada por días y titularidad (art. 85 LIRPF) | alta | `imputacion_inmobiliaria()` / `imputacionInmobiliaria()` |
| 4 | Amortización del inmueble alquilado y su efecto al vender (art. 23.1.b LIRPF; arts. 14 y 40 RIRPF) | alta | `rn_capital_inmobiliario()` y `ganancia_elemento()` |
| 2 | Exención por transmisión de vivienda habitual de mayores de 65 (art. 33.4.b LIRPF) | media | `ganancia_elemento()` |
| 5 | Exención de la indemnización por despido (art. 7.e LIRPF; arts. 53 y 56 y DT 11.ª ET) | media | `rn_trabajo_previo()` / `rnTrabajoPrevio()` |
| 6 | Deducción por doble imposición internacional en dividendos (art. 80 LIRPF) | media | tras la cuota líquida, antes de la DA 61.ª |

---

## 0. Estado de la verificación contra el BOE (léase primero)

En la sesión que redactó este documento **no se pudo leer el BOE**: `www.boe.es` (y la sede de
la AEAT) no están en los dominios permitidos de la red de la sesión, y la búsqueda web solo
devolvió fuentes secundarias (Iberley, consultas de la DGT, artículos). Por tanto:

- **Ningún valor nuevo de este documento está `confirmado`.** Todos van con
  `estado: pendiente`. Las cifras (2 años, 65 años, 2 %, 1,1 %, 3 %, 180.000 €, 33/45/20 días,
  24/42/12 mensualidades…) son las que recoge la redacción conocida de la norma, pero no se
  han cotejado con el texto consolidado vigente.
- La sesión que implemente debe abrir cada artículo en el BOE consolidado (enlaces abajo),
  comprobar el literal y solo entonces pasar a `confirmado` y citar en `fuente` el artículo
  y la fecha de actualización del texto consolidado. Si no puede, deja `pendiente` y el motor
  emite el aviso habitual (`avisos_parametros()`).
- Ya existen en `params/2025/estatal.yaml` (y se heredan en 2026) cuatro bloques relacionados
  que **el motor no usa** y que están marcados `confirmado` **sin `fuente`**:
  `ganancias_exencion_reinversion_vivienda`, `ganancias_exencion_mayores_65`,
  `imputacion_renta_inmobiliaria` (este sí se usa: 2 % y 1,1 %), `capital_inmobiliario.amortizacion_porcentaje`
  y `deduccion_doble_imposicion_internacional`. Al ampliarlos, añadir `fuente` y revisar su
  `estado` con el mismo criterio (si se añaden campos sin verificar, el bloque baja a
  `pendiente` o los campos nuevos van en un sub-bloque con su propio `estado`).

Fuentes que hay que citar (BOE consolidado):

- LIRPF: <https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764> (arts. 7.e, 18.2, 23.1.b, 33.4.b, 35, 38.1, 79, 80, 85)
- RIRPF: <https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820> (arts. 14, 40, 41, 41 bis, 73)
- Estatuto de los Trabajadores: <https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430> (arts. 51, 52.c, 53.1.b, 56.1, DT 11.ª)

Se puede enlazar el artículo concreto con el ancla `#a7`, `#a38`, `#a85`, etc. (comprobar el
ancla exacta en la página, la de las letras y disposiciones varía: p. ej. `#dtundecima`).

---

## 1. Convenciones comunes a las seis reglas

### 1.1 Nombres de las entradas

El hogar JS usa camelCase y el R snake_case, como el resto del motor (`valorTransmision` ↔
`valor_transmision`). Todas las entradas nuevas son **opcionales**: si faltan, el resultado
tiene que ser idéntico al actual (los 100 % de casos del validador deben seguir igual).

### 1.2 Fechas: funciones auxiliares (mismo algoritmo en R y en JS)

Las fechas llegan como texto `"AAAA-MM-DD"`. Para no depender de husos horarios (en JS,
`new Date("2025-03-01")` es medianoche UTC; en R, `as.Date` no tiene hora), las dos
implementaciones trabajan con **números de día** (días desde 1970-01-01 en UTC):

- R: `as.numeric(as.Date(x))`.
- JS: `Date.UTC(a, m - 1, d) / 86400000` tras partir el texto (no `new Date(texto)` con hora local).

Funciones (añadir a `R/00_utils.R` y a la sección de utilidades de `irpfsim.js`):

| Función | Definición |
|---|---|
| `dias_incl(desde, hasta)` | `hasta − desde + 1` si `hasta ≥ desde`; si no, 0. Cuenta los dos extremos. |
| `dias_anio(a)` | 366 si `a` es bisiesto (divisible por 4 y no por 100, o por 400); si no, 365. |
| `sumar_anios(f, n)` | misma fecha `n` años después; si el día no existe (29-feb), el último día del mes (28-feb). Es el cómputo «de fecha a fecha» del art. 5.1 del Código Civil. **No** usar `seq.Date` ni `setFullYear`: los dos dan 1 de marzo. |
| `meses_iniciados(desde, hasta)` | meses entre `desde` y `hasta + 1 día` contando como mes completo cualquier fracción (para el art. 56.1 ET, «prorrateándose por meses»): `m = 12·(a2 − a1) + (m2 − m1)`; si `d2 < d1`, `m − 1`; y si queda resto de días, `+1`. Con `hasta + 1` = `(a2, m2, d2)`. |
| `recortar_ejercicio(desde, hasta, ejercicio)` | intersección de `[desde, hasta]` con `[ejercicio-01-01, ejercicio-12-31]`; si falta `desde`, el 1-ene; si falta `hasta`, el 31-dic. |

El ejercicio de referencia es `hogar$ejercicio` (no la constante `"2025-12-31"` que hoy usa
`ganancia_elemento()` como fecha de transmisión por defecto: conviene cambiarla de paso por
`paste0(ejercicio, "-12-31")`, con el mismo cambio en JS).

### 1.3 Redondeo

Sin redondeos intermedios: se redondea al céntimo (`red2`) solo en las salidas, como el resto
del motor. El orden de las operaciones que se indica en cada algoritmo debe ser el mismo en R
y en JS (los productos y divisiones en coma flotante no son asociativos al último bit).
Excepción: el tipo medio efectivo del art. 80 se redondea a dos decimales de porcentaje
porque lo dice la norma (§ 7).

### 1.4 Salidas nuevas

Cada regla añade su desglose a `componentes_renta` (R) / `componentesRenta` (JS), para que la
web pueda explicarlo y el validador comparar algo más que la cuota: `ganancias_exentas`,
`detalle_ganancias`, `amortizacion_inmuebles`, `indemnizacion_exenta`,
`deduccion_doble_imposicion`… Los nombres concretos están en cada sección. El validador
compara las claves que ya compara; si compara el objeto entero, las nuevas tienen que salir
iguales en los dos motores.

---

## 2. Regla 1 — Exención por reinversión en vivienda habitual

### 2.1 Norma (resumen)

- **Art. 38.1 LIRPF.** Se excluye de gravamen la ganancia patrimonial obtenida por la
  transmisión de la vivienda habitual del contribuyente siempre que el **importe total
  obtenido** se reinvierta en la adquisición (o rehabilitación) de una nueva vivienda
  habitual, en las condiciones del reglamento. Si el importe reinvertido es inferior al
  total obtenido, solo se excluye la **parte proporcional** de la ganancia que corresponda a
  la cantidad efectivamente reinvertida.
- **Art. 41 RIRPF.**
  - La reinversión se hace, de una vez o sucesivamente, en un **plazo no superior a dos
    años** desde la fecha de transmisión. La doctrina administrativa y el Manual de la AEAT
    admiten también la vivienda adquirida en los **dos años anteriores** a la venta, en
    cuanto el importe obtenido se destine a pagar su precio (verificar el literal del
    art. 41.1 RIRPF vigente).
  - Venta a plazos o con precio aplazado: la reinversión está en plazo si el importe de los
    plazos se destina a la nueva vivienda dentro del período impositivo en que se cobran.
  - **Financiación ajena de la vivienda vendida:** «se considerará, exclusivamente a estos
    efectos, como importe total obtenido el que resulte de minorar el valor de transmisión
    en el principal del préstamo que se encuentre pendiente de amortizar en el momento de la
    transmisión». Es decir: con hipoteca pendiente basta reinvertir lo que queda tras
    cancelarla.
  - El compromiso de reinversión se declara en la autoliquidación del año de la venta; si
    luego no se cumple, se regulariza con una complementaria (fuera del motor).
- **Art. 41 bis RIRPF.** Vivienda habitual: residencia continuada de al menos **tres años**
  (con excepciones: fallecimiento, matrimonio, separación, traslado laboral…), habitada en
  los 12 meses siguientes a la adquisición. Se entiende que se transmite la vivienda habitual
  si lo era en el momento de la venta o hasta cualquier día de los **dos años anteriores**.
  El motor no comprueba estos requisitos: los asume si el usuario marca
  `esViviendaHabitual` (aviso en la interfaz).

### 2.2 Parámetros (`params/<año>/estatal.yaml`)

Ampliar el bloque existente:

```yaml
ganancias_exencion_reinversion_vivienda:
  norma: "Art. 38.1 LIRPF; art. 41 RIRPF"
  fuente: "BOE-A-2006-20764 (art. 38.1), https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764; BOE-A-2007-6820 (arts. 41 y 41 bis), https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820"
  estado: pendiente          # subir a confirmado tras cotejar el literal consolidado
  plazo_anios: 2             # art. 41.4 RIRPF: «período no superior a dos años desde la fecha de transmisión»
  plazo_anterior_anios: 2    # reinversión en vivienda adquirida en los dos años anteriores (art. 41.1 RIRPF; verificar)
  minorar_prestamo_pendiente: true   # art. 41.3 RIRPF: importe total obtenido = VT − principal pendiente
  anios_residencia_vivienda_habitual: 3   # art. 41 bis.1 RIRPF (informativo: el motor no lo comprueba)
```

`plazo_anios` ya existe (marcado `confirmado` sin fuente): revisar su estado.

### 2.3 Entradas nuevas del hogar

En cada elemento de `pe.ganancias[]` (`persona(ganancias = list(...))` en R):

| JS | R | Tipo | Significado |
|---|---|---|---|
| `esViviendaHabitual` | `es_vivienda_habitual` | lógico | el elemento es (o fue en los 2 años anteriores) la vivienda habitual del transmitente |
| `prestamoPendiente` | `prestamo_pendiente` | número ≥ 0 | principal pendiente del préstamo de adquisición de la vivienda vendida en la fecha de la venta, en la parte del transmitente |
| `reinversiones` | `reinversiones` | lista de `{importe, fecha}` | cantidades destinadas a la nueva vivienda habitual (precio y gastos inherentes), con su fecha de pago |

`valorTransmision` y `valorAdquisicion` siguen siendo los del art. 35 LIRPF (valor de
transmisión **neto** de gastos y tributos de la venta; valor de adquisición con gastos,
mejoras y menos amortizaciones, ver regla 4). En copropiedad, todos los importes van en la
parte del declarante (como hoy).

`exenta: true` sigue existiendo y tiene prioridad (exención total sin cálculo).

### 2.4 Algoritmo

En `ganancia_elemento(el, P, regimen, pers, ejercicio)` (la función necesita ahora la
persona y el ejercicio; ajustar las llamadas en `agregar_rentas`/`agregarRentas`, en
`deduccion_rendimientos_trabajo`/`deduccionRendimientosTrabajo` y en la obligación de
declarar):

1. Si `exenta` → `{ahorro: 0, general: 0, exenta: G}` como hoy.
2. Calcular la ganancia `G` como hoy (VT − VA, con DT 9.ª si procede). Si `G ≤ 0` o el
   elemento no es transmisión o `regimen != "comun"` → sin cambios.
3. Si `es_vivienda_habitual` y aplica la regla 2 (mayor de 65, § 5) → exenta entera; fin.
4. Si `es_vivienda_habitual` y hay `reinversiones`:
   1. `ft` = `fecha_transmision` (o 31-12 del ejercicio). `limite_post = sumar_anios(ft, plazo_anios)`;
      `limite_ante = sumar_anios(ft, −plazo_anterior_anios)`.
   2. `R = Σ importe` de las reinversiones con `limite_ante ≤ fecha ≤ limite_post`. Las que caen
      fuera no cuentan (aviso: «reinversión fuera de plazo»).
   3. `ITO = VT − (minorar_prestamo_pendiente ? prestamo_pendiente : 0)`, con `VT` = `valor_transmision`.
   4. Proporción: si `ITO ≤ 0` y `R > 0` → `p = 1`; si `ITO ≤ 0` y `R = 0` → `p = 0`; si no,
      `p = min(1, R / ITO)`.
   5. `exenta = G × p`; `gravada = G − exenta`.
5. Devolver `{ahorro: gravada, general: 0, exenta: exenta}` (y la DT 9.ª ya aplicada en `G`).

Orden de las operaciones en el paso 4.5: `G * p` con `p = R / ITO` calculado antes (no
`G * R / ITO`), igual en los dos motores.

La parte exenta no entra en ninguna base ni en «otras rentas» del art. 20 ni en el
denominador de la DA 61.ª (son rentas exentas). Sí conviene devolverla en
`componentes_renta$ganancias_exentas` para mostrarla.

### 2.5 Casos de prueba (a mano)

Hogar base de los tres casos: Madrid (`ES-MD`), 2025, soltero de 45 años, trabajo 30.000 € y
1.905 € de cotizaciones, sin retenciones. Su base liquidable general es 26.095 € (Caso A de
docs/03), mayor que el mínimo, así que el mínimo se agota en la base general y la base del
ahorro tributa entera con la escala del ahorro (19 % hasta 6.000 €, 21 % hasta 50.000 €,
23 % hasta 200.000 € sumando las dos escalas).

Vivienda habitual vendida el 2025-04-15 por 300.000 € (neto de gastos de venta), comprada
en 2010 por 200.000 € con gastos: ganancia `G = 100.000 €`. Sin DT 9.ª (adquirida después de
1994).

**Caso R1-a — Reinversión parcial, sin préstamo.** Compra de la nueva vivienda el 2026-10-01
por 240.000 €.

| Paso | Cálculo | Importe |
|---|---|---|
| Límite del plazo | 2025-04-15 + 2 años | 2027-04-15 |
| Reinversión en plazo | 2026-10-01 ≤ 2027-04-15 | 240.000 |
| Importe total obtenido | 300.000 − 0 | 300.000 |
| Proporción | 240.000 / 300.000 | 0,80 |
| Ganancia exenta | 100.000 × 0,80 | 80.000,00 |
| Ganancia gravada (base del ahorro) | 100.000 − 80.000 | 20.000,00 |
| Cuota íntegra del ahorro estatal | 6.000 × 9,5 % + 14.000 × 10,5 % = 570 + 1.470 | 2.040,00 |
| Cuota íntegra del ahorro autonómica | igual (art. 76) | 2.040,00 |
| **Cuota del ahorro total** | | **4.080,00** |

**Caso R1-b — Con hipoteca pendiente de 100.000 €.** Misma reinversión de 240.000 €.

| Paso | Cálculo | Importe |
|---|---|---|
| Importe total obtenido | 300.000 − 100.000 | 200.000 |
| Proporción | min(1, 240.000 / 200.000) | 1 |
| Ganancia exenta | | 100.000,00 |
| Ganancia gravada | | **0,00** |

Variante R1-b2: reinvierte solo 150.000 € → proporción 150.000 / 200.000 = 0,75 → exenta
75.000; gravada 25.000; cuota del ahorro (570 + 19.000 × 10,5 %) × 2 = (570 + 1.995) × 2 =
**5.130,00**.

**Caso R1-c — Fuera de plazo.** Compra el 2027-04-16 por 400.000 €: un día después del
límite. Reinversión en plazo 0 → proporción 0 → gravada 100.000 €. Cuota del ahorro:
(570 + 44.000 × 10,5 % + 50.000 × 11,5 %) × 2 = (570 + 4.620 + 5.750) × 2 = **21.880,00**.
Con fecha 2027-04-15 (el último día) estaría en plazo y la exención sería total
(400.000 ≥ 300.000).

Caso extra para `sumar_anios`: venta el 2024-02-29 → límite 2026-02-28 (no 2026-03-01).
Una reinversión del 2026-03-01 está fuera de plazo.

### 2.6 Casos para `tools/validar_js.R`

```r
# Regla 1: reinversión en vivienda habitual (docs/08 § 2.5)
viv_r <- function(reinv, prestamo = 0) list(list(valor_transmision = 300000, valor_adquisicion = 200000,
  fecha_adquisicion = "2010-06-01", fecha_transmision = "2025-04-15", tipo_elemento = "inmueble",
  es_transmision = TRUE, es_vivienda_habitual = TRUE, prestamo_pendiente = prestamo, reinversiones = reinv))
viv_js <- function(reinv, prestamo = 0) list(list(valorTransmision = 300000, valorAdquisicion = 200000,
  fechaAdquisicion = "2010-06-01", fechaTransmision = "2025-04-15", tipoElemento = "inmueble",
  esTransmision = TRUE, esViviendaHabitual = TRUE, prestamoPendiente = prestamo, reinversiones = reinv))
for (cs in list(list("reinv_parcial", list(list(importe = 240000, fecha = "2026-10-01")), 0),
                list("reinv_hipoteca", list(list(importe = 240000, fecha = "2026-10-01")), 100000),
                list("reinv_hipoteca_parcial", list(list(importe = 150000, fecha = "2026-10-01")), 100000),
                list("reinv_fuera_plazo", list(list(importe = 400000, fecha = "2027-04-16")), 0))) {
  add(cs[[1]], "ES-MD", "ninguna", "no",
      list(persona("d1", "declarante", 45, trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905),
                   ganancias = viv_r(cs[[2]], cs[[3]]))),
      list(list(id = "d1", rol = "declarante", edad = 45, trabajo = list(dinerarias = 30000, cotizacionesSs = 1905),
                ganancias = viv_js(cs[[2]], cs[[3]]))))
}
```

Test R (`tests/testthat/test-ganancias-vivienda.R`): `ganancias_ahorro` = 20.000 / 0 / 25.000 /
100.000 y `ganancias_exentas` = 80.000 / 100.000 / 75.000 / 0.

### 2.7 Casos límite

- **Reinversiones sucesivas**: se suman las que estén en plazo (p. ej. pagos de una vivienda
  en construcción). Las entregas a cuenta cuentan por su fecha de pago.
- **La reinversión puede financiarse con un préstamo nuevo**: cuenta lo destinado a la
  nueva vivienda, sea cual sea el origen del dinero (doctrina DGT; verificar). El motor no
  distingue el origen.
- **Préstamo pendiente ≥ valor de transmisión** (`ITO ≤ 0`): cualquier reinversión > 0 da
  exención total; sin reinversión, ninguna (decisión del motor, documentarla como
  `provisional`).
- **Pérdida** en la venta de la vivienda habitual: no hay nada que eximir; se integra como
  hoy (pérdida en el ahorro).
- **Copropiedad / gananciales en individual**: cada cónyuge aplica la exención a su
  ganancia con sus reinversiones y su parte del préstamo (regla de ámbito de CLAUDE.md:
  requisito personal, no se reparte).
- **DT 9.ª + reinversión**: primero la DT 9.ª (calcula `G`), luego la proporción. El valor de
  transmisión consumido en el límite de 400.000 € de la DT 9.ª no cambia por la exención
  (hoy ese límite no se controla: no empeora).
- **Vivienda parcialmente habitual** (parte alquilada o afecta a actividad): la exención solo
  alcanza a la parte que es vivienda habitual; modelarlo partiendo el elemento en dos
  entradas de `ganancias[]`.
- **Compromiso incumplido** o reinversión que el usuario aún no ha hecho: el motor confía
  en las fechas que recibe; la web debe advertir de la complementaria.
- **Forales**: fuera (§ 8). Con `regimen != "comun"` se ignoran los campos nuevos (aviso).

---

## 3. Regla 3 — Imputación de rentas inmobiliarias por días y titularidad

### 3.1 Norma (resumen)

- **Art. 85.1 LIRPF.** Los inmuebles urbanos (y rústicos con construcciones no
  indispensables para la actividad) que no generen rendimientos, no estén afectos a una
  actividad y no sean la vivienda habitual (ni el suelo no edificado ni los inmuebles en
  construcción o no susceptibles de uso) imputan una renta del **2 %** del valor catastral,
  o del **1,1 %** si el valor catastral se revisó, modificó o determinó por un procedimiento
  de valoración colectiva de carácter general que haya entrado en vigor en el período o en
  los **diez** períodos anteriores (desde 2012).
  - Sin valor catastral, o sin notificar al titular a 31-12: **1,1 % sobre el 50 %** del
    valor por el que deba computarse en el Impuesto sobre el Patrimonio (en la práctica, el
    precio de adquisición).
  - Si el inmueble ha estado arrendado, afecto a actividad o en construcción solo una parte
    del año, o se adquirió o vendió en el año, la imputación se prorratea por el **número de
    días** en que se ha cumplido el supuesto (Manual de la AEAT; ejemplo con 62/366 días).
- **Art. 85.2 LIRPF.** La renta se imputa a los titulares según el art. 7 de la Ley del
  Impuesto sobre el Patrimonio, es decir, **en proporción a su titularidad**. Con un derecho
  real de disfrute (usufructo) imputa el usufructuario lo que correspondería al propietario.
- Las imputaciones van a la base general (ya lo hace el motor).

### 3.2 Parámetros

```yaml
imputacion_renta_inmobiliaria:
  norma: "Art. 85 LIRPF"
  fuente: "BOE-A-2006-20764 (art. 85), https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764"
  estado: pendiente          # el 2 % y el 1,1 % ya estaban «confirmado» sin fuente: cotejar
  tipo_general: 0.02
  tipo_revisado_10_anios: 0.011
  anios_revision: 10                       # informativo: lo decide el usuario con revisado_10_anios
  sin_valor_catastral_tipo: 0.011          # art. 85.1, párrafo de inmuebles sin valor catastral
  sin_valor_catastral_pct_base: 0.50       # sobre el 50 % del valor a efectos del Impuesto sobre el Patrimonio
  prorrata_dias: true                      # Manual AEAT; verificar el apoyo literal en el art. 85
```

### 3.3 Entradas nuevas

En cada elemento de `pe.imputacionInmobiliaria` (objeto o lista, como hoy):

| JS | R | Tipo | Defecto | Significado |
|---|---|---|---|---|
| `valorCatastral` | `valor_catastral` | número | 0 | valor catastral **total** del inmueble (ya existe) |
| `revisado10Anios` | `revisado_10_anios` | lógico | falso | ya existe |
| `porcentajeTitularidad` | `porcentaje_titularidad` | 0–1 | 1 | parte del declarante (0,5 en gananciales) |
| `sinValorCatastral` | `sin_valor_catastral` | lógico | falso | no tiene valor catastral o no se notificó a 31-12 |
| `valorPatrimonio` | `valor_patrimonio` | número | 0 | valor a efectos del IP (p. ej. precio de compra), solo si `sinValorCatastral` |
| `dias` | `dias` | entero | — | días del año a imputar (si se informa, manda) |
| `fechaInicio` / `fechaFin` | `fecha_inicio` / `fecha_fin` | fecha | 1-ene / 31-dic | periodo de titularidad en el año (compra o venta) |
| `diasExcluidos` | `dias_excluidos` | entero | 0 | días de ese periodo arrendado, afecto o en obras |

Compatibilidad: sin `porcentajeTitularidad`, `dias`, `fechaInicio`, `fechaFin` ni
`diasExcluidos`, la imputación es exactamente la actual. Ojo: hasta ahora el usuario podía
haber metido ya la mitad del valor catastral para un 50 %; la web debe pasar a pedir el valor
total y el porcentaje (cambio de formulario, `web/js/formulario.js`).

### 3.4 Algoritmo

Para cada inmueble `ii` (en `imputacion_inmobiliaria(pers, P, ejercicio)`):

1. `pi = P$estatal$imputacion_renta_inmobiliaria`.
2. Base y tipo:
   - si `sin_valor_catastral`: `base = valor_patrimonio × pi$sin_valor_catastral_pct_base`,
     `tipo = pi$sin_valor_catastral_tipo`;
   - si no: `base = valor_catastral`, `tipo = revisado_10_anios ? tipo_revisado_10_anios : tipo_general`.
3. Días:
   - si `dias` viene informado: `d = dias`;
   - si no: `(ini, fin) = recortar_ejercicio(fecha_inicio, fecha_fin, ejercicio)`;
     `d = dias_incl(ini, fin) − dias_excluidos`;
   - `d = max(0, min(d, dias_anio(ejercicio)))`.
4. `t = porcentaje_titularidad` (defecto 1), acotado a [0, 1].
5. **Orden fijo:** `imputacion = ((base * tipo) * t) * d / dias_anio(ejercicio)`.
   Con `d = dias_anio` y `t = 1` el resultado es bit a bit el actual (`base * tipo * 1 * 365 / 365`
   puede no ser idéntico al bit a `base * tipo` en coma flotante: **si no hay datos de días ni de
   titularidad, devolver `base * tipo` sin multiplicar**, para no mover ningún caso existente).
6. Sumar todos los inmuebles.

Fecha de venta: el día de la transmisión imputa al vendedor si se informa como `fecha_fin`
(cuenta ambos extremos). El comprador debería empezar al día siguiente; el motor no lo
controla (lo decide quien rellena las fechas). Documentarlo como convención `provisional`.

### 3.5 Casos de prueba (a mano), ejercicio 2025 (365 días)

| Caso | Datos | Cálculo | Imputación |
|---|---|---|---|
| I-a Titularidad 50 % | VC 120.000, revisado; todo el año | 120.000 × 1,1 % = 1.320 × 0,5 | **660,00** |
| I-b Compra en el año | VC 90.000, sin revisar; comprado el 2025-10-31 | días 31-oct…31-dic = 1 + 30 + 31 = 62; 90.000 × 2 % = 1.800 × 62 / 365 = 305,7534… | **305,75** |
| I-c Alquilado una parte | VC 60.000, revisado; alquilado del 2025-01-01 al 2025-03-31 (`diasExcluidos` = 31 + 28 + 31 = 90) | 365 − 90 = 275; 60.000 × 1,1 % = 660 × 275 / 365 = 497,2603… | **497,26** |
| I-d Sin valor catastral | `sinValorCatastral`, valor a efectos del IP 200.000 | 200.000 × 50 % = 100.000 × 1,1 % | **1.100,00** |
| I-e Combinado | I-a + I-b del mismo declarante | 660 + 305,7534… = 965,7534… | **965,75** |

Para el validador, un soltero de Madrid con trabajo (30.000 € / 1.905 €) y cada imputación
por separado; la base general sube exactamente en la imputación (26.095 + 660 = 26.755 en
I-a, por ejemplo), y como 28.095 € + imputación sigue por encima de 19.747,50 € la reducción
del art. 20 sigue en 0 (las imputaciones cuentan como «otras rentas», pero no cambia nada).

```r
# Regla 3: imputación prorrateada (docs/08 § 3.5)
imp <- list(
  imp_titularidad = list(r = list(valor_catastral = 120000, revisado_10_anios = TRUE, porcentaje_titularidad = 0.5),
                         js = list(valorCatastral = 120000, revisado10Anios = TRUE, porcentajeTitularidad = 0.5)),
  imp_compra      = list(r = list(valor_catastral = 90000, fecha_inicio = "2025-10-31"),
                         js = list(valorCatastral = 90000, fechaInicio = "2025-10-31")),
  imp_alquilado   = list(r = list(valor_catastral = 60000, revisado_10_anios = TRUE, dias_excluidos = 90),
                         js = list(valorCatastral = 60000, revisado10Anios = TRUE, diasExcluidos = 90)),
  imp_sin_vc      = list(r = list(sin_valor_catastral = TRUE, valor_patrimonio = 200000),
                         js = list(sinValorCatastral = TRUE, valorPatrimonio = 200000)))
for (k in names(imp))
  add(k, "ES-MD", "ninguna", "no",
      list(persona("d1", "declarante", 45, trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905),
                   imputacion_inmobiliaria = imp[[k]]$r)),
      list(list(id = "d1", rol = "declarante", edad = 45, trabajo = list(dinerarias = 30000, cotizacionesSs = 1905),
                imputacionInmobiliaria = imp[[k]]$js)))
```

Añadir además un caso **bisiesto** con `ejercicio = 2028` solo cuando exista
`params/2028/`; mientras tanto, test unitario de `dias_anio(2028) == 366` y de
`imputacion` con 62/366 (el ejemplo del Manual: 1,1 % × 50 % × 105.000 × 62 / 366 =
577,50 × 62 / 366 = 97,8279… → **97,83**).

### 3.6 Casos límite

- **Usufructo**: imputa el usufructuario el 100 % de lo que correspondería al propietario; el
  nudo propietario no imputa. Se modela con `porcentajeTitularidad` = 1 en el usufructuario
  y sin entrada en el nudo propietario (documentarlo en la ayuda).
- **Vivienda habitual** y hasta dos plazas de garaje anejas: no imputan. El motor no la
  filtra: no debe meterse en `imputacionInmobiliaria` (validación de formulario).
- **Inmueble en obras** o no susceptible de uso por razones urbanísticas: no imputa
  (`diasExcluidos` = todo el periodo, o no se declara).
- **Alquiler turístico o de temporada** con días vacíos: imputan los días en que no estuvo
  arrendado (criterio administrativo; hay jurisprudencia reciente sobre los días ofertados y
  no ocupados: comprobar antes de documentarlo como `confirmado`).
- **Revisión catastral en el propio año**: cuenta como dentro de los diez años (1,1 %). La
  decide el usuario.
- **`dias` > días del año** o negativos: se acota a [0, 365/366].
- **Ingresos del alquiler de la parte del año arrendada**: van por `capitalInmobiliario` con
  sus gastos de ese periodo; los gastos del periodo no arrendado no son deducibles (el motor
  no los reparte: lo hace quien rellena). Ver la amortización por días en la regla 4.

---

## 4. Regla 4 — Amortización del inmueble alquilado y efecto al venderlo

### 4.1 Norma (resumen)

- **Art. 23.1.b LIRPF.** Son gasto deducible del capital inmobiliario las cantidades
  destinadas a la amortización del inmueble y de los demás bienes cedidos con él, siempre
  que respondan a su depreciación efectiva, en las condiciones del reglamento. No está sujeta
  al tope de los ingresos del art. 23.1.a.1.º (ese tope solo afecta a intereses y
  reparación y conservación), así que puede dar rendimiento negativo.
- **Art. 14 RIRPF.**
  - 14.2.a: la amortización del inmueble es efectiva si cada año no excede del **3 %** del
    **mayor** de dos valores: el **coste de adquisición satisfecho** o el **valor catastral**,
    **sin incluir el valor del suelo**. Si no se conoce el valor del suelo, se calcula
    **prorrateando el coste** entre los valores catastrales del suelo y de la construcción
    de cada año.
  - 14.2.b: bienes muebles cedidos con el inmueble (mobiliario, electrodomésticos): el
    coeficiente de la tabla de amortizaciones simplificada (10 % para mobiliario y enseres;
    verificar la tabla vigente de la Orden de módulos / art. 30 RIRPF).
  - Coste de adquisición satisfecho: precio más gastos y tributos inherentes (notaría,
    registro, ITP o IVA, AJD) y el coste de las mejoras; sin intereses.
  - Si el inmueble se arrienda solo una parte del año, la amortización es la parte
    proporcional a los días arrendados; en copropiedad, en proporción a la titularidad.
- **Art. 40 RIRPF** (y art. 35.1.c LIRPF). Al transmitir el inmueble, el valor de
  adquisición se **minora en las amortizaciones fiscalmente deducibles, computándose en
  todo caso la amortización mínima**, aunque el contribuyente no la dedujera. Para el
  inmueble arrendado, la amortización mínima es la del porcentaje fijo del 3 % (verificar el
  literal del art. 40.1 RIRPF: «la resultante del período máximo de amortización o el
  porcentaje fijo que corresponda»).

### 4.2 Parámetros

```yaml
capital_inmobiliario:
  # bloque existente (reducción por arrendamiento de vivienda, irregular…) + sub-bloque nuevo
  amortizacion:
    norma: "Art. 23.1.b LIRPF; art. 14.2 RIRPF; art. 40 RIRPF"
    fuente: "BOE-A-2006-20764 (art. 23.1.b); BOE-A-2007-6820 (arts. 14 y 40), https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820"
    estado: pendiente
    porcentaje_inmueble: 0.03          # art. 14.2.a RIRPF (sustituye a amortizacion_porcentaje)
    porcentaje_mobiliario: 0.10        # tabla de amortización simplificada: mobiliario y enseres (verificar)
    minima_en_transmision: true        # art. 40 RIRPF: la mínima se resta aunque no se dedujera
```

`capital_inmobiliario.amortizacion_porcentaje: 0.03` existe y no se usa: sustituirlo por el
sub-bloque (y actualizar cualquier lectura en `supabase/seed/` si la hubiera). Nota de paso:
`rnCapitalInmobiliario` en JS tiene **hardcodeados** los porcentajes de reducción del
arrendamiento (0,90 / 0,70 / 0,60 / 0,50 y los forales 0,70 / 0,30 / 0,20) en lugar de leerlos de
`P` como hace R; aprovechar para leerlos de `P` (misma salida).

### 4.3 Entradas nuevas

**a) En cada inmueble de `pe.capitalInmobiliario[]`** (rendimiento del año):

| JS | R | Tipo | Significado |
|---|---|---|---|
| `amortizacion` | `amortizacion` | objeto | si viene, el motor calcula la amortización y la suma a los gastos; si no, todo igual que hoy |
| `amortizacion.costeAdquisicion` | `coste_adquisicion` | número | precio + gastos y tributos de la compra, del inmueble **entero** |
| `amortizacion.mejoras` | `mejoras` | número | coste de mejoras (se amortizan sin prorratear suelo; ver casos límite) |
| `amortizacion.valorCatastral` | `valor_catastral` | número | valor catastral total del año |
| `amortizacion.valorCatastralConstruccion` | `valor_catastral_construccion` | número | parte de construcción del valor catastral del año |
| `amortizacion.mobiliario` | `mobiliario` | número | coste del mobiliario cedido |
| `amortizacion.diasArrendado` | `dias_arrendado` | entero | días del año arrendado (defecto: todo el año) |
| `amortizacion.porcentajeTitularidad` | `porcentaje_titularidad` | 0–1 | defecto 1 |

El usuario no debe meter además la amortización en `gastosDeducibles` (aviso de la web).

**b) En cada elemento de `pe.ganancias[]`** (venta de un inmueble que estuvo alquilado):

| JS | R | Tipo | Significado |
|---|---|---|---|
| `amortizacion` | `amortizacion` | objeto | mismos campos de coste y valores catastrales que arriba |
| `amortizacion.arrendamientos` | `arrendamientos` | lista de `{anio, dias}` | días arrendados de cada año de tenencia (incluido el de la venta) |
| `amortizacion.deducidas` | `deducidas` | número | amortizaciones que efectivamente dedujo (informativo; ver algoritmo) |

`valorAdquisicion` sigue siendo el **sin** minorar (precio + gastos + mejoras); el motor
resta la amortización. Si el usuario ya la restó, que no rellene `amortizacion`.

### 4.4 Algoritmo

**Base de amortización del inmueble** (función común `base_amortizacion(a)`):

1. `frac_constr = valor_catastral_construccion / valor_catastral` (si `valor_catastral ≤ 0`,
   `frac_constr = 1` y aviso).
2. `coste_constr = coste_adquisicion * frac_constr + mejoras`.
3. `base = max(coste_constr, valor_catastral_construccion)`.

**Rendimiento del año** (en `rn_capital_inmobiliario`, para cada inmueble con `amortizacion`):

4. `d = dias_arrendado` (defecto `dias_anio(ejercicio)`); `t = porcentaje_titularidad` (defecto 1).
5. `amort_inm = base * pa$porcentaje_inmueble * t * d / dias_anio(ejercicio)`.
6. `amort_mob = mobiliario * pa$porcentaje_mobiliario * t * d / dias_anio(ejercicio)`.
7. `gastos = gastos_deducibles + gfin_topado + amort_inm + amort_mob` (la amortización **no**
   entra en el tope de `gfin`). El resto (reducción por arrendamiento de vivienda sobre el
   neto positivo) no cambia.

**Venta** (en `ganancia_elemento`, solo régimen común, antes de la DT 9.ª):

8. `minima = Σ_{(anio, dias) ∈ arrendamientos} base * pa$porcentaje_inmueble * t * dias / dias_anio(anio)`
   (sumar en el orden en que vienen; `t` = `porcentaje_titularidad`).
9. `reduccion_va = max(minima, deducidas)` si `minima_en_transmision`; si no, `deducidas`.
   (Con el 3 % la mínima coincide con la máxima deducible, así que en la práctica es
   `minima`; el `max` cubre amortizaciones de mobiliario u otras que se informen en
   `deducidas`.) **Decisión `provisional`**: no se acepta una amortización deducida por
   encima del máximo; si `deducidas > minima`, aviso.
10. `VA' = valor_adquisicion − reduccion_va` y `G = VT − VA'`; seguir con la DT 9.ª (si la
    hubiera, con la ganancia ya calculada así) y con las reglas 1 y 2.

Simplificación documentada: la base (paso 3) se toma con los valores catastrales que se
informan, iguales para todos los años. Si se quiere precisión con valores que cambian,
admitir `{anio, dias, valorCatastral, valorCatastralConstruccion}` en `arrendamientos` y
recalcular la base por año (segunda fase).

### 4.5 Casos de prueba (a mano)

Inmueble común a los tres: comprado el 2019-01-01 por 180.000 € + 12.000 € de gastos
(`costeAdquisicion` = 192.000); valor catastral 100.000 €, de construcción 60.000 € (60 %).

Base: `192.000 × 0,60 = 115.200`; `max(115.200, 60.000) = 115.200`; amortización anual al
3 % = **3.456,00 €**.

**Caso A4-a — Alquilado todo 2025, vivienda.** Ingresos 12.000; IBI, comunidad y seguro
1.500 (`gastosDeducibles`); intereses 2.000 (`gastosFinancieros`, por debajo del tope).

| Paso | Cálculo | Importe |
|---|---|---|
| Amortización | 115.200 × 3 % × 365 / 365 | 3.456,00 |
| Rendimiento neto | 12.000 − 1.500 − 2.000 − 3.456 | 5.044,00 |
| Reducción por arrendamiento de vivienda (general, 50 %) | 5.044 × 50 % | −2.522,00 |
| **Rendimiento neto reducido** | | **2.522,00** |

Sin amortización el rendimiento reducido sería (12.000 − 3.500) × 50 % = 4.250: la
amortización baja la base general en 1.728 €.

**Caso A4-b — Alquilado medio año y al 50 %.** Del 2025-07-01 al 2025-12-31
(`diasArrendado` = 31 + 31 + 30 + 31 + 30 + 31 = 184), titularidad 0,5. Ingresos de la
parte del declarante 3.000, sin otros gastos, no vivienda (local, sin reducción).

| Paso | Cálculo | Importe |
|---|---|---|
| Amortización | 115.200 × 3 % = 3.456 × 0,5 = 1.728 × 184 / 365 = 871,1013… | 871,10 |
| Rendimiento neto | 3.000 − 871,1013… | **2.128,90** |

Orden exacto de operaciones: `((115200 * 0.03) * 0.5) * 184 / 365`.

**Caso A4-c — Venta tras seis años alquilado.** Alquilado del 2019-01-01 al 2024-12-31
(años completos: `arrendamientos` = 2019:365, 2020:366, 2021:365, 2022:365, 2023:365,
2024:366), vacío desde 2025-01-01 y vendido el 2025-03-01 por 260.000 € netos de gastos.
El propietario **nunca dedujo amortización** (`deducidas` = 0). `valorAdquisicion` = 192.000.

| Paso | Cálculo | Importe |
|---|---|---|
| Amortización mínima | 6 años × 3.456 (cada año completo: días / días del año = 1) | 20.736,00 |
| Valor de adquisición minorado | 192.000 − 20.736 | 171.264,00 |
| Ganancia (base del ahorro) | 260.000 − 171.264 | 88.736,00 |
| Cuota del ahorro estatal | 6.000 × 9,5 % + 44.000 × 10,5 % + 38.736 × 11,5 % = 570 + 4.620 + 4.454,64 | 9.644,64 |
| **Cuota del ahorro total** (× 2) | | **19.289,28** |

Sin la regla, la ganancia sería 68.000 y la cuota (570 + 4.620 + 18.000 × 11,5 %) × 2 =
14.520: la amortización mínima sube la cuota en 4.769,28 € aunque no se dedujera.
(Este caso omite a propósito la imputación de enero y febrero de 2025, 59 días: en la
liquidación real habría que añadirla con la regla 3.)

Hogar para el validador: soltero de Madrid, 45 años, trabajo 30.000 € / 1.905 €.

```r
# Regla 4: amortización (docs/08 § 4.5)
am_r  <- list(coste_adquisicion = 192000, valor_catastral = 100000, valor_catastral_construccion = 60000)
am_js <- list(costeAdquisicion = 192000, valorCatastral = 100000, valorCatastralConstruccion = 60000)
add("amort_vivienda_anual", "ES-MD", "ninguna", "no",
    list(persona("d1", "declarante", 45, trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905),
      capital_inmobiliario = list(list(ingresos = 12000, gastos_deducibles = 1500, gastos_financieros = 2000,
        arrendamiento_vivienda = TRUE, tipo_arrendamiento = "general", amortizacion = am_r)))),
    list(list(id = "d1", rol = "declarante", edad = 45, trabajo = list(dinerarias = 30000, cotizacionesSs = 1905),
      capitalInmobiliario = list(list(ingresos = 12000, gastosDeducibles = 1500, gastosFinancieros = 2000,
        arrendamientoVivienda = TRUE, tipoArrendamiento = "general", amortizacion = am_js)))))
add("amort_local_medio_anio", "ES-MD", "ninguna", "no",
    list(persona("d1", "declarante", 45, trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905),
      capital_inmobiliario = list(list(ingresos = 3000, arrendamiento_vivienda = FALSE,
        amortizacion = c(am_r, list(dias_arrendado = 184, porcentaje_titularidad = 0.5)))))),
    list(list(id = "d1", rol = "declarante", edad = 45, trabajo = list(dinerarias = 30000, cotizacionesSs = 1905),
      capitalInmobiliario = list(list(ingresos = 3000, arrendamientoVivienda = FALSE,
        amortizacion = c(am_js, list(diasArrendado = 184, porcentajeTitularidad = 0.5)))))))
arr <- lapply(2019:2024, function(a) list(anio = a, dias = if (a %in% c(2020, 2024)) 366 else 365))
add("amort_minima_venta", "ES-MD", "ninguna", "no",
    list(persona("d1", "declarante", 45, trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905),
      ganancias = list(list(valor_transmision = 260000, valor_adquisicion = 192000, fecha_adquisicion = "2019-01-01",
        fecha_transmision = "2025-03-01", tipo_elemento = "inmueble", es_transmision = TRUE,
        amortizacion = c(am_r, list(arrendamientos = arr, deducidas = 0)))))),
    list(list(id = "d1", rol = "declarante", edad = 45, trabajo = list(dinerarias = 30000, cotizacionesSs = 1905),
      ganancias = list(list(valorTransmision = 260000, valorAdquisicion = 192000, fechaAdquisicion = "2019-01-01",
        fechaTransmision = "2025-03-01", tipoElemento = "inmueble", esTransmision = TRUE,
        amortizacion = c(am_js, list(arrendamientos = arr, deducidas = 0)))))))
```

(`arr` sirve para los dos lados porque `anio` y `dias` se llaman igual en R y en JS.)

Comprobaciones: `capital_inmobiliario` = 2.522,00 / 2.128,90; `ganancias_ahorro` = 88.736;
`amortizacion_inmuebles` = 3.456,00 / 871,10; `amortizacion_minima_transmision` = 20.736.

### 4.6 Casos límite

- **Suelo desconocido y valor catastral sin desglose**: no se puede prorratear; el motor usa
  `frac_constr = 1` con aviso (sobrestima). Mejor exigir el desglose en el formulario (viene
  en el recibo del IBI).
- **Valor catastral de construcción mayor que el coste prorrateado** (inmuebles antiguos
  comprados baratos): manda el catastral (paso 3).
- **Inmueble heredado o donado**: el «coste de adquisición» es el valor a efectos del ISD
  más los gastos y tributos inherentes (no el precio); lo rellena el usuario.
- **Mejoras**: se suman a la base de la construcción a partir de la fecha en que se hacen.
  Con un solo `mejoras` el motor las amortiza todo el año: para el año de la mejora,
  informar días aparte o aceptar la simplificación (`provisional`). Confirmar en el Manual
  de la AEAT si las mejoras se prorratean o no con el suelo (aquí: no).
- **Amortización con rendimiento negativo**: se permite (no hay tope); el negativo se integra
  en la base general.
- **Venta con años de alquiler parcial**: cada `{anio, dias}` cuenta su fracción con su
  `dias_anio` (bisiestos).
- **Año de la venta**: si estuvo alquilado hasta la venta, esos días cuentan en el
  rendimiento del año **y** en la mínima de la venta (es la misma amortización).
- **Arrendamientos anteriores a 1999 o con otro porcentaje histórico** (normativa anterior):
  fuera; si el usuario los tiene, que use `deducidas`. Pendiente de investigar.
- **Vivienda habitual que antes estuvo alquilada**: la reducción del valor de adquisición se
  aplica igual, y luego la regla 1 o 2 sobre la ganancia resultante.
- **Forales**: el País Vasco y Navarra tienen sus propias reglas de amortización y sus
  coeficientes de actualización: fuera.

---

## 5. Regla 2 — Exención por transmisión de la vivienda habitual de mayores de 65 años

### 5.1 Norma (resumen)

- **Art. 33.4.b LIRPF.** Están exentas las ganancias patrimoniales que se pongan de
  manifiesto con ocasión de la transmisión de su **vivienda habitual por mayores de 65
  años** o por personas en situación de **dependencia severa o gran dependencia** (Ley
  39/2006).
- La edad se mira en la **fecha de la transmisión**, no a 31-12.
- Vivienda habitual según el art. 41 bis RIRPF (también si dejó de serlo en los dos años
  anteriores a la venta).
- Distinta del art. 38.3 LIRPF (reinversión de cualquier elemento en una renta vitalicia,
  hasta 240.000 €): no forma parte de esta especificación (los parámetros ya están en
  `ganancias_exencion_mayores_65`).

### 5.2 Parámetros

```yaml
ganancias_exencion_mayores_65:
  norma: "Art. 33.4.b LIRPF (vivienda habitual); art. 38.3 LIRPF (renta vitalicia)"
  fuente: "BOE-A-2006-20764 (arts. 33.4.b y 38.3), https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764"
  estado: pendiente
  edad: 65                       # «mayores de sesenta y cinco años»: ver casos límite (¿65 cumplidos?)
  incluye_dependencia_severa: true
  renta_vitalicia_maxima: 240000 # art. 38.3 (no lo usa esta regla)
  plazo_constitucion_meses: 6    # art. 38.3 (no lo usa esta regla)
```

### 5.3 Entradas nuevas

- Persona: `fechaNacimiento` / `fecha_nacimiento` (opcional) y `dependencia` /
  `dependencia` (`"no"` | `"severa"` | `"gran_dependencia"`, defecto `"no"`).
- Elemento de `ganancias[]`: `esViviendaHabitual` (de la regla 1) y, opcional,
  `edadEnTransmision` / `edad_en_transmision` (manda si viene).

### 5.4 Algoritmo (paso 3 de § 2.4)

1. Solo si `regimen == "comun"`, `es_vivienda_habitual` y `G > 0`.
2. Edad en la transmisión `e`:
   - `edad_en_transmision` si viene;
   - si no, con `fecha_nacimiento`: años cumplidos a `fecha_transmision` (aniversario
     alcanzado: mismo mes y día o posterior; nacidos un 29-feb cumplen el 28-feb en años no
     bisiestos, igual que `sumar_anios`);
   - si no, `pers$edad` (edad a 31-12) con aviso «edad en la venta no informada».
3. Exenta entera si `e ≥ edad` o `dependencia ∈ {severa, gran_dependencia}` (con
   `incluye_dependencia_severa`). Devolver `{ahorro: 0, general: 0, exenta: G}`.

### 5.5 Casos de prueba (a mano)

Madrid 2025, trabajo o pensión 30.000 € / 1.905 € (base general 26.095, mínimo agotado en
la general salvo el incremento por edad, que tampoco llega a la base del ahorro: 5.550 +
1.150 = 6.700 < 26.095).

**Caso M-a — 67 años.** Vende su vivienda habitual el 2025-05-10 con ganancia de 150.000 €
(VT 250.000, VA 100.000). Exenta 150.000; base del ahorro 0; cuota del ahorro **0,00**.

**Caso M-b — Matrimonio en gananciales, individual.** Vivienda habitual al 50 %; ganancia
total 120.000 € (60.000 cada uno). D1 tiene 66 años; D2, 63. Sin reinversión.

| | D1 (66) | D2 (63) |
|---|---:|---:|
| Ganancia | 60.000 | 60.000 |
| Exenta (art. 33.4.b) | 60.000 | 0 |
| Base del ahorro | 0 | 60.000 |
| Cuota del ahorro | 0 | (570 + 4.620 + 10.000 × 11,5 %) × 2 = (570 + 4.620 + 1.150) × 2 = **12.680,00** |

(Requisito personal: no se reparte entre cónyuges; en conjunta cada uno aplica el suyo a
su parte y la base del ahorro conjunta es 60.000.)

**Caso M-c — Cumple 65 después de la venta.** Nacido el 1960-09-10, vende el 2025-06-01:
a la fecha de la venta tiene 64 → **no exenta** aunque a 31-12 tenga 65. Con nacimiento el
1960-06-01 tendría 65 cumplidos el mismo día de la venta → exenta (si se confirma que
«mayor de 65» incluye los 65 cumplidos, ver § 5.6).

```r
# Regla 2: mayores de 65 (docs/08 § 5.5)
vh_r  <- function(vt, va, ft = "2025-05-10") list(list(valor_transmision = vt, valor_adquisicion = va,
  fecha_adquisicion = "2000-01-15", fecha_transmision = ft, tipo_elemento = "inmueble", es_transmision = TRUE,
  es_vivienda_habitual = TRUE))
vh_js <- function(vt, va, ft = "2025-05-10") list(list(valorTransmision = vt, valorAdquisicion = va,
  fechaAdquisicion = "2000-01-15", fechaTransmision = ft, tipoElemento = "inmueble", esTransmision = TRUE,
  esViviendaHabitual = TRUE))
add("may65_exenta", "ES-MD", "ninguna", "no",
    list(persona("d1", "declarante", 67, trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905),
                 fecha_nacimiento = "1958-03-02", ganancias = vh_r(250000, 100000))),
    list(list(id = "d1", rol = "declarante", edad = 67, trabajo = list(dinerarias = 30000, cotizacionesSs = 1905),
              fechaNacimiento = "1958-03-02", ganancias = vh_js(250000, 100000))))
add("may65_cumple_despues", "ES-MD", "ninguna", "no",
    list(persona("d1", "declarante", 65, trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905),
                 fecha_nacimiento = "1960-09-10", ganancias = vh_r(250000, 100000, "2025-06-01"))),
    list(list(id = "d1", rol = "declarante", edad = 65, trabajo = list(dinerarias = 30000, cotizacionesSs = 1905),
              fechaNacimiento = "1960-09-10", ganancias = vh_js(250000, 100000, "2025-06-01"))))
# M-b: pareja biparental (auto => compara individual y conjunta), D1 66 años y D2 63, 60.000 € cada uno
```

### 5.6 Casos límite

- **¿«Mayores de 65» incluye el día en que se cumplen 65?** La práctica administrativa
  (Manual AEAT, DGT) aplica la exención con 65 cumplidos. El parámetro `edad: 65` con `≥`
  sigue esa práctica; verificar y documentar.
- **Nuda propiedad**: si el mayor de 65 vende la nuda propiedad y se reserva el usufructo, la
  doctrina de la DGT ha sido cambiante: no automatizar; aviso.
- **Garaje y trastero** anejos vendidos con la vivienda: forman parte de la vivienda habitual
  si se transmiten conjuntamente (hasta dos plazas); separado, no.
- **Dependencia** sin edad: misma exención; requiere resolución de dependencia (dato del
  usuario).
- **Pérdida**: no hay nada que eximir; ¿se computa la pérdida? Al tratarse de una exención,
  la pérdida en la venta de la vivienda habitual de un mayor de 65 **no** debería
  integrarse (la ganancia/pérdida está exenta). Confirmar con el Manual; propuesta:
  `provisional`, no computar la pérdida.
- Si aplica esta exención no se evalúa la de reinversión (es total).

---

## 6. Regla 5 — Exención de la indemnización por despido

### 6.1 Norma (resumen)

- **Art. 7.e LIRPF.** Exentas las indemnizaciones por despido o cese del trabajador **en la
  cuantía establecida con carácter obligatorio** en el Estatuto de los Trabajadores (o en
  la normativa de ejecución de sentencias), sin que pueda considerarse como tal la fijada
  por convenio, pacto o contrato. En despidos colectivos (art. 51 ET) o por causas
  objetivas del art. 52.c ET, está exenta la parte que no supere los límites obligatorios del
  **despido improcedente**. El importe exento tiene un **límite de 180.000 €**.
  Desde 2012, el despido improcedente exige para la exención el reconocimiento en el acto de
  conciliación (SMAC) o por resolución judicial (verificar el texto vigente).
- **Art. 73 RIRPF**: la exención exige la efectiva desvinculación (se presume que no la hay
  si el trabajador vuelve a la misma empresa o a una vinculada en los tres años siguientes).
  No modelado (aviso).
- **Art. 56.1 ET**: despido improcedente, **33 días** de salario por año de servicio,
  prorrateando por meses los periodos inferiores a un año, hasta **24 mensualidades**.
- **DT 11.ª ET**: contratos anteriores al 12-02-2012: **45 días** por año por el tiempo
  anterior a esa fecha y 33 por el posterior; tope de **720 días**, salvo que lo devengado
  antes del 12-02-2012 ya los supere: entonces ese importe, con un máximo de **42
  mensualidades**.
- **Art. 53.1.b ET**: despido objetivo, **20 días** por año, hasta **12 mensualidades** (es
  el mínimo que paga la empresa; la exención llega hasta el importe del improcedente).
- **Art. 18.2 LIRPF**: la parte no exenta es rendimiento del trabajo; si su periodo de
  generación supera dos años (antigüedad > 2 años), reducción del **30 %** sobre un máximo
  de **300.000 €**, minorado para rendimientos derivados de la extinción entre 700.000 y
  1.000.000 € (`300.000 − (rendimiento − 700.000)`; 0 por encima de 1.000.000). La
  limitación de no haber aplicado la reducción en los cinco años anteriores no alcanza a
  los rendimientos derivados de la extinción de la relación laboral (verificar).

### 6.2 Parámetros

```yaml
indemnizacion_despido:
  norma: "Art. 7.e LIRPF; art. 73 RIRPF; arts. 51, 52.c, 53.1.b y 56.1 y DT 11.ª ET"
  fuente: "BOE-A-2006-20764 (art. 7.e), https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764; BOE-A-2015-11430 (ET), https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430"
  estado: pendiente
  limite_exento: 180000
  improcedente: { dias_por_anio: 33, tope_dias: 720 }            # art. 56.1 ET: 24 mensualidades = 720 días (ver casos límite)
  improcedente_dt11: { fecha_corte: "2012-02-12", dias_por_anio_antes: 45, tope_dias_antes: 1260 }  # 42 mensualidades
  objetivo: { dias_por_anio: 20, tope_dias: 360 }                # art. 53.1.b ET: 12 mensualidades
  dias_salario_anual: 365        # salario diario = salario anual / 365 (criterio jurisprudencial; verificar)
  exige_conciliacion_improcedente: true
```

Y en `trabajo_reduccion_irregular` (ya existe), sub-bloque nuevo para la extinción:

```yaml
  extincion_relacion_laboral:
    norma: "Art. 18.2 LIRPF, párrafos sobre rendimientos derivados de la extinción"
    fuente: "BOE-A-2006-20764 (art. 18.2)"
    estado: pendiente
    umbral_minoracion: 700000
    umbral_cero: 1000000
```

### 6.3 Entradas nuevas

En `pe.trabajo`:

```js
indemnizacionDespido: {
  importe,              // total cobrado por el despido
  causa,                // "improcedente" | "objetivo_52c" | "colectivo" | "otra_obligatoria" | "pactada"
  reconocida,           // true si hay conciliación SMAC o resolución judicial (improcedente)
  fechaInicio,          // inicio de la relación laboral (antigüedad reconocida)
  fechaDespido,         // último día de servicio
  salarioAnual,         // salario regulador anual (bruto, con prorrata de pagas)
  importeObligatorio    // opcional: si viene, manda sobre el cálculo
}
```

R: `trabajo = list(..., indemnizacion_despido = list(importe, causa, reconocida, fecha_inicio,
fecha_despido, salario_anual, importe_obligatorio))`.

El `importe` **no** se incluye en `dinerarias`: el motor suma la parte no exenta.

### 6.4 Algoritmo (en `rn_trabajo_previo`, régimen común)

1. Si no hay `indemnizacion_despido` o `importe ≤ 0` → nada.
2. Si `causa == "pactada"` → `obligatorio = 0`.
3. Si `causa == "improcedente"` y `exige_conciliacion_improcedente` y no `reconocida` →
   `obligatorio = 0` (aviso).
4. Si viene `importe_obligatorio` → usarlo. Si no, calcular el del **improcedente** (también
   para `objetivo_52c` y `colectivo`, porque la exención llega hasta ese límite):
   1. `sd = salario_anual / dias_salario_anual`.
   2. Si `fecha_inicio < fecha_corte` (DT 11.ª):
      - `m1 = meses_iniciados(fecha_inicio, fecha_corte − 1 día)`; `d1 = 45 × m1 / 12`;
      - `m2 = meses_iniciados(fecha_corte, fecha_despido)`; `d2 = 33 × m2 / 12`;
      - si `d1 > 720`: `dias = min(d1, 1260)`; si no: `dias = min(d1 + d2, 720)`.
   3. Si no: `m = meses_iniciados(fecha_inicio, fecha_despido)`; `dias = min(33 × m / 12, 720)`.
   4. `obligatorio = dias * sd`.
   (Orden: `dias_por_anio * meses / 12` primero, después el tope, después `* sd`.)
5. `exenta = min(importe, obligatorio, limite_exento)`; `no_exenta = importe − exenta`.
6. Sumar `no_exenta` al íntegro del trabajo. Si la antigüedad (`meses_iniciados(fecha_inicio,
   fecha_despido)`) > 24 meses, tratar `no_exenta` como rendimiento irregular: reducción del
   30 % sobre `min(no_exenta, base_max)` con `base_max = 300.000` minorado según § 6.1 si
   `no_exenta > 700.000`. La reducción se suma a la que ya pueda haber por
   `rendimiento_irregular` con el tope global de 300.000 € (art. 18.2: el límite es por
   período; si hay las dos, la base conjunta no supera 300.000).
7. Salida: `componentes_renta$indemnizacion_exenta` y `indemnizacion_no_exenta`.

El íntegro del trabajo con la parte no exenta también cuenta para el art. 20, los otros
gastos del art. 19.2.f, la DA 61.ª y la obligación de declarar (sale solo, porque sube
`integro`). La parte exenta no cuenta en ninguno.

### 6.5 Casos de prueba (a mano)

Salarios elegidos para que el salario diario sea redondo (365 días).

**Caso D-a — Improcedente, contrato posterior a 2012.** Inicio 2015-03-01; despido
2025-02-28; salario anual 36.500 (diario 100); cobra 40.000 € reconocidos en el SMAC.

| Paso | Cálculo | Importe |
|---|---|---|
| Meses | 2015-03-01 → 2025-03-01 (día siguiente al despido) = 120, sin resto | 120 |
| Días | 33 × 120 / 12 = 330 (< 720) | 330 |
| Obligatorio | 330 × 100 | 33.000,00 |
| Exenta | min(40.000; 33.000; 180.000) | 33.000,00 |
| No exenta | 40.000 − 33.000 | 7.000,00 |
| Reducción art. 18.2 (antigüedad > 2 años) | 7.000 × 30 % | −2.100,00 |
| **Se suma al íntegro del trabajo** | | **4.900,00** |

**Caso D-b — Improcedente, contrato anterior al 12-02-2012.** Inicio 2000-02-12; despido
2025-02-11; salario anual 73.000 (diario 200); cobra 150.000 €.

| Paso | Cálculo | Importe |
|---|---|---|
| Meses antes del corte | 2000-02-12 → 2012-02-12 = 144 | 144 |
| Días antes | 45 × 144 / 12 | 540 |
| Meses después | 2012-02-12 → 2025-02-12 = 156 | 156 |
| Días después | 33 × 156 / 12 | 429 |
| Días computables | 540 ≤ 720 ⇒ min(540 + 429, 720) | 720 |
| Obligatorio | 720 × 200 | 144.000,00 |
| Exenta | min(150.000; 144.000; 180.000) | 144.000,00 |
| No exenta / reducida (× 70 %) | 6.000 → 4.200 | **4.200,00** |

**Caso D-c — Tope de 180.000 €.** Mismas fechas que D-b, salario anual 146.000 (diario 400),
cobra 300.000 €: obligatorio 720 × 400 = 288.000; exenta min(300.000; 288.000; 180.000) =
**180.000**; no exenta 120.000; reducida 120.000 × 70 % = **84.000,00**.

**Caso D-d — Objetivo (art. 52.c).** Como D-a pero `causa = "objetivo_52c"` y cobra 30.000 €
(más de los 20 días legales, 20 × 10 × 100 = 20.000): límite = improcedente 33.000 → exenta
**30.000**, no exenta 0.

**Caso D-e — Pactada** (baja incentivada): exenta 0, los 40.000 € al trabajo, con la
reducción del 30 % si la antigüedad > 2 años → 28.000.

Hogar del validador: soltero de Madrid, 50 años, `dinerarias` = salario cobrado en el año
(p. ej. 6.000 € de enero-febrero) y `cotizaciones_ss` = 381; añadir la indemnización.

```r
# Regla 5: despido (docs/08 § 6.5)
desp <- list(
  despido_improcedente  = list(importe = 40000,  causa = "improcedente", reconocida = TRUE, fi = "2015-03-01", fd = "2025-02-28", s = 36500),
  despido_dt11          = list(importe = 150000, causa = "improcedente", reconocida = TRUE, fi = "2000-02-12", fd = "2025-02-11", s = 73000),
  despido_tope_180000   = list(importe = 300000, causa = "improcedente", reconocida = TRUE, fi = "2000-02-12", fd = "2025-02-11", s = 146000),
  despido_objetivo      = list(importe = 30000,  causa = "objetivo_52c", reconocida = FALSE, fi = "2015-03-01", fd = "2025-02-28", s = 36500))
for (k in names(desp)) { x <- desp[[k]]
  add(k, "ES-MD", "ninguna", "no",
      list(persona("d1", "declarante", 50, trabajo = list(dinerarias = 6000, cotizaciones_ss = 381,
        indemnizacion_despido = list(importe = x$importe, causa = x$causa, reconocida = x$reconocida,
          fecha_inicio = x$fi, fecha_despido = x$fd, salario_anual = x$s)))),
      list(list(id = "d1", rol = "declarante", edad = 50, trabajo = list(dinerarias = 6000, cotizacionesSs = 381,
        indemnizacionDespido = list(importe = x$importe, causa = x$causa, reconocida = x$reconocida,
          fechaInicio = x$fi, fechaDespido = x$fd, salarioAnual = x$s))))) }
```

### 6.6 Casos límite

- **«24 mensualidades» en días**: el motor usa 720 días de salario (30 por mensualidad) y
  salario diario = anual / 365. Hay sentencias que calculan la mensualidad como anual / 12
  (24 mensualidades = 2 × anual, algo más que 720 × anual / 365). Dejar `provisional` y
  admitir `importeObligatorio` para el importe de la carta o de la sentencia.
- **Fracciones de mes**: cualquier fracción cuenta como mes completo (criterio del Tribunal
  Supremo para «prorrateándose por meses»; verificar).
- **Despido el mismo día del corte** (inicio y fin alrededor del 12-02-2012): el tramo de 45
  días llega hasta el 11-02-2012 incluido.
- **Antigüedad reconocida** distinta de la real (subrogaciones): manda `fechaInicio` tal
  como la reconoce la empresa o la sentencia.
- **Indemnización pagada en varios años**: la exención es por despido, no por año; el motor
  solo ve el ejercicio y no reparte (aviso). El cobro fraccionado afecta además al
  carácter irregular (art. 18.2: el cociente entre generación y número de periodos de
  fraccionamiento debe superar dos).
- **Salarios de tramitación**: son rendimiento del trabajo sin exención; van en `dinerarias`.
- **Readmisión en 3 años** (art. 73 RIRPF): se pierde la exención; complementaria (fuera).
- **ERE con indemnización mayor que la del improcedente**: exenta solo hasta el improcedente
  y 180.000; el exceso tributa.
- **Altos directivos** (RD 1382/1985): la indemnización obligatoria es de 7 días por año
  con 6 mensualidades (doctrina reciente del TS sobre la exención: verificar). Fuera en la
  primera fase (`causa = "otra_obligatoria"` + `importeObligatorio`).
- **Forales**: el País Vasco y Navarra tienen la misma lógica con matices: fuera.

---

## 7. Regla 6 — Deducción por doble imposición internacional (dividendos)

### 7.1 Norma (resumen)

- **Art. 80.1 LIRPF.** Cuando entre las rentas del contribuyente haya rendimientos o
  ganancias obtenidos y gravados en el extranjero, se deduce la **menor** de:
  a) el **importe efectivo satisfecho en el extranjero** por un impuesto de naturaleza
     idéntica o análoga al IRPF o al IRNR sobre esas rentas;
  b) el resultado de aplicar el **tipo medio efectivo de gravamen** a la parte de base
     liquidable gravada en el extranjero.
- **Art. 80.2 LIRPF.** Tipo medio efectivo: cociente entre la cuota líquida total y la base
  liquidable, multiplicado por 100, **distinguiendo** el tipo de las rentas generales y el
  de las del ahorro; se expresa con **dos decimales**.
- **Art. 79 LIRPF.** La deducción minora la cuota líquida total, que no puede ser negativa
  (la deducción no puede superarla). La DA 61.ª se aplica después (`R/05_pipeline_comun.R`
  ya lo anticipa en un comentario).
- **Convenios para evitar la doble imposición**: el país de la fuente puede retener el
  dividendo como mucho al tipo del convenio (en la mayoría, 15 %). Lo retenido de más no es
  impuesto «satisfecho» deducible: se recupera en ese país. Por eso el importe del apartado
  a) se limita a `bruto × tipo_convenio` cuando hay convenio.

### 7.2 Parámetros

```yaml
deduccion_doble_imposicion_internacional:
  norma: "Arts. 79 y 80 LIRPF"
  fuente: "BOE-A-2006-20764 (arts. 79 y 80), https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764"
  estado: pendiente              # el bloque actual está «confirmado» sin fuente y sin cifras
  metodo: "menor de (impuesto extranjero, tipo medio efectivo * renta extranjera gravada fuera)"
  decimales_tipo_medio: 2        # art. 80.2: «se expresará con dos decimales» (en porcentaje)
  reparto_cuota_liquida: "proporcional_cuotas_integras"   # decisión del motor: ver § 7.4 paso 2
  tipo_convenio_defecto: 0.15    # solo de ayuda para la interfaz; cada dividendo lleva el suyo
```

Los tipos de cada convenio no van en `params/` en esta fase: los informa el usuario
(`tipoConvenio`). Si más adelante se quiere una tabla por país, cada fila con su BOE del
convenio.

### 7.3 Entradas nuevas

En `pe.capitalMobiliario`:

```js
dividendosExtranjeros: [
  { importeBruto, gastos, impuestoPagado, tipoConvenio /* null si no hay convenio */ }
]
```

R: `capital_mobiliario = list(..., dividendos_extranjeros = list(list(importe_bruto,
gastos, impuesto_pagado, tipo_convenio)))`.

`importeBruto − gastos` se suma a la base del ahorro (como `dividendos`; **no** repetir el
importe en `dividendos`).

### 7.4 Algoritmo (régimen común, en `liquidar_comun_scope` / `liquidarComunScope`)

1. En `rn_capital_mobiliario`: `ahorro += Σ (importe_bruto − gastos)`; guardar
   `renta_extranjera_ahorro = Σ (importe_bruto − gastos)` por persona y sumarla en el ámbito.
2. Tras la cuota líquida total (después de la bonificación de Ceuta/Melilla y antes de la
   DA 61.ª):
   - `CI_g = cig_est + cig_aut`, `CI_a = cia_est + cia_aut`, `CI = CI_g + CI_a`.
   - Cuota líquida del ahorro: `CL_a = CL × CI_a / CI` (si `CI > 0`; si no, 0). **Decisión del
     motor** (`provisional`): las deducciones de la cuota se reparten entre la parte general
     y la del ahorro en proporción a las cuotas íntegras; verificar con el Manual de la AEAT
     o con Renta Web.
   - `tme_a = round(100 × CL_a / BLA, 2) / 100` (si `BLA > 0`; si no, 0). En R,
     `round(x, 2)` redondea a par en el ,5 exacto y `Math.round` en JS redondea hacia
     arriba: usar en los dos el mismo `red2` del motor (`round(x + 1e-9, 2)` /
     equivalente JS) para que coincidan.
   - `base_ext = min(renta_extranjera_ahorro, BLA)` (la parte de la base liquidable gravada
     fuera no puede superar la base liquidable).
   - `limite = tme_a × base_ext`.
   - `pagado = Σ min(impuesto_pagado, tipo_convenio != null ? importe_bruto × tipo_convenio : Inf)`.
   - `ddi = min(pagado, limite, CL)`.
3. `CL' = CL − ddi`; la DA 61.ª se calcula con su tope sobre `CL'`; la cuota resultante es
   `CL' − DA61`.
4. Reparto entre la parte estatal y la autonómica de la cuota líquida (para las casillas):
   en proporción a `cl_est` y `cl_aut` (decisión `provisional`; el modelo 100 resta la
   deducción de la cuota líquida total, así que el reparto solo afecta a la presentación).
5. Salida: `deduccion_doble_imposicion = list(total, tipo_medio_ahorro, limite, pagado)`.

Rentas generales gravadas fuera (alquileres o trabajo en el extranjero) usarían `tme_g` con
la misma lógica: segunda fase.

### 7.5 Casos de prueba (a mano)

Castilla-La Mancha (`ES-CM`), 2025, soltero de 40 años, trabajo 30.000 € / 1.905 €. Su
escala autonómica coincide con la estatal hasta 60.000 € (params/2025/autonomico.yaml), sin
deducciones autonómicas aplicables (sin hijos ni otros requisitos) y sin DA 61.ª
(íntegros 30.000 > 18.276).

Base liquidable general 26.095; cuota íntegra general 2.469,75 × 2 = 4.939,50 (estatal y
autonómica iguales: 2.997,00 − 527,25).

**Caso DI-a — EE. UU., convenio al 15 %, retenido el 15 %.** Dividendo bruto 2.000; pagado
fuera 300.

| Paso | Cálculo | Importe |
|---|---|---|
| Base liquidable del ahorro | 2.000 | 2.000,00 |
| Cuota íntegra del ahorro | 2.000 × 9,5 % × 2 | 380,00 |
| Cuota líquida total | 4.939,50 + 380 (sin deducciones) | 5.319,50 |
| Cuota líquida del ahorro | 5.319,50 × 380 / 5.319,50 | 380,00 |
| Tipo medio efectivo del ahorro | 380 / 2.000 = 19,00 % | 0,19 |
| Límite b) | 19 % × 2.000 | 380,00 |
| Pagado admisible a) | min(300; 2.000 × 15 %) | 300,00 |
| **Deducción** | min(300; 380) | **300,00** |
| Cuota resultante | 5.319,50 − 300 | **5.019,50** |

**Caso DI-b — Retenido el 25 % con convenio al 15 %** (p. ej. un país que retiene de más y
permite reclamar). Pagado 500; admisible min(500; 300) = 300; deducción **300,00**; cuota
resultante 5.019,50. Los 200 € de exceso se reclaman en el país de origen.

**Caso DI-c — Sin convenio, retenido el 30 %.** Pagado 600; admisible 600; límite 380;
deducción **380,00** (el tipo medio manda); cuota resultante 4.939,50.

**Caso DI-d — Tipo medio, no marginal.** Además, 8.000 € de dividendos españoles
(`dividendos`): base del ahorro 10.000; cuota íntegra del ahorro (6.000 × 9,5 % + 4.000 ×
10,5 %) × 2 = (570 + 420) × 2 = 1.980; tipo medio 1.980 / 10.000 = 19,80 %; límite 19,80 %
× 2.000 = 396; con el pago del caso DI-c (600, sin convenio) la deducción es **396,00**
(con el marginal del 21 % saldría 420: el art. 80 manda el medio).

```r
# Regla 6: doble imposición internacional (docs/08 § 7.5)
di <- list(di_convenio_15 = list(p = 300, tc = 0.15, nac = 0), di_retencion_exceso = list(p = 500, tc = 0.15, nac = 0),
           di_sin_convenio = list(p = 600, tc = NULL, nac = 0), di_tipo_medio = list(p = 600, tc = NULL, nac = 8000))
for (k in names(di)) { x <- di[[k]]
  ext_r  <- list(c(list(importe_bruto = 2000, gastos = 0, impuesto_pagado = x$p), if (!is.null(x$tc)) list(tipo_convenio = x$tc)))
  ext_js <- list(c(list(importeBruto = 2000, gastos = 0, impuestoPagado = x$p), if (!is.null(x$tc)) list(tipoConvenio = x$tc)))
  add(k, "ES-CM", "ninguna", "no",
      list(persona("d1", "declarante", 40, trabajo = list(dinerarias = 30000, cotizaciones_ss = 1905),
        capital_mobiliario = list(dividendos = x$nac, dividendos_extranjeros = ext_r))),
      list(list(id = "d1", rol = "declarante", edad = 40, trabajo = list(dinerarias = 30000, cotizacionesSs = 1905),
        capitalMobiliario = list(dividendos = x$nac, dividendosExtranjeros = ext_js)))) }
```

Si el validador da otra cuota líquida en CLM, comprobar antes que ninguna deducción
autonómica de Castilla-La Mancha se aplique a este hogar.

### 7.6 Casos límite

- **Deducciones autonómicas o estatales** en la cuota: reducen `CL` y, por el reparto
  proporcional, el tipo medio del ahorro. Caso de test recomendado: el mismo DI-c en Madrid
  con alquiler joven (deducción autonómica) para fijar el reparto.
- **Pérdidas compensadas o reducciones** que bajan la base liquidable del ahorro por debajo
  de la renta extranjera: `base_ext = min(renta, BLA)`.
- **BLA = 0** (p. ej. el mínimo se come la base del ahorro): tipo medio 0, deducción 0.
- **Mínimo personal aplicado en la base del ahorro**: baja la cuota íntegra del ahorro y con
  ella el tipo medio; sale solo del cálculo.
- **Varios países**: la norma del IRPF no exige el cálculo país a país (a diferencia del IS);
  el motor agrega. Verificar con el Manual (si exige límite por país, cambiar el paso 2 a
  una suma de mínimos por país).
- **Tributación conjunta**: se suman las rentas extranjeras y los pagos de todos los
  miembros; un único tipo medio del ahorro.
- **Fondos y ETF extranjeros** con retención en origen: misma lógica si tributan como
  dividendo (rendimiento de capital mobiliario).
- **Retenciones españolas** sobre el dividendo extranjero (las practica el depositario
  español): son retenciones normales (`retenciones`), no esta deducción.
- **Forales**: el País Vasco (con su exención de 1.500 € en dividendos) y Navarra tienen su
  propio artículo: fuera.
- **Ceuta y Melilla**: la bonificación del 60 % reduce `CL` antes de la deducción y, con
  ella, el tipo medio (se aplica en el orden de § 7.4 paso 2).

---

## 8. Fuera de alcance y siguientes pasos

- **Forales** (País Vasco: Normas Forales del IRPF de cada territorio; Navarra: DFL 4/2008):
  las seis reglas tienen equivalente con cifras y matices propios (coeficientes de
  actualización, reinversión, exención de dividendos…). Si `regimen != "comun"`, los campos
  nuevos se ignoran con un aviso hasta que se especifiquen.
- **Art. 38.3 LIRPF** (renta vitalicia de mayores de 65), **art. 38.2** (reinversión en
  entidades de nueva o reciente creación), compensación del exceso de gastos financieros
  en cuatro años, doble imposición de rentas generales.

### Orden de trabajo propuesto para la sesión con R

1. Abrir el BOE consolidado de cada artículo citado y fijar `estado` de cada parámetro.
2. Utilidades de fechas (§ 1.2) con tests propios en R y en Node.
3. Reglas 3 y 4 (imputación y amortización), luego 1 y 2 (ganancias), luego 5 y 6.
4. Para cada regla: YAML (2025 y 2026, o 2026 heredando), `Rscript tools/exportar_params.R`,
   motor R + test en `tests/testthat/`, el mismo cambio en `web/js/irpfsim.js`, el caso de
   docs/03 (copiar las tablas de este documento), el caso en `tools/validar_js.R`,
   `Rscript tools/montar_validador.R` y `node tools/validar_js_node.js` («VALIDADOR OK»),
   `npm test`.
5. Si cambia algo que llega a las páginas SEO (no debería: son entradas opcionales), regenerar
   `tools/generar_datos_seo.R` y `tools/generar_paginas_seo.mjs`.
6. Actualizar `docs/02_cobertura.md` (quitar «doble imposición internacional» de fuera de
   alcance cuando esté la de dividendos) y el formulario (`web/js/formulario.js`,
   `web/js/esquema.js`) con los campos nuevos.
