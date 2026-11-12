-- Historic readings and older transmitters have no source-calibrated index.
alter table public.agro_readings add column soil_index_pct real
  check (soil_index_pct is null or (soil_enabled and soil_index_pct between 0 and 100));
grant select (soil_index_pct) on public.agro_readings to authenticated;
