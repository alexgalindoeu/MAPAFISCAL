-- =============================================================================
-- Mapafiscal · constancia de la aceptación de las condiciones (2026-09-27)
--
-- La casilla del diálogo de acceso («Uso Mapafiscal para mi actividad profesional, acepto las
-- Condiciones y he leído la Política de privacidad») se guarda en el perfil: qué versión de las
-- condiciones aceptó el usuario y cuándo (art. 5.4 de la Ley 7/1998, de condiciones generales
-- de la contratación). La versión vigente es `condicionesVersion` en web/config.js; si la
-- guardada es otra, la web vuelve a pedir la casilla.
--
-- El usuario no escribe estas columnas directamente (no tiene permiso de UPDATE sobre ellas):
-- solo a través de `aceptar_condiciones()`, que pone la fecha del servidor.
-- =============================================================================

alter table public.perfiles
  add column condiciones_version     text check (char_length(condiciones_version) <= 40),
  add column condiciones_aceptadas_en timestamptz;
comment on column public.perfiles.condiciones_version is
  'Versión de las condiciones que aceptó el usuario (condicionesVersion de web/config.js).';
comment on column public.perfiles.condiciones_aceptadas_en is
  'Cuándo la aceptó (hora del servidor). Solo la escribe public.aceptar_condiciones().';

create function public.aceptar_condiciones(p_version text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ahora timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '42501';
  end if;
  if p_version is null or char_length(p_version) not between 1 and 40 then
    raise exception 'Versión de las condiciones no válida.' using errcode = '22023';
  end if;
  update public.perfiles
     set condiciones_version = p_version, condiciones_aceptadas_en = v_ahora
   where id = (select auth.uid());
  return v_ahora;
end;
$$;
comment on function public.aceptar_condiciones(text) is
  'Guarda en el perfil del usuario la versión de las condiciones aceptada y la hora del servidor.';

revoke execute on function public.aceptar_condiciones(text) from public, anon;
grant execute on function public.aceptar_condiciones(text) to authenticated;
