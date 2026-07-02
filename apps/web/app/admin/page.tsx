"use client";

import Link from "next/link";
import { Card, CardBody } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { QueryError } from "@/src/components/query-error";

export default function AdminDashboard() {
  const kpi = trpc.admin.dashboard.useQuery(undefined, { retry: false });

  if (kpi.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;
  if (kpi.isError || !kpi.data) return <QueryError message={kpi.error?.message} onRetry={() => kpi.refetch()} />;
  const d = kpi.data;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">المؤشرات</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="إجمالي المبيعات (GMV)" value={formatIQD(d.gmv)} accent />
        <Stat label="إيراد العمولات" value={formatIQD(d.commissionRevenue)} accent />
        <Stat label="طلبات منجزة" value={String(d.realizedOrders)} />
        <Stat label="المستخدمون" value={String(d.users)} />
        <Stat label="بائعون قيد المراجعة" value={String(d.pendingVendors)} warn={d.pendingVendors > 0} />
        <Stat label="منتجات قيد المراجعة" value={String(d.pendingProducts)} warn={d.pendingProducts > 0} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-2 font-bold">الطلبات حسب الحالة</h2>
            <StatusList map={d.ordersByStatus} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="mb-2 font-bold">البائعون حسب الحالة</h2>
            <StatusList map={d.vendorsByStatus} />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {d.pendingVendors > 0 && (
          <Link href="/admin/vendors">
            <Card className="bg-gold-400/10 text-center hover:shadow-md">
              <CardBody>
                <p className="font-bold text-gold-600">{d.pendingVendors} بائع بانتظار الاعتماد</p>
              </CardBody>
            </Card>
          </Link>
        )}
        {d.pendingProducts > 0 && (
          <Link href="/admin/products">
            <Card className="bg-gold-400/10 text-center hover:shadow-md">
              <CardBody>
                <p className="font-bold text-gold-600">{d.pendingProducts} منتج بانتظار المراجعة</p>
              </CardBody>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className={`mt-1 text-lg font-bold nums ${accent ? "text-brand-600" : warn ? "text-warning" : ""}`}>{value}</p>
      </CardBody>
    </Card>
  );
}

function StatusList({ map }: { map: Record<string, number> }) {
  const entries = Object.entries(map);
  if (entries.length === 0) return <p className="text-sm text-neutral-400">لا بيانات</p>;
  return (
    <ul className="space-y-1 text-sm">
      {entries.map(([k, v]) => (
        <li key={k} className="flex justify-between">
          <span className="text-neutral-600">{k}</span>
          <span className="font-medium nums">{v}</span>
        </li>
      ))}
    </ul>
  );
}
