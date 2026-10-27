-- Espejo de influencers.gold_influencers, uno por cliente (cada uno en su
-- propio Lakehouse en Fabric, con la misma estructura). Se distinguen con
-- un sufijo de cliente en el nombre destino de Supabase — gold_influencers
-- existe igual en los dos Lakehouse, así que sin el sufijo se pisarían al
-- sincronizar los dos al mismo schema public (ver lib/goldTables.ts,
-- sourceTableOverrides). Sin columna de tenant: cada tabla sigue siendo
-- exclusiva de un cliente, aislada por su propio nombre.
--
-- "campana" y "presupuesto_anio_fiscal" vienen sin tilde/ñ a propósito (en
-- Fabric son "campaña" y "presupuesto_año_fiscal") — el sync las renombra
-- al copiar, para evitar líos de encoding en nombres de columna de Postgres.

create table public.gold_influencers_deca (
  id uuid primary key default gen_random_uuid(),
  empresa text,
  marca text,
  campana text,
  presupuesto_anio_fiscal double precision,
  periodo_desde timestamp,
  periodo_hasta timestamp,
  objetivo text,
  influencer text,
  territorio text,
  engagement_rate_ig double precision,
  engagement_rate_tik_tok double precision,
  instagram bigint,
  tiktok double precision,
  clipping text,
  presupuesto bigint,
  presupuesto_usd double precision,
  press_kit bigint,
  costos_extras bigint,
  scope_acordado_tipo text,
  scope_acrodado_numero double precision,
  scope_recibido_tipo text,
  fecha_contenido double precision,
  scope_recibido_numero bigint,
  alcance double precision,
  visualizaciones double precision,
  impresiones double precision,
  comentarios double precision,
  likes double precision,
  shares double precision,
  guardados double precision,
  click_a_arroba double precision,
  synced_at timestamptz not null default now()
);

alter table public.gold_influencers_deca enable row level security;

create policy "Decathlon users can view" on public.gold_influencers_deca
  for select using (auth.uid() = '0d505e1a-267c-47d1-8c21-c81acef6d6db'::uuid);

-- Misma estructura, Lakehouse de Adecco. Sin policy de SELECT todavía a
-- propósito: ninguna página del portal la lee aún (lib/reports/influencers.ts
-- sigue leyendo solo la de Decathlon) — RLS queda prendido y deny-all hasta
-- que se generalice esa página o se arme una para Adecco.
create table public.gold_influencers_adecco (
  id uuid primary key default gen_random_uuid(),
  empresa text,
  marca text,
  campana text,
  presupuesto_anio_fiscal double precision,
  periodo_desde timestamp,
  periodo_hasta timestamp,
  objetivo text,
  influencer text,
  territorio text,
  engagement_rate_ig double precision,
  engagement_rate_tik_tok double precision,
  instagram bigint,
  tiktok double precision,
  clipping text,
  presupuesto bigint,
  presupuesto_usd double precision,
  press_kit bigint,
  costos_extras bigint,
  scope_acordado_tipo text,
  scope_acrodado_numero double precision,
  scope_recibido_tipo text,
  fecha_contenido double precision,
  scope_recibido_numero bigint,
  alcance double precision,
  visualizaciones double precision,
  impresiones double precision,
  comentarios double precision,
  likes double precision,
  shares double precision,
  guardados double precision,
  click_a_arroba double precision,
  synced_at timestamptz not null default now()
);

alter table public.gold_influencers_adecco enable row level security;
