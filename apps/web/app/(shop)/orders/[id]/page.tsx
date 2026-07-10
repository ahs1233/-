"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, CheckCircle2, Package, Truck, PackageCheck, PartyPopper } from "lucide-react";
import { Button, Card, CardBody, OrderStatusBadge, ORDER_STATUS_LABEL, Textarea, useToast } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

const TRACK_STEPS = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "COMPLETED"] as const;

// شعور كل حالة — «أشعر أن طلبي في الطريق». لكل حالةٍ جملةٌ إنسانيّة وأيقونة ولون.
const STATUS_HERO: Record<
  string,
  { icon: typeof Truck; title: string; sub: string; tone: "navy" | "gold" | "green" }
> = {
  PENDING: { icon: Clock, title: "استلمنا طلبك", sub: "بانتظار تأكيد البائع — نُعلمك فور تأكيده.", tone: "navy" },
  CONFIRMED: { icon: CheckCircle2, title: "أكّد البائع طلبك", sub: "يبدأ تجهيزه قريباً.", tone: "navy" },
  PREPARING: { icon: Package, title: "يُجهّز طلبك الآن", sub: "يُغلَّف ويُحضَّر للشحن إليك.", tone: "gold" },
  SHIPPED: { icon: Truck, title: "طلبك في الطريق إليك", sub: "المندوب في طريقه — جهّز مبلغ الدفع عند الاستلام.", tone: "gold" },
  DELIVERED: { icon: PackageCheck, title: "وصل طلبك", sub: "تفحّصه، ثم أكّد الاستلام من الأسفل.", tone: "green" },
  COMPLETED: { icon: PartyPopper, title: "اكتمل طلبك", sub: "شكراً لتسوّقك من السوگ 🤎", tone: "green" },
};

const TONE: Record<"navy" | "gold" | "green", { wrap: string; ring: string; icon: string }> = {
  navy: { wrap: "bg-brand-50", ring: "ring-brand-200", icon: "text-brand-600" },
  gold: { wrap: "bg-gold-100", ring: "ring-gold-200", icon: "text-gold-600" },
  green: { wrap: "bg-petrol/10", ring: "ring-petrol/20", icon: "text-petrol" },
};

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
  // وقت بلوغ كل حالة (من سجلّ الطلب) — للخطّ الزمني.
  const reachedAt: Record<string, Date> = { PENDING: new Date(o.placedAt) };
  for (const h of o.history) reachedAt[h.toStatus] = new Date(h.createdAt);
  const fmtTime = (d: Date) =>
    d.toLocaleString("ar-IQ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const canCancel = ["PENDING", "CONFIRMED", "PREPARING"].includes(o.status);
  const canConfirm = o.status === "DELIVERED";

  const hero = STATUS_HERO[o.status];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-brand-800 nums">{o.number}</h1>
        <OrderStatusBadge status={o.status} />
      </div>

      {/* شعور الطلب — «أشعر أن طلبي في الطريق» */}
      {!isCancelled && hero && (
        <div className={`flex items-center gap-4 rounded-2xl border border-sand-200 p-4 ${TONE[hero.tone].wrap}`}>
          <span className={`grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-white/70 ring-1 ${TONE[hero.tone].ring}`}>
            <hero.icon className={`h-7 w-7 ${TONE[hero.tone].icon}`} />
          </span>
          <div>
            <p className="text-lg font-extrabold text-neutral-900">{hero.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{hero.sub}</p>
          </div>
        </div>
      )}

      {/* خطّ تتبّع الطلب — عمودي بالأوقات */}
      {!isCancelled && (
        <Card>
          <CardBody>
            <h2 className="mb-3 flex items-center gap-2 font-extrabold text-brand-800">
              <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
              تتبّع الطلب
            </h2>
            <ol>
              {TRACK_STEPS.map((s, i) => {
                const reached = i <= currentStep;
                const isCurrent = i === currentStep;
                const isLast = i === TRACK_STEPS.length - 1;
                const at = reachedAt[s];
                return (
                  <li key={s} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                          isCurrent ? "bg-gold-500 ring-4 ring-gold-200" : reached ? "bg-brand-500" : "bg-neutral-200"
                        }`}
                      >
                        {reached && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      {!isLast && (
                        <span className={`min-h-[1.75rem] w-0.5 flex-1 ${i < currentStep ? "bg-brand-500" : "bg-neutral-200"}`} />
                      )}
                    </div>
                    <div className={`flex flex-1 items-center justify-between ${isLast ? "" : "pb-4"}`}>
                      <span className={`text-sm ${reached ? "font-medium text-neutral-900" : "text-neutral-400"}`}>
                        {ORDER_STATUS_LABEL[s]}
                        {isCurrent && <span className="ms-2 text-xs font-semibold text-gold-600">• الحالة الآن</span>}
                      </span>
                      {reached && at && <span className="text-xs text-neutral-400 nums">{fmtTime(at)}</span>}
                    </div>
                  </li>
                );
              })}
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
          {o.discount > 0 && (
            <div className="flex justify-between text-sm text-brand-600">
              <span>خصم الكوبون{o.couponCode ? ` (${o.couponCode})` : ""}</span>
              <span className="nums">−{formatIQD(o.discount)}</span>
            </div>
          )}
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
    <div className={`flex justify-between ${bold ? "pt-1 text-base font-extrabold text-brand-800" : "text-sm"}`}>
      <span className={bold ? "" : "text-neutral-500"}>{label}</span>
      <span className="nums">{value}</span>
    </div>
  );
}
