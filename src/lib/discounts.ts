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
