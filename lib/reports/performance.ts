import { queryReport } from "@/lib/supabase/pg";
import type { Metric } from "@/lib/types";

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

const PERIODS_LIMIT = 6;

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

export async function getPerformanceMetrics(): Promise<Record<string, Metric[]>> {
  const rows = await getPerformanceRows();
  const metricsByPeriod: Record<string, Metric[]> = {};

  for (const row of rows) {
    const period = periodoToIsoDate(row.periodo);
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

    if (metrics.length) {
      metricsByPeriod[period] = metrics;
    }
  }

  return metricsByPeriod;
}
