import Link from "next/link";
import { ChevronLeft, Store } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { CategoryIcon } from "@/src/components/category-icon";
import { HomeHero } from "@/src/components/home-hero";
import { ServicesGrid } from "@/src/components/home/services-grid";
import { ProductRail, StoreRail } from "@/src/components/home/section-rail";
import { FeaturedEntityCard, MarketPulse, SoukTiles, AdsCarousel } from "@/src/components/home/home-blocks";
import { resolveGovIdentity } from "@/src/lib/governorate-identity";
import { getCachedCategories, type CachedCategory } from "@/src/lib/catalog-cache";
import type { HomeExtras, AppContent } from "@al-souq/api";

export const dynamic = "force-dynamic";

type HomeSections = Awaited<ReturnType<Awaited<ReturnType<typeof getServerApi>>["discovery"]["home"]>>;

export default async function HomePage() {
  const gov = getGovernorate();
  let categories: CachedCategory[] = [];
  let sections: HomeSections = [];
  let extras: HomeExtras | null = null;
  let homeOrder: string[] = ["services", "souks", "pulse", "banner", "best_selling", "new", "stores", "featured", "categories"];
  let servicesCfg: { key: string; visible: boolean; soon: boolean }[] | undefined;
  let serviceLabels: Record<string, string> = {};
  let sectionTitles: Record<string, string> = {};
  let content: AppContent = { governorate: null, ads: [] };
  let dbReady = true;
  try {
    const api = await getServerApi();
    const [cats, secs, ex, appearance, cont] = await Promise.all([
      getCachedCategories(),
      api.discovery.home({ governorateId: gov?.id }),
      api.discovery.homeExtras({ governorateId: gov?.id }),
      api.appearance.get(),
      api.appearance.content({ governorateId: gov?.id }),
    ]);
    categories = cats;
    sections = secs;
    extras = ex;
    content = cont;
    if (appearance.sections?.length) homeOrder = appearance.sections.filter((s) => s.visible).map((s) => s.key);
    servicesCfg = appearance.services;
    serviceLabels = appearance.serviceLabels ?? {};
    sectionTitles = appearance.sectionTitles ?? {};
  } catch {
    dbReady = false;
  }

  // هويّة المحافظة: عرضُ القاعدة (تبويب المحافظات) فوق الافتراضيّ في الكود.
  const identity = resolveGovIdentity(gov?.name, content.governorate);
  const t = (key: string, fallback: string) => sectionTitles[key] ?? fallback;

  const byKey = new Map<string, HomeSections[number]>(sections.map((s) => [s.key, s]));
  const productItems = (key: string) => {
    const s = byKey.get(key);
    return s && s.kind === "products" ? s.items : [];
  };
  const storeItems = () => {
    const s = byKey.get("new_stores");
    return s && s.kind === "stores" ? s.items : [];
  };

  // كتلُ الرئيسية القابلة لإعادة الترتيب من لوحة «المظهر».
  const blocks: Record<string, React.ReactNode> = {
    services: <ServicesGrid key="services" config={servicesCfg} labels={serviceLabels} />,
    souks: <SoukTiles key="souks" governorate={gov?.name} souks={identity.souks} title={sectionTitles.souks} />,
    pulse: extras ? <MarketPulse key="pulse" events={extras.pulse} governorate={gov?.name} /> : null,
    banner: <AdsCarousel key="banner" ads={content.ads} governorate={gov?.name} />,
    best_selling: <ProductRail key="best_selling" emoji="🔥" title={t("best_selling", "الأكثر شراءً اليوم")} href="/search" items={productItems("best_selling")} />,
    new: <ProductRail key="new" emoji="🆕" title={t("new", "وصل حديثاً")} href="/search" items={productItems("new")} />,
    stores: <StoreRail key="stores" emoji="🛍️" title={t("stores", "متاجر موصى بها")} href="/stores" items={storeItems()} />,
    featured: extras?.featured ? <FeaturedEntityCard key="featured" entity={extras.featured} /> : null,
    categories:
      categories.length > 0 ? (
        <section key="categories">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
              <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
              {t("categories", "تسوّق حسب الفئة")}
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
      ) : null,
  };

  return (
    <div className="space-y-7">
      {/* بوّابة المحافظة — دائماً أوّلاً (لا تُعاد ترتيبها) */}
      <HomeHero
        governorate={gov?.name}
        storeCount={extras?.stats.openStores}
        stats={extras?.stats}
        heroImage={identity.hero}
        feel={identity.feel}
      />

      {!dbReady && (
        <div className="rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-600">
          المتجر قيد التجهيز — لم تُربط قاعدة البيانات بعد.
        </div>
      )}

      {/* بقيّة الأقسام بترتيب الأدمن */}
      {homeOrder.map((k) => blocks[k]).filter(Boolean)}

      {dbReady && sections.length === 0 && !extras?.featured && (
        <div className="rounded-2xl border border-dashed border-neutral-200 p-10 text-center text-neutral-400">
          لا توجد منتجات بعد.
        </div>
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
