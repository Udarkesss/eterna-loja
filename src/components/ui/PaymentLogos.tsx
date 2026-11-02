import styles from "./PaymentLogos.module.css";

/**
 * EN: Payment badges of design V3 (".pay": 42×28, Visa · Mastercard · PayPal · M-Pesa · e-Mola · mKesh). `small` is
 *     used next to the "Add to bag" button.
 * PT: Selos de pagamento do design V3 (42×28). `small` é usado junto ao botão "Adicionar ao carrinho".
 */
export function PaymentLogos({ label, small }: { label: string; small?: boolean }) {
  const cls = `${styles.logo} ${small ? styles.small : ""}`;
  return (
    <span role="list" aria-label={label} className={styles.list}>
      <span role="listitem" className={styles.item}>
        <span role="img" aria-label="Visa" className={`${cls} ${styles.visa}`}>
          VISA
        </span>
      </span>
      <span role="listitem" className={styles.item}>
        <span role="img" aria-label="Mastercard" className={`${cls} ${styles.mastercard}`}>
          <svg width={small ? 22 : 30} height={small ? 14 : 20} viewBox="0 0 30 20" aria-hidden="true">
            <circle cx="11" cy="10" r="7" fill="#EB001B" />
            <circle cx="19" cy="10" r="7" fill="#F79E1B" fillOpacity="0.9" />
          </svg>
        </span>
      </span>
      <span role="listitem" className={styles.item}>
        <span role="img" aria-label="PayPal" className={`${cls} ${styles.paypal}`}>
          <span style={{ color: "#003087" }}>Pay</span>
          <span style={{ color: "#009CDE" }}>Pal</span>
        </span>
      </span>
      {(
        [
          ["mpesa", "M-Pesa"],
          ["emola", "e-Mola"],
          ["mkesh", "mKesh"],
        ] as const
      ).map(([key, alt]) => (
        <span key={key} role="listitem" className={styles.item}>
          <span className={`${cls} ${styles[key]}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- EN: tiny static logos. PT: logótipos pequenos. */}
            <img src={`/images/payments/${key}-logo.png`} alt={alt} className={styles.img} />
          </span>
        </span>
      ))}
    </span>
  );
}
