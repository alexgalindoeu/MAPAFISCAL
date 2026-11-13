-- =============================================================================
-- Mapafiscal · pagos únicos del informe completo (2026-11-12)
--
-- El informe completo de la declaración (PDF) se desbloquea con un plan de pago, con un
-- anuncio bonificado o con un pago único de 1,99 € (IVA incluido) por ejercicio. Esta tabla
-- guarda los pagos únicos: la escribe solo el webhook de Stripe (service_role) y cada usuario
-- lee las suyas. No guarda datos de la declaración: el informe se calcula en el navegador.
-- En la web está tras el interruptor `informePago` de web/config.js.
-- =============================================================================

create table public.informes_comprados (
  id                   bigint generated always as identity primary key,
  usuario_id           uuid not null references auth.users (id) on delete cascade,
  ejercicio            smallint not null check (ejercicio between 2020 and 2100),
  sesion_proveedor_id  text not null unique,          -- id de la sesión de Stripe Checkout
  importe_centimos     integer,
  moneda               text,
  creado_en            timestamptz not null default now()
);
comment on table public.informes_comprados is
  'Pagos únicos del informe completo (Stripe Checkout, lookup_key informe_unico). Solo los escribe stripe-webhook.';
create index informes_comprados_usuario on public.informes_comprados (usuario_id, ejercicio);

alter table public.informes_comprados enable row level security;
create policy "informes comprados: ver los propios" on public.informes_comprados
  for select to authenticated using (usuario_id = (select auth.uid()));
-- sin políticas de insert/update/delete: solo el service_role (webhook)
