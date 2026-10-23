import { createClient } from "@/lib/supabase/server";
import { getPerformanceMetrics } from "@/lib/reports/performance";
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

async function safePerformanceMetrics() {
  try {
    return await getPerformanceMetrics();
  } catch (error) {
    // Un problema puntual con Supabase no debe romper el home: se degrada
    // a "sin métricas" en vez de tumbar la página entera.
    console.error("Error calculando el performance snapshot", error);
    return {};
  }
}

export async function getPerformanceSnapshot(profile: Profile): Promise<PerformanceSnapshot> {
  const supabase = await createClient();

  const [metricsByPeriod, { data: insights }] = await Promise.all([
    safePerformanceMetrics(),
    supabase
      .from("insights_of_month")
      .select("*")
      .eq("profile_id", profile.id)
      .order("period", { ascending: false }),
  ]);

  const insightByPeriod: Record<string, InsightOfMonth> = {};
  for (const insight of insights ?? []) {
    insightByPeriod[insight.period] = insight;
  }

  const periods = Object.keys(metricsByPeriod).sort((a, b) => b.localeCompare(a));

  return { periods, metricsByPeriod, insightByPeriod };
}
