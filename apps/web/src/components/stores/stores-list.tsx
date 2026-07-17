"use client";

import { useState } from "react";
import Link from "next/link";
import { Store, Star, ChevronLeft, BadgeCheck } from "lucide-react";
import { AppImage } from "@/src/components/app-image";

export interface StoreListItem {
  id: string;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  verified: boolean;
  category: string | null;
  governorate: string | null;
  ratingAvg: number;
  ratingCount: number;
  productCount: number;
  salesCount: number;
  createdAt: string;
}

const SORTS: { key: string; label: string; cmp: (a: StoreListItem, b: StoreListItem) => number }[] = [
  { key: "featured", label: "المميّزة", cmp: (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount },
  { key: "rating", label: "الأعلى تقييماً", cmp: (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount },
  { key: "sales", label: "الأكثر مبيعاً", cmp: (a, b) => b.salesCount - a.salesCount },
  { key: "new", label: "حديثة", cmp: (a, b) => b.createdAt.localeCompare(a.createdAt) },
];

export function StoresList({ stores }: { stores: StoreListItem[] }) {
  const [sort, setSort] = useState("featured");
  const cmp = (SORTS.find((s) => s.key === sort) ?? SORTS[0]!).cmp;
  const ordered = [...stores].sort(cmp);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SORTS.map((s) => {
          const on = s.key === sort;
          return (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                on ? "bg-gold-500 text-brand-900" : "bg-card2 border border-line text-neutral-300 hover:border-gold-500/40"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {ordered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">لا توجد متاجر بعد.</p>
      ) : (
        <ul className="space-y-2.5">
          {ordered.map((s) => (
            <li key={s.id}>
              <Link href={`/store/${s.slug}`} className="bg-card group flex items-center gap-3 rounded-2xl border border-line p-3 shadow-sm transition hover:border-gold-500/40">
                <span className="bg-card2 grid h-14 w-14 flex-shrink-0 place-items-center overflow-hidden rounded-xl text-gold-300">
                  {s.logoUrl ? (
                    <AppImage src={s.logoUrl} alt={s.storeName} sizes="56px" className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-6 w-6" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate font-bold text-neutral-100">
                    {s.storeName}
                    {s.verified && <BadgeCheck className="h-4 w-4 flex-shrink-0 text-gold-400" aria-label="موثّق" />}
                  </p>
                  <p className="truncate text-xs text-neutral-400">{s.category ?? "متجر"}{s.governorate ? ` · ${s.governorate}` : ""}</p>
                  {s.ratingCount > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-gold-300">
                      <Star className="h-3 w-3 fill-gold-500 text-gold-500" /> {s.ratingAvg.toFixed(1)}
                      <span className="font-normal text-neutral-500 nums">({s.ratingCount})</span>
                    </p>
                  )}
                </div>
                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-1.5 text-xs font-bold text-gold-300 transition group-hover:bg-gold-500/20">
                  زيارة <ChevronLeft className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
