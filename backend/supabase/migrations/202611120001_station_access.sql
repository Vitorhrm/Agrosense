-- Areas and field-specific agronomic criteria; users own their own records.
create table public.agro_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  crop text not null check (length(btrim(crop)) between 1 and 80),
  stage text check (length(stage) <= 80),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  soil_min numeric check (soil_min between 0 and 100),
  soil_max numeric check (soil_max between 0 and 100),
  soil_unit text check (soil_unit in ('vwc_pct', 'relative_index')),
  rain_min_mm numeric check (rain_min_mm between 0 and 1000),
  rain_window_hours numeric check (rain_window_hours between 1 and 168),
  kc numeric check (kc > 0 and kc <= 3),
  source text check (length(source) <= 300),
  conditions text check (length(conditions) <= 600),
  check ((latitude is null) = (longitude is null)),
  check ((soil_min is null and soil_max is null and soil_unit is null) or
         (soil_min is not null and soil_max is not null and soil_unit is not null and soil_min < soil_max)),
  check ((rain_min_mm is null) = (rain_window_hours is null)),
  check ((soil_min is null and rain_min_mm is null and kc is null) or
         (source is not null and length(btrim(source)) > 0 and
          conditions is not null and length(btrim(conditions)) > 0)),
  unique (user_id, id)
);

alter table public.agro_areas enable row level security;
revoke all on public.agro_areas from public, anon, authenticated;
grant select, delete on public.agro_areas to authenticated;
grant insert (name, crop, stage, latitude, longitude, soil_min, soil_max, soil_unit, rain_min_mm, rain_window_hours, kc, source, conditions),
  update (name, crop, stage, latitude, longitude, soil_min, soil_max, soil_unit, rain_min_mm, rain_window_hours, kc, source, conditions)
  on public.agro_areas to authenticated;
create policy agro_areas_own on public.agro_areas for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Grant signed-in users read access only to explicitly assigned stations.
create table public.agro_station_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  node text not null check (node ~ '^[a-zA-Z0-9_-]{1,24}$'),
  area_id uuid,
  dry_adc integer check (dry_adc between 0 and 4095),
  wet_adc integer check (wet_adc between 0 and 4095),
  check ((dry_adc is null and wet_adc is null) or
         (dry_adc is not null and wet_adc is not null and dry_adc <> wet_adc)),
  foreign key (user_id, area_id) references public.agro_areas (user_id, id) on delete set null (area_id),
  primary key (user_id, node)
);

alter table public.agro_station_access enable row level security;
revoke all on public.agro_station_access from public, anon, authenticated;
grant select, update (area_id, dry_adc, wet_adc) on public.agro_station_access to authenticated;
grant select, insert, update, delete on public.agro_station_access to service_role;

create policy agro_station_access_own on public.agro_station_access
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy agro_station_access_move_own on public.agro_station_access
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select (id, node, received_at, temp_c, air_rh_pct, pressure_hpa, soil_raw, soil_enabled, signal)
  on public.agro_readings to authenticated;

create policy agro_readings_assigned_station on public.agro_readings
  for select to authenticated
  using (node in (
    select access.node from public.agro_station_access access
    where access.user_id = (select auth.uid())
  ));
