import Link from "next/link";
import { Card } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";

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
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="aspect-square w-full bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image ?? "/placeholder-product.svg"}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 text-sm font-medium text-neutral-900">{product.title}</h3>
          <p className="mt-1 text-xs text-neutral-500">{product.vendor.storeName}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-bold text-brand-600 nums">{formatIQD(product.price)}</span>
            {product.ratingCount > 0 && (
              <span className="text-xs text-gold-600">
                ★ {product.ratingAvg.toFixed(1)} ({product.ratingCount})
              </span>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
}
