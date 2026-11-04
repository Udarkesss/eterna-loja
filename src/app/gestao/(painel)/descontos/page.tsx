import Link from "next/link";
import c from "@/components/admin/AdminV3.module.css";
import d3 from "@/components/admin/Dashboard.module.css";
import d from "@/components/admin/Discounts.module.css";
import { PageTop } from "@/components/admin/ui";
import { DisplayChoice, KindToggle, NewVoucherForm, ResendButton } from "@/components/admin/VouchersForms";
import { Icon, type IconName } from "@/components/ui/Icon";
import { addDays, todayMaputo } from "@/lib/time";
import { levelOptions, listVouchers, VOUCHER_VIEWS, voucherRecipients, type VoucherView } from "@/server/admin/vouchers";
import { discountSettings } from "@/server/discounts";
import { canEdit, requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Descontos e vouchers" };

type Props = { searchParams: Promise<{ q?: string; vista?: string }> };

const KINDS: { key: "level" | "campaigns" | "sale" | "vouchers"; icon: IconName; name: string; how: string; where: string; badge?: string }[] = [
  { key: "level", icon: "gem", name: "Nível de fidelidade", how: "Rubi 0% · Safira 5% · Pérola 10% · Diamante 15% (valores em Definições)", where: "Checkout, reservas e noivas" },
  { key: "campaigns", icon: "tag", name: "Campanhas", how: "Black Friday, Natal… com início e fim; preço riscado nas peças da campanha", where: "Listas, página da peça e checkout" },
  { key: "sale", icon: "tag", name: "Saldo numa peça", how: "Preço riscado definido no próprio produto", where: "Listas, página da peça e checkout" },
  { key: "vouchers", icon: "ticket", name: "Vouchers", how: "Código para uma cliente, um nível ou todas · valor fixo ou percentagem", where: "Checkout e conta da cliente", badge: "Novo" },
];

/**
 * EN: "Gestão · Descontos e vouchers" of design V3: discount kinds (on/off), how the discount is shown to the customer,
 *     "Novo voucher" (generate and send) and the vouchers list.
 * PT: Descontos e vouchers do V3: tipos de desconto (ligar/desligar), como o desconto aparece à cliente, "Novo voucher"
 *     (gerar e enviar) e a lista de vouchers.
 */
export default async function DiscountsPage({ searchParams }: Props) {
  const staff = await requireStaffPage("discounts");
  const p = await searchParams;
  const view: VoucherView = p.vista && p.vista in VOUCHER_VIEWS ? (p.vista as VoucherView) : "todos";
  const [settings, vouchers, people] = await Promise.all([discountSettings(), listVouchers({ q: p.q, view }), voucherRecipients()]);
  const edit = canEdit(staff, "discounts");
  const link = (vista: VoucherView) => `?${new URLSearchParams(Object.entries({ q: p.q, vista: vista === "todos" ? undefined : vista }).filter((e): e is [string, string] => !!e[1]))}`;

  return (
    <>
      <PageTop
        eyebrow="Loja"
        title={
          <>
            Descontos e <em>vouchers</em>
          </>
        }
        actions={
          edit && (
            <a href="#novo-voucher" className={`${c.btnPrimary} ${c.sm}`}>
              <Icon name="plus" size={15} />
              Novo voucher
            </a>
          )
        }
      />

      <div className={c.note}>
        <Icon name="info" size={18} />
        <span>
          Os descontos que já existiam ficam todos; cada um liga e desliga aqui. Com dois descontos na mesma peça, aplica-se o maior (regra em Definições → Programa de fidelidade).
        </span>
      </div>

      <div className={d.cols}>
        <div className={d.left}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Tipos de desconto</h2>
            </div>
            <table className={d3.table}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Como funciona</th>
                  <th>Onde aparece</th>
                  <th>Ligado</th>
                </tr>
              </thead>
              <tbody>
                {KINDS.map((k) => (
                  <tr key={k.key}>
                    <td>
                      <span className={d.kindName}>
                        <Icon name={k.icon} size={16} />
                        <b className={d.w5}>{k.name}</b>
                        {k.badge && <span className={c.badge}>{k.badge}</span>}
                      </span>
                    </td>
                    <td>
                      <span className={c.xsMuted}>{k.how}</span>
                    </td>
                    <td>
                      <span className={c.xsMuted} style={{ color: "var(--ink)" }}>
                        {k.where}
                      </span>
                    </td>
                    <td>
                      <KindToggle kind={k.key} on={settings[k.key]} label={k.name} disabled={!edit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Como o desconto aparece à cliente</h2>
            </div>
            <div className={d.pad}>
              <DisplayChoice display={settings.display} disabled={!edit} />
            </div>
          </section>
        </div>

        <section className={d3.panel}>
          <div className={d3.panelHead}>
            <h2>Novo voucher</h2>
          </div>
          <NewVoucherForm people={people} levels={await levelOptions()} disabled={!edit} defaultEnd={addDays(todayMaputo(), 30)} />
        </section>
      </div>

      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Vouchers</h2>
          <nav className={c.seg} aria-label="Estado">
            {(Object.keys(VOUCHER_VIEWS) as VoucherView[]).map((v) => (
              <Link key={v} href={link(v)} aria-current={v === view ? "page" : undefined}>
                {VOUCHER_VIEWS[v]}
              </Link>
            ))}
          </nav>
        </div>
        {vouchers.length === 0 ? (
          <p className={d3.empty}>{p.q ? "Nenhum voucher encontrado." : view === "todos" ? "Ainda não há vouchers. Gere o primeiro em “Novo voucher”." : `Nenhum voucher em “${VOUCHER_VIEWS[view]}”.`}</p>
        ) : (
          <table className={`${d3.table} ${d.table}`}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Para</th>
                <th className={d.r}>Valor</th>
                <th className={d.r}>Compra mínima</th>
                <th>Validade</th>
                <th>Enviado por</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id}>
                  <td>
                    <span className={c.tag}>{v.code}</span>
                  </td>
                  <td>
                    <span className={c.small}>{v.forLabel}</span>
                  </td>
                  <td className={`${d.r} ${c.num}`}>{v.value}</td>
                  <td className={`${d.r} ${c.num}`}>{v.minPurchase}</td>
                  <td>
                    <span className={c.xsMuted} style={{ color: "var(--ink)" }}>
                      {v.validity}
                    </span>
                  </td>
                  <td>
                    <span className={c.xsMuted}>{v.sentVia}</span>
                  </td>
                  <td>
                    <span className={c.st} data-tone={v.state === "unused" ? "ok" : v.state === "expired" ? "warn" : undefined}>
                      {v.stateLabel}
                    </span>
                  </td>
                  <td className={d.r}>{v.canResend && <ResendButton id={v.id} disabled={!edit} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
