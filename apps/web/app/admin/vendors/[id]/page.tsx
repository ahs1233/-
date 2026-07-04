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

      {/* أحدث الطلبات */}
      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">أحدث الطلبات</h2>
          {v.recentOrders.length === 0 ? (
            <p className="text-sm text-neutral-400">لا طلبات بعد.</p>
          ) : (
            v.recentOrders.map((o) => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center justify-between py-1 text-sm hover:bg-neutral-50">
                <span className="font-medium nums">{o.number}</span>
                <span className="flex items-center gap-2">
                  <span className="nums text-neutral-500">{formatIQD(o.total)}</span>
                  <OrderStatusBadge status={o.status} />
                </span>
              </Link>
            ))
          )}
        </CardBody>
      </Card>
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
