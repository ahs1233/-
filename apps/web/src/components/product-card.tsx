import Link from "next/link";
import { Star, MapPin } from "lucide-react";
import { formatIQD } from "@al-souq/utils";
import { AppImage } from "@/src/components/app-image";

export interface ProductCardData {
  id: string;
  title: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  ratingAvg: number;
  ratingCount: number;
  image: string | null;
  vendor: { storeName: string; slug: string; governorate?: string | null };
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const place = product.vendor.governorate;
  const hasDiscount = product.compareAtPrice != null && product.compareAtPrice > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice!) * 100) : 0;
  return (
    <Link
      href={`/product/${product.slug}`}
      className="bg-card group flex h-full flex-col overflow-hidden rounded-2xl border border-line shadow-md ring-1 ring-gold-500/10 transition-all hover:-translate-y-0.5 hover:border-gold-500/40 hover:shadow-lg hover:ring-gold-500/25"
    >
      <div className="bg-card2 relative aspect-square w-full overflow-hidden">
        <AppImage
          src={product.image ?? "/placeholder-product.svg"}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* لوحةُ السوق — «من {المكان}» كلافتةٍ خشبيّة معلّقة بإطارٍ ذهبيّ */}
        {place && (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-md border border-gold-400/50 bg-brand-900/85 px-2 py-1 text-[10px] font-bold text-gold-100 shadow-sm backdrop-blur">
            <MapPin className="h-2.5 w-2.5 text-gold-300" />
            {place}
          </span>
        )}
        {product.ratingCount > 0 && (
          <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand-900/90 px-2 py-0.5 text-xs font-bold text-gold-300 shadow-sm ring-1 ring-gold-500/30 backdrop-blur">
            <Star className="h-3 w-3 fill-gold-500 text-gold-500" />
            {product.ratingAvg.toFixed(1)}
          </span>
        )}
        {hasDiscount && (
          <span className="absolute end-2 bottom-2 rounded-lg bg-danger px-2 py-0.5 text-xs font-extrabold text-white shadow-sm nums">
            −{discountPct}%
          </span>
        )}
        {/* شريطٌ ذهبيّ سفليّ رفيع — لمسة هويّة السوگ */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" aria-hidden />
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-neutral-100">{product.title}</h3>
        <p className="line-clamp-1 text-xs font-medium text-neutral-400">{product.vendor.storeName}</p>
        <div className="mt-auto flex items-baseline gap-1.5 pt-1.5">
          <span className="text-lg font-extrabold text-gold-300 nums">{formatIQD(product.price)}</span>
          {hasDiscount && (
            <span className="text-xs font-medium text-neutral-500 line-through nums">{formatIQD(product.compareAtPrice!)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
