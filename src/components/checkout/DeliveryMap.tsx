"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/I18nProvider";
import styles from "./Checkout.module.css";

/** EN: Glória Mall, Maputo — starting point of the map. PT: Glória Mall, Maputo — ponto de partida do mapa. */
const START = { lat: -25.9655, lng: 32.5892 };

export interface MapPoint {
  lat: number;
  lng: number;
}

/** EN: Address found for the pin. PT: Morada encontrada para o pino. */
export interface MapAddress {
  street: string; // "Av. Julius Nyerere, 1234"
  neighbourhood: string; // "Sommerschield"
  city: string; // "Maputo"
  label: string; // EN: short text for the search box. PT: texto curto para a caixa de pesquisa.
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
}

function toAddress(a: NominatimAddress): MapAddress {
  const road = a.road ?? a.pedestrian ?? "";
  const street = [road, a.house_number].filter(Boolean).join(", ");
  const neighbourhood = a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district ?? "";
  const city = a.city ?? a.town ?? a.village ?? "";
  return { street, neighbourhood, city, label: [street, neighbourhood, city].filter(Boolean).join(", ") };
}

/**
 * EN: "Onde entregamos?" from the design: address search, "A minha localização" and a map where the customer drags
 *     the map under a fixed pin ("Entregar aqui"). After locating, searching or dragging, the address under the pin is
 *     looked up (reverse geocoding) and written in the search box and in the address fields.
 *     OpenStreetMap tiles + Nominatim. Production: use a provider with an API key (OSM's servers are for light use).
 * PT: "Onde entregamos?" do design: pesquisa, "A minha localização" e um mapa arrastado por baixo de um pino fixo.
 *     Depois de localizar, pesquisar ou arrastar, a morada do pino é procurada e escrita na caixa de pesquisa e nos
 *     campos de morada. Em produção usar um fornecedor de mapas com chave.
 */
export function DeliveryMap({ onChange, onAddress }: { onChange: (point: MapPoint) => void; onAddress?: (address: MapAddress) => void }) {
  const { dict, locale } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const typed = useRef(false); // EN: the customer typed in the box. PT: a cliente escreveu na caixa.

  // EN: Address under the pin (debounced: Nominatim allows ~1 request per second). PT: Morada do pino.
  function lookupAddress(lat: number, lng: number) {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&accept-language=${locale}&lat=${lat}&lon=${lng}`;
        const data = (await fetch(url).then((r) => r.json())) as { address?: NominatimAddress };
        if (!data.address) return;
        const found = toAddress(data.address);
        if (found.label) setQuery(found.label);
        onAddress?.(found);
      } catch {
        // EN: lookup is a convenience; the fields can be typed by hand. PT: é uma ajuda; os campos escrevem-se à mão.
      }
    }, 900);
  }

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !container.current || map.current) return;
      const m = L.map(container.current, { zoomControl: true, attributionControl: false }).setView([START.lat, START.lng], 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
      m.on("moveend", () => {
        const c = m.getCenter();
        onChange({ lat: c.lat, lng: c.lng });
        // EN: Not for the starting view (Glória Mall). PT: Não para a vista inicial (Glória Mall).
        const atStart = Math.abs(c.lat - START.lat) < 1e-5 && Math.abs(c.lng - START.lng) < 1e-5;
        if (!atStart) lookupAddress(c.lat, c.lng);
      });
      map.current = m;
      onChange(START);
    });
    return () => {
      cancelled = true;
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- EN: create the map once. PT: criar o mapa uma vez.
  }, []);

  function locateMe() {
    if (!navigator.geolocation) {
      setNote(dict.checkout.locationDenied);
      return;
    }
    setNote(dict.checkout.locating);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNote("");
        // EN: moving the map triggers the address lookup. PT: mover o mapa dispara a procura da morada.
        map.current?.setView([pos.coords.latitude, pos.coords.longitude], 17);
      },
      () => setNote(dict.checkout.locationDenied),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function search() {
    typed.current = false;
    if (query.trim().length < 3) return;
    setBusy(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mz&accept-language=${locale}&q=${encodeURIComponent(query)}`;
      const [hit] = (await fetch(url).then((r) => r.json())) as { lat: string; lon: string }[];
      if (hit) map.current?.setView([Number(hit.lat), Number(hit.lon)], 17);
    } catch {
      // EN: search is a convenience; the pin can still be moved by hand. PT: a pesquisa é uma ajuda; o pino move-se à mão.
    } finally {
      setBusy(false);
    }
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  }

  return (
    <div className={styles.mapBlock}>
      <label className={styles.field}>
        {dict.checkout.whereDeliver}
        <span className={styles.searchRow}>
          <input
            type="search"
            className={styles.input}
            placeholder={dict.checkout.searchPlaceholder}
            value={query}
            onChange={(e) => {
              typed.current = true;
              setQuery(e.target.value);
            }}
            onKeyDown={onKey}
            onBlur={() => typed.current && search()}
            aria-busy={busy}
          />
          <button type="button" className={styles.locate} onClick={locateMe}>
            <Icon name="crosshair" size={18} />
            {dict.checkout.myLocation}
          </button>
        </span>
        {note && (
          <span role="status" className={styles.hint}>
            {note}
          </span>
        )}
      </label>
      <div className={styles.map} role="img" aria-label={dict.checkout.mapLabel}>
        <div ref={container} className={styles.mapCanvas} />
        <span className={styles.pin} aria-hidden="true">
          <Icon name="pin" size={32} />
        </span>
        <span className={styles.pinLabel}>{dict.checkout.deliverHere}</span>
        <span className={styles.mapHint}>{dict.checkout.dragMap}</span>
        <span className={styles.osm}>© OpenStreetMap</span>
      </div>
    </div>
  );
}
