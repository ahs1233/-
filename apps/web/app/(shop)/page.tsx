import Link from "next/link";
import { ChevronLeft, Store } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { CategoryIcon } from "@/src/components/category-icon";
import { HomeHero } from "@/src/components/home-hero";
import { ServicesGrid } from "@/src/components/home/services-grid";
import { ProductRail, StoreRail } from "@/src/components/home/section-rail";
import { ProductsTabs } from "@/src/components/home/products-tabs";
import { FeaturedEntityCard, MarketPulse, SoukTiles, AdsCarousel } from "@/src/components/home/home-blocks";
import { resolveGovIdentity } from "@/src/lib/governorate-identity";
import { getCachedCategories, type CachedCategory } from "@/src/lib/catalog-cache";
import type { HomeExtras, AppContent } from "@al-souq/api";

export const dynamic = "force-dynamic";

type HomeSections = Awaited<ReturnType<Awaited<ReturnType<typeof getServerApi>>["discovery"]["home"]>>;

// الترتيب الافتراضيّ = رحلةٌ في المدينة: أسواق ← نبض ← عروض ← منتجات ← متاجر ← فئات.
const DEFAULT_ORDER = ["souks", "pulse", "banner", "products", "stores", "categories"];

// خلفيّةٌ متناوبة (عاجيّ/أبيض) لكل شريحة كي «تتنفّس» الصفحة.
function Band({ surface, children }: { surface: "ivory" | "white"; children: React.ReactNode }) {
  return <div className={`-mx-4 px-4 py-6 ${surface === "white" ? "bg-white" : "bg-sand-50"}`}>{children}</div>;
}

export default async function HomePage() {
  const gov = getGovernorate();
  let categories: CachedCategory[] = [];
  let sections: HomeSections = [];
  let extras: HomeExtras | null = null;
  let homeOrder: string[] = DEFAULT_ORDER;
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

  // قسم المنتجات الموحّد (تبويبات).
  const productTabs = [
    { key: "best_selling", label: "الأكثر شراءً", items: productItems("best_selling") },
    { key: "new", label: "وصل حديثاً", items: productItems("new") },
    { key: "top_rated", label: "الأعلى تقييماً", items: productItems("top_rated") },
    { key: "trending", label: "ترند", items: productItems("trending") },
  ];

  const categoriesBlock =
    categories.length > 0 ? (
      <section>
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
    ) : null;

  // كتلُ الرئيسية (المفاتيح الجديدة + توافقٌ خلفيّ مع القديمة إن بقيت في إعداد الأدمن).
  const blocks: Record<string, React.ReactNode> = {
    souks: <SoukTiles governorate={gov?.name} souks={identity.souks} title={sectionTitles.souks} />,
    pulse: extras ? <MarketPulse events={extras.pulse} governorate={gov?.name} /> : null,
    banner: <AdsCarousel ads={content.ads} governorate={gov?.name} />,
    products: <ProductsTabs title={t("products", "منتجات السوگ")} tabs={productTabs} />,
    stores: <StoreRail emoji="🏪" title={t("stores", "متاجر مميّزة")} href="/stores" items={storeItems()} />,
    categories: categoriesBlock,
    // ── مفاتيح قديمة (تبقى تعمل لو كانت محفوظة) ──
    services: <ServicesGrid config={servicesCfg} labels={serviceLabels} />,
    best_selling: <ProductRail emoji="🔥" title={t("best_selling", "الأكثر شراءً اليوم")} href="/search" items={productItems("best_selling")} />,
    new: <ProductRail emoji="🆕" title={t("new", "وصل حديثاً")} href="/search" items={productItems("new")} />,
    featured: extras?.featured ? <FeaturedEntityCard entity={extras.featured} /> : null,
  };

  // نعرض الكتل الموجودة فقط، وتتناوب خلفيّاتها عاجيّ/أبيض حسب الموضع.
  const rendered = homeOrder.map((k) => ({ k, node: blocks[k] })).filter((b) => b.node);

  return (
    <div>
      {/* ① بوّابة المحافظة — دائماً أوّلاً (لا تُعاد ترتيبها) */}
      <HomeHero
        governorate={gov?.name}
        storeCount={extras?.stats.openStores}
        stats={extras?.stats}
        heroImage={identity.hero}
        feel={identity.feel}
      />

      {!dbReady && (
        <div className="mt-5 rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-600">
          المتجر قيد التجهيز — لم تُربط قاعدة البيانات بعد.
        </div>
      )}

      {/* بقيّة الرحلة بإيقاعٍ بصريّ (شرائح متناوبة) */}
      <div className="mt-5">
        {rendered.map((b, i) => (
          <Band key={b.k} surface={i % 2 === 0 ? "ivory" : "white"}>
            {b.node}
          </Band>
        ))}
      </div>

      {dbReady && sections.length === 0 && !extras?.featured && (
        <div className="my-6 rounded-2xl border border-dashed border-neutral-200 p-10 text-center text-neutral-400">
          لا توجد منتجات بعد.
        </div>
      )}

      {/* ⑧ افتح متجرك — دعوةٌ في نهاية الرحلة (نيليّ يكسر الإيقاع) */}
      <div className="-mx-4 px-4 py-6">
        <Link
          href="/become-seller"
          className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-l from-brand-700 to-brand-900 p-5 text-white shadow-lg ring-1 ring-brand-800"
        >
          <span
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{ backgroundImage: "radial-gradient(120px 90px at 15% 30%, rgba(255,196,96,.35), transparent 70%)" }}
            aria-hidden
          />
          <span className="relative grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-gold-500 text-brand-900">
            <Store className="h-6 w-6" />
          </span>
          <span className="relative flex-1">
            <span className="block font-extrabold">هل لديك متجر؟ ابدأ تجارتك في سوق العراق</span>
            <span className="block text-sm text-white/70">سجّل متجرك وبِع بضاعتك بسهولة — الدفع عند الاستلام.</span>
          </span>
          <ChevronLeft className="relative h-5 w-5 flex-shrink-0 text-gold-300" />
        </Link>
      </div>
    </div>
  );
}
