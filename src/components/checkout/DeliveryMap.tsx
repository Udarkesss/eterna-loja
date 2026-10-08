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

/**
 * EN: "Onde entregamos?" from the design: address search, "A minha localização" and a map where the customer drags
 *     the map under a fixed pin ("Entregar aqui"). OpenStreetMap tiles + Nominatim search.
 *     Production: use a tile/geocoding provider with an API key (OSM's public servers are for light use only).
 * PT: "Onde entregamos?" do design: pesquisa de morada, "A minha localização" e um mapa que a cliente arrasta
 *     por baixo de um pino fixo. Em produção usar um fornecedor de mapas com chave (os servidores OSM são para pouco uso).
 */
export function DeliveryMap({ onChange }: { onChange: (point: MapPoint) => void }) {
  const { dict, locale } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !container.current || map.current) return;
      const m = L.map(container.current, { zoomControl: true, attributionControl: false }).setView([START.lat, START.lng], 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
      m.on("moveend", () => {
        const c = m.getCenter();
        onChange({ lat: c.lat, lng: c.lng });
      });
      map.current = m;
      onChange(START);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- EN: create the map once. PT: criar o mapa uma vez.
  }, []);

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.current?.setView([pos.coords.latitude, pos.coords.longitude], 17),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function search() {
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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            onBlur={search}
            aria-busy={busy}
          />
          <button type="button" className={styles.locate} onClick={useMyLocation}>
            <Icon name="crosshair" size={18} />
            {dict.checkout.myLocation}
          </button>
        </span>
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
