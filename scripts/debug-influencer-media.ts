// Diagnóstico de la galería de material de Influencers — ver
// lib/googleInfluencerMedia.ts. Solo lee, no cambia nada. Sirve para ver,
// paso a paso, por qué una pieza no resuelve ningún clip sin tener que ir
// a buscarlo en la consola del navegador.
//
//   npx tsx scripts/debug-influencer-media.ts <clientSlug> "<campana>" "<influencer>"

import { queryReport } from "../lib/supabase/pg";
import { listFilesInFolder, getFileMeta } from "../lib/googleDrive";
import { getClippingRootId, getClipForRank } from "../lib/googleInfluencerMedia";

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

  console.log(`\n2. getClippingRootId("${client}", "${campana}", "${influencer}"):`);
  const rootId = await getClippingRootId(client, campana, influencer);
  console.log(`   -> ${rootId}`);
  if (!rootId) {
    console.log("   No se pudo extraer un id del campo clipping (ni /folders/ ni /file/d/) o no hay ninguna fila con clipping no nulo.");
    return;
  }

  console.log(`\n3. Metadata directa del id ${rootId} (confirma que exista de verdad, no solo "0 hijos"):`);
  const meta = await getFileMeta(rootId);
  if (!meta) {
    console.log("   El Service Account NO puede leer este id directamente (no existe, nunca se compartió, o está fuera de su alcance).");
    console.log('   Esto es DISTINTO de "vacía": acá el id en sí no resuelve.');
    return;
  }
  const esCarpeta = meta.mimeType === "application/vnd.google-apps.folder";
  console.log(`   -> nombre="${meta.name}" mimeType=${meta.mimeType} trashed=${meta.trashed} (${esCarpeta ? "carpeta" : "archivo puntual"})`);
  if (meta.trashed) console.log("   OJO: está en la papelera.");

  if (esCarpeta) {
    console.log(`\n4. Contenido crudo de la carpeta ${rootId} (listFilesInFolder):`);
    try {
      const all = await listFilesInFolder(rootId);
      if (all.length === 0) console.log("   Confirmado vacía de verdad: el id existe, el Service Account lo lee, y no tiene nada adentro.");
      all.forEach((f) => console.log(`   - ${f.name} (${f.mimeType})`));
    } catch (e) {
      console.log(`   ERROR leyendo la carpeta: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
  } else if (!meta.mimeType.startsWith("video/")) {
    console.log(`\n4. Este archivo no es un video (mimeType=${meta.mimeType}) — no se va a mostrar.`);
  }

  console.log(`\n5. getClipForRank (lo que de verdad devuelve la API, probando rank 1 a 3):`);
  for (let rank = 1; rank <= 3; rank++) {
    const clip = await getClipForRank(client, campana, influencer, rank);
    console.log(`   rank ${rank}: ${clip ? `${clip.name} (${clip.mimeType})` : "null"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
