import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles, ChevronLeft } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { formatIQD } from "@al-souq/utils";
import { AppImage } from "@/src/components/app-image";
import { ProductCard, type ProductCardData } from "@/src/components/product-card";
import { SectionPageHeader } from "@/src/components/section-page-header";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "اكتشف اليوم — السوگ" };

export default async function DiscoverPage() {
  const gov = getGovernorate();
  let items: ProductCardData[] = [];
  try {
    const api = await getServerApi();
    const sections = await api.discovery.home({ governorateId: gov?.id });
    const s = sections.find((x) => x.key === "today");
    if (s && s.kind === "products") items = s.items;
  } catch {
    /* قاعدة البيانات غير جاهزة */
  }

  const featured = items[0];
  const rest = items.slice(1);
  const fDiscount = featured && featured.compareAtPrice != null && featured.compareAtPrice > featured.price;

  return (
    <div className="space-y-5">
      <SectionPageHeader title="اكتشف اليوم" subtitle="تشكيلةٌ تتجدّد يوميّاً — خصّيصاً لك" />

      {!featured ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">لا يوجد اكتشافٌ اليوم بعد.</p>
      ) : (
        <>
          {/* منتج اليوم المميّز */}
          <Link href={`/product/${featured.slug}`} className="bg-card group block overflow-hidden rounded-3xl border border-gold-500/25 shadow-lg">
            <div className="bg-card2 relative aspect-[16/10] w-full overflow-hidden">
              <AppImage src={featured.image ?? "/placeholder-product.svg"} alt={featured.title} sizes="(max-width:768px) 100vw, 768px" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#05070d] via-transparent to-transparent" />
              <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-gold-500/90 px-2.5 py-1 text-[11px] font-extrabold text-brand-900 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> منتج اليوم
              </span>
            </div>
            <div className="p-4">
              <h2 className="text-lg font-extrabold text-neutral-100">{featured.title}</h2>
              <p className="mt-0.5 text-xs text-neutral-400">{featured.vendor.storeName}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-2xl font-extrabold text-gold-300 nums">{formatIQD(featured.price)}</span>
                {fDiscount && <span className="text-sm text-neutral-500 line-through nums">{formatIQD(featured.compareAtPrice!)}</span>}
                <span className="ms-auto inline-flex items-center gap-1 rounded-xl bg-gold-500 px-4 py-2 text-sm font-extrabold text-brand-900">
                  اكتشف الآن <ChevronLeft className="h-4 w-4" />
                </span>
              </div>
            </div>
          </Link>

          {rest.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {rest.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
