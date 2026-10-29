import { queryReport } from "@/lib/supabase/pg";
import { listFilesInFolder, type DriveFile } from "@/lib/googleDrive";

// Galería de material (clips) de Influencers — ver
// supabase/schema_client_influencer_media.sql para el porqué del mapeo
// manual campana -> carpeta. Confirmado con el equipo: dentro de la
// carpeta de cada influencer, los archivos "(1).mp4, (2).mp4..." están
// ordenados por visualizaciones de mayor a menor — por eso el matching acá
// es por RANKING (la pieza con más vistas de ese influencer en esa
// campaña = archivo 1), nunca por formato/número de pieza (eso no tiene
// ninguna relación con el nombre del archivo).

export async function getMediaFolderForCampaign(clientSlug: string, campana: string): Promise<string | null> {
  const rows = await queryReport<{ drive_folder_id: string }>(
    "select drive_folder_id from public.client_influencer_media_folders where client_slug = $1 and campana = $2",
    [clientSlug, campana],
  );
  return rows[0]?.drive_folder_id ?? null;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

async function findInfluencerSubfolder(campaignFolderId: string, influencer: string): Promise<DriveFile | null> {
  const children = await listFilesInFolder(campaignFolderId);
  const target = normalizeName(influencer);
  const folders = children.filter((f) => f.mimeType === FOLDER_MIME);
  return folders.find((f) => normalizeName(f.name) === target) ?? null;
}

// Extrae el número entre paréntesis del nombre de archivo (" (2)" en
// "Mathias Zaracho (2).mp4") — así es como viene ordenado hoy.
function fileRank(name: string): number {
  const m = name.match(/\((\d+)\)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

export async function listInfluencerClipsRanked(campaignFolderId: string, influencer: string): Promise<DriveFile[]> {
  const subfolder = await findInfluencerSubfolder(campaignFolderId, influencer);
  if (!subfolder) return [];
  const files = await listFilesInFolder(subfolder.id);
  return files
    .filter((f) => f.mimeType.startsWith("video/"))
    .sort((a, b) => fileRank(a.name) - fileRank(b.name));
}

// rank es 1-based: 1 = la pieza con más visualizaciones de ese influencer
// en esa campaña (ver Destacadas en InfluencersDashboard, que calcula el
// rank a partir de las métricas reales antes de pedir esto).
export async function getClipForRank(
  clientSlug: string,
  campana: string,
  influencer: string,
  rank: number,
): Promise<DriveFile | null> {
  const folderId = await getMediaFolderForCampaign(clientSlug, campana);
  if (!folderId) return null;
  const clips = await listInfluencerClipsRanked(folderId, influencer);
  return clips[rank - 1] ?? null;
}
