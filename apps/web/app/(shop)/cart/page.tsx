"use client";

import Link from "next/link";
import { Button, Card, CardBody } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { useCart } from "@/src/store/cart";
import { useCartHydrated } from "@/src/store/use-cart-hydrated";
import { QtyStepper } from "@/src/components/qty-stepper";

export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart((s) => s.subtotal());
  const hydrated = useCartHydrated();

  if (!hydrated) {
    return <div className="py-16 text-center text-neutral-400">جارٍ تحميل السلة…</div>;
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-500">سلتك فارغة</p>
        <Link href="/" className="mt-3 inline-block text-brand-600">
          تصفّح المنتجات
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-40 md:pb-24">
      <h1 className="text-xl font-bold">السلة</h1>

      <ul className="space-y-3">
        {lines.map((l) => (
          <Card key={l.variantId}>
            <CardBody className="flex gap-3">
              <Link href={`/product/${l.slug}`} className="h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={l.image ?? "/placeholder-product.svg"} alt={l.title} className="h-full w-full object-cover" />
              </Link>
              <div className="flex-1">
                <Link href={`/product/${l.slug}`} className="line-clamp-1 font-medium">
                  {l.title}
                </Link>
                <p className="text-xs text-neutral-500">{l.variantLabel}</p>
                <p className="text-xs text-neutral-500">{l.vendorName}</p>
                <div className="mt-1 flex items-center justify-between">
                  <QtyStepper size="sm" value={l.quantity} min={0} max={l.maxAvailable} onChange={(n) => setQty(l.variantId, n)} />
                  <span className="font-bold text-brand-600 nums">{formatIQD(l.unitPrice * l.quantity)}</span>
                </div>
              </div>
              <button
                onClick={() => remove(l.variantId)}
                aria-label={`إزالة ${l.title} من السلة`}
                className="self-start text-neutral-400 hover:text-danger"
              >
                ✕
              </button>
            </CardBody>
          </Card>
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-neutral-200 bg-white p-3 md:bottom-0">
        <div className="container-app flex items-center justify-between gap-3">
          <div>
            <span className="text-sm text-neutral-500">المجموع</span>
            <div className="font-bold text-brand-600 nums">{formatIQD(subtotal)}</div>
          </div>
          <Link href="/checkout" className="flex-1">
            <Button className="w-full" size="lg">
              متابعة الطلب
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
