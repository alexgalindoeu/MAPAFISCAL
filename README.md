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
| `web/datos/params.json` | Parámetros normativos de 2025. Cada bloque indica su `norma`, su `fuente` y su `estado` |
| `web/datos/mapa_es.json` | Cartografía por territorio fiscal (© Instituto Geográfico Nacional, CC BY 4.0) |
| `web/config.js` | Configuración del despliegue (modo demo, backend opcional con Supabase, precios) |
| `tools/empaquetar.mjs` | Genera un único HTML autónomo, en el mismo formato que el artifact publicado en Claude |
| `tools/servir.mjs` | Servidor estático para probar `web/` en local |
| `test/` | Tests del motor (casos calculados a mano e invariantes en los 19 territorios), de los parámetros y del empaquetado |

## Uso

Solo hace falta Node 20 o posterior. No hay dependencias que instalar.

```bash
npm test              # tests
npm run servir        # web en http://localhost:8080
npm run empaquetar    # dist/mapafiscal.html (HTML autónomo)
```

### El motor desde Node

```js
const irpfsim = require("./web/js/irpfsim.js");
const P = require("./web/datos/params.json");

const hogar = {
  territorio: "ES-MD", ejercicio: 2025, tipoUnidadFamiliar: "ninguna", familiaNumerosa: "no",
  miembros: [{ id: "d1", rol: "declarante", edad: 40, trabajo: { dinerarias: 30000, cotizacionesSs: 1905 } }]
};

irpfsim.liquidar(hogar, P).cuotaLiquidaTotal;   // 4645.09
irpfsim.compararTerritorios(hogar, P);          // los 19 territorios, de menor a mayor cuota
irpfsim.optimizar(hogar, P).recomendaciones;    // modalidad de declaración, plan de pensiones, traslado, deducciones
```

Un hogar se describe con `territorio` (código ISO: `ES-AN`, `ES-CT`, `ES-PV-BI`, `ES-NC`…), `tipoUnidadFamiliar` (`ninguna`, `biparental` o `monoparental`), `familiaNumerosa` y una lista de `miembros`. Cada miembro tiene un `rol` (`declarante`, `conyuge`, `descendiente` o `ascendiente`), su edad y discapacidad, y sus rentas: `trabajo`, `capitalMobiliario`, `capitalInmobiliario`, `actividades`, `ganancias`, `previsionSocial` y `retenciones`. La forma exacta de cada bloque está en las funciones `rn*` de `irpfsim.js` y en `construirHogar()` de `app.js`.

## Parámetros

`web/datos/params.json` es la única fuente de datos del motor. Cada bloque lleva la norma de la que procede y un estado:

- **confirmado**: cotejado con la fuente.
- **provisional**: falta cotejarlo, o la regla está simplificada.

Para corregir o confirmar un parámetro, abre un issue con la plantilla *Parámetro a corregir o confirmar*.

## Cobertura

Quedan fuera por ahora:

- Ceuta y Melilla.
- La estimación objetiva (módulos) de actividades económicas.
- Las deducciones autonómicas que dependen del municipio de residencia (zonas rurales o en riesgo de despoblación), y las de inversión y donativos.
- En Navarra, las deducciones por vivienda y por familia numerosa.

## Motor R de referencia

`params.json` se genera a partir de `params/2025/*.yaml`. El motor JavaScript se valida al céntimo contra el motor R (`R/00..08`, con `tools/validar_js.html`). Esos ficheros todavía no están en este repositorio.

## Publicar la web

- **Artifact o fichero único**: `npm run empaquetar` y publica `dist/mapafiscal.html`. La CI también lo adjunta como artefacto en cada ejecución.
- **GitHub Pages**: activa *Settings → Pages → Source: GitHub Actions* y lanza *Actions → Publicar web → Run workflow*.

## Aviso

Mapafiscal ofrece estimaciones con fines informativos. No es una liquidación oficial de la Agencia Tributaria ni asesoramiento fiscal.
