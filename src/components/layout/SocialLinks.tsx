import { Icon, type IconName } from "@/components/ui/Icon";
import { site } from "@/data/site";
import styles from "./SocialLinks.module.css";

const ICON: Record<(typeof site.social)[number]["key"], IconName> = {
  instagram: "instagram",
  facebook: "facebook",
  tiktok: "tiktok",
  whatsapp: "whatsappFull",
};

/**
 * EN: Instagram (x2) · Facebook · TikTok · WhatsApp. "circle" = footer (gold ring), "pill" = "Siga a Eterna" section.
 * PT: Redes sociais. "circle" = rodapé (aro dourado), "pill" = secção "Siga a Eterna".
 */
export function SocialLinks({ label, variant = "circle" }: { label: string; variant?: "circle" | "pill" }) {
  return (
    <nav aria-label={label} className={styles.list}>
      {site.social.map((s) => (
        <a
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${s.label === "Bridal" ? "Instagram Eterna Bridal" : s.label} (${s.handle})`}
          className={styles[variant]}
        >
          <Icon name={ICON[s.key]} size={variant === "circle" ? 20 : 18} />
          {variant === "pill" && <span>{s.label}</span>}
        </a>
      ))}
    </nav>
  );
}
