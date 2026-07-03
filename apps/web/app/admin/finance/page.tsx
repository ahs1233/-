"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { QueryError } from "@/src/components/query-error";

type Period = "today" | "7d" | "30d" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "اليوم" },
  { key: "7d", label: "٧ أيام" },
  { key: "30d", label: "٣٠ يوم" },
  { key: "all", label: "الكل" },
];

export default function AdminFinance() {
  const [period, setPeriod] = useState<Period>("30d");
  const fin = trpc.admin.financeSummary.useQuery({ period }, { retry: false });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">المالية والمحاسبة</h1>
        <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5 text-sm">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1 transition ${
                period === p.key ? "bg-brand-500 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {fin.isLoading && <p className="text-neutral-500">جارٍ التحميل…</p>}
      {(fin.isError || (!fin.isLoading && !fin.data)) && (
        <QueryError message={fin.error?.message} onRetry={() => fin.refetch()} />
      )}

      {fin.data && (
        <div className="space-y-4">
          {/* دخل المنصّة */}
          <Card className="bg-brand-600 text-white">
            <CardBody>
              <p className="text-sm text-white/80">صافي دخل المنصّة (خلال الفترة)</p>
              <p className="mt-1 text-3xl font-extrabold nums">{formatIQD(fin.data.platformRevenue)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Split label="عمولة المبيعات" value={formatIQD(fin.data.commissionRevenue)} />
                <Split label="رسوم التوصيل" value={formatIQD(fin.data.deliveryRevenue)} />
              </div>
            </CardBody>
          </Card>

          {/* حركة المبيعات */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="مبيعات البضاعة" value={formatIQD(fin.data.merchandiseSales)} />
            <Stat label="إجمالي قيمة الطلبات (GMV)" value={formatIQD(fin.data.gmv)} hint="بضاعة + توصيل" />
            <Stat label="طلبات مُنجزة" value={String(fin.data.realizedOrders)} />
            <Stat label="متوسّط قيمة الطلب" value={formatIQD(Math.round(fin.data.avgOrderValue))} />
            <Stat label="أرباح البائعين (بالفترة)" value={formatIQD(fin.data.vendorEarnings)} hint="المبيعات − العمولة" />
          </div>

          {/* مستحقات البائعين */}
          <Card>
            <CardBody className="space-y-3">
              <h2 className="font-bold">مستحقات البائعين</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gold-400/10 p-3">
                  <p className="text-xs text-neutral-500">قائم (غير مسوّى)</p>
                  <p className={`mt-1 text-xl font-bold nums ${fin.data.outstandingPayable > 0 ? "text-gold-600" : ""}`}>
                    {formatIQD(fin.data.outstandingPayable)}
                  </p>
                </div>
                <div className="rounded-lg bg-neutral-100 p-3">
                  <p className="text-xs text-neutral-500">مسوّى (تاريخياً)</p>
                  <p className="mt-1 text-xl font-bold nums text-neutral-700">{formatIQD(fin.data.settledTotal)}</p>
                </div>
              </div>
              {fin.data.outstandingPayable > 0 && (
                <Link
                  href="/admin/payouts"
                  className="inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                >
                  الذهاب إلى التسويات ←
                </Link>
              )}
            </CardBody>
          </Card>

          <p className="text-xs text-neutral-400">
            يُحتسب الإيراد على الطلبات المُسلّمة/المكتملة. رسوم التوصيل تعود للمنصّة. الرصيد المستحق لحظيّ (كل الفترات).
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="mt-1 text-lg font-bold nums">{value}</p>
        {hint && <p className="text-[10px] text-neutral-400">{hint}</p>}
      </CardBody>
    </Card>
  );
}

function Split({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 p-2">
      <p className="text-white/70">{label}</p>
      <p className="font-bold nums">{value}</p>
    </div>
  );
}
