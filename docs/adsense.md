# Google AdSense: textos legales y consentimiento

Estado a 23-11-2026. Qué cubren ya los textos de `web/legal/` y qué le queda al propietario
(pasos fuera del repositorio o que necesitan una decisión suya).

## Lo que ya está en la web

| Requisito de Google | Dónde |
|---|---|
| Decir que terceros, incluido Google, usan cookies para mostrar anuncios basados en visitas anteriores a esta y otras webs | `privacidad.html#publicidad` (2.7) y `cookies.html#publicidad` |
| Explicar las cookies de publicidad de Google (AdSense y DoubleClick) | ídem, con la tabla `FCCDCF`/`FCNEC`, `__gads`/`__gpi`, `__eoi`, `IDE` |
| Cómo desactivar la publicidad personalizada: Configuración de anuncios de Google (`https://adssettings.google.com`), `www.aboutads.info` y `youronlinechoices.eu` | ídem |
| Enlace a «Cómo usa Google la información de sitios que usan sus servicios» (`https://policies.google.com/technologies/partner-sites`) | ídem |
| Consentimiento en el EEE, Reino Unido y Suiza con una CMP certificada por Google e integrada en el TCF de IAB | la web usa la CMP de Google («Privacidad y mensajes» de AdSense): `consentimiento: "google"` en `web/config.js`; `web/js/anuncios.js` carga `adsbygoogle.js`, que trae el mensaje. No hay banner propio |
| Reabrir el consentimiento | «Configurar cookies» en el pie (`#pie-configurar-cookies`), que llama a `googlefc.showRevocationMessage()` |
| `ads.txt` | `web/ads.txt` (`pub-3028486034839853`) |

Las partes de publicidad de las páginas legales llevan `data-con-anuncios` y solo se ven con
`anuncios: true` en `web/config.js`. La tabla de `cookies.html` la comprueba
`test/legal.test.mjs` contra las claves que guarda `web/js/` (en los dos sentidos).

## Pasos del propietario

### 1. Comprobar (o publicar) el mensaje RGPD de «Privacidad y mensajes»

La web **no instala ninguna CMP propia**: confía en la de Google, que es gratuita y está
certificada. Sin el mensaje publicado, Google solo sirve anuncios limitados en el EEE y el
Reino Unido. `web/config.js` dice que está publicado, pero desde el repositorio no se puede
verificar. Pasos en AdSense:

1. AdSense → **Privacidad y mensajes** → tarjeta **Mensajes de la Unión Europea (RGPD)** (en
   algunas cuentas, **Mensajes de consentimiento de la Unión Europea**) → **Gestionar**.
2. Si no hay ningún mensaje: **Crear mensaje** → elegir el sitio `mapafiscal.es` → idioma
   predeterminado **Español** (añadir inglés si se quiere).
3. Opciones del usuario: marcar **Consentir**, **Gestionar opciones** y **No consentir** (el
   botón «No consentir» al mismo nivel que «Consentir», como exige la guía de la AEPD; la
   política de cookies ya lo describe así).
4. **URL de la política de privacidad**: `https://mapafiscal.es/legal/privacidad.html`.
   Logotipo opcional (`https://mapafiscal.es/favicon.svg` no vale si pide PNG: usar
   `https://mapafiscal.es/og.png` o subir uno).
5. **Socios publicitarios** (Configuración → «Proveedores de tecnología publicitaria»): dejar
   la lista de Google por defecto o reducirla. La política remite a «Gestionar opciones» para la
   lista completa, así que no hay que copiarla en la web.
6. **Publicar**. Tarda unos minutos. Comprobar en una ventana de incógnito, desde España, en
   `https://mapafiscal.es/` (y en una página `/irpf/…`): debe salir el mensaje de Google y,
   tras elegir, «Configurar cookies» del pie lo vuelve a abrir.
7. Recomendado: en la misma pantalla, tarjeta **Reino Unido** y **Suiza** si aparecen por
   separado (normalmente el mismo mensaje RGPD cubre EEE, Reino Unido y Suiza).
8. Opcional: el mensaje de **regulaciones estatales de EE. UU.** no hace falta para el EEE; si
   se activa, revisar que la política de privacidad lo mencione.

Si algún día se decide no usar la CMP de Google, **no basta con el aviso propio**
(`consentimiento: "propio"`): no está certificado por Google ni integrado en el TCF, y Google
solo serviría anuncios limitados. Habría que contratar otra CMP certificada (la lista
está en la ayuda de Google, buscando «CMP certificadas por Google») y actualizar `anuncios.js` y los textos.

### 2. Datos que piden los textos legales y que la web no publica

Regla del proyecto (ver `docs/legal/README.md`): ningún dato personal del titular en la web.
Los textos usan solo «Mapafiscal» y `contacto@mapafiscal.es`. Consecuencias, para que el
propietario decida:

- **Identidad del responsable del tratamiento** (art. 13.1.a RGPD) en `privacidad.html`: hoy
  solo dice «Mapafiscal». El RGPD pide la identidad del responsable (persona física o jurídica).
  AdSense no lo comprueba, pero una reclamación ante la AEPD sí.
- **Identificación del prestador** (art. 10 LSSI: nombre o denominación, NIF, domicilio y, si
  es una sociedad, datos registrales) en `aviso-legal.html`. No se ha inventado ningún dato
  registral. Opciones ya comentadas: constituir una SL (los datos públicos serían los de la
  sociedad, no los personales) o asumir el riesgo.
- **Datos de pago de AdSense** (nombre y dirección del beneficiario): van solo en la cuenta de
  AdSense, nunca en la web.

### 3. Avisos por el cambio de la política de privacidad

`privacidad.html` dice que, si el cambio es importante, se avisa por correo a quien tiene
cuenta. Esta versión (23-11-2026) añade la publicidad de Google (apartado 2.7), quita Google
Fonts (las tipografías ya se sirven desde la web) y el informe en PDF pasa a ser gratis con
cuenta. Decidir si se envía el correo. No se ha cambiado `condicionesVersion` en
`web/config.js` (las condiciones del plan Gestor no cambian), así que nadie tendrá que volver a
aceptarlas.

### 4. Interruptores que cambian lo que guarda la web

- `pruebaCarriles > 0` (prueba de uno o dos carriles): guarda `mapafiscal.pruebaCarriles` en el
  navegador **antes** del consentimiento. Es una medición de diseño ligada a la publicidad y no
  es estrictamente necesaria: antes de activarla, valorar pedir consentimiento para ella o
  repartir el grupo sin guardarlo. La fila de `cookies.html` solo se ve con la prueba activa.
- `informeAnuncio: true` (anuncio bonificado del informe): guarda `mapafiscal.informeRecompensa`
  en `sessionStorage` y carga Google Publisher Tag (Ad Manager), que necesita la misma CMP. La
  fila de `cookies.html` solo se ve con el interruptor encendido.
- `consentimiento: "propio"`: guarda `mapafiscal.consentimiento` (ver el punto 1).

### 5. Revisión periódica

Google cambia de vez en cuando los nombres de las cookies y la URL de la Configuración de
anuncios (hoy redirige a «Mi centro de anuncios», `myadcenter.google.com`). Revisar la tabla de
`cookies.html#publicidad` con «Gestionar opciones» del mensaje una vez al año.
