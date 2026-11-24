# Identidad visual: paleta y recursos de la M

Guía corta para quien toque `web/css/`. La web evoluciona poco a poco hacia el logo (la M
geométrica: dos patas cobalto `#1f3fc4` y una diagonal amarilla `#ffd23f`), sin saturar.
Los valores viven como tokens en `:root` de `web/css/mapafiscal.css` (con su versión oscura
y la de impresión): usa siempre los tokens, nunca colores sueltos.

## Paleta

| Papel | Tokens | Regla |
|---|---|---|
| Neutros | `--fondo --superficie --superficie-2 --linea --linea-2 --tinta --tinta-2 --tinta-3` | Gris con matiz frío del logo (tono ≈ 220°), no verdoso. |
| Marca | `--marca` (acciones, enlaces, foco) y tintes `--marca-50/100/200/300/700/900` | El azul macizo solo en botones, enlaces y detalles; superficies con `--marca-50`/`-100`. |
| Resalte | `--resalte`, `--resalte-suave` | El amarillo es un acento pequeño: lo «tuyo», marcadores, la diagonal. Nunca fondo grande ni texto amarillo. |
| Semántica | `--gana --pierde --aviso` (+ `-suave`) | Menos saturados que un semáforo; AA sobre `--superficie`, `--superficie-2` y su `-suave`. |
| Gráficos | `--g-*` | Una sola familia: tintes de marca (`--g-estado` = `--marca-900`, `--g-autonomia` = `--marca-300`). |
| Mapa | `--m-g3…--m-r3`, `--m-tu` | Rampa salvia ↔ teja, apagada porque ocupa mucha superficie; el tuyo, amarillo de marca. |

## Recursos de la M (2-4 por pantalla como mucho)

1. **La diagonal**: paralelogramo amarillo inclinado («/», `--diagonal-inclinacion`) de
   ~11×9 px. Clase `.diagonal-m` (en `::before`). Ya en `.antetitulo`, el rótulo
   «Resultado», el chip «Te puede interesar» y «En resumen» de las páginas SEO.
2. **La cinta M**: filete superior de 4 px, azul con un tramo amarillo en diagonal (pata,
   trazo, pata). Clase `.cinta-m` (usa `::after`; color con `--cinta-color`). En el
   separador de cabecera SEO (`.actualizado`) va en versión corta.
3. **El corte M**: esquina superior derecha cortada en ángulo (`--corte`, 18 px), con
   `clip-path`. Clase `.corte-m`. Solo en tarjetas destacadas, no en todas.

## Zonas con diseño propio

- **Resultado de las herramientas** (`.tarjeta-resultado`): cinta M (verde/teja si sale a
  devolver/pagar), corte M y diagonal junto al rótulo.
- **Mini-calculadora de la portada** (`.minicalc`): ya no es tarjeta; ver «Páginas insignia».
- **Cabecera de las páginas editoriales** (`/irpf/…`, guías, vivienda, comparativas):
  separador con cinta M y el bloque «En resumen» con tinte `--marca-50`, filete izquierdo
  azul rematado en amarillo, diagonal y corte M.

## Páginas insignia (personalidad propia)

La portada se reconoce como Mapafiscal sin ver el logo. Usa estos recursos; no los lleves a otras páginas sin pensarlo (si todo es insignia, nada lo es):

4. **La mancheta**: línea de publicación en mono y mayúsculas (`.portada-mancheta`), entre un filete de tinta de 3 px (con la cinta M encima, al principio)
   y un filete fino. Datos ciertos de la página, separados por «/».
5. **La lámina M**: superficie en `--marca-50` con el borde izquierdo inclinado como una pata
   de la M (`--pata`), la pata azul a lo largo de ese borde, el trazo amarillo saliendo de su
   pie (`--trazo`) y el corte M arriba a la derecha. Se dibuja con `::before` (fondo) y
   `::after` (pata y trazo, un solo `clip-path` con degradado duro azul → amarillo), así el
   contenido no se recorta (tooltips del mapa). Solo para mapas: `.portada-mapa`.
6. **La cifra grande**: número en Archivo al 125 % de ancho (la cifra de la mini-calculadora
   de la portada). Con mesura: la prueba de cifras gigantes en las páginas de territorio se
   descartó por tapar el contenido.

- **Portada** (`web/index.html`, `#v-inicio`): mancheta; el titular de siempre («El mismo sueldo, 19 IRPF
  distintos» con su subrayado amarillo: Alex prefirió mantenerlo); el mapa en la lámina M a la
  derecha; la mini-calculadora como franja a lo ancho entre filetes (campos | cifra | regla
  y frase), sin caja; el dato de la diferencia como cita con filete azul.
- **Páginas de territorio** (`/irpf/<territorio>/`): se probó una «portada de revista» (nombre
  gigante, mapa en la lámina M, cifra titular y secciones numeradas) y Alex la descartó el
  24-11: demasiado grande y con demasiadas cifras, tapaba lo que la gente viene a consultar.
  Se quedan con el formato sobrio.

## Más zonas con los recursos de la M (segunda tanda)

- **Comparador** (`#comparar`): la tarjeta «Tu territorio» (`.comp-resumen > div.tu`) es blanca
  como las demás, con la cinta M arriba, la diagonal junto al rótulo y filete `--marca-200`. La
  leyenda del mapa (`.tarjeta-mapa .leyenda`) es el pie de la tarjeta: filete con la cinta M corta
  al principio y la rampa y la muestra de «tu territorio» inclinadas como el trazo de la M (solo en
  `#comparar`; la portada tiene la suya).
- **Fichas de deducción** (`/irpf/<t>/deducciones/<slug>/`, `.ficha-req`): cada supuesto es una fila
  con la cifra clave (`.supuesto-cifra`: rótulo «Supuesto n» en mono y el importe en Archivo, con la
  pata azul rematada en amarillo) y, al lado en escritorio, los requisitos como lista numerada
  (`.lista-req`: 01, 02… en mono entre filetes). En los ejemplos (`.ficha-ejemplo`) la cifra del
  motor va subrayada con el trazo amarillo.
- **Vivienda y rescate** (`guias.css`): las cuatro situaciones de `/vivienda/` numeradas
  (`.viv-paso .viv-num`), el dato del motor (`.dato-motor`) separado con la cinta M corta y sus
  cifras subrayadas; las condiciones (reinversión, datos necesarios) y las reglas del rescate como
  `.lista-req`; en las tablas del rescate, la forma que menos tributa con la diagonal
  (`td.mejor-forma`) y las cifras de la entradilla subrayadas (`.entradilla-cifras`).
- **Informe PDF** (`web/js/informe.js`, `.inf-*`): portada con la M del logo (mismos polígonos que
  `favicon.svg`), «MAPAFISCAL» en cobalto, titular en Archivo y la cinta M bajo la cabecera (un
  tercio del ancho; `print-color-adjust: exact`). La cifra principal lleva la pata azul con remate
  amarillo. En blanco y negro: cinta oscuro-claro-oscuro y la diagonal del logo con filete fino al
  imprimir.

## Avisos, errores y estados vacíos

- **Avisos** (`.avisos-form`, `.aviso-demo`, «Lo que la calculadora todavía no hace» de vivienda
  `.nota-limite`): tinte `--aviso-suave`, filete izquierdo de 3 px (la pata) y, delante del título,
  la diagonal rellena de `--aviso`. Sin caja con borde completo.
- **Errores de campo** (`input[aria-invalid]`, `.error-importe`, `.mensaje.error`): color `--pierde`
  (nunca rojos sueltos) y una diagonal pequeña de su mismo color delante del texto.
- **Vacíos en línea** (`.vacio`): la diagonal solo con contorno `--linea-2` (sin amarillo: no hay nada
  tuyo que señalar). **Estado vacío de una vista** (`.estado-vacio`): la cinta M corta y centrada
  encima del titular.

El resto sigue el patrón sobrio de tarjeta/filete. Respeta `prefers-reduced-motion` y los
huecos de anuncios; no añadas iconos genéricos (los propios están en `ICONOS` de `web/js/ui.js`).

