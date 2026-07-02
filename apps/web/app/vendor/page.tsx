"use client";

import Link from "next/link";
import { Card, CardBody } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { QueryError } from "@/src/components/query-error";

export default function VendorHome() {
  const analytics = trpc.vendor.analytics.useQuery(undefined, { retry: false });
  const payouts = trpc.vendor.payouts.useQuery(undefined, { retry: false });

  if (analytics.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;
  if (analytics.isError)
    return <QueryError message={analytics.error.message} onRetry={() => analytics.refetch()} />;
  const a = analytics.data;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">نظرة عامة</h1>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="صافي الإيرادات" value={formatIQD(a?.netRevenue ?? 0)} accent />
        <Stat label="الرصيد المستحق" value={formatIQD(payouts.data?.pendingBalance ?? 0)} />
        <Stat label="طلبات مكتملة" value={String(a?.completedOrders ?? 0)} />
        <Stat label="طلبات بانتظار التأكيد" value={String(a?.pendingOrders ?? 0)} warn={Boolean(a?.pendingOrders)} />
      </div>

      <Card>
        <CardBody>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">إجمالي قبل العمولة</h2>
            <span className="text-sm text-neutral-500">
              عمولة المنصة: {formatIQD(a?.commission ?? 0)}
            </span>
          </div>
          <p className="text-2xl font-bold text-brand-600 nums">{formatIQD(a?.grossRevenue ?? 0)}</p>
        </CardBody>
      </Card>

      {a && a.topProducts.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="mb-2 font-bold">الأكثر مبيعاً</h2>
            <ul className="space-y-1">
              {a.topProducts.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className="line-clamp-1">{p.title}</span>
                  <span className="text-neutral-500 nums">{p.soldCount} قطعة</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/vendor/products">
          <Card className="text-center hover:shadow-md">
            <CardBody>
              <p className="font-bold text-brand-600">إدارة المنتجات</p>
              <p className="text-sm text-neutral-500">
                {Object.values(a?.productsByStatus ?? {}).reduce((s, n) => s + n, 0)} منتج
              </p>
            </CardBody>
          </Card>
        </Link>
        <Link href="/vendor/orders">
          <Card className="text-center hover:shadow-md">
            <CardBody>
              <p className="font-bold text-brand-600">إدارة الطلبات</p>
              <p className="text-sm text-neutral-500">
                {Object.values(a?.ordersByStatus ?? {}).reduce((s, n) => s + n, 0)} طلب
              </p>
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className={`mt-1 text-lg font-bold nums ${accent ? "text-brand-600" : warn ? "text-warning" : ""}`}>
          {value}
        </p>
      </CardBody>
    </Card>
  );
}
