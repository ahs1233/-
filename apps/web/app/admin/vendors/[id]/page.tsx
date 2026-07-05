"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, CardBody, Badge, Input, OrderStatusBadge, useToast } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { QueryError } from "@/src/components/query-error";

const VSTATUS: Record<string, { label: string; style: string }> = {
  PENDING: { label: "قيد المراجعة", style: "bg-gold-400/20 text-gold-600" },
  APPROVED: { label: "معتمد", style: "bg-brand-100 text-brand-700" },
  REJECTED: { label: "مرفوض", style: "bg-danger/10 text-danger" },
  SUSPENDED: { label: "معلّق", style: "bg-neutral-200 text-neutral-600" },
};
const PSTATUS: Record<string, { label: string; style: string }> = {
  DRAFT: { label: "مسودة", style: "bg-neutral-200 text-neutral-600" },
  PENDING_REVIEW: { label: "قيد المراجعة", style: "bg-gold-400/20 text-gold-600" },
  ACTIVE: { label: "منشور", style: "bg-brand-100 text-brand-700" },
  REJECTED: { label: "مرفوض", style: "bg-danger/10 text-danger" },
  ARCHIVED: { label: "مخفي", style: "bg-neutral-200 text-neutral-500" },
};

export default function AdminVendorDetail() {
  const id = String(useParams().id);
  const { error: toastError, success } = useToast();
  const utils = trpc.useUtils();
  const vendor = trpc.admin.vendorDetail.useQuery({ id }, { retry: false });
  const products = trpc.admin.vendorProducts.useQuery({ vendorId: id }, { retry: false });

  const refetchVendor = () => utils.admin.vendorDetail.invalidate({ id });
  const review = trpc.admin.reviewVendor.useMutation({
    onSuccess: () => {
      success("تم تحديث حالة البائع");
      refetchVendor();
      utils.admin.vendors.invalidate();
    },
    onError: (e) => toastError(e.message),
  });
  const settle = trpc.admin.settlePayout.useMutation({
    onSuccess: () => {
      success("تمت التسوية");
      refetchVendor();
    },
    onError: (e) => toastError(e.message),
  });
  const setCommission = trpc.admin.setVendorCommission.useMutation({
    onSuccess: () => {
      success("تم تحديث نسبة العمولة");
      refetchVendor();
    },
    onError: (e) => toastError(e.message),
  });
  const reviewProduct = trpc.admin.reviewProduct.useMutation({
    onSuccess: () => {
      success("تم تحديث المنتج");
      utils.admin.vendorProducts.invalidate({ vendorId: id });
    },
    onError: (e) => toastError(e.message),
  });

  const [ratePct, setRatePct] = useState<string>("");
  const [finPeriod, setFinPeriod] = useState<"today" | "7d" | "30d" | "all">("30d");
  const [ordersTab, setOrdersTab] = useState<"current" | "past">("current");
  const finance = trpc.admin.vendorFinance.useQuery({ vendorId: id, period: finPeriod }, { retry: false });
  const storeOrders = trpc.admin.vendorOrders.useQuery({ vendorId: id, scope: ordersTab }, { retry: false });

  if (vendor.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;
  if (vendor.isError || !vendor.data)
    return <QueryError message={vendor.error?.message} onRetry={() => vendor.refetch()} />;
  const v = vendor.data;

  return (
    <div className="space-y-4">
      <Link href="/admin/vendors" className="text-sm text-neutral-500">
        → البائعون
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{v.storeName}</h1>
          <p className="text-sm text-neutral-500">
            {v.ownerName ?? "—"} · <span className="nums">{v.phone}</span>
            {v.governorate ? ` · ${v.governorate}` : ""}
          </p>
        </div>
        <Badge className={VSTATUS[v.status]?.style ?? ""}>{VSTATUS[v.status]?.label ?? v.status}</Badge>
      </div>
      {v.description && <p className="text-sm text-neutral-600">{v.description}</p>}
      {v.status === "REJECTED" && v.rejectionNote && (
        <p className="rounded-lg bg-danger/10 p-2 text-sm text-danger">سبب الرفض: {v.rejectionNote}</p>
      )}

      {/* الملخّص المالي */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="مبيعات مُنجزة" value={formatIQD(v.realizedSales)} />
        <Stat label="عمولة محصّلة" value={formatIQD(v.commissionPaid)} />
        <Stat label="رصيد مستحق (قائم)" value={formatIQD(v.outstanding)} warn={v.outstanding > 0} />
        <Stat label="مسوّى سابقاً" value={formatIQD(v.settled)} />
        <Stat label="طلبات مُنجزة" value={String(v.realizedOrders)} />
        <Stat label="المنتجات" value={String(v.productsCount)} />
      </div>

      {v.outstanding > 0 && (
        <Button
          loading={settle.isPending}
          onClick={() => {
            if (confirm(`تسوية ${formatIQD(v.outstanding)} لـ ${v.storeName}؟`)) settle.mutate({ vendorId: v.id });
          }}
        >
          تسوية المستحق ({formatIQD(v.outstanding)})
        </Button>
      )}

      {/* نسبة العمولة الخاصة */}
      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">نسبة العمولة</h2>
          <p className="text-sm text-neutral-500">
            الحالية:{" "}
            <span className="font-medium">
              {v.commissionRate !== null ? `${(v.commissionRate * 100).toFixed(1)}% (خاصة)` : "افتراضي المنصّة"}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.5}
              value={ratePct}
              onChange={(e) => setRatePct(e.target.value)}
              placeholder="مثال: 10"
              className="w-28"
            />
            <span className="text-sm text-neutral-500">%</span>
            <Button
              size="sm"
              loading={setCommission.isPending}
              disabled={ratePct === "" || isNaN(Number(ratePct))}
              onClick={() => {
                const pct = Number(ratePct);
                if (pct >= 0 && pct <= 100) setCommission.mutate({ vendorId: v.id, rate: pct / 100 });
              }}
            >
              حفظ
            </Button>
            {v.commissionRate !== null && (
              <Button size="sm" variant="outline" onClick={() => setCommission.mutate({ vendorId: v.id, rate: null })}>
                استخدام الافتراضي
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* إجراءات المتجر */}
      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">إجراءات المتجر</h2>
          <div className="flex flex-wrap gap-2">
            {v.status !== "APPROVED" && (
              <Button size="sm" loading={review.isPending} onClick={() => review.mutate({ vendorId: v.id, decision: "APPROVED" })}>
                اعتماد
              </Button>
            )}
            {v.status === "APPROVED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => review.mutate({ vendorId: v.id, decision: "SUSPENDED", note: window.prompt("سبب التعليق (اختياري):") ?? undefined })}
              >
                تعليق
              </Button>
            )}
            {(v.status === "PENDING" || v.status === "APPROVED") && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  const note = window.prompt("سبب الرفض:");
                  if (note !== null) review.mutate({ vendorId: v.id, decision: "REJECTED", note: note || undefined });
                }}
              >
                رفض
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* منتجات المتجر */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-bold">منتجات المتجر ({v.productsCount})</h2>
          {products.isLoading ? (
            <p className="text-sm text-neutral-400">جارٍ التحميل…</p>
          ) : !products.data || products.data.length === 0 ? (
            <p className="text-sm text-neutral-400">لا منتجات.</p>
          ) : (
            <ul className="space-y-2">
              {products.data.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-neutral-100 pb-2 last:border-0">
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image ?? "/placeholder-product.svg"} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{p.title}</p>
                    <p className="text-xs text-neutral-500 nums">
                      {formatIQD(p.price)} · بيع {p.soldCount}
                    </p>
                  </div>
                  <Badge className={PSTATUS[p.status]?.style ?? ""}>{PSTATUS[p.status]?.label ?? p.status}</Badge>
                  <ProductActions
                    status={p.status}
                    busy={reviewProduct.isPending}
                    onSet={(decision, note) => reviewProduct.mutate({ productId: p.id, decision, note })}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* التقرير المالي بفترة متغيّرة */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">التقرير المالي</h2>
            <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5 text-sm">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setFinPeriod(p.key)}
                  className={`rounded-md px-3 py-1 transition ${
                    finPeriod === p.key ? "bg-brand-500 text-white" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {finance.isLoading ? (
            <p className="text-sm text-neutral-400">جارٍ التحميل…</p>
          ) : finance.data ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MiniStat label="مبيعات البضاعة" value={formatIQD(finance.data.grossSales)} />
                <MiniStat label="عمولة المنصّة" value={formatIQD(finance.data.commission)} />
                <MiniStat label="صافي للبائع" value={formatIQD(finance.data.netToVendor)} accent />
                <MiniStat label="رسوم توصيل" value={formatIQD(finance.data.deliveryRevenue)} />
                <MiniStat label="طلبات مُنجزة" value={String(finance.data.realizedOrders)} />
                <MiniStat label="متوسّط الطلب" value={formatIQD(Math.round(finance.data.avgOrderValue))} />
              </div>
              {finance.data.pendingOrders > 0 && (
                <p className="text-xs text-neutral-500 nums">
                  قيد التنفيذ خلال الفترة: {finance.data.pendingOrders} طلب بقيمة {formatIQD(finance.data.pendingSales)}
                </p>
              )}
            </>
          ) : null}
        </CardBody>
      </Card>

      {/* طلبات المتجر — الحالية/السابقة */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">طلبات المتجر</h2>
            <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5 text-sm">
              <button
                onClick={() => setOrdersTab("current")}
                className={`rounded-md px-3 py-1 transition ${ordersTab === "current" ? "bg-brand-500 text-white" : "text-neutral-600"}`}
              >
                الحالية
              </button>
              <button
                onClick={() => setOrdersTab("past")}
                className={`rounded-md px-3 py-1 transition ${ordersTab === "past" ? "bg-brand-500 text-white" : "text-neutral-600"}`}
              >
                السابقة
              </button>
            </div>
          </div>
          {storeOrders.isLoading ? (
            <p className="text-sm text-neutral-400">جارٍ التحميل…</p>
          ) : !storeOrders.data || storeOrders.data.length === 0 ? (
            <p className="text-sm text-neutral-400">
              {ordersTab === "current" ? "لا طلبات قيد التنفيذ." : "لا طلبات سابقة."}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {storeOrders.data.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-neutral-50">
                    <span className="min-w-0">
                      <span className="font-medium nums">{o.number}</span>
                      <span className="ms-2 text-xs text-neutral-400 nums">
                        {new Date(o.placedAt).toLocaleString("ar-IQ", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {o.itemCount} عنصر
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <span className="nums text-neutral-500">{formatIQD(o.total)}</span>
                      <OrderStatusBadge status={o.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

const PERIODS: { key: "today" | "7d" | "30d" | "all"; label: string }[] = [
  { key: "today", label: "اليوم" },
  { key: "7d", label: "٧ أيام" },
  { key: "30d", label: "٣٠ يوم" },
  { key: "all", label: "الكل" },
];

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-2">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-sm font-bold nums ${accent ? "text-brand-600" : ""}`}>{value}</p>
    </div>
  );
}

function ProductActions({
  status,
  onSet,
  busy,
}: {
  status: string;
  onSet: (decision: "ACTIVE" | "REJECTED" | "ARCHIVED", note?: string) => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-shrink-0 flex-wrap gap-1">
      {status === "PENDING_REVIEW" && (
        <>
          <Button size="sm" disabled={busy} onClick={() => onSet("ACTIVE")}>
            اعتماد
          </Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => onSet("REJECTED", window.prompt("سبب الرفض:") ?? undefined)}>
            رفض
          </Button>
        </>
      )}
      {status === "ACTIVE" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onSet("ARCHIVED")}>
          إخفاء
        </Button>
      )}
      {(status === "ARCHIVED" || status === "REJECTED" || status === "DRAFT") && (
        <Button size="sm" disabled={busy} onClick={() => onSet("ACTIVE")}>
          نشر
        </Button>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className={`mt-1 text-base font-bold nums ${warn ? "text-gold-600" : ""}`}>{value}</p>
      </CardBody>
    </Card>
  );
}
