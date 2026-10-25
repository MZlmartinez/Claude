import AsistenteChat from "./AsistenteChat";
import { listSavedReports } from "@/lib/assistant/savedReports";
import { mxBody, mxDisplay } from "./fonts";

export const dynamic = "force-dynamic";

// "u" identifica a quién guarda cada reporte — lo manda el script de Softr
// como query param con el mail del usuario logueado (window.logged_in_user).
// Sin esto no hay forma de saber de quién es cada guardado: la página no
// tiene login propio, confía en el que ya hizo Softr.
//
// "t" es la firma de ese mismo email (ver lib/assistant/clientAuth.ts):
// Softr no la calcula, solo la reenvía desde un campo ya precalculado por
// nosotros — así el chat (que decide de qué cliente son los datos) puede
// verificar que el email no fue editado a mano en la URL.
export default async function AsistentePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const u = params.u;
  const t = params.t;
  const userId = (Array.isArray(u) ? u[0] : u) || null;
  const token = (Array.isArray(t) ? t[0] : t) || null;

  const initialSaved = userId ? await listSavedReports(userId) : [];

  return (
    <AsistenteChat
      fontClassName={`${mxDisplay.variable} ${mxBody.variable}`}
      userId={userId}
      token={token}
      initialSaved={initialSaved}
    />
  );
}
