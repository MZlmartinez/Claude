# Portal de clientes — Moscu

Portal de clientes con un único login (Next.js + Supabase). Cada cliente ve, según su
propio perfil, su dashboard, sus archivos de Drive, su agenda de reuniones y sus insights.

## 1. Crear el proyecto de Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Entrá a **SQL Editor** y ejecutá el contenido de `supabase/schema.sql`. Esto crea la
   tabla `profiles`, las políticas de RLS (cada usuario solo ve su propia fila) y el
   trigger que crea una fila vacía en `profiles` cada vez que se invita a un usuario.
3. En **Project Settings → API** copiá la `Project URL` y la `anon public key`.

## 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Completá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los valores del
paso anterior.

## 3. Correr en desarrollo

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## 4. Dar de alta un cliente

No hay auto-registro: los clientes son invitados por el equipo de Moscu.

1. En Supabase, **Authentication → Users → Invite user**, con el email del cliente. Esto
   dispara el trigger y crea su fila en `profiles` (le llega un mail para poner
   contraseña, o podés setarle una directamente).
2. En **Table Editor → profiles**, completá su fila:
   - `full_name`, `company`
   - `cover_image_url`: imagen de portada personalizada del home.
   - `drive_folder_url`: link normal de "compartir" de una carpeta de Drive
     (`.../drive/folders/<id>`) — la app lo convierte automáticamente a un formato
     embebible.
   - `agenda_embed_url`: link embebible de Calendly, o un Google Calendar público.
   - `dashboard_embed_url` / `insights_embed_url`: link embebible del reporte
     correspondiente (Looker Studio, Metabase, etc.).
3. El cliente entra a `/login` con su email/contraseña y ve su home con las 4 secciones.

Cualquier campo vacío muestra un estado "todavía no configurado" en vez de un iframe roto.

## 5. Marca

Los colores están centralizados como variables CSS en `app/globals.css`
(`--background`, `--foreground`, `--accent`). Hoy son un placeholder — se actualizan ahí
en cuanto tengamos el logo/paleta real de Moscu (falta compartir esos assets).

## Deploy

Pensado para deployar en [Vercel](https://vercel.com/new), agregando las mismas
variables de entorno del paso 2 en la configuración del proyecto.
