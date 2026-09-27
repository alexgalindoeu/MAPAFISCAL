# Textos legales de Mapafiscal

Estado: **listos para publicar en cuanto Alex ponga tres cosas** (ver más abajo). Las páginas
finales están en `web/legal/` (no aquí: aquí quedan solo estos apuntes y las fuentes, en
`docs/legal_fuentes.md`). Un profesional debería revisarlas antes de publicarlas, aunque eso
no tiene por qué bloquear el resto del trabajo.

| Página | Para qué |
|---|---|
| [`../../web/legal/aviso-legal.html`](../../web/legal/aviso-legal.html) | Identificación del titular (LSSI, art. 10) |
| [`../../web/legal/privacidad.html`](../../web/legal/privacidad.html) | Política de privacidad (RGPD y LOPDGDD) |
| [`../../web/legal/condiciones.html`](../../web/legal/condiciones.html) | Condiciones del plan Gestor + encargo del tratamiento (art. 28 RGPD) de «Mis clientes» |
| [`../../web/legal/cookies.html`](../../web/legal/cookies.html) | Qué guarda la web en el navegador (hoy: nada que necesite consentimiento) |

Enlazadas en el pie de `web/index.html` y citadas desde la casilla de aceptación de
`#dlg-acceso` (rama `local/cuentas-perfil`).

## Qué falta para poder publicar

**1. El correo de contacto.** Una IA no puede crear cuentas de correo. Recomendación: una
cuenta nueva y neutra (no con el nombre de Alex), por ejemplo de Gmail. Cuando exista:
- ponla en `contacto` de `web/config.js` (ahora mismo es `hola@mapafiscal.es`, un marcador que
  no existe: mientras siga así, `npm run test` y «Publicar web» fallan a propósito, ver más
  abajo);
- úsala también como remitente del SMTP propio de Supabase (`Authentication → Emails → SMTP
  Settings`; el de serie de Supabase solo entrega a los correos del equipo del proyecto).

**2. Los datos del titular**, para el aviso legal, la privacidad y las condiciones. **No van
en el repositorio**, que es público y guarda su historial para siempre: se añaden en
GitHub → Settings → Secrets and variables → Actions → **Variables**:

| Variable | Qué es | Obligatoria |
|---|---|---|
| `TITULAR_NOMBRE` | Nombre y apellidos (autónomo) o razón social (sociedad) | sí |
| `TITULAR_NIF` | NIF | sí |
| `TITULAR_DOMICILIO` | Domicilio a efectos de notificaciones. Como autónomo, consulta con un gestor si te vale una dirección profesional en vez de la de tu casa | sí |
| `TITULAR_REGISTRO` | Datos registrales (Registro Mercantil, colegio profesional…), solo si aplica | no: si se deja vacía, la línea entera desaparece de las páginas |

El workflow «Publicar web» (`.github/workflows/pages.yml`) las pasa a
`node tools/rellenar_titular.mjs`, que sustituye los `{{TITULAR_…}}` de `web/index.html` y de
`web/legal/*.html` justo antes de desplegar. Si falta una variable obligatoria, o si el
correo de `web/config.js` sigue siendo el marcador, el workflow falla con un error explícito
y no publica nada a medias. `npm test` comprueba además que ninguna página lleve `BORRADOR`
ni huecos entre corchetes (`[NIF]`, `[FECHA]`…), así que ya no puede quedar nada sin rellenar
por descuido.

**3. Decidir la fórmula.** Como autónomo aparecen tu nombre y tu NIF; con una SL, el nombre,
el CIF y el domicilio de la sociedad (tu nombre como administrador seguiría constando en el
Registro Mercantil, que es público). Cobrar suscripciones es una actividad económica: alta
censal, IVA e IRPF y, si es habitual, alta de autónomo. Coordínalo con un gestor antes de
activar el modo real de Stripe.

## Decisiones ya tomadas en estos textos

- El plan Gestor es **solo para profesionales** (variante única; se ha quitado la de
  consumidor de los borradores). Si Alex quiere admitir también consumidores, hay que
  reincorporar el derecho de desistimiento (arts. 102 y ss. TRLGDCU) y el consentimiento
  expreso de inicio inmediato del servicio.
- Sin banner de cookies: hoy la web solo guarda almacenamiento técnico exceptuado (art. 22.2
  LSSI; ver `web/legal/cookies.html`). En cuanto haya anuncios (decisión de Alex, 26-09) hará
  falta una CMP: lo coordina la sesión «Anuncios y monetización de Mapafiscal».
- Encargo del tratamiento de «Mis clientes»: el gestor es el responsable, Mapafiscal el
  encargado (art. 28 RGPD), con Supabase como subencargado autorizado.
- Guardar la aceptación: `perfiles.condiciones_version` + `perfiles.condiciones_aceptadas_en`
  (migración de la sesión de Cuentas, pendiente del OK de Alex). Si la versión aceptada no es
  `condicionesVersion` de `web/config.js`, hay que volver a pedirla.

Fuentes primarias de cada afirmación, en [`../legal_fuentes.md`](../legal_fuentes.md).
