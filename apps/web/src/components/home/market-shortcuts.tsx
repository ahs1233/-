import Link from "next/link";
import { MoreHorizontal, ChevronLeft } from "lucide-react";
import type { MarketItem } from "@al-souq/api";
import { marketDisplayName } from "@/src/lib/market";

/**
 * صفٌّ مصغّر لأسواق المدينة على الرئيسية (الشاشة ١) — أيقوناتٌ صغيرة تظهر كلّها في
 * أوّل شاشة، وآخرها «المزيد» يفتح صفحة اختيار السوق الكاملة (الشاشة ٢).
 */
export function MarketShortcuts({ markets, govName }: { markets: MarketItem[]; govName?: string }) {
  if (!markets.length) return null;
  const INLINE = 4;
  const shown = markets.slice(0, INLINE);
  const showMore = markets.length > INLINE;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-100">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          إلى أين تريد الذهاب؟
        </h2>
        <Link href="/markets" className="flex items-center gap-0.5 text-sm font-medium text-gold-400 hover:text-gold-300">
          كل الأسواق <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {shown.map((m) => (
          <Link key={m.id} href={`/market/${m.slug}`} className="group flex flex-col items-center gap-1.5">
            <span className="bg-card2 relative grid aspect-square w-full place-items-center rounded-2xl border border-line text-2xl shadow-sm transition group-hover:border-gold-500/50 group-hover:bg-card">
              <span aria-hidden>{m.icon ?? "🏬"}</span>
              {m.status === "soon" && (
                <span className="absolute -top-1.5 -start-1.5 rounded-full bg-gold-500 px-1.5 py-0.5 text-[8px] font-extrabold text-brand-900">قريباً</span>
              )}
            </span>
            <span className="line-clamp-2 text-center text-[10px] font-semibold leading-tight text-neutral-200">{marketDisplayName(m.nameAr, govName)}</span>
          </Link>
        ))}
        {showMore && (
          <Link href="/markets" className="group flex flex-col items-center gap-1.5">
            <span className="bg-card2 grid aspect-square w-full place-items-center rounded-2xl border border-line text-gold-300 shadow-sm transition group-hover:border-gold-500/50 group-hover:bg-card">
              <MoreHorizontal className="h-6 w-6" />
            </span>
            <span className="text-center text-[10px] font-semibold text-neutral-200">المزيد</span>
          </Link>
        )}
      </div>
    </section>
  );
}
