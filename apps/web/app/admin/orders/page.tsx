"use client";

import { useState } from "react";
import Link from "next/link";
import { OrderStatusBadge, Select, Button, Input, useToast } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { OrderElapsed } from "@/src/components/order-elapsed";
import { DataTable, type Column } from "@/src/components/data-table";

const FILTERS = ["", "PENDING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"];
const FORCE_OPTIONS = ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"] as const;

export default function AdminOrders() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const { error: toastError } = useToast();
  const orders = trpc.admin.orders.useQuery(
    { status: status || undefined, search: search.trim() || undefined, limit: 100 },
    { retry: false },
  );
  const utils = trpc.useUtils();
  const force = trpc.admin.forceOrderStatus.useMutation({
    onSuccess: () => utils.admin.orders.invalidate(),
    onError: (e) => toastError(e.message),
  });

  type Order = NonNullable<typeof orders.data>[number];
  const columns: Column<Order>[] = [
    {
      key: "number",
      header: "رقم الطلب",
      sortValue: (o) => o.number,
      render: (o) => (
        <Link href={`/admin/orders/${o.id}`} className="font-bold text-brand-600 nums hover:underline">
          {o.number}
        </Link>
      ),
    },
    {
      key: "status",
      header: "الحالة",
      sortValue: (o) => o.status,
      render: (o) => <OrderStatusBadge status={o.status} />,
    },
    { key: "vendor", header: "البائع", sortValue: (o) => o.vendor, render: (o) => o.vendor },
    { key: "customer", header: "الزبون", render: (o) => o.customer },
    {
      key: "total",
      header: "الإجمالي",
      align: "end",
      sortValue: (o) => o.total,
      render: (o) => <span className="font-bold text-brand-600 nums">{formatIQD(o.total)}</span>,
    },
    {
      key: "time",
      header: "الوقت",
      sortValue: (o) => new Date(o.placedAt).getTime(),
      render: (o) => <OrderElapsed placedAt={o.placedAt} status={o.status} />,
    },
    {
      key: "action",
      header: "إجراء",
      hideLabelOnMobile: true,
      render: (o) => (
        <ForceAction
          current={o.status}
          loading={force.isPending}
          onApply={(to) => force.mutate({ orderId: o.id, status: to, note: "تدخّل إداري" })}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الطلبات والنزاعات</h1>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث برقم الطلب أو هاتف الزبون…" />

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
        <DataTable
          columns={columns}
          rows={orders.data ?? []}
          getRowKey={(o) => o.id}
          initialSort={{ key: "time", dir: "desc" }}
          emptyLabel="لا طلبات مطابقة"
        />
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
      <Button size="sm" disabled={!to || loading} onClick={() => to && onApply(to as (typeof FORCE_OPTIONS)[number])}>
        تطبيق
      </Button>
    </div>
  );
}
