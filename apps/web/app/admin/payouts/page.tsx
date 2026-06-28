"use client";

import { Button, Card, CardBody, Badge } from "@al-souq/ui";
import { formatIQD } from "@al-souq/utils";
import { trpc } from "@/src/trpc/react";

export default function AdminPayouts() {
  const balances = trpc.admin.payoutBalances.useQuery(undefined, { retry: false });
  const history = trpc.admin.payoutHistory.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const settle = trpc.admin.settlePayout.useMutation({
    onSuccess: () => {
      utils.admin.payoutBalances.invalidate();
      utils.admin.payoutHistory.invalidate();
    },
    onError: (e) => alert(e.message),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">التسويات</h1>

      <div>
        <h2 className="mb-2 font-bold">أرصدة مستحقة للبائعين</h2>
        {balances.isLoading ? (
          <p className="text-neutral-500">جارٍ التحميل…</p>
        ) : balances.data && balances.data.length > 0 ? (
          <ul className="space-y-2">
            {balances.data.map((b) => (
              <Card key={b.vendorId}>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{b.storeName}</p>
                    <p className="font-bold text-brand-600 nums">{formatIQD(b.balance)}</p>
                  </div>
                  <Button
                    size="sm"
                    loading={settle.isPending}
                    onClick={() => {
                      if (confirm(`تسوية ${formatIQD(b.balance)} لـ ${b.storeName}؟`)) settle.mutate({ vendorId: b.vendorId });
                    }}
                  >
                    تسوية الآن
                  </Button>
                </CardBody>
              </Card>
            ))}
          </ul>
        ) : (
          <p className="text-neutral-500">لا توجد أرصدة مستحقة.</p>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-bold">سجل التسويات</h2>
        {history.data && history.data.length > 0 ? (
          <ul className="space-y-2">
            {history.data.map((p) => (
              <Card key={p.id}>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{p.vendor}</p>
                    <p className="text-xs text-neutral-400">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString("ar-IQ") : "—"}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-bold text-brand-600 nums">{formatIQD(p.amount)}</p>
                    <Badge className="bg-brand-100 text-brand-700">{p.status}</Badge>
                  </div>
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
