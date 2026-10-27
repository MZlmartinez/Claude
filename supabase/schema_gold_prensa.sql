-- Espejo de prensa.gold_prensa, uno por cliente (cada uno en su propio
-- Lakehouse en Fabric, con la misma estructura). Se distinguen con un
-- sufijo de cliente en el nombre destino de Supabase — gold_prensa existe
-- igual en los dos Lakehouse, así que sin el sufijo se pisarían al
-- sincronizar los dos al mismo schema public (ver lib/goldTables.ts,
-- sourceTableOverrides). Sin columna de tenant: cada tabla sigue siendo
-- exclusiva de un cliente, aislada por su propio nombre.
--
-- "campana" y "mencion_gestion" vienen sin tilde/ñ a propósito (en Fabric
-- son "campaña" y "mención_gestión") — el sync las renombra al copiar,
-- mismo patrón que gold_influencers. El "id" float que trae Fabric queda
-- afuera del todo (ni se pide ni se guarda) — no lo necesitamos igual,
-- Postgres genera su propio uuid (ver lib/goldTables.ts,
-- selectColumnsOverrides).

create table public.gold_prensa_adecco (
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

alter table public.gold_prensa_adecco enable row level security;

-- Sin policy de SELECT todavía a propósito: ninguna página del portal lee
-- esta tabla todavía (el switch de auth.uid() por cliente para reportes es
-- trabajo aparte, pendiente). RLS queda prendido y deny-all hasta que se
-- resuelva quién puede leer los datos de Adecco — el sync igual puede
-- escribir porque corre con la service_role key, que ignora RLS.

-- Misma estructura, Lakehouse de Decathlon.
create table public.gold_prensa_deca (
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

alter table public.gold_prensa_deca enable row level security;
