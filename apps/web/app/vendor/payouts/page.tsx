"use client";

import { Card, CardBody, Badge } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

const PAYOUT_LABEL: Record<string, string> = {
  PENDING: "قيد الانتظار",
  PROCESSING: "قيد المعالجة",
  PAID: "مدفوعة",
  FAILED: "فشلت",
};
const PAYOUT_STYLE: Record<string, string> = {
  PENDING: "bg-neutral-100 text-neutral-600",
  PROCESSING: "bg-info/10 text-info",
  PAID: "bg-brand-100 text-brand-700",
  FAILED: "bg-danger/10 text-danger",
};

export default function VendorPayouts() {
  const data = trpc.vendor.payouts.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الرصيد والتسويات</h1>

      <Card>
        <CardBody>
          <p className="text-sm text-neutral-500">الرصيد المستحق (طلبات مسلّمة غير مسوّاة)</p>
          <p className="mt-1 text-3xl font-bold text-brand-600 nums">
            {formatIQD(data.data?.pendingBalance ?? 0)}
          </p>
          <p className="mt-1 text-xs text-neutral-400">تُحوّل التسويات دورياً من الإدارة.</p>
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-2 font-bold">سجل التسويات</h2>
        {data.isLoading ? (
          <p className="text-neutral-500">جارٍ التحميل…</p>
        ) : data.data && data.data.payouts.length > 0 ? (
          <ul className="space-y-2">
            {data.data.payouts.map((p) => (
              <Card key={p.id}>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-brand-600 nums">{formatIQD(p.amount)}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(p.periodStart).toLocaleDateString("ar-IQ")} —{" "}
                      {new Date(p.periodEnd).toLocaleDateString("ar-IQ")}
                    </p>
                  </div>
                  <Badge className={PAYOUT_STYLE[p.status]}>{PAYOUT_LABEL[p.status]}</Badge>
                </CardBody>
              </Card>
            ))}
          </ul>
        ) : (
          <p className="text-neutral-500">لا توجد تسويات بعد.</p>
        )}
      </div>
    </div>
  );
}
