import Link from "next/link";
import { AppImage } from "@/src/components/app-image";
import { BrandMark } from "@/src/components/brand-logo";
import type { MarketItem } from "@al-souq/api";

/**
 * «اختر السوق» — قلبُ الرئيسية. لا يعرض فئاتٍ ولا منتجات، بل أسواقاً كاملة
 * (متاجر بغداد، الإلكترونية، الطعام، السفر…). كلّ بطاقةٍ تحمل شعار «السوگ»
 * في الأعلى فيعرف العقل أنّها جزءٌ منه، ثم اسم السوق فقط.
 */
export function MarketGrid({ markets, governorate }: { markets: MarketItem[]; governorate?: string }) {
  if (!markets.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-center">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          اختر السوق الذي يناسبك
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
      {governorate && (
        <p className="mt-3 text-center text-xs text-neutral-400">كلّ الأسواق داخل {governorate} — الدفع عند الاستلام</p>
      )}
    </section>
  );
}

function MarketCard({ market }: { market: MarketItem }) {
  const soon = market.status === "soon";
  return (
    <Link
      href={`/market/${market.slug}`}
      className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-2xl border border-gold-200 shadow-md ring-1 ring-gold-100/70 transition hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-lg"
    >
      {/* الخلفيّة: صورةٌ أو تدرّجٌ نيليّ */}
      {market.imageUrl ? (
        <AppImage src={market.imageUrl} alt={market.nameAr} sizes="(max-width:640px) 50vw, 33vw" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-brand-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-brand-900/95 via-brand-900/45 to-brand-900/25" />

      {/* شعار «السوگ» — يربط كلّ الأسواق بهويّةٍ واحدة */}
      <span className="absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/10 ring-1 ring-gold-300/40 backdrop-blur">
        <BrandMark className="h-5 w-5" />
      </span>
      {soon && (
        <span className="absolute start-2 top-2 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-extrabold text-brand-900">قريباً</span>
      )}

      {/* الرمز + الاسم */}
      <div className="relative mt-auto flex flex-col gap-0.5 p-3">
        {market.icon && <span className="mb-0.5 text-2xl drop-shadow" aria-hidden>{market.icon}</span>}
        <span className="text-base font-extrabold leading-tight text-white drop-shadow">{market.nameAr}</span>
        {market.tagline && <span className="line-clamp-1 text-[11px] text-gold-100/90">{market.tagline}</span>}
      </div>
    </Link>
  );
}
