import { NextResponse } from "next/server";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import { getDriveFolderIdForClient, listFilesInFolder } from "@/lib/googleDrive";

export const dynamic = "force-dynamic";

// Mismo candado de identidad que /reportes/*/secure y el asistente: el
// email llega como query param (dato de Softr, editable por cualquiera) y
// token lo firmamos nosotros — si no coincide, no fue Softr quien armó
// este request. El client_slug (y por lo tanto la carpeta de Drive que se
// lee) se resuelve siempre acá, server-side, nunca a partir de un
// parámetro enviado por el browser.
export async function GET(request: Request) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: "Falta configurar GOOGLE_SERVICE_ACCOUNT_KEY." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("u");
  const token = searchParams.get("t");

  if (!email || !verifyEmailToken(email, token)) {
    return NextResponse.json({ error: "No se pudo verificar el usuario." }, { status: 401 });
  }

  const clientSlug = await getClientSlugForEmail(email);
  if (!clientSlug) {
    return NextResponse.json({ error: "Este usuario no está habilitado." }, { status: 403 });
  }

  const folderId = await getDriveFolderIdForClient(clientSlug);
  if (!folderId) {
    return NextResponse.json(
      { error: "Este cliente todavía no tiene una carpeta de Documentos configurada." },
      { status: 404 },
    );
  }

  try {
    const files = await listFilesInFolder(folderId);
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { error: `Error leyendo Google Drive: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
