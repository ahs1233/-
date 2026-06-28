"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardBody, OrderStatusBadge } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersList />
    </Suspense>
  );
}

function OrdersList() {
  const params = useSearchParams();
  const justPlaced = params.get("placed") === "1";
  const orders = trpc.order.myOrders.useQuery({ limit: 30 }, { retry: false });

  if (orders.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;
  if (orders.isError) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-500">سجّل الدخول لعرض طلباتك.</p>
        <Link href="/login?next=/orders" className="mt-3 inline-block text-brand-600">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">طلباتي</h1>
      {justPlaced && (
        <div className="rounded-lg bg-brand-100 p-3 text-sm text-brand-700">
          ✓ تم استلام طلبك بنجاح! ستصلك الإشعارات عند تحديث الحالة.
        </div>
      )}
      {orders.data!.items.length === 0 ? (
        <p className="text-neutral-500">لا توجد طلبات بعد.</p>
      ) : (
        <ul className="space-y-3">
          {orders.data!.items.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold nums">{o.number}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="text-sm text-neutral-600">{o.vendor.storeName}</p>
                  <p className="line-clamp-1 text-sm text-neutral-500">
                    {o.firstItem}
                    {o.itemCount > 1 ? ` و${o.itemCount - 1} غيره` : ""}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-neutral-400">
                      {new Date(o.placedAt).toLocaleDateString("ar-IQ")}
                    </span>
                    <span className="font-bold text-brand-600 nums">{formatIQD(o.total)}</span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </ul>
      )}
    </div>
  );
}
