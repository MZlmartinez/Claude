-- Módulo /morosidad: deudas de impuestos y servicios por propiedad.
-- Ejecutar en el SQL Editor del proyecto de Supabase.
--
-- La propiedad se identifica por partida inmobiliaria (API Santa Fe), única
-- por inmobiliaria. Las cuentas de servicio cuelgan de la propiedad. Cada
-- consulta a un ente se guarda como snapshot en `morosidad_consultas` (nunca
-- se pisa): permite ver la evolución de la deuda y auditar falsos positivos.

create table public.inmobiliarias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

-- Qué usuarios del portal operan cada inmobiliaria.
create table public.inmobiliaria_usuarios (
  inmobiliaria_id uuid not null references public.inmobiliarias (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (inmobiliaria_id, user_id)
);

create table public.propiedades (
  id uuid primary key default gen_random_uuid(),
  inmobiliaria_id uuid not null references public.inmobiliarias (id) on delete cascade,
  partida text not null,
  direccion text not null,
  ciudad text not null default 'Rosario',
  inquilino text,
  fin_contrato date,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (inmobiliaria_id, partida)
);

create table public.cuentas_servicio (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references public.propiedades (id) on delete cascade,
  proveedor text not null check (proveedor in ('api_santafe', 'tgi_rosario', 'litoral_gas', 'assa', 'epe')),
  identificador text not null,
  -- La cola del worker: toma las cuentas con proxima_consulta <= now().
  proxima_consulta timestamptz not null default now(),
  unique (propiedad_id, proveedor)
);

create index cuentas_servicio_cola on public.cuentas_servicio (proxima_consulta);

create table public.morosidad_consultas (
  id bigint generated always as identity primary key,
  cuenta_id uuid not null references public.cuentas_servicio (id) on delete cascade,
  consultado_en timestamptz not null default now(),
  ok boolean not null,
  -- Si ok = false: captcha | portal_caido | identificador_invalido | cambio_de_formato | error.
  -- La UI lo muestra como "Sin dato", nunca como "Al día".
  motivo text,
  -- [{ periodo, vencimiento, importe, boletaUrl, codigoPagoElectronico }]
  items jsonb not null default '[]'
);

create index morosidad_consultas_cuenta on public.morosidad_consultas (cuenta_id, consultado_en desc);

-- RLS: cada usuario ve solo las propiedades de sus inmobiliarias. El worker
-- escribe con la service role key (bypassa RLS).
alter table public.inmobiliarias enable row level security;
alter table public.inmobiliaria_usuarios enable row level security;
alter table public.propiedades enable row level security;
alter table public.cuentas_servicio enable row level security;
alter table public.morosidad_consultas enable row level security;

create policy "Ver mis inmobiliarias" on public.inmobiliarias for select
  using (id in (select inmobiliaria_id from public.inmobiliaria_usuarios where user_id = auth.uid()));

create policy "Ver mi membresía" on public.inmobiliaria_usuarios for select
  using (user_id = auth.uid());

create policy "Gestionar propiedades de mis inmobiliarias" on public.propiedades for all
  using (inmobiliaria_id in (select inmobiliaria_id from public.inmobiliaria_usuarios where user_id = auth.uid()))
  with check (inmobiliaria_id in (select inmobiliaria_id from public.inmobiliaria_usuarios where user_id = auth.uid()));

create policy "Gestionar cuentas de mis propiedades" on public.cuentas_servicio for all
  using (propiedad_id in (
    select p.id from public.propiedades p
    join public.inmobiliaria_usuarios iu on iu.inmobiliaria_id = p.inmobiliaria_id
    where iu.user_id = auth.uid()))
  with check (propiedad_id in (
    select p.id from public.propiedades p
    join public.inmobiliaria_usuarios iu on iu.inmobiliaria_id = p.inmobiliaria_id
    where iu.user_id = auth.uid()));

create policy "Ver consultas de mis cuentas" on public.morosidad_consultas for select
  using (cuenta_id in (
    select c.id from public.cuentas_servicio c
    join public.propiedades p on p.id = c.propiedad_id
    join public.inmobiliaria_usuarios iu on iu.inmobiliaria_id = p.inmobiliaria_id
    where iu.user_id = auth.uid()));
