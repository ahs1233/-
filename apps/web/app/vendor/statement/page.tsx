"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, useToast } from "@al-souq/ui";
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

export default function VendorStatement() {
  const [period, setPeriod] = useState<Period>("30d");
  const fin = trpc.vendor.financeSummary.useQuery({ period }, { retry: false });
  const utils = trpc.useUtils();
  const { success, error } = useToast();
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await utils.vendor.exportStatementCsv.fetch({ period });
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      success(`تم تصدير ${res.count} طلب`);
    } catch (e) {
      error(e instanceof Error ? e.message : "تعذّر التصدير");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">كشف الحساب</h1>
        <div className="flex items-center gap-2">
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
          <Button size="sm" variant="outline" loading={exporting} onClick={exportCsv}>
            تصدير CSV
          </Button>
        </div>
      </div>

      {fin.isLoading && <p className="text-neutral-500">جارٍ التحميل…</p>}
      {fin.isError && <QueryError message={fin.error.message} onRetry={() => fin.refetch()} />}

      {fin.data && (
        <div className="space-y-4">
          {/* صافي الربح */}
          <Card className="bg-brand-600 text-white">
            <CardBody>
              <p className="text-sm text-white/80">صافي الربح (طلبات مُنجزة خلال الفترة)</p>
              <p className="mt-1 text-3xl font-extrabold nums">{formatIQD(fin.data.netEarnings)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Split label="قيمة البضاعة" value={formatIQD(fin.data.grossSales)} />
                <Split label="عمولة المنصّة" value={`− ${formatIQD(fin.data.commission)}`} />
              </div>
            </CardBody>
          </Card>

          {/* مؤشرات */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="طلبات مُنجزة" value={String(fin.data.realizedOrders)} />
            <Stat label="متوسّط قيمة الطلب" value={formatIQD(Math.round(fin.data.avgOrderValue))} />
            <Stat label="قيد التنفيذ" value={String(fin.data.pendingOrders)} hint={formatIQD(fin.data.pendingSales)} />
          </div>

          {/* الرصيد المستحق */}
          <Card>
            <CardBody className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-neutral-500">الرصيد المستحق (غير مسوّى — كل الفترات)</p>
                <p className={`mt-1 text-2xl font-bold nums ${fin.data.outstandingBalance > 0 ? "text-gold-600" : ""}`}>
                  {formatIQD(fin.data.outstandingBalance)}
                </p>
              </div>
              <Link
                href="/vendor/payouts"
                className="rounded-lg border border-brand-500 px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50"
              >
                التسويات ←
              </Link>
            </CardBody>
          </Card>

          <p className="text-xs text-neutral-400">
            يُحتسب صافي الربح على الطلبات المُسلّمة/المكتملة (قيمة البضاعة − عمولة المنصّة). رسوم التوصيل تعود للمنصّة.
            صدّر CSV لكشف تفصيلي لكل طلب.
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
        {hint && <p className="text-[10px] text-neutral-400 nums">{hint}</p>}
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
