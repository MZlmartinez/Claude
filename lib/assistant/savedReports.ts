import { createAdminClient } from "@/lib/supabase/admin";
import type { ChartSpec } from "@/app/api/asistente/chat/route";

// Guardados del asistente: quedan como 'draft', privados a quien los
// guardó (identificados por el mail de Softr, no hay login propio acá).
// La tabla ya soporta un estado 'published' para más adelante, pero por
// ahora el producto solo expone "guardar".
export type SavedReport = {
  id: string;
  created_at: string;
  created_by: string | null;
  question: string;
  summary: string;
  sql: string;
  chart: ChartSpec | null;
};

export async function saveReport(input: {
  createdBy: string | null;
  question: string;
  summary: string;
  sql: string;
  chart: ChartSpec | null;
}): Promise<SavedReport> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_reports")
    .insert({
      created_by: input.createdBy,
      question: input.question,
      summary: input.summary,
      sql: input.sql,
      chart: input.chart,
      status: "draft",
    })
    .select("id, created_at, created_by, question, summary, sql, chart")
    .single();

  if (error) throw new Error(error.message);
  return data as SavedReport;
}

export async function getSavedReport(id: string, createdBy: string): Promise<SavedReport | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_reports")
    .select("id, created_at, created_by, question, summary, sql, chart")
    .eq("id", id)
    .eq("created_by", createdBy)
    .eq("status", "draft")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as SavedReport | null) ?? null;
}

// Filtra por created_by además de id: así nadie puede borrar un guardado
// ajeno adivinando o reusando un id, aunque no haya login propio acá.
export async function deleteSavedReport(id: string, createdBy: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("assistant_reports")
    .delete()
    .eq("id", id)
    .eq("created_by", createdBy);

  if (error) throw new Error(error.message);
}

export async function listSavedReports(createdBy: string): Promise<SavedReport[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_reports")
    .select("id, created_at, created_by, question, summary, sql, chart")
    .eq("created_by", createdBy)
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SavedReport[];
}
