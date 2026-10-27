import { Anton, Roboto } from "next/font/google";

// Mismas fuentes que el resto de los reportes (ver
// app/reportes/influencers/fonts.ts) — identidad visual de COOLmetrics.
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
