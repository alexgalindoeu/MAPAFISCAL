# Páginas finas: propuesta de sitemap y `noindex`

Esto es una propuesta y **no está aplicado**: el sitemap y el `noindex` los decide el propietario.

## Contexto

Search Console (20-11-2026) da 779 URL, de las que 124 están «Descubiertas, sin indexar» y 19
«Rastreadas, sin indexar». Casi todas son de `/sueldo-neto/` (512 páginas) y de
`/cuanto-me-devuelve/`.

## Medida

Se toma el texto visible de `<main>` (sin cabecera, pie ni scripts), en minúsculas, y se calcula
el Jaccard de 5-gramas de palabras. Para cada página se busca la más parecida de su familia
(«máx.»). Hay dos variantes:

- **literal**: las cifras cuentan;
- **plantilla**: cada cifra se cambia por `#`, así que mide cuánto se parecen las frases.

Una página es casi duplicada si supera el 85 %.

| Familia | Páginas | Literal antes (mediana / máx.) | Literal después (mediana / máx.) | Plantilla >85 % antes | Plantilla >85 % después |
|---|---|---|---|---|---|
| `/sueldo-neto/{importe}/{territorio}/` | 456 | 0,661 / 0,841 | 0,477 / 0,724 | 456 | 345 |
| `/sueldo-neto/{importe}/` | 50 | 0,242 / 0,408 | 0,281 / 0,442 | 50 | 50 |
| `/sueldo-neto/mensual/{m}/` | 6 | 0,191 / 0,196 | 0,182 / 0,189 | 6 | 6 |
| `/cuanto-me-devuelve/{sit}/{territorio}/` | 171 | 0,685 / 0,762 | 0,669 / 0,734 | 10 | 0 |
| `/cuanto-me-devuelve/{sit}/` | 9 | 0,256 / 0,378 | igual | 0 | 0 |

Con la medida literal ninguna página pasaba del 85 %, ni antes ni ahora.

Lo que más se repetía en las páginas por territorio era la tabla de los 19 territorios, idéntica
en las 19 páginas de cada importe. Ahora sale recortada: el primero, los vecinos de puesto, el
propio territorio y el último, con la diferencia en euros. Debajo hay un enlace a la tabla
completa de la página nacional.

Se añadió contenido con cifras del motor:

- el neto del mismo territorio con los sueldos vecinos;
- cuánto sube el neto al pasar al importe siguiente;
- el efecto de cobrar 1.000 € más, según el tipo marginal;
- el tipo marginal frente al tipo medio;
- los territorios que quedan justo por encima y justo por debajo.

En `/cuanto-me-devuelve/` se añadió el puesto entre los territorios con cifra, la distancia al
máximo, al mínimo y a la media, cómo cambia la cifra con el sueldo y, en discapacidad, la del
otro grado.

Con la medida de plantilla las páginas programáticas siguen pareciéndose mucho, porque es la
misma frase con otra cifra. Eso no se arregla con más texto generado: hay que publicar menos
páginas.

## Propuesta

Criterio: una URL va al sitemap si responde a una búsqueda distinta con una cifra propia. Se saca
del sitemap (y se marca `noindex, follow`) si su respuesta es «0 €» o si es un importe intermedio
que otra página ya cubre.

1. **`/cuanto-me-devuelve/{sit}/{territorio}/` con 0 € de rebaja en los tres sueldos (24 URL).**
   La respuesta es «no cambia nada», y la tabla del hub de la situación ya lo dice. Propuesta:
   `noindex, follow` y fuera del sitemap, como ya se hace con las páginas no publicables.
   - Familia numerosa: `andalucia`, `aragon`, `asturias`, `islas-baleares`, `cantabria`,
     `castilla-la-mancha`, `cataluna`, `extremadura`, `galicia`, `madrid`, `la-rioja`,
     `comunidad-valenciana`.
   - Alquiler: `andalucia`, `aragon`, `asturias`, `islas-baleares`, `canarias`, `cantabria`,
     `castilla-la-mancha`, `castilla-y-leon`, `extremadura`, `madrid`, `la-rioja`,
     `comunidad-valenciana`.

   Las rutas son `/cuanto-me-devuelve/familia-numerosa/<slug>/` y `/cuanto-me-devuelve/alquiler/<slug>/`.
   Que salga 0 € puede deberse a que la deducción autonómica aún no está confirmada. Si se
   confirma, la página vuelve a tener cifra y debe volver al sitemap, así que conviene que el
   criterio se calcule en el generador y no se fije a mano.
2. **`/sueldo-neto/{importe}/{territorio}/` de importes intermedios (12 importes × 19 = 228 URL).**
   Es la familia con más páginas casi iguales por plantilla (345 de 456 pasan del 85 %).
   - Se mantiene el detalle por territorio en 15.000, 18.000, 20.000, 22.000, 25.000, 30.000,
     35.000, 40.000, 45.000, 50.000, 60.000 y 100.000.
   - Se sacan del sitemap 16.800, 21.000, 21.600, 24.000, 25.200, 26.000, 28.000, 32.000,
     36.000, 42.000, 70.000 y 80.000. Esos importes siguen cubiertos por su página nacional y
     por `/sueldo-neto/mensual/`.

   El orden propuesto es sacarlas primero del sitemap unas semanas y, si no reciben
   impresiones, pasarlas a `noindex, follow`.
3. **`/sueldo-neto/{importe}/` (50 URL) y `/sueldo-neto/mensual/` (6 URL):** se mantienen.
   Literalmente se parecen poco (máx. 0,44) y cada una responde a su propia búsqueda de importe.
4. **Hubs de `/cuanto-me-devuelve/`:** se mantienen.

Con los puntos 1 y 2, el sitemap pasaría de 780 a unas 528 URL.

## Cómo repetir la medida

El script no está en el repo. Lee `web/**/index.html`, extrae `<main>`, quita las etiquetas y
calcula por familia el Jaccard de 5-gramas de palabras. Para la variante «plantilla» cambia
antes las cifras (`[0-9][0-9.,]*`) por `#`.
