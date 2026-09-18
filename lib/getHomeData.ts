import { createClient } from "@/lib/supabase/server";
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
