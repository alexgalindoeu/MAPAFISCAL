-- =============================================================================
-- Mapafiscal · datos de la suscripción para la pestaña «Perfil» (2026-09-26)
--
-- `suscripciones` guarda además el periodo de facturación y, si la suscripción no se va a
-- renovar, la fecha en que termina (o terminó) el acceso. Las dos columnas las escribe el
-- webhook de Stripe; el usuario solo las lee (política «suscripción: ver la propia»).
--
-- Al darse de alta con Google, el perfil toma el nombre de la cuenta de Google. El usuario
-- lo puede cambiar después (columna `nombre`, editable por el propio usuario).
-- =============================================================================

alter table public.suscripciones
  add column periodo    text check (periodo in ('semanal', 'mensual', 'anual')),
  add column termina_en timestamptz;
comment on column public.suscripciones.periodo is
  'Periodo de facturación del precio de Stripe (semanal, mensual o anual). Lo escribe el webhook.';
comment on column public.suscripciones.termina_en is
  'Fecha en que termina (o terminó) el acceso si la suscripción no se renueva; null si se renueva en periodo_fin.';

create or replace function privado.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name',
                                            new.raw_user_meta_data ->> 'name', '')), 120), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
