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

## Cobros (Stripe) — lo que falta hacer a mano

Las Edge Functions están desplegadas y responden `503 pagos_no_configurados` hasta que
existan los secretos:

| Función | JWT | Qué hace |
|---|---|---|
| `crear-checkout` | sí | crea la sesión de Stripe Checkout del plan Gestor (mensual/anual) |
| `stripe-webhook` | no (firma de Stripe) | sincroniza `suscripciones` y `perfiles.plan` |
| `portal-facturacion` | sí | abre el portal de cliente de Stripe (tarjeta, facturas, baja) |

Pasos (los haces tú; nadie más debe teclear estas claves):

1. En Stripe, crea el producto **Mapafiscal Gestor** con dos precios recurrentes
   (mensual y anual) y copia sus IDs `price_…`.
2. En Stripe → Developers → Webhooks, añade el endpoint
   `https://pqiqrcvuztxrwrwizppj.supabase.co/functions/v1/stripe-webhook` con los eventos
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
3. En Supabase → Edge Functions → Secrets, define:

   | Secreto | Valor |
   |---|---|
   | `STRIPE_SECRET_KEY` | `sk_live_…` (o `sk_test_…` para pruebas) |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` del endpoint del paso 2 |
   | `STRIPE_PRICE_GESTOR_MENSUAL` | `price_…` |
   | `STRIPE_PRICE_GESTOR_ANUAL` | `price_…` |
   | `SITE_URL` | URL pública de la web, p. ej. `https://<usuario>.github.io/mapafiscal` |
   | `SITE_ORIGIN` | el origen de esa URL (para CORS), p. ej. `https://<usuario>.github.io` |

4. En Stripe → Settings → Billing → Customer portal, activa el portal.
5. En la web, `web/config.js` → `pagosActivos: true`.

## Autenticación

La web usa inicio de sesión por **enlace mágico** (email, sin contraseña). En Supabase →
Authentication → URL Configuration, añade la URL pública de la web a *Site URL* y a
*Redirect URLs*. Para producción conviene configurar un SMTP propio (el de Supabase tiene
un límite bajo de envíos por hora).
