-- Espejo de las tablas "gold_*" del Lakehouse de Fabric de Decathlon
-- (LH_Deca_Negocio). Se sincronizan completas (no un resumen), vía un
-- Copy Job de Fabric que escribe directo acá (conexión Postgres por
-- pooler de Supabase) — ver conversación/README del proyecto.
--
-- Estas 14 tablas son exclusivas de Decathlon: cada cliente nuevo tiene su
-- propio set de tablas gold, con nombres propios (no comparten tabla ni
-- necesitan una columna de tenant como profile_id). Esto es más seguro que
-- un esquema multi-tenant compartido: un error de RLS en la tabla de un
-- cliente no puede filtrar datos de otro, porque ni están en la misma tabla.
--
-- El sync hace "copia completa" en cada corrida (no hay una clave natural
-- de fila única en varias de estas tablas), por eso no se define una
-- primary key propia más allá del id interno.

create table public.gold_meta_campanas (
  id uuid primary key default gen_random_uuid(),
  inicio_del_informe date,
  fin_del_informe date,
  nombre_de_la_campana text,
  entrega_de_la_campana text,
  resultados integer,
  indicador_de_resultado text,
  coste_por_resultados double precision,
  presupuesto_del_conjunto_de_anuncios integer,
  tipo_de_presupuesto_del_conjunto_de_anuncios text,
  importe_gastado_ars double precision,
  impresiones integer,
  alcance integer,
  frecuencia double precision,
  cpm_coste_por_1000_impresiones_ars double precision,
  compras integer,
  fin text,
  configuracion_de_atribucion text,
  roas_retorno_del_gasto_publicitario_de_compras double precision,
  valor_de_los_resultados double precision,
  indicador_de_valor_resultante text,
  resultados_iniciales text,
  indicador_de_resultados_inicial text,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_average_order_value_over_time (
  id uuid primary key default gen_random_uuid(),
  day date,
  gross_sales double precision,
  discounts integer,
  orders integer,
  average_order_value double precision,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_channel (
  id uuid primary key default gen_random_uuid(),
  referring_channel text,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_checkout_conversion_rate_over_time (
  id uuid primary key default gen_random_uuid(),
  day date,
  sessions_that_reached_checkout integer,
  sessions_that_completed_checkout integer,
  checkout_conversion_rate double precision,
  sessions_that_reached_and_completed_checkout integer,
  sessions integer,
  sessions_with_cart_additions integer,
  completed_checkout_rate double precision,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_conversion_rate_over_time (
  id uuid primary key default gen_random_uuid(),
  day date,
  referring_channel text,
  sessions integer,
  sessions_with_cart_additions integer,
  sessions_that_reached_checkout integer,
  sessions_that_completed_checkout integer,
  conversion_rate double precision,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_customer_behavior (
  id uuid primary key default gen_random_uuid(),
  customer_id bigint,
  customer_name text,
  customer_number_of_orders integer,
  day date,
  sessions_with_cart_additions integer,
  sessions_that_reached_checkout integer,
  sessions_that_completed_checkout integer,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_facturacion_inversion (
  id uuid primary key default gen_random_uuid(),
  tipo text,
  periodo bigint,
  plataforma double precision,
  universo double precision,
  monto bigint,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_new_vs_returning_customers (
  id uuid primary key default gen_random_uuid(),
  new_or_returning_customer text,
  day date,
  customers integer,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_objetivos (
  id uuid primary key default gen_random_uuid(),
  nombre_objetivo text,
  periodo bigint,
  plataforma text,
  objetivo double precision,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_orders_over_time (
  id uuid primary key default gen_random_uuid(),
  day date,
  order_referrer_name text,
  order_referrer_source text,
  referring_channel text,
  orders_last_click integer,
  quantity_ordered_per_order_last_click double precision,
  average_order_value_last_click double precision,
  reversed_quantity_last_click integer,
  synced_at timestamptz not null default now()
);

-- gold_shopify_sessions_by_referrer (sin "master") se borró acá y del sync
-- el 2026-10-27: pesaba 193 MB (43% de toda la base, pegada al límite de
-- 0,5 GB del plan Free) y era subconjunto de gold_shopify_sessions_by_referrer_master
-- (mismas columnas base, sin traffic_type/marketing_platform/session_device_type/
-- sessions_that_completed_checkout) — ningún reporte fijo la usaba, y el
-- asistente puede seguir preguntando lo mismo contra _master.

create table public.gold_shopify_sessions_by_referrer_master (
  id uuid primary key default gen_random_uuid(),
  referrer_source text,
  referrer_name text,
  session_city text,
  day date,
  referring_channel text,
  traffic_type text,
  marketing_platform text,
  online_store_visitors integer,
  sessions integer,
  bounce_rate double precision,
  bounces integer,
  sessions_that_completed_checkout integer,
  session_device_type text,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_sessions_by_session_device_type (
  id uuid primary key default gen_random_uuid(),
  session_device_type text,
  year date,
  month date,
  day date,
  hour timestamp,
  sessions integer,
  conversion_rate double precision,
  average_session_duration double precision,
  online_store_visitors integer,
  sessions_that_completed_checkout integer,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_time (
  id uuid primary key default gen_random_uuid(),
  fecha date,
  periodo integer,
  periodo_mes text,
  anio integer,
  mes integer,
  mes_nombre text,
  dia integer,
  trimestre integer,
  semana_anio integer,
  dia_anio integer,
  dia_semana_num integer,
  dia_semana_nombre text,
  es_fin_de_semana boolean,
  nombre_mes_anio text,
  periodo_abrev text,
  ultimo_periodo integer,
  synced_at timestamptz not null default now()
);

create table public.gold_shopify_total_sales_by_product (
  id uuid primary key default gen_random_uuid(),
  product_title text,
  product_vendor text,
  product_type text,
  product_variant_title text,
  day date,
  net_items_sold integer,
  gross_sales double precision,
  discounts double precision,
  sales_reversals double precision,
  net_sales double precision,
  taxes integer,
  total_sales double precision,
  new_or_returning_customer text,
  referring_channel text,
  synced_at timestamptz not null default now()
);

-- Índices por día en las tablas grandes que se filtran/cruzan por fecha
-- (el asistente de IA arma SQL ad-hoc contra estas tablas y sí puede
-- filtrar por rango de fechas, a diferencia de growth.ts que agrega todo
-- el histórico sin WHERE — ver las vistas materializadas más abajo para
-- ese caso). Las tablas chicas (<1000 filas) no los necesitan.
--
-- gold_shopify_sessions_by_referrer y gold_shopify_customer_behavior NO
-- tienen índice a propósito: ningún reporte fijo las usa (solo el
-- asistente, de vez en cuando) y juntas pesaban ~68 MB de índice — con el
-- proyecto pegado al límite de 0,5 GB del plan Free de Supabase, no valía
-- la pena. Si se upgradea a un plan con más espacio, se pueden volver a
-- crear igual que las demás.
create index concurrently if not exists idx_gold_shopify_sessions_by_referrer_master_day on public.gold_shopify_sessions_by_referrer_master (day);
create index concurrently if not exists idx_gold_shopify_total_sales_by_product_day on public.gold_shopify_total_sales_by_product (day);
create index concurrently if not exists idx_gold_shopify_sessions_by_session_device_type_day on public.gold_shopify_sessions_by_session_device_type (day);
create index concurrently if not exists idx_gold_shopify_conversion_rate_over_time_day on public.gold_shopify_conversion_rate_over_time (day);
create index concurrently if not exists idx_gold_shopify_orders_over_time_day on public.gold_shopify_orders_over_time (day);

-- Vistas materializadas de agregación diaria para /reportes/growth
-- (lib/reports/growth.ts): varias queries del dashboard escaneaban
-- gold_shopify_sessions_by_referrer_master (880k+ filas) y
-- gold_shopify_total_sales_by_product repetidas veces en cada carga de
-- página — medido, una sola de esas agregaciones sin filtrar tardaba ~7s.
-- Estas vistas agregan por día una sola vez; growth.ts lee de acá en vez
-- de las tablas crudas. Se refrescan en scripts/sync-gold.ts
-- (refreshGrowthRollups), una vez por día después del sync — no dependen
-- de RLS porque lib/supabase/pg.ts ya corre con una conexión que no la usa
-- (igual que el resto de las tablas gold_* leídas desde ese módulo).
create materialized view public.gold_shopify_sessions_daily_rollup as
select
  day,
  coalesce(referring_channel, 'N/A') as referring_channel,
  traffic_type,
  session_device_type,
  sum(sessions)::bigint as sessions,
  sum(bounces)::bigint as bounces,
  sum(sessions_that_completed_checkout)::bigint as sessions_that_completed_checkout
from public.gold_shopify_sessions_by_referrer_master
group by 1, 2, 3, 4;

create unique index idx_gold_shopify_sessions_daily_rollup_uniq
  on public.gold_shopify_sessions_daily_rollup (day, referring_channel, traffic_type, session_device_type);

create materialized view public.gold_shopify_sales_daily_rollup as
select
  day,
  coalesce(referring_channel, 'N/A') as referring_channel,
  coalesce(nullif(product_type, ''), 'N/A') as product_type,
  new_or_returning_customer,
  sum(total_sales)::numeric as total_sales,
  sum(net_items_sold)::bigint as net_items_sold
from public.gold_shopify_total_sales_by_product
group by 1, 2, 3, 4;

create unique index idx_gold_shopify_sales_daily_rollup_uniq
  on public.gold_shopify_sales_daily_rollup (day, referring_channel, product_type, new_or_returning_customer);

-- RLS: solo el usuario de Decathlon puede leer estas 15 tablas (son suyas
-- en exclusiva). El UUID es el de su fila en auth.users/profiles.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'gold_meta_campanas',
      'gold_shopify_average_order_value_over_time',
      'gold_shopify_channel',
      'gold_shopify_checkout_conversion_rate_over_time',
      'gold_shopify_conversion_rate_over_time',
      'gold_shopify_customer_behavior',
      'gold_shopify_facturacion_inversion',
      'gold_shopify_new_vs_returning_customers',
      'gold_shopify_objetivos',
      'gold_shopify_orders_over_time',
      'gold_shopify_sessions_by_referrer_master',
      'gold_shopify_sessions_by_session_device_type',
      'gold_shopify_time',
      'gold_shopify_total_sales_by_product'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Decathlon users can view" on public.%I for select using (auth.uid() = ''0d505e1a-267c-47d1-8c21-c81acef6d6db''::uuid)',
      t
    );
  end loop;
end $$;
