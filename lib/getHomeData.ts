import { createClient } from "@/lib/supabase/server";
import type { DocumentItem, InsightOfMonth, Meeting, Metric } from "@/lib/types";

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

export async function getPerformanceSnapshot(profileId: string): Promise<PerformanceSnapshot> {
  const supabase = await createClient();

  const [{ data: metrics }, { data: insights }] = await Promise.all([
    supabase
      .from("metrics")
      .select("*")
      .eq("profile_id", profileId)
      .order("period", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase
      .from("insights_of_month")
      .select("*")
      .eq("profile_id", profileId)
      .order("period", { ascending: false }),
  ]);

  const metricsByPeriod: Record<string, Metric[]> = {};
  for (const metric of metrics ?? []) {
    (metricsByPeriod[metric.period] ??= []).push(metric);
  }

  const insightByPeriod: Record<string, InsightOfMonth> = {};
  for (const insight of insights ?? []) {
    insightByPeriod[insight.period] = insight;
  }

  const periods = Object.keys(metricsByPeriod).sort((a, b) => b.localeCompare(a));

  return { periods, metricsByPeriod, insightByPeriod };
}
