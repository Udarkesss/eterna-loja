import { Icon, type IconName } from "./Icon";
import styles from "./IconSwap.module.css";

/**
 * EN: "Icon swap" (transitions.dev, written natively, owner 2026-11-23): two icons in the same place; when `on` changes,
 *     one leaves blurring and shrinking while the other comes in. Used on the favourite heart, the phone menu and the
 *     product panels (+ / −). Motion tokens are CSS variables in IconSwap.module.css.
 * PT: "Icon swap" (transitions.dev, feito em código próprio, dona 23-11-2026): dois ícones no mesmo sítio; quando `on`
 *     muda, um sai a desfocar e a encolher enquanto o outro entra. No coração dos favoritos, no menu do telemóvel e nos
 *     painéis da peça (+ / −). Os tempos estão em variáveis CSS em IconSwap.module.css.
 */
export function IconSwap({
  on,
  off: offIcon,
  onIcon,
  size = 22,
  filledOn = false,
}: {
  on: boolean;
  off: IconName;
  onIcon: IconName;
  size?: number;
  filledOn?: boolean;
}) {
  return (
    <span className={styles.swap} data-on={on ? "" : undefined} style={{ width: size, height: size }}>
      <Icon name={offIcon} size={size} className={styles.off} />
      <Icon name={onIcon} size={size} filled={filledOn} className={styles.on} />
    </span>
  );
}
