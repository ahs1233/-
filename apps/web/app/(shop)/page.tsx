import Link from "next/link";
import { ChevronLeft, Store } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { HomeGreetingHero } from "@/src/components/home/home-greeting-hero";
import { MarketGrid } from "@/src/components/home/market-grid";
import { PulseGrid } from "@/src/components/home/pulse-grid";
import { AdsCarousel } from "@/src/components/home/home-blocks";
import { resolveGovIdentity } from "@/src/lib/governorate-identity";
import type { HomeExtras, AppContent, MarketItem } from "@al-souq/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const gov = getGovernorate();
  let extras: HomeExtras | null = null;
  let content: AppContent = { governorate: null, ads: [] };
  let markets: MarketItem[] = [];
  let dbReady = true;
  try {
    const api = await getServerApi();
    const [ex, cont, mk] = await Promise.all([
      api.discovery.homeExtras({ governorateId: gov?.id }),
      api.appearance.content({ governorateId: gov?.id }),
      api.market.list(),
    ]);
    extras = ex;
    content = cont;
    markets = mk;
  } catch {
    dbReady = false;
  }

  const identity = resolveGovIdentity(gov?.name, content.governorate);

  return (
    <div className="space-y-6">
      {/* ① أهلاً بك في بغداد */}
      <HomeGreetingHero governorate={gov?.name} heroImage={identity.hero} feel={identity.feel} />

      {!dbReady && (
        <div className="rounded-2xl border border-gold-500/30 bg-gold-500/10 p-4 text-sm text-gold-300">
          المتجر قيد التجهيز — لم تُربط قاعدة البيانات بعد.
        </div>
      )}

      {/* ② اختر السوق الذي يناسبك */}
      <MarketGrid markets={markets} />

      {/* ③ نبض السوگ */}
      {extras && extras.pulse.length > 0 && <PulseGrid events={extras.pulse} />}

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

      {/* ⑤ افتح متجرك */}
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
