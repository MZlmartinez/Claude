import { queryReport } from "@/lib/supabase/pg";
import { listFilesInFolder, getFileMeta, type DriveFile } from "@/lib/googleDrive";

// Galería de material (clips) de Influencers. La propia tabla de métricas
// trae en la columna "clipping" el link al material de cada influencer
// (el mismo link se repite en todas las filas de ese influencer para esa
// campaña) — no hace falta ningún mapeo manual aparte.
//
// "clipping" puede ser de dos formas:
// - Un link a una CARPETA (".../folders/<id>") con "(1).mp4, (2).mp4..."
//   ordenados por visualizaciones de mayor a menor (confirmado con el
//   equipo) — ahí sí tiene sentido el ranking por pieza.
// - Un link a un ARCHIVO puntual (".../file/d/<id>/...") — un solo video
//   para todo ese influencer+campaña, se expone nada más en el rank 1 (no
//   hay con qué repartir entre varias piezas).

function tableFor(client: string): string {
  return client === "deca" ? "gold_influencers_deca" : "gold_influencers_adecco";
}

type ClippingTarget = { kind: "folder" | "file"; id: string };

function parseClippingUrl(clippingUrl: string): ClippingTarget | null {
  const folder = clippingUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folder) return { kind: "folder", id: folder[1] };
  const file = clippingUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (file) return { kind: "file", id: file[1] };
  return null;
}

// "campana"/"influencer" llegan como parámetro del browser, pero la
// consulta está siempre acotada a la tabla gold_* del client_slug ya
// resuelto server-side — como mucho, esto devuelve "no hay clipping para
// esa combinación" de tu propio cliente, nunca el de otro.
async function getClippingTarget(client: string, campana: string, influencer: string): Promise<ClippingTarget | null> {
  const table = tableFor(client);
  const rows = await queryReport<{ clipping: string | null }>(
    `select clipping from ${table} where campana = $1 and influencer = $2 and clipping is not null limit 1`,
    [campana, influencer],
  );
  const url = rows[0]?.clipping;
  return url ? parseClippingUrl(url) : null;
}

// El "root" a validar con isWithinRoot al descargar: la carpeta entera
// (puede navegarse a cualquier archivo de adentro) o, si es un archivo
// puntual, el id del archivo mismo (isWithinRoot ya da true de entrada
// cuando itemId === rootId, así que un solo archivo queda cubierto igual).
export async function getClippingRootId(client: string, campana: string, influencer: string): Promise<string | null> {
  const target = await getClippingTarget(client, campana, influencer);
  return target?.id ?? null;
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

async function resolveClips(target: ClippingTarget): Promise<DriveFile[]> {
  if (target.kind === "folder") {
    return listClipsRanked(target.id);
  }
  // Archivo puntual: un solo clip, no hay nada que ordenar.
  const meta = await getFileMeta(target.id);
  if (!meta || meta.trashed || !meta.mimeType.startsWith("video/")) return [];
  return [
    {
      id: meta.id,
      name: meta.name,
      mimeType: meta.mimeType,
      modifiedTime: null,
      size: null,
      webViewLink: null,
      shortcutTargetId: null,
      shortcutTargetMimeType: null,
    },
  ];
}

// rank es 1-based: 1 = la pieza con más visualizaciones de ese influencer
// en esa campaña (ver Destacadas en InfluencersDashboard, que calcula el
// rank a partir de las métricas reales antes de pedir esto). Si "clipping"
// es un archivo puntual, solo el rank 1 devuelve algo.
export async function getClipForRank(
  client: string,
  campana: string,
  influencer: string,
  rank: number,
): Promise<DriveFile | null> {
  const target = await getClippingTarget(client, campana, influencer);
  if (!target) return null;
  const clips = await resolveClips(target);
  return clips[rank - 1] ?? null;
}

// Resumen para la columna "Contenido" de la tabla Influencers: cuántas
// piezas tiene ese influencer en total (todas sus campañas) contra cuántos
// clips reales hay cargados para él. Un influencer puede tener varias
// campañas, cada una con su propio link de clipping — se suman todas.
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
    const target = r.clipping ? parseClippingUrl(r.clipping) : null;
    if (!target) continue;
    try {
      const clips = await resolveClips(target);
      availableClips += clips.length;
    } catch {
      // No legible para el Service Account — no suma, no revienta el resto
      // del resumen.
    }
  }
  return { totalPieces, availableClips };
}
