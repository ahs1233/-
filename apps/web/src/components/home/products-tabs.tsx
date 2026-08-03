"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/src/components/product-card";

export type ProductTab = { key: string; label: string; items: ProductCardData[] };

/**
 * قسمُ المنتجات الموحّد — تبويباتٌ في مكانٍ واحد بدل عدّة أشرطة متلاحقة:
 * الأكثر شراءً | وصل حديثاً | الأعلى تقييماً | ترند. يقلّل التزاحم ويصنع إيقاعاً.
 */
export function ProductsTabs({ title = "المنتجات", tabs }: { title?: string; tabs: ProductTab[] }) {
  const shown = tabs.filter((t) => t.items.length > 0);
  const [active, setActive] = useState(shown[0]?.key ?? "");
  if (shown.length === 0) return null;
  const current = shown.find((t) => t.key === active) ?? shown[0]!;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-100">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          {title}
        </h2>
        <Link href="/search" className="flex items-center gap-0.5 text-sm font-medium text-gold-400 hover:text-gold-300">
          الكل <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>

      {/* شريط التبويبات — تسطيرٌ ذهبيّ للفعّال */}
      <div className="mb-3 -mx-4 flex gap-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shown.map((t) => {
          const on = t.key === current.key;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`relative whitespace-nowrap pb-2 text-sm font-bold transition ${on ? "text-gold-300" : "text-neutral-400 hover:text-neutral-200"}`}
            >
              {t.label}
              {on && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gold-500" />}
            </button>
          );
        })}
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {current.items.map((p) => (
          <div key={p.id} className="w-44 flex-shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
