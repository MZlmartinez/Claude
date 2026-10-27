// Formato de tamaño y fecha para la lista de archivos de Drive.
export function formatSize(bytes: string | null): string {
  if (!bytes) return "—";
  const n = Number(bytes);
  if (!isFinite(n) || n <= 0) return "—";
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(0) + " KB";
  return n + " B";
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

export function isFolder(mimeType: string): boolean {
  return mimeType === FOLDER_MIME;
}
export function isShortcut(mimeType: string): boolean {
  return mimeType === SHORTCUT_MIME;
}

const KIND_LABELS: Record<string, string> = {
  "application/vnd.google-apps.document": "Doc",
  "application/vnd.google-apps.spreadsheet": "Sheet",
  "application/vnd.google-apps.presentation": "Slides",
  "application/pdf": "PDF",
  "video/mp4": "Video",
  "image/jpeg": "Imagen",
  "image/png": "Imagen",
};

export function kindLabel(mimeType: string): string {
  if (isFolder(mimeType)) return "Carpeta";
  if (isShortcut(mimeType)) return "Acceso directo";
  return KIND_LABELS[mimeType] ?? "Archivo";
}
