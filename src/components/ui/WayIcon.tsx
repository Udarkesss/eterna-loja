import { Icon } from "./Icon";

/**
 * EN: Icon of a sign-in way (owner 2026-11-23: the buttons had none). Google and Facebook use their own marks, as their
 *     sign-in guidelines ask; e-mail and WhatsApp use the site's line icons.
 * PT: Ícone de uma forma de entrar (dona 23-11-2026: os botões não tinham). Google e Facebook usam as suas marcas, como
 *     pedem as regras deles para botões de entrada; e-mail e WhatsApp usam os ícones de linha do site.
 */
export function WayIcon({ way, size = 18 }: { way: "email" | "whatsapp" | "google" | "facebook"; size?: number }) {
  if (way === "google")
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: "none" }}>
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
        <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
      </svg>
    );
  if (way === "facebook")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path fill="#fff" d="M15.1 15.5l.5-3.5h-3.3V9.8c0-1 .5-1.9 2-1.9h1.5V5c0 0-1.4-.2-2.7-.2-2.8 0-4.6 1.7-4.6 4.7V12H5.4v3.5h3.1V24h3.8v-8.5h2.8z" />
      </svg>
    );
  return <Icon name={way === "email" ? "mail" : "whatsapp"} size={size} />;
}
