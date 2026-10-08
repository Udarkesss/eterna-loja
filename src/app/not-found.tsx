import Link from "next/link";
import "./globals.css";

/**
 * EN: 404 for URLs outside any language. It has its own <html> because the root layout is a pass-through.
 * PT: 404 para endereços fora de qualquer idioma. Tem o seu próprio <html> porque o layout raiz só passa o conteúdo.
 */
export default function RootNotFound() {
  return (
    <html lang="pt-MZ">
      <body>
        <main className="page-x" style={{ paddingBlock: 64, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h1 className="serif" style={{ fontSize: 44, fontWeight: 300 }}>Página não encontrada · Page not found</h1>
            <p>
              <Link href="/pt" className="underline">
                Voltar ao início
              </Link>{" "}
              ·{" "}
              <Link href="/en" className="underline">
                Back to home
              </Link>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
