/**
 * EN: Category filter values of design V3, shared by the page (server) and the filter controls (browser).
 * PT: Valores dos filtros da categoria do V3, partilhados pela página (servidor) e pelos filtros (browser).
 */
export const SIZE_LETTERS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
export const PRICE_RANGES = ["upTo15", "from15to30", "over30"] as const;
export type PriceRange = (typeof PRICE_RANGES)[number];
