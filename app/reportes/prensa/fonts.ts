import { Anton, Roboto, Roboto_Condensed } from "next/font/google";

// Mismas familias que el resto de los reportes "Moscú v2" (ver
// app/reportes/influencers/fonts.ts para el precedente de este patrón).
export const prDisplay = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pr-display",
});

export const prBody = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-pr-body",
});

export const prMono = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-pr-mono",
});
