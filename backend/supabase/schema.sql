-- Tabelas exclusivas do prototipo; nenhum acesso direto por anon/authenticated.
create table public.agro_readings (
  id bigint generated always as identity primary key,
  event_id uuid not null unique,
  received_at timestamptz not null default now(),
  v smallint not null check (v = 1),
  node text not null check (node ~ '^[a-zA-Z0-9_-]{1,24}$'),
  seq bigint not null check (seq between 0 and 4294967295),
  uptime_ms bigint not null check (uptime_ms between 0 and 4294967295),
  temp_c real check (temp_c between -40 and 85),
  air_rh_pct real check (air_rh_pct between 0 and 100),
  pressure_hpa real check (pressure_hpa between 300 and 1100),
  soil_raw integer not null check (soil_raw between 0 and 4095),
  soil_enabled boolean not null,
  signal text not null check (signal in ('Muito próximo','Bom','Regular','Zona de limite','Crítico')),
  check (soil_enabled or soil_raw = 0)
);
create index agro_readings_node_time_idx on public.agro_readings (node, received_at desc);
create table public.agro_summaries (
  node text primary key,
  text text not null,
  model text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  sample_count integer not null check (sample_count > 0),
  generated_at timestamptz not null default now()
);
create table public.agro_summary_limits (node text primary key, requested_at timestamptz not null);
alter table public.agro_readings enable row level security;
alter table public.agro_summaries enable row level security;
alter table public.agro_summary_limits enable row level security;
revoke all on public.agro_readings, public.agro_summaries, public.agro_summary_limits from anon, authenticated;
grant select, insert on public.agro_readings to service_role;
grant select, insert, update on public.agro_summaries, public.agro_summary_limits to service_role;
grant usage, select on sequence public.agro_readings_id_seq to service_role;

create view public.agro_stations with (security_invoker = true) as
select distinct on (node) node, received_at, temp_c, air_rh_pct, pressure_hpa, soil_raw, soil_enabled, signal
from public.agro_readings order by node, received_at desc, id desc;
revoke all on public.agro_stations from anon, authenticated;
grant select on public.agro_stations to service_role;

-- Agrega no banco para limitar o grafico a aproximadamente 360 pontos por periodo.
create function public.agro_series(p_node text, p_hours integer)
returns table(received_at timestamptz, temp_c double precision, air_rh_pct double precision, pressure_hpa double precision, soil_raw double precision)
language sql stable security invoker set search_path = '' as $$
  select to_timestamp(floor(extract(epoch from r.received_at) / (p_hours * 10)) * (p_hours * 10)),
         avg(r.temp_c)::double precision, avg(r.air_rh_pct)::double precision, avg(r.pressure_hpa)::double precision,
         avg(case when r.soil_enabled then r.soil_raw end)::double precision
  from public.agro_readings r
  where p_hours in (1,6,24) and r.node = p_node and r.received_at >= now() - make_interval(hours => p_hours)
  group by 1 order by 1
$$;
revoke all on function public.agro_series(text, integer) from public, anon, authenticated;
grant execute on function public.agro_series(text, integer) to service_role;

-- Limite compartilhado entre todas as instancias Vercel, sem cache em memoria.
create function public.agro_claim_summary(p_node text) returns boolean
language sql volatile security invoker set search_path = '' as $$
  with claimed as (
    insert into public.agro_summary_limits(node, requested_at) values (p_node, now())
    on conflict (node) do update set requested_at = excluded.requested_at
    where agro_summary_limits.requested_at < now() - interval '1 minute'
    returning 1
  ) select exists(select 1 from claimed)
$$;
revoke all on function public.agro_claim_summary(text) from public, anon, authenticated;
grant execute on function public.agro_claim_summary(text) to service_role;
