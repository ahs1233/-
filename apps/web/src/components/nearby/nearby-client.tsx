"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { LocateFixed, Loader2, Star, Store, ChevronLeft } from "lucide-react";
import { AppImage } from "@/src/components/app-image";
import type { NearbyStore } from "@al-souq/api";

const NearbyMap = dynamic(() => import("./nearby-map"), {
  ssr: false,
  loading: () => <div className="bg-card2 grid h-72 w-full place-items-center rounded-2xl border border-line text-sm text-neutral-500">…تحميل الخريطة</div>,
});

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} م` : `${(m / 1000).toFixed(1)} كم`);

export function NearbyClient({ stores, govName }: { stores: NearbyStore[]; govName?: string }) {
  const [user, setUser] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  function locate() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLoading(false); setUser({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => setLoading(false),
      { timeout: 8000, maximumAge: 300000, enableHighAccuracy: true },
    );
  }

  const withDist = useMemo(() => {
    const list = stores.map((s) => ({ ...s, dist: user ? haversine(user, { lat: s.latitude, lng: s.longitude }) : null }));
    return user ? list.sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0)) : list;
  }, [stores, user]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-neutral-400">
          {user ? "مرتّبة حسب الأقرب إليك" : `متاجر ${govName ?? "العراق"} على الخريطة`}
        </p>
        <button
          onClick={locate}
          className="bg-card2 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-gold-500/50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5 text-gold-400" />}
          {user ? "تحديث موقعي" : "فعّل موقعي"}
        </button>
      </div>

      {stores.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">لا توجد متاجر بموقعٍ محدّد بعد.</p>
      ) : (
        <>
          <NearbyMap stores={stores} user={user} />
          <p className="text-[10px] text-neutral-500">© مساهمو OpenStreetMap</p>

          <h2 className="flex items-center gap-2 pt-1 text-lg font-extrabold text-neutral-100">
            <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
            متاجر بالقرب منك
          </h2>
          <ul className="space-y-2.5">
            {withDist.map((s) => (
              <li key={s.id}>
                <Link href={`/store/${s.slug}`} className="bg-card group flex items-center gap-3 rounded-2xl border border-line p-3 shadow-sm transition hover:border-gold-500/40">
                  <span className="bg-card2 grid h-12 w-12 flex-shrink-0 place-items-center overflow-hidden rounded-xl text-gold-300">
                    {s.logoUrl ? (
                      <AppImage src={s.logoUrl} alt={s.storeName} sizes="48px" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-neutral-100">{s.storeName}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
                      {s.dist != null && <span className="font-semibold text-gold-300 nums">{fmtDist(s.dist)}</span>}
                      {s.ratingCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-gold-500 text-gold-500" /> {s.ratingAvg.toFixed(1)}
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronLeft className="h-5 w-5 flex-shrink-0 text-neutral-500 transition group-hover:text-gold-400" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
