import type { ReactNode } from "react";

/**
 * EN: Thin line icons (1.5px stroke) copied from the design. Decorative by default (aria-hidden).
 * PT: Ícones de linha fina (traço 1,5px) copiados do design. Decorativos por omissão (aria-hidden).
 */

const icons = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  bag: (
    <>
      <path d="M5 8h14l-1 12.5H6L5 8z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  whatsapp: <path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.6z" />,
  whatsappFull: (
    <>
      <path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.6z" />
      <path d="M9.2 8.6c.3 2.4 2.3 4.6 5 5.4l1-1.2-1.6-.9-.7.7a4 4 0 0 1-2-2l.7-.7-.8-1.6z" fill="currentColor" stroke="none" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: <path d="M14 21v-7.5h2.8l.5-3.3H14V8.1c0-1 .3-1.6 1.7-1.6h1.8V3.6a23 23 0 0 0-2.6-.1c-2.6 0-4.3 1.6-4.3 4.4v2.3H7.8v3.3h2.8V21" />,
  tiktok: (
    <>
      <path d="M14 3.5v11a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M14 3.5c.5 2.5 2.3 4.2 5 4.4" />
    </>
  ),
  device: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  store: <path d="M4 9.5L5.5 4h13L20 9.5M4 9.5h16M5 9.5V20h14V9.5M10 20v-5h4v5" />,
  truck: (
    <>
      <path d="M3 6.5h11v10H3zM14 10h4l3 3v3.5h-7" />
      <circle cx="7" cy="18.5" r="1.8" />
      <circle cx="17.5" cy="18.5" r="1.8" />
    </>
  ),
  return: (
    <>
      <path d="M9 7L4.5 11.5 9 16" />
      <path d="M4.5 11.5H15a4.5 4.5 0 0 1 0 9h-3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="1" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  bank: <path d="M3 9.5L12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3.5 20.5h17" />,
  cash: (
    <>
      <rect x="3" y="6.5" width="18" height="11" rx="1" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  upload: <path d="M12 16V4.5M7.5 9L12 4.5 16.5 9M4.5 15.5v4h15v-4" />,
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16.2v.3" />
    </>
  ),
  arrowLeft: <path d="M20 12H4M10 6l-6 6 6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="1" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none" />
      <rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none" />
    </>
  ),
  // EN: Back-office menu (Gestão). PT: Menu da gestão.
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  receipt: <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3zM9 8h6M9 11.5h6M9 15h4" />,
  dress: <path d="M9 3.5h6l-1 4 4 13H6l4-13zM10 7.5h4" />,
  layers: <path d="M12 4l8.5 4.5L12 13 3.5 8.5zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5" />,
  layout: <path d="M4 4.5h16v15H4zM4 9h16M10 9v10.5" />,
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 19.5c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5M16 5.5a3.2 3.2 0 0 1 0 6.2M18.5 14.8c1.5.8 2.6 2.4 3 4.7" />
    </>
  ),
  userPlus: (
    <>
      <circle cx="10" cy="8" r="3.8" />
      <path d="M3 20c.9-3.5 3.6-5.5 7-5.5 1.6 0 3 .4 4.2 1.2M18.5 13v6M15.5 16h6" />
    </>
  ),
  shield: <path d="M12 3.5l7 2.8v5.2c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6.3zM9 12l2.2 2.2L15.5 10" />,
  list: <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.5M4.5 12h.5M4.5 17.5h.5" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  printer: <path d="M7 9V3.5h10V9M7 17H4.5V9h15v8H17M7 14h10v6.5H7z" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M20.5 16l-5-5-8.5 8.5" />
    </>
  ),
  refresh: <path d="M19.5 8.5A8 8 0 0 0 5 7M4.5 15.5A8 8 0 0 0 19 17M19.5 4v4.5H15M4.5 20v-4.5H9" />,
  logout: <path d="M14 4.5H5.5v15H14M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  size = 22,
  className,
  filled,
}: {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean; // EN: e.g. a saved heart. PT: ex.: coração guardado.
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {icons[name]}
    </svg>
  );
}
