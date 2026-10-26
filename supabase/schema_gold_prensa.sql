-- Espejo de prensa.gold_prensa (Lakehouse LH_Adecco en Fabric). Primer
-- cliente nuevo después de Decathlon: misma lógica de aislamiento, una
-- tabla propia sin columna de tenant.
--
-- "campana" y "mencion_gestion" vienen sin tilde/ñ a propósito (en Fabric
-- son "campaña" y "mención_gestión") — el sync las renombra al copiar,
-- mismo patrón que gold_influencers. El "id" float que trae Fabric queda
-- afuera del todo (ni se pide ni se guarda) — no lo necesitamos igual,
-- Postgres genera su propio uuid (ver lib/goldTables.ts,
-- selectColumnsOverrides).

create table public.gold_prensa (
  id uuid primary key default gen_random_uuid(),
  cliente text,
  marca text,
  fecha timestamp,
  tier bigint,
  medio text,
  tipo_de_medio text,
  periodista text,
  vocero text,
  formato_contenido text,
  nacional_o_interior text,
  provincia text,
  industria text,
  campana text,
  tema text,
  tono text,
  mencion_gestion text,
  pago_organico text,
  inversion double precision,
  reach bigint,
  cpe_vap bigint,
  link_a_nota text,
  hipervinculo text,
  synced_at timestamptz not null default now()
);

alter table public.gold_prensa enable row level security;

-- Sin policy de SELECT todavía a propósito: ninguna página del portal lee
-- esta tabla todavía (el switch de auth.uid() por cliente para reportes es
-- trabajo aparte, pendiente). RLS queda prendido y deny-all hasta que se
-- resuelva quién puede leer los datos de Adecco — el sync igual puede
-- escribir porque corre con la service_role key, que ignora RLS.
