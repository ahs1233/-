import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Clock } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { getCachedCategories } from "@/src/lib/catalog-cache";
import { MarketHeader } from "@/src/components/market/market-header";
import { MarketPulse, SoukTiles, AdsCarousel } from "@/src/components/home/home-blocks";
import { ProductsTabs } from "@/src/components/home/products-tabs";
import { StoreRail } from "@/src/components/home/section-rail";
import { ProductCard } from "@/src/components/product-card";
import { SubMarketGrid } from "@/src/components/category/sub-market-grid";
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

  return (
    <div>
      <MarketHeader market={market} governorate={gov?.name} />

      <div className="mt-5">
        {market.status === "soon" ? (
          <ComingSoon name={displayName} />
        ) : market.kind === "stores" ? (
          <StoresMarket channel={market.channel} govName={gov?.name} govId={gov?.id} displayName={displayName} />
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

/* ── سوق متاجرٍ كامل — يحترم ترتيب الأقسام المضبوط من لوحة الإدارة (المظهر ← الأقسام).
   channel يفصل العالم الواقعيّ (physical) عن الإلكترونيّ (online) فيعرض بائعي قناته فقط. ── */
async function StoresMarket({
  channel,
  govName,
  govId,
  displayName,
}: {
  channel?: string | null;
  govName?: string;
  govId?: string;
  displayName: string;
}) {
  const api = await getServerApi();
  const ch = channel === "online" || channel === "physical" ? channel : undefined;
  const online = ch === "online";
  const [sections, content, appearance, extras, categories] = await Promise.all([
    api.discovery.home({ governorateId: govId, channel: ch }),
    api.appearance.content({ governorateId: govId }),
    api.appearance.get(),
    api.discovery.homeExtras({ governorateId: govId, channel: ch }),
    getCachedCategories(),
  ]);
  const identity = resolveGovIdentity(govName, content.governorate);
  const titles = appearance.sectionTitles ?? {};
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
  const bannerAds = content.ads.filter((a) => a.placement === "home_banner");

  // بنّاءُ كلّ قسمٍ حسب مفتاحه — نصيّرها بالترتيب المحفوظ في لوحة الإدارة.
  function band(key: string): React.ReactNode {
    switch (key) {
      case "souks":
        // الأسواق الجغرافيّة (المتنبّي/الشورجة) للعالم الواقعيّ فقط، لا الإلكترونيّ.
        return !online && identity.souks.length ? (
          <SoukTiles governorate={govName} souks={identity.souks} title={titles.souks} />
        ) : null;
      case "pulse":
        return extras.pulse.length ? (
          <MarketPulse events={extras.pulse} title={titles.pulse ?? `نبض ${displayName}`} />
        ) : null;
      case "banner":
        return bannerAds.length ? <AdsCarousel ads={content.ads} governorate={govName} /> : null;
      case "products":
        return tabs.some((t) => t.items.length) ? (
          <ProductsTabs title={titles.products ?? (online ? "منتجات المتاجر الإلكترونيّة" : "منتجات السوگ")} tabs={tabs} />
        ) : null;
      case "stores":
        return storeItems().length ? (
          <StoreRail emoji={online ? "📱" : "🏪"} title={titles.stores ?? (online ? "صفحاتٌ مميّزة" : "متاجر مميّزة")} href="/stores" items={storeItems()} />
        ) : null;
      case "categories":
        // أقسام السوق كبوّاباتٍ مستقلّة — «كأنّ كلّاً منها سوق» (الإلكترونيات/الملابس/المنزلية…).
        return categories.length ? (
          <SubMarketGrid
            title={titles.categories ?? (online ? "أقسام المتاجر الإلكترونيّة" : `أقسام سوق ${displayName}`)}
            items={categories.slice(0, 12)}
          />
        ) : null;
      default:
        return null;
    }
  }

  // الأقسام المرئيّة بالترتيب المحفوظ، مع إيقاعٍ بصريّ متبادل بين السطحين.
  const rendered = appearance.sections
    .filter((s) => s.visible)
    .map((s) => ({ key: s.key, node: band(s.key) }))
    .filter((x) => x.node !== null);

  if (rendered.length === 0) {
    return (
      <Band surface="white">
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">
          {online ? "لا توجد متاجر إلكترونيّة في محافظتك بعد." : "لا توجد متاجر في هذا السوق بعد."}
        </p>
      </Band>
    );
  }

  return (
    <>
      {rendered.map((x, i) => (
        <Band key={x.key} surface={i % 2 === 0 ? "white" : "ivory"}>
          {x.node}
        </Band>
      ))}
    </>
  );
}

/* ── سوقٌ مرتبطٌ بفئة (الإلكترونية، الطعام…) — منتجاتها ومتصفّحها ── */
async function CategoryMarket({ slug, name, govId }: { slug: string; name: string; govId?: string }) {
  const api = await getServerApi();
  const cat = await api.catalog.categoryBySlug({ slug }).catch(() => null);
  if (!cat) return <ComingSoon name={name} />;
  const [{ items }, extras] = await Promise.all([
    api.catalog.products({ categoryId: cat.id, governorateId: govId, limit: 12 }),
    api.discovery.homeExtras({ governorateId: govId }).catch(() => null),
  ]);
  const hasChildren = cat.children.length > 0;

  return (
    <>
      {/* أقسام هذا السوق كبوّاباتٍ مستقلّة (فطور/غداء/عشاء/مشروبات…) — «كأنّ كلّاً منها سوق». تُتصدَّر. */}
      {hasChildren && (
        <Band surface="white">
          <SubMarketGrid title={`أقسام ${name}`} items={cat.children} />
        </Band>
      )}
      {extras && extras.pulse.length > 0 && (
        <Band surface="ivory">
          <MarketPulse events={extras.pulse} title={`نبض ${name}`} />
        </Band>
      )}
      <Band surface="ivory">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-100">
            <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
            {hasChildren ? `كلّ منتجات ${name}` : `منتجات ${name}`}
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
