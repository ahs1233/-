import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, Tag } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { ProductCard, type ProductCardData } from "@/src/components/product-card";
import { AdsCarousel } from "@/src/components/home/home-blocks";
import type { AppContent } from "@al-souq/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "العروض اليوميّة — السوگ" };

export default async function OffersPage() {
  const gov = getGovernorate();
  let offers: ProductCardData[] = [];
  let content: AppContent = { governorate: null, ads: [] };
  try {
    const api = await getServerApi();
    const [of, cont] = await Promise.all([
      api.discovery.offers({ governorateId: gov?.id }),
      api.appearance.content({ governorateId: gov?.id }),
    ]);
    offers = of;
    content = cont;
  } catch {
    /* قاعدة البيانات غير جاهزة */
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="رجوع" className="bg-card2 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl border border-line text-neutral-200 hover:border-gold-500/50">
          <ChevronRight className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-neutral-100">العروض اليوميّة</h1>
          <p className="text-xs text-neutral-400">أقوى الخصومات في {gov?.name ?? "العراق"}</p>
        </div>
      </div>

      {content.ads.length > 0 && <AdsCarousel ads={content.ads} governorate={gov?.name} />}

      {offers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-14 text-neutral-500">
          <Tag className="h-8 w-8" />
          <p className="text-sm">لا عروض فعّالة الآن — تابعنا، تصلك أوّلاً.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {offers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
