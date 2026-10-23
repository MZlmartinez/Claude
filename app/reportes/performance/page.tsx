import { getInsightsByPeriod, getPerformanceMetrics } from "@/lib/reports/performance";
import { PerformanceSnapshot } from "@/components/PerformanceSnapshot";

export const dynamic = "force-dynamic";

// Pensada para reemplazar el embed de Power BI en el campo "PBI_Home" de
// la tabla Clientes de Softr — solo el snapshot, sin el Navbar ni el resto
// del Home. Un solo cliente real en este pipeline (Decathlon), así que no
// hace falta identificar usuario ni filtrar por tenant.
export default async function PerformanceEmbedPage() {
  const [metricsByPeriod, insightByPeriod] = await Promise.all([
    getPerformanceMetrics(),
    getInsightsByPeriod(),
  ]);
  const periods = Object.keys(metricsByPeriod).sort((a, b) => b.localeCompare(a));

  return (
    <div className="min-h-screen bg-[#1D1D1B] px-4 py-4 [&_section]:!mt-0">
      <PerformanceSnapshot periods={periods} metricsByPeriod={metricsByPeriod} insightByPeriod={insightByPeriod} />
    </div>
  );
}
