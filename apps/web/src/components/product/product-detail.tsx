"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { useCart } from "@/src/store/cart";
import { AppImage } from "@/src/components/app-image";
import { ReviewsSection } from "./reviews-section";

type Variant = {
  id: string;
  sku: string | null;
  attributes?: unknown;
  price: number;
  available: number;
};

export interface ProductDetailData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  basePrice: number;
  ratingAvg: number;
  ratingCount: number;
  images: { url: string; alt: string | null }[];
  variants: Variant[];
  vendor: { id: string; storeName: string; slug: string; governorate: { nameAr: string } | null };
  category: { id: string; nameAr: string; slug: string };
}

function variantLabel(attributes: unknown): string {
  if (!attributes || typeof attributes !== "object") return "افتراضي";
  const entries = Object.entries(attributes as Record<string, string>);
  if (entries.length === 0) return "افتراضي";
  return entries.map(([k, v]) => `${k}: ${v}`).join("، ");
}

export function ProductDetail({ product }: { product: ProductDetailData }) {
  const [selectedId, setSelectedId] = useState(product.variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const add = useCart((s) => s.add);

  const favIds = trpc.favorite.ids.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const toggleFav = trpc.favorite.toggle.useMutation({
    onSuccess: () => utils.favorite.ids.invalidate(),
  });
  const isFav = favIds.data?.includes(product.id) ?? false;

  const selected = useMemo(
    () => product.variants.find((v) => v.id === selectedId) ?? product.variants[0],
    [product.variants, selectedId],
  );

  const [added, setAdded] = useState(false);
  function handleAdd() {
    if (!selected) return;
    add(
      {
        productId: product.id,
        variantId: selected.id,
        slug: product.slug,
        title: product.title,
        variantLabel: variantLabel(selected.attributes),
        unitPrice: selected.price,
        image: product.images[0]?.url ?? null,
        vendorId: product.vendor.id,
        vendorName: product.vendor.storeName,
        maxAvailable: selected.available,
      },
      qty,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  const outOfStock = !selected || selected.available <= 0;

  return (
    <div className="space-y-5">
      {/* الصور */}
      <Card className="overflow-hidden">
        <div className="relative aspect-square w-full bg-neutral-100">
          <AppImage
            src={product.images[imgIdx]?.url ?? "/placeholder-product.svg"}
            alt={product.images[imgIdx]?.alt ?? product.title}
            sizes="(max-width: 640px) 100vw, 640px"
            priority
            className="h-full w-full object-cover"
          />
        </div>
        {product.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-2">
            {product.images.map((im, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded border-2 ${i === imgIdx ? "border-brand-500" : "border-transparent"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={im.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* المعلومات */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold">{product.title}</h1>
          <button
            onClick={() => toggleFav.mutate({ productId: product.id })}
            aria-label="المفضلة"
            className={`text-2xl leading-none ${isFav ? "text-danger" : "text-neutral-300"}`}
          >
            {isFav ? "♥" : "♡"}
          </button>
        </div>

        <Link href={`/store/${product.vendor.slug}`} className="inline-block text-sm text-brand-600">
          {product.vendor.storeName}
          {product.vendor.governorate ? ` — ${product.vendor.governorate.nameAr}` : ""}
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-brand-600 nums">
            {selected ? formatIQD(selected.price) : formatIQD(product.basePrice)}
          </span>
          {product.ratingCount > 0 && (
            <span className="text-sm text-gold-600">
              ★ {product.ratingAvg.toFixed(1)} ({product.ratingCount})
            </span>
          )}
        </div>

        {/* الخيارات */}
        {product.variants.length > 1 && (
          <div>
            <p className="mb-1 text-sm font-medium">الخيار</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  disabled={v.available <= 0}
                  onClick={() => setSelectedId(v.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    v.id === selected?.id ? "border-brand-500 bg-brand-50" : "border-neutral-300"
                  } ${v.available <= 0 ? "opacity-40" : ""}`}
                >
                  {variantLabel(v.attributes)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* الكمية + الإضافة */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-neutral-300">
            <button className="px-3 py-2" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="min-w-8 text-center nums">{qty}</span>
            <button
              className="px-3 py-2"
              onClick={() => setQty((q) => Math.min(selected?.available ?? 1, q + 1))}
            >
              +
            </button>
          </div>
          <span className="text-xs text-neutral-500">
            {outOfStock ? "غير متوفر" : `متوفر: ${selected?.available}`}
          </span>
        </div>

        <Button className="w-full" size="lg" disabled={outOfStock} onClick={handleAdd}>
          {added ? "أُضيف ✓" : outOfStock ? "غير متوفر" : "أضف إلى السلة"}
        </Button>

        {product.description && (
          <Card>
            <CardBody>
              <h2 className="mb-1 font-bold">الوصف</h2>
              <p className="whitespace-pre-line text-sm text-neutral-700">{product.description}</p>
            </CardBody>
          </Card>
        )}

        <ReviewsSection productId={product.id} />
      </div>
    </div>
  );
}
