"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, OrderStatusBadge, ORDER_STATUS_LABEL, Textarea, useToast } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

const TRACK_STEPS = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "COMPLETED"] as const;

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = trpc.order.byId.useQuery({ id: params.id }, { retry: false });
  const utils = trpc.useUtils();
  const { success, error: toastError } = useToast();
  const [showReturn, setShowReturn] = useState(false);
  const [returnReason, setReturnReason] = useState("");

  const cancel = trpc.order.cancel.useMutation({
    onSuccess: () => {
      utils.order.byId.invalidate({ id: params.id });
      utils.order.myOrders.invalidate();
    },
  });
  const confirm = trpc.order.confirmReceipt.useMutation({
    onSuccess: () => {
      utils.order.byId.invalidate({ id: params.id });
      utils.order.myOrders.invalidate();
    },
  });
  const requestReturn = trpc.order.requestReturn.useMutation({
    onSuccess: () => {
      utils.order.byId.invalidate({ id: params.id });
      setShowReturn(false);
      success("أُرسل طلب الإرجاع للبائع");
    },
    onError: (e) => toastError(e.message),
  });

  if (order.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;
  if (order.isError || !order.data) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-500">الطلب غير موجود.</p>
        <Link href="/orders" className="mt-3 inline-block text-brand-600">
          طلباتي
        </Link>
      </div>
    );
  }

  const o = order.data;
  const ship = o.shipTo as { fullName: string; phone: string; governorate: string; area: string; line: string };
  const isCancelled = o.status === "CANCELLED" || o.status === "RETURNED";
  const currentStep = TRACK_STEPS.indexOf(o.status as (typeof TRACK_STEPS)[number]);
  const canCancel = ["PENDING", "CONFIRMED", "PREPARING"].includes(o.status);
  const canConfirm = o.status === "DELIVERED";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold nums">{o.number}</h1>
        <OrderStatusBadge status={o.status} />
      </div>

      {/* خط التتبّع */}
      {!isCancelled && (
        <Card>
          <CardBody>
            <ol className="flex items-center justify-between">
              {TRACK_STEPS.map((s, i) => (
                <li key={s} className="flex flex-1 flex-col items-center text-center">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                      i <= currentStep ? "bg-brand-500 text-white" : "bg-neutral-200 text-neutral-400"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className={`mt-1 text-[10px] ${i <= currentStep ? "text-brand-600" : "text-neutral-400"}`}>
                    {ORDER_STATUS_LABEL[s]}
                  </span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      )}

      {isCancelled && o.cancelReason && (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">السبب: {o.cancelReason}</div>
      )}

      {/* العناصر */}
      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">{o.vendor.storeName}</h2>
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
          <Row label="الإجمالي" value={formatIQD(o.total)} bold />
          <p className="pt-1 text-xs text-neutral-500">الدفع عند الاستلام</p>
        </CardBody>
      </Card>

      {/* العنوان */}
      <Card>
        <CardBody className="text-sm">
          <h2 className="mb-1 font-bold">عنوان التوصيل</h2>
          <p>{ship.fullName} — {ship.phone}</p>
          <p className="text-neutral-500">
            {ship.governorate}/{ship.area} — {ship.line}
          </p>
        </CardBody>
      </Card>

      {/* طلب الإرجاع */}
      {o.returnRequest ? (
        <Card>
          <CardBody className="space-y-1 text-sm">
            <h2 className="font-bold">طلب الإرجاع</h2>
            <p>
              الحالة:{" "}
              <span className={o.returnRequest.status === "REJECTED" ? "font-bold text-danger" : "font-bold text-brand-600"}>
                {o.returnRequest.status === "REQUESTED"
                  ? "قيد مراجعة البائع"
                  : o.returnRequest.status === "APPROVED"
                    ? "مقبول — سيتواصل معك المندوب"
                    : "مرفوض"}
              </span>
            </p>
            <p className="text-neutral-500">سببك: {o.returnRequest.reason}</p>
            {o.returnRequest.vendorNote && <p className="text-neutral-500">ردّ البائع: {o.returnRequest.vendorNote}</p>}
          </CardBody>
        </Card>
      ) : (
        o.status === "DELIVERED" &&
        showReturn && (
          <Card>
            <CardBody className="space-y-2">
              <h2 className="font-bold">طلب إرجاع</h2>
              <p className="text-xs text-neutral-500">الإرجاع متاح خلال ٤٨ ساعة من الاستلام (راجع سياسة الإرجاع).</p>
              <Textarea
                rows={2}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="اذكر سبب الإرجاع (عيب مصنعي، مخالف للوصف…)"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  loading={requestReturn.isPending}
                  disabled={returnReason.trim().length < 5}
                  onClick={() => requestReturn.mutate({ orderId: o.id, reason: returnReason.trim() })}
                >
                  إرسال طلب الإرجاع
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowReturn(false)}>
                  إلغاء
                </Button>
              </div>
            </CardBody>
          </Card>
        )
      )}

      {/* الإجراءات */}
      <div className="flex gap-2">
        {canConfirm && (
          <Button className="flex-1" loading={confirm.isPending} onClick={() => confirm.mutate({ orderId: o.id })}>
            تأكيد الاستلام
          </Button>
        )}
        {o.status === "DELIVERED" && !o.returnRequest && !showReturn && (
          <Button variant="outline" className="flex-1" onClick={() => setShowReturn(true)}>
            طلب إرجاع
          </Button>
        )}
        {canCancel && (
          <Button
            variant="outline"
            className="flex-1"
            loading={cancel.isPending}
            onClick={() => cancel.mutate({ orderId: o.id, reason: "إلغاء من المشتري" })}
          >
            إلغاء الطلب
          </Button>
        )}
      </div>
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
