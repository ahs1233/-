import Link from "next/link";
import { ChevronLeft, Store } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { CategoryIcon } from "@/src/components/category-icon";
import { HomeHero } from "@/src/components/home-hero";
import { ServicesGrid } from "@/src/components/home/services-grid";
import { ProductRail, StoreRail } from "@/src/components/home/section-rail";
import { FeaturedEntityCard, MarketPulse, SoukTiles, DailyBanner } from "@/src/components/home/home-blocks";
import { getCachedCategories, type CachedCategory } from "@/src/lib/catalog-cache";
import type { HomeExtras } from "@al-souq/api";

export const dynamic = "force-dynamic";

type HomeSections = Awaited<ReturnType<Awaited<ReturnType<typeof getServerApi>>["discovery"]["home"]>>;

export default async function HomePage() {
  const gov = getGovernorate();
  let categories: CachedCategory[] = [];
  let sections: HomeSections = [];
  let extras: HomeExtras | null = null;
  let dbReady = true;
  try {
    const api = await getServerApi();
    [categories, sections, extras] = await Promise.all([
      getCachedCategories(),
      api.discovery.home({ governorateId: gov?.id }),
      api.discovery.homeExtras({ governorateId: gov?.id }),
    ]);
  } catch {
    dbReady = false;
  }

  // وصول سريع لأقسام الاكتشاف بالمفتاح (لتحويلها إلى شرائط أفقيّة بنسق Snapp).
  const byKey = new Map<string, HomeSections[number]>(sections.map((s) => [s.key, s]));
  const productItems = (key: string) => {
    const s = byKey.get(key);
    return s && s.kind === "products" ? s.items : [];
  };
  const storeItems = () => {
    const s = byKey.get("new_stores");
    return s && s.kind === "stores" ? s.items : [];
  };

  return (
    <div className="space-y-7">
      {/* بوّابة المحافظة — الإحساس يتغيّر بالمحافظة، والتخطيط ثابت */}
      <HomeHero governorate={gov?.name} storeCount={extras?.stats.openStores} stats={extras?.stats} />

      {/* خدمات السوگ — «مدنٌ صغيرة» داخل المحافظة (نسق Super-App) */}
      <ServicesGrid />

      {!dbReady && (
        <div className="rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-600">
          المتجر قيد التجهيز — لم تُربط قاعدة البيانات بعد.
        </div>
      )}

      {/* القصّة: المدينة ← الأسواق ← الناس/الحياة ← المنتجات ← التاجر */}

      {/* الأسواق كأماكن — تولّد فضولاً، لا مجرّد فئات */}
      <SoukTiles governorate={gov?.name} />

      {/* نبض المحافظة — حياةُ السوق، لا منتجات */}
      {extras && <MarketPulse events={extras.pulse} governorate={gov?.name} />}

      {/* إيقاعٌ بصريّ — لافتةٌ نيليّة غامرة */}
      <DailyBanner governorate={gov?.name} />

      {/* المنتجات — شريطان فقط (لا لوحة إعلانات) */}
      <ProductRail emoji="🔥" title="الأكثر شراءً اليوم" href="/search" items={productItems("best_selling")} />
      <ProductRail emoji="🆕" title="وصل حديثاً" href="/search" items={productItems("new")} />

      {/* التاجر — خِتام القصّة */}
      <StoreRail emoji="🛍️" title="متاجر موصى بها" href="/stores" items={storeItems()} />
      {extras?.featured && <FeaturedEntityCard entity={extras.featured} />}

      {dbReady && sections.length === 0 && !extras?.featured && (
        <div className="rounded-2xl border border-dashed border-neutral-200 p-10 text-center text-neutral-400">
          لا توجد منتجات بعد.
        </div>
      )}

      {/* تسوّق حسب الفئة */}
      {categories.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
              <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
              تسوّق حسب الفئة
            </h2>
            <Link href="/categories" className="flex items-center gap-0.5 text-sm font-medium text-gold-700 hover:text-gold-600">
              الكل <ChevronLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {categories.slice(0, 12).map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="group flex flex-col items-center gap-2">
                <span className="grid h-16 w-16 place-items-center rounded-2xl border border-sand-200 bg-gradient-to-b from-white to-sand-50 text-brand-700 shadow-sm transition group-hover:border-gold-300 group-hover:from-gold-50 group-hover:to-gold-100">
                  <CategoryIcon name={c.icon} className="h-6 w-6" />
                </span>
                <span className="line-clamp-1 text-center text-[11px] font-medium text-neutral-700">{c.nameAr}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* دعوة أصحاب المتاجر للتسجيل */}
      <Link
        href="/become-seller"
        className="flex items-center gap-3 overflow-hidden rounded-3xl border border-gold-300 bg-gradient-to-l from-gold-50 to-sand-100 p-5 shadow-sm transition hover:border-gold-400"
      >
        <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-gold-500 text-white">
          <Store className="h-6 w-6" />
        </span>
        <span className="flex-1">
          <span className="block font-bold text-neutral-900">هل لديك متجر؟ بِع في السوگ</span>
          <span className="block text-sm text-neutral-600">سجّل متجرك وابدأ البيع لكل العراق — الدفع عند الاستلام.</span>
        </span>
        <ChevronLeft className="h-5 w-5 flex-shrink-0 text-gold-600" />
      </Link>
    </div>
  );
}
