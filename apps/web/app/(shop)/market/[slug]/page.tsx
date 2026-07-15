import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Clock } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { getCachedCategories } from "@/src/lib/catalog-cache";
import { MarketHeader } from "@/src/components/market/market-header";
import { MarketPulse, AdsCarousel } from "@/src/components/home/home-blocks";
import { ProductsTabs } from "@/src/components/home/products-tabs";
import { StoreRail } from "@/src/components/home/section-rail";
import { SubMarketGrid, type SubMarketItem } from "@/src/components/category/sub-market-grid";
import { marketDisplayName } from "@/src/lib/market";
import type { MarketDisplayConfig } from "@al-souq/api";

export const dynamic = "force-dynamic";

function Band({ surface, children }: { surface: "ivory" | "white"; children: React.ReactNode }) {
  // إيقاعٌ بصريّ داكن: نتبادل بين خلفيّة الصفحة والبطاقة.
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

  // نحسب «نطاق» السوق ثمّ نصيّره بالتخطيط الموحّد نفسه (لا فرق بين سوق متاجر وسوق فئة).
  let body: React.ReactNode = <ComingSoon name={displayName} />;
  if (market.status !== "soon") {
    if (market.kind === "stores") {
      const ch = market.channel === "online" || market.channel === "physical" ? market.channel : undefined;
      const [allCategories, markets] = await Promise.all([getCachedCategories(), api.market.list()]);
      // أقسام سوق المتاجر = الفئات التي ليست لها بوّابةٌ خاصّة (فالمطاعم سوقٌ مستقلّ لا قسمٌ هنا).
      const gatewaySlugs = new Set(markets.map((m) => m.categorySlug).filter(Boolean) as string[]);
      const gridCategories = allCategories.filter((c) => !gatewaySlugs.has(c.slug));
      body = (
        <MarketWorld govName={gov?.name} govId={gov?.id} displayName={displayName} channel={ch} categoryIds={undefined} gridCategories={gridCategories} config={market.config} />
      );
    } else if (market.categorySlug) {
      const cat = await api.catalog.categoryBySlug({ slug: market.categorySlug }).catch(() => null);
      if (cat) {
        const categoryIds = [cat.id, ...cat.childIds];
        body = (
          <MarketWorld govName={gov?.name} govId={gov?.id} displayName={displayName} channel={undefined} categoryIds={categoryIds} gridCategories={cat.children} config={market.config} />
        );
      }
    }
  }

  return (
    <div>
      <MarketHeader market={market} governorate={gov?.name} />
      <div className="mt-5">{body}</div>
      <div className="-mx-4 px-4 py-6">
        <Link href="/" className="flex items-center justify-center gap-1 text-sm font-medium text-gold-400 hover:text-gold-300">
          <ChevronLeft className="h-4 w-4 rotate-180" /> عُد لاختيار سوقٍ آخر
        </Link>
      </div>
    </div>
  );
}

/* ── العالم الموحّد لأيّ سوق ──────────────────────────────────────────────
   تخطيطٌ واحد لكلّ الأسواق (متاجر بغداد / الإلكتروني / المطاعم…):
   الأقسام ← الإعلانات ← المتاجر ← أفضل المنتجات ← أفضل المتاجر ← نبض السوق.
   • النطاق: channel (واقعيّ/إلكترونيّ) أو categoryIds (أقسام سوق الفئة).
   • الترتيب والإظهار والعناوين تُضبط لكلّ سوق من تبويب «المظهر».             */
async function MarketWorld({
  govName,
  govId,
  displayName,
  channel,
  categoryIds,
  gridCategories,
  config,
}: {
  govName?: string;
  govId?: string;
  displayName: string;
  channel?: "physical" | "online";
  categoryIds?: string[];
  gridCategories: SubMarketItem[];
  config?: MarketDisplayConfig | null;
}) {
  const api = await getServerApi();
  const [sections, content, appearance, extras, marketStores] = await Promise.all([
    api.discovery.home({ governorateId: govId, channel, categoryIds }),
    api.appearance.content({ governorateId: govId }),
    api.appearance.get(),
    api.discovery.homeExtras({ governorateId: govId, channel }),
    api.discovery.marketStores({ governorateId: govId, channel, categoryIds }),
  ]);
  // إعدادُ هذا السوق تحديداً يتقدّم على الإعداد العامّ (تحكّمٌ كاملٌ لكلّ سوق من المظهر).
  const cfgSections = config?.sections && config.sections.length ? config.sections : appearance.sections;
  const titles = { ...(appearance.sectionTitles ?? {}), ...(config?.sectionTitles ?? {}) };

  const productItems = (key: string) => {
    const s = sections.find((x) => x.key === key);
    return s && s.kind === "products" ? s.items : [];
  };
  const tabs = [
    { key: "best_selling", label: "الأكثر مبيعاً", items: productItems("best_selling") },
    { key: "top_rated", label: "الأعلى تقييماً", items: productItems("top_rated") },
    { key: "new", label: "وصل حديثاً", items: productItems("new") },
    { key: "trending", label: "ترند", items: productItems("trending") },
  ];
  const bannerAds = content.ads.filter((a) => a.placement === "home_banner");
  const allStores = [...marketStores].sort((a, b) => b.productCount - a.productCount);
  const topStores = marketStores.filter((s) => s.ratingCount > 0).slice(0, 8);

  function band(key: string): React.ReactNode {
    switch (key) {
      case "categories":
        return gridCategories.length ? <SubMarketGrid title={titles.categories ?? "الأقسام"} items={gridCategories.slice(0, 12)} /> : null;
      case "banner":
        return bannerAds.length ? <AdsCarousel ads={content.ads} governorate={govName} /> : null;
      case "stores":
        return allStores.length ? <StoreRail emoji="🏪" title={titles.stores ?? "المتاجر"} href="/stores" items={allStores} /> : null;
      case "products":
        return tabs.some((t) => t.items.length) ? <ProductsTabs title={titles.products ?? "أفضل المنتجات"} tabs={tabs} /> : null;
      case "top_stores":
        return topStores.length ? <StoreRail emoji="⭐" title={titles.top_stores ?? "أفضل المتاجر"} href="/stores" items={topStores} /> : null;
      case "pulse":
        return extras.pulse.length ? <MarketPulse events={extras.pulse} title={titles.pulse ?? `نبض ${displayName}`} /> : null;
      default:
        return null; // مفاتيح ملغاة (souks…) لا تُصيَّر
    }
  }

  const rendered = cfgSections
    .filter((s) => s.visible)
    .map((s) => ({ key: s.key, node: band(s.key) }))
    .filter((x) => x.node !== null);

  if (rendered.length === 0) {
    return (
      <Band surface="white">
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">لا يوجد محتوى في هذا السوق بعد.</p>
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
