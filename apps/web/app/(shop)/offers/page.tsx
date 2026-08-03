import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, Tag, Sparkles } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { SectionPageHeader } from "@/src/components/section-page-header";
import { FilteredProducts } from "@/src/components/product/filtered-products";
import type { DiscoveryProductCard } from "@al-souq/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "العروض اليوميّة — السوگ" };

export default async function OffersPage() {
  const gov = getGovernorate();
  let offers: DiscoveryProductCard[] = [];
  try {
    const api = await getServerApi();
    offers = await api.discovery.offers({ governorateId: gov?.id });
  } catch {
    /* قاعدة البيانات غير جاهزة */
  }

  const maxPct = offers.reduce((m, p) => {
    if (p.compareAtPrice && p.compareAtPrice > p.price) return Math.max(m, Math.round((1 - p.price / p.compareAtPrice) * 100));
    return m;
  }, 0);

  return (
    <div className="space-y-5">
      <SectionPageHeader title="العروض اليوميّة" subtitle={`أقوى الخصومات في ${gov?.name ?? "العراق"}`} />

      {/* لافتة العروض الذهبيّة */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-gold-600 via-gold-500 to-gold-400 p-5 text-brand-900 shadow-lg">
        <span className="pointer-events-none absolute -left-6 top-2 text-7xl opacity-20" aria-hidden>🏮</span>
        <span className="pointer-events-none absolute -right-4 bottom-0 text-7xl opacity-20" aria-hidden>🏮</span>
        <div className="relative">
          <span className="inline-flex items-center gap-1 text-xs font-extrabold"><Sparkles className="h-3.5 w-3.5" /> عروض اليوم</span>
          <p className="mt-1 text-sm font-bold">خصومات تصل إلى</p>
          <p className="text-5xl font-extrabold leading-none nums">{maxPct > 0 ? maxPct : 40}%</p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-xl bg-brand-900 px-4 py-2 text-sm font-extrabold text-gold-300">
            تسوّق الآن <ChevronLeft className="h-4 w-4" />
          </span>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-14 text-neutral-500">
          <Tag className="h-8 w-8" />
          <p className="text-sm">لا عروض فعّالة الآن — تابعنا، تصلك أوّلاً.</p>
        </div>
      ) : (
        <>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-100">
            <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
            عروض مميّزة
          </h2>
          <FilteredProducts items={offers} variant="grid" />
        </>
      )}
    </div>
  );
}
