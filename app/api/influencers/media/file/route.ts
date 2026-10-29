import { NextResponse } from "next/server";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import { downloadFile, isWithinRoot } from "@/lib/googleDrive";
import { getMediaFolderForCampaign } from "@/lib/googleInfluencerMedia";

export const dynamic = "force-dynamic";

// Streamea el clip real — nunca un link directo a Drive (mismo motivo que
// /api/documentos/download: el usuario final no tiene cuenta de Google con
// acceso). "fileId" viene del browser pero se valida con isWithinRoot
// contra la carpeta de ESA campaña de ESE cliente antes de leer nada.
export async function GET(request: Request) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: "Falta configurar GOOGLE_SERVICE_ACCOUNT_KEY." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("u");
  const token = searchParams.get("t");
  const campana = searchParams.get("campana");
  const fileId = searchParams.get("fileId");

  if (!campana || !fileId) {
    return NextResponse.json({ error: "Faltan parámetros (campana, fileId)." }, { status: 400 });
  }
  if (!email || !verifyEmailToken(email, token)) {
    return NextResponse.json({ error: "No se pudo verificar el usuario." }, { status: 401 });
  }

  const clientSlug = await getClientSlugForEmail(email);
  if (!clientSlug) {
    return NextResponse.json({ error: "Este usuario no está habilitado." }, { status: 403 });
  }

  const folderId = await getMediaFolderForCampaign(clientSlug, campana);
  if (!folderId) {
    return NextResponse.json({ error: "Esta campaña todavía no tiene material configurado." }, { status: 404 });
  }

  try {
    const allowed = await isWithinRoot(fileId, folderId);
    if (!allowed) {
      return NextResponse.json({ error: "Ese archivo no pertenece a esta campaña." }, { status: 403 });
    }

    const { buffer, mimeType, filename } = await downloadFile(fileId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Error leyendo el clip: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
