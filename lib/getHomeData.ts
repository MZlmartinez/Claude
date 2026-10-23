import { createClient } from "@/lib/supabase/server";
import { getPerformanceSnapshotData } from "@/lib/reports/performance";
import type { DocumentItem, Meeting } from "@/lib/types";

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

export type PerformanceSnapshot = Awaited<ReturnType<typeof getPerformanceSnapshotData>> & {
  periods: string[];
};

async function safePerformanceSnapshotData() {
  try {
    return await getPerformanceSnapshotData();
  } catch (error) {
    // Un problema puntual con Supabase no debe romper el home: se degrada
    // a "sin métricas" en vez de tumbar la página entera.
    console.error("Error calculando el performance snapshot", error);
    return { metricsByPeriod: {}, insightByPeriod: {} };
  }
}

// El Home tiene login propio (profile viene de Supabase Auth), pero el
// snapshot en sí es de un solo cliente real (Decathlon) — no hace falta
// el profile para armarlo.
export async function getPerformanceSnapshot(): Promise<PerformanceSnapshot> {
  const { metricsByPeriod, insightByPeriod } = await safePerformanceSnapshotData();
  const periods = Object.keys(metricsByPeriod).sort((a, b) => b.localeCompare(a));

  return { periods, metricsByPeriod, insightByPeriod };
}
