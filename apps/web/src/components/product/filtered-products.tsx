"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { formatIQD } from "@al-souq/utils";
import { AppImage } from "@/src/components/app-image";
import { ProductCard, type ProductCardData } from "@/src/components/product-card";

type Item = ProductCardData & { category?: string; soldCount?: number };

/** شبكة/قائمة منتجات مع شرائح تصفية بالفئة العليا. variant يحدّد التخطيط. */
export function FilteredProducts({
  items,
  variant,
  newBadge = false,
}: {
  items: Item[];
  variant: "ranked" | "grid";
  newBadge?: boolean;
}) {
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const it of items) if (it.category && !seen.includes(it.category)) seen.push(it.category);
    return seen;
  }, [items]);

  const [active, setActive] = useState<string>("all");
  const shown = active === "all" ? items : items.filter((it) => it.category === active);

  return (
    <div className="space-y-4">
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[{ k: "all", l: "الكل" }, ...categories.map((c) => ({ k: c, l: c }))].map((c) => {
            const on = c.k === active;
            return (
              <button
                key={c.k}
                onClick={() => setActive(c.k)}
                className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  on ? "bg-gold-500 text-brand-900" : "bg-card2 border border-line text-neutral-300 hover:border-gold-500/40"
                }`}
              >
                {c.l}
              </button>
            );
          })}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">لا توجد منتجات في هذا التصنيف.</p>
      ) : variant === "ranked" ? (
        <ol className="space-y-2.5">
          {shown.map((p, i) => {
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
                    {p.soldCount != null && p.soldCount > 0 && (
                      <span className="mt-0.5 block text-[11px] text-petrol"><span className="nums">{p.soldCount}</span> عملية شراء</span>
                    )}
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
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((p) => (
            <div key={p.id} className="relative">
              {newBadge && (
                <span className="pointer-events-none absolute end-2 top-2 z-10 rounded-lg bg-petrol px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm">جديد</span>
              )}
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
