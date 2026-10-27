import { NextResponse } from "next/server";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import { downloadFile, getDriveFolderIdForClient, isWithinRoot } from "@/lib/googleDrive";

export const dynamic = "force-dynamic";

// Descarga el contenido real a través del servidor — nunca mandamos al
// usuario final al webViewLink de Drive, porque no tiene cuenta de Google
// con acceso a esa carpeta (solo el Service Account la tiene). "fileId" sí
// viene del browser, pero se valida que esté dentro del árbol del cliente
// (ver isWithinRoot) antes de leer nada con el Service Account compartido.
export async function GET(request: Request) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: "Falta configurar GOOGLE_SERVICE_ACCOUNT_KEY." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("u");
  const token = searchParams.get("t");
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "Falta el archivo a descargar." }, { status: 400 });
  }
  if (!email || !verifyEmailToken(email, token)) {
    return NextResponse.json({ error: "No se pudo verificar el usuario." }, { status: 401 });
  }

  const clientSlug = await getClientSlugForEmail(email);
  if (!clientSlug) {
    return NextResponse.json({ error: "Este usuario no está habilitado." }, { status: 403 });
  }

  const rootFolderId = await getDriveFolderIdForClient(clientSlug);
  if (!rootFolderId) {
    return NextResponse.json({ error: "Este cliente todavía no tiene Documentos configurado." }, { status: 404 });
  }

  try {
    const allowed = await isWithinRoot(fileId, rootFolderId);
    if (!allowed) {
      return NextResponse.json({ error: "Ese archivo no pertenece a tu cuenta." }, { status: 403 });
    }

    const { buffer, mimeType, filename, inline } = await downloadFile(fileId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    // Las respuestas de error de la API de Drive traen el motivo real en
    // response.data.error.message (p.ej. "downloadRestricted") — el
    // .message genérico de GaxiosError solo dice "Request failed with
    // status code 403" y no alcanza para diagnosticar.
    const detail =
      error && typeof error === "object" && "response" in error
        ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
        : undefined;
    const message = detail ?? (error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: `Error descargando el archivo: ${message}` }, { status: 502 });
  }
}
