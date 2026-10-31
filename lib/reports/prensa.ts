import { queryReport } from "@/lib/supabase/pg";
import type { ClientSlug } from "@/lib/goldTables";

// gold_prensa_deca y gold_prensa_adecco tienen la misma estructura (mismo
// tipo de tabla en Fabric, un nombre por cliente para no pisarse en
// Supabase — ver lib/goldTables.ts). Mismo criterio que lib/reports/influencers.ts.
function tableFor(client: ClientSlug): string {
  return client === "deca" ? "gold_prensa_deca" : "gold_prensa_adecco";
}

// Filtros: $1 desde, $2 hasta, $3 industria, $4 campaña, $5 tipo de medio
// (cross-filter al hacer clic en una barra de "Repercusiones por tipo de
// medio"). Cada query usa el subconjunto que le aplica.
export type PrensaFilters = {
  desde: string | null;
  hasta: string | null;
  industria: string | null;
  campana: string | null;
  tipoMedio: string | null;
};

function filterParams(f: PrensaFilters) {
  return [f.desde, f.hasta, f.industria, f.campana, f.tipoMedio];
}

const WHERE_ALL = `
  where (CAST($1 AS DATE) IS NULL OR fecha >= CAST($1 AS DATE))
    and (CAST($2 AS DATE) IS NULL OR fecha <= CAST($2 AS DATE))
    and (CAST($3 AS TEXT) IS NULL OR industria = CAST($3 AS TEXT))
    and (CAST($4 AS TEXT) IS NULL OR campana = CAST($4 AS TEXT))
    and (CAST($5 AS TEXT) IS NULL OR tipo_de_medio = CAST($5 AS TEXT))
`;

// Misma idea que getFormatos en influencers.ts: la query que arma las
// barras de tipo de medio no se filtra a sí misma, para que las demás
// barras sigan pudiéndose clickear/destildar.
const WHERE_SIN_TIPO_MEDIO = `
  where (CAST($1 AS DATE) IS NULL OR fecha >= CAST($1 AS DATE))
    and (CAST($2 AS DATE) IS NULL OR fecha <= CAST($2 AS DATE))
    and (CAST($3 AS TEXT) IS NULL OR industria = CAST($3 AS TEXT))
    and (CAST($4 AS TEXT) IS NULL OR campana = CAST($4 AS TEXT))
    and (CAST($5 AS TEXT) IS NULL OR TRUE)
`;

export type Kpis = {
  marca: string | null;
  notas: number;
  medios: number;
  reach: number;
  vap: number;
  pct_gestion: number | null;
  pct_nacional: number | null;
  pct_organica: number | null;
  desde: string | null;
  hasta: string | null;
};

export async function getKpis(client: ClientSlug, f: PrensaFilters): Promise<Kpis | null> {
  const table = tableFor(client);
  const rows = await queryReport<Kpis>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select
      (select string_agg(distinct initcap(marca), ', ') from ${table}) marca,
      count(*)::int notas,
      count(distinct medio)::int medios,
      coalesce(sum(reach),0)::float8 reach,
      coalesce(sum(cpe_vap),0)::float8 vap,
      round((100.0*count(*) filter (where mencion_gestion = 'GESTIÓN')/nullif(count(*),0))::numeric,1)::float8 pct_gestion,
      round((100.0*count(*) filter (where nacional_o_interior = 'NACIONAL')/nullif(count(*),0))::numeric,1)::float8 pct_nacional,
      round((100.0*count(*) filter (where pago_organico = 'ORGÁNICA')/nullif(count(*),0))::numeric,1)::float8 pct_organica,
      to_char(min(fecha),'YYYY-MM-DD') desde,
      to_char(max(fecha),'YYYY-MM-DD') hasta
    from f`,
    filterParams(f),
  );
  return rows[0] ?? null;
}

export type SemanaRow = { semana: string; notas: number; reach: number };

export async function getEvolucionSemanal(client: ClientSlug, f: PrensaFilters): Promise<SemanaRow[]> {
  const table = tableFor(client);
  return queryReport<SemanaRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select to_char(date_trunc('week', fecha),'YYYY-MM-DD') semana,
      count(*)::int notas, coalesce(sum(reach),0)::float8 reach
    from f
    group by 1
    order by 1`,
    filterParams(f),
  );
}

export type TierRow = { tier: number; notas: number; reach: number; vap: number };

export async function getPorTier(client: ClientSlug, f: PrensaFilters): Promise<TierRow[]> {
  const table = tableFor(client);
  return queryReport<TierRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select tier::int tier, count(*)::int notas,
      coalesce(sum(reach),0)::float8 reach, coalesce(sum(cpe_vap),0)::float8 vap
    from f
    where tier is not null
    group by 1
    order by 1`,
    filterParams(f),
  );
}

export type NotaDestacada = {
  tema: string | null;
  medio: string;
  periodista: string | null;
  fecha: string | null;
  reach: number | null;
  vap: number | null;
  url: string | null;
};

export async function getNotasDestacadas(client: ClientSlug, f: PrensaFilters): Promise<NotaDestacada[]> {
  const table = tableFor(client);
  return queryReport<NotaDestacada>(
    `with f as (select * from ${table} ${WHERE_ALL}),
    ranked as (
      select *, row_number() over (partition by medio order by reach desc nulls last) rn
      from f
    )
    select tema, medio, periodista, to_char(fecha,'YYYY-MM-DD') fecha,
      reach::float8 reach, cpe_vap::float8 vap, hipervinculo url
    from ranked
    where rn = 1
    order by reach desc nulls last
    limit 8`,
    filterParams(f),
  );
}

export type TipoMedioRow = { tipo_de_medio: string; notas: number; reach: number };

export async function getPorTipoMedio(client: ClientSlug, f: PrensaFilters): Promise<TipoMedioRow[]> {
  const table = tableFor(client);
  return queryReport<TipoMedioRow>(
    `with f as (select * from ${table} ${WHERE_SIN_TIPO_MEDIO})
    select tipo_de_medio, count(*)::int notas, coalesce(sum(reach),0)::float8 reach
    from f
    where tipo_de_medio is not null
    group by 1
    order by notas desc`,
    filterParams(f),
  );
}

export type FormatoRow = { formato: string; notas: number; reach: number };

export async function getPorFormato(client: ClientSlug, f: PrensaFilters): Promise<FormatoRow[]> {
  const table = tableFor(client);
  return queryReport<FormatoRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select formato_contenido formato, count(*)::int notas, coalesce(sum(reach),0)::float8 reach
    from f
    where formato_contenido is not null
    group by 1
    order by notas desc`,
    filterParams(f),
  );
}

export type RankedRow = { nombre: string; notas: number; reach: number };

async function getTopDimension(client: ClientSlug, f: PrensaFilters, column: string, limit = 10): Promise<RankedRow[]> {
  const table = tableFor(client);
  return queryReport<RankedRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select ${column} nombre, count(*)::int notas, coalesce(sum(reach),0)::float8 reach
    from f
    where ${column} is not null
    group by 1
    order by notas desc, reach desc
    limit ${limit}`,
    filterParams(f),
  );
}

export const getTopVoceros = (client: ClientSlug, f: PrensaFilters) => getTopDimension(client, f, "vocero");
export const getTopMedios = (client: ClientSlug, f: PrensaFilters) => getTopDimension(client, f, "medio");
export const getTopPeriodistas = (client: ClientSlug, f: PrensaFilters) => getTopDimension(client, f, "periodista");

export type HeatCell = { semana: string; dow: number; notas: number };

export async function getActividad(client: ClientSlug, f: PrensaFilters): Promise<HeatCell[]> {
  const table = tableFor(client);
  return queryReport<HeatCell>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select to_char(date_trunc('week', fecha),'YYYY-MM-DD') semana,
      extract(isodow from fecha)::int dow, count(*)::int notas
    from f
    group by 1,2
    order by 1,2`,
    filterParams(f),
  );
}

export type NacionalInteriorRow = { tipo: string; notas: number; reach: number };

export async function getNacionalInterior(client: ClientSlug, f: PrensaFilters): Promise<NacionalInteriorRow[]> {
  const table = tableFor(client);
  return queryReport<NacionalInteriorRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select nacional_o_interior tipo, count(*)::int notas, coalesce(sum(reach),0)::float8 reach
    from f
    where nacional_o_interior is not null
    group by 1
    order by notas desc`,
    filterParams(f),
  );
}

export type ProvinciaRow = { provincia: string; notas: number; reach: number };

export async function getProvincias(client: ClientSlug, f: PrensaFilters): Promise<ProvinciaRow[]> {
  const table = tableFor(client);
  return queryReport<ProvinciaRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select provincia, count(*)::int notas, coalesce(sum(reach),0)::float8 reach
    from f
    where provincia is not null
    group by 1
    order by notas desc`,
    filterParams(f),
  );
}

export type IndustriaRow = { industria: string; notas: number; reach: number };

export async function getPorIndustria(client: ClientSlug, f: PrensaFilters): Promise<IndustriaRow[]> {
  const table = tableFor(client);
  return queryReport<IndustriaRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select industria, count(*)::int notas, coalesce(sum(reach),0)::float8 reach
    from f
    where industria is not null and industria <> 'NaN'
    group by 1
    order by notas desc`,
    filterParams(f),
  );
}

export type CampanaRow = { campana: string; notas: number; reach: number; vap: number };

export async function getPorCampana(client: ClientSlug, f: PrensaFilters): Promise<CampanaRow[]> {
  const table = tableFor(client);
  return queryReport<CampanaRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select campana, count(*)::int notas, coalesce(sum(reach),0)::float8 reach, coalesce(sum(cpe_vap),0)::float8 vap
    from f
    where campana is not null
    group by 1
    order by reach desc`,
    filterParams(f),
  );
}

export type GestionMencionRow = { tipo: string; notas: number };

export async function getGestionMencion(client: ClientSlug, f: PrensaFilters): Promise<GestionMencionRow[]> {
  const table = tableFor(client);
  return queryReport<GestionMencionRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select mencion_gestion tipo, count(*)::int notas
    from f
    where mencion_gestion in ('GESTIÓN','MENCIÓN')
    group by 1
    order by notas desc`,
    filterParams(f),
  );
}

export type OrganicaPagaRow = { tipo: string; notas: number };

export async function getOrganicaPaga(client: ClientSlug, f: PrensaFilters): Promise<OrganicaPagaRow[]> {
  const table = tableFor(client);
  return queryReport<OrganicaPagaRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select pago_organico tipo, count(*)::int notas
    from f
    where pago_organico is not null and pago_organico <> 'NaN'
    group by 1
    order by notas desc`,
    filterParams(f),
  );
}

export type VapTipoMedioRow = { tipo_de_medio: string; vap: number };

export async function getVapPorTipoMedio(client: ClientSlug, f: PrensaFilters): Promise<VapTipoMedioRow[]> {
  const table = tableFor(client);
  return queryReport<VapTipoMedioRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select tipo_de_medio, coalesce(sum(cpe_vap),0)::float8 vap
    from f
    where tipo_de_medio is not null
    group by 1
    order by vap desc`,
    filterParams(f),
  );
}

export type VapTierRow = { tier: number; vap: number };

export async function getVapPorTier(client: ClientSlug, f: PrensaFilters): Promise<VapTierRow[]> {
  const table = tableFor(client);
  return queryReport<VapTierRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select tier::int tier, coalesce(sum(cpe_vap),0)::float8 vap
    from f
    where tier is not null
    group by 1
    order by 1`,
    filterParams(f),
  );
}

export type DetalleRow = {
  id: string;
  fecha: string | null;
  tema: string | null;
  medio: string;
  periodista: string | null;
  vocero: string | null;
  reach: number | null;
  vap: number | null;
  url: string | null;
};

// El toggle "con/sin enlace" se aplica client-side sobre este mismo
// resultado (alcanza con mirar si "url" vino null) — no hace falta ir de
// nuevo al server para eso.
export async function getDetalle(client: ClientSlug, f: PrensaFilters): Promise<DetalleRow[]> {
  const table = tableFor(client);
  return queryReport<DetalleRow>(
    `with f as (select * from ${table} ${WHERE_ALL})
    select id::text id, to_char(fecha,'YYYY-MM-DD') fecha, tema, medio, periodista, vocero,
      reach::float8 reach, cpe_vap::float8 vap, hipervinculo url
    from f
    order by fecha desc nulls last`,
    filterParams(f),
  );
}

export type FiltroOpcion = { dimension: "industria" | "campana"; valor: string };

export async function getOpciones(client: ClientSlug): Promise<FiltroOpcion[]> {
  const table = tableFor(client);
  return queryReport<FiltroOpcion>(
    `select 'industria' dimension, industria valor from ${table} where industria is not null and industria <> 'NaN' group by 2
    union all
    select 'campana', campana from ${table} where campana is not null group by 2
    order by 1, 2`,
  );
}
