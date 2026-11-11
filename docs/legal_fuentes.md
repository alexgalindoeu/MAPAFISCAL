# Fuentes de los textos legales

Fuentes primarias usadas para redactar `web/legal/*.html`. Todas se han leído directamente
(BOE, EUR-Lex, AEPD, o la política del propio proveedor), no de resúmenes de terceros.

## Normativa española

- **LSSI** — Ley 34/2002, de 11 de julio, de servicios de la sociedad de la información y de
  comercio electrónico. Texto consolidado: BOE-A-2002-13758.
  - Art. 10 (identificación del titular) → aviso legal, apartado 1. **Sin cumplir desde el
    28-09-2026** por decisión de Alex (ver `docs/legal/README.md`, «Regla absoluta»): el
    aviso legal ya no da el nombre, el NIF ni el domicilio del titular, que exige este
    artículo. Es una decisión suya, tomada con esa información.
  - Art. 21 y anexo (letra f, "comunicación comercial"; letra d, "destinatario del servicio") →
    correo comercial, respuesta a Lanzamiento.
  - Art. 22.2 (cookies y almacenamiento local) → política de cookies.
  - Última actualización consultada: 23/01/2025.

- **LOPDGDD** — Ley Orgánica 3/2018, de 5 de diciembre, de protección de datos personales y
  garantía de los derechos digitales. BOE-A-2018-16673. Citada junto al RGPD en privacidad,
  apartado 1; art. 11 (primera capa de información) → texto de la casilla de aceptación.

- **TRLGDCU** — Real Decreto Legislativo 1/2007, texto refundido de la Ley General para la
  Defensa de los Consumidores y Usuarios. BOE-A-2007-20555.
  - Art. 21.3 (identificación y atención al cliente) → aviso legal, con la reforma de la
    disposición final 3.2 de la Ley 10/2025, de 26 de diciembre (BOE-A-2025-26698), en vigor
    desde el 28/12/2025.
  - Arts. 97, 98 y 102-108 (información precontractual y desistimiento) → condiciones,
    variante de consumidor (no usada mientras el plan Gestor sea solo para profesionales).
  - Art. 62 (baja en servicios de tracto sucesivo) → condiciones, apartado de baja.
  - Última actualización consultada: 27/12/2025 (Ley 10/2025) y 01/03/2022 (art. 99).

- **Ley 7/1998**, de condiciones generales de la contratación, art. 5.4 (constancia de la
  aceptación) → guardar `condiciones_version` y `condiciones_aceptadas_en` al aceptar.

## Unión Europea

- **RGPD** — Reglamento (UE) 2016/679. Arts. 5 (principios), 6 (bases legales), 9 (categorías
  especiales, para el grado de discapacidad), 12 (plazo de respuesta a derechos), 13
  (información al recogerlos), 28 (encargado del tratamiento) y capítulo V (transferencias
  internacionales) → privacidad y anexo de encargo del tratamiento de las condiciones.
- **Directiva 2002/58/CE** (ePrivacy), art. 5.3, y las **Directrices 2/2023 del CEPD** sobre
  su ámbito de aplicación técnico → matiz sobre analítica sin cookies (respuesta a Lanzamiento
  y a Anuncios, no incorporado aún a la web publicada).
- **Decisión de Ejecución (UE) 2023/1795** (Marco de Privacidad de Datos UE-EE. UU.) y
  **Decisión de Ejecución (UE) 2021/914** (cláusulas contractuales tipo) → privacidad,
  apartados de proveedores y transferencias internacionales.
- Decisión de adecuación del Reino Unido, renovada por la Comisión Europea el 19 de diciembre
  de 2025 hasta el 27 de diciembre de 2031 → transferencia a jsDelivr (Volentio JSD Limited,
  Reino Unido).

## Guía de la AEPD

- **Guía sobre el uso de las cookies** (aepd.es/guias/guia-cookies.pdf) → política de cookies:
  cookies de autenticación o identificación de usuario y de personalización de la interfaz
  como ejemplos de almacenamiento exceptuado del consentimiento (art. 22.2 LSSI), que es el
  caso de `sb-…-auth-token`, `mapafiscal.trasAcceso` y `mapafiscal.pagoPendiente`.

## Proveedores citados en la política de privacidad y de cookies

Cada uno, de su propia política vigente en septiembre de 2026:

- **Supabase Pte. Ltd.** (Singapur) — `supabase.com/privacy` y `supabase.com/legal/dpa`:
  entidad, cláusulas contractuales tipo (módulos 2 y 3) para las transferencias y lista de
  subencargados en `supabase.com/legal/customer-resources/subprocessor-list`.
- **Stripe** — `stripe.com/es/privacy` y `stripe.com/es/legal/cookies-policy`: roles de
  responsable (prevención del fraude, cumplimiento normativo) y de encargado, y mecanismos de
  transferencia (Marco de Privacidad de Datos UE-EE. UU., cláusulas tipo).
- **GitHub, Inc.** — `docs.github.com/.../github-general-privacy-statement`: Marco de
  Privacidad de Datos UE-EE. UU. y cláusulas contractuales tipo (Decisión de Ejecución
  2021/914).
- **Volentio JSD Limited (jsDelivr)** — `jsdelivr.com/terms/privacy-policy`: entidad y país
  (Reino Unido), qué registra de cada petición al CDN («Usage Data»: IP, user agent, referer
  limitado al dominio, sin asociarlo nunca a un usuario) y que no usa cookies («Our Services
  do not use cookies or other similar technologies»).
- **Google** (Fonts y, en su caso, acceso con Google) — `fonts.google.com/faq#privacy`: la API
  de Google Fonts «is unauthenticated and … does not set or log cookies», pero recibe la IP,
  la URL pedida y las cabeceras HTTP de quien la usa.

## Pendiente de verificar cuando haya cuenta de Stripe en modo real

- Entidad exacta de Stripe responsable para usuarios del EEE (varía según el `Centro de
  privacidad` de Stripe): confirmar antes de publicar el nombre en privacidad, apartado 3.3,
  si cambia de "Stripe Payments Europe, Limited".

## No usadas todavía (relevantes para fases futuras, ver el tablero de coordinación)

- Reglamento (UE) 2024/3228 (fin de la plataforma europea de resolución de litigios en línea,
  20 de julio de 2025): no procede enlazar la antigua plataforma ODR.
- Directiva (UE) 2023/2673 (función de desistimiento en línea), aplicable en España desde el
  19 de junio de 2026: revisar si el plan Gestor pasa a admitir consumidores.
