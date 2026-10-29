-- Mapeo (client_slug, campana) -> carpeta de Google Drive con el material
-- (clips) de esa campaña, para la galería de material de Influencers v2
-- (ver lib/googleInfluencerMedia.ts). Una fila por campaña, no una sola por
-- cliente como client_drive_folders: cada campaña de Decathlon tiene su
-- propia carpeta de clipping dentro de 05_INFLUENCERS, con nombres que no
-- coinciden con el texto de "campana" en gold_influencers_* (ej. carpeta
-- "ABASTO" vs. campana "Lanzamiento Cordoba"), así que no hay forma de
-- resolverlo sin este mapeo manual.
--
-- Dentro de esa carpeta, cada influencer tiene su propia subcarpeta con sus
-- clips (ver listInfluencerClips) — eso SÍ se resuelve por nombre, porque el
-- nombre de la subcarpeta coincide con el campo "influencer" de la planilla.
--
-- No hay correspondencia confirmada entre el número de archivo "(N).mp4" y
-- el número de pieza (formato+numero) de las métricas — por eso esto se
-- expone como una galería por influencer+campaña, nunca atado a una fila
-- puntual de gold_influencers_*.
--
-- El servidor resuelve siempre el client_slug del lado server (token HMAC +
-- client_users) y busca ACÁ el drive_folder_id correspondiente a la
-- campaña pedida — "campana" llega como parámetro del browser (igual que
-- el filtro "campana" que ya existe en /reportes/influencers), pero nunca
-- puede escapar del propio client_slug: esta tabla solo tiene filas del
-- cliente ya autenticado, así que como mucho devuelve "no hay carpeta para
-- esa campaña", nunca la carpeta de otro cliente.

create table public.client_influencer_media_folders (
  client_slug text not null,
  campana text not null,
  drive_folder_id text not null,
  updated_at timestamptz not null default now(),
  primary key (client_slug, campana)
);

alter table public.client_influencer_media_folders enable row level security;

-- Sin policy de SELECT a propósito: deny-all. Solo la lee el servidor con
-- la service role key (bypassa RLS), igual que client_drive_folders y
-- client_calendars.
