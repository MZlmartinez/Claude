import { google } from "googleapis";
import { queryReport } from "@/lib/supabase/pg";

// Lectura server-side de Drive con un Service Account (ver README/setup):
// no hay login humano ni OAuth — el server se autentica con su propia
// identidad fija (la clave de GOOGLE_SERVICE_ACCOUNT_KEY) y solo puede ver
// las carpetas que se compartieron a mano con esa cuenta. Scope de solo
// lectura a propósito, esta integración nunca escribe en Drive.
function credentials(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("Falta la env var GOOGLE_SERVICE_ACCOUNT_KEY");
  const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY no tiene el formato esperado (falta client_email o private_key).");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function driveClient() {
  const { client_email, private_key } = credentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: string | null;
  webViewLink: string | null;
};

// folderId siempre sale de client_drive_folders (nunca de un parámetro del
// browser) — ver getDriveFolderIdForClient más abajo y app/api/documentos.
export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  const drive = driveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime, size, webViewLink)",
    orderBy: "folder,name",
    pageSize: 200,
    // Las carpetas de cliente viven dentro de la Shared Drive "Archivo
    // Moscú" (no en Mi unidad, como se asumió al principio) — sin estos
    // dos parámetros, la API v3 de Drive directamente ignora todo lo que
    // esté dentro de una Shared Drive, sea cual sea el permiso que tenga
    // el Service Account (da 404/vacío igual, no es un tema de permisos).
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    modifiedTime: f.modifiedTime ?? null,
    size: f.size ?? null,
    webViewLink: f.webViewLink ?? null,
  }));
}

// Diagnóstico temporal (ver app/api/documentos/list): distingue "el ID de
// carpeta está mal o no se compartió" de "se compartió bien pero está
// vacía" — drive.files.get falla distinto (404/403) que una lista vacía.
// Incluye qué email de Service Account está usando el servidor ahora mismo,
// para confirmar que es el mismo que se compartió (y no uno viejo). Sacar
// todo esto una vez confirmada la conexión real.
export async function getFolderName(
  folderId: string,
): Promise<{ id: string; name: string; serviceAccountEmail: string } | { error: string; serviceAccountEmail: string }> {
  const serviceAccountEmail = credentials().client_email;
  try {
    const drive = driveClient();
    const res = await drive.files.get({ fileId: folderId, fields: "id, name, mimeType", supportsAllDrives: true });
    return { id: res.data.id ?? "", name: res.data.name ?? "", serviceAccountEmail };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), serviceAccountEmail };
  }
}

// client_drive_folders: una fila por cliente (no por usuario), ver
// supabase/schema_client_drive_folders.sql.
export async function getDriveFolderIdForClient(clientSlug: string): Promise<string | null> {
  const rows = await queryReport<{ drive_folder_id: string }>(
    "select drive_folder_id from public.client_drive_folders where client_slug = $1",
    [clientSlug],
  );
  return rows[0]?.drive_folder_id ?? null;
}
