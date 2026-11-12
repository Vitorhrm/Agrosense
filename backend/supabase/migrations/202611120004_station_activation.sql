create schema if not exists agro_private;
revoke all on schema agro_private from public, anon;
grant usage on schema agro_private to authenticated;

create table agro_private.station_activation (
  node text primary key check (node ~ '^[a-zA-Z0-9_-]{1,24}$'),
  code_hash bytea not null,
  expires_at timestamptz not null
);
alter table agro_private.station_activation enable row level security;
revoke all on agro_private.station_activation from public, anon, authenticated;

-- Only the holder of an unexpired code can insert access for their own account.
create function agro_private.activate_station(p_node text, p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
begin
  if account_id is null or p_node is null or p_code is null
    or p_node !~ '^[a-zA-Z0-9_-]{1,24}$' or p_code !~ '^[a-f0-9]{32}$' then
    return false;
  end if;

  delete from agro_private.station_activation
  where node = p_node and expires_at > pg_catalog.now()
    and code_hash = pg_catalog.sha256(pg_catalog.convert_to(p_code, 'UTF8'));
  if not found then
    return false;
  end if;

  insert into public.agro_station_access (user_id, node)
  values (account_id, p_node) on conflict do nothing;
  return true;
end;
$$;

revoke all on function agro_private.activate_station(text, text) from public, anon, authenticated;
grant execute on function agro_private.activate_station(text, text) to authenticated;

create function public.agro_activate_station(p_node text, p_code text)
returns boolean language sql security invoker set search_path = '' as $$
  select agro_private.activate_station(p_node, p_code);
$$;

revoke all on function public.agro_activate_station(text, text) from public, anon, authenticated;
grant execute on function public.agro_activate_station(text, text) to authenticated;
