# Mapafiscal

Calculadora y microsimulador del **IRPF 2025** para los **19 territorios fiscales de España**: las 15 comunidades de régimen común, los tres territorios forales vascos (Araba/Álava, Bizkaia y Gipuzkoa) y Navarra.

Liquida la declaración completa de un hogar siguiendo el orden del modelo 100: rendimientos, integración y compensación de rentas, reducciones, mínimo personal y familiar, escalas estatal y autonómica (o tarifa foral), deducciones autonómicas y cuota diferencial. Prueba la tributación individual y la conjunta, y se queda con la más favorable. Después compara la misma situación en los 19 territorios y propone formas de pagar menos.

## Contenido

| Ruta | Qué es |
| --- | --- |
| `web/index.html` | La web: calculadora, comparador con mapa, clientes, planes y metodología |
| `web/js/irpfsim.js` | Motor de liquidación. Es el port a JavaScript del motor R de referencia y funciona en el navegador y en Node |
| `web/js/app.js` | Interfaz de la web |
| `web/css/mapafiscal.css` | Estilos (tema claro y oscuro) |
| `web/datos/params.json` | Parámetros normativos de 2025, generados desde `params/2025/*.yaml`. Cada bloque indica su `norma`, su `fuente` y su `estado` |
| `web/datos/mapa_es.json` | Cartografía por territorio fiscal (© Instituto Geográfico Nacional, CC BY 4.0), generada con `tools/generar_mapa.R` |
| `web/config.js` | Configuración del despliegue (modo demo, backend opcional con Supabase, precios) |
| `tools/empaquetar.mjs` | Genera un único HTML autónomo, en el mismo formato que el artifact publicado en Claude |
| `tools/servir.mjs` | Servidor estático para probar `web/` en local |
| `test/` | Tests del motor (casos calculados a mano e invariantes en los 19 territorios), de los parámetros y del empaquetado |
| `params/2025/*.yaml` | Fuente única de los parámetros: escalas, mínimos, reducciones y deducciones, cada una con su norma y su fuente |
| `R/` | Motor R de referencia, del que `irpfsim.js` es un port. También simula reformas sobre una muestra sintética |
| `tests/` | Tests del motor R (testthat), con el cálculo a mano de cada caso en `docs/03_casos_validacion.md` |
| `tools/*.R` | Generadores (`params.json`, mapa, catálogo de Supabase) y validador de paridad R ↔ JavaScript (`validar_js.html`, `validar_js_node.js`, `casos.json`) |
| `supabase/` | Esquema, migraciones, Edge Functions de cobro y semilla del catálogo normativo del backend |
| `docs/` | Diseño, cobertura, casos de validación, arquitectura de la web y registros de sesión |
| `inst/` | API REST (plumber) y dashboard de reformas (Shiny) sobre el motor R |

## Uso

Para la web y el motor JavaScript solo hace falta Node 20 o posterior. No hay dependencias que instalar.

```bash
npm test              # tests
npm run validar       # paridad R ↔ JavaScript con los casos de tools/casos.json
npm run servir        # web en http://localhost:8080
npm run empaquetar    # dist/mapafiscal.html (HTML autónomo)
```

Para el motor R hace falta R 4.3 o posterior con `yaml`, `jsonlite` y `testthat`:

```bash
Rscript tests/testthat.R               # tests del motor R
Rscript tools/exportar_params.R        # regenera web/datos/params.json desde los YAML
Rscript tools/montar_validador.R       # regenera casos.json y tools/validar_js.html
```

### El motor desde Node

```js
const irpfsim = require("./web/js/irpfsim.js");
const P = require("./web/datos/params.json");

const hogar = {
  territorio: "ES-MD", ejercicio: 2025, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no",
  miembros: [{ id: "d1", rol: "declarante", edad: 40, trabajo: { dinerarias: 30000, cotizacionesSs: 1905 } }]
};

irpfsim.liquidar(hogar, P).cuotaLiquidaTotal;   // 4610.53
irpfsim.compararTerritorios(hogar, P);          // los 19 territorios, de menor a mayor cuota
irpfsim.optimizar(hogar, P).recomendaciones;    // modalidad de declaración, plan de pensiones, traslado, deducciones
```

Un hogar se describe con `territorio` (código ISO: `ES-AN`, `ES-CT`, `ES-PV-BI`, `ES-NC`…), `tipoUnidadFamiliar` (`ninguna`, `biparental` o `monoparental`), `familiaNumerosa`, opcionalmente `municipioHabitantes` y `zonaDespoblada` (para las deducciones autonómicas rurales), y una lista de `miembros`. Cada miembro tiene un `rol` (`declarante`, `conyuge`, `descendiente` o `ascendiente`), su edad y discapacidad, y sus rentas: `trabajo`, `capitalMobiliario`, `capitalInmobiliario`, `actividades`, `ganancias`, `previsionSocial` y `retenciones`. La forma exacta de cada bloque está en las funciones `rn*` de `irpfsim.js` y en `construirHogar()` de `app.js`.

## Parámetros

Los parámetros se mantienen en `params/2025/*.yaml`; `web/datos/params.json` se genera a partir de ellos con `Rscript tools/exportar_params.R` y no se edita a mano (la CI lo regenera y falla si no coincide). Cada bloque lleva la norma de la que procede y un estado:

- **confirmado**: cotejado con la fuente.
- **provisional**: falta cotejarlo, o la regla está simplificada.

Las deducciones identificadas que aún no tienen cifra verificada no se calculan: figuran por nombre en la lista `pendientes` de cada territorio.

Para corregir o confirmar un parámetro, abre un issue con la plantilla *Parámetro a corregir o confirmar*.

## Cobertura

El detalle por territorio está en [`docs/02_cobertura.md`](docs/02_cobertura.md). Quedan fuera por ahora:

- Ceuta y Melilla.
- La estimación objetiva (módulos) de actividades económicas.
- Las deducciones autonómicas de inversión y donativos, y las que fijan el límite por tramos de base (libros de texto).
- En Navarra, las deducciones por adquisición de vivienda y por familia numerosa.

Las deducciones autonómicas que dependen del municipio de residencia se aplican si se indica su población o si está en la lista oficial de zonas en riesgo de despoblación de la comunidad. Al comparar territorios se supone un municipio del mismo tamaño en cada uno.

## Motor R de referencia

`R/` es la referencia normativa: `web/js/irpfsim.js` es un port que tiene que dar el mismo resultado al céntimo. La paridad se comprueba con los 46 hogares de `tools/validar_js.R`: el motor R calcula la referencia (`tools/casos.json`) y el motor JavaScript la liquida de nuevo, en el navegador (`tools/validar_js.html`, que debe decir «VALIDADOR OK») o en Node (`npm run validar`). La CI (`.github/workflows/motor-r.yml`) ejecuta en cada PR los tests del motor R, la comprobación de `params.json` y la validación de paridad.

## Backend (Supabase)

`supabase/` contiene el esquema del espacio de gestores (perfiles, clientes, lista de espera y suscripciones, todo con RLS), el catálogo normativo de lectura pública derivado de `params.json`, y las Edge Functions de cobro con Stripe. Cómo aplicarlo y qué claves configurar: [`supabase/README.md`](supabase/README.md).

## Publicar la web

- **Artifact o fichero único**: `npm run empaquetar` y publica `dist/mapafiscal.html`. La CI también lo adjunta como artefacto en cada ejecución.
- **GitHub Pages**: activa *Settings → Pages → Source: GitHub Actions* y lanza *Actions → Publicar web → Run workflow*.

## Aviso

Mapafiscal ofrece estimaciones con fines informativos. No es una liquidación oficial de la Agencia Tributaria ni asesoramiento fiscal.
