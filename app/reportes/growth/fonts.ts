import { Anton, Roboto } from "next/font/google";

// Mismo criterio que app/reportes/influencers/fonts.ts: el artifact original
// usa fuentes custom ('MX Anton'/'MX Roboto') embebidas en base64 — acá se
// usan directamente las públicas de Google Fonts de las que son variantes.
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
