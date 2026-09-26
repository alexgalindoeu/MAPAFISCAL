# Textos legales de Mapafiscal — BORRADORES

> **Estado: borrador para revisar (issue #14).** Estos textos los ha preparado Claude como punto
> de partida. No son asesoramiento jurídico. La redacción final es de Alex o de un profesional,
> que debe revisarlos antes de publicarlos. **No se enlazan todavía** ni en la web ni en Stripe.

| Fichero | Para qué | Dónde irá |
|---|---|---|
| [`aviso_legal.md`](aviso_legal.md) | Identificación del titular (LSSI, art. 10) | pie de la web |
| [`privacidad.md`](privacidad.md) | Política de privacidad (RGPD y LOPDGDD) | pie de la web, diálogo de acceso, Stripe (*Settings → Public details*) |
| [`condiciones_plan_gestor.md`](condiciones_plan_gestor.md) | Condiciones del plan Gestor y encargo del tratamiento de los datos de «Mis clientes» | *Planes*, Checkout de Stripe (*terms of service*), pie de la web |

## Huecos que tiene que rellenar Alex

Están marcados entre corchetes y en mayúsculas:

- `[NOMBRE Y APELLIDOS]` o `[RAZÓN SOCIAL]`: titular de la web y del servicio.
- `[NIF]`: NIF o NIF-IVA del titular.
- `[DOMICILIO]`: domicilio a efectos de notificaciones.
- `[CORREO]`: correo de contacto. El `hola@mapafiscal.es` de `web/config.js` es un marcador y
  **no existe**.
- `[DATOS REGISTRALES]`: solo si el titular es una sociedad (Registro Mercantil) o hay colegio
  profesional o autorización. Si no, se borra la línea.
- `[PLAZO …]`: plazos de conservación que hay que decidir.
- `[VERIFICAR …]`: datos de terceros (Supabase, Stripe, Google, GitHub, jsDelivr) que hay que
  comprobar en sus propias condiciones antes de publicarlos.
- `[FECHA]`: fecha de la última actualización.

## Decisiones pendientes de Alex

1. **¿Consumidores o solo profesionales?** El plan Gestor está pensado para asesores y
   gestorías (B2B). Si también lo pueden contratar consumidores, hay que informar del derecho
   de desistimiento de 14 días (arts. 102 y ss. TRLGDCU) y pedir en el Checkout el
   consentimiento para empezar el servicio en el acto. El borrador de condiciones lleva las dos
   variantes.
2. **Plazo para borrar los clientes ocultos.** Tras una baja, los clientes guardados se
   conservan ocultos hasta que el gestor vuelve o los borra. Conviene fijar un plazo máximo,
   por ejemplo 12 meses, y automatizar el borrado.
3. **Reembolsos.** El borrador dice que no hay reembolsos del periodo en curso, salvo
   desistimiento o si la ley obliga. Al borrar la cuenta, la suscripción se cancela en el acto
   sin reembolso.
4. **Cookies y fuentes.** Ver la nota siguiente.

## Nota sobre cookies, almacenamiento local y fuentes

- **La web no usa cookies de analítica ni de publicidad.** Guarda en `localStorage`:
  - la sesión de Supabase (`sb-…-auth-token`);
  - lo que hay que hacer al volver del acceso (`mapafiscal.trasAcceso`,
    `mapafiscal.pagoPendiente`).

  Son estrictamente necesarios para el servicio que pide el usuario (art. 22.2 LSSI), así que
  no hace falta banner de consentimiento. Basta con explicarlos en la política de privacidad.
- **Google Fonts**: la web carga las fuentes (Public Sans, IBM Plex Mono) desde
  `fonts.googleapis.com`, así que Google recibe la IP de cada visitante. Hay una sentencia
  alemana de 2022 (LG München, 3 O 17493/20) que lo consideró ilícito sin consentimiento.
  **Recomendación:** alojar las fuentes en la propia web (`web/fuentes/`, licencia SIL OFL).
  Así desaparece el problema y no hace falta mencionarlo. Es un cambio pequeño en
  `web/index.html` y `web/css/`, pero hay que actualizar también el empaquetador.
- **jsDelivr**: `supabase-js` se carga desde `cdn.jsdelivr.net`, que también recibe la IP. La
  alternativa es copiar el fichero (con su hash SRI) a `web/js/vendor/`.
- **Stripe Checkout y el portal de facturación** son páginas de Stripe (`checkout.stripe.com`,
  `billing.stripe.com`) con sus propias cookies. Las explica la política de Stripe, a la que
  enlaza la nuestra.
