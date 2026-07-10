"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { ListRowSkeleton } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { ProductCard } from "@/src/components/product-card";

export default function FavoritesPage() {
  const favs = trpc.favorite.list.useQuery(undefined, { retry: false });

  if (favs.isLoading) return (
    <div className="space-y-3">
      <ListRowSkeleton />
      <ListRowSkeleton />
      <ListRowSkeleton />
    </div>
  );
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

  const count = favs.data!.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-brand-800">
          <Heart className="h-5 w-5 fill-gold-400 text-gold-400" />
          المفضّلة
          {count > 0 && <span className="text-sm font-medium text-neutral-400 nums">({count})</span>}
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">الأشياء التي أحببتها — بانتظار عودتك إليها.</p>
      </div>

      {count === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-sand-200 bg-white/60 py-16 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gold-100 text-gold-500">
            <Heart className="h-8 w-8" />
          </span>
          <p className="font-semibold text-neutral-700">لم تُضِف شيئاً بعد</p>
          <p className="max-w-xs text-sm text-neutral-500">
            حين يعجبك منتج، اضغط ♥ لتجده هنا حين تعود.
          </p>
          <Link
            href="/"
            className="mt-1 rounded-2xl border border-brand-200 bg-white px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:border-gold-300"
          >
            تصفّح السوق
          </Link>
        </div>
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
