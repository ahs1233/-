import Link from "next/link";
import { Star, Store } from "lucide-react";
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
  vendor: { storeName: string; slug: string };
}

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
        <AppImage
          src={product.image ?? "/placeholder-product.svg"}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {product.ratingCount > 0 && (
          <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gold-600 shadow-sm backdrop-blur">
            <Star className="h-3 w-3 fill-gold-500 text-gold-500" />
            {product.ratingAvg.toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-neutral-900">{product.title}</h3>
        <p className="flex items-center gap-1 text-xs text-neutral-400">
          <Store className="h-3 w-3" />
          <span className="line-clamp-1">{product.vendor.storeName}</span>
        </p>
        <div className="mt-auto pt-1">
          <span className="text-base font-bold text-brand-600 nums">{formatIQD(product.price)}</span>
        </div>
      </div>
    </Link>
  );
}
