"use client";

import Link from "next/link";
import { Button, Card, CardBody, Badge } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "مسودّة",
  PENDING_REVIEW: "قيد المراجعة",
  ACTIVE: "منشور",
  REJECTED: "مرفوض",
  ARCHIVED: "مؤرشف",
};
const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600",
  PENDING_REVIEW: "bg-gold-400/20 text-gold-600",
  ACTIVE: "bg-brand-100 text-brand-700",
  REJECTED: "bg-danger/10 text-danger",
  ARCHIVED: "bg-neutral-200 text-neutral-500",
};

export default function VendorProducts() {
  const products = trpc.vendor.products.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">المنتجات</h1>
        <Link href="/vendor/products/new">
          <Button size="sm">+ منتج جديد</Button>
        </Link>
      </div>

      {products.isLoading ? (
        <p className="text-neutral-500">جارٍ التحميل…</p>
      ) : products.data && products.data.length > 0 ? (
        <ul className="space-y-3">
          {products.data.map((p) => (
            <Link key={p.id} href={`/vendor/products/${p.id}`}>
              <Card className="hover:shadow-md">
                <CardBody className="flex gap-3">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" src={p.image ?? "/placeholder-product.svg"} alt={p.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-1 font-medium">{p.title}</span>
                      <Badge className={STATUS_STYLE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    </div>
                    <p className="text-sm text-brand-600 nums">{formatIQD(p.price)}</p>
                    <p className="text-xs text-neutral-500 nums">
                      المخزون: {p.totalStock} {p.reserved > 0 ? `(محجوز ${p.reserved})` : ""} · بيع: {p.soldCount}
                    </p>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-500">لا توجد منتجات. ابدأ بإضافة منتج.</p>
      )}
    </div>
  );
}
