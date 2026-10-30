import { queryReport } from "@/lib/supabase/pg";
import type { ClientSlug } from "@/lib/goldTables";

// gold_influencers_deca y gold_influencers_adecco tienen la misma
// estructura (mismo Lakehouse en Fabric, un nombre por cliente para no
// pisarse en Supabase — ver lib/goldTables.ts) — alcanza con elegir la
// tabla según el cliente resuelto, el resto de las queries es idéntico.
function tableFor(client: ClientSlug): string {
  return client === "deca" ? "gold_influencers_deca" : "gold_influencers_adecco";
}

// Filtros: $1 campaña, $2 territorio, $3 influencer, $4 formato (scope_recibido_tipo).
// Cada consulta usa solo el subconjunto que le aplica — el resto queda sin
// referenciar en el texto SQL, así que pasar los 4 siempre es seguro.
export type InfluencerFilters = {
  campana: string | null;
  territorio: string | null;
  influencer: string | null;
  formato: string | null;
};

function filterParams(f: InfluencerFilters) {
  return [f.campana, f.territorio, f.influencer, f.formato];
}

export type Kpis = {
  marca: string | null;
  contratos: number;
  influencers: number;
  territorios: number;
  piezas: number;
  con_metricas: number;
  inversion: number;
  visualizaciones: number;
  alcance: number;
  interacciones: number;
  tasa_interaccion: number | null;
  costo_mil_vistas: number | null;
  desde: string | null;
  hasta: string | null;
};

export async function getKpis(client: ClientSlug, f: InfluencerFilters): Promise<Kpis | null> {
  const table = tableFor(client);
  const rows = await queryReport<Kpis>(
    `with f as (
      select * from ${table}
      where (CAST($1 AS TEXT) IS NULL OR campana = CAST($1 AS TEXT))
        and (CAST($2 AS TEXT) IS NULL OR territorio = CAST($2 AS TEXT))
        and (CAST($3 AS TEXT) IS NULL OR influencer = CAST($3 AS TEXT))
        and (CAST($4 AS TEXT) IS NULL OR scope_recibido_tipo = CAST($4 AS TEXT))
    ), k as (
      select campana, influencer, max(presupuesto)::float8 fee from f group by 1,2
    )
    select
      (select string_agg(distinct initcap(marca), ', ') from ${table}) marca,
      (select count(*) from k)::int contratos,
      count(distinct influencer)::int influencers,
      count(distinct territorio)::int territorios,
      count(*)::int piezas,
      (count(*) filter (where coalesce(visualizaciones,0) > 0))::int con_metricas,
      (select coalesce(sum(fee),0) from k) inversion,
      coalesce(sum(visualizaciones),0)::float8 visualizaciones,
      coalesce(sum(alcance),0)::float8 alcance,
      coalesce(sum((coalesce(likes,0)+coalesce(comentarios,0)+coalesce(shares,0)+coalesce(guardados,0))),0)::float8 interacciones,
      round((100*sum((coalesce(likes,0)+coalesce(comentarios,0)+coalesce(shares,0)+coalesce(guardados,0)))/nullif(sum(visualizaciones),0))::numeric,2)::float8 tasa_interaccion,
      round(((select sum(fee) from k)*1000/nullif(sum(visualizaciones),0))::numeric,0)::float8 costo_mil_vistas,
      to_char(min(periodo_desde),'YYYY-MM-DD') desde,
      to_char(max(periodo_hasta),'YYYY-MM-DD') hasta
    from f`,
    filterParams(f),
  );
  return rows[0] ?? null;
}

export type CampanaRow = {
  campana: string;
  contratos: number;
  inversion: number;
  piezas: number;
  visualizaciones: number;
  interacciones: number;
  costo_mil_vistas: number | null;
};

export async function getCampanas(client: ClientSlug, f: InfluencerFilters): Promise<CampanaRow[]> {
  const table = tableFor(client);
  return queryReport<CampanaRow>(
    `with f as (
      select * from ${table}
      where (CAST($2 AS TEXT) IS NULL OR territorio = CAST($2 AS TEXT))
        and (CAST($3 AS TEXT) IS NULL OR influencer = CAST($3 AS TEXT))
        and (CAST($4 AS TEXT) IS NULL OR scope_recibido_tipo = CAST($4 AS TEXT))
        and (CAST($1 AS TEXT) IS NULL OR TRUE)
    ), k as (
      select campana, influencer, max(presupuesto)::float8 fee from f group by 1,2
    ), p as (
      select campana, count(*)::int piezas,
        coalesce(sum(visualizaciones),0)::float8 visualizaciones,
        coalesce(sum((coalesce(likes,0)+coalesce(comentarios,0)+coalesce(shares,0)+coalesce(guardados,0))),0)::float8 interacciones
      from f group by 1
    )
    select k.campana, count(*)::int contratos, sum(fee) inversion, max(p.piezas) piezas,
      max(p.visualizaciones) visualizaciones, max(p.interacciones) interacciones,
      round((sum(fee)*1000/nullif(max(p.visualizaciones),0))::numeric,0)::float8 costo_mil_vistas
    from k join p using (campana)
    group by k.campana
    order by inversion desc`,
    filterParams(f),
  );
}

export type FormatoRow = {
  formato: string;
  piezas: number;
  con_metricas: number;
  visualizaciones: number;
  alcance: number;
  interacciones: number;
  tasa: number | null;
  guardados: number;
  shares: number;
  clics: number;
  vis_promedio: number | null;
};

export async function getFormatos(client: ClientSlug, f: InfluencerFilters): Promise<FormatoRow[]> {
  const table = tableFor(client);
  return queryReport<FormatoRow>(
    `with f as (
      select * from ${table}
      where (CAST($1 AS TEXT) IS NULL OR campana = CAST($1 AS TEXT))
        and (CAST($2 AS TEXT) IS NULL OR territorio = CAST($2 AS TEXT))
        and (CAST($3 AS TEXT) IS NULL OR influencer = CAST($3 AS TEXT))
        and (CAST($4 AS TEXT) IS NULL OR TRUE)
    )
    select coalesce(scope_recibido_tipo,'TODOS') formato,
      count(*)::int piezas,
      (count(*) filter (where coalesce(visualizaciones,0) > 0))::int con_metricas,
      coalesce(sum(visualizaciones),0)::float8 visualizaciones,
      coalesce(sum(alcance),0)::float8 alcance,
      coalesce(sum((coalesce(likes,0)+coalesce(comentarios,0)+coalesce(shares,0)+coalesce(guardados,0))),0)::float8 interacciones,
      round((100*sum((coalesce(likes,0)+coalesce(comentarios,0)+coalesce(shares,0)+coalesce(guardados,0)))/nullif(sum(visualizaciones),0))::numeric,2)::float8 tasa,
      coalesce(sum(guardados),0)::float8 guardados,
      coalesce(sum(shares),0)::float8 shares,
      coalesce(sum(click_a_arroba),0)::float8 clics,
      round((sum(visualizaciones)/nullif(count(*) filter (where coalesce(visualizaciones,0) > 0),0))::numeric,0)::float8 vis_promedio
    from f
    group by grouping sets ((scope_recibido_tipo), ())
    order by coalesce(array_position(array['REEL','STORIE','PRESENCIA','TIKTOK']::text[], scope_recibido_tipo), 0)`,
    filterParams(f),
  );
}

export type InfluencerRow = {
  influencer: string;
  territorio: string | null;
  campanas: string | null;
  contratos: number;
  inversion: number;
  piezas: number;
  con_metricas: number;
  visualizaciones: number;
  alcance: number;
  interacciones: number;
  tasa: number | null;
  costo_mil_vistas: number | null;
  costo_por_interaccion: number | null;
  rank_costo_interaccion: number | null;
  rank_tasa: number | null;
  rank_costo_mil_vistas: number | null;
  ranking_promedio: number | null;
  // Dato propio del influencer (no de una pieza puntual) — constante entre
  // sus piezas, por eso basta con max() para traerlo sin duplicar filas.
  seguidores_ig: number | null;
  seguidores_tiktok: number | null;
  er_ig: number | null;
};

export async function getInfluencers(client: ClientSlug, f: InfluencerFilters): Promise<InfluencerRow[]> {
  const table = tableFor(client);
  return queryReport<InfluencerRow>(
    `with f as (
      select * from ${table}
      where (CAST($1 AS TEXT) IS NULL OR campana = CAST($1 AS TEXT))
        and (CAST($2 AS TEXT) IS NULL OR territorio = CAST($2 AS TEXT))
        and (CAST($4 AS TEXT) IS NULL OR scope_recibido_tipo = CAST($4 AS TEXT))
        and (CAST($3 AS TEXT) IS NULL OR TRUE)
    ), k as (
      select influencer, campana, max(presupuesto)::float8 fee from f group by 1,2
    ), kk as (
      select influencer, sum(fee) inversion, count(*)::int contratos from k group by 1
    ), m as (
      select influencer, max(territorio) territorio, string_agg(distinct campana, ', ') campanas,
        count(*)::int piezas,
        (count(*) filter (where coalesce(visualizaciones,0) > 0))::int con_metricas,
        coalesce(sum(visualizaciones),0)::float8 visualizaciones,
        coalesce(sum(alcance),0)::float8 alcance,
        coalesce(sum((coalesce(likes,0)+coalesce(comentarios,0)+coalesce(shares,0)+coalesce(guardados,0))),0)::float8 interacciones,
        max(instagram)::float8 seguidores_ig,
        max(tiktok)::float8 seguidores_tiktok,
        max(engagement_rate_ig)::float8 er_ig
      from f group by 1
    ), j as (
      select m.*, kk.inversion, kk.contratos,
        round((100*m.interacciones/nullif(m.visualizaciones,0))::numeric,2)::float8 tasa,
        case when kk.inversion > 0 then round((kk.inversion*1000/nullif(m.visualizaciones,0))::numeric,0)::float8 end costo_mil_vistas,
        case when kk.inversion > 0 then round((kk.inversion/nullif(m.interacciones,0))::numeric,0)::float8 end costo_por_interaccion,
        (kk.inversion > 0 and m.visualizaciones > 0 and m.interacciones > 0) elegible
      from m join kk using (influencer)
    ), r as (
      select j.*,
        case when elegible then rank() over (partition by elegible order by costo_por_interaccion) end r_cpi,
        case when elegible then rank() over (partition by elegible order by tasa desc) end r_tasa,
        case when elegible then rank() over (partition by elegible order by costo_mil_vistas) end r_cpm
      from j
    )
    select influencer, territorio, campanas, contratos, inversion, piezas, con_metricas,
      visualizaciones, alcance, interacciones, tasa, costo_mil_vistas, costo_por_interaccion,
      r_cpi::int rank_costo_interaccion, r_tasa::int rank_tasa, r_cpm::int rank_costo_mil_vistas,
      round(((r_cpi+r_tasa+r_cpm)/3.0)::numeric,1)::float8 ranking_promedio,
      seguidores_ig, seguidores_tiktok, er_ig
    from r
    order by inversion desc, influencer`,
    filterParams(f),
  );
}

export type TerritorioRow = {
  territorio: string;
  piezas: number;
  influencers: number;
  visualizaciones: number;
};

export async function getTerritorios(client: ClientSlug, f: InfluencerFilters): Promise<TerritorioRow[]> {
  const table = tableFor(client);
  return queryReport<TerritorioRow>(
    `with f as (
      select * from ${table}
      where (CAST($1 AS TEXT) IS NULL OR campana = CAST($1 AS TEXT))
        and (CAST($3 AS TEXT) IS NULL OR influencer = CAST($3 AS TEXT))
        and (CAST($4 AS TEXT) IS NULL OR scope_recibido_tipo = CAST($4 AS TEXT))
        and (CAST($2 AS TEXT) IS NULL OR TRUE)
    )
    select territorio, count(*)::int piezas, count(distinct influencer)::int influencers,
      coalesce(sum(visualizaciones),0)::float8 visualizaciones
    from f
    where territorio is not null
    group by 1
    order by visualizaciones desc`,
    filterParams(f),
  );
}

export type InteraccionRow = { orden: number; tipo: string; valor: number };

export async function getInteracciones(client: ClientSlug, f: InfluencerFilters): Promise<InteraccionRow[]> {
  const table = tableFor(client);
  return queryReport<InteraccionRow>(
    `with f as (
      select * from ${table}
      where (CAST($1 AS TEXT) IS NULL OR campana = CAST($1 AS TEXT))
        and (CAST($2 AS TEXT) IS NULL OR territorio = CAST($2 AS TEXT))
        and (CAST($3 AS TEXT) IS NULL OR influencer = CAST($3 AS TEXT))
        and (CAST($4 AS TEXT) IS NULL OR scope_recibido_tipo = CAST($4 AS TEXT))
    ), a as (
      select coalesce(sum(likes),0)::float8 l, coalesce(sum(comentarios),0)::float8 c,
        coalesce(sum(shares),0)::float8 s, coalesce(sum(guardados),0)::float8 g,
        coalesce(sum(click_a_arroba),0)::float8 k
      from f
    )
    select t.orden, t.tipo, t.valor
    from a cross join lateral (
      values (1,'Likes',a.l),(2,'Comentarios',a.c),(3,'Shares',a.s),(4,'Guardados',a.g),(5,'Clics a @',a.k)
    ) t(orden,tipo,valor)
    order by t.orden`,
    filterParams(f),
  );
}

export type PiezaRow = {
  id: string;
  influencer: string;
  campana: string;
  territorio: string | null;
  formato: string | null;
  numero: number | null;
  visualizaciones: number | null;
  alcance: number | null;
  likes: number | null;
  comentarios: number | null;
  shares: number | null;
  guardados: number | null;
  clics: number | null;
  interacciones: number | null;
  tasa: number | null;
  clipping: string | null;
  periodo_desde: string | null;
  periodo_hasta: string | null;
};

export async function getPiezas(client: ClientSlug, f: InfluencerFilters): Promise<PiezaRow[]> {
  const table = tableFor(client);
  return queryReport<PiezaRow>(
    `with f as (
      select * from ${table}
      where (CAST($1 AS TEXT) IS NULL OR campana = CAST($1 AS TEXT))
        and (CAST($2 AS TEXT) IS NULL OR territorio = CAST($2 AS TEXT))
        and (CAST($3 AS TEXT) IS NULL OR influencer = CAST($3 AS TEXT))
        and (CAST($4 AS TEXT) IS NULL OR scope_recibido_tipo = CAST($4 AS TEXT))
    )
    select id::text id, influencer, campana, territorio, scope_recibido_tipo formato,
      scope_recibido_numero numero, visualizaciones::float8 visualizaciones, alcance::float8 alcance,
      likes::float8 likes, comentarios::float8 comentarios, shares::float8 shares, guardados::float8 guardados,
      click_a_arroba::float8 clics,
      case when coalesce(visualizaciones,0) > 0 then (coalesce(likes,0)+coalesce(comentarios,0)+coalesce(shares,0)+coalesce(guardados,0))::float8 end interacciones,
      round((100*(coalesce(likes,0)+coalesce(comentarios,0)+coalesce(shares,0)+coalesce(guardados,0))/nullif(visualizaciones,0))::numeric,2)::float8 tasa,
      clipping,
      to_char(periodo_desde,'YYYY-MM-DD') periodo_desde,
      to_char(periodo_hasta,'YYYY-MM-DD') periodo_hasta
    from f
    order by visualizaciones desc nulls last, influencer, formato, numero`,
    filterParams(f),
  );
}

export type ContratoRow = {
  campana: string;
  influencer: string;
  desde: string | null;
  hasta: string | null;
  inversion: number;
  piezas: number;
  sin_metricas: number;
  acordado: string | null;
  recibido: string | null;
  cumplimiento: number | null;
};

export async function getContratos(client: ClientSlug, f: InfluencerFilters): Promise<ContratoRow[]> {
  const table = tableFor(client);
  return queryReport<ContratoRow>(
    `with f as (
      select * from ${table}
      where (CAST($1 AS TEXT) IS NULL OR campana = CAST($1 AS TEXT))
        and (CAST($2 AS TEXT) IS NULL OR territorio = CAST($2 AS TEXT))
        and (CAST($3 AS TEXT) IS NULL OR influencer = CAST($3 AS TEXT))
        and (CAST($4 AS TEXT) IS NULL OR TRUE)
    ), a as (
      select campana, influencer, scope_acordado_tipo tipo, max(scope_acrodado_numero)::int n
      from f where scope_acordado_tipo is not null and coalesce(scope_acrodado_numero,0) > 0
      group by 1,2,3
    ), r as (
      select campana, influencer, scope_recibido_tipo tipo, count(*)::int n from f group by 1,2,3
    ), t as (
      select coalesce(a.campana,r.campana) campana, coalesce(a.influencer,r.influencer) influencer,
        coalesce(a.tipo,r.tipo) tipo, coalesce(a.n,0) acordado, coalesce(r.n,0) recibido
      from a full join r on a.campana = r.campana and a.influencer = r.influencer and a.tipo = r.tipo
    ), c as (
      select campana, influencer, min(periodo_desde) desde, max(periodo_hasta) hasta,
        max(presupuesto)::float8 inversion, count(*)::int piezas,
        (count(*) filter (where coalesce(visualizaciones,0) = 0 and scope_recibido_tipo <> 'PRESENCIA'))::int sin_metricas
      from f group by 1,2
    )
    select c.campana, c.influencer, to_char(c.desde,'YYYY-MM-DD') desde, to_char(c.hasta,'YYYY-MM-DD') hasta,
      c.inversion, c.piezas, c.sin_metricas,
      (select string_agg(t.acordado || ' ' || t.tipo, ' · ' order by array_position(array['REEL','STORIE','PRESENCIA','TIKTOK']::text[], t.tipo))
        from t where t.campana = c.campana and t.influencer = c.influencer and t.acordado > 0) acordado,
      (select string_agg(t.recibido || ' ' || t.tipo, ' · ' order by array_position(array['REEL','STORIE','PRESENCIA','TIKTOK']::text[], t.tipo))
        from t where t.campana = c.campana and t.influencer = c.influencer and t.recibido > 0) recibido,
      (select round(100.0*sum(least(t.acordado,t.recibido))/nullif(sum(t.acordado),0))::float8
        from t where t.campana = c.campana and t.influencer = c.influencer) cumplimiento
    from c
    order by c.campana, c.desde, c.influencer`,
    filterParams(f),
  );
}

export type FiltroOpcion = { dimension: "campana" | "territorio" | "influencer"; valor: string };

export async function getOpciones(client: ClientSlug): Promise<FiltroOpcion[]> {
  const table = tableFor(client);
  return queryReport<FiltroOpcion>(
    `select 'campana' dimension, campana valor from ${table} where campana is not null group by 2
    union all
    select 'territorio', territorio from ${table} where territorio is not null group by 2
    union all
    select 'influencer', influencer from ${table} where influencer is not null group by 2
    order by 1, 2`,
  );
}
