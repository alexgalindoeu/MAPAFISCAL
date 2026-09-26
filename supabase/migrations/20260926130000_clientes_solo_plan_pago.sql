-- =============================================================================
-- Mapafiscal · «Mis clientes» solo con un plan de pago activo (decisión de 2026-09-26)
--
-- Sustituye el plan gratuito de 3 clientes: sin plan de pago (perfiles.plan = 'gratis')
-- no se pueden ver, crear ni editar clientes. `perfiles.plan` solo lo cambia el webhook de
-- Stripe, y vuelve a 'gratis' cuando la suscripción termina: los clientes guardados se
-- conservan ocultos y reaparecen si el gestor se suscribe de nuevo. Mientras tanto puede
-- borrarlos con `public.borrar_mis_clientes()` (derecho de supresión, RGPD).
-- =============================================================================

-- ---- fuera el límite de clientes del plan gratuito -----------------------------------
drop trigger if exists clientes_limite_plan on public.clientes;
drop function if exists privado.comprobar_limite_clientes();
drop function if exists privado.limite_clientes(text);

-- ---- políticas de `clientes`: propio gestor Y plan de pago activo -----------------------
-- La subconsulta a `perfiles` pasa por su propia RLS (el usuario solo ve su fila).
drop policy "clientes: ver los propios" on public.clientes;
drop policy "clientes: crear los propios" on public.clientes;
drop policy "clientes: editar los propios" on public.clientes;
drop policy "clientes: borrar los propios" on public.clientes;

create policy "clientes: ver los propios con plan" on public.clientes
  for select to authenticated using (
    gestor_id = (select auth.uid())
    and exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.plan <> 'gratis'));
create policy "clientes: crear los propios con plan" on public.clientes
  for insert to authenticated with check (
    gestor_id = (select auth.uid())
    and exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.plan <> 'gratis'));
create policy "clientes: editar los propios con plan" on public.clientes
  for update to authenticated
  using (
    gestor_id = (select auth.uid())
    and exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.plan <> 'gratis'))
  with check (gestor_id = (select auth.uid()));
create policy "clientes: borrar los propios con plan" on public.clientes
  for delete to authenticated using (
    gestor_id = (select auth.uid())
    and exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.plan <> 'gratis'));

-- ---- sin plan: saber cuántos clientes hay guardados y poder borrarlos ---------------------
create function public.contar_mis_clientes()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.clientes where gestor_id = (select auth.uid());
$$;
comment on function public.contar_mis_clientes() is
  'Número de clientes guardados por el usuario, aunque estén ocultos por no tener plan.';

create function public.borrar_mis_clientes()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '42501';
  end if;
  delete from public.clientes where gestor_id = (select auth.uid());
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function public.borrar_mis_clientes() is
  'Borra todos los clientes del usuario (también los ocultos por no tener plan). Devuelve cuántos.';

revoke execute on function public.contar_mis_clientes() from public, anon;
revoke execute on function public.borrar_mis_clientes() from public, anon;
grant execute on function public.contar_mis_clientes() to authenticated;
grant execute on function public.borrar_mis_clientes() to authenticated;
