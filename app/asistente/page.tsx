import AsistenteChat from "./AsistenteChat";
import { listSavedReports } from "@/lib/assistant/savedReports";
import { mxBody, mxDisplay } from "./fonts";

export const dynamic = "force-dynamic";

// "u" identifica a quién guarda cada reporte — lo manda el script de Softr
// como query param con el mail del usuario logueado (window.logged_in_user).
// Sin esto no hay forma de saber de quién es cada guardado: la página no
// tiene login propio, confía en el que ya hizo Softr.
export default async function AsistentePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const u = params.u;
  const userId = (Array.isArray(u) ? u[0] : u) || null;

  const initialSaved = userId ? await listSavedReports(userId) : [];

  return (
    <AsistenteChat
      fontClassName={`${mxDisplay.variable} ${mxBody.variable}`}
      userId={userId}
      initialSaved={initialSaved}
    />
  );
}
