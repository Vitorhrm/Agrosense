create table public.agro_crop_catalog (
  id text primary key,
  name text not null unique,
  kc_initial numeric(3,2) not null check (kc_initial between 0.01 and 3),
  kc_development numeric(3,2) not null check (kc_development between 0.01 and 3),
  kc_mid numeric(3,2) not null check (kc_mid between 0.01 and 3),
  kc_late numeric(3,2) not null check (kc_late between 0.01 and 3),
  source_url text not null
);

alter table public.agro_crop_catalog enable row level security;
revoke all on public.agro_crop_catalog from public, anon, authenticated;
grant select on public.agro_crop_catalog to authenticated;
create policy agro_crop_catalog_read on public.agro_crop_catalog for select to authenticated using (true);

-- FAO, Irrigation Water Management: Irrigation Water Needs, capítulo 3, tabela 8.
insert into public.agro_crop_catalog
select crop.*, 'https://www.fao.org/4/S2022E/s2022e07.htm'
from (values
  ('alface', 'Alface', 0.45, 0.60, 1.00, 0.90),
  ('batata', 'Batata', 0.45, 0.75, 1.15, 0.85),
  ('cebola', 'Cebola de bulbo seco', 0.50, 0.75, 1.05, 0.85),
  ('cenoura', 'Cenoura', 0.45, 0.75, 1.05, 0.90),
  ('feijao', 'Feijão para grão seco', 0.35, 0.70, 1.10, 0.30),
  ('milho', 'Milho para grão', 0.40, 0.80, 1.15, 0.70),
  ('pepino', 'Pepino', 0.45, 0.70, 0.90, 0.75),
  ('pimentao', 'Pimentão', 0.35, 0.70, 1.05, 0.90),
  ('soja', 'Soja', 0.35, 0.75, 1.10, 0.60),
  ('tomate', 'Tomate', 0.45, 0.75, 1.15, 0.80)
) as crop(id, name, kc_initial, kc_development, kc_mid, kc_late);
