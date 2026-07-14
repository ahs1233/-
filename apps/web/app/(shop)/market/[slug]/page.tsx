import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Clock } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { getCachedCategories } from "@/src/lib/catalog-cache";
import { CategoryIcon } from "@/src/components/category-icon";
import { MarketHeader } from "@/src/components/market/market-header";
import { MarketPulse, SoukTiles } from "@/src/components/home/home-blocks";
import { ProductsTabs } from "@/src/components/home/products-tabs";
import { StoreRail } from "@/src/components/home/section-rail";
import { ProductCard } from "@/src/components/product-card";
import { resolveGovIdentity } from "@/src/lib/governorate-identity";
import { marketDisplayName } from "@/src/lib/market";

export const dynamic = "force-dynamic";

function Band({ surface, children }: { surface: "ivory" | "white"; children: React.ReactNode }) {
  // إيقاعٌ بصريّ داكن: نتبادل بين خلفيّة الصفحة والبطاقة بدل العاجيّ/الأبيض.
  return <div className={`-mx-4 px-4 py-6 ${surface === "white" ? "bg-card/40" : "bg-page"}`}>{children}</div>;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const api = await getServerApi();
    const m = await api.market.bySlug({ slug: params.slug });
    if (!m) return { title: "سوق غير موجود" };
    return { title: `${m.nameAr} — السوگ`, description: m.tagline ?? undefined };
  } catch {
    return { title: "السوگ" };
  }
}

export default async function MarketPage({ params }: { params: { slug: string } }) {
  const api = await getServerApi();
  const gov = getGovernorate();
  const market = await api.market.bySlug({ slug: params.slug }).catch(() => null);
  if (!market) notFound();

  const displayName = marketDisplayName(market.nameAr, gov?.name);
  const extras = await api.discovery.homeExtras({ governorateId: gov?.id }).catch(() => null);

  return (
    <div>
      <MarketHeader market={market} governorate={gov?.name} />

      <div className="mt-5">
        {/* نبض السوق — مشترَكٌ في كلّ سوق */}
        {extras && extras.pulse.length > 0 && (
          <Band surface="ivory">
            <MarketPulse events={extras.pulse} title={`نبض ${displayName}`} />
          </Band>
        )}

        {market.status === "soon" ? (
          <ComingSoon name={displayName} />
        ) : market.kind === "stores" ? (
          <StoresMarket govName={gov?.name} govId={gov?.id} />
        ) : market.categorySlug ? (
          <CategoryMarket slug={market.categorySlug} name={displayName} govId={gov?.id} />
        ) : (
          <ComingSoon name={displayName} />
        )}
      </div>

      <div className="-mx-4 px-4 py-6">
        <Link href="/" className="flex items-center justify-center gap-1 text-sm font-medium text-gold-400 hover:text-gold-300">
          <ChevronLeft className="h-4 w-4 rotate-180" /> عُد لاختيار سوقٍ آخر
        </Link>
      </div>
    </div>
  );
}

/* ── سوق «متاجر بغداد» — الرحلة الكاملة (أسواق ← منتجات ← متاجر ← فئات) ── */
async function StoresMarket({ govName, govId }: { govName?: string; govId?: string }) {
  const api = await getServerApi();
  const [sections, content, categories] = await Promise.all([
    api.discovery.home({ governorateId: govId }),
    api.appearance.content({ governorateId: govId }),
    getCachedCategories(),
  ]);
  const identity = resolveGovIdentity(govName, content.governorate);
  const productItems = (key: string) => {
    const s = sections.find((x) => x.key === key);
    return s && s.kind === "products" ? s.items : [];
  };
  const storeItems = () => {
    const s = sections.find((x) => x.key === "new_stores");
    return s && s.kind === "stores" ? s.items : [];
  };
  const tabs = [
    { key: "best_selling", label: "الأكثر شراءً", items: productItems("best_selling") },
    { key: "new", label: "وصل حديثاً", items: productItems("new") },
    { key: "top_rated", label: "الأعلى تقييماً", items: productItems("top_rated") },
    { key: "trending", label: "ترند", items: productItems("trending") },
  ];

  return (
    <>
      <Band surface="white">
        <SoukTiles governorate={govName} souks={identity.souks} />
      </Band>
      <Band surface="ivory">
        <ProductsTabs title="منتجات السوگ" tabs={tabs} />
      </Band>
      {storeItems().length > 0 && (
        <Band surface="white">
          <StoreRail emoji="🏪" title="متاجر مميّزة" href="/stores" items={storeItems()} />
        </Band>
      )}
      {categories.length > 0 && (
        <Band surface="ivory">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
            <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden /> تسوّق حسب الفئة
          </h2>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {categories.slice(0, 12).map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="group flex flex-col items-center gap-2">
                <span className="bg-card2 grid h-16 w-16 place-items-center rounded-2xl border border-line text-gold-300 shadow-sm transition group-hover:border-gold-500/50 group-hover:bg-card">
                  <CategoryIcon name={c.icon} className="h-6 w-6" />
                </span>
                <span className="line-clamp-1 text-center text-[11px] font-medium text-neutral-300">{c.nameAr}</span>
              </Link>
            ))}
          </div>
        </Band>
      )}
    </>
  );
}

/* ── سوقٌ مرتبطٌ بفئة (الإلكترونية، الطعام…) — منتجاتها ومتصفّحها ── */
async function CategoryMarket({ slug, name, govId }: { slug: string; name: string; govId?: string }) {
  const api = await getServerApi();
  const cat = await api.catalog.categoryBySlug({ slug }).catch(() => null);
  if (!cat) return <ComingSoon name={name} />;
  const [{ items }, allCats] = await Promise.all([
    api.catalog.products({ categoryId: cat.id, governorateId: govId, limit: 12 }),
    getCachedCategories(),
  ]);
  const subs = allCats.find((c) => c.slug === slug)?.children ?? [];

  return (
    <>
      {subs.length > 0 && (
        <Band surface="white">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
            <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden /> أقسام {name}
          </h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {subs.map((s) => (
              <Link key={s.id} href={`/category/${s.slug}`} className="bg-card2 flex-shrink-0 rounded-full border border-line px-4 py-2 text-sm font-medium text-neutral-200 shadow-sm transition hover:border-gold-500/50">
                {s.nameAr}
              </Link>
            ))}
          </div>
        </Band>
      )}
      <Band surface="ivory">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-100">
            <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden /> منتجات {name}
          </h2>
          <Link href={`/category/${slug}`} className="flex items-center gap-0.5 text-sm font-medium text-gold-400 hover:text-gold-300">
            الكل <ChevronLeft className="h-4 w-4" />
          </Link>
        </div>
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">
            لا توجد منتجات في هذا السوق بعد.
          </p>
        )}
      </Band>
    </>
  );
}

/* ── سوقٌ قيد الافتتاح ── */
function ComingSoon({ name }: { name: string }) {
  return (
    <Band surface="white">
      <div className="bg-card flex flex-col items-center gap-3 rounded-3xl border border-gold-500/25 py-14 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-gold-300 ring-1 ring-gold-500/30">
          <Clock className="h-8 w-8" />
        </span>
        <p className="text-xl font-extrabold text-neutral-100">{name} يفتح أبوابه قريباً</p>
        <p className="max-w-xs text-sm text-neutral-400">نُجهّز لك هذا السوق ليكون عالماً كاملاً — تجّاره، عروضه، وخدماته. ترقّبه.</p>
        <Link href="/" className="mt-1 rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-extrabold text-brand-900 hover:bg-gold-400">تصفّح الأسواق المتاحة</Link>
      </div>
    </Band>
  );
}
