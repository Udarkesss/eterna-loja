"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";

/**
 * EN: Small Leaflet map for deliveries (driver app, "Acompanhar entrega", Gestão · Entregas): store, destination and
 *     driver markers in the design's colours, with a dashed line between them. OpenStreetMap tiles.
 * PT: Mapa pequeno para as entregas: marcadores da loja, do destino e do entregador nas cores do design, com uma
 *     linha tracejada entre eles. Mapas do OpenStreetMap.
 */

export interface MapMarker {
  lat: number;
  lng: number;
  kind: "store" | "destination" | "driver" | "done" | "pending";
  label?: string;
}

const PIN = (fill: string) =>
  `<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 35s-12-11.5-12-21a12 12 0 0 1 24 0c0 9.5-12 21-12 21z" fill="${fill}" stroke="#FFFFFF" stroke-width="2"/><circle cx="14" cy="14" r="4.5" fill="#FFFFFF"/></svg>`;
const MOTO =
  '<span style="width:32px;height:32px;border-radius:999px;background:#1C1917;border:2px solid #fff;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAF7F2" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17h5l3-6h3l1 6M9 11h4M14 7h3"/></svg></span>';
const COLORS = { store: "#1C1917", destination: "#7A5C34", done: "#2F6B4F", pending: "#7D7568" } as const;

export function LiveMap({ markers, line = true, height = 220, ariaLabel }: { markers: MapMarker[]; line?: boolean; height?: number; ariaLabel: string }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const fitted = useRef(false);
  const key = JSON.stringify(markers);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !container.current) return;
      if (!map.current) {
        map.current = L.map(container.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
      }
      const m = map.current;
      layer.current!.clearLayers();
      for (const mk of markers) {
        const html = mk.kind === "driver" ? MOTO : PIN(COLORS[mk.kind]);
        const icon = L.divIcon({
          html,
          className: "",
          iconSize: mk.kind === "driver" ? [32, 32] : [28, 36],
          iconAnchor: mk.kind === "driver" ? [16, 16] : [14, 35],
        });
        const marker = L.marker([mk.lat, mk.lng], { icon, keyboard: false }).addTo(layer.current!);
        if (mk.label) marker.bindTooltip(mk.label, { permanent: true, direction: "bottom", offset: [0, 4], className: "eterna-map-label" });
      }
      if (line && markers.length > 1) {
        L.polyline(
          markers.filter((mk) => mk.kind !== "pending" && mk.kind !== "done").map((mk) => [mk.lat, mk.lng] as [number, number]),
          { color: "#1C1917", weight: 3, dashArray: "6 6" },
        ).addTo(layer.current!);
      }
      // EN: Fit once; afterwards the person may pan freely. PT: Ajusta uma vez; depois a pessoa move à vontade.
      if (!fitted.current && markers.length) {
        if (markers.length === 1) m.setView([markers[0].lat, markers[0].lng], 15);
        else m.fitBounds(L.latLngBounds(markers.map((mk) => [mk.lat, mk.lng] as [number, number])), { padding: [36, 36], maxZoom: 16 });
        fitted.current = true;
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- EN: redraw when the markers change. PT: redesenhar quando mudam.
  }, [key, line]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return (
    <div role="img" aria-label={ariaLabel} style={{ position: "relative", height, background: "var(--line)", overflow: "hidden", zIndex: 0 }}>
      <div ref={container} style={{ position: "absolute", inset: 0 }} />
      <span style={{ position: "absolute", right: 0, bottom: 0, zIndex: 500, padding: "2px 6px", background: "rgba(255,255,255,0.85)", fontSize: 10 }}>© OpenStreetMap</span>
      <style>{`.eterna-map-label{padding:3px 8px;border:0;border-radius:2px;background:#fff;color:#2B2320;font:500 11px var(--font-sans);box-shadow:0 1px 3px rgba(43,35,32,.25)}.eterna-map-label:before{display:none}`}</style>
    </div>
  );
}
