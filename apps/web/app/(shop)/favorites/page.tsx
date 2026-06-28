"use client";

import Link from "next/link";
import { trpc } from "@/src/trpc/react";
import { ProductCard } from "@/src/components/product-card";

export default function FavoritesPage() {
  const favs = trpc.favorite.list.useQuery(undefined, { retry: false });

  if (favs.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;
  if (favs.isError) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-500">سجّل الدخول لعرض مفضّلتك.</p>
        <Link href="/login?next=/favorites" className="mt-3 inline-block text-brand-600">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">المفضلة</h1>
      {favs.data!.length === 0 ? (
        <p className="text-neutral-500">لا توجد منتجات في المفضلة.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {favs.data!.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
