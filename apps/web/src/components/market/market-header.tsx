import { AppImage } from "@/src/components/app-image";
import { BrandMark } from "@/src/components/brand-logo";
import { marketDisplayName } from "@/src/lib/market";
import type { MarketItem } from "@al-souq/api";

/** رأسُ السوق — لافتةٌ سينمائيّة تحمل شعار «السوگ» واسم السوق (دخولُ عالمٍ مستقلّ). */
export function MarketHeader({ market, governorate }: { market: MarketItem; governorate?: string }) {
  const name = marketDisplayName(market.nameAr, governorate);
  return (
    <section className="relative overflow-hidden rounded-3xl shadow-lg ring-1 ring-gold-500/30">
      <div className="relative aspect-[16/9] max-h-[300px] w-full">
        {market.imageUrl ? (
          <AppImage src={market.imageUrl} alt={name} sizes="(max-width:768px) 100vw, 768px" priority className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-brand-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900/95 via-brand-900/55 to-brand-900/25" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6">
          <span className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-gold-100 ring-1 ring-gold-300/40 backdrop-blur">
            <BrandMark className="h-4 w-4" /> السوگ{governorate ? ` · ${governorate}` : ""}
          </span>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white drop-shadow sm:text-3xl">
            {market.icon && <span aria-hidden>{market.icon}</span>}
            {name}
          </h1>
          {market.tagline && <p className="mt-0.5 text-sm text-white/85 drop-shadow">{market.tagline}</p>}
        </div>
      </div>
    </section>
  );
}
