import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, isLocale, type Locale } from "@/i18n/config";

/**
 * EN: Every page lives under /pt or /en. A path without a language is redirected:
 *     1) to the language the visitor chose before (cookie), 2) to the browser's language, 3) to Portuguese.
 * PT: Todas as páginas vivem em /pt ou /en. Um caminho sem idioma é redireccionado:
 *     1) para o idioma escolhido antes (cookie), 2) para o idioma do browser, 3) para português.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${detectLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

function detectLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  const accepted = request.headers.get("accept-language") ?? "";
  const preferred = accepted
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase())
    .find((code) => (LOCALES as readonly string[]).includes(code));
  return isLocale(preferred) ? preferred : DEFAULT_LOCALE;
}

export const config = {
  // EN: Skip the API, the back-office (/gestao, Portuguese only), Next.js internals and static files.
  // PT: Ignorar a API, a gestão (/gestao, só em português), ficheiros internos e estáticos.
  matcher: ["/((?!api|gestao|_next|.*\\..*).*)"],
};
