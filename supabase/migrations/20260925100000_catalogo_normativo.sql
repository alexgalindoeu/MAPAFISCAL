-- =============================================================================
-- Mapafiscal · catálogo normativo (lectura pública)
--
-- Fuente de verdad: params/<ejercicio>/*.yaml del repositorio. Estas tablas son una
-- copia consultable que se regenera con `tools/sincronizar_supabase.R`; nunca se
-- editan a mano. Solo el rol de servicio (migraciones / sincronización) escribe.
-- =============================================================================

create table public.ejercicios (
  ejercicio      smallint primary key check (ejercicio between 2020 and 2100),
  generado       date        not null,
  motor_version  text,                       -- commit del repositorio que generó los params
  params         jsonb       not null,       -- params.json completo que consume irpfsim.js
  actualizado_en timestamptz not null default now()
);
comment on table public.ejercicios is
  'Parámetros normativos por ejercicio (params.json del motor). Copia de params/<ejercicio>/*.yaml.';

create table public.territorios (
  codigo  text primary key check (codigo ~ '^ES-[A-Z]{2}(-[A-Z]{2})?$'),
  nombre  text not null,
  regimen text not null check (regimen in ('comun', 'foral_pais_vasco', 'foral_navarra'))
);
comment on table public.territorios is
  'Los 19 territorios fiscales: 15 CCAA de régimen común, 3 Territorios Históricos vascos y Navarra.';

create table public.deducciones (
  ejercicio  smallint not null references public.ejercicios (ejercicio) on delete cascade,
  territorio text     not null references public.territorios (codigo),
  id         text     not null,
  norma      text,
  tipo       text     not null,
  estado     text     not null default 'confirmado'
             check (estado in ('confirmado', 'provisional', 'pendiente')),
  definicion jsonb    not null,             -- entrada completa del DSL (params/…/autonomico.yaml)
  primary key (ejercicio, territorio, id)
);
comment on table public.deducciones is
  'Deducciones autonómicas modeladas por el motor, una fila por entrada del DSL.';

create table public.deducciones_pendientes (
  ejercicio  smallint not null references public.ejercicios (ejercicio) on delete cascade,
  territorio text     not null references public.territorios (codigo),
  id         text     not null,
  nota       text,
  primary key (ejercicio, territorio, id)
);
comment on table public.deducciones_pendientes is
  'Deducciones del catálogo oficial todavía no modeladas (campo `pendientes` del YAML).';

create index deducciones_territorio_idx on public.deducciones (territorio, ejercicio);
create index deducciones_pendientes_territorio_idx on public.deducciones_pendientes (territorio, ejercicio);

-- Resumen de cobertura por territorio y ejercicio
create view public.cobertura_deducciones
with (security_invoker = on) as
select t.codigo as territorio,
       t.nombre,
       t.regimen,
       e.ejercicio,
       count(d.id) filter (where d.estado = 'confirmado')  as confirmadas,
       count(d.id) filter (where d.estado = 'provisional') as provisionales,
       (select count(*) from public.deducciones_pendientes p
         where p.territorio = t.codigo and p.ejercicio = e.ejercicio) as pendientes
from public.territorios t
cross join public.ejercicios e
left join public.deducciones d on d.territorio = t.codigo and d.ejercicio = e.ejercicio
group by t.codigo, t.nombre, t.regimen, e.ejercicio;

-- RLS: lectura pública, sin políticas de escritura (solo service_role escribe)
alter table public.ejercicios             enable row level security;
alter table public.territorios            enable row level security;
alter table public.deducciones            enable row level security;
alter table public.deducciones_pendientes enable row level security;

create policy "catálogo: lectura pública" on public.ejercicios
  for select to anon, authenticated using (true);
create policy "catálogo: lectura pública" on public.territorios
  for select to anon, authenticated using (true);
create policy "catálogo: lectura pública" on public.deducciones
  for select to anon, authenticated using (true);
create policy "catálogo: lectura pública" on public.deducciones_pendientes
  for select to anon, authenticated using (true);

grant select on public.cobertura_deducciones to anon, authenticated;
