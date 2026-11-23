-- =============================================================================
-- Mapafiscal · reembolsos del informe completo (2026-11-23)
--
-- stripe-webhook guarda ahora el payment_intent de cada pago único (para enlazar el evento
-- charge.refunded con su fila) y, si el cargo se reembolsa del todo, la fecha del reembolso.
-- Un informe con reembolsado_en no está comprado: la web (js/informe.js) solo cuenta las
-- filas con reembolsado_en vacío.
--
-- Idempotente. No cambia la RLS: cada usuario sigue leyendo solo las suyas y, sin políticas
-- de insert/update/delete, solo el service_role (el webhook) escribe.
-- =============================================================================

alter table public.informes_comprados
  add column if not exists pago_proveedor_id text,          -- payment_intent de Stripe
  add column if not exists reembolsado_en    timestamptz;   -- null = vigente

comment on column public.informes_comprados.pago_proveedor_id is
  'payment_intent de Stripe del pago; enlaza charge.refunded con la compra.';
comment on column public.informes_comprados.reembolsado_en is
  'Fecha del reembolso total (charge.refunded). Si no es null, el informe deja de estar desbloqueado.';

create index if not exists informes_comprados_pago
  on public.informes_comprados (pago_proveedor_id);

-- Por si acaso: la RLS sigue activa (no-op si ya lo está).
alter table public.informes_comprados enable row level security;
