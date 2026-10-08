import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { currentCustomer, toCustomerDTO } from "@/server/accounts";
import { listCustomerFittings } from "@/server/fittings";
import { listCustomerOrders } from "@/server/orders";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).account.dashboardEyebrow, robots: { index: false } };
}

/**
 * EN: Customer area: orders, fittings, favourites, personal details and "Formas de entrar".
 *     Without a session it sends the visitor to the sign-in page and back here afterwards.
 * PT: Área de cliente: encomendas, provas, favoritos, dados pessoais e "Formas de entrar".
 *     Sem sessão, envia para a página de entrar e volta aqui depois.
 */
export default async function AccountPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const row = await currentCustomer();
  if (!row) redirect(`/${locale}/sign-in?next=/${locale}/account`);

  const [customer, orders, fittings] = await Promise.all([
    toCustomerDTO(row),
    listCustomerOrders(row.id),
    listCustomerFittings(row.id, locale),
  ]);
  return <AccountDashboard customer={customer} orders={orders} fittings={fittings} />;
}
