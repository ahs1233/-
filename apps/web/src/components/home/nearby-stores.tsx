"use client";

import Link from "next/link";
import { MapPin, ChevronLeft } from "lucide-react";
import { StoreRailCard, type StoreRailData } from "@/src/components/home/store-rail-card";

const RAIL = "-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** «قريب منك» على الرئيسية — معاينةٌ لمتاجر المحافظة، و«الخريطة» تفتح الصفحة الكاملة (/nearby). */
export function NearbyStores({ stores }: { stores: StoreRailData[]; govName?: string }) {
  if (!stores.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-100">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          <MapPin className="h-4 w-4 text-gold-400" aria-hidden />
          قريب منك
        </h2>
        <Link href="/nearby" className="flex items-center gap-0.5 text-sm font-medium text-gold-400 hover:text-gold-300">
          الخريطة <ChevronLeft className="h-4 w-4" />
        </Link>
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
