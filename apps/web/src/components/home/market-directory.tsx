import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { MarketItem } from "@al-souq/api";
import { marketDisplayName } from "@/src/lib/market";

/**
 * «إلى أين تريد الذهاب؟» — دليلٌ مدمج لأسواق المدينة. صفوفٌ صغيرة (لا بطاقاتٌ عملاقة)
 * تظهر كلّها تقريباً في أوّل شاشة، مع عدّاد متاجرٍ حيّ بجانب كلّ سوق ليشعر السوق بأنّه مأهول.
 */
export function MarketDirectory({
  markets,
  govName,
  counts,
}: {
  markets: MarketItem[];
  govName?: string;
  counts?: Record<string, number>;
}) {
  if (!markets.length) return null;
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
        <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
        إلى أين تريد الذهاب؟
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {markets.map((m) => {
          const soon = m.status === "soon";
          const count = counts?.[m.id] ?? 0;
          return (
            <Link
              key={m.id}
              href={`/market/${m.slug}`}
              className="bg-card2 group flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 transition hover:border-gold-500/50 hover:bg-card"
            >
              <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand-800/40 text-2xl ring-1 ring-line" aria-hidden>
                {m.icon ?? "🏬"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-neutral-100">{marketDisplayName(m.nameAr, govName)}</span>
                <span className="mt-0.5 block text-[11px] font-medium text-neutral-400">
                  {soon ? (
                    <span className="text-gold-400">يفتح قريباً</span>
                  ) : count > 0 ? (
                    <span className="nums">{count} متجر</span>
                  ) : (
                    m.tagline ?? "استكشف"
                  )}
                </span>
              </span>
              <ChevronLeft className="h-5 w-5 flex-shrink-0 text-neutral-500 transition group-hover:text-gold-400" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
