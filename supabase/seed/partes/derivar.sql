
with p as (select (select string_agg(texto, '' order by parte) from privado.carga_params)::jsonb as params)
insert into public.territorios (codigo, nombre, regimen)
select t.key, t.value->>'nombre', t.value->>'regimen'
from p, jsonb_each(p.params->'territorios') t
on conflict (codigo) do update set nombre = excluded.nombre, regimen = excluded.regimen;

delete from public.ejercicios where ejercicio = 2025;   -- cascada a deducciones y pendientes

insert into public.ejercicios (ejercicio, generado, motor_version, params)
select 2025, (params->>'generado')::date, 'cdefded', params from (select (select string_agg(texto, '' order by parte) from privado.carga_params)::jsonb as params) p;

insert into public.deducciones (ejercicio, territorio, id, norma, tipo, estado, definicion)
select e.ejercicio, t.key, d->>'id', d->>'norma', d->>'tipo', coalesce(d->>'estado', 'confirmado'), d
from public.ejercicios e,
     jsonb_each(e.params->'territorios') t,
     jsonb_array_elements(coalesce(t.value->'deducciones_autonomicas'->'lista', '[]'::jsonb)) d
where e.ejercicio = 2025;

insert into public.deducciones_pendientes (ejercicio, territorio, id)
select e.ejercicio, t.key, pend #>> '{}'
from public.ejercicios e,
     jsonb_each(e.params->'territorios') t,
     jsonb_array_elements(coalesce(t.value->'deducciones_autonomicas'->'pendientes', '[]'::jsonb)) pend
where e.ejercicio = 2025 and jsonb_typeof(pend) = 'string' and left(pend #>> '{}', 1) <> '('
on conflict do nothing;

