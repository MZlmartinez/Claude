// Recorre TODAS las combinaciones (campaña, influencer) que tienen un link
// de "clipping" cargado y dice cuántos clips reales hay para cada una —
// para saber de un vistazo dónde ya hay contenido real y dónde no, sin
// tener que probar una por una. Solo lee. "clipping" puede ser un link a
// una carpeta o a un archivo puntual (ver lib/googleInfluencerMedia.ts).
//
//   npx tsx scripts/audit-influencer-media.ts [clientSlug]   (default: deca)

import { queryReport } from "../lib/supabase/pg";
import { getClippingRootId, getClipForRank } from "../lib/googleInfluencerMedia";
import { getFileMeta } from "../lib/googleDrive";

async function main() {
  const [client = "deca"] = process.argv.slice(2);
  const table = client === "deca" ? "gold_influencers_deca" : "gold_influencers_adecco";

  const combos = await queryReport<{ campana: string; influencer: string }>(
    `select distinct campana, influencer from ${table} where clipping is not null order by campana, influencer`,
  );

  console.log(`${combos.length} combinaciones (campaña, influencer) con clipping cargado:\n`);

  let conContenido = 0;
  let rotas = 0;
  let vacias = 0;
  for (const { campana, influencer } of combos) {
    const rootId = await getClippingRootId(client, campana, influencer);
    if (!rootId) {
      console.log(`- ${campana} / ${influencer}: no se pudo extraer un id (ni /folders/ ni /file/d/)`);
      continue;
    }
    const meta = await getFileMeta(rootId);
    if (!meta) {
      console.log(`✗ ${campana} / ${influencer}: el id no existe / no es accesible (link roto)`);
      rotas++;
      continue;
    }
    const tipo = meta.mimeType === "application/vnd.google-apps.folder" ? "carpeta" : "archivo";
    try {
      const clip1 = await getClipForRank(client, campana, influencer, 1);
      const marca = clip1 ? "★" : " ";
      console.log(`${marca} ${campana} / ${influencer}: ${tipo} "${meta.name}" — ${clip1 ? `clip 1 = ${clip1.name}` : "sin clip de video usable"}`);
      if (clip1) conContenido++;
      else vacias++;
    } catch (e) {
      console.log(`! ${campana} / ${influencer}: ERROR — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n${conContenido} con video · ${vacias} sin video (pero reales) · ${rotas} con link roto/inaccesible · ${combos.length} total.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
