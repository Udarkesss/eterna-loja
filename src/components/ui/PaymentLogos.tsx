import styles from "./PaymentLogos.module.css";

/**
 * EN: Visa · Mastercard · M-Pesa · e-Mola · mKesh badges, as in the design (40px, or 28px when small).
 * PT: Selos Visa · Mastercard · M-Pesa · e-Mola · mKesh, como no design (40px, ou 28px quando pequenos).
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
          <svg width={small ? 20 : 29} height={small ? 13 : 19} viewBox="0 0 34 22" aria-hidden="true">
            <circle cx="12" cy="11" r="9" fill="#EB001B" />
            <circle cx="22" cy="11" r="9" fill="#F79E1B" fillOpacity="0.9" />
          </svg>
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
