-- Metadata only: Bluetooth Wi-Fi and LoRa credentials remain on the device.
create table public.agro_devices (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device_id text not null check (device_id ~ '^[0-9a-f]{12}$'),
  role text not null check (role in ('transmitter', 'receiver')),
  name text not null check (length(btrim(name)) between 1 and 80),
  area_id uuid,
  node text check (node ~ '^[a-zA-Z0-9_-]{1,24}$'),
  wifi_ssid text check (octet_length(wifi_ssid) <= 32),
  lora_ssid text check (octet_length(lora_ssid) <= 32),
  primary key (user_id, device_id),
  foreign key (user_id, area_id) references public.agro_areas (user_id, id) on delete set null (area_id)
);
alter table public.agro_devices enable row level security;
revoke all on public.agro_devices from public, anon, authenticated;
grant select, insert, update, delete on public.agro_devices to authenticated;
create policy agro_devices_own on public.agro_devices for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
