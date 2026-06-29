"use client";

import { useState } from "react";
import { Button, Card, CardBody, Badge } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

const VSTATUS: Record<string, { label: string; style: string }> = {
  PENDING: { label: "قيد المراجعة", style: "bg-gold-400/20 text-gold-600" },
  APPROVED: { label: "معتمد", style: "bg-brand-100 text-brand-700" },
  REJECTED: { label: "مرفوض", style: "bg-danger/10 text-danger" },
  SUSPENDED: { label: "معلّق", style: "bg-neutral-200 text-neutral-600" },
};

const FILTERS = ["", "PENDING", "APPROVED", "SUSPENDED", "REJECTED"];

export default function AdminVendors() {
  const [status, setStatus] = useState("");
  const vendors = trpc.admin.vendors.useQuery({ status: status || undefined }, { retry: false });
  const utils = trpc.useUtils();
  const review = trpc.admin.reviewVendor.useMutation({
    onSuccess: () => {
      utils.admin.vendors.invalidate();
      utils.admin.dashboard.invalidate();
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">البائعون</h1>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatus(f)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-sm ${
              status === f ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {f ? (VSTATUS[f]?.label ?? f) : "الكل"}
          </button>
        ))}
      </div>

      {vendors.isLoading ? (
        <p className="text-neutral-500">جارٍ التحميل…</p>
      ) : (
        <ul className="space-y-3">
          {vendors.data?.map((v) => (
            <Card key={v.id}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold">{v.storeName}</p>
                    <p className="text-sm text-neutral-500">
                      {v.ownerName ?? "—"} · <span className="nums">{v.phone}</span>
                      {v.governorate ? ` · ${v.governorate}` : ""}
                    </p>
                    <p className="text-xs text-neutral-400 nums">
                      {v.products} منتج · {v.orders} طلب
                    </p>
                  </div>
                  <Badge className={VSTATUS[v.status]?.style ?? ""}>{VSTATUS[v.status]?.label ?? v.status}</Badge>
                </div>

                <div className="flex gap-2">
                  {v.status !== "APPROVED" && (
                    <Button
                      size="sm"
                      loading={review.isPending}
                      onClick={() => review.mutate({ vendorId: v.id, decision: "APPROVED" })}
                    >
                      اعتماد
                    </Button>
                  )}
                  {v.status === "APPROVED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const note = window.prompt("سبب التعليق (اختياري):") ?? undefined;
                        review.mutate({ vendorId: v.id, decision: "SUSPENDED", note });
                      }}
                    >
                      تعليق
                    </Button>
                  )}
                  {v.status === "PENDING" && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        const note = window.prompt("سبب الرفض:") ?? undefined;
                        review.mutate({ vendorId: v.id, decision: "REJECTED", note });
                      }}
                    >
                      رفض
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
