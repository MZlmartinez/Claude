import { Anton, Roboto } from "next/font/google";

// Mismo criterio que el resto de /reportes/*: tipografía MOSCU (Anton +
// Roboto) para que el asistente se sienta parte del mismo portal.
export const mxDisplay = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mx-display",
});

export const mxBody = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mx-body",
});
