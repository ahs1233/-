import Link from "next/link";
import { Star, MapPin } from "lucide-react";
import { formatIQD } from "@al-souq/utils";
import { AppImage } from "@/src/components/app-image";

export interface ProductCardData {
  id: string;
  title: string;
  slug: string;
  price: number;
  ratingAvg: number;
  ratingCount: number;
  image: string | null;
  vendor: { storeName: string; slug: string; governorate?: string | null };
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const place = product.vendor.governorate;
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gold-200 bg-white shadow-md ring-1 ring-gold-100/70 transition-all hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-lg hover:ring-gold-200"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-sand-100">
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
          <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-bold text-gold-600 shadow-sm backdrop-blur">
            <Star className="h-3 w-3 fill-gold-500 text-gold-500" />
            {product.ratingAvg.toFixed(1)}
          </span>
        )}
        {/* شريطٌ ذهبيّ سفليّ رفيع — لمسة هويّة السوگ */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" aria-hidden />
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-neutral-900">{product.title}</h3>
        <p className="line-clamp-1 text-xs font-medium text-brand-600">{product.vendor.storeName}</p>
        <div className="mt-auto pt-1.5">
          <span className="text-lg font-extrabold text-brand-800 nums">{formatIQD(product.price)}</span>
        </div>
      </div>
    </Link>
  );
}
