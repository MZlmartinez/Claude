import { Anton, Roboto, Roboto_Condensed } from "next/font/google";

// Mismas familias que usa el artifact de referencia (Anton + Roboto +
// Roboto Condensed para los números), vía Google Fonts en vez del
// <link> que usaba el HTML original — ver app/reportes/influencers/fonts.ts
// para el precedente de este mismo patrón.
export const infDisplay = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-inf-display",
});

export const infBody = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-inf-body",
});

export const infMono = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-inf-mono",
});
