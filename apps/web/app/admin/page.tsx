"use client";

import Link from "next/link";
import { Card, CardBody, OrderStatusBadge, ORDER_STATUS_LABEL } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";
import { QueryError } from "@/src/components/query-error";
import { useAdminGov } from "@/src/components/admin/admin-gov";

const ORDER_STATES = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"] as const;

export default function AdminDashboard() {
  const { govId } = useAdminGov();
  const kpi = trpc.admin.dashboard.useQuery({ governorateId: govId ?? undefined }, { retry: false, refetchInterval: 60_000 });

  if (kpi.isLoading) return <DashboardSkeleton />;
  if (kpi.isError || !kpi.data) return <QueryError message={kpi.error?.message} onRetry={() => kpi.refetch()} />;
  const d = kpi.data;

  const actions = [
    { n: d.pendingVendors, label: "متجر بانتظار الاعتماد", href: "/admin/vendors" },
    { n: d.pendingProducts, label: "منتج بانتظار المراجعة", href: "/admin/products" },
    { n: d.pendingReturns, label: "طلب إرجاع قيد المراجعة", href: "/admin/orders" },
  ].filter((a) => a.n > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">لوحة المؤشرات</h1>
        <p className="text-sm text-neutral-500">نظرة عامة على أداء المنصّة — يُحدَّث تلقائياً.</p>
      </div>

      {/* تنبيهات الإجراءات المطلوبة */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className="flex items-center gap-2 rounded-full border border-gold-300 bg-gold-50 px-3 py-1.5 text-sm text-gold-700 transition hover:bg-gold-100"
            >
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold-500 px-1 text-xs font-bold text-white nums">
                {a.n}
              </span>
              {a.label}
              <span aria-hidden>←</span>
            </Link>
          ))}
        </div>
      )}

      {/* بطاقات KPI مع الاتجاه */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="المبيعات (آخر ٣٠ يوماً)"
          value={formatIQD(d.gmv30)}
          curr={d.gmv30}
          prev={d.gmvPrev30}
          accent
        />
        <KpiCard label="الطلبات (آخر ٣٠ يوماً)" value={String(d.orders30)} curr={d.orders30} prev={d.ordersPrev30} />
        <KpiCard label="إيراد العمولات (كلّي)" value={formatIQD(d.commissionRevenue)} />
        <KpiCard label="المستخدمون" value={String(d.users)} sub={`${d.realizedOrders} طلب مُنجز إجمالاً`} />
      </div>

      {/* صحّة الكتالوج — بناءً على أحدث البيانات (توثيق/عروض/مخزون/موقع) */}
      <CatalogHealth c={d.catalog} />

      {/* رسم المبيعات — آخر ١٤ يوماً */}
      <SalesChart series={d.salesSeries} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* الطلبات حسب الحالة */}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-bold">الطلبات حسب الحالة</h2>
            <StatusBars map={d.ordersByStatus} />
          </CardBody>
        </Card>

        {/* أعلى المتاجر مبيعاً */}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-bold">أعلى المتاجر مبيعاً</h2>
            <TopVendors rows={d.topVendors} />
          </CardBody>
        </Card>
      </div>

      {/* أحدث الطلبات */}
      <Card>
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">أحدث الطلبات</h2>
            <Link href="/admin/orders" className="text-sm text-brand-600 hover:underline">
              عرض الكل ←
            </Link>
          </div>
          {d.recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">لا طلبات بعد.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:bg-neutral-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium nums">{o.number}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {o.vendor} ·{" "}
                        {new Date(o.placedAt).toLocaleString("ar-IQ", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <span className="text-sm font-medium nums">{formatIQD(o.total)}</span>
                      <OrderStatusBadge status={o.status} />
                    </div>
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

/** صحّة الكتالوج — مؤشّراتٌ مشتقّة من أحدث البيانات: التوثيق، العروض، المخزون، الموقع. */
function CatalogHealth({
  c,
}: {
  c: {
    storesApproved: number;
    storesVerified: number;
    storesLocated: number;
    newStores7: number;
    offersActive: number;
    outOfStock: number;
    activeProducts: number;
  };
}) {
  const cells = [
    { label: "متجر معتمد", value: c.storesApproved, sub: `${c.storesVerified} موثّق ✓`, href: "/admin/vendors" },
    { label: "منتج نشط", value: c.activeProducts, sub: "معروضٌ للبيع", href: "/admin/products" },
    { label: "عرض فعّال", value: c.offersActive, sub: "منتجٌ عليه خصم", href: "/admin/products", accent: "gold" as const },
    { label: "نافد المخزون", value: c.outOfStock, sub: "يحتاج متابعة", href: "/admin/products", accent: c.outOfStock > 0 ? ("danger" as const) : undefined },
    { label: "متجر جديد", value: c.newStores7, sub: "آخر ٧ أيّام", href: "/admin/vendors" },
    { label: "على الخريطة", value: c.storesLocated, sub: "له موقعٌ محدّد", href: "/admin/vendors" },
  ];
  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-bold">صحّة الكتالوج</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cells.map((x) => (
            <Link key={x.label} href={x.href} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3 transition hover:border-gold-300 hover:bg-gold-50/40">
              <p className={`text-2xl font-extrabold nums ${x.accent === "danger" ? "text-danger" : x.accent === "gold" ? "text-gold-600" : "text-brand-700"}`}>{x.value}</p>
              <p className="mt-0.5 text-xs font-semibold text-neutral-700">{x.label}</p>
              <p className="text-[11px] text-neutral-400">{x.sub}</p>
            </Link>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/** بطاقة مؤشّر برقم بطل ومؤشّر اتجاه اختياري مقابل الفترة السابقة. */
function KpiCard({
  label,
  value,
  curr,
  prev,
  sub,
  accent,
}: {
  label: string;
  value: string;
  curr?: number;
  prev?: number;
  sub?: string;
  accent?: boolean;
}) {
  const hasTrend = curr !== undefined && prev !== undefined;
  const pct = hasTrend && prev! > 0 ? ((curr! - prev!) / prev!) * 100 : null;
  const up = pct !== null && pct >= 0;
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className={`mt-1 text-xl font-bold nums ${accent ? "text-brand-600" : "text-neutral-800"}`}>{value}</p>
        {pct !== null ? (
          <p className={`mt-1 flex items-center gap-1 text-xs nums ${up ? "text-success" : "text-danger"}`}>
            <span aria-hidden>{up ? "▲" : "▼"}</span>
            {up ? "+" : ""}
            {pct.toFixed(0)}%
            <span className="text-neutral-400">مقابل السابق</span>
          </p>
        ) : hasTrend ? (
          <p className="mt-1 text-xs text-neutral-400">جديد</p>
        ) : sub ? (
          <p className="mt-1 text-xs text-neutral-400">{sub}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** رسم أعمدة لمبيعات آخر ١٤ يوماً — سلسلة واحدة بلون العلامة، مرتكزة على خطّ الأساس. */
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
          <p className="py-10 text-center text-sm text-neutral-400">لا مبيعات مُنجزة في آخر ١٤ يوماً</p>
        ) : (
          <>
            <div
              className="flex h-40 items-end gap-1.5 border-b border-neutral-200"
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
            <div className="mt-1.5 flex justify-between text-[10px] text-neutral-400 nums">
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

/** أشرطة أفقية لعدد الطلبات في كل حالة — لون واحد (مقدار)، مع تسمية مباشرة. */
function StatusBars({ map }: { map: Record<string, number> }) {
  const rows = ORDER_STATES.map((s) => ({ status: s, count: map[s] ?? 0 })).filter((r) => r.count > 0);
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-neutral-400">لا بيانات</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.status} className="flex items-center gap-2 text-sm">
          <span className="w-24 flex-shrink-0 text-neutral-600">{ORDER_STATUS_LABEL[r.status]}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }} />
          </div>
          <span className="w-8 flex-shrink-0 text-end font-medium nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

/** أعلى المتاجر مبيعاً — قائمة مرتّبة بأشرطة مقدار نسبية. */
function TopVendors({ rows }: { rows: { id: string; storeName: string; sales: number }[] }) {
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-neutral-400">لا بيانات</p>;
  const max = Math.max(1, ...rows.map((r) => r.sales));
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.id}>
          <Link href={`/admin/vendors/${r.id}`} className="block hover:opacity-80">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-500 nums">
                  {i + 1}
                </span>
                <span className="truncate">{r.storeName}</span>
              </span>
              <span className="flex-shrink-0 font-medium nums">{formatIQD(r.sales)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-brand-400" style={{ width: `${Math.max(3, (r.sales / max) * 100)}%` }} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-40 animate-pulse rounded bg-neutral-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-100" />
        ))}
      </div>
      <div className="h-52 animate-pulse rounded-xl bg-neutral-100" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    </div>
  );
}
