import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import type { ReactNode } from "react";
import "../globals.css";

/**
 * EN: Root of the back-office (/gestao). Portuguese only, like the design; never indexed by search engines.
 *     The design's typefaces and tokens are the same as the store's.
 * PT: Raiz da gestão (/gestao). Só em português, como no design; nunca indexada pelos motores de pesquisa.
 */

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const sans = Jost({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-jost", display: "swap" });

export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: "#1C1917" };
export const metadata: Metadata = {
  title: { default: "Eterna Gestão", template: "%s · Eterna Gestão" },
  robots: { index: false, follow: false },
};

export default function GestaoRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-MZ" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
