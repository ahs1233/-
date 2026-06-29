"use client";

import { useState } from "react";
import { Card, CardBody, OrderStatusBadge, Select, Button } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

const FILTERS = ["", "PENDING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"];
const FORCE_OPTIONS = ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"] as const;

export default function AdminOrders() {
  const [status, setStatus] = useState("");
  const orders = trpc.admin.orders.useQuery({ status: status || undefined, limit: 100 }, { retry: false });
  const utils = trpc.useUtils();
  const force = trpc.admin.forceOrderStatus.useMutation({
    onSuccess: () => utils.admin.orders.invalidate(),
    onError: (e) => alert(e.message),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الطلبات والنزاعات</h1>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatus(f)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-sm ${
              status === f ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {f || "الكل"}
          </button>
        ))}
      </div>

      {orders.isLoading ? (
        <p className="text-neutral-500">جارٍ التحميل…</p>
      ) : (
        <ul className="space-y-3">
          {orders.data?.map((o) => (
            <Card key={o.id}>
              <CardBody className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold nums">{o.number}</span>
                  <OrderStatusBadge status={o.status} />
                </div>
                <p className="text-sm text-neutral-500">
                  {o.vendor} ← {o.customer}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-600 nums">{formatIQD(o.total)}</span>
                  <ForceAction
                    current={o.status}
                    loading={force.isPending}
                    onApply={(to) => force.mutate({ orderId: o.id, status: to, note: "تدخّل إداري" })}
                  />
                </div>
              </CardBody>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}

function ForceAction({
  current,
  onApply,
  loading,
}: {
  current: string;
  onApply: (to: (typeof FORCE_OPTIONS)[number]) => void;
  loading: boolean;
}) {
  const [to, setTo] = useState<string>("");
  return (
    <div className="flex items-center gap-1">
      <Select value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-32 text-sm">
        <option value="">تغيير الحالة…</option>
        {FORCE_OPTIONS.filter((s) => s !== current).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        disabled={!to || loading}
        onClick={() => to && onApply(to as (typeof FORCE_OPTIONS)[number])}
      >
        تطبيق
      </Button>
    </div>
  );
}
