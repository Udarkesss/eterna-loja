/**
 * EN: How discounts combine (design V3, Gestão · Descontos e vouchers): level (pieces not on sale) and voucher; the larger
 *     applies, or both when the voucher joins the level's. Shared by the checkout summary and the server.
 * PT: Como os descontos se juntam: nível (peças fora de saldo) e voucher; aplica-se o maior, ou os dois quando o voucher
 *     se junta ao do nível. Partilhado pelo resumo do checkout e pelo servidor.
 */
export function combineDiscounts(levelAmount: number, voucher: { amount: number; stacks: boolean } | null) {
  if (!voucher) return { level: levelAmount, voucher: 0, total: levelAmount };
  if (voucher.stacks) return { level: levelAmount, voucher: voucher.amount, total: levelAmount + voucher.amount };
  return voucher.amount >= levelAmount ? { level: 0, voucher: voucher.amount, total: voucher.amount } : { level: levelAmount, voucher: 0, total: levelAmount };
}

/**
 * EN: Customer (level) discount of a cart: on pieces on sale or in a campaign only the part above the sale discount
 *     counts, so the larger of the two applies (design V3: "aplica-se o maior dos dois").
 * PT: Desconto de cliente (nível) de um carrinho: nas peças em saldo ou campanha só conta a parte acima do desconto já
 *     feito, para se aplicar o maior dos dois (V3: "aplica-se o maior dos dois").
 */
export function levelDiscount(lines: { price: number; unit: number; quantity: number }[], pct: number): number {
  if (!pct) return 0;
  return lines.reduce((sum, l) => sum + Math.max(0, Math.round((l.price * pct) / 100) - (l.price - l.unit)) * l.quantity, 0);
}
