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

**1. ~~El correo de contacto~~ Hecho.** `contacto@mapafiscal.es` (Cloudflare Email Routing,
con MX y SPF comprobados desde fuera), ya puesto en `contacto` de `web/config.js`. El SMTP
propio (Brevo) también lo configuró Alex directamente en Supabase.

**2. Los datos del titular: ya no se publican** (decisión de Alex, 28-09-2026, #55). El aviso
legal, la privacidad y las condiciones solo muestran «Mapafiscal» y el correo de contacto.
`node tools/rellenar_titular.mjs`, que el workflow «Publicar web» ejecuta antes de desplegar,
solo rellena `{{CONTACTO}}` con el `contacto` de `web/config.js`. Si en `web/` vuelve a
aparecer un `{{TITULAR_…}}`, se queda sin rellenar y la publicación falla, y `npm test` también
lo detecta. Las variables `TITULAR_*` de GitHub ya no se usan: se pueden borrar. Nada de lo
que se pase por `env:` a un workflow debe ser un dato personal, porque las variables (a
diferencia de los secretos) salen en claro en el registro de la ejecución, y el repositorio
es público. La obligación de identificarse del art. 10 LSSI sigue en pie: ver el punto 3.

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
