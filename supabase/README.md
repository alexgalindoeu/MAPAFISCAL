# Supabase — backend de Mapafiscal

Proyecto: **`mapafiscal`** · ref `pqiqrcvuztxrwrwizppj` · región `eu-west-3` (París) ·
URL `https://pqiqrcvuztxrwrwizppj.supabase.co`.

La web (`web/`) solo usa la **clave publicable** (`sb_publishable_…`), que es pública por
diseño: todo el acceso a datos está protegido por **RLS**. La clave `service_role` y las
claves de Stripe viven únicamente como secretos del servidor y **no están en el repo**.

## Esquema (`migrations/`)

| Tabla | Quién lee | Quién escribe | Para qué |
|---|---|---|---|
| `ejercicios` | todos | servicio | `params.json` completo por ejercicio (copia de `params/*.yaml`) |
| `territorios` | todos | servicio | los 19 territorios fiscales |
| `deducciones`, `deducciones_pendientes` | todos | servicio | catálogo de deducciones autonómicas modeladas / pendientes |
| vista `cobertura_deducciones` | todos | — | resumen por territorio |
| `perfiles` | el propio usuario | el usuario (solo `nombre`, `despacho`); el `plan` solo el webhook | cuenta del gestor |
| `clientes` | el propio gestor, con plan de pago | el propio gestor, con plan de pago | perfiles de cliente (alias + hogar + última liquidación) |
| `lista_espera` | nadie (solo panel) | cualquiera (insert) | acceso anticipado |
| `suscripciones` | el propio gestor | solo el webhook | estado de la suscripción de Stripe: periodo (`semanal`, `mensual`, `anual`), fin del periodo y `termina_en` si no se renueva |

- Al registrarse un usuario se crea su fila en `perfiles` (trigger `privado.crear_perfil`); si
  entra con Google, `nombre` toma el de su cuenta de Google (migración
  `20260926210000_suscripciones_periodo_perfil`). El usuario lo cambia en la pestaña *Perfil*.
- **«Mis clientes» solo con plan de pago** (migración `20260926130000_clientes_solo_plan_pago`,
  sustituye al antiguo plan gratuito de 3 clientes): las políticas de `clientes` exigen,
  además de ser el propio gestor, que `perfiles.plan` no sea `gratis`. Sin plan, los clientes
  guardados quedan ocultos (no se ven ni se editan) y reaparecen si vuelve a suscribirse.
  Dos funciones RPC, solo para el propio usuario: `contar_mis_clientes()` (cuántos tiene,
  aunque estén ocultos) y `borrar_mis_clientes()` (los borra todos: derecho de supresión).
  Son `SECURITY DEFINER` a propósito; el asesor de seguridad de Supabase las señala.
- Minimización de datos (RGPD): no se guarda NIF ni nombre real del cliente, solo el alias
  que elija el gestor.

## Catálogo normativo

`Rscript tools/sincronizar_supabase.R` genera `seed/catalogo_2025.sql` (idempotente) a
partir de los YAML. Aplícalo en el SQL editor de Supabase tras cada cambio de parámetros.
Territorios, deducciones y pendientes se **derivan del propio `params.json`** dentro de la
base de datos, así el catálogo no puede desincronizarse del motor JS.

## Cobros (Stripe)

| Función | JWT | Qué hace |
|---|---|---|
| `crear-checkout` | sí | crea la sesión de Stripe Checkout del plan Gestor (semanal, mensual o anual); responde `409 ya_suscrito` si ya hay una suscripción activa |
| `stripe-webhook` | no (firma de Stripe) | sincroniza `suscripciones` y `perfiles.plan` |
| `portal-facturacion` | sí | abre el portal de cliente de Stripe (tarjeta, periodo, facturas, baja); `vista` elige a qué pestaña se vuelve (`perfil`, `clientes`; por defecto `#gestor`) |
| `borrar-cuenta` | sí | borra la cuenta (derecho de supresión): cancela al momento sus suscripciones, borra el usuario y, en cascada, perfil, clientes y suscripción. Pide `{ confirmar: correo }` |

Sin `STRIPE_SECRET_KEY` las tres primeras responden `503 pagos_no_configurados` (y `borrar-cuenta`
solo si la cuenta tiene una suscripción que cancelar). Para comprobar si
están configuradas, un `POST` vacío al webhook debe responder **400** (`sin_firma`), no 503:

```bash
curl -i -X POST https://pqiqrcvuztxrwrwizppj.supabase.co/functions/v1/stripe-webhook
```

**Precios.** Las funciones buscan el precio por su `lookup_key`: `gestor_semanal`,
`gestor_mensual` y `gestor_anual` (19,99 €/semana, 39,99 €/mes y 290 €/año, provisionales).
Los importes llevan el **IVA incluido** (`tax_behavior: inclusive`): Stripe cobra exactamente
esa cifra, y si se activa Stripe Tax desglosa el IVA dentro de ella.
Para cambiar un precio, crea uno nuevo en el mismo producto y transfiérele la `lookup_key`
(Stripe → producto → precio → *Lookup key*, o `transfer_lookup_key` en la API); no hace
falta tocar código ni secretos. Actualiza también `precios` en `web/config.js`. Si se define
el secreto `STRIPE_PRICE_GESTOR_<PERIODO>` con un `price_…`, tiene prioridad.

**Webhook.** Eventos que maneja el código: `checkout.session.completed`,
`customer.subscription.created`, `customer.subscription.updated` y
`customer.subscription.deleted`. No se fía del objeto del evento: vuelve a leer la
suscripción en Stripe, así un evento que llega tarde no deshace uno posterior. Al pagar,
Stripe manda tres eventos casi a la vez; si dos crean la fila de `suscripciones` a la vez,
el segundo choca con la clave única del cliente (23505) y se repite como actualización.
Guarda también el periodo (del intervalo del precio: semana, mes o año) y `termina_en`, la
fecha en que acaba el acceso si la suscripción no se renueva (`ended_at`, `cancel_at` o el fin
de periodo con `cancel_at_period_end`); la pestaña *Perfil* muestra «Próxima renovación» o
«Termina el». Las suscripciones sin `gestor_id` en sus metadatos (ajenas o de una cuenta
borrada) se ignoran, y si la cuenta ya no existe (23503) el evento se da por atendido.

**Borrar la cuenta** (`borrar-cuenta`, pestaña *Perfil*). Antes de borrar el usuario quita
`gestor_id` de los metadatos de sus suscripciones vivas y las cancela al momento, sin
reembolso; el webhook ignora esos eventos. El cliente de Stripe se conserva, marcado con
`cuenta_borrada`, si tiene facturas (hay que conservarlas por ley); si no, se borra. Si Stripe
falla no se borra nada. Un cliente o una suscripción que no existe en el modo actual de Stripe
(`resource_missing`, p. ej. datos de prueba tras pasar a live) no bloquea el borrado; tampoco
en `crear-checkout` (crea un cliente nuevo) ni en `portal-facturacion` (`404 sin_suscripcion`).
Los estados `active`, `trialing` y `past_due` dan el plan; el resto lo devuelve a `gratis`
(los clientes guardados se conservan, ocultos).

**Orígenes y vuelta.** `SITE_ORIGIN` admite varios orígenes separados por comas (CORS).
La web envía su propia URL (`volver`) y, si su origen está en la lista, Stripe vuelve a esa
página; si no, a `SITE_URL`. Así se puede probar desde `http://localhost:8080`.

**Claves de Supabase en las funciones.** Usan la clave secreta nueva (`SUPABASE_SECRET_KEYS`,
`sb_secret_…`) si existe y, si no, la antigua `SUPABASE_SERVICE_ROLE_KEY`. Las pone
Supabase automáticamente: no hay que definirlas.

### Puesta en marcha (la hace Alex; nadie más teclea claves secretas)

**Estado (2026-09-26): configurado, probado en modo test y activado en la web** (`pagosActivos: true`) en la cuenta de Stripe GALINDX
(modo de prueba, no el *sandbox*): producto **Mapafiscal Gestor** (`prod_VKaFIrhMte2Qh3`)
con sus tres precios (IVA incluido), portal de cliente por defecto, webhook con los cuatro
eventos y los secretos de abajo. Probado desde `http://localhost:8080`: acceso por enlace
mágico, «Mis clientes» bloqueado sin plan (cuenta de prueba sin plan: RLS rechaza leer y
guardar), pago con tarjeta de prueba (mensual y
semanal), webhook → `perfiles.plan = gestor`, `409 ya_suscrito`, portal de facturación con
vuelta a la web, y baja → `gratis`. (En el *sandbox* «Entorno de prueba de GALINDX» hay una
copia del producto sin uso.)

Pasos, por si hay que repetirlos (p. ej. en modo live):

0. **Producto en Stripe**: *Mapafiscal Gestor* con tres precios recurrentes en EUR, IVA
   incluido, con `lookup_key` `gestor_semanal`, `gestor_mensual` y `gestor_anual`; y el
   portal de cliente (Settings → Billing → Customer portal) activado.
1. **Webhook en Stripe** (Developers → Webhooks → *Add endpoint*): URL
   `https://pqiqrcvuztxrwrwizppj.supabase.co/functions/v1/stripe-webhook`, los cuatro
   eventos de arriba. Copia su *Signing secret* (`whsec_…`).
2. **Secretos en Supabase** (Dashboard → Edge Functions → Secrets, o `supabase secrets set`):

   | Secreto | Valor |
   |---|---|
   | `STRIPE_SECRET_KEY` | `sk_test_…` (en producción, `sk_live_…` o una clave restringida `rk_live_…`) |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` del paso 1 |
   | `SITE_URL` | `https://alexgalindoeu.github.io/MAPAFISCAL/` |
   | `SITE_ORIGIN` | `https://alexgalindoeu.github.io,http://localhost:8080` (quita `localhost` al pasar a modo live) |

3. **Supabase Auth** (Authentication → URL Configuration): *Site URL*
   `https://alexgalindoeu.github.io/MAPAFISCAL/`; *Redirect URLs*
   `https://alexgalindoeu.github.io/MAPAFISCAL/**` y `http://localhost:8080/**`.
4. Comprobación: el `curl` de arriba responde 400. Después, `pagosActivos: true` en
   `web/config.js` (en una PR).

**Modo live (2026-09-26).** Ya están creados en el modo live de la cuenta GALINDX el
producto **Mapafiscal Gestor** (`prod_VKhBZJor3exCoM`), los tres precios con sus
`lookup_key` (IVA incluido) y el portal de cliente, que por defecto vuelve a
`…/MAPAFISCAL/#gestor`. Para cobrar de verdad falta lo que solo puede hacer Alex:
- activar la cuenta de Stripe para pagos reales (datos del negocio y cuenta bancaria);
- crear el webhook en live, con la misma URL y los mismos eventos;
- en Supabase, cambiar `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` por los de live, y
  dejar `SITE_ORIGIN` en `https://alexgalindoeu.github.io`, sin `localhost`.

Con las claves live, las cuentas de prueba siguen en la base de datos, pero sus
suscripciones de test ya no existen para Stripe y su portal falla. Para volver a probar en
modo test hay que volver a poner las claves de test.

## Autenticación

La web inicia sesión con **Google** (`signInWithOAuth`) o con un **enlace mágico** por correo
(`signInWithOtp`), sin contraseñas; si la cuenta no existe, se crea. Los dos vuelven a la misma
página que los pidió (sin hash), así que esa página tiene que estar en *Redirect URLs* (paso 3);
si no, Supabase manda al usuario a *Site URL*. La web recuerda en `localStorage` qué había que
hacer al volver: ir a *Mis clientes*, *Planes* o *Perfil* o, si se pulsó «Suscribirme» sin
sesión, seguir directamente al pago con el mismo plan y periodo (durante 2 horas). El botón de
Google solo aparece si el proveedor está activado (lo consulta en `/auth/v1/settings`).

**Activar Google** (lo hace Alex; el *Client Secret* no va al repo ni se le pasa a nadie):

1. [Google Auth Platform](https://console.cloud.google.com/auth/overview) (Google Cloud, proyecto
   nuevo o existente): *Branding* con el nombre «Mapafiscal» y el correo de asistencia;
   *Audience* → externo y **publicar la app** (en modo prueba solo entran los usuarios de
   prueba); *Data Access* → `openid`, `…/auth/userinfo.email` y `…/auth/userinfo.profile`.
2. *Clients* → *Create client* → **Aplicación web**. *Authorized JavaScript origins*:
   `https://mapafiscal.es`, `https://alexgalindoeu.github.io` y `http://localhost:8080`
   (dominio propio ya conectado el 27-09; el de GitHub Pages se puede quitar cuando deje de
   usarse). *Authorized redirect URIs*: `https://pqiqrcvuztxrwrwizppj.supabase.co/auth/v1/callback`.
   Guarda el Client ID y el Client Secret.
3. Supabase → Authentication → Sign In / Providers → **Google**: activarlo y pegar el Client
   ID y el Client Secret.
4. Supabase → Authentication → URL Configuration: *Site URL* `https://mapafiscal.es/`;
   *Redirect URLs* `https://mapafiscal.es/**`, `https://alexgalindoeu.github.io/MAPAFISCAL/**`
   y `http://localhost:8080/**`. (Si ya lo cambiaste al conectar el dominio, revisa que estén
   las tres.)

Si una persona ya tenía cuenta por correo, al entrar con Google con el mismo correo Supabase
enlaza las dos identidades (Google verifica el correo). En la pantalla de Google aparece el
dominio `pqiqrcvuztxrwrwizppj.supabase.co` hasta que se verifique la marca o se use un
dominio propio en Supabase.

Para producción conviene configurar un SMTP propio: el de Supabase solo envía unos pocos
correos por hora («email rate limit exceeded»).
