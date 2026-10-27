-- Mapeo client_slug -> carpeta de Google Drive, para la sección Documentos
-- (ver app/documentos). Una fila por cliente, no por usuario (a diferencia
-- de client_users, que es por email) — evita repetir el mismo folder_id en
-- cada fila de usuario de un mismo cliente.
--
-- El servidor resuelve siempre el client_slug del lado server (token HMAC +
-- client_users, ver lib/assistant/clientAuth.ts) y busca ACÁ el
-- drive_folder_id correspondiente — nunca a partir de un valor mandado por
-- el browser. El Service Account de Google (coolmetrics-drive@...) solo
-- tiene permiso de lectura sobre las carpetas que se comparten a mano con
-- esa cuenta; esta tabla es el único lugar donde se guarda qué ID le
-- corresponde a cada cliente.

create table public.client_drive_folders (
  client_slug text primary key,
  drive_folder_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.client_drive_folders enable row level security;

-- Sin policy de SELECT a propósito: deny-all, igual que las gold_* sin
-- policy. Solo la lee el servidor con la service role key (bypassa RLS) —
-- ni el browser ni los roles readonly del asistente la necesitan.

insert into public.client_drive_folders (client_slug, drive_folder_id) values
  ('deca', '1882s3sR_FNXRG67EA9iD0UKNUJ3f8VPQ'),
  ('adecco', '1m2BPSN63dDK7c2QkNEuPinYHAG4EXghS');
