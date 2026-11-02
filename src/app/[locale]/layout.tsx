import type { Metadata, Viewport } from "next";
import { Cinzel, Cinzel_Decorative, Cormorant_Garamond, Jost, Pinyon_Script } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CustomerProvider } from "@/components/account/CustomerProvider";
import { CartProvider } from "@/components/cart/CartProvider";
import { FavoritesProvider } from "@/components/favorites/FavoritesProvider";
import { site } from "@/data/site";
import { getDictionary } from "@/i18n";
import { HTML_LANG, LOCALES, isLocale } from "@/i18n/config";
import { I18nProvider } from "@/i18n/I18nProvider";
import { currentCustomer, toCustomerDTO } from "@/server/accounts";
import "../globals.css";

// EN: Design system v8 typefaces: Cormorant Garamond (with italics) and Jost everywhere; Cinzel, Pinyon Script and
//     Cinzel Decorative only for short accents (not preloaded). PT: Letras do design system v8; as três últimas só para
//     destaques curtos (sem pré-carregamento).
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const sans = Jost({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-jost", display: "swap" });
const caps = Cinzel({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-cinzel", display: "swap", preload: false });
const script = Pinyon_Script({ subsets: ["latin"], weight: "400", variable: "--font-pinyon", display: "swap", preload: false });
const deco = Cinzel_Decorative({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-cinzel-deco", display: "swap", preload: false });

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

// EN: Pages read live stock, prices and content from the database on every request.
// PT: As páginas lêem stock, preços e conteúdo da base de dados em cada pedido.
export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#FAF7F2" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    metadataBase: new URL(site.url),
    title: { default: dict.meta.title, template: "%s · Eterna" },
    description: dict.meta.description,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [HTML_LANG[l], `/${l}`])) },
    openGraph: { siteName: "Eterna", locale: HTML_LANG[locale], type: "website" },
  };
}

/**
 * EN: Root of every page: language, fonts and the shared state (customer, cart, favourites). The visible frame
 *     (header/footer) is chosen by the route groups: (site) for the store, checkout for the payment flow.
 * PT: Raiz de todas as páginas: idioma, letras e estado partilhado (carrinho, favoritos). A moldura visível
 *     (cabeçalho/rodapé) é escolhida pelos grupos de rotas: (site) para a loja, checkout para o pagamento.
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const customerRow = await currentCustomer();
  const customer = customerRow ? await toCustomerDTO(customerRow) : null;

  return (
    <html lang={HTML_LANG[locale]} className={`${serif.variable} ${sans.variable} ${caps.variable} ${script.variable} ${deco.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          {dict.common.skipToContent}
        </a>
        <I18nProvider locale={locale}>
          <CustomerProvider initial={customer}>
            <CartProvider>
              <FavoritesProvider>{children}</FavoritesProvider>
            </CartProvider>
          </CustomerProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
