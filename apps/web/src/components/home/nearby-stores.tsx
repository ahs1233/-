"use client";

import { useState } from "react";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";
import { StoreRailCard, type StoreRailData } from "@/src/components/home/store-rail-card";

const RAIL = "-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * «قريب منك» — متاجر المحافظة بإطار الموقع. زرٌّ يطلب إذن GPS الحقيقيّ؛ وحتّى تُربط
 * إحداثيّات المتاجر لاحقاً نعرض متاجر المحافظة كأقرب مجموعةٍ متاحة.
 */
export function NearbyStores({ stores, govName }: { stores: StoreRailData[]; govName?: string }) {
  const [located, setLocated] = useState(false);
  const [loading, setLoading] = useState(false);
  if (!stores.length) return null;

  function locate() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocated(true);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      () => { setLoading(false); setLocated(true); },
      () => { setLoading(false); setLocated(true); },
      { timeout: 8000, maximumAge: 300000 },
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-100">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          <MapPin className="h-4 w-4 text-gold-400" aria-hidden />
          قريب منك
        </h2>
        {located ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-petrol">
            <LocateFixed className="h-3.5 w-3.5" />
            {govName ? `في ${govName}` : "تمّ تحديد موقعك"}
          </span>
        ) : (
          <button
            onClick={locate}
            className="bg-card2 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-gold-500/50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5 text-gold-400" />}
            فعّل موقعك
          </button>
        )}
      </div>
      <div className={RAIL}>
        {stores.map((s) => (
          <div key={s.id} className="w-44 flex-shrink-0">
            <StoreRailCard store={s} />
          </div>
        ))}
      </div>
    </section>
  );
}
