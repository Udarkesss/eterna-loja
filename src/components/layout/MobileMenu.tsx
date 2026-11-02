"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { mainNav, site, storeSeeds, whatsappLink } from "@/data/site";
import { useI18n } from "@/i18n/I18nProvider";
import { resolveHref } from "@/lib/links";
import { LanguageSwitcher } from "./LanguageSwitcher";
import styles from "./MobileMenu.module.css";

/**
 * EN: Phone menu of design V3 ("Telemóvel · Menu aberto"): full-screen drawer with the main menu (the active collection
 *     marked), Conta / Favoritos and "Fale connosco" (WhatsApp, call). Escape or the X closes it; focus returns to the
 *     menu button.
 * PT: Menu do telemóvel do design V3: gaveta em ecrã inteiro com o menu principal (colecção activa assinalada),
 *     Conta / Favoritos e "Fale connosco". Escape ou o X fecham; o foco volta ao botão do menu.
 */
export function MobileMenu() {
  const { locale, dict, href } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // EN: Close when the page changes. PT: Fechar quando a página muda.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const trigger = button.current;
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  const phone = storeSeeds[0].phone.replace(/\s/g, "");

  return (
    <>
      <button ref={button} type="button" className={styles.trigger} aria-label={dict.common.openMenu} aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" size={22} />
      </button>
      {open && (
        <div ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-label={dict.nav.main}>
          <div className={styles.top}>
            <button type="button" className={styles.trigger} aria-label={dict.common.close} onClick={() => setOpen(false)}>
              <Icon name="close" size={22} />
            </button>
            <Link href={href("/")} aria-label={dict.nav.home} className={styles.logo}>
              <Image src="/images/brand/eterna-logo.svg" alt="Eterna" width={105} height={24} unoptimized />
            </Link>
            <LanguageSwitcher />
          </div>
          <nav aria-label={dict.nav.main}>
            <ul className={styles.list}>
              {mainNav.map((item, i) => (
                <li key={item.href}>
                  <Link href={resolveHref(item.href, locale)} className={styles.item} onClick={() => setOpen(false)}>
                    <span>{item.label[locale]}</span>
                    {i === 0 && <span className={styles.tag}>{dict.nav.activeCollection}</span>}
                    <Icon name="chevronRight" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.pair}>
            <Link href={href("/account")} className={styles.outline}>
              <Icon name="user" size={18} />
              {dict.nav.accountShort}
            </Link>
            <Link href={href("/favorites")} className={styles.outline}>
              <Icon name="heart" size={18} />
              {dict.nav.favorites}
            </Link>
          </div>
          <div className={styles.contact}>
            <span className={styles.eyebrow}>{dict.nav.talkToUs}</span>
            <div className={styles.pair}>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className={styles.dark}>
                <Icon name="whatsapp" size={18} />
                WhatsApp
              </a>
              <a href={`tel:${phone}`} className={styles.outline}>
                <Icon name="phone" size={18} />
                {dict.nav.call}
              </a>
            </div>
            <span className={styles.small}>{dict.nav.storesLine}</span>
            <span className={styles.small}>{site.email}</span>
          </div>
        </div>
      )}
    </>
  );
}
