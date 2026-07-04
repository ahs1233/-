"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, CardBody, OrderStatusBadge, Select, useToast } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { QueryError } from "@/src/components/query-error";
import { OrderElapsed } from "@/src/components/order-elapsed";

const FORCE_OPTIONS = ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"] as const;

export default function AdminOrderDetail() {
  const id = String(useParams().id);
  const { error: toastError, success } = useToast();
  const utils = trpc.useUtils();
  const order = trpc.admin.orderDetail.useQuery({ id }, { retry: false });
  const [to, setTo] = useState("");
  const force = trpc.admin.forceOrderStatus.useMutation({
    onSuccess: () => {
      success("تم تحديث الحالة");
      setTo("");
      utils.admin.orderDetail.invalidate({ id });
    },
    onError: (e) => toastError(e.message),
  });

  if (order.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;
  if (order.isError || !order.data) return <QueryError message={order.error?.message} onRetry={() => order.refetch()} />;
  const o = order.data;
  const ship = (o.shipTo ?? {}) as Record<string, string>;

  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="text-sm text-neutral-500">
        → الطلبات
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold nums">{o.number}</h1>
        <OrderStatusBadge status={o.status} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-500">وقت الطلب:</span>
        <OrderElapsed placedAt={o.placedAt} status={o.status} />
      </div>

      {/* أطراف الطلب */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-xs text-neutral-500">الزبون</p>
            <p className="font-medium">{o.customer.name ?? "—"}</p>
            <p className="text-sm text-neutral-500 nums">{o.customer.phone}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-neutral-500">البائع</p>
            <Link href={`/admin/vendors/${o.vendor.id}`} className="font-medium text-brand-600">
              {o.vendor.storeName}
            </Link>
          </CardBody>
        </Card>
      </div>

      {/* عنوان التوصيل */}
      <Card>
        <CardBody>
          <p className="text-xs text-neutral-500">عنوان التوصيل</p>
          <p className="text-sm">
            {ship.fullName ? <span className="font-medium">{ship.fullName} · </span> : null}
            {[ship.governorate, ship.area].filter(Boolean).join("/")}
            {ship.line ? ` — ${ship.line}` : ""}
          </p>
          {ship.phone && <p className="text-sm text-neutral-500 nums">{ship.phone}</p>}
        </CardBody>
      </Card>

      {/* الأصناف */}
      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">الأصناف</h2>
          {o.items.map((it) => (
            <div key={it.id} className="flex justify-between text-sm">
              <span className="line-clamp-1">
                {it.title} <span className="text-neutral-400">×{it.quantity}</span>
              </span>
              <span className="nums">{formatIQD(it.lineTotal)}</span>
            </div>
          ))}
          <div className="my-1 border-t border-neutral-100" />
          <Row label="المجموع الجزئي" value={formatIQD(o.subtotal)} />
          <Row label="التوصيل" value={formatIQD(o.deliveryFee)} />
          <Row label={`العمولة (${(o.commissionRate * 100).toFixed(1)}%)`} value={formatIQD(o.commissionAmount)} muted />
          <Row label="الإجمالي" value={formatIQD(o.total)} bold />
          <Row label="صافي للبائع" value={formatIQD(o.subtotal - o.commissionAmount)} muted />
          <p className="pt-1 text-xs text-neutral-500">طريقة الدفع: {o.paymentMethod}</p>
          {o.customerNote && <p className="text-xs text-neutral-500">ملاحظة الزبون: {o.customerNote}</p>}
          {o.cancelReason && <p className="text-xs text-danger">سبب الإلغاء: {o.cancelReason}</p>}
        </CardBody>
      </Card>

      {/* تدخّل إداري على الحالة */}
      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">تغيير الحالة (تدخّل إداري)</h2>
          <div className="flex items-center gap-2">
            <Select value={to} onChange={(e) => setTo(e.target.value)} className="h-10 flex-1 text-sm">
              <option value="">اختر الحالة الجديدة…</option>
              {FORCE_OPTIONS.filter((s) => s !== o.status).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Button
              disabled={!to || force.isPending}
              loading={force.isPending}
              onClick={() =>
                to && force.mutate({ orderId: o.id, status: to as (typeof FORCE_OPTIONS)[number], note: "تدخّل إداري" })
              }
            >
              تطبيق
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* سجل الحالات */}
      <Card>
        <CardBody>
          <h2 className="mb-2 font-bold">سجل الحالات</h2>
          <ul className="space-y-1 text-sm">
            {o.history.map((h, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-neutral-600">
                  {h.fromStatus ? `${h.fromStatus} → ` : ""}
                  {h.toStatus}
                  {h.note ? ` · ${h.note}` : ""}
                </span>
                <span className="text-xs text-neutral-400">{new Date(h.createdAt).toLocaleString("ar-IQ")}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : "text-sm"}`}>
      <span className={muted ? "text-neutral-400" : bold ? "" : "text-neutral-500"}>{label}</span>
      <span className="nums">{value}</span>
    </div>
  );
}
