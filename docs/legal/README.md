# Textos legales de Mapafiscal

Estado: **publicados**. Las páginas están en `web/legal/` (no aquí: aquí quedan solo estos
apuntes y las fuentes, en `docs/legal_fuentes.md`). Un profesional debería revisarlas en algún
momento, sin que eso bloquee nada.

| Página | Para qué |
|---|---|
| [`../../web/legal/aviso-legal.html`](../../web/legal/aviso-legal.html) | Qué es Mapafiscal, naturaleza orientativa de los cálculos y condiciones de uso |
| [`../../web/legal/privacidad.html`](../../web/legal/privacidad.html) | Política de privacidad (RGPD y LOPDGDD) |
| [`../../web/legal/condiciones.html`](../../web/legal/condiciones.html) | Condiciones del plan Gestor + encargo del tratamiento (art. 28 RGPD) de «Mis clientes» |
| [`../../web/legal/cookies.html`](../../web/legal/cookies.html) | Qué guarda la web en el navegador (hoy: nada que necesite consentimiento) |

Enlazadas en el pie de `web/index.html` y citadas desde la casilla de aceptación de
`#dlg-acceso`.

## Regla absoluta: sin datos personales de Alex en la web (28-09-2026)

**Incidente.** Los primeros textos (PR #46) identificaban al titular con su nombre, NIF y
domicilio en `{{TITULAR_NOMBRE}}`, `{{TITULAR_NIF}}` y `{{TITULAR_DOMICILIO}}`, siguiendo al
pie de la letra el artículo 10 de la LSSI. En cuanto Alex rellenó esas variables en GitHub y se
publicó la web, sus datos reales quedaron públicos en `mapafiscal.es/legal/`. Chocaba con lo
que había pedido desde el principio («me gustaría permanecer anónimo en la web») y le molestó,
con razón: aunque el diseño avisaba de que esa página era el sitio legalmente correcto para
esos datos, no se le preguntó de nuevo justo antes de exponerlos de verdad. Se corrigió con
urgencia (PR #55, `local/quitar-datos-titular`): las tres páginas usan ahora solo el nombre
comercial «Mapafiscal» y `contacto@mapafiscal.es`.

**Regla, desde ahora:** ningún dato personal identificativo de Alex (nombre, NIF, domicilio…)
se publica en ningún sitio de la web, bajo ningún concepto. Si una norma parece exigir algo
más (por ejemplo, la identificación del titular de la LSSI art. 10, o del art. 21.3 TRLGDCU si
llega a vender a consumidores), **se le plantea antes a Alex en el chat**, dejando muy claro
que la respuesta sería pública, y se espera su decisión expresa — nunca se automatiza ni se
vuelve a meter un hueco `{{TITULAR_…}}` en una página que se publica sola. `tools/rellenar_titular.mjs`
ya no conoce ese campo (solo rellena `{{CONTACTO}}`, que es el buzón que Alex decidió hacer
público) y dos tests (`test/legal.test.mjs`) lo comprueban: que no aparezca ningún
`{{TITULAR_…}}` en las páginas legales, y que ningún hueco desconocido pase desapercibido.

Consecuencia legal, sin resolver todavía: sin esos datos, el aviso legal deja de cumplir la
LSSI art. 10 (y, si algún día vende a consumidores, el art. 21.3 TRLGDCU). Es una decisión de
Alex, tomada con esa información — no algo que se pueda arreglar sin su OK. Detalle de qué
exige cada norma y las opciones (autónomo, SL, WHOIS de `.es`…), en el hilo de esta
conversación y en `Desktop\mapafiscal-coordinacion\TABLERO.md`.

## Decisiones ya tomadas en estos textos

- El plan Gestor es **solo para profesionales** (variante única; se ha quitado la de
  consumidor de los borradores). Si Alex quiere admitir también consumidores, hay que
  reincorporar el derecho de desistimiento (arts. 102 y ss. TRLGDCU) y el consentimiento
  expreso de inicio inmediato del servicio.
- Sin banner de cookies: hoy la web solo guarda almacenamiento técnico exceptuado (art. 22.2
  LSSI; ver `web/legal/cookies.html`). En cuanto haya anuncios (decisión de Alex, 26-09) hará
  falta una CMP: lo coordina la sesión «Anuncios y monetización de Mapafiscal», con un banner
  simple (Aceptar de un clic, Rechazar con el mismo peso, sin muro).
- Encargo del tratamiento de «Mis clientes»: el gestor es el responsable, Mapafiscal el
  encargado (art. 28 RGPD), con Supabase como subencargado autorizado.
- Guardar la aceptación: `perfiles.condiciones_version` + `perfiles.condiciones_aceptadas_en`
  (migración de la sesión de Cuentas, pendiente del OK de Alex). Si la versión aceptada no es
  `condicionesVersion` de `web/config.js`, hay que volver a pedirla.

Fuentes primarias de cada afirmación, en [`../legal_fuentes.md`](../legal_fuentes.md).
