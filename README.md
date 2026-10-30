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
3. (Opcional) En **Table Editor → meetings / documents**, agregá algunas filas para que
   el home muestre el preview de "Próximas reuniones" y "Últimos documentos" — son solo
   un resumen visual, la fuente completa sigue siendo `agenda_embed_url` y
   `drive_folder_url`.
4. (Opcional) Para que el cliente vea su "Perfomance snapshot" (las métricas reales del
   datalake), completá en su fila de `profiles`:
   - `fabric_sql_endpoint` y `fabric_database`: identifican su workspace de Fabric.
   Ver la sección **Fabric (datalake de MZ Solutions)** más abajo para el resto del setup.
5. (Opcional) En **Table Editor → insights_of_month**, cargá el análisis escrito del mes
   (`period`, `title`, `body`, `highlight` opcional) — es contenido propio de Moscu, no
   un dato del datalake, por eso vive en Supabase y no en Fabric.
6. El cliente entra a `/login` con su email/contraseña y ve su home personalizado.

Cualquier campo vacío muestra un estado "todavía no configurado" en vez de un iframe roto,
y las listas de reuniones/documentos muestran "no hay nada todavía" si están vacías.

## 5. Fabric (datalake de MZ Solutions)

Las métricas del "Perfomance snapshot" se leen en vivo desde el datalake, **no** se
duplican en Supabase — así el número vive en un solo lugar y nunca puede desincronizarse
entre dos sistemas. Cada cliente tiene su propio workspace en Microsoft Fabric; el portal
se conecta a través de un único service principal de Azure AD con permiso de lectura en
cada uno de esos workspaces.

### Setup (una vez, del lado de MZ Solutions / Azure)

1. Crear un **App Registration** en Azure AD (un service principal). Guardar su
   `Tenant ID`, `Client ID` y generar un `Client Secret`.
2. En Fabric, para cada workspace de cliente: **Manage access → agregar el service
   principal como Viewer** (o el rol mínimo que permita `SELECT` sobre el SQL analytics
   endpoint del Lakehouse/Warehouse).
3. En cada workspace, crear una vista `dbo.portal_metrics` con esta forma exacta —es el
   único contrato que el portal conoce, no le importa el modelado interno del datalake—:

   ```sql
   -- period: primer día del mes (ej. 2026-08-01)
   -- sentiment: 'positive' | 'negative' | 'neutral' (define el color en el portal)
   CREATE VIEW dbo.portal_metrics AS
   SELECT period, label, value_pct, sentiment, sort_order FROM ...
   ```

### Setup (en este proyecto)

1. Completá en `.env.local` (y en Vercel) las variables `AZURE_TENANT_ID`,
   `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` del service principal creado arriba.
2. En Supabase, en la fila del cliente en `profiles`, completá `fabric_sql_endpoint`
   (el SQL analytics endpoint de su workspace, algo como
   `xxxxxxxx.datawarehouse.fabric.microsoft.com`) y `fabric_database` (el nombre del
   Lakehouse/Warehouse).

Si esos dos campos están vacíos, o si Fabric no responde, la sección de "Perfomance
snapshot" simplemente no se muestra — nunca rompe el resto del home. Las consultas se
cachean 15 minutos por cliente (`lib/getHomeData.ts`) para no golpear Fabric en cada
carga de página.

## 6. Marca

Identidad real de Moscu ya aplicada, tomada del brandbook compartido:

- Logo: `public/moscu-logo.png` (wordmark blanco, extraído del brandbook para fondo oscuro).
- Colores en `app/globals.css`: fondo `#181818`, texto `#f2f2f2`, acento primario lima
  `#d7fa50` (el que usa el producto "COOLmetrics" de Moscu, tomado de referencia), y dos
  acentos secundarios disponibles (`--accent-orange` `#ff502e` institucional,
  `--accent-blue` `#0d5bf7`) para highlights puntuales si hace falta.
- Tipografía: el brandbook usa **Avenir Heavy Condensed** (títulos) y **Barlow**
  (subtítulos/texto). Avenir es una fuente de pago (Monotype) sin versión webfont
  gratuita, así que los títulos usan **Barlow Condensed** como sustituto libre —
  mismo espíritu grotesca condensada. Si Moscu tiene una licencia de Avenir para web,
  se puede reemplazar en `app/layout.tsx` (import de `next/font/google` por
  `next/font/local` con los archivos de la fuente).

## Deploy

Pensado para deployar en [Vercel](https://vercel.com/new), agregando las mismas
variables de entorno del paso 2 en la configuración del proyecto.
