import Link from "next/link";
import { Store, Star, BadgeCheck } from "lucide-react";
import { AppImage } from "@/src/components/app-image";

export interface StoreRailData {
  id: string;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
  ratingAvg: number;
  ratingCount: number;
}

/** بطاقة متجرٍ للشريط الأفقيّ — واجهةٌ صغيرة تُدخَل، لا صفٌّ في قائمة. */
export function StoreRailCard({ store }: { store: StoreRailData }) {
  return (
    <Link
      href={`/store/${store.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-md"
    >
      <div className="relative h-20 bg-gradient-to-br from-brand-600 to-brand-800">
        <span className="absolute -bottom-6 right-3 grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border-2 border-white bg-white text-brand-600 shadow ring-1 ring-gold-200">
          {store.logoUrl ? (
            <AppImage src={store.logoUrl} alt={store.storeName} sizes="56px" className="h-full w-full object-cover" />
          ) : (
            <Store className="h-6 w-6" />
          )}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 pt-8">
        <h3 className="flex items-center gap-1 truncate text-sm font-extrabold text-brand-800">
          {store.storeName}
          <BadgeCheck className="h-3.5 w-3.5 flex-shrink-0 text-brand-500" aria-label="موثّق" />
        </h3>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="nums">{store.productCount} منتج</span>
          {store.ratingCount > 0 && (
            <span className="inline-flex items-center gap-0.5 font-semibold text-gold-600">
              <Star className="h-3 w-3 fill-gold-400 text-gold-400" />
              {store.ratingAvg.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
