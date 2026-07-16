import Link from "next/link";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import { getGovernorate } from "@/src/lib/governorate";
import { getServerApi } from "@/src/trpc/server";
import { formatIQD } from "@al-souq/utils";
import { AppImage } from "@/src/components/app-image";
import { SectionPageHeader } from "@/src/components/section-page-header";
import type { DiscoveryProductCard } from "@al-souq/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الأكثر مبيعاً — السوگ" };

export default async function BestSellingPage() {
  const gov = getGovernorate();
  let items: DiscoveryProductCard[] = [];
  try {
    const api = await getServerApi();
    const sections = await api.discovery.home({ governorateId: gov?.id });
    const s = sections.find((x) => x.key === "best_selling");
    if (s && s.kind === "products") items = s.items;
  } catch {
    /* قاعدة البيانات غير جاهزة */
  }

  return (
    <div className="space-y-5">
      <SectionPageHeader title="الأكثر مبيعاً" subtitle={`الأكثر رواجاً في ${gov?.name ?? "العراق"}`} />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">لا توجد بيانات مبيعات بعد.</p>
      ) : (
        <ol className="space-y-2.5">
          {items.map((p, i) => {
            const hasDiscount = p.compareAtPrice != null && p.compareAtPrice > p.price;
            return (
              <li key={p.id}>
                <Link href={`/product/${p.slug}`} className="bg-card group flex items-center gap-3 rounded-2xl border border-line p-2.5 shadow-sm transition hover:border-gold-500/40">
                  <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-sm font-extrabold nums ${i < 3 ? "bg-gold-500 text-brand-900" : "bg-card2 text-neutral-300"}`}>
                    {i + 1}
                  </span>
                  <span className="bg-card2 relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
                    <AppImage src={p.image ?? "/placeholder-product.svg"} alt={p.title} sizes="64px" className="h-full w-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 font-bold text-neutral-100">{p.title}</span>
                    <span className="line-clamp-1 text-xs text-neutral-400">{p.vendor.storeName}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="font-extrabold text-gold-300 nums">{formatIQD(p.price)}</span>
                      {hasDiscount && <span className="text-xs text-neutral-500 line-through nums">{formatIQD(p.compareAtPrice!)}</span>}
                    </span>
                  </span>
                  {p.ratingCount > 0 && (
                    <span className="flex flex-shrink-0 items-center gap-1 text-sm font-semibold text-gold-300">
                      <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />
                      {p.ratingAvg.toFixed(1)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
