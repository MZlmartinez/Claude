-- Ejecutar en el SQL Editor del proyecto de Supabase.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  company text,
  cover_image_url text,
  dashboard_embed_url text,
  drive_folder_url text,
  agenda_embed_url text,
  insights_embed_url text,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Próximas reuniones que se muestran como preview en el home (la agenda
-- completa para reservar sigue siendo el embed de agenda_embed_url).
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  meeting_at timestamptz not null,
  link text,
  created_at timestamptz not null default now()
);

alter table public.meetings enable row level security;

create policy "Users can view their own meetings"
  on public.meetings for select
  using (auth.uid() = profile_id);

-- Documentos destacados que se muestran como preview en el home (la carpeta
-- completa sigue siendo el embed de drive_folder_url).
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  kind text,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "Users can view their own documents"
  on public.documents for select
  using (auth.uid() = profile_id);

-- Métricas del "Perfomance snapshot" del home, una fila por indicador y
-- período (mes). El admin las carga a mano por cliente; no hay integración
-- automática con ninguna fuente de datos.
create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  period date not null, -- primer día del mes, ej. 2026-08-01
  label text not null,
  value_pct numeric not null,
  sentiment text not null default 'neutral' check (sentiment in ('positive', 'negative', 'neutral')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.metrics enable row level security;

create policy "Users can view their own metrics"
  on public.metrics for select
  using (auth.uid() = profile_id);

-- Insight del mes que acompaña al snapshot, uno por período.
create table public.insights_of_month (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  period date not null,
  title text not null,
  body text not null,
  highlight text,
  created_at timestamptz not null default now(),
  unique (profile_id, period)
);

alter table public.insights_of_month enable row level security;

create policy "Users can view their own insights"
  on public.insights_of_month for select
  using (auth.uid() = profile_id);

-- Crea automáticamente una fila vacía en profiles cuando el admin invita
-- a un usuario nuevo desde Supabase Auth. El admin completa el resto de
-- los campos (portada, links) desde el Table Editor.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
