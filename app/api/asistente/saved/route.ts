import { NextResponse } from "next/server";
import { listSavedReports } from "@/lib/assistant/savedReports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Falta identificar quién sos para ver tus guardados." }, { status: 400 });
  }

  try {
    const reports = await listSavedReports(userId);
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json(
      { error: `No se pudieron traer los guardados: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
