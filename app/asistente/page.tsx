import AsistenteChat from "./AsistenteChat";
import { mxBody, mxDisplay } from "./fonts";

export const dynamic = "force-dynamic";

export default function AsistentePage() {
  return <AsistenteChat fontClassName={`${mxDisplay.variable} ${mxBody.variable}`} />;
}
