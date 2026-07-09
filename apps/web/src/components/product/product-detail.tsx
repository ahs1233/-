"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ZoomIn, X, MapPin, ShieldCheck } from "lucide-react";
import { Button, Card, CardBody, useToast } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { useCart } from "@/src/store/cart";
import { AppImage } from "@/src/components/app-image";
import { QtyStepper } from "@/src/components/qty-stepper";
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
  const [zoom, setZoom] = useState(false);
  const add = useCart((s) => s.add);
  const { success } = useToast();

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
    success("أُضيف إلى السلة");
    setTimeout(() => setAdded(false), 1500);
  }

  const outOfStock = !selected || selected.available <= 0;

  return (
    <div className="space-y-5">
      {/* الصور — سلعةٌ على طاولة، تُقلَّب وتُقرَّب للعين */}
      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label="قرّب الصورة لعينك"
          className="group relative block aspect-square w-full overflow-hidden bg-gradient-to-b from-sand-100 to-sand-50"
        >
          <AppImage
            src={product.images[imgIdx]?.url ?? "/placeholder-product.svg"}
            alt={product.images[imgIdx]?.alt ?? product.title}
            sizes="(max-width: 640px) 100vw, 640px"
            priority
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
          <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            <ZoomIn className="h-3.5 w-3.5" /> قرّبها لعينك
          </span>
        </button>
        {product.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-2">
            {product.images.map((im, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                aria-label={`عرض الصورة ${i + 1}`}
                aria-current={i === imgIdx}
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

        <Link
          href={`/store/${product.vendor.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600"
        >
          <ShieldCheck className="h-4 w-4" />
          {product.vendor.storeName}
          {product.vendor.governorate && (
            <span className="inline-flex items-center gap-0.5 font-normal text-neutral-400">
              <MapPin className="h-3.5 w-3.5" /> {product.vendor.governorate.nameAr}
            </span>
          )}
        </Link>

        {/* طاولة البائع — السعر والخيار والكمية والشراء */}
        <div className="rounded-3xl border border-gold-200 bg-gradient-to-b from-sand-50 to-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-3xl font-extrabold text-neutral-900 nums">
              {selected ? formatIQD(selected.price) : formatIQD(product.basePrice)}
            </span>
            {product.ratingCount > 0 && (
              <span className="text-sm font-semibold text-gold-600">
                ★ {product.ratingAvg.toFixed(1)}{" "}
                <span className="font-normal text-neutral-400">({product.ratingCount})</span>
              </span>
            )}
          </div>

          {/* الخيارات */}
          {product.variants.length > 1 && (
            <div className="mt-4">
              <p className="mb-1.5 text-sm font-medium text-neutral-700">الخيار</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    disabled={v.available <= 0}
                    onClick={() => setSelectedId(v.id)}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                      v.id === selected?.id
                        ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
                        : "border-neutral-300 bg-white hover:border-neutral-400"
                    } ${v.available <= 0 ? "opacity-40" : ""}`}
                  >
                    {variantLabel(v.attributes)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* الكمية */}
          <div className="mt-4 flex items-center gap-3">
            <QtyStepper value={qty} onChange={setQty} min={1} max={selected?.available ?? 1} />
            <span className="text-xs text-neutral-500">
              {outOfStock ? "غير متوفر حالياً" : `متوفر: ${selected?.available}`}
            </span>
          </div>

          <Button
            variant="secondary"
            className="btn-brass mt-4 w-full font-extrabold text-[#16223b]"
            size="lg"
            disabled={outOfStock}
            onClick={handleAdd}
          >
            {added ? "أُضيف إلى السلة ✓" : outOfStock ? "غير متوفر" : "أضف إلى السلة"}
          </Button>
          <p className="mt-2.5 text-center text-xs text-neutral-500">
            الدفع عند الاستلام — تفحّصه قبل أن تدفع
          </p>
        </div>

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

      {/* تكبير — ارفعها للضوء وقلّبها */}
      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="عرض الصورة مكبّرة"
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <button
            type="button"
            aria-label="إغلاق"
            className="absolute top-4 left-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.images[imgIdx]?.url ?? "/placeholder-product.svg"}
            alt={product.images[imgIdx]?.alt ?? product.title}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
