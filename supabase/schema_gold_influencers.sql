-- Espejo de influencers.gold_influencers (Lakehouse de Decathlon). Igual que
-- el resto de las tablas gold, es exclusiva de Decathlon — sin columna de
-- tenant, aislada por su propio nombre de tabla y su propia política de RLS.
--
-- "campana" y "presupuesto_anio_fiscal" vienen sin tilde/ñ a propósito (en
-- Fabric son "campaña" y "presupuesto_año_fiscal") — el sync las renombra al
-- copiar, para evitar líos de encoding en nombres de columna de Postgres.

create table public.gold_influencers (
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

alter table public.gold_influencers enable row level security;

create policy "Decathlon users can view" on public.gold_influencers
  for select using (auth.uid() = '0d505e1a-267c-47d1-8c21-c81acef6d6db'::uuid);
