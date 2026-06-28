"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardBody, Input } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

export default function AdminSettings() {
  const settings = trpc.admin.getSettings.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const update = trpc.admin.updateSettings.useMutation({
    onSuccess: () => {
      utils.admin.getSettings.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  const [commissionPct, setCommissionPct] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setCommissionPct(String(Math.round(settings.data.commissionRate * 100)));
      setDeliveryFee(String(settings.data.deliveryFee));
    }
  }, [settings.data]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">إعدادات المنصة</h1>

      <Card>
        <CardBody className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">نسبة العمولة (%)</span>
            <Input inputMode="numeric" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
            <span className="text-xs text-neutral-400">تُطبَّق على الطلبات الجديدة.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">رسوم التوصيل لكل بائع (د.ع)</span>
            <Input inputMode="numeric" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
          </label>
          <Button
            loading={update.isPending}
            onClick={() =>
              update.mutate({
                commissionRate: Math.max(0, Math.min(100, Number(commissionPct))) / 100,
                deliveryFee: Number(deliveryFee),
              })
            }
          >
            {saved ? "تم الحفظ ✓" : "حفظ"}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
