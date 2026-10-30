// Diagnóstico de la galería de material de Influencers — ver
// lib/googleInfluencerMedia.ts. Solo lee, no cambia nada. Sirve para ver,
// paso a paso, por qué una pieza no resuelve ningún clip sin tener que ir
// a buscarlo en la consola del navegador.
//
//   npx tsx scripts/debug-influencer-media.ts <clientSlug> "<campana>" "<influencer>"

import { queryReport } from "../lib/supabase/pg";
import { listFilesInFolder, getFileMeta } from "../lib/googleDrive";
import { getClippingFolderId, listClipsRanked } from "../lib/googleInfluencerMedia";

async function main() {
  const [client, campana, influencer] = process.argv.slice(2);
  if (!client || !campana || !influencer) {
    console.error('Uso: npx tsx scripts/debug-influencer-media.ts <clientSlug> "<campana>" "<influencer>"');
    process.exit(1);
  }

  const table = client === "deca" ? "gold_influencers_deca" : "gold_influencers_adecco";

  console.log(`\n1. Filas de ${table} para campana="${campana}" influencer="${influencer}":`);
  const rows = await queryReport<{ clipping: string | null; visualizaciones: number | null; scope_recibido_tipo: string | null; scope_recibido_numero: number | null }>(
    `select clipping, visualizaciones, scope_recibido_tipo, scope_recibido_numero from ${table} where campana = $1 and influencer = $2 order by visualizaciones desc nulls last`,
    [campana, influencer],
  );
  if (rows.length === 0) {
    console.log('   Ninguna. Revisá que "campana" e "influencer" sean el texto EXACTO (mayúsculas/tildes) como está en la base.');
    return;
  }
  rows.forEach((r, i) => console.log(`   [${i + 1}] ${r.scope_recibido_tipo} ${r.scope_recibido_numero} · vis=${r.visualizaciones} · clipping=${r.clipping}`));

  console.log(`\n2. getClippingFolderId("${client}", "${campana}", "${influencer}"):`);
  const folderId = await getClippingFolderId(client, campana, influencer);
  console.log(`   -> ${folderId}`);
  if (!folderId) {
    console.log("   No se pudo extraer un folderId del campo clipping (o no hay ninguna fila con clipping no nulo).");
    return;
  }

  console.log(`\n3. Metadata directa del id ${folderId} (confirma que exista de verdad, no solo "0 hijos"):`);
  const meta = await getFileMeta(folderId);
  if (!meta) {
    console.log("   El Service Account NO puede leer este id directamente (no existe, nunca se compartió, o está fuera de su alcance).");
    console.log("   Esto es DISTINTO de \"carpeta vacía\": acá el id en sí no resuelve, listFilesInFolder daría 0 igual sin que signifique que está vacía.");
    return;
  }
  console.log(`   -> nombre="${meta.name}" mimeType=${meta.mimeType} trashed=${meta.trashed}`);
  if (meta.mimeType !== "application/vnd.google-apps.folder") {
    console.log("   OJO: esto no es una carpeta — el link de \"clipping\" no apunta a una carpeta de Drive.");
  }
  if (meta.trashed) {
    console.log("   OJO: esta carpeta está en la papelera.");
  }

  console.log(`\n4. Contenido crudo de la carpeta ${folderId} (listFilesInFolder):`);
  try {
    const all = await listFilesInFolder(folderId);
    if (all.length === 0) {
      console.log("   Confirmado vacía de verdad: el id existe, el Service Account lo lee, y no tiene nada adentro.");
    }
    all.forEach((f) => console.log(`   - ${f.name} (${f.mimeType})`));
  } catch (e) {
    console.log(`   ERROR leyendo la carpeta: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  console.log(`\n5. listClipsRanked (solo videos, ordenados por "(N)"):`);
  const clips = await listClipsRanked(folderId);
  if (clips.length === 0) {
    console.log('   Ninguno — la carpeta no tiene archivos con mimeType que empiece con "video/".');
  } else {
    clips.forEach((c, i) => console.log(`   clip ${i + 1}: ${c.name} (${c.mimeType})`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
