import Link from "next/link";
import { ChevronLeft, Store } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { CityHero } from "@/src/components/home/city-hero";
import { MarketShortcuts } from "@/src/components/home/market-shortcuts";
import { MarketPulse, AdsCarousel } from "@/src/components/home/home-blocks";
import { ProductRail, StoreRail } from "@/src/components/home/section-rail";
import { NearbyStores } from "@/src/components/home/nearby-stores";
import { DiscoverToday } from "@/src/components/home/discover-today";
import { resolveGovIdentity } from "@/src/lib/governorate-identity";
import type { HomeExtras, CityStats, AppContent, MarketItem, DiscoverySection } from "@al-souq/api";

export const dynamic = "force-dynamic";

const EMPTY_STATS: CityStats = { openStores: 0, newStores: 0, newProducts: 0, offers: 0 };

export default async function HomePage() {
  const gov = getGovernorate();

  let stats: CityStats = EMPTY_STATS;
  let extras: HomeExtras | null = null;
  let content: AppContent = { governorate: null, ads: [] };
  let markets: MarketItem[] = [];
  let sections: DiscoverySection[] = [];
  let suggested: Awaited<ReturnType<Awaited<ReturnType<typeof getServerApi>>["discovery"]["marketStores"]>> = [];
  let userName: string | undefined;
  let dbReady = true;

  try {
    const api = await getServerApi();
    const [st, ex, cont, mk, sec, sug] = await Promise.all([
      api.discovery.cityStats({ governorateId: gov?.id }),
      api.discovery.homeExtras({ governorateId: gov?.id }),
      api.appearance.content({ governorateId: gov?.id }),
      api.market.list(),
      api.discovery.home({ governorateId: gov?.id }),
      api.discovery.marketStores({ governorateId: gov?.id }),
    ]);
    stats = st;
    extras = ex;
    content = cont;
    markets = mk;
    sections = sec;
    suggested = sug;

    // اسم المستخدم للتحيّة — يعمل عند تسجيل الدخول فقط.
    try {
      const me = await api.auth.me();
      userName = me?.name?.trim() || undefined;
    } catch {
      /* زائرٌ غير مسجّل — تحيّةٌ عامّة */
    }
  } catch {
    dbReady = false;
  }

  const identity = resolveGovIdentity(gov?.name, content.governorate);
  const activeMarkets = markets.filter((m) => m.status !== "soon").length;

  const productsOf = (key: string) => {
    const s = sections.find((x) => x.key === key);
    return s && s.kind === "products" ? s.items : [];
  };
  const newStoresSection = sections.find((x) => x.key === "new_stores");
  const newStores = newStoresSection && newStoresSection.kind === "stores" ? newStoresSection.items : [];

  const topStores = suggested.slice(0, 8);
  const nearby = [...suggested].sort((a, b) => b.productCount - a.productCount).slice(0, 8);
  const bestSelling = productsOf("best_selling");
  const newArrivals = productsOf("new");
  const today = productsOf("today");

  return (
    <div className="space-y-7">
      {/* ① المدينة هي البطل — تحيّةٌ + أرقامٌ حيّة */}
      <CityHero
        governorate={gov?.name}
        userName={userName}
        heroImage={identity.hero}
        feel={identity.feel}
        stats={stats}
        activeMarkets={activeMarkets}
      />

      {!dbReady && (
        <div className="rounded-2xl border border-gold-500/30 bg-gold-500/10 p-4 text-sm text-gold-300">
          المتجر قيد التجهيز — لم تُربط قاعدة البيانات بعد.
        </div>
      )}

      {/* ② إلى أين تريد الذهاب؟ — صفٌّ مصغّر + «كل الأسواق» */}
      <MarketShortcuts markets={markets} govName={gov?.name} />

      {/* ③ نبض السوق — حياةٌ مباشرة، لا منتجات */}
      {extras && extras.pulse.length > 0 && <MarketPulse events={extras.pulse} governorate={gov?.name} />}

      {/* ④ عروض اليوم */}
      {content.ads.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
            <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
            عروض اليوم
          </h2>
          <AdsCarousel ads={content.ads} governorate={gov?.name} />
        </section>
      )}

      {/* ⑤ متاجر مقترحة */}
      <StoreRail emoji="✨" title="متاجر مقترحة لك" href="/stores" items={topStores} />

      {/* ⑥ الأكثر مبيعاً */}
      <ProductRail emoji="🔥" title="الأكثر مبيعاً" href="/search?sort=best_selling" items={bestSelling} />

      {/* ⑦ وصل حديثاً */}
      <ProductRail emoji="🆕" title="وصل حديثاً" href="/search?sort=new" items={newArrivals} />

      {/* ⑧ قريب منك — GPS */}
      <NearbyStores stores={nearby} govName={gov?.name} />

      {/* ⑨ متاجر جديدة */}
      <StoreRail emoji="🏪" title="متاجر جديدة في السوق" href="/stores" items={newStores} />

      {/* ⑩ اكتشف اليوم — يتجدّد يوميّاً */}
      <DiscoverToday items={today} />

      {/* ⑪ افتح متجرك */}
      <Link
        href="/become-seller"
        className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-l from-brand-700 to-brand-900 p-5 text-white shadow-lg ring-1 ring-gold-500/20"
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
          <span className="block font-extrabold">انضم إلى السوق الآن</span>
          <span className="block text-sm text-white/70">سجّل متجرك ووسّع أعمالك بسهولة — الدفع عند الاستلام.</span>
        </span>
        <ChevronLeft className="relative h-5 w-5 flex-shrink-0 text-gold-300" />
      </Link>
    </div>
  );
}
