import { Anton, Roboto } from "next/font/google";

// El artifact original de claude.ai usa fuentes custom ('MX Anton'/'MX Roboto')
// embebidas en base64 (cientos de KB) — acá usamos directamente las públicas
// de Google Fonts de las que esas son variantes, que son el siguiente fallback
// en su propia pila de fuentes.
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
