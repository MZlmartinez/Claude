import { queryReport } from "@/lib/supabase/pg";
import { listFilesInFolder, type DriveFile } from "@/lib/googleDrive";

// Galería de material (clips) de Influencers. La propia tabla de métricas
// ya trae la carpeta de Drive de cada influencer en la columna "clipping"
// (el mismo link se repite en todas las filas de ese influencer para esa
// campaña) — no hace falta ningún mapeo manual aparte.
//
// Dentro de esa carpeta, los archivos "(1).mp4, (2).mp4..." están
// ordenados por visualizaciones de mayor a menor (confirmado con el
// equipo) — por eso el matching acá es por RANKING (la pieza con más
// vistas de ese influencer en esa campaña = archivo 1), nunca por
// formato/número de pieza, que no tiene relación con el nombre del
// archivo.

function tableFor(client: string): string {
  return client === "deca" ? "gold_influencers_deca" : "gold_influencers_adecco";
}

function extractFolderId(clippingUrl: string): string | null {
  const m = clippingUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// "campana"/"influencer" llegan como parámetro del browser, pero la
// consulta está siempre acotada a la tabla gold_* del client_slug ya
// resuelto server-side — como mucho, esto devuelve "no hay clipping para
// esa combinación" de tu propio cliente, nunca el de otro.
export async function getClippingFolderId(client: string, campana: string, influencer: string): Promise<string | null> {
  const table = tableFor(client);
  const rows = await queryReport<{ clipping: string | null }>(
    `select clipping from ${table} where campana = $1 and influencer = $2 and clipping is not null limit 1`,
    [campana, influencer],
  );
  const url = rows[0]?.clipping;
  return url ? extractFolderId(url) : null;
}

// Extrae el número entre paréntesis del nombre de archivo (" (2)" en
// "Mathias Zaracho (2).mp4") — así es como viene ordenado hoy.
function fileRank(name: string): number {
  const m = name.match(/\((\d+)\)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

export async function listClipsRanked(folderId: string): Promise<DriveFile[]> {
  const files = await listFilesInFolder(folderId);
  return files.filter((f) => f.mimeType.startsWith("video/")).sort((a, b) => fileRank(a.name) - fileRank(b.name));
}

// rank es 1-based: 1 = la pieza con más visualizaciones de ese influencer
// en esa campaña (ver Destacadas en InfluencersDashboard, que calcula el
// rank a partir de las métricas reales antes de pedir esto).
export async function getClipForRank(
  client: string,
  campana: string,
  influencer: string,
  rank: number,
): Promise<DriveFile | null> {
  const folderId = await getClippingFolderId(client, campana, influencer);
  if (!folderId) return null;
  const clips = await listClipsRanked(folderId);
  return clips[rank - 1] ?? null;
}

// Resumen para la columna "Contenido" de la tabla Influencers: cuántas
// piezas tiene ese influencer en total (todas sus campañas) contra cuántos
// clips reales hay cargados para él. Un influencer puede tener varias
// campañas, cada una con su propia carpeta de clipping — se suman todas.
export type MediaSummary = { totalPieces: number; availableClips: number };

export async function getInfluencerMediaSummary(client: string, influencer: string): Promise<MediaSummary> {
  const table = tableFor(client);
  const rows = await queryReport<{ campana: string; piezas: string; clipping: string | null }>(
    `select campana, count(*)::int piezas, max(clipping) clipping from ${table} where influencer = $1 group by campana`,
    [influencer],
  );
  const totalPieces = rows.reduce((sum, r) => sum + Number(r.piezas), 0);
  let availableClips = 0;
  for (const r of rows) {
    const folderId = r.clipping ? extractFolderId(r.clipping) : null;
    if (!folderId) continue;
    try {
      const clips = await listClipsRanked(folderId);
      availableClips += clips.length;
    } catch {
      // Carpeta no legible para el Service Account — no suma, no revienta
      // el resto del resumen.
    }
  }
  return { totalPieces, availableClips };
}
