import { queryReport } from "@/lib/supabase/pg";
import { formatPercent } from "@/lib/format";
import type { InsightOfMonth, Metric } from "@/lib/types";

// Reemplaza la vista dbo.portal_metrics de Fabric (que exigía tener la
// capacidad despierta en cada carga del Home, algo que no pasa casi nunca
// desde que la pausamos para ahorrar costo) por las mismas 4 métricas
// calculadas directo sobre las tablas gold_* ya sincronizadas en Supabase.
//
// OJO con "Cumplimiento del objetivo": depende de gold_shopify_objetivos,
// que hoy tiene valores de ejemplo (ej. "Ordenes Totales" = 500.000 para un
// período con ~2.000 órdenes reales) — no son metas reales todavía. Hasta
// que alguien cargue objetivos de verdad ahí, esa métrica va a seguir
// mostrando un número sin sentido de negocio, aunque la cuenta esté bien
// hecha — no es un bug de esta query, es que la meta cargada no es real.
type PerformanceRow = {
  periodo: number;
  facturacion_var_pct: number | null;
  ticket_var_pct: number | null;
  sesiones_var_pct: number | null;
  cumplimiento_pct: number | null;
};

const PERIODS_LIMIT = 3;

async function getPerformanceRows(): Promise<PerformanceRow[]> {
  return queryReport<PerformanceRow>(`
    with periods as (
      select distinct periodo from gold_shopify_time
    ),
    fact as (
      select t.periodo, sum(s.total_sales) / 1.21 as facturacion
      from gold_shopify_total_sales_by_product s
      join gold_shopify_time t on t.fecha = s.day
      group by t.periodo
    ),
    ticket as (
      select t.periodo,
             sum(a.gross_sales - a.discounts) / nullif(sum(a.orders), 0) as ticket_promedio
      from gold_shopify_average_order_value_over_time a
      join gold_shopify_time t on t.fecha = a.day
      group by t.periodo
    ),
    sesiones as (
      select t.periodo, sum(r.sessions) as sesiones_totales
      from gold_shopify_sessions_by_referrer_master r
      join gold_shopify_time t on t.fecha = r.day
      group by t.periodo
    ),
    objetivo as (
      select periodo, sum(objetivo) as objetivo_facturacion
      from gold_shopify_objetivos
      where nombre_objetivo = 'Facturacion del mes'
      group by periodo
    ),
    base as (
      select
        p.periodo,
        f.facturacion,
        tk.ticket_promedio,
        se.sesiones_totales,
        ob.objetivo_facturacion
      from periods p
      left join fact f on f.periodo = p.periodo
      left join ticket tk on tk.periodo = p.periodo
      left join sesiones se on se.periodo = p.periodo
      left join objetivo ob on ob.periodo = p.periodo
    ),
    withlag as (
      select
        periodo,
        facturacion,
        ticket_promedio,
        sesiones_totales,
        objetivo_facturacion,
        lag(facturacion) over (order by periodo) as facturacion_ant,
        lag(ticket_promedio) over (order by periodo) as ticket_promedio_ant,
        lag(sesiones_totales) over (order by periodo) as sesiones_totales_ant
      from base
    )
    select
      periodo,
      case when facturacion_ant is null or facturacion_ant = 0 then null
           else round((100.0 * (facturacion - facturacion_ant) / facturacion_ant)::numeric, 2)::float8 end as facturacion_var_pct,
      case when ticket_promedio_ant is null or ticket_promedio_ant = 0 then null
           else round((100.0 * (ticket_promedio - ticket_promedio_ant) / ticket_promedio_ant)::numeric, 2)::float8 end as ticket_var_pct,
      case when sesiones_totales_ant is null or sesiones_totales_ant = 0 then null
           else round((100.0 * (sesiones_totales - sesiones_totales_ant) / sesiones_totales_ant)::numeric, 2)::float8 end as sesiones_var_pct,
      case when objetivo_facturacion is null or objetivo_facturacion = 0 or facturacion is null then null
           else round((100.0 * facturacion / objetivo_facturacion)::numeric, 2)::float8 end as cumplimiento_pct
    from withlag
    where facturacion is not null
    order by periodo desc
    limit ${PERIODS_LIMIT}
  `);
}

function periodoToIsoDate(periodo: number): string {
  const anio = Math.floor(periodo / 100);
  const mes = periodo % 100;
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

function trendSentiment(value: number): Metric["sentiment"] {
  return value >= 0 ? "positive" : "negative";
}

function goalSentiment(value: number): Metric["sentiment"] {
  return value >= 100 ? "positive" : "negative";
}

function buildMetrics(period: string, row: PerformanceRow): Metric[] {
  const metrics: Metric[] = [];

  if (row.facturacion_var_pct !== null) {
    metrics.push({
      id: `${period}-facturacion`,
      period,
      label: "Facturación",
      value_pct: row.facturacion_var_pct,
      sentiment: trendSentiment(row.facturacion_var_pct),
      sort_order: 1,
    });
  }
  if (row.ticket_var_pct !== null) {
    metrics.push({
      id: `${period}-ticket`,
      period,
      label: "Ticket promedio",
      value_pct: row.ticket_var_pct,
      sentiment: trendSentiment(row.ticket_var_pct),
      sort_order: 2,
    });
  }
  if (row.sesiones_var_pct !== null) {
    metrics.push({
      id: `${period}-sesiones`,
      period,
      label: "Sesiones totales",
      value_pct: row.sesiones_var_pct,
      sentiment: trendSentiment(row.sesiones_var_pct),
      sort_order: 3,
    });
  }
  if (row.cumplimiento_pct !== null) {
    metrics.push({
      id: `${period}-cumplimiento`,
      period,
      label: "Cumplimiento del objetivo",
      value_pct: row.cumplimiento_pct,
      sentiment: goalSentiment(row.cumplimiento_pct),
      sort_order: 4,
    });
  }

  return metrics;
}

// Insight redactado en el momento a partir de las mismas 3 métricas de
// variación (sin tocar "Cumplimiento del objetivo": esa depende de metas
// de ejemplo, no reales — ver comentario arriba — así que no armamos
// ningún texto a partir de ella hasta que haya datos de verdad ahí).
function buildComputedInsight(period: string, row: PerformanceRow): InsightOfMonth | null {
  const fact = row.facturacion_var_pct;
  if (fact === null) return null;

  const sesiones = row.sesiones_var_pct;
  const ticket = row.ticket_var_pct;
  const factSubio = fact >= 0;
  const factVerbo = factSubio ? "subió" : "cayó";
  const pct = (value: number) => formatPercent(Math.abs(value));

  let title: string;
  let body: string;

  if (sesiones !== null && Math.sign(sesiones) === Math.sign(fact) && Math.abs(sesiones) >= Math.abs(fact) * 0.4) {
    title = factSubio ? "Más sesiones impulsan la facturación" : "La caída de sesiones impacta en la facturación";
    body = `La facturación ${factVerbo} ${pct(fact)}, en un contexto de ${sesiones >= 0 ? "aumento" : "disminución"} de ${pct(sesiones)} en las sesiones. La ${sesiones >= 0 ? "mayor" : "menor"} actividad aparece como uno de los principales factores detrás de ${factSubio ? "la suba" : "la caída"}.`;
  } else if (ticket !== null && Math.sign(ticket) === Math.sign(fact) && Math.abs(ticket) >= Math.abs(fact) * 0.3) {
    title = factSubio ? "Un mejor ticket promedio impulsa la facturación" : "La caída del ticket promedio afecta la facturación";
    body = `La facturación ${factVerbo} ${pct(fact)}, acompañada por ${ticket >= 0 ? "un aumento" : "una caída"} de ${pct(ticket)} en el ticket promedio.`;
  } else {
    title = factSubio ? "La facturación mejora este mes" : "La facturación retrocede este mes";
    body = `La facturación ${factVerbo} ${pct(fact)} respecto del período anterior.`;
  }

  return { id: `${period}-computed`, period, title, body, highlight: null };
}

// insights_of_month tiene RLS por profile_id (solo lo puede leer el dueño
// logueado con Supabase Auth) — igual que growth.ts/influencers.ts, esta
// página se embebe sin login propio (la identifica Softr), así que leemos
// directo por Postgres. Es una tabla de curación manual (hoy vacía): si en
// algún momento alguien carga una fila para un período puntual, esa gana
// por sobre el insight redactado automáticamente para ese mismo período.
async function getManualInsights(): Promise<Record<string, InsightOfMonth>> {
  const rows = await queryReport<{
    id: string;
    period: string;
    title: string;
    body: string;
    highlight: string | null;
  }>(
    `select id::text as id, to_char(period, 'YYYY-MM-DD') as period, title, body, highlight
     from insights_of_month
     order by period desc`,
  );

  const byPeriod: Record<string, InsightOfMonth> = {};
  for (const row of rows) {
    byPeriod[row.period] = row;
  }
  return byPeriod;
}

export async function getPerformanceSnapshotData(): Promise<{
  metricsByPeriod: Record<string, Metric[]>;
  insightByPeriod: Record<string, InsightOfMonth>;
}> {
  const [rows, manualInsights] = await Promise.all([getPerformanceRows(), getManualInsights()]);

  const metricsByPeriod: Record<string, Metric[]> = {};
  const insightByPeriod: Record<string, InsightOfMonth> = {};

  for (const row of rows) {
    const period = periodoToIsoDate(row.periodo);

    const metrics = buildMetrics(period, row);
    if (metrics.length) {
      metricsByPeriod[period] = metrics;
    }

    const computed = buildComputedInsight(period, row);
    if (computed) {
      insightByPeriod[period] = manualInsights[period] ?? computed;
    }
  }

  return { metricsByPeriod, insightByPeriod };
}
