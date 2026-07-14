"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { MarketItem } from "@al-souq/api";
import { marketDisplayName } from "@/src/lib/market";

/**
 * «اختر السوق الذي يناسبك» — شبكةُ أيقوناتٍ بأربعة أعمدة (لا بطاقات صور). كلّ سوقٍ
 * عالمٌ مستقلّ. تُعرض ثمانية، والباقي خلف «المزيد». يتكيّف اسم السوق مع المحافظة:
 * «سوگ {gov}» ← «سوگ بغداد».
 */
export function MarketGrid({ markets, govName }: { markets: MarketItem[]; govName?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!markets.length) return null;
  const INITIAL = 8;
  const hasMore = markets.length > INITIAL;
  const shown = expanded ? markets : markets.slice(0, INITIAL);

  return (
    <section>
      <h2 className="mb-3 text-center text-lg font-extrabold text-neutral-100">اختر السوق الذي يناسبك</h2>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4">
        {shown.map((m) => (
          <Link key={m.id} href={`/market/${m.slug}`} className="group flex flex-col items-center gap-1.5">
            <span className="bg-card2 relative grid aspect-square w-full place-items-center rounded-2xl border border-line text-3xl shadow-sm transition group-hover:border-gold-500/50 group-hover:bg-card">
              <span aria-hidden>{m.icon ?? "🏬"}</span>
              {m.status === "soon" && (
                <span className="absolute -top-1.5 -start-1.5 rounded-full bg-gold-500 px-1.5 py-0.5 text-[8px] font-extrabold text-brand-900">قريباً</span>
              )}
            </span>
            <span className="line-clamp-1 text-center text-[11px] font-semibold text-neutral-200">{marketDisplayName(m.nameAr, govName)}</span>
          </Link>
        ))}
      </div>
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="bg-card2 inline-flex items-center gap-1.5 rounded-full border border-line px-5 py-2 text-sm font-semibold text-neutral-200 transition hover:border-gold-500/50"
          >
            {expanded ? "أقلّ" : "المزيد"}
            <ChevronDown className={`h-4 w-4 text-gold-400 transition ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}
    </section>
  );
}
