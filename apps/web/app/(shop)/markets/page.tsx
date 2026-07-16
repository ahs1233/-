import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { marketDisplayName } from "@/src/lib/market";
import type { MarketItem } from "@al-souq/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "اختر السوق — السوگ" };

export default async function MarketsPage() {
  const gov = getGovernorate();
  let markets: MarketItem[] = [];
  try {
    const api = await getServerApi();
    markets = await api.market.list();
  } catch {
    /* قاعدة البيانات غير جاهزة */
  }

  return (
    <div className="space-y-5">
      {/* رأس الصفحة */}
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="رجوع" className="bg-card2 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl border border-line text-neutral-200 hover:border-gold-500/50">
          <ChevronRight className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-neutral-100">اختر السوق</h1>
          <p className="text-xs text-neutral-400">كلّ سوقٍ عالمٌ مستقلّ في {gov?.name ?? "العراق"}</p>
        </div>
      </div>

      {markets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">لا توجد أسواق متاحة بعد.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {markets.map((m) => {
            const soon = m.status === "soon";
            return (
              <Link
                key={m.id}
                href={`/market/${m.slug}`}
                className="bg-card2 group flex flex-col items-center gap-2 rounded-2xl border border-line p-4 text-center transition hover:border-gold-500/50 hover:bg-card"
              >
                <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-brand-800/40 text-3xl ring-1 ring-line" aria-hidden>
                  {m.icon ?? "🏬"}
                  {soon && (
                    <span className="absolute -top-1.5 -start-1.5 rounded-full bg-gold-500 px-1.5 py-0.5 text-[8px] font-extrabold text-brand-900">قريباً</span>
                  )}
                </span>
                <span className="line-clamp-1 font-bold text-neutral-100">{marketDisplayName(m.nameAr, gov?.name)}</span>
                <span className="line-clamp-2 text-[11px] leading-tight text-neutral-400">{m.tagline ?? "استكشف"}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
