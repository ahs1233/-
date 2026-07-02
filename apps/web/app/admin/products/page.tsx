"use client";

import { Button, Card, CardBody } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

export default function AdminProducts() {
  const pending = trpc.admin.pendingProducts.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const review = trpc.admin.reviewProduct.useMutation({
    onSuccess: () => {
      utils.admin.pendingProducts.invalidate();
      utils.admin.dashboard.invalidate();
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">مراجعة المنتجات</h1>

      {pending.isLoading ? (
        <p className="text-neutral-500">جارٍ التحميل…</p>
      ) : pending.data && pending.data.length > 0 ? (
        <ul className="space-y-3">
          {pending.data.map((p) => (
            <Card key={p.id}>
              <CardBody className="flex gap-3">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={p.image ?? "/placeholder-product.svg"} alt={p.title} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-sm text-neutral-500">
                    {p.vendor} · {p.category}
                  </p>
                  <p className="text-sm text-brand-600 nums">{formatIQD(p.price)}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" loading={review.isPending} onClick={() => review.mutate({ productId: p.id, decision: "ACTIVE" })}>
                      نشر
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        const note = window.prompt("سبب الرفض:") ?? undefined;
                        review.mutate({ productId: p.id, decision: "REJECTED", note });
                      }}
                    >
                      رفض
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-500">لا توجد منتجات بانتظار المراجعة.</p>
      )}
    </div>
  );
}
