import { NextResponse } from "next/server";
import { connect } from "node:net";

export const maxDuration = 15;

const HOST = "aws-1-ca-central-1.pooler.supabase.com";
const PORTS = [6543, 5432] as const;

// Ruta temporal (se borra después de usarla) para confirmar, desde Vercel
// mismo, si se puede conectar al transaction pooler de Supabase (puerto
// 6543) antes de migrar los secrets reales — ver Parte A del plan. No usa
// ninguna credencial, solo intenta abrir el socket TCP.
function testPort(port: number): Promise<{ port: number; ok: boolean; ms: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = connect({ host: HOST, port, timeout: 8000 });
    socket.once("connect", () => {
      socket.destroy();
      resolve({ port, ok: true, ms: Date.now() - start });
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ port, ok: false, ms: Date.now() - start, error: "timeout" });
    });
    socket.once("error", (err) => {
      resolve({ port, ok: false, ms: Date.now() - start, error: err.message });
    });
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== process.env.TEST_ROUTE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await Promise.all(PORTS.map(testPort));
  return NextResponse.json({ host: HOST, results });
}
