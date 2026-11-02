import Image from "next/image";
import Link from "next/link";
import styles from "./Category.module.css";

export interface TypeTile {
  href: string;
  label: string;
  images: string[]; // EN: one photo, or up to four for "Todos". PT: uma foto, ou até quatro para "Todos".
  current: boolean;
}

/**
 * EN: Type bar of design V3: circular frames, centred, names in capitals; "Todos" shows four pieces. The photo of a
 *     type is a piece of that type (until the team frames one in Gestão → Tipos de peça). Scrolls sideways on phones.
 * PT: Barra de tipos do V3: molduras circulares, centradas, nomes em maiúsculas; "Todos" mostra quatro peças. A foto
 *     de cada tipo é uma peça desse tipo. No telemóvel desliza para o lado.
 */
export function TypeBar({ tiles, label }: { tiles: TypeTile[]; label: string }) {
  if (tiles.length < 3) return null; // EN: "Todos" + at least two types. PT: "Todos" + pelo menos dois tipos.
  return (
    <nav aria-label={label} className={styles.typeBar}>
      {tiles.map((tile) => (
        <Link key={tile.href} href={tile.href} className={styles.typeItem} aria-current={tile.current ? "page" : undefined} scroll={false}>
          <span className={tile.images.length > 1 ? styles.typeAll : styles.typeImage}>
            {tile.images.slice(0, tile.images.length > 1 ? 4 : 1).map((src, i) => (
              <Image key={i} src={src} alt="" width={tile.images.length > 1 ? 48 : 96} height={tile.images.length > 1 ? 48 : 96} />
            ))}
          </span>
          <span className={styles.typeLabel}>{tile.label}</span>
        </Link>
      ))}
    </nav>
  );
}
