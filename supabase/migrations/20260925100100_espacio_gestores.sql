-- =============================================================================
-- Mapafiscal · espacio de gestores (plan Gestor / Despacho)
--
-- Cada gestor ve y modifica SOLO sus propios clientes (RLS por auth.uid()).
-- El plan de cada cuenta lo decide el servidor (webhook de pagos), nunca el cliente.
-- Minimización de datos (RGPD): no se guarda NIF ni datos identificativos del cliente
-- más allá de un alias elegido por el gestor; el hogar es la entrada numérica del motor.
-- =============================================================================

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

-- ---- perfiles (1:1 con auth.users) ------------------------------------------
create table public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text check (char_length(nombre) <= 120),
  despacho   text check (char_length(despacho) <= 160),
  plan       text not null default 'gratis' check (plan in ('gratis', 'gestor', 'despacho')),
  creado_en  timestamptz not null default now()
);
comment on column public.perfiles.plan is
  'Lo actualiza el webhook de pagos (service_role). El usuario no puede cambiarlo.';

alter table public.perfiles enable row level security;
create policy "perfil: ver el propio" on public.perfiles
  for select to authenticated using (id = (select auth.uid()));
create policy "perfil: editar el propio" on public.perfiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- solo nombre y despacho son editables por el usuario (el plan no)
revoke update on public.perfiles from anon, authenticated;
grant update (nombre, despacho) on public.perfiles to authenticated;

-- alta automática del perfil al registrarse
create function privado.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function privado.crear_perfil();

-- ---- clientes -----------------------------------------------------------------
create table public.clientes (
  id             uuid primary key default gen_random_uuid(),
  gestor_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  alias          text not null check (char_length(alias) between 1 and 120),
  notas          text check (char_length(notas) <= 4000),
  ejercicio      smallint not null default 2025,
  territorio     text not null references public.territorios (codigo),
  hogar          jsonb not null check (jsonb_typeof(hogar) = 'object'),
  resultado      jsonb,                      -- última liquidación calculada en el navegador
  cuota_liquida  numeric(12, 2),             -- desnormalizado para listar y ordenar
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on table public.clientes is
  'Perfiles de cliente de cada gestor. `hogar` es la entrada del motor irpfsim (forma JS).';
create index clientes_gestor_idx on public.clientes (gestor_id, actualizado_en desc);

alter table public.clientes enable row level security;
create policy "clientes: ver los propios" on public.clientes
  for select to authenticated using (gestor_id = (select auth.uid()));
create policy "clientes: crear los propios" on public.clientes
  for insert to authenticated with check (gestor_id = (select auth.uid()));
create policy "clientes: editar los propios" on public.clientes
  for update to authenticated
  using (gestor_id = (select auth.uid())) with check (gestor_id = (select auth.uid()));
create policy "clientes: borrar los propios" on public.clientes
  for delete to authenticated using (gestor_id = (select auth.uid()));

create function privado.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger clientes_actualizado_en
  before update on public.clientes
  for each row execute function privado.tocar_actualizado_en();

-- Límite de clientes por plan. En el plan gratuito se permiten unos pocos perfiles de
-- prueba; Gestor y Despacho son ilimitados. Ajustable aquí (decisión de producto).
create function privado.limite_clientes(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan when 'gratis' then 3 else null end;
$$;

create function privado.comprobar_limite_clientes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan   text;
  v_limite integer;
  v_n      integer;
begin
  select plan into v_plan from public.perfiles where id = new.gestor_id;
  v_limite := privado.limite_clientes(coalesce(v_plan, 'gratis'));
  if v_limite is not null then
    select count(*) into v_n from public.clientes where gestor_id = new.gestor_id;
    if v_n >= v_limite then
      raise exception 'Has alcanzado el máximo de % clientes del plan gratuito.', v_limite
        using errcode = 'P0001', hint = 'Con el plan Gestor los clientes son ilimitados.';
    end if;
  end if;
  return new;
end;
$$;
create trigger clientes_limite_plan
  before insert on public.clientes
  for each row execute function privado.comprobar_limite_clientes();

-- ---- lista de espera (acceso anticipado a los planes de pago) -------------------
create table public.lista_espera (
  id        bigint generated always as identity primary key,
  email     text not null
            check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  plan      text not null check (plan in ('gestor', 'despacho')),
  origen    text check (char_length(origen) <= 60),
  creado_en timestamptz not null default now(),
  unique (email, plan)
);
comment on table public.lista_espera is
  'Solicitudes de acceso anticipado. Cualquiera puede apuntarse; nadie puede leerla desde la API.';
alter table public.lista_espera enable row level security;
create policy "lista de espera: apuntarse" on public.lista_espera
  for insert to anon, authenticated with check (true);
-- sin política de select: solo el service_role (panel de Supabase) la lee

-- ---- suscripciones (las escribe el webhook de pagos) ------------------------------
create table public.suscripciones (
  gestor_id              uuid primary key references auth.users (id) on delete cascade,
  plan                   text not null check (plan in ('gestor', 'despacho')),
  estado                 text not null
                         check (estado in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  proveedor              text not null default 'stripe',
  cliente_proveedor_id   text unique,
  suscripcion_proveedor_id text unique,
  periodo_fin            timestamptz,
  actualizado_en         timestamptz not null default now()
);
alter table public.suscripciones enable row level security;
create policy "suscripción: ver la propia" on public.suscripciones
  for select to authenticated using (gestor_id = (select auth.uid()));
-- sin insert/update/delete para usuarios: solo el service_role (Edge Function del webhook)
