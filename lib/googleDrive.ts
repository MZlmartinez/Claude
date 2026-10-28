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
  // Solo presente si mimeType es un acceso directo — a qué apunta
  // realmente. El target puede estar fuera del árbol del cliente (un
  // atajo puede apuntar a cualquier lado al que el Service Account
  // compartido tenga acceso); por eso nunca se sigue a ciegas acá, solo
  // se expone el dato — quien lo usa (isWithinRoot, al navegar o
  // descargar) es quien de verdad valida que esté permitido.
  shortcutTargetId: string | null;
  shortcutTargetMimeType: string | null;
};

// folderId siempre sale de client_drive_folders (nunca de un parámetro del
// browser) — ver getDriveFolderIdForClient más abajo y app/api/documentos.
export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  const drive = driveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime, size, webViewLink, shortcutDetails)",
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
    shortcutTargetId: f.shortcutDetails?.targetId ?? null,
    shortcutTargetMimeType: f.shortcutDetails?.targetMimeType ?? null,
  }));
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

// El browser SÍ manda folderId/fileId una vez que ya estás navegando adentro
// de tu propio árbol (para abrir una subcarpeta o descargar un archivo) —
// a diferencia del folder raíz, que siempre sale de client_drive_folders.
// Esto confirma que ese id es realmente un descendiente del folder raíz del
// cliente (subiendo por "parents" hasta encontrarlo o quedarse sin padres),
// así nunca se usa el Service Account compartido para leer algo fuera del
// árbol del cliente autenticado, sea cual sea el id que mande el browser.
export async function isWithinRoot(itemId: string, rootId: string): Promise<boolean> {
  if (itemId === rootId) return true;
  const drive = driveClient();
  let currentId = itemId;
  try {
    for (let depth = 0; depth < 25; depth++) {
      const res = await drive.files.get({
        fileId: currentId,
        fields: "id, parents",
        supportsAllDrives: true,
      });
      const parentId = res.data.parents?.[0];
      if (!parentId) return false;
      if (parentId === rootId) return true;
      currentId = parentId;
    }
    return false;
  } catch {
    // El Service Account no puede ni siquiera leer este id (no compartido
    // con él, p.ej. el destino de un acceso directo que nunca se compartió
    // aparte) — eso significa "no está en tu árbol", no un error de Drive
    // para mostrarle crudo al usuario. Mismo resultado (false) que si
    // hubiera llegado hasta la raíz del Drive sin encontrar rootId.
    return false;
  }
}

const EXPORT_MIME_TYPES: Record<string, { mimeType: string; extension: string }> = {
  "application/vnd.google-apps.document": {
    mimeType: "application/pdf",
    extension: "pdf",
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  },
  // PDF en vez de pptx: estas son presentaciones para que el cliente las
  // mire, no para editarlas — pptx no tiene visor nativo en el navegador
  // (se descarga siempre), PDF sí (abre en pestaña nueva).
  "application/vnd.google-apps.presentation": {
    mimeType: "application/pdf",
    extension: "pdf",
  },
};

export type DownloadedFile = { buffer: Buffer; mimeType: string; filename: string; inline: boolean };

// Tipos que el navegador puede mostrar solo (PDF, imágenes, video, texto) —
// para esos mandamos Content-Disposition: inline, así "Abrir" lo muestra en
// la pestaña nueva en vez de forzar la descarga a disco. xlsx/pptx no
// tienen visor nativo en el navegador, así que igual terminan
// descargándose pase lo que pase en ese header.
function isInlineViewable(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType.startsWith("text/");
}

// Descarga el contenido real a través del servidor (nunca linkeamos a
// webViewLink de Drive: el usuario final no tiene cuenta de Google con
// acceso, solo el Service Account la tiene). Los documentos nativos de
// Google (Docs/Sheets/Slides) no tienen bytes propios para descargar —
// hay que pedirle a Drive que los exporte a un formato real (pdf/xlsx/pptx).
export async function downloadFile(fileId: string): Promise<DownloadedFile> {
  const drive = driveClient();
  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType",
    supportsAllDrives: true,
  });
  const name = meta.data.name ?? "archivo";
  const mimeType = meta.data.mimeType ?? "application/octet-stream";

  const exportAs = EXPORT_MIME_TYPES[mimeType];
  if (exportAs) {
    const res = await drive.files.export(
      { fileId, mimeType: exportAs.mimeType },
      { responseType: "arraybuffer" },
    );
    return {
      buffer: Buffer.from(res.data as ArrayBuffer),
      mimeType: exportAs.mimeType,
      filename: `${name}.${exportAs.extension}`,
      inline: isInlineViewable(exportAs.mimeType),
    };
  }
  if (mimeType.startsWith("application/vnd.google-apps.")) {
    throw new Error(`No se puede descargar este tipo de archivo de Google (${mimeType}).`);
  }

  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType, filename: name, inline: isInlineViewable(mimeType) };
}
