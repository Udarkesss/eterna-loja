import type { NextConfig } from "next";

/**
 * EN: Addresses of the old eterna.co.mz site → new pages, so Google results and shared links keep working.
 * PT: Endereços do site antigo eterna.co.mz → páginas novas, para os resultados do Google e links partilhados continuarem a funcionar.
 */
const legacyRedirects = [
  { source: "/produtos/:slug", destination: "/pt/category/:slug" },
  { source: "/produto/:code", destination: "/pt/product/:code" },
  ...["noivas", "ocasioes", "beyond-time", "acessorios", "modeladores"].map((slug) => ({
    source: `/${slug}`,
    destination: `/pt/category/${slug}`,
  })),
  { source: "/sobre-nos", destination: "/pt/about" },
  { source: "/contactos", destination: "/pt/contact" },
  { source: "/agendamento", destination: "/pt/fitting" },
].map((r) => ({ ...r, permanent: true }));

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // EN: Photos uploaded online live in Vercel Blob. PT: As fotos carregadas online ficam no Vercel Blob.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },

  // EN: PGlite loads WebAssembly files at runtime; do not bundle it. PT: O PGlite carrega WebAssembly; não o empacotar.
  serverExternalPackages: ["@electric-sql/pglite"],

  async redirects() {
    return legacyRedirects;
  },

  // EN: Basic security headers for every response.
  // PT: Cabeçalhos de segurança básicos em todas as respostas.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
