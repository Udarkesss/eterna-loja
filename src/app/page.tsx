import { redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * EN: Fallback only — the middleware normally redirects "/" to /pt or /en first.
 * PT: Só de reserva — o middleware normalmente já redirecciona "/" para /pt ou /en.
 */
export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}`);
}
