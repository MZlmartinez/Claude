import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { queryFabricMetrics } from "@/lib/fabric";
import type { DocumentItem, InsightOfMonth, Meeting, Metric, Profile } from "@/lib/types";

export async function getUpcomingMeetings(profileId: string): Promise<Meeting[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("*")
    .eq("profile_id", profileId)
    .gte("meeting_at", new Date().toISOString())
    .order("meeting_at", { ascending: true })
    .limit(3);

  return data ?? [];
}

export async function getRecentDocuments(profileId: string): Promise<DocumentItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(3);

  return data ?? [];
}

export type PerformanceSnapshot = {
  periods: string[];
  metricsByPeriod: Record<string, Metric[]>;
  insightByPeriod: Record<string, InsightOfMonth>;
};

// Las métricas viven en el datalake de Fabric de cada cliente, no en Supabase
// (evita tener el mismo número duplicado en dos sistemas). Se cachean 15
// minutos por cliente para no golpear Fabric en cada carga del home.
const getCachedFabricMetrics = unstable_cache(
  async (sqlEndpoint: string, database: string) => queryFabricMetrics(sqlEndpoint, database),
  ["fabric-metrics"],
  { revalidate: 900 },
);

async function safeFabricMetrics(sqlEndpoint: string, database: string) {
  try {
    return await getCachedFabricMetrics(sqlEndpoint, database);
  } catch (error) {
    // Un Fabric caído no debe romper el home: se degrada a "sin métricas".
    console.error("Error consultando métricas de Fabric", error);
    return [];
  }
}

export async function getPerformanceSnapshot(profile: Profile): Promise<PerformanceSnapshot> {
  const supabase = await createClient();

  const [fabricRows, { data: insights }] = await Promise.all([
    profile.fabric_sql_endpoint && profile.fabric_database
      ? safeFabricMetrics(profile.fabric_sql_endpoint, profile.fabric_database)
      : Promise.resolve([]),
    supabase
      .from("insights_of_month")
      .select("*")
      .eq("profile_id", profile.id)
      .order("period", { ascending: false }),
  ]);

  const metricsByPeriod: Record<string, Metric[]> = {};
  for (const row of fabricRows) {
    const metric: Metric = { id: `${row.period}-${row.label}`, ...row };
    (metricsByPeriod[metric.period] ??= []).push(metric);
  }

  const insightByPeriod: Record<string, InsightOfMonth> = {};
  for (const insight of insights ?? []) {
    insightByPeriod[insight.period] = insight;
  }

  const periods = Object.keys(metricsByPeriod).sort((a, b) => b.localeCompare(a));

  return { periods, metricsByPeriod, insightByPeriod };
}
