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
