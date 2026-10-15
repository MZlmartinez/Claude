import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Ruta temporal para probar que la service_role key puede leer/escribir en
// Supabase desde Vercel. Protegida por el mismo secret que test-fabric.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("key") !== process.env.TEST_ROUTE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("profiles").select("id").limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profilesFound: data.length });
}
