import type { ReactNode } from "react";

/**
 * EN: Pass-through root layout. The real layout (with <html lang>) is src/app/[locale]/layout.tsx,
 *     because the language is only known inside [locale].
 * PT: Layout raiz que só passa o conteúdo. O layout real (com <html lang>) é src/app/[locale]/layout.tsx,
 *     porque o idioma só é conhecido dentro de [locale].
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
