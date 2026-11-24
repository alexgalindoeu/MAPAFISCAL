# Mapafiscal: informe de estado (24-11-2026)

Web: https://mapafiscal.es. Calculadora gratuita del IRPF español para los 19 territorios fiscales: las 15 comunidades de régimen común y los forales de Bizkaia, Gipuzkoa, Álava y Navarra. Cubre la renta de 2025 y una simulación de 2026.

## Arquitectura y fiabilidad

- **Dos motores:**
  - motor de referencia en R (`R/`);
  - port en JavaScript (`web/js/irpfsim.js`), que es el que usa la web.
- **Paridad comprobada al céntimo:** 172 casos (132 de 2025 y 40 de 2026), más 3 ejemplos oficiales de los manuales. Se publica en /validacion/.
- **Parámetros:** toda la normativa está en `params/<año>/*.yaml`. Cada valor lleva `norma`, `fuente` y `estado` (`confirmado`, `provisional` o `pendiente`).
- **Regla absoluta:** solo fuentes oficiales (BOE, boletines autonómicos y forales, AEAT y Haciendas forales). Nada de despachos, editoriales jurídicas, blogs ni prensa, ni como contraste. Si algo no se verifica con fuente oficial, se marca `pendiente`.
- **CI:**
  - tests de Node y de R;
  - paridad R ↔ JS;
  - pruebas en navegador con Playwright y axe, en claro, oscuro y móvil;
  - comprobación de que las páginas generadas están al día.

## Publicado hoy y ayer

- **Diseño:**
  - identidad visual sacada del logo (la M azul y amarilla), con detalles comedidos;
  - portada nueva: franja de cabecera, mapa sobre una «lámina M» y la calculadora a lo ancho;
  - pie en columnas con los enlaces más buscados;
  - barra principal más limpia: «Mis clientes» solo aparece con el plan Gestor.
- **Herramientas y páginas:**
  - sueldo al mes, comparar ofertas, 2025 frente a 2026, tipo marginal real y ranking;
  - informe PDF gratis con sesión iniciada mientras los pagos estén apagados;
  - páginas «Sobre Mapafiscal» y «Contacto».
- **Textos legales:** adaptados a AdSense, con una tabla de cookies que coincide con lo que guarda la web y un test que lo vigila.
- **Rendimiento:** la mini-calculadora de la portada responde en 2,7 s en lugar de 4,4 s en un móvil emulado.
- **Coherencia de cifras:**
  - el tipo medio se distingue entre «sobre el sueldo bruto» y «sobre la base imponible»;
  - los porcentajes de la norma ya no se redondean;
  - «30,000» se rechaza y la web sugiere 30.000 €.
- **Stripe:** el webhook valida el pago y gestiona los reembolsos. Está en código, sin desplegar.
- **Publicación:** se reintenta sola cuando GitHub Pages falla.
- **Correcciones:**
  - «de el Gobierno de Navarra» pasa a «del»;
  - el aviso legal ya cubre 2025 y 2026.

## En curso: PR #104

Contenido propio en las páginas de plantilla. AdSense rechazó la web por «contenido de poco valor» y el dueño no quiere sacar páginas del índice, así que se enriquecen.

- **Páginas afectadas:**
  - 456 páginas de sueldo neto;
  - 171 de «cuánto me devuelve»;
  - 10 de dos pagadores.
- **Qué añade cada una:**
  - una lectura del dato redactada por reglas;
  - el mismo sueldo con hijos o con cónyuge a cargo;
  - 1.000 € más, calculados con exactitud;
  - comparación con los territorios vecinos;
  - las deducciones autonómicas a las que llega ese sueldo.

## Pendiente: prioridad actual, la fiabilidad

Los agentes se cortaron por el límite de uso y siguen a partir de las 15:00 UTC.

1. **Cobertura honesta:**
   - poner al día `docs/02_cobertura.md`, que es de septiembre, generándolo desde los datos;
   - página pública «Qué calcula y qué no»;
   - avisos en la calculadora cuando el caso del usuario no está cubierto.
2. **Deducciones autonómicas que faltan, por orden de impacto:**
   - Madrid: hay 7 de unas 23;
   - Andalucía;
   - Cataluña: faltan viudedad, violencia de género, préstamos de máster y el tramo del 9 % de vivienda;
   - Comunitat Valenciana: faltan nacimiento múltiple, conciliación, empleada de hogar, primera vivienda de menores de 35 y otras.
3. **Navarra:**
   - deducción por familia numerosa;
   - declaración conjunta foral completa;
   - reducción propia del trabajo (hoy provisional);
   - donativos;
   - 6 parámetros pendientes.
4. **Fuentes forales:**
   - la escala del País Vasco de 2025 cita a la DF de Gipuzkoa también en las páginas de Bizkaia y Álava; hay que citar el BOB, el BOTHA y el BOG de cada territorio;
   - sustituir las fuentes no oficiales que quedan: Iberley, guiafiscal.es y Cuatrecasas, en Navarra, País Vasco y una cita estatal;
   - añadir un test que impida citar fuentes no oficiales.
5. **Real Decreto-ley 38/2026 (SMI e IRPF de 2027):** comprobar en el BOE que existe y apuntarlo para el ejercicio 2027, sin tocar 2026.
6. **No cubierto, y se dirá en la web:**
   - módulos;
   - impatriados;
   - no residentes;
   - Ceuta y Melilla;
   - coeficientes forales de inmuebles;
   - alimentos a hijos en los forales;
   - algunas rentas irregulares.

## Decisiones del dueño

- **SEO:** no se sacan páginas del sitemap, no se ocultan los recuadros de anuncios y no se crean más páginas; se mejoran las que hay.
- **Páginas de territorio:** se quedan con el formato sobrio. La versión «revista», con cifras gigantes, se descartó.
- **Datos personales:** ninguno del titular en la web ni en el código. El contacto es solo contacto@mapafiscal.es.
- **Pagos:** los activa el dueño. La migración de Supabase tiene que ir antes de encender `informePago`.

## Datos de Search Console (14-22 nov, web muy reciente)

- **Totales:** 26 clics y unas 2.300 impresiones.
- **Lo que mejor funciona:** el rescate del plan de pensiones (posición media 7,4) y «cuánto me devuelve» (8,1).
- **Oportunidades cerca del top 6:** «irpf gipuzkoa» (posición 17), «simulador renta 2026 navarra» (9,7), «tablas irpf bizkaia 2025» (9,4) y dos pagadores (6,4, sin clics).
- **Plan:** dejar que madure entre 4 y 6 semanas y revisarlo con datos de 28 días a mediados de diciembre.
