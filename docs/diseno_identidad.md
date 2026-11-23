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
- **Mini-calculadora de la portada** (`.minicalc`): cinta M y corte M.
- **Cabecera de las páginas editoriales** (`/irpf/…`, guías, vivienda, comparativas):
  separador con cinta M y el bloque «En resumen» con tinte `--marca-50`, filete izquierdo
  azul rematado en amarillo, diagonal y corte M.

El resto sigue el patrón sobrio de tarjeta/filete. Respeta `prefers-reduced-motion` y los
huecos de anuncios; no añadas iconos genéricos (los propios están en `ICONOS` de `web/js/ui.js`).

Pendiente: la tarjeta «Tu territorio» del comparador (`.comp-resumen > div.tu`) aún usa
`--resalte-suave` como fondo de tarjeta entera; candidata a pasar a la diagonal.
