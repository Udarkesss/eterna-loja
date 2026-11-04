import type { SocialLink } from "@/data/contacts";
import { Icon, type IconName } from "./Icon";

const DEFAULT: Partial<Record<SocialLink["network"], IconName>> = { instagram: "instagram", facebook: "facebook", tiktok: "tiktok" };

/**
 * EN: Icon of a social network: the one uploaded in Gestão → Contactos, else the network's default, else a generic one.
 * PT: Ícone da rede: o carregado na gestão, senão o padrão da rede, senão um genérico.
 */
export function SocialIcon({ link, size = 16 }: { link: Pick<SocialLink, "network" | "icon">; size?: number }) {
  if (link.icon) {
    // eslint-disable-next-line @next/next/no-img-element -- EN: small uploaded icon (SVG or PNG). PT: ícone pequeno carregado.
    return <img src={link.icon} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: "contain" }} />;
  }
  return <Icon name={DEFAULT[link.network] ?? "globe"} size={size} />;
}
