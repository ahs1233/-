"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

const BAGHDAD: [number, number] = [33.312, 44.361];

/** مُنتقي موقع المتجر — خريطة قابلة للنقر (وسحب الدبّوس) يحدّد التاجر بها موقعه. */
export default function LocationPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      const start = value ?? { lat: BAGHDAD[0], lng: BAGHDAD[1] };
      const map = L.map(elRef.current, { attributionControl: false }).setView([start.lat, start.lng], 13);
      mapRef.current = map;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 20, subdomains: "abcd" }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#c99a3a;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5)"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      const marker = L.marker([start.lat, start.lng], { icon, draggable: true }).addTo(map);
      markerRef.current = marker;
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // مزامنة الدبّوس عند تغيّر القيمة من الخارج (زرّ «موقعي الحاليّ»).
  useEffect(() => {
    if (value && mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
      mapRef.current.setView([value.lat, value.lng], 15);
    }
  }, [value]);

  return <div ref={elRef} className="h-64 w-full overflow-hidden rounded-2xl border border-line" />;
}
