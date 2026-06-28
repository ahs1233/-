"use client";

import { Card, CardBody } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

const ACTION_LABEL: Record<string, string> = {
  "vendor.approved": "اعتماد بائع",
  "vendor.rejected": "رفض بائع",
  "vendor.suspended": "تعليق بائع",
  "product.approve": "نشر منتج",
  "product.reject": "رفض منتج",
  "category.create": "إنشاء فئة",
  "category.update": "تعديل فئة",
  "category.delete": "حذف فئة",
  "order.force_status": "تدخّل بطلب",
  "payout.create": "إنشاء تسوية",
  "user.block": "حظر مستخدم",
  "user.unblock": "رفع حظر",
  "settings.update": "تعديل الإعدادات",
};

export default function AdminAudit() {
  const logs = trpc.admin.auditLog.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">سجل التدقيق</h1>

      {logs.isLoading ? (
        <p className="text-neutral-500">جارٍ التحميل…</p>
      ) : logs.data && logs.data.length > 0 ? (
        <ul className="space-y-2">
          {logs.data.map((l) => (
            <Card key={l.id}>
              <CardBody className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{ACTION_LABEL[l.action] ?? l.action}</p>
                  <p className="text-xs text-neutral-500">
                    {l.entityType} · بواسطة {l.actor}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-neutral-400">
                  {new Date(l.createdAt).toLocaleString("ar-IQ")}
                </span>
              </CardBody>
            </Card>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-500">لا توجد سجلات بعد.</p>
      )}
    </div>
  );
}
