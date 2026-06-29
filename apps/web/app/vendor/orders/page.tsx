"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardBody, OrderStatusBadge } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

const FILTERS = [
  { value: "", label: "الكل" },
  { value: "PENDING", label: "جديدة" },
  { value: "CONFIRMED", label: "مؤكّدة" },
  { value: "PREPARING", label: "تحضير" },
  { value: "SHIPPED", label: "مشحونة" },
  { value: "DELIVERED", label: "مسلّمة" },
];

export default function VendorOrders() {
  const [status, setStatus] = useState("");
  const orders = trpc.vendor.orders.useQuery({ status: status || undefined, limit: 50 }, { retry: false });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الطلبات</h1>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-sm ${
              status === f.value ? "bg-brand-500 text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {orders.isLoading ? (
        <p className="text-neutral-500">جارٍ التحميل…</p>
      ) : orders.data && orders.data.length > 0 ? (
        <ul className="space-y-3">
          {orders.data.map((o) => (
            <Link key={o.id} href={`/vendor/orders/${o.id}`}>
              <Card className="hover:shadow-md">
                <CardBody className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold nums">{o.number}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="text-sm text-neutral-600">{o.customerName} · {o.itemCount} عنصر</p>
                  <div className="flex justify-between pt-1">
                    <span className="text-xs text-neutral-400">{new Date(o.placedAt).toLocaleDateString("ar-IQ")}</span>
                    <span className="font-bold text-brand-600 nums">{formatIQD(o.total)}</span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-500">لا توجد طلبات.</p>
      )}
    </div>
  );
}
