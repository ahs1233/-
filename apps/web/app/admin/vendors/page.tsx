"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Badge, Input } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { DataTable, type Column } from "@/src/components/data-table";

const VSTATUS: Record<string, { label: string; style: string }> = {
  PENDING: { label: "قيد المراجعة", style: "bg-gold-400/20 text-gold-600" },
  APPROVED: { label: "معتمد", style: "bg-brand-100 text-brand-700" },
  REJECTED: { label: "مرفوض", style: "bg-danger/10 text-danger" },
  SUSPENDED: { label: "معلّق", style: "bg-neutral-200 text-neutral-600" },
};

const FILTERS = ["", "PENDING", "APPROVED", "SUSPENDED", "REJECTED"];

export default function AdminVendors() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const vendors = trpc.admin.vendors.useQuery(
    { status: status || undefined, search: search.trim() || undefined },
    { retry: false },
  );
  const utils = trpc.useUtils();
  const review = trpc.admin.reviewVendor.useMutation({
    onSuccess: () => {
      utils.admin.vendors.invalidate();
      utils.admin.dashboard.invalidate();
    },
  });

  type Vendor = NonNullable<typeof vendors.data>[number];
  const columns: Column<Vendor>[] = [
    {
      key: "storeName",
      header: "المتجر",
      sortValue: (v) => v.storeName,
      render: (v) => (
        <Link href={`/admin/vendors/${v.id}`} className="font-bold text-brand-600 hover:underline">
          {v.storeName}
        </Link>
      ),
    },
    {
      key: "owner",
      header: "المالك",
      render: (v) => (
        <span className="text-sm">
          {v.ownerName ?? "—"} · <span className="nums text-neutral-500">{v.phone}</span>
        </span>
      ),
    },
    { key: "governorate", header: "المحافظة", render: (v) => v.governorate ?? "—" },
    { key: "products", header: "منتجات", align: "center", sortValue: (v) => v.products, render: (v) => <span className="nums">{v.products}</span> },
    { key: "orders", header: "طلبات", align: "center", sortValue: (v) => v.orders, render: (v) => <span className="nums">{v.orders}</span> },
    {
      key: "status",
      header: "الحالة",
      sortValue: (v) => v.status,
      render: (v) => <Badge className={VSTATUS[v.status]?.style ?? ""}>{VSTATUS[v.status]?.label ?? v.status}</Badge>,
    },
    {
      key: "action",
      header: "إجراءات",
      hideLabelOnMobile: true,
      render: (v) => (
        <div className="flex flex-wrap gap-1.5">
          <Link href={`/admin/vendors/${v.id}`}>
            <Button size="sm" variant="outline">
              إدارة ←
            </Button>
          </Link>
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
          {v.status === "PENDING" && (
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
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">البائعون</h1>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث باسم المتجر…" />

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
        <DataTable
          columns={columns}
          rows={vendors.data ?? []}
          getRowKey={(v) => v.id}
          initialSort={{ key: "orders", dir: "desc" }}
          emptyLabel="لا بائعين مطابقين"
        />
      )}
    </div>
  );
}
