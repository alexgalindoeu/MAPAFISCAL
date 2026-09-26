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
| `clientes` | el propio gestor | el propio gestor | perfiles de cliente (alias + hogar + última liquidación) |
| `lista_espera` | nadie (solo panel) | cualquiera (insert) | acceso anticipado |
| `suscripciones` | el propio gestor | solo el webhook | estado de la suscripción de Stripe |

- Al registrarse un usuario se crea su fila en `perfiles` (trigger `privado.crear_perfil`).
- Límite de clientes por plan en `privado.limite_clientes()`: **3 en el plan gratuito**,
  ilimitados en Gestor/Despacho (cámbialo ahí si decides otra cosa).
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
| `portal-facturacion` | sí | abre el portal de cliente de Stripe (tarjeta, periodo, facturas, baja) |

Sin `STRIPE_SECRET_KEY` las tres responden `503 pagos_no_configurados`. Para comprobar si
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
suscripción en Stripe, así un evento que llega tarde no deshace uno posterior. Los estados
`active`, `trialing` y `past_due` dan el plan; el resto lo devuelve a `gratis`.

**Orígenes y vuelta.** `SITE_ORIGIN` admite varios orígenes separados por comas (CORS).
La web envía su propia URL (`volver`) y, si su origen está en la lista, Stripe vuelve a esa
página; si no, a `SITE_URL`. Así se puede probar desde `http://localhost:8080`.

**Claves de Supabase en las funciones.** Usan la clave secreta nueva (`SUPABASE_SECRET_KEYS`,
`sb_secret_…`) si existe y, si no, la antigua `SUPABASE_SERVICE_ROLE_KEY`. Las pone
Supabase automáticamente: no hay que definirlas.

### Puesta en marcha (la hace Alex; nadie más teclea claves secretas)

En modo test ya están creados, en el entorno de prueba de Stripe: el producto
**Mapafiscal Gestor** (`prod_VKTnZM0m6yWTKa`) con sus tres precios y la configuración del
portal de cliente (por defecto, vuelve a la web). Falta:

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

Para pasar a **modo live**: repetir en el modo live de Stripe el producto, los tres precios
con sus `lookup_key`, el portal y el webhook, y cambiar `STRIPE_SECRET_KEY` y
`STRIPE_WEBHOOK_SECRET` por los de live.

## Autenticación

La web usa inicio de sesión por **enlace mágico** (email, sin contraseña). El enlace vuelve
a la misma página que lo pidió (sin hash) y la web recuerda si había que ir a *Mis
clientes* o a *Planes*. Esa página tiene que estar en *Redirect URLs* (paso 3); si no,
Supabase manda al usuario a *Site URL*. Para producción conviene configurar un SMTP propio
(el de Supabase tiene un límite bajo de envíos por hora).
