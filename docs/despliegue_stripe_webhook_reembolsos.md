# Despliegue pendiente: webhook de Stripe con validación del pago y reembolsos del informe

Cambio de código de la fase 2 (auditoria/fase0-2026-11-18.md, sección B). **Nada está desplegado**:
lo hace el propietario, en este orden.

## Qué cambia

- `stripe-webhook` relee de Stripe la sesión de Checkout del informe y solo la apunta en
  `informes_comprados` si es `mode=payment`, está pagada, en `eur`, con `amount_total` igual al
  `unit_amount` del precio del informe (el mismo que cobra `crear-checkout`: secreto
  `STRIPE_PRICE_INFORME_UNICO` o `lookup_key` `informe_unico`) y con una sola línea de ese precio.
  Si no cuadra, no la apunta y deja en el log `webhook informe: pago NO registrado (<motivo>)`
  con la sesión y los importes. Sin precio configurado responde 500 (Stripe reintenta).
- Nuevo evento `charge.refunded`: relee el cargo y, si está reembolsado del todo, pone
  `reembolsado_en` en la fila de su `payment_intent` (o de su sesión, para las compras
  apuntadas antes de este cambio). Un reembolso parcial no revoca el informe (queda un aviso).
- La web (`web/js/informe.js`) ya no cuenta como comprado un informe con `reembolsado_en`.
- La lógica está en `supabase/functions/stripe-webhook/informe.mjs`, probada en
  `test/stripe_webhook.test.mjs`.

## Pasos

1. **Migración** `supabase/migrations/20261123100000_informes_reembolsos.sql` (añade
   `pago_proveedor_id` y `reembolsado_en`; idempotente, no cambia la RLS). Tiene que ir
   **antes** de publicar la web: la consulta de `informe.js` usa `reembolsado_en` y sin la
   columna fallaría y el informe pagado no se desbloquearía (hoy `informePago` está en `false`).
2. **Función** `stripe-webhook`: `supabase functions deploy stripe-webhook --no-verify-jwt`
   (sube también `informe.mjs`). `crear-checkout` no cambia.
3. **Stripe → Developers → Webhooks → el endpoint de `stripe-webhook`**: añadir el evento
   **`charge.refunded`** (en modo test y, cuando toque, en live). Si aún no está,
   `checkout.session.async_payment_succeeded`.
4. **Probar en modo test**: pagar el informe con la tarjeta de prueba → fila en
   `informes_comprados` con `pago_proveedor_id`; reembolsarlo desde el panel de Stripe →
   `reembolsado_en` con fecha y la web vuelve a pedir el pago. Reenviar el mismo evento desde
   Stripe no debe crear filas nuevas ni cambiar la fecha.

`web/config.js` (`informePrecio`) solo es el texto del botón: si cambia el precio en Stripe,
hay que cambiarlo también allí; el webhook toma el importe de Stripe.
