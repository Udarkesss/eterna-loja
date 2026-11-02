"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { plural, t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api-client";
import { formatMZN } from "@/lib/format";
import { categoryHref, productHref } from "@/lib/links";
import type { SearchSuggestionsDTO } from "@/types";
import styles from "./Search.module.css";

/**
 * EN: Search field of design V3 ("Loja · Pesquisa com sugestões"): large serif field with "Código, nome, cor ou
 *     ocasião" and, while typing, suggestions — collections and occasions, types with how many pieces, and the first
 *     three pieces with price. Enter (or "Ver os 12 resultados") opens the full results below.
 * PT: Campo de pesquisa do V3: campo grande com "Código, nome, cor ou ocasião" e, enquanto escreve, sugestões —
 *     colecções e ocasiões, tipos com o número de peças e as três primeiras peças com preço. Enter (ou "Ver os 12
 *     resultados") mostra os resultados completos por baixo.
 */
export function SearchBox({ initial }: { initial: string }) {
  const { locale, dict } = useI18n();
  const s = dict.search;
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const [data, setData] = useState<(SearchSuggestionsDTO & { q: string }) | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const dropId = useId();
  const hintId = useId();
  const q = value.trim();

  // EN: Back/forward changes the address: follow it. PT: Ao andar para trás/frente, seguir o endereço.
  useEffect(() => setValue(initial), [initial]);

  // EN: Suggestions only while the list is open; the previous ones stay (dimmed) until the new ones arrive.
  // PT: Sugestões só com a lista aberta; as anteriores ficam (esbatidas) até chegarem as novas.
  useEffect(() => {
    if (!open || q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .searchSuggestions(q, locale)
        .then((d) => !cancelled && setData({ ...d, q }))
        .catch(() => !cancelled && setData(null));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, locale, open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const resultsHref = (extra: Record<string, string> = {}) => `${pathname}?${new URLSearchParams({ q, ...extra })}`;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setOpen(false);
    input.current?.blur();
    router.push(q ? resultsHref() : pathname);
  };
  const shown = open && q.length >= 2 && data;

  return (
    <div ref={box} className={styles.box}>
      <form role="search" className={styles.field} onSubmit={submit}>
        <Icon name="search" size={24} />
        <input
          ref={input}
          type="search"
          name="q"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={s.placeholder}
          aria-label={s.title}
          aria-describedby={hintId}
          aria-controls={dropId}
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={!initial}
          className={styles.input}
        />
        <span id={hintId} className={styles.hint}>
          {s.hint}
        </span>
        {value && (
          <button
            type="button"
            className={styles.clear}
            aria-label={s.clear}
            onClick={() => {
              setValue("");
              input.current?.focus();
            }}
          >
            <Icon name="close" size={20} />
          </button>
        )}
      </form>
      <span className={styles.hintBelow} aria-hidden="true">
        {s.hint}
      </span>

      <div id={dropId} className={styles.drop} hidden={!shown} aria-busy={!!shown && data.q !== q} data-stale={!!shown && data.q !== q}>
        {shown && data.total === 0 && <p className={styles.none}>{t(s.none, { q: data.q })}</p>}
        {shown && data.total > 0 && (
          <>
            <div className={styles.groups}>
              {data.places.length > 0 && (
                <div className={styles.group}>
                  <span className={styles.groupLabel}>{s.places}</span>
                  {data.places.map((p) => (
                    <Link key={p.slug} href={categoryHref(p.slug, locale)} className={styles.chip}>
                      {p.name}
                    </Link>
                  ))}
                </div>
              )}
              {data.types.length > 0 && (
                <div className={styles.group}>
                  <span className={styles.groupLabel}>{s.types}</span>
                  {data.types.map((type) => (
                    <Link key={type.slug} href={resultsHref({ q: data.q, type: type.slug })} className={styles.chip} onClick={() => setOpen(false)}>
                      {type.name} ({type.count})
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.pieces}>
              <span className={styles.groupLabel}>{s.pieces}</span>
              {data.products.map((p) => (
                <Link key={p.slug} href={productHref(p.slug, locale)} className={styles.piece}>
                  {p.image ? <Image src={p.image} alt="" width={40} height={52} /> : <span className={styles.noImage} />}
                  <span className={styles.pieceName}>
                    <b>{p.code}</b>
                    {p.type && ` · ${p.type}`}
                  </span>
                  <span className={styles.price}>{formatMZN(p.salePrice ?? p.price, locale)}</span>
                </Link>
              ))}
              <Link href={resultsHref({ q: data.q })} className={styles.all} onClick={() => setOpen(false)}>
                {plural(s.seeAll, data.total)}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
