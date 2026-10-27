import { NextResponse } from "next/server";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import { getDriveFolderIdForClient, isWithinRoot, listFilesInFolder } from "@/lib/googleDrive";

export const dynamic = "force-dynamic";

// Mismo candado de identidad que /reportes/*/secure y el asistente: el
// email llega como query param (dato de Softr, editable por cualquiera) y
// token lo firmamos nosotros — si no coincide, no fue Softr quien armó
// este request. La carpeta raíz del cliente se resuelve siempre acá,
// server-side, nunca a partir de un parámetro enviado por el browser.
//
// "folder" (opcional) sí puede venir del browser — es cómo se navega a una
// subcarpeta una vez adentro del árbol del cliente — pero se valida contra
// ese árbol antes de usarse (ver isWithinRoot): nunca se lista nada fuera
// de la carpeta raíz de ESE cliente, aunque el Service Account compartido
// también tenga acceso a la carpeta de otro.
export async function GET(request: Request) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: "Falta configurar GOOGLE_SERVICE_ACCOUNT_KEY." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("u");
  const token = searchParams.get("t");
  const requestedFolder = searchParams.get("folder");

  if (!email || !verifyEmailToken(email, token)) {
    return NextResponse.json({ error: "No se pudo verificar el usuario." }, { status: 401 });
  }

  const clientSlug = await getClientSlugForEmail(email);
  if (!clientSlug) {
    return NextResponse.json({ error: "Este usuario no está habilitado." }, { status: 403 });
  }

  const rootFolderId = await getDriveFolderIdForClient(clientSlug);
  if (!rootFolderId) {
    return NextResponse.json(
      { error: "Este cliente todavía no tiene una carpeta de Documentos configurada." },
      { status: 404 },
    );
  }

  try {
    let folderId = rootFolderId;
    if (requestedFolder && requestedFolder !== rootFolderId) {
      const allowed = await isWithinRoot(requestedFolder, rootFolderId);
      if (!allowed) {
        return NextResponse.json({ error: "Esa carpeta no pertenece a tu cuenta." }, { status: 403 });
      }
      folderId = requestedFolder;
    }

    const files = await listFilesInFolder(folderId);
    return NextResponse.json({ folderId, rootFolderId, files });
  } catch (error) {
    return NextResponse.json(
      { error: `Error leyendo Google Drive: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
