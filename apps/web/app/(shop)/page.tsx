import Link from "next/link";
import { ChevronLeft, Store, LayoutGrid } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { ProductCard } from "@/src/components/product-card";
import { CategoryIcon } from "@/src/components/category-icon";
import { HomeHero } from "@/src/components/home-hero";
import { StatStrip, FeaturedEntityCard, MarketPulse, SoukTiles } from "@/src/components/home/home-blocks";
import { AppImage } from "@/src/components/app-image";
import { getCachedCategories, type CachedCategory } from "@/src/lib/catalog-cache";
import type { HomeExtras } from "@al-souq/api";

export const dynamic = "force-dynamic";

// هوية كل قسم: عنوان + هدف (Δ1). المصدر الوحيد للأقسام هو محرّك الاكتشاف.
const SECTION_META: Record<string, { title: string; purpose: string }> = {
  today: { title: "اليوم في السوگ", purpose: "مختارات متنوّعة تبدأ منها رحلة تسوّقك" },
  trending: { title: "الأكثر رواجاً هذا الأسبوع", purpose: "ما يشتريه الناس فعلاً حولك" },
  new: { title: "جديد هذا الأسبوع", purpose: "أحدث ما وصل من التجّار" },
  top_rated: { title: "الأعلى تقييماً", purpose: "منتجات نالت رضا المشترين" },
  best_selling: { title: "الأكثر مبيعاً", purpose: "الأكثر طلباً عبر الوقت" },
  new_stores: { title: "متاجر جديدة", purpose: "تجّار انضموا حديثاً إلى السوگ" },
};

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

  return (
    <div className="space-y-7">
      {/* البطل السينمائيّ — بوّابة «دخلتُ بغداد» */}
      <HomeHero governorate={gov?.name} />

      {/* شريط الأرقام الحيّة — نبض السوق رقماً */}
      {extras && (extras.stats.openStores > 0 || extras.stats.newOffersToday > 0) && (
        <StatStrip stats={extras.stats} governorate={gov?.name} />
      )}

      {/* جهة موصى بها لك — أكبر عنصر بعد البطل */}
      {extras?.featured && <FeaturedEntityCard entity={extras.featured} />}

      {/* السوق الآن — نبض حيّ */}
      {extras && <MarketPulse events={extras.pulse} />}

      {/* تصفّح الأسواق — بلاطات مصوّرة */}
      <SoukTiles />

      {!dbReady && (
        <div className="rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-600">
          المتجر قيد التجهيز — لم تُربط قاعدة البيانات بعد.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/stores" className="flex items-center gap-2 rounded-2xl border border-sand-200 bg-white p-4 font-semibold text-brand-700 shadow-sm transition hover:border-gold-300 hover:bg-gold-50">
          <Store className="h-5 w-5 text-gold-600" /> تصفّح المتاجر
        </Link>
        <Link href="/categories" className="flex items-center gap-2 rounded-2xl border border-sand-200 bg-white p-4 font-semibold text-brand-700 shadow-sm transition hover:border-gold-300 hover:bg-gold-50">
          <LayoutGrid className="h-5 w-5 text-gold-600" /> كل الفئات
        </Link>
      </div>

      {/* الفئات — تصنيف تنقّل (ليس اكتشافاً) */}
      {categories.length > 0 && (
        <section>
          <SectionHeader title="تسوّق حسب الفئة" href="/categories" />
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

      {/* أقسام الاكتشاف — المصدر الوحيد: DiscoveryService */}
      {dbReady && sections.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-200 p-10 text-center text-neutral-400">
          لا توجد منتجات بعد.
        </div>
      )}

      {sections.map((section) => {
        const meta = SECTION_META[section.key];
        return (
          <section key={section.key}>
            <div className="mb-3">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
                <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
                {meta?.title ?? section.key}
              </h2>
              {meta?.purpose && <p className="mt-0.5 ps-3 text-sm text-neutral-500">{meta.purpose}</p>}
            </div>
            {section.kind === "stores" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {section.items.map((s) => (
                  <StoreCard key={s.id} store={s} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {section.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        );
      })}

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

function StoreCard({
  store,
}: {
  store: { slug: string; storeName: string; logoUrl: string | null; productCount: number };
}) {
  return (
    <Link
      href={`/store/${store.slug}`}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
        {store.logoUrl ? (
          <AppImage src={store.logoUrl} alt={store.storeName} className="h-full w-full object-cover" />
        ) : (
          <Store className="h-7 w-7 text-brand-600" />
        )}
      </span>
      <span className="line-clamp-1 text-sm font-semibold text-neutral-900">{store.storeName}</span>
      <span className="text-xs text-neutral-400">{store.productCount} منتج</span>
    </Link>
  );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
        <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
        {title}
      </h2>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 text-sm font-medium text-gold-700 hover:text-gold-600">
          الكل <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
