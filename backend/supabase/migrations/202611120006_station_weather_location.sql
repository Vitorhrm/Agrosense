alter table public.agro_station_access
  add column latitude double precision,
  add column longitude double precision,
  add column area_linked_at timestamptz,
  add constraint agro_station_location_pair check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null
      and latitude between -90 and 90 and longitude between -180 and 180)
  );

grant update (latitude, longitude) on public.agro_station_access to authenticated;

create function public.agro_track_station_area_link() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.area_id is distinct from old.area_id then
    new.area_linked_at := case when new.area_id is not null then clock_timestamp() end;
  end if;
  return new;
end;
$$;
revoke all on function public.agro_track_station_area_link() from public, anon, authenticated;

create trigger agro_station_area_link
before insert or update of area_id on public.agro_station_access
for each row execute function public.agro_track_station_area_link();

-- Vínculos legados sem data vêm primeiro, com desempate estável pelo identificador.
create view public.agro_area_weather_station with (security_invoker = true) as
select distinct on (user_id, area_id) user_id, area_id, node, latitude, longitude
from public.agro_station_access
where area_id is not null
order by user_id, area_id, area_linked_at asc nulls first, node;

revoke all on public.agro_area_weather_station from public, anon, authenticated;
grant select on public.agro_area_weather_station to authenticated;
