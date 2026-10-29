-- Mapeo client_slug -> calendario de Google, para la sección Agenda (ver
-- app/agenda/secure). Mismo criterio que client_drive_folders: un
-- calendario de Google dedicado por cliente, compartido a mano con el
-- mismo Service Account que usa Drive (coolmetrics-drive@...) — nunca un
-- calendario único con eventos de todos los clientes mezclados y
-- clasificados por texto/color. La separación la garantiza Google al
-- compartir cada calendario, no una lógica de clasificación en código.

create table public.client_calendars (
  client_slug text primary key,
  calendar_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.client_calendars enable row level security;

-- Sin policy de SELECT a propósito: deny-all, igual que client_drive_folders.
-- Solo la lee el servidor con la service role key (bypassa RLS).
