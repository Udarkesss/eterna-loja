import type { Localized, ProductColor } from "@/types";

/**
 * EN: The six real Eterna pieces shown in the design (codes, prices, sizes and photos from the canvas).
 *     Texts in [brackets] are still to be confirmed by the Eterna team. More products come from the import.
 * PT: As seis peças reais da Eterna mostradas no design (códigos, preços, tamanhos e fotos do canvas).
 *     Textos entre [parênteses] ainda por confirmar pela equipa Eterna. Os restantes produtos vêm da importação.
 */

export interface ProductSeed {
  code: string;
  name: Localized;
  description: Localized;
  composition?: Localized;
  price: number;
  salePrice?: number;
  type: string; // EN: type category slug. PT: slug do tipo.
  collection: string;
  occasions: string[];
  colors: ProductColor[];
  variants: { color: string | null; size: string; stock: number; store: string }[];
  images: { url: string; alt: Localized; color?: string }[];
  isNew?: boolean;
}

const TO_CONFIRM: Localized = {
  pt: "[Confirmar descrição com a equipa Eterna.]",
  en: "[Description to be confirmed by the Eterna team.]",
};
const COMPOSITION: Localized = {
  pt: "[Composição do tecido] · [Instruções de lavagem]",
  en: "[Fabric composition] · [Care instructions]",
};

const color = (key: string, pt: string, en: string, hex: string, family: ProductColor["family"]): ProductColor => ({
  key,
  name: { pt, en },
  hex,
  family,
});

export const designProducts: ProductSeed[] = [
  {
    code: "8G1L7",
    name: { pt: "Vestido midi off-white com mangas de penas", en: "Off-white midi dress with feather sleeves" },
    description: {
      pt: "Vestido midi de corte recto, decote em V suave, cinto fino a marcar a cintura e mangas três-quartos rematadas com penas. [Confirmar descrição com a equipa Eterna.]",
      en: "Straight-cut midi dress with a soft V-neck, a thin belt at the waist and three-quarter sleeves finished with feathers. [Description to be confirmed by the Eterna team.]",
    },
    composition: COMPOSITION,
    price: 27500,
    type: "vestidos-midi",
    collection: "beyond-time",
    occasions: ["convidada"],
    colors: [color("off_white", "Off-white", "Off-white", "#F4EFE6", "off_white")],
    variants: [{ color: "off_white", size: "6US/38EUR/S", stock: 1, store: "02" }],
    images: [
      {
        url: "/images/products/8g1l7/01.webp",
        alt: { pt: "Vestido 8G1L7 visto de frente, com chapéu de cerimónia", en: "Dress 8G1L7 from the front, with a ceremony hat" },
      },
      { url: "/images/products/8g1l7/02.webp", alt: { pt: "Vestido 8G1L7 visto de costas", en: "Dress 8G1L7 from the back" } },
    ],
    isNew: true,
  },
  {
    code: "4G158",
    name: { pt: "Vestido bege", en: "Beige dress" },
    description: TO_CONFIRM,
    composition: COMPOSITION,
    price: 27500,
    type: "vestidos",
    collection: "beyond-time",
    occasions: ["convidada"],
    colors: [color("beige", "Bege", "Beige", "#D8C3A5", "beige")],
    variants: [{ color: "beige", size: "6US/38EUR/S", stock: 0, store: "02" }],
    images: [{ url: "/images/products/4g158/01.webp", alt: { pt: "Vestido bege", en: "Beige dress" } }],
    isNew: true,
  },
  {
    code: "8G106",
    name: { pt: "Vestido fúcsia", en: "Fuchsia dress" },
    description: TO_CONFIRM,
    composition: COMPOSITION,
    price: 24500,
    type: "vestidos",
    collection: "beyond-time",
    occasions: ["gala", "convidada"],
    colors: [color("fuchsia", "Fúcsia", "Fuchsia", "#C2185B", "fuchsia")],
    variants: [{ color: "fuchsia", size: "6US/38EUR/S", stock: 3, store: "02" }],
    images: [{ url: "/images/products/8g106/01.webp", alt: { pt: "Vestido fúcsia", en: "Fuchsia dress" } }],
  },
  {
    code: "7G272",
    name: { pt: "Vestido longo azul royal", en: "Royal blue long dress" },
    description: TO_CONFIRM,
    composition: COMPOSITION,
    price: 35000,
    type: "vestidos-longos",
    collection: "beyond-time",
    occasions: ["gala", "convidada"],
    colors: [color("royal_blue", "Azul royal", "Royal blue", "#27408B", "blue")],
    variants: [{ color: "royal_blue", size: "4US/36EUR/S", stock: 2, store: "02" }],
    images: [{ url: "/images/products/7g272/01.webp", alt: { pt: "Vestido longo azul royal", en: "Royal blue long dress" } }],
  },
  {
    code: "9J253",
    name: { pt: "Vestido longo azul pavão", en: "Peacock blue long dress" },
    description: TO_CONFIRM,
    composition: COMPOSITION,
    price: 25000,
    type: "vestidos-longos",
    collection: "beyond-time",
    occasions: ["convidada"],
    colors: [color("peacock_blue", "Azul pavão", "Peacock blue", "#005F73", "blue")],
    variants: [{ color: "peacock_blue", size: "4US/36EUR/S", stock: 1, store: "02" }],
    images: [{ url: "/images/products/9j253/01.webp", alt: { pt: "Vestido longo azul pavão", en: "Peacock blue long dress" } }],
  },
  {
    code: "M164",
    name: { pt: "Vestido azul-céu", en: "Sky blue dress" },
    description: TO_CONFIRM,
    composition: COMPOSITION,
    price: 13500,
    type: "vestidos",
    collection: "beyond-time",
    occasions: ["convidada"],
    colors: [color("sky_blue", "Azul-céu", "Sky blue", "#87B5D9", "blue")],
    variants: [{ color: "sky_blue", size: "4US/36EUR/S", stock: 2, store: "02" }],
    images: [{ url: "/images/products/m164/01.webp", alt: { pt: "Vestido azul-céu", en: "Sky blue dress" } }],
  },
];
