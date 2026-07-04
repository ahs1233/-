"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, CardBody, Badge, OrderStatusBadge, useToast } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { QueryError } from "@/src/components/query-error";

const VSTATUS: Record<string, { label: string; style: string }> = {
  PENDING: { label: "قيد المراجعة", style: "bg-gold-400/20 text-gold-600" },
  APPROVED: { label: "معتمد", style: "bg-brand-100 text-brand-700" },
  REJECTED: { label: "مرفوض", style: "bg-danger/10 text-danger" },
  SUSPENDED: { label: "معلّق", style: "bg-neutral-200 text-neutral-600" },
};

export default function AdminVendorDetail() {
  const id = String(useParams().id);
  const { error: toastError, success } = useToast();
  const utils = trpc.useUtils();
  const vendor = trpc.admin.vendorDetail.useQuery({ id }, { retry: false });
  const review = trpc.admin.reviewVendor.useMutation({
    onSuccess: () => {
      success("تم تحديث حالة البائع");
      utils.admin.vendorDetail.invalidate({ id });
      utils.admin.vendors.invalidate();
    },
    onError: (e) => toastError(e.message),
  });

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
        <Link
          href="/admin/payouts"
          className="inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          تسوية المستحقات ←
        </Link>
      )}

      {/* إجراءات المراجعة */}
      <Card>
        <CardBody className="space-y-2">
          <h2 className="font-bold">الإجراءات</h2>
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
