import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import type { ClientSlug } from "@/lib/goldTables";
import DocumentosDashboard from "./DocumentosDashboard";
import { mxBody, mxDisplay } from "./fonts";

export const dynamic = "force-dynamic";

// Mismo esquema que /reportes/influencers/secure y /reportes/growth/secure:
// candado de identidad server-side antes de mostrar nada. A diferencia de
// esos reportes, acá los datos (archivos de Drive) los pide el componente
// cliente por su cuenta a /api/documentos/list — no hay forma de saber de
// antemano qué subcarpetas va a navegar el usuario, así que no tiene
// sentido precargar todo server-side como en Influencers.
const ALLOWED_CLIENTS: ClientSlug[] = ["deca", "adecco"];

export default async function SecureDocumentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

  const email = one(params.u);
  const token = one(params.t);

  if (!email || !verifyEmailToken(email, token)) {
    return <Unauthorized reason="No se pudo verificar el usuario." />;
  }
  const clientSlug = await getClientSlugForEmail(email);
  if (!clientSlug || !ALLOWED_CLIENTS.includes(clientSlug as ClientSlug)) {
    return <Unauthorized reason="Este reporte no está disponible para tu cuenta." />;
  }

  return (
    <DocumentosDashboard email={email} token={token!} fontClassName={`${mxDisplay.variable} ${mxBody.variable}`} />
  );
}

// Fondo y color propios, no heredados — ver el mismo comentario en
// app/reportes/growth/secure/page.tsx.
function Unauthorized({ reason }: { reason: string }) {
  return (
    <div
      style={{
        padding: 40,
        fontFamily: "sans-serif",
        color: "#1d1d1b",
        background: "#ffffff",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <p>{reason}</p>
    </div>
  );
}
