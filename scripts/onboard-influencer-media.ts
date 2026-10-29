// Mapea una campaña a su carpeta de Drive con el material (clips) de
// Influencers — ver lib/googleInfluencerMedia.ts y
// supabase/schema_client_influencer_media.sql para el porqué (los nombres
// de carpeta no coinciden con el texto de "campana" en gold_influencers_*,
// así que esto se carga a mano, una vez por campaña).
//
//   npx tsx scripts/onboard-influencer-media.ts <clientSlug> "<campana exacta>" <driveFolderId>
//
// driveFolderId es el de la carpeta de CLIPPING de esa campaña (la que
// tiene una subcarpeta por influencer adentro, ej. ".../ABASTO/Clipping
// Pre-Apertura"), no la carpeta de la campaña entera ni la de
// 05_INFLUENCERS. El Service Account ya tiene que poder leerla (si la
// carpeta raíz de Influencers ya se compartió con
// coolmetrics-drive@moscu-coolmetrics.iam.gserviceaccount.com, las
// subcarpetas la heredan solas).

import { createAdminClient } from "../lib/supabase/admin";

const KNOWN_CLIENT_SLUGS = ["deca", "adecco"] as const;

async function main() {
  const [clientSlug, campana, driveFolderId] = process.argv.slice(2);
  if (!clientSlug || !campana || !driveFolderId) {
    console.error('Uso: npx tsx scripts/onboard-influencer-media.ts <clientSlug> "<campana exacta>" <driveFolderId>');
    process.exit(1);
  }
  if (!(KNOWN_CLIENT_SLUGS as readonly string[]).includes(clientSlug)) {
    console.error(`"${clientSlug}" no es un client_slug conocido (${KNOWN_CLIENT_SLUGS.join(", ")}).`);
    process.exit(1);
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("client_influencer_media_folders")
    .upsert({ client_slug: clientSlug, campana, drive_folder_id: driveFolderId, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Error guardando en Supabase: ${error.message}`);

  console.log(`Listo. "${campana}" (${clientSlug}) ya apunta a la carpeta de material ${driveFolderId}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
