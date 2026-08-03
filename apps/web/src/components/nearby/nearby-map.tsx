"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { NearbyStore } from "@al-souq/api";

const BAGHDAD: [number, number] = [33.312, 44.361];

/** خريطة Leaflet (OpenStreetMap) بدبابيس المتاجر + نقطة موقع المستخدم. تُحمّل client-only. */
export default function NearbyMap({
  stores,
  user,
  onSelect,
}: {
  stores: NearbyStore[];
  user: { lat: number; lng: number } | null;
  onSelect?: (id: string) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const userMarkerRef = useRef<CircleMarker | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      const map = L.map(elRef.current, { zoomControl: true, attributionControl: false }).setView(
        user ? [user.lat, user.lng] : BAGHDAD,
        13,
      );
      mapRef.current = map;
      // بلاطاتٌ داكنة (CartoDB dark_matter) لتتناسب مع ثيم «السوگ» الليليّ.
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 20, subdomains: "abcd" }).addTo(map);

      const pin = L.divIcon({
        className: "",
        html: `<span style="display:block;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#c99a3a;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5)"></span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 20],
      });
      stores.forEach((s) => {
        const m = L.marker([s.latitude, s.longitude], { icon: pin }).addTo(map);
        m.on("click", () => onSelect?.(s.id));
      });
      if (user) {
        userMarkerRef.current = L.circleMarker([user.lat, user.lng], {
          radius: 8, color: "#ffffff", weight: 3, fillColor: "#2b8fb3", fillOpacity: 1,
        }).addTo(map);
      }
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        userMarkerRef.current = null;
      }
    };
    // إعادة البناء عند تغيّر مجموعة المتاجر فقط.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores]);

  // تحديث نقطة المستخدم وإعادة التمركز عند توفّر الموقع.
  useEffect(() => {
    (async () => {
      if (!user || !mapRef.current) return;
      const L = (await import("leaflet")).default;
      mapRef.current.setView([user.lat, user.lng], 14);
      if (userMarkerRef.current) userMarkerRef.current.setLatLng([user.lat, user.lng]);
      else
        userMarkerRef.current = L.circleMarker([user.lat, user.lng], {
          radius: 8, color: "#ffffff", weight: 3, fillColor: "#2b8fb3", fillOpacity: 1,
        }).addTo(mapRef.current);
    })();
  }, [user]);

  return <div ref={elRef} className="h-72 w-full overflow-hidden rounded-2xl border border-line" />;
}
