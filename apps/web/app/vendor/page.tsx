"use client";

import Link from "next/link";
import { Card, CardBody } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { QueryError } from "@/src/components/query-error";

export default function VendorHome() {
  // نستطلع كل ٣٠ث لتنبيه شبه-فوري بالطلبات الجديدة.
  const analytics = trpc.vendor.analytics.useQuery(undefined, { retry: false, refetchInterval: 30_000 });
  const payouts = trpc.vendor.payouts.useQuery(undefined, { retry: false });

  if (analytics.isLoading) return <p className="text-neutral-500">جارٍ التحميل…</p>;
  if (analytics.isError) return <QueryError message={analytics.error.message} onRetry={() => analytics.refetch()} />;
  const a = analytics.data;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">نظرة عامة</h1>

      {/* تنبيه طلبات جديدة */}
      {a && a.pendingOrders > 0 && (
        <Link href="/vendor/orders">
          <Card className="border-gold-300 bg-gold-50 hover:shadow-md">
            <CardBody className="flex items-center gap-3">
              <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gold-400/30 text-lg">
                🔔
                <span className="absolute end-0 top-0 h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
              </span>
              <div className="flex-1">
                <p className="font-bold text-gold-700 nums">{a.pendingOrders} طلب جديد بانتظار التأكيد</p>
                <p className="text-xs text-gold-600">اضغط لمراجعتها وتأكيدها الآن ←</p>
              </div>
            </CardBody>
          </Card>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="صافي الإيرادات" value={formatIQD(a?.netRevenue ?? 0)} accent />
        <Stat label="الرصيد المستحق" value={formatIQD(payouts.data?.pendingBalance ?? 0)} />
        <Stat label="طلبات مكتملة" value={String(a?.completedOrders ?? 0)} />
        <Stat label="بانتظار التأكيد" value={String(a?.pendingOrders ?? 0)} warn={Boolean(a?.pendingOrders)} />
      </div>

      {/* رسم المبيعات */}
      {a && <SalesChart series={a.salesSeries} />}

      {/* تنبيه مخزون منخفض */}
      {a && a.lowStock.length > 0 && (
        <Card className="border-danger/30">
          <CardBody>
            <h2 className="mb-2 font-bold text-danger">⚠️ مخزون منخفض</h2>
            <ul className="space-y-1.5">
              {a.lowStock.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="line-clamp-1">
                    {v.title}
                    {Object.keys(v.attributes).length > 0 && (
                      <span className="text-neutral-400"> · {Object.values(v.attributes).join("، ")}</span>
                    )}
                  </span>
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs nums ${
                      v.available <= 0 ? "bg-danger/10 text-danger" : "bg-gold-400/20 text-gold-600"
                    }`}
                  >
                    {v.available <= 0 ? "نفد" : `باقٍ ${v.available}`}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/vendor/products" className="mt-2 inline-block text-sm text-brand-600">
              إدارة المخزون ←
            </Link>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">إجمالي قبل العمولة</h2>
            <span className="text-sm text-neutral-500">عمولة المنصة: {formatIQD(a?.commission ?? 0)}</span>
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
              <p className="text-sm text-neutral-500 nums">
                {Object.values(a?.productsByStatus ?? {}).reduce((s, n) => s + n, 0)} منتج
              </p>
            </CardBody>
          </Card>
        </Link>
        <Link href="/vendor/orders">
          <Card className="text-center hover:shadow-md">
            <CardBody>
              <p className="font-bold text-brand-600">إدارة الطلبات</p>
              <p className="text-sm text-neutral-500 nums">
                {Object.values(a?.ordersByStatus ?? {}).reduce((s, n) => s + n, 0)} طلب
              </p>
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
}

/** رسم أعمدة بسيط لمبيعات آخر ١٤ يوماً — سلسلة واحدة بلون العلامة، مرتكزة على خطّ الأساس. */
function SalesChart({ series }: { series: { day: string; revenue: number; orders: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.revenue));
  const total = series.reduce((s, d) => s + d.revenue, 0);
  const mid = Math.floor(series.length / 2);
  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">المبيعات — آخر ١٤ يوماً</h2>
          <span className="text-sm font-medium text-brand-600 nums">{formatIQD(total)}</span>
        </div>
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">لا مبيعات مُنجزة في آخر ١٤ يوماً</p>
        ) : (
          <>
            <div
              className="flex h-32 items-end gap-1 border-b border-neutral-200"
              role="img"
              aria-label={`مبيعات آخر ١٤ يوماً، الإجمالي ${formatIQD(total)}`}
            >
              {series.map((d, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-brand-500 transition-colors hover:bg-brand-600"
                  style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }}
                  title={`${d.day}: ${formatIQD(d.revenue)} · ${d.orders} طلب`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-neutral-400 nums">
              <span>{series[0]?.day}</span>
              <span>{series[mid]?.day}</span>
              <span>{series[series.length - 1]?.day}</span>
            </div>
          </>
        )}
      </CardBody>
    </Card>
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
