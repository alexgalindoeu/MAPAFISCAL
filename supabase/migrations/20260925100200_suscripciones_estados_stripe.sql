-- Todos los estados de suscripción que puede enviar Stripe (si no, el webhook fallaría
-- con 500 y Stripe reintentaría indefinidamente).
alter table public.suscripciones drop constraint suscripciones_estado_check;
alter table public.suscripciones add constraint suscripciones_estado_check
  check (estado in ('trialing', 'active', 'past_due', 'canceled', 'incomplete',
                    'incomplete_expired', 'unpaid', 'paused'));
