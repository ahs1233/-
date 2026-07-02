"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, OrderStatusBadge, Textarea, useToast } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

// الانتقالات المتاحة للبائع حسب الحالة (مطابقة لآلة الحالة في الخادم)
const VENDOR_ACTIONS: Record<string, { to: "CONFIRMED" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED"; label: string; primary?: boolean }[]> = {
  PENDING: [
    { to: "CONFIRMED", label: "تأكيد الطلب", primary: true },
    { to: "CANCELLED", label: "رفض" },
  ],
  CONFIRMED: [
    { to: "PREPARING", label: "بدء التحضير", primary: true },
    { to: "CANCELLED", label: "إلغاء" },
  ],
  PREPARING: [
    { to: "SHIPPED", label: "تم الشحن", primary: true },
    { to: "CANCELLED", label: "إلغاء" },
  ],
  SHIPPED: [{ to: "DELIVERED", label: "تم التوصيل", primary: true }],
};

export default function VendorOrderDetail({ params }: { params: { id: string } }) {
  const order = trpc.vendor.orderById.useQuery({ id: params.id }, { retry: false });
  const utils = trpc.useUtils();
  const { success, error: toastError } = useToast();
  const [returnNote, setReturnNote] = useState("");
  const updateStatus = trpc.vendor.orderUpdateStatus.useMutation({
    onSuccess: () => {
      utils.vendor.orderById.invalidate({ id: params.id });
      utils.vendor.orders.invalidate();
      utils.vendor.analytics.invalidate();
    },
    onError: (e) => toastError(e.message),
  });
  const reviewReturn = trpc.vendor.reviewReturn.useMutation({
    onSuccess: (r) => {
      utils.vendor.orderById.invalidate({ id: params.id });
      utils.vendor.orders.invalidate();
      success(r.status === "APPROVED" ? "قُبل الإرجاع وأُعيد المخزون" : "رُفض طلب الإرجاع");
    },
    onError: (e) => toastError(e.message),
  });

  if (order.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;
  if (order.isError || !order.data) return <p className="text-neutral-500">الطلب غير موجود.</p>;

  const o = order.data;
  const ship = o.shipTo as { fullName: string; phone: string; governorate: string; area: string; line: string };
  const actions = VENDOR_ACTIONS[o.status] ?? [];

  return (
    <div className="space-y-4">
      <Link href="/vendor/orders" className="text-sm text-neutral-500">
        ← الطلبات
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold nums">{o.number}</h1>
        <OrderStatusBadge status={o.status} />
      </div>

      <Card>
        <CardBody className="space-y-2">
          {o.items.map((it) => (
            <div key={it.id} className="flex justify-between text-sm">
              <span>
                {it.title} <span className="text-neutral-400">×{it.quantity}</span>
              </span>
              <span className="nums">{formatIQD(it.lineTotal)}</span>
            </div>
          ))}
          <div className="my-1 border-t border-neutral-100" />
          <Row label="المجموع" value={formatIQD(o.subtotal)} />
          <Row label="التوصيل" value={formatIQD(o.deliveryFee)} />
          <Row label="عمولة المنصة" value={`- ${formatIQD(o.commissionAmount)}`} />
          <Row label="صافيك من الطلب" value={formatIQD(o.subtotal - o.commissionAmount)} bold />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="text-sm">
          <h2 className="mb-1 font-bold">التوصيل</h2>
          <p>{ship.fullName} — <span className="nums">{ship.phone}</span></p>
          <p className="text-neutral-500">
            {ship.governorate}/{ship.area} — {ship.line}
          </p>
          {o.customerNote && <p className="mt-1 text-neutral-500">ملاحظة: {o.customerNote}</p>}
        </CardBody>
      </Card>

      {/* طلب الإرجاع */}
      {o.returnRequest && (
        <Card>
          <CardBody className="space-y-2 text-sm">
            <h2 className="font-bold">طلب إرجاع من المشتري</h2>
            <p className="text-neutral-600">السبب: {o.returnRequest.reason}</p>
            {o.returnRequest.status === "REQUESTED" ? (
              <>
                <Textarea
                  rows={2}
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="ملاحظة للمشتري (اختياري)"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={reviewReturn.isPending}
                    onClick={() => reviewReturn.mutate({ id: o.returnRequest!.id, approve: true, note: returnNote.trim() || undefined })}
                  >
                    قبول الإرجاع
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={reviewReturn.isPending}
                    onClick={() => reviewReturn.mutate({ id: o.returnRequest!.id, approve: false, note: returnNote.trim() || undefined })}
                  >
                    رفض
                  </Button>
                </div>
              </>
            ) : (
              <p className={o.returnRequest.status === "APPROVED" ? "font-bold text-brand-600" : "font-bold text-danger"}>
                {o.returnRequest.status === "APPROVED" ? "قُبل الإرجاع" : "رُفض الإرجاع"}
                {o.returnRequest.vendorNote ? ` — ${o.returnRequest.vendorNote}` : ""}
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {actions.length > 0 && (
        <div className="flex gap-2">
          {actions.map((a) => (
            <Button
              key={a.to}
              variant={a.primary ? "primary" : "outline"}
              className="flex-1"
              loading={updateStatus.isPending}
              onClick={() => updateStatus.mutate({ orderId: o.id, status: a.to })}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : "text-sm"}`}>
      <span className={bold ? "" : "text-neutral-500"}>{label}</span>
      <span className="nums">{value}</span>
    </div>
  );
}
