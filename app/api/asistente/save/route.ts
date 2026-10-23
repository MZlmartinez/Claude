import { NextResponse } from "next/server";
import { deleteSavedReport, saveReport } from "@/lib/assistant/savedReports";
import type { ChartSpec } from "@/app/api/asistente/chat/route";

export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 20_000;

type SaveBody = {
  userId?: string | null;
  question?: string;
  summary?: string;
  sql?: string;
  chart?: ChartSpec | null;
};

export async function POST(request: Request) {
  let body: SaveBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  const summary = (body.summary ?? "").trim();
  const sql = (body.sql ?? "").trim();

  if (!question || !summary) {
    return NextResponse.json({ error: "Falta la pregunta o el resumen del reporte." }, { status: 400 });
  }
  if (question.length > MAX_TEXT_LENGTH || summary.length > MAX_TEXT_LENGTH || sql.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "El reporte es demasiado largo para guardar." }, { status: 400 });
  }

  try {
    const saved = await saveReport({
      createdBy: body.userId || null,
      question,
      summary,
      sql,
      chart: body.chart ?? null,
    });
    // Devolvemos el registro completo (no solo el id): así el sidebar de
    // guardados se actualiza al toque con lo que acaba de entrar, sin
    // tener que volver a pedirle la lista entera al servidor.
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { error: `No se pudo guardar: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}

type DeleteBody = { id?: string; userId?: string | null };

export async function DELETE(request: Request) {
  let body: DeleteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  const userId = body.userId || null;
  if (!id || !userId) {
    return NextResponse.json({ error: "Falta el id del reporte o el usuario." }, { status: 400 });
  }

  try {
    await deleteSavedReport(id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: `No se pudo eliminar: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
