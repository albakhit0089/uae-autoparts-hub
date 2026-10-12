"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Supplier } from "@/lib/types";

/**
 * OpenStreetMap tiles via Leaflet. OSM's tile usage policy requires visible
 * attribution and fair use; for production traffic switch to a commercial tile
 * provider (MapTiler, Mapbox, Google) — see docs/DEPLOYMENT.md.
 */
export default function SupplierMap({ suppliers, onSelect, me }: { suppliers: Supplier[]; onSelect?: (id: string) => void; me?: [number, number] | null }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !el.current || mapRef.current) return;
      const map = L.map(el.current, { scrollWheelZoom: false }).setView([25.2, 55.5], 8);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      draw(L);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!mapRef.current) return;
      draw(await import("leaflet"));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers, me]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  function draw(L: typeof import("leaflet")) {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const icon = (featured: boolean) =>
      L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${featured ? "#f97a1f" : "#15254f"};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
    suppliers.forEach((s) => {
      const m = L.marker([s.lat, s.lng], { icon: icon(s.featured), title: s.name }).addTo(layer);
      const div = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = s.name;
      div.appendChild(strong);
      div.appendChild(document.createElement("br"));
      div.appendChild(document.createTextNode(s.address));
      m.bindPopup(div);
      m.on("click", () => onSelect?.(s.id));
    });
    if (me) L.circleMarker(me, { radius: 8, color: "#1f9d55", fillOpacity: 0.8 }).addTo(layer).bindPopup("You");
    const pts: [number, number][] = suppliers.map((s) => [s.lat, s.lng]);
    if (me) pts.push(me);
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 13 });
  }

  return <div ref={el} className="h-full min-h-[320px] w-full rounded-2xl" role="region" aria-label="Map of suppliers" />;
}
