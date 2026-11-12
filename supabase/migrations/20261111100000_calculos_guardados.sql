-- =============================================================================
-- Mapafiscal · cálculos guardados de cualquier cuenta, también la gratuita (2026-11-11)
--
-- «Guarda este cálculo» en la calculadora: cada usuario guarda sus propias situaciones
-- (el hogar, que es la entrada del motor, y un resumen del resultado) para retomarlas en otro
-- dispositivo o con otro ejercicio. A diferencia de `clientes` (plan Gestor), no exige plan.
--
-- Minimización (RGPD): solo un título que pone el usuario y los importes de la calculadora;
-- ni nombre ni NIF. Se borran con la cuenta (on delete cascade). Máximo 50 por cuenta.
-- La web detecta si la tabla existe: mientras no se aplique esta migración, no ofrece el botón.
-- =============================================================================

create table public.calculos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo         text not null check (char_length(titulo) between 1 and 120),
  ejercicio      smallint not null,
  territorio     text not null references public.territorios (codigo),
  hogar          jsonb not null check (jsonb_typeof(hogar) = 'object' and pg_column_size(hogar) <= 65536),
  resultado      jsonb check (resultado is null or jsonb_typeof(resultado) = 'object'),
  cuota_liquida  numeric(12, 2),
  creado_en      timestamptz not null default now()
);
comment on table public.calculos is
  'Cálculos guardados por cada usuario desde la calculadora. `hogar` es la entrada del motor irpfsim (forma JS).';
create index calculos_usuario_idx on public.calculos (usuario_id, creado_en desc);

alter table public.calculos enable row level security;
create policy "cálculos: ver los propios" on public.calculos
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy "cálculos: crear los propios" on public.calculos
  for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "cálculos: borrar los propios" on public.calculos
  for delete to authenticated using (usuario_id = (select auth.uid()));
-- sin UPDATE: un cálculo guardado no se edita, se guarda otro
revoke all on public.calculos from anon;
grant select, insert, delete on public.calculos to authenticated;

-- límite de 50 por cuenta (evita abusos de almacenamiento)
create function privado.limitar_calculos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.calculos where usuario_id = new.usuario_id) >= 50 then
    raise exception 'Has llegado al máximo de 50 cálculos guardados. Borra alguno para guardar más.'
      using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger calculos_limite
  before insert on public.calculos
  for each row execute function privado.limitar_calculos();
