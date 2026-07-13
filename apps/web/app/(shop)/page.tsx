import Link from "next/link";
import { ChevronLeft, Store } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { HomeHero } from "@/src/components/home-hero";
import { StoreRail } from "@/src/components/home/section-rail";
import { MarketGrid } from "@/src/components/home/market-grid";
import { MarketPulse, AdsCarousel } from "@/src/components/home/home-blocks";
import { resolveGovIdentity } from "@/src/lib/governorate-identity";
import type { HomeExtras, AppContent, MarketItem } from "@al-souq/api";

export const dynamic = "force-dynamic";

type HomeSections = Awaited<ReturnType<Awaited<ReturnType<typeof getServerApi>>["discovery"]["home"]>>;

// خلفيّةٌ متناوبة (عاجيّ/أبيض) لكل شريحة كي «تتنفّس» الصفحة.
function Band({ surface, children }: { surface: "ivory" | "white"; children: React.ReactNode }) {
  return <div className={`-mx-4 px-4 py-6 ${surface === "white" ? "bg-white" : "bg-sand-50"}`}>{children}</div>;
}

export default async function HomePage() {
  const gov = getGovernorate();
  let sections: HomeSections = [];
  let extras: HomeExtras | null = null;
  let content: AppContent = { governorate: null, ads: [] };
  let markets: MarketItem[] = [];
  let dbReady = true;
  try {
    const api = await getServerApi();
    const [secs, ex, cont, mk] = await Promise.all([
      api.discovery.home({ governorateId: gov?.id }),
      api.discovery.homeExtras({ governorateId: gov?.id }),
      api.appearance.content({ governorateId: gov?.id }),
      api.market.list(),
    ]);
    sections = secs;
    extras = ex;
    content = cont;
    markets = mk;
  } catch {
    dbReady = false;
  }

  const identity = resolveGovIdentity(gov?.name, content.governorate);
  const storeItems = () => {
    const s = sections.find((x) => x.key === "new_stores");
    return s && s.kind === "stores" ? s.items : [];
  };

  return (
    <div>
      {/* بوّابة المحافظة — «أهلاً بك في بغداد» */}
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

      <div className="mt-5">
        {/* نبض السوگ — آخر ما يحدث في السوق كلّه */}
        {extras && extras.pulse.length > 0 && (
          <Band surface="ivory">
            <MarketPulse events={extras.pulse} title="نبض السوگ" />
          </Band>
        )}

        {/* اختر السوق — قلبُ الرئيسية: «أيّ سوقٍ تريد دخوله؟» */}
        <Band surface="white">
          <MarketGrid markets={markets} governorate={gov?.name} />
        </Band>

        {/* عروض اليوم */}
        {content.ads.length > 0 && (
          <Band surface="ivory">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-brand-800">
              <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
              عروض اليوم
            </h2>
            <AdsCarousel ads={content.ads} governorate={gov?.name} />
          </Band>
        )}

        {/* المتاجر المميّزة */}
        {storeItems().length > 0 && (
          <Band surface="white">
            <StoreRail emoji="🏪" title="متاجر مميّزة" href="/stores" items={storeItems()} />
          </Band>
        )}
      </div>

      {/* افتح متجرك — دعوةٌ ختاميّة */}
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
            <span className="block font-extrabold">انضم إلى السوق الآن</span>
            <span className="block text-sm text-white/70">سجّل متجرك ووسّع أعمالك بسهولة — الدفع عند الاستلام.</span>
          </span>
          <ChevronLeft className="relative h-5 w-5 flex-shrink-0 text-gold-300" />
        </Link>
      </div>
    </div>
  );
}
