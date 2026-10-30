// Recorre TODAS las combinaciones (campaña, influencer) que tienen un link
// de "clipping" cargado y dice cuántos archivos de video hay en cada
// carpeta — para saber de un vistazo dónde ya hay contenido real subido y
// dónde todavía no, sin tener que probar una por una. Solo lee.
//
//   npx tsx scripts/audit-influencer-media.ts [clientSlug]   (default: deca)

import { queryReport } from "../lib/supabase/pg";
import { listClipsRanked, getClippingFolderId } from "../lib/googleInfluencerMedia";

async function main() {
  const [client = "deca"] = process.argv.slice(2);
  const table = client === "deca" ? "gold_influencers_deca" : "gold_influencers_adecco";

  const combos = await queryReport<{ campana: string; influencer: string }>(
    `select distinct campana, influencer from ${table} where clipping is not null order by campana, influencer`,
  );

  console.log(`${combos.length} combinaciones (campaña, influencer) con clipping cargado:\n`);

  let conContenido = 0;
  for (const { campana, influencer } of combos) {
    const folderId = await getClippingFolderId(client, campana, influencer);
    if (!folderId) {
      console.log(`- ${campana} / ${influencer}: no se pudo extraer folderId`);
      continue;
    }
    try {
      const clips = await listClipsRanked(folderId);
      const marca = clips.length > 0 ? "★" : " ";
      console.log(`${marca} ${campana} / ${influencer}: ${clips.length} video(s)`);
      if (clips.length > 0) conContenido++;
    } catch (e) {
      console.log(`! ${campana} / ${influencer}: ERROR leyendo carpeta — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n${conContenido} de ${combos.length} carpetas tienen al menos un video cargado.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
